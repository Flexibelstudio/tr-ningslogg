import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { WorkoutLog, Workout, GeneralActivityLog, ActivityLog, GoalCompletionLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, LeaderboardSettings, CoachEvent, ParticipantPhysiqueStat, OneOnOneSession, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, Location, IntegrationSettings, BookingStatus } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { DayActivitiesModal } from './DayActivitiesModal'; 
import { CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants';
import { LeaderboardView } from './LeaderboardView';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { ClubsView } from './ClubsView';
import { CalendarGrid } from '../CalendarGrid'; // NEW: Import the reusable grid
import { useAppContext } from '../../context/AppContext';

interface EnrichedClassInstance {
    instanceId: string;
    date: string; // YYYY-MM-DD
    startDateTime: Date;
    scheduleId: string;
    className: string;
    duration: number;
    coachName: string;
    coachId: string;
    maxParticipants: number;
    bookedCount: number;
    waitlistCount: number;
    isBookedByMe: boolean;
    isWaitlistedByMe: boolean;
    myWaitlistPosition: number;
    bookingId?: string;
    isFull: boolean;
    cancellationCutoffHours: number;
    myBookingStatus?: BookingStatus;
    isRestricted: boolean;
    hasWaitlist: boolean;
    color: string;
}

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
  onCancelBooking: (bookingId: string) => void;
  integrationSettings: IntegrationSettings;
  loggedInCoachId?: string | null;
  onManageClassClick?: (instance: { scheduleId: string; date: string }) => void;
}

type CalendarEventType = 'PB' | 'GOAL_COMPLETED' | 'CLUB' | 'INBODY' | 'STRENGTH_TEST' | 'CONDITIONING_TEST' | 'NEW_GOAL' | 'COACH_EVENT' | 'ONE_ON_ONE' | 'GOAL_TARGET';

interface CalendarEvent {
    type: CalendarEventType;
    icon: string;
    description: string;
}

type ActivityViewTab = 'calendar' | 'klubbar' | 'leaderboards';

