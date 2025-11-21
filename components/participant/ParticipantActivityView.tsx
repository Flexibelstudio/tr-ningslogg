
import React, { useState, useMemo, useCallback } from 'react';
import { ActivityLog, Workout, WorkoutLog, GeneralActivityLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, CoachEvent, ParticipantPhysiqueStat, OneOnOneSession, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, Location, IntegrationSettings, GroupClassScheduleException, LeaderboardSettings } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { DayActivitiesModal } from './DayActivitiesModal'; 
import { CalendarGrid } from '../CalendarGrid';
import { LeaderboardView } from './LeaderboardView';
import { ClubsView } from './ClubsView';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON } from '../../constants';
import { useAppContext } from '../../context/AppContext';

interface EnrichedClassInstance {
    instanceId: string;
    date: string;
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
    myBookingStatus?: string;
    isRestricted: boolean;
    hasWaitlist: boolean;
    color: string;
    locationId: string;
}

interface CalendarEvent {
    type: 'PB' | 'GOAL_COMPLETED' | 'CLUB' | 'INBODY' | 'STRENGTH_TEST' | 'CONDITIONING_TEST' | 'NEW_GOAL' | 'COACH_EVENT' | 'ONE_ON_ONE' | 'GOAL_TARGET' | 'WORKOUT_LOGGED';
    icon: string;
    description: string;
    node?: React.ReactNode;
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
  groupClassScheduleExceptions: GroupClassScheduleException[];
  allParticipantBookings: ParticipantBooking[];
  locations: Location[];
  onCancelBooking: (bookingId: string) => void;
  integrationSettings: IntegrationSettings;
  loggedInCoachId?: string | null;
  onManageClassClick?: (instance: { scheduleId: string; date: string }) => void;
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
  groupClassScheduleExceptions,
  allParticipantBookings,
  locations,
  onCancelBooking,
  integrationSettings,
  loggedInCoachId,
  onManageClassClick,
}) => {
  const { getColorForCategory } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActivityViewTab>('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isDayActivitiesModalOpen, setIsDayActivitiesModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<Date | null>(null);
  const [activitiesForSelectedDay, setActivitiesForSelectedDay] = useState<ActivityLog[]>([]);

  // Helper for holidays
  const holidaysMap = useMemo(() => {
      const year = currentDate.getFullYear();
      const allHolidays = [
          ...dateUtils.getSwedishHolidays(year - 1),
          ...dateUtils.getSwedishHolidays(year),
          ...dateUtils.getSwedishHolidays(year + 1),
      ];
      const map = new Map<string, dateUtils.Holiday>();
      allHolidays.forEach(h => map.set(h.date.toDateString(), h));
      return map;
  }, [currentDate]);

  const getHolidayForDay = useCallback((date: Date): dateUtils.Holiday | null => {
      return holidaysMap.get(date.toDateString()) || null;
  }, [holidaysMap]);

  const handleCalendarDayClick = useCallback((day: Date) => {
    const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), day));
    setActivitiesForSelectedDay(dayLogs);
    setSelectedDateForModal(day);
    setIsDayActivitiesModalOpen(true);
  }, [allActivityLogs]);

  const renderDayContent = useCallback((day: Date) => {
    const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), day));
    const dayEvents: CalendarEvent[] = [];
    const dayStr = dateUtils.toYYYYMMDD(day);
    const now = new Date();
    
    // Add logs to events
    if (dayLogs.some(log => log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs?.length > 0)) {
      dayEvents.push({ type: 'PB', icon: '⭐', description: '' });
    }
    if (dayLogs.some(log => log.type === 'goal_completion')) {
      dayEvents.push({ type: 'GOAL_COMPLETED', icon: '🏆', description: '' });
    }
    if (dayLogs.some(log => log.type === 'workout')) {
       dayEvents.push({ type: 'WORKOUT_LOGGED', icon: '💪', description: '' });
    }
    
    // Coach events
    const eventsToday = coachEvents.filter(e => e.type === 'event' && e.eventDate && dateUtils.isSameDay(new Date(e.eventDate), day));
    eventsToday.forEach(() => dayEvents.push({ type: 'COACH_EVENT', icon: DEFAULT_COACH_EVENT_ICON, description: '' }));

    // One-on-one sessions
    const sessionsToday = oneOnOneSessions.filter(s => s.participantId === currentParticipantId && s.status === 'scheduled' && dateUtils.isSameDay(new Date(s.startTime), day));
    sessionsToday.forEach(() => dayEvents.push({ type: 'ONE_ON_ONE', icon: '🗣️', description: '' }));
    
    // Goal target
    if (activeGoal?.targetDate && dateUtils.isSameDay(new Date(activeGoal.targetDate), day)) {
        dayEvents.push({ type: 'GOAL_TARGET', icon: '🎯', description: '' });
    }

    // --- BOOKINGS (Rendered as bars) ---
    const bookingsToday = allParticipantBookings.filter(b => b.participantId === currentParticipantId && b.classDate === dayStr && b.status !== 'CANCELLED');
    
    const visibleBookings = bookingsToday.map(booking => {
        const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
        if (!schedule) return null;

        const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === schedule.id && ex.date === dayStr);
        if (exception && (exception.status === 'CANCELLED' || exception.status === 'DELETED')) return null;

        const startTime = exception?.newStartTime || schedule.startTime;
        const duration = exception?.newDurationMinutes || schedule.durationMinutes;
        
        const [h, m] = startTime.split(':').map(Number);
        const startDateTime = new Date(day);
        startDateTime.setHours(h, m, 0, 0);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        
        // Filter out past bookings
        if (endDateTime < now) return null;

        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
        if (!classDef) return null;

        return {
            id: booking.id,
            time: startTime,
            name: classDef.name,
            color: classDef.color || getColorForCategory(classDef.name),
            isWaitlisted: booking.status === 'WAITLISTED'
        };
    }).filter((b): b is NonNullable<typeof b> => b !== null).sort((a, b) => a.time.localeCompare(b.time));

    return (
        <div className="w-full flex flex-col gap-0.5">
            {/* Render Bookings as Bars */}
            {visibleBookings.map(b => (
                <div 
                    key={b.id}
                    className="text-[10px] truncate px-1 py-0.5 border-l-2 rounded-r leading-tight"
                    style={{ 
                        borderLeftColor: b.isWaitlisted ? '#d97706' : b.color, 
                        backgroundColor: b.isWaitlisted ? '#fffbeb' : (b.color + '20'), // 20% opacity
                        color: '#1f2937' 
                    }}
                    title={`${b.time} - ${b.name}${b.isWaitlisted ? ' (Kö)' : ''}`}
                >
                    <span className="font-bold">{b.time}</span> {b.name}
                </div>
            ))}

            {/* Render Icons for other events */}
            <div className="flex flex-wrap gap-0.5 justify-center">
                {dayEvents.slice(0, 4).map((e, i) => (
                    <span key={i} className="text-xs">{e.icon}</span>
                ))}
                {dayEvents.length > 4 && <span className="text-[10px] leading-none text-gray-500 self-center">...</span>}
            </div>
        </div>
    );
  }, [allActivityLogs, coachEvents, oneOnOneSessions, currentParticipantId, allParticipantBookings, activeGoal, groupClassSchedules, groupClassDefinitions, groupClassScheduleExceptions, getColorForCategory]);

  const getDayProps = useCallback((day: Date) => {
      const dayStr = dateUtils.toYYYYMMDD(day);
      // Check for any content to enable clicking
      const hasContent = renderDayContent(day).props.children.some((child: any) => child && child.length !== 0);
      // Or simpler: check if logs or bookings exist for this day manually if renderDayContent is expensive
      return { hasContent };
  }, [renderDayContent]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
       {/* Unified Header with Tabs */}
       <div className="p-3 border-b border-gray-100 bg-white flex justify-center gap-2 flex-wrap">
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-green-50 text-flexibel ring-1 ring-flexibel/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            🗓️ Kalender
          </button>
          <button 
            onClick={() => setActiveTab('klubbar')} 
            className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'klubbar' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            🥇 Klubbar
          </button>
          {leaderboardSettings.leaderboardsEnabled && (
            <button 
                onClick={() => setActiveTab('leaderboards')} 
                className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === 'leaderboards' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                🏆 Topplistor
            </button>
          )}
       </div>

       {/* Content Area */}
       <div className="p-0"> 
            {activeTab === 'calendar' && (
                <>
                    <CalendarGrid
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        onDayClick={handleCalendarDayClick}
                        renderDayContent={renderDayContent}
                        getDayProps={getDayProps}
                        getHolidayForDay={getHolidayForDay}
                        className="!shadow-none !rounded-none !border-none" // Remove cards own shadow to blend in
                    />
                    {isDayActivitiesModalOpen && (
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
                            groupClassScheduleExceptions={groupClassScheduleExceptions}
                        />
                    )}
                </>
            )}

            {activeTab === 'klubbar' && participantProfile && (
                <div className="p-4 bg-gray-50 min-h-[400px]">
                    <ClubsView
                        participantProfile={participantProfile}
                        allActivityLogs={allActivityLogs}
                        strengthStatsHistory={strengthStatsHistory}
                        conditioningStatsHistory={conditioningStatsHistory}
                        clubMemberships={clubMemberships}
                        allClubMemberships={allClubMemberships}
                        workouts={workouts}
                        allParticipants={allParticipants}
                    />
                </div>
            )}

            {activeTab === 'leaderboards' && participantProfile && (
                <div className="p-4 bg-gray-50 min-h-[400px]">
                    <LeaderboardView
                        currentParticipantId={currentParticipantId}
                        participants={allParticipants}
                        allActivityLogs={allLogsForLeaderboards}
                        userStrengthStats={allStrengthStatsForLeaderboards}
                        clubMemberships={allClubMemberships}
                        leaderboardSettings={leaderboardSettings}
                        isProspect={participantProfile.isProspect}
                        locations={locations}
                        participantProfile={participantProfile}
                        workouts={workouts}
                        conditioningStatsHistory={conditioningStatsHistory}
                    />
                </div>
            )}
       </div>
    </div>
  );
};
