
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
    type: 'PB' | 'GOAL_COMPLETED' | 'CLUB' | 'INBODY' | 'STRENGTH_TEST' | 'CONDITIONING_TEST' | 'NEW_GOAL' | 'COACH_EVENT' | 'ONE_ON_ONE' | 'GOAL_TARGET' | 'WORKOUT_LOGGED' | 'GENERAL_ACTIVITY';
    icon: string;
    description: string;
    node?: React.ReactNode;
    colorClass?: string; 
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
    
    // Add logs to events with colors
    if (dayLogs.some(log => log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs?.length > 0)) {
      dayEvents.push({ type: 'PB', icon: '⭐', description: '', colorClass: 'text-yellow-500' });
    }
    if (dayLogs.some(log => log.type === 'goal_completion')) {
      dayEvents.push({ type: 'GOAL_COMPLETED', icon: '🏆', description: '', colorClass: 'text-orange-500' });
    }
    if (dayLogs.some(log => log.type === 'workout')) {
       dayEvents.push({ type: 'WORKOUT_LOGGED', icon: '●', description: '', colorClass: 'text-flexibel' }); // Using dot for cleaner look
    }
    if (dayLogs.some(log => log.type === 'general')) {
       dayEvents.push({ type: 'GENERAL_ACTIVITY', icon: '●', description: '', colorClass: 'text-blue-400' });
    }
    
    // Coach events
    const eventsToday = coachEvents.filter(e => e.type === 'event' && e.eventDate && dateUtils.isSameDay(new Date(e.eventDate), day));
    eventsToday.forEach(() => dayEvents.push({ type: 'COACH_EVENT', icon: '📅', description: '', colorClass: 'text-purple-500' }));

    // One-on-one sessions
    const sessionsToday = oneOnOneSessions.filter(s => s.participantId === currentParticipantId && s.status === 'scheduled' && dateUtils.isSameDay(new Date(s.startTime), day));
    sessionsToday.forEach(() => dayEvents.push({ type: 'ONE_ON_ONE', icon: '🗣️', description: '', colorClass: 'text-indigo-500' }));
    
    // Goal target
    if (activeGoal?.targetDate && dateUtils.isSameDay(new Date(activeGoal.targetDate), day)) {
        dayEvents.push({ type: 'GOAL_TARGET', icon: '🎯', description: '', colorClass: 'text-red-500' });
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
        <div className="w-full flex flex-col gap-1 items-center">
            {/* Render Bookings as Pill Bars */}
            {visibleBookings.map(b => (
                <div 
                    key={b.id}
                    className="w-full text-[9px] truncate px-1.5 py-0.5 rounded-md leading-tight shadow-sm"
                    style={{ 
                        backgroundColor: b.isWaitlisted ? '#fffbeb' : b.color, 
                        color: b.isWaitlisted ? '#d97706' : '#fff',
                        border: b.isWaitlisted ? '1px solid #fcd34d' : 'none'
                    }}
                    title={`${b.time} - ${b.name}${b.isWaitlisted ? ' (Kö)' : ''}`}
                >
                    {b.time} {b.name}
                </div>
            ))}

            {/* Render Dots/Icons for other events */}
            {dayEvents.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center mt-0.5">
                    {dayEvents.slice(0, 5).map((e, i) => (
                        <span key={i} className={`text-[10px] ${e.colorClass || 'text-gray-500'}`}>{e.icon}</span>
                    ))}
                    {dayEvents.length > 5 && <span className="text-[8px] text-gray-400 self-center">•</span>}
                </div>
            )}
        </div>
    );
  }, [allActivityLogs, coachEvents, oneOnOneSessions, currentParticipantId, allParticipantBookings, activeGoal, groupClassSchedules, groupClassDefinitions, groupClassScheduleExceptions, getColorForCategory]);

  const getDayProps = useCallback((day: Date) => {
      // Check for any content to enable clicking
      const hasContent = renderDayContent(day).props.children.some((child: any) => child && (Array.isArray(child) ? child.length > 0 : true));
      return { hasContent };
  }, [renderDayContent]);

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full">
       
       {/* Unified Card Header with Tabs */}
       <div className="bg-white p-3 border-b border-gray-100">
          <div className="p-1 bg-gray-100 rounded-2xl flex justify-between items-center">
              <button 
                onClick={() => setActiveTab('calendar')} 
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'calendar' ? 'bg-white text-flexibel shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
              >
                Kalender
              </button>
              <button 
                onClick={() => setActiveTab('klubbar')} 
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'klubbar' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
              >
                Klubbar
              </button>
              {leaderboardSettings.leaderboardsEnabled && (
                <button 
                    onClick={() => setActiveTab('leaderboards')} 
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'leaderboards' ? 'bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}
                >
                    Topplistor
                </button>
              )}
           </div>
       </div>

       {/* Unified Content Area */}
       <div className="bg-white flex-grow min-h-[500px] animate-fade-in relative"> 
            {activeTab === 'calendar' && (
                <>
                    <CalendarGrid
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        onDayClick={handleCalendarDayClick}
                        renderDayContent={renderDayContent}
                        getDayProps={getDayProps}
                        getHolidayForDay={getHolidayForDay}
                        className="!shadow-none !border-none !rounded-none !bg-transparent"
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
                <div className="p-4 min-h-[500px]">
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
                <div className="p-4 min-h-[500px]">
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
