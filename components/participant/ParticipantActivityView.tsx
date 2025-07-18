import React, { useState, useMemo, useEffect } from 'react';
import { WorkoutLog, Workout, GeneralActivityLog, ActivityLog, GoalCompletionLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, LeaderboardSettings, CoachEvent } from '../../types';
import { Button } from '../Button';
import * as dateUtils from '../../utils/dateUtils';
import { DayActivitiesModal } from './DayActivitiesModal'; 
import { CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants';

interface ParticipantActivityViewProps {
  allActivityLogs: ActivityLog[]; 
  workouts: Workout[]; 
  onViewLogSummary: (log: ActivityLog) => void; 
  onDeleteActivity: (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => void;
  activeGoal?: ParticipantGoalData | null;
  strengthStatsHistory: UserStrengthStat[];
  conditioningStatsHistory: ParticipantConditioningStat[];
  clubMemberships: ParticipantClubMembership[];
  participantProfile: ParticipantProfile | null;
  leaderboardSettings: LeaderboardSettings;
  allParticipantGoals: ParticipantGoalData[];
  coachEvents: CoachEvent[];
}

type CalendarEventType = 'PB' | 'GOAL_COMPLETED' | 'CLUB' | 'INBODY' | 'STRENGTH_TEST' | 'CONDITIONING_TEST' | 'NEW_GOAL' | 'COACH_EVENT';

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
  hasGoalTarget?: boolean;
  isChallengeWeek?: boolean;
}

export const ParticipantActivityView: React.FC<ParticipantActivityViewProps> = ({ 
  allActivityLogs, 
  workouts, 
  onViewLogSummary, 
  onDeleteActivity, 
  activeGoal,
  strengthStatsHistory,
  conditioningStatsHistory,
  clubMemberships,
  participantProfile,
  leaderboardSettings,
  allParticipantGoals,
  coachEvents
}) => {
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

    for (let i = 0; i < 42; i++) { 
      const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), currentDay));
      const dayEvents: CalendarEvent[] = [];

      if (dayLogs.some(log => log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs?.length > 0)) {
        dayEvents.push({ type: 'PB', icon: '⭐', description: 'Personligt rekord uppnått!' });
      }
      if (dayLogs.some(log => log.type === 'goal_completion')) {
        dayEvents.push({ type: 'GOAL_COMPLETED', icon: '🏆', description: 'Mål uppnått!' });
      }
      const achievementsToday = clubMemberships.filter(c => dateUtils.isSameDay(new Date(c.achievedDate), currentDay));
      if (achievementsToday.length > 0) {
          const clubNames = achievementsToday.map(c => CLUB_DEFINITIONS.find(cd => cd.id === c.clubId)?.name || 'Okänd klubb').join(', ');
          dayEvents.push({ type: 'CLUB', icon: '🏅', description: `Nytt klubbmedlemskap: ${clubNames}` });
      }
      if (participantProfile?.lastUpdated && dateUtils.isSameDay(new Date(participantProfile.lastUpdated), currentDay) && (participantProfile.inbodyScore || participantProfile.muscleMassKg)) {
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
      const coachEventsToday = coachEvents.filter(e => dateUtils.isSameDay(new Date(e.date), currentDay));
      // Create a separate event for each coach event so they appear as individual icons if needed (though they all have the same icon now)
      coachEventsToday.forEach(event => {
        dayEvents.push({
            type: 'COACH_EVENT',
            icon: DEFAULT_COACH_EVENT_ICON,
            description: `Händelse: ${event.title} (${getStudioLabel(event.studioTarget)})`
        });
      });

      const isChallengeWeek = isChallengeActive && currentDay >= startOfThisWeek && currentDay <= endOfThisWeek;
      const isGoalTarget = goalTargetDates.some(goalDate => dateUtils.isSameDay(currentDay, goalDate));

      days.push({
        date: new Date(currentDay),
        dayOfMonth: currentDay.getDate(),
        isCurrentMonth: currentDay.getMonth() === referenceDate.getMonth(),
        isToday: dateUtils.isSameDay(currentDay, today),
        activities: dayLogs,
        events: dayEvents,
        hasGoalTarget: isGoalTarget,
        isChallengeWeek: isChallengeWeek,
      });
      currentDay = dateUtils.addDays(currentDay, 1);
      if (i >= 34 && currentDay.getMonth() !== referenceDate.getMonth() && currentDay.getDay() === 1) break; 
    }
    return days;
  }, [referenceDate, allActivityLogs, strengthStatsHistory, conditioningStatsHistory, clubMemberships, participantProfile, leaderboardSettings, allParticipantGoals, coachEvents]);

  const handleNavigate = (direction: 'prev' | 'next') => {
    setReferenceDate(prevDate => dateUtils.addMonths(prevDate, direction === 'prev' ? -1 : 1));
  };

  const handleCalendarDayClick = (calendarDay: CalendarDayItem) => {
    // Allow clicking on any day to see future events
    if (calendarDay.activities.length > 0 || calendarDay.events.length > 0 || calendarDay.hasGoalTarget) {
        setActivitiesForSelectedDay(calendarDay.activities);
        setSelectedDateForModal(calendarDay.date);
        setIsDayActivitiesModalOpen(true);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Loggbok</h2>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <Button onClick={() => handleNavigate('prev')} size="sm" variant="outline" aria-label="Föregående månad">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        </Button>
        <p className="text-center font-semibold text-flexibel text-lg">{currentMonthPeriod.label}</p>
        <Button onClick={() => handleNavigate('next')} size="sm" variant="outline" aria-label="Nästa månad">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
        </Button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold text-gray-500 border-b mb-1 pb-1">
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(dayName => <div key={dayName}>{dayName}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {calendarDays.map((day, index) => {
            const hasActivities = day.activities.length > 0;
            const hasEvents = day.events.length > 0;
            const isClickable = hasActivities || hasEvents || day.hasGoalTarget;

            let dayClasses = "p-1 sm:p-2 h-16 sm:h-20 flex flex-col items-center justify-start text-sm sm:text-base border transition-colors duration-150 ease-in-out relative ";
            if (!day.isCurrentMonth) {
              dayClasses += "text-gray-400 bg-gray-50";
            } else if (day.isChallengeWeek) {
                dayClasses += "bg-flexibel-orange/10";
            } else {
              dayClasses += "bg-white";
            }
            
            if (day.isToday) {
              dayClasses += " font-bold border-flexibel text-flexibel";
            } else {
              dayClasses += " text-gray-700";
            }
            
            if (isClickable) {
              dayClasses += " cursor-pointer hover:bg-gray-100";
            }

            if(hasActivities && day.isCurrentMonth) {
                dayClasses += " bg-teal-50 border-teal-200 hover:bg-teal-100";
            }


            const dayLabelParts = [
                `${day.dayOfMonth} ${dateUtils.getMonthName(day.date.getMonth())}`
            ];
            if (hasActivities) dayLabelParts.push(`${day.activities.length} aktivitet/er`);
            if (day.hasGoalTarget) dayLabelParts.push('Måldatum!');
            day.events.forEach(event => dayLabelParts.push(event.description));
            if (day.isChallengeWeek) dayLabelParts.push('Veckoutmaning aktiv.');
            const dayLabel = dayLabelParts.join('. ');

            return (
              <div
                key={index}
                className={dayClasses}
                onClick={() => handleCalendarDayClick(day)}
                role={isClickable ? "button" : "gridcell"}
                tabIndex={isClickable ? 0 : -1}
                aria-label={dayLabel}
              >
                <span className="z-10">{day.dayOfMonth}</span>
                <div className="flex flex-wrap justify-center items-center gap-x-1.5 gap-y-0.5 mt-1 text-sm z-10">
                  {day.hasGoalTarget && <span title="Måldatum">🎯</span>}
                  {[...new Map(day.events.map(item => [item['icon'], item])).values()].map((event, idx) => (
                    // Deduplicate icons for a cleaner look, tooltips will still show all info on modal
                      <span key={`${event.type}-${idx}`} title={event.description}>{event.icon}</span>
                  ))}
                </div>
                {hasActivities && !hasEvents && (
                  <span 
                    className="mt-1 w-1.5 h-1.5 rounded-full bg-flexibel z-10"
                    aria-hidden="true"
                    title={`${day.activities.length} aktivitet/er`}
                    ></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
        
       <div className="mt-4 pt-4 border-t text-sm text-gray-600 space-y-2">
        <h4 className="font-semibold text-base text-gray-700">Teckenförklaring</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span className="flex items-center"><div className="w-4 h-4 rounded-md bg-flexibel-orange/10 border border-flexibel-orange mr-2"></div> Veckoutmaning</span>
          <span><span className="font-mono mr-1">🎯</span> Måldatum</span>
          <span><span className="font-mono mr-1">⭐</span> Personligt Rekord</span>
          <span><span className="font-mono mr-1">🏆</span> Mål Uppnått</span>
          <span><span className="font-mono mr-1">📣</span> Händelse</span>
        </div>
      </div>

       <DayActivitiesModal
        isOpen={isDayActivitiesModalOpen}
        onClose={() => setIsDayActivitiesModalOpen(false)}
        selectedDate={selectedDateForModal}
        activitiesForDay={activitiesForSelectedDay}
        workouts={workouts}
        onViewLogSummary={onViewLogSummary as (log: ActivityLog) => void} 
        onDeleteActivity={onDeleteActivity}
        strengthStatsHistory={strengthStatsHistory}
        conditioningStatsHistory={conditioningStatsHistory}
        clubMemberships={clubMemberships}
        participantProfile={participantProfile}
        allParticipantGoals={allParticipantGoals}
        coachEvents={coachEvents}
      />
    </div>
  );
};
