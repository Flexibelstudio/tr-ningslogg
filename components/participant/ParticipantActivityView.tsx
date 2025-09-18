import React, { useState, useMemo, useEffect } from 'react';
import { WorkoutLog, Workout, GeneralActivityLog, ActivityLog, GoalCompletionLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, LeaderboardSettings, CoachEvent, ParticipantPhysiqueStat, OneOnOneSession, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, Location } from '../../types';
import { Button } from '../Button';
import * as dateUtils from '../../utils/dateUtils';
import { DayActivitiesModal } from './DayActivitiesModal'; 
import { CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants';
import { LeaderboardView } from './LeaderboardView';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { AICoachActivitySummaryModal } from '../coach/AICoachActivitySummaryModal';
import { ClubsView } from './ClubsView';

interface ParticipantActivityViewProps {
  allActivityLogs: ActivityLog[]; 
  allLogsForLeaderboards: ActivityLog[];
  workouts: Workout[]; 
  onViewLogSummary: (log: ActivityLog) => void; 
  onDeleteActivity: (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => void;
  activeGoal?: ParticipantGoalData | null;
  strengthStatsHistory: UserStrengthStat[];
  allStrengthStatsForLeaderboards: UserStrengthStat[];
  conditioningStatsHistory: ParticipantConditioningStat[];
  physiqueHistory: ParticipantPhysiqueStat[];
  clubMemberships: ParticipantClubMembership[];
  allClubMemberships: ParticipantClubMembership[];
  participantProfile: ParticipantProfile | null;
  leaderboardSettings: LeaderboardSettings;
  allParticipantGoals: ParticipantGoalData[];
  coachEvents: CoachEvent[];
  oneOnOneSessions: OneOnOneSession[];
  staffMembers: StaffMember[];
  allParticipants: ParticipantProfile[];
  currentParticipantId: string;
  groupClassSchedules: GroupClassSchedule[];
  groupClassDefinitions: GroupClassDefinition[];
  allParticipantBookings: ParticipantBooking[];
  locations: Location[];
}

type CalendarEventType = 'PB' | 'GOAL_COMPLETED' | 'CLUB' | 'INBODY' | 'STRENGTH_TEST' | 'CONDITIONING_TEST' | 'NEW_GOAL' | 'COACH_EVENT' | 'ONE_ON_ONE' | 'GROUP_CLASS_BOOKING' | 'GOAL_TARGET';

interface CalendarEvent {
    type: CalendarEventType;
    icon: string;
    description: string;
}

const getStudioLabel = (target: 'all' | 'salem' | 'karra'): string => {
    const option = STUDIO_TARGET_OPTIONS.find(opt => opt.value === target);
    return option ? option.label : 'Okänd studio';
};

interface CalendarDayItem {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  activities: ActivityLog[];
  events: CalendarEvent[];
  isChallengeWeek?: boolean;
}

type ActivityViewTab = 'calendar' | 'klubbar' | 'leaderboards';

export const ParticipantActivityView: React.FC<ParticipantActivityViewProps> = ({ 
  allActivityLogs, 
  allLogsForLeaderboards,
  workouts, 
  onViewLogSummary, 
  onDeleteActivity, 
  activeGoal,
  strengthStatsHistory,
  allStrengthStatsForLeaderboards,
  conditioningStatsHistory,
  physiqueHistory,
  clubMemberships,
  allClubMemberships,
  participantProfile,
  leaderboardSettings,
  allParticipantGoals,
  coachEvents,
  oneOnOneSessions,
  staffMembers,
  allParticipants,
  currentParticipantId,
  groupClassSchedules,
  groupClassDefinitions,
  allParticipantBookings,
  locations,
}) => {
  const [activeTab, setActiveTab] = useState<ActivityViewTab>('calendar');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [isDayActivitiesModalOpen, setIsDayActivitiesModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<Date | null>(null);
  const [activitiesForSelectedDay, setActivitiesForSelectedDay] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (isDayActivitiesModalOpen && selectedDateForModal) {
      const updatedLogsForClickedDay = allActivityLogs.filter(log => 
        dateUtils.isSameDay(new Date(log.completedDate), selectedDateForModal)
      );
      setActivitiesForSelectedDay(updatedLogsForClickedDay);
    }
  }, [allActivityLogs, isDayActivitiesModalOpen, selectedDateForModal]);

  const currentMonthPeriod = useMemo(() => {
    const start = dateUtils.getStartOfMonth(referenceDate);
    const end = dateUtils.getEndOfMonth(referenceDate);
    return { start, end, label: dateUtils.formatPeriodLabel(start, end, 'month') };
  }, [referenceDate]);

  const calendarDays: CalendarDayItem[] = useMemo(() => {
    const days: CalendarDayItem[] = [];
    const monthStart = dateUtils.getStartOfMonth(referenceDate);
    
    let currentDay = dateUtils.getStartOfWeek(monthStart);
    const today = new Date();
    
    const goalTargetDates = allParticipantGoals
        .filter(g => g.targetDate)
        .map(g => new Date(g.targetDate!));

    const isChallengeActive = leaderboardSettings.weeklyPBChallengeEnabled || leaderboardSettings.weeklySessionChallengeEnabled;
    const startOfThisWeek = dateUtils.getStartOfWeek(new Date());
    const endOfThisWeek = dateUtils.getEndOfWeek(new Date());
    
    const myBookings = allParticipantBookings.filter(b => b.participantId === participantProfile?.id);

    for (let i = 0; i < 42; i++) { 
      const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), currentDay));
      const dayEvents: CalendarEvent[] = [];

      const bookingsToday = myBookings.filter(b => b.classDate === currentDay.toISOString().split('T')[0]);
      bookingsToday.forEach(booking => {
          const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
          if (schedule) {
              const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
              const coach = staffMembers.find(c => c.id === schedule.coachId);
              if (classDef && coach) {
                  dayEvents.push({
                      type: 'GROUP_CLASS_BOOKING',
                      icon: '🎟️',
                      description: `Bokat: ${classDef.name} kl ${schedule.startTime} med ${coach.name}`
                  });
              }
          }
      });

      const sessionsToday = oneOnOneSessions.filter(s =>
        s.participantId === participantProfile?.id && s.status === 'scheduled' && dateUtils.isSameDay(new Date(s.startTime), currentDay)
      );
      sessionsToday.forEach(session => {
        const coach = staffMembers.find(st => st.id === session.coachId);
        dayEvents.push({
            type: 'ONE_ON_ONE',
            icon: '🗣️',
            description: `Möte: ${session.title} med ${coach?.name || 'Coach'}`
        });
      });

      if (dayLogs.some(log => log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs?.length > 0)) {
        dayEvents.push({ type: 'PB', icon: '⭐', description: 'Personligt rekord uppnått!' });
      }
      if (dayLogs.some(log => log.type === 'goal_completion')) {
        dayEvents.push({ type: 'GOAL_COMPLETED', icon: '🏆', description: 'Mål uppnått!' });
      }
      const allAchievementsToday = clubMemberships.filter(c => dateUtils.isSameDay(new Date(c.achievedDate), currentDay));
      const highestAchievementsToday = getHighestClubAchievements(allAchievementsToday);
      if (highestAchievementsToday.length > 0) {
          const clubNames = highestAchievementsToday.map(c => CLUB_DEFINITIONS.find(cd => cd.id === c.clubId)?.name || 'Okänd klubb').join(', ');
          dayEvents.push({ type: 'CLUB', icon: '🏅', description: `Nytt klubbmedlemskap: ${clubNames}` });
      }
      if (physiqueHistory.some(h => dateUtils.isSameDay(new Date(h.lastUpdated), currentDay) && (h.inbodyScore || h.muscleMassKg))) {
          dayEvents.push({ type: 'INBODY', icon: '🧬', description: `InBody-mätning / Profil uppdaterad` });
      }
      if (strengthStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), currentDay))) {
          dayEvents.push({ type: 'STRENGTH_TEST', icon: '🏋️', description: 'Styrketest loggat' });
      }
      if (conditioningStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), currentDay))) {
          dayEvents.push({ type: 'CONDITIONING_TEST', icon: '💨', description: 'Konditionstest loggat' });
      }
      if (allParticipantGoals.some(g => dateUtils.isSameDay(new Date(g.setDate), currentDay))) {
          dayEvents.push({ type: 'NEW_GOAL', icon: '🏁', description: 'Nytt mål satt' });
      }
      const coachEventsToday = coachEvents.filter(e => {
        if (e.studioTarget && e.studioTarget !== 'all') {
            const participantLocation = locations.find(l => l.id === participantProfile?.locationId);
            if (!participantLocation || !participantLocation.name.toLowerCase().includes(e.studioTarget)) {
                return false;
            }
        }
        if (e.type !== 'event' || !e.eventDate) return false;
        const [year, month, day] = e.eventDate.split('-').map(Number);
        const eventDate = new Date(year, month - 1, day);
        return dateUtils.isSameDay(eventDate, currentDay);
      });
      coachEventsToday.forEach(event => {
        dayEvents.push({
            type: 'COACH_EVENT',
            icon: DEFAULT_COACH_EVENT_ICON,
            description: `Händelse: ${event.title}${event.studioTarget === 'all' ? ` (${getStudioLabel(event.studioTarget)})` : ''}`
        });
      });

      if (goalTargetDates.some(goalDate => dateUtils.isSameDay(currentDay, goalDate))) {
        dayEvents.push({ type: 'GOAL_TARGET', icon: '🎯', description: 'Måldatum!' });
      }

      const isChallengeWeek = isChallengeActive && currentDay >= startOfThisWeek && currentDay <= endOfThisWeek;

      days.push({
        date: new Date(currentDay),
        dayOfMonth: currentDay.getDate(),
        isCurrentMonth: currentDay.getMonth() === referenceDate.getMonth(),
        isToday: dateUtils.isSameDay(currentDay, today),
        activities: dayLogs,
        events: dayEvents,
        isChallengeWeek: isChallengeWeek,
      });
      currentDay = dateUtils.addDays(currentDay, 1);
      if (i >= 34 && currentDay.getMonth() !== referenceDate.getMonth() && currentDay.getDay() === 1) break; 
    }
    return days;
  }, [referenceDate, allActivityLogs, strengthStatsHistory, conditioningStatsHistory, physiqueHistory, clubMemberships, leaderboardSettings, allParticipantGoals, coachEvents, oneOnOneSessions, participantProfile, staffMembers, allParticipantBookings, groupClassSchedules, groupClassDefinitions, locations]);

  const handleNavigate = (direction: 'prev' | 'next') => {
    setReferenceDate(prevDate => dateUtils.addMonths(prevDate, direction === 'prev' ? -1 : 1));
  };

  const handleCalendarDayClick = (calendarDay: CalendarDayItem) => {
    if (calendarDay.activities.length > 0 || calendarDay.events.length > 0) {
        setActivitiesForSelectedDay(calendarDay.activities);
        setSelectedDateForModal(calendarDay.date);
        setIsDayActivitiesModalOpen(true);
    }
  };

  const getTabButtonStyle = (tabName: ActivityViewTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };
  
  const isProspect = participantProfile?.isProspect;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl mb-8 border border-gray-200">
      <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
              <button onClick={() => setActiveTab('calendar')} className={`flex-1 text-center whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base rounded-t-lg ${getTabButtonStyle('calendar')}`}>
                  🗓️ Kalender
              </button>
              <button onClick={() => setActiveTab('klubbar')} className={`flex-1 text-center whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base rounded-t-lg ${getTabButtonStyle('klubbar')}`}>
                  🏅 Klubbar
              </button>
              <button onClick={() => setActiveTab('leaderboards')} className={`flex-1 text-center whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base rounded-t-lg ${getTabButtonStyle('leaderboards')}`}>
                  🏆 Topplistor
              </button>
          </nav>
      </div>

      <div className="mt-4">
        {activeTab === 'calendar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button onClick={() => handleNavigate('prev')} size="sm" variant="outline" aria-label="Föregående månad">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </Button>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{currentMonthPeriod.label}</h3>
              <Button onClick={() => handleNavigate('next')} size="sm" variant="outline" aria-label="Nästa månad">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4-4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold text-gray-500 border-b mb-1 pb-1">
              {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day) => {
                const dayHasContent = day.activities.length > 0 || day.events.length > 0;
                const getLogIcon = (log: ActivityLog) => {
                  if (log.type === 'workout') return '🏋️';
                  if (log.type === 'general') return '🤸';
                  if (log.type === 'goal_completion') return '🏆';
                  return '❓';
                };
                const getLogTitle = (log: ActivityLog): string => {
                    if (log.type === 'workout') {
                        const workoutTemplate = workouts.find(w => w.id === (log as WorkoutLog).workoutId);
                        return workoutTemplate?.title || 'Okänt pass';
                    }
                    if (log.type === 'general') return (log as GeneralActivityLog).activityName;
                    if (log.type === 'goal_completion') return `Mål uppnått: ${(log as GoalCompletionLog).goalDescription}`;
                    return 'Okänd aktivitet';
                };
                
                return (
                  <button
                    key={day.date.toISOString()}
                    onClick={() => handleCalendarDayClick(day)}
                    disabled={!dayHasContent}
                    className={`p-1 sm:p-2 min-h-[80px] sm:min-h-[100px] border transition-colors duration-150 ease-in-out relative
                      ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                      ${dayHasContent ? 'cursor-pointer hover:bg-flexibel/10' : 'cursor-default'}
                      ${day.isChallengeWeek && !day.isToday ? 'bg-yellow-50' : ''}
                    `}
                  >
                    <time dateTime={day.date.toISOString()} className={`
                      font-semibold ${day.isToday ? 'bg-flexibel text-white rounded-full h-6 w-6 flex items-center justify-center' : ''}
                    `}>
                      {day.dayOfMonth}
                    </time>
                    <div className="grid grid-cols-2 gap-1 place-items-center p-0.5 mt-1 min-h-16">
                        {day.activities.slice(0, 4).map(log => (
                            <span key={log.id} className="text-lg sm:text-xl" title={getLogTitle(log)}>
                                {getLogIcon(log)}
                            </span>
                        ))}
                        {day.events.slice(0, 4 - day.activities.length).map((event, i) => (
                            <span key={`event-${i}`} className="text-lg sm:text-xl" title={event.description}>
                                {event.icon}
                            </span>
                        ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        
        {activeTab === 'klubbar' && participantProfile && (
            <ClubsView
                participantProfile={participantProfile}
                allActivityLogs={allActivityLogs}
                strengthStatsHistory={strengthStatsHistory}
                conditioningStatsHistory={conditioningStatsHistory}
                clubMemberships={clubMemberships}
                workouts={workouts}
                allParticipants={allParticipants}
                allClubMemberships={allClubMemberships}
            />
        )}

        {activeTab === 'leaderboards' && (
          <LeaderboardView 
            currentParticipantId={currentParticipantId}
            participants={allParticipants}
            allActivityLogs={allLogsForLeaderboards}
            userStrengthStats={allStrengthStatsForLeaderboards}
            clubMemberships={clubMemberships}
            leaderboardSettings={leaderboardSettings}
            isProspect={isProspect}
            locations={locations}
            participantProfile={participantProfile}
            workouts={workouts}
            conditioningStatsHistory={conditioningStatsHistory}
          />
        )}
      </div>

      <DayActivitiesModal 
        isOpen={isDayActivitiesModalOpen}
        onClose={() => setIsDayActivitiesModalOpen(false)}
        selectedDate={selectedDateForModal}
        activitiesForDay={activitiesForSelectedDay}
        workouts={workouts}
        onViewLogSummary={onViewLogSummary}
        onDeleteActivity={onDeleteActivity}
        strengthStatsHistory={strengthStatsHistory}
        conditioningStatsHistory={conditioningStatsHistory}
        physiqueHistory={physiqueHistory}
        clubMemberships={clubMemberships}
        participantProfile={participantProfile}
        allParticipantGoals={allParticipantGoals}
        coachEvents={coachEvents}
        oneOnOneSessions={oneOnOneSessions}
        staffMembers={staffMembers}
        groupClassSchedules={groupClassSchedules}
        groupClassDefinitions={groupClassDefinitions}
        allParticipantBookings={allParticipantBookings}
        locations={locations}
      />
    </div>
  );
};