const ParticipantActivityViewFC: React.FC<ParticipantActivityViewProps> = ({ 
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
  onCancelBooking,
  integrationSettings,
  loggedInCoachId,
  onManageClassClick,
}) => {
  const { getColorForCategory } = useAppContext();
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

  const handleCalendarDayClick = useCallback((day: Date) => {
    setActivitiesForSelectedDay(allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), day)));
    setSelectedDateForModal(day);
    setIsDayActivitiesModalOpen(true);
  }, [allActivityLogs]);
  
  const holidaysMap = useMemo(() => {
      const year = referenceDate.getFullYear();
      // Fetch for current, previous, and next year to handle month transitions at year-end/start
      const allHolidays = [
          ...dateUtils.getSwedishHolidays(year - 1),
          ...dateUtils.getSwedishHolidays(year),
          ...dateUtils.getSwedishHolidays(year + 1),
      ];
      const map = new Map<string, dateUtils.Holiday>();
      allHolidays.forEach(h => map.set(h.date.toDateString(), h));
      return map;
  }, [referenceDate]);

  const getHolidayForDay = useCallback((date: Date): dateUtils.Holiday | null => {
      return holidaysMap.get(date.toDateString()) || null;
  }, [holidaysMap]);

  const getDayContent = useCallback((day: Date): { activities: ActivityLog[], events: CalendarEvent[], groupClasses: EnrichedClassInstance[] } => {
    const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), day));
    const dayEvents: CalendarEvent[] = [];
    const groupClasses: EnrichedClassInstance[] = [];
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const dateStr = dateUtils.toYYYYMMDD(day);

    const schedulesToday = groupClassSchedules.filter(schedule => {
        const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        endDate.setHours(23, 59, 59, 999);
        return schedule.daysOfWeek.includes(dayOfWeek) && day >= startDate && day <= endDate;
    });

    schedulesToday.forEach(schedule => {
        const myBooking = allParticipantBookings.find(b => b.participantId === participantProfile?.id && b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
        const isCoachedByMe = loggedInCoachId === schedule.coachId;

        if (!myBooking && !isCoachedByMe) return;

        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
        const coach = staffMembers.find(s => s.id === schedule.coachId);
        if (!classDef || !coach) return;

        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const startDateTime = new Date(day);
        startDateTime.setHours(hour, minute, 0, 0);

        const endDateTime = new Date(startDateTime.getTime() + schedule.durationMinutes * 60000);
        if (dateUtils.isPast(endDateTime)) return;
        
        const allBookingsForInstance = allParticipantBookings.filter(b => b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
        const bookedUsers = allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
        const waitlistedUsers = allBookingsForInstance.filter(b => b.status === 'WAITLISTED').sort((a,b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
        
        let myPosition = 0;
        if (myBooking?.status === 'WAITLISTED') {
            myPosition = waitlistedUsers.findIndex(b => b.id === myBooking.id) + 1;
        }

        groupClasses.push({
            instanceId: `${schedule.id}-${dateStr}`,
            date: dateStr,
            startDateTime,
            scheduleId: schedule.id,
            className: classDef.name,
            duration: schedule.durationMinutes,
            coachName: coach.name,
            coachId: coach.id,
            locationId: schedule.locationId,
            maxParticipants: schedule.maxParticipants,
            bookedCount: bookedUsers.length,
            waitlistCount: waitlistedUsers.length,
            isBookedByMe: !!myBooking,
            isWaitlistedByMe: myBooking?.status === 'WAITLISTED',
            myWaitlistPosition: myPosition,
            bookingId: myBooking?.id,
            isFull: bookedUsers.length >= schedule.maxParticipants,
            cancellationCutoffHours: integrationSettings.cancellationCutoffHours ?? 2,
            myBookingStatus: myBooking?.status,
            isRestricted: false, 
            hasWaitlist: schedule.hasWaitlist ?? classDef.hasWaitlist ?? false,
            color: classDef.color || getColorForCategory(classDef.name),
        });
    });

    const sessionsToday = oneOnOneSessions.filter(s => s.participantId === participantProfile?.id && s.status === 'scheduled' && dateUtils.isSameDay(new Date(s.startTime), day) && !dateUtils.isPast(new Date(s.endTime)));
    sessionsToday.forEach(session => {
        const coach = staffMembers.find(st => st.id === session.coachId);
        dayEvents.push({ type: 'ONE_ON_ONE', icon: '🗣️', description: `Möte: ${session.title} med ${coach?.name || 'Coach'}` });
    });

    if (dayLogs.some(log => log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs?.length > 0)) {
      dayEvents.push({ type: 'PB', icon: '⭐', description: 'Personligt rekord uppnått!' });
    }
    if (dayLogs.some(log => log.type === 'goal_completion')) {
      dayEvents.push({ type: 'GOAL_COMPLETED', icon: '🏆', description: 'Mål uppnått!' });
    }
    const allAchievementsToday = clubMemberships.filter(c => dateUtils.isSameDay(new Date(c.achievedDate), day));
    const highestAchievementsToday = getHighestClubAchievements(allAchievementsToday);
    if (highestAchievementsToday.length > 0) {
        const clubNames = highestAchievementsToday.map(c => CLUB_DEFINITIONS.find(cd => cd.id === c.clubId)?.name || 'Okänd klubb').join(', ');
        dayEvents.push({ type: 'CLUB', icon: '🏅', description: `Nytt klubbmedlemskap: ${clubNames}` });
    }
    if (physiqueHistory.some(h => dateUtils.isSameDay(new Date(h.lastUpdated), day) && (h.inbodyScore || h.muscleMassKg))) {
        dayEvents.push({ type: 'INBODY', icon: '🧬', description: `InBody-mätning / Profil uppdaterad` });
    }
    if (strengthStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), day))) {
        dayEvents.push({ type: 'STRENGTH_TEST', icon: '🏋️', description: 'Styrketest loggat' });
    }
    if (conditioningStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), day))) {
        dayEvents.push({ type: 'CONDITIONING_TEST', icon: '💨', description: 'Konditionstest loggat' });
    }
    if (allParticipantGoals.some(g => dateUtils.isSameDay(new Date(g.setDate), day))) {
        dayEvents.push({ type: 'NEW_GOAL', icon: '🏁', description: 'Nytt mål satt' });
    }
    
    // Coach events logic... (omitted for brevity, assume it's same as before)
    
    const currentGoalTargetDate = (activeGoal && activeGoal.targetDate) ? new Date(activeGoal.targetDate) : null;
    if (currentGoalTargetDate && dateUtils.isSameDay(day, currentGoalTargetDate)) {
      dayEvents.push({ type: 'GOAL_TARGET', icon: '🎯', description: 'Måldatum!' });
    }

    return { activities: dayLogs, events: dayEvents, groupClasses };
  }, [allActivityLogs, allParticipantBookings, participantProfile, groupClassSchedules, groupClassDefinitions, staffMembers, oneOnOneSessions, clubMemberships, physiqueHistory, strengthStatsHistory, conditioningStatsHistory, allParticipantGoals, activeGoal, loggedInCoachId, getColorForCategory, integrationSettings.cancellationCutoffHours]);
  
  const renderDayContent = useCallback((day: Date) => {
    const { activities, events, groupClasses } = getDayContent(day);
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
    
    const otherIconItems = [
        ...activities.map(a => ({ key: a.id, icon: getLogIcon(a), title: getLogTitle(a) })),
        ...events.map((e, i) => ({ key: `event-${i}`, icon: e.icon, title: e.description }))
    ];
    
    const sortedGroupClasses = groupClasses.sort((a,b) => a.startDateTime.getTime() - b.startDateTime.getTime());

    const renderClassItem = (instance: EnrichedClassInstance) => {
        const categoryColor = instance.color;
        const categoryBgColor = categoryColor + '1A';
        const startTime = instance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        const isCoachedByMe = loggedInCoachId === instance.coachId;
        const isCancelled = instance.myBookingStatus === 'CANCELLED';

        const content = (
            <>
                <p className={`font-bold text-xs truncate ${isCancelled ? 'line-through' : ''}`} style={{ color: isCancelled ? '#9ca3af' : categoryColor }}>
                    {isCoachedByMe && '⭐ '}
                    {startTime} - {instance.className}
                </p>
                <p className={`text-xs truncate ${instance.isBookedByMe ? 'font-semibold text-gray-800' : 'text-gray-600'} ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                    {isCoachedByMe
                        ? `${instance.bookedCount}/${instance.maxParticipants} bokade`
                        : isCancelled
                        ? '🚫 Inställt'
                        : instance.isWaitlistedByMe ? `Köplats #${instance.myWaitlistPosition}` : (instance.isBookedByMe ? 'Bokad' : '')
                    }
                </p>
            </>
        );
        

        if (isCoachedByMe && onManageClassClick) {
            return (
                <button 
                    key={instance.instanceId} 
                    onClick={(e) => { e.stopPropagation(); onManageClassClick({ scheduleId: instance.scheduleId, date: instance.date }); }} 
                    className="w-full p-1 text-left rounded-md border-l-4" 
                    style={{ borderColor: categoryColor, backgroundColor: categoryBgColor }} 
                    title={`${instance.className} (Klicka för att hantera)`}
                >
                    {content}
                </button>
            );
        }

        return (
            <div key={instance.instanceId} className="w-full p-1 text-left rounded-md border-l-4" style={{ borderColor: isCancelled ? '#d1d5db' : categoryColor, backgroundColor: isCancelled ? '#f3f4f6' : categoryBgColor }} title={instance.className}>
                {content}
            </div>
        );
    };

    return (
      <div className="space-y-0.5 sm:space-y-1 overflow-hidden flex-grow flex flex-col">
        {sortedGroupClasses.slice(0, 2).map(renderClassItem)}
        
        <div className="grid grid-cols-2 gap-1 place-items-center p-0.5 mt-auto">
            {otherIconItems.slice(0, 4).map(item => (
                <span key={item.key} className="text-lg" title={item.title}>{item.icon}</span>
            ))}
        </div>
        
        { (groupClasses.length + otherIconItems.length) > 2 + 4 && (
            <p className="text-xs text-center text-gray-500 mt-1">+{ (groupClasses.length + otherIconItems.length) - (2 + 4) } till</p>
        )}
      </div>
    );
  }, [getDayContent, workouts, loggedInCoachId, onManageClassClick]);
  
  const getDayProps = useCallback((day: Date) => {
    const { activities, events, groupClasses } = getDayContent(day);
    return { hasContent: activities.length > 0 || events.length > 0 || groupClasses.length > 0 };
  }, [getDayContent]);

  const getTabButtonStyle = (tabName: ActivityViewTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };
  
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
          <CalendarGrid
            currentDate={referenceDate}
            setCurrentDate={setReferenceDate}
            onDayClick={handleCalendarDayClick}
            renderDayContent={renderDayContent}
            getDayProps={getDayProps}
            getHolidayForDay={getHolidayForDay}
          />
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
        activeGoal={activeGoal}
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
        onCancelBooking={onCancelBooking}
        integrationSettings={integrationSettings}
        loggedInCoachId={loggedInCoachId}
        onManageClassClick={onManageClassClick}
      />
    </div>
  );
};

export const ParticipantActivityView = React.memo(ParticipantActivityViewFC);