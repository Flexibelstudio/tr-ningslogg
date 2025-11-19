
import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  WorkoutLog,
  ParticipantProfile,
  ParticipantGoalData,
  GeneralActivityLog,
  GoalCompletionLog,
  CoachNote,
  UserStrengthStat,
  ParticipantClubMembership,
  LeaderboardSettings,
  CoachEvent,
  Location,
  StaffMember,
  Membership,
  WeeklyHighlightSettings,
  OneOnOneSession,
  WorkoutCategoryDefinition,
  StaffAvailability,
  IntegrationSettings,
  GroupClassDefinition,
  GroupClassSchedule,
  ParticipantBooking,
  User,
  ParticipantConditioningStat,
  GroupClassScheduleException,
} from '../../types';
import { MemberManagement } from './MemberManagement';
import { ParticipantActivityOverview } from './ParticipantActivityOverview';
import { WorkoutManagement } from './WorkoutManagement';
import { LeaderboardManagement } from './LeaderboardManagement';
import { EventManagement } from './EventManagement';
import { SettingsManagement } from './SettingsManagement';
import { StaffManagement } from './StaffManagement';
import { BookOneOnOneModal } from '../../features/booking/components/BookOneOnOneModal';
import { AIBusinessInsights } from './AIBusinessInsights';
import { ClientJourneyView } from './ClientJourneyView';
import { MeetingDetailsModal } from '../../features/booking/components/MeetingDetailsModal';
import { EngagementOpportunities } from './EngagementOpportunities';
import { ConfirmationModal } from '../ConfirmationModal';
import { CalendarView } from '../../features/booking/components/CalendarView';
import { ClassManagementModal } from '../../features/booking/components/ClassManagementModal';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import { CreateScheduleModal } from '../../features/booking/components/CreateScheduleModal';
import { ToggleSwitch } from '../ToggleSwitch';
import { Select } from '../Input';

const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
    </div>
);

type CoachTab = 'overview' | 'klientresan' | 'programs' | 'bookings' | 'analytics' | 'insights' | 'leaderboards' | 'events' | 'personal' | 'settings';

interface EnrichedClassInstance {
  instanceId: string;
  date: string;
  startDateTime: Date;
  scheduleId: string;
  className: string;
  coachId: string;
  locationId: string;
  duration: number;
  coachName: string;
  maxParticipants: number;
  bookedCount: number;
  waitlistCount: number;
  isFull: boolean;
  allBookingsForInstance: ParticipantBooking[];
  color: string;
}

interface CoachAreaProps {
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  onCheckInParticipant: (bookingId: string) => void;
  onUnCheckInParticipant: (bookingId: string) => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onPromoteFromWaitlist: (bookingId: string) => void;
  onCancelClassInstance: (scheduleId: string, classDate: string, status: 'CANCELLED' | 'DELETED') => void;
  onUpdateClassInstance: (scheduleId: string, classDate: string, updates: any, notify: boolean) => void;
}

export const CoachArea: React.FC<CoachAreaProps> = ({
  onAddComment,
  onDeleteComment,
  onToggleCommentReaction,
  onCheckInParticipant,
  onUnCheckInParticipant,
  onBookClass,
  onCancelBooking,
  onPromoteFromWaitlist,
  onCancelClassInstance,
  onUpdateClassInstance,
}) => {
  const {
    participantDirectory,
    staffMembers,
    // ... all other app data from context
    workouts,
    workoutLogs,
    participantGoals,
    generalActivityLogs,
    goalCompletionLogs,
    userStrengthStats,
    userConditioningStatsHistory,
    clubMemberships,
    leaderboardSettings,
    coachEvents,
    locations,
    memberships,
    coachNotes,
    weeklyHighlightSettings,
    oneOnOneSessions,
    staffAvailability,
    integrationSettings,
    groupClassDefinitions,
    groupClassSchedules,
    groupClassScheduleExceptions,
    participantBookings,
    // ... all updater functions
    setOneOnOneSessionsData,
    setGroupClassSchedulesData,
    setClubMembershipsData,
    setLeaderboardSettingsData,
    setCoachEventsData,
    setWeeklyHighlightSettingsData,
    setStaffMembersData,
    setStaffAvailabilityData,
    orgDataError,
    getColorForCategory,
  } = useAppContext();

  const { user, isImpersonating } = useAuth();
  const { isOnline } = useNetworkStatus();

  const loggedInStaff = useMemo(() => {
    if (!user) return null;
    const actualStaffProfile = staffMembers.find((s) => s.email === user.email);

    // If the user is a system owner AND is currently impersonating an organization,
    // they should have full Admin rights for UI purposes.
    if (user.roles.systemOwner && isImpersonating) {
      // If we found their actual staff profile (e.g., they are also a coach),
      // we use it but ensure the role is elevated to 'Admin' for this session.
      if (actualStaffProfile) {
        return { ...actualStaffProfile, role: 'Admin' as const };
      }
      // If they are not a staff member in this org, create a temporary, in-memory
      // Admin profile. This allows the UI to render correctly (e.g., show all tabs),
      // even if data lists might be empty due to underlying data permissions.
      return {
        id: 'system-owner-impersonating',
        name: user.name,
        email: user.email,
        role: 'Admin' as const,
        locationId: locations[0]?.id || 'all',
        isActive: true,
      };
    }

    return actualStaffProfile || null;
  }, [user, staffMembers, isImpersonating, locations]);

  const allTabs: { id: CoachTab; label: string }[] = [
    { id: 'overview', label: 'Medlemmar' },
    { id: 'klientresan', label: 'Klientresan' },
    { id: 'bookings', label: 'Bokningar' },
    { id: 'programs', label: 'Program & Pass' },
    { id: 'events', label: 'Händelser' },
    { id: 'leaderboards', label: 'Topplistor' },
    { id: 'insights', label: 'Insikter' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'personal', label: 'Personal & Schema' },
    { id: 'settings', label: 'Inställningar' },
  ];

  const visibleTabs = useMemo(() => {
    if (loggedInStaff?.role === 'Admin') {
      return allTabs; // Admins and impersonating System Owners see all tabs
    }
    // For a regular coach, show a limited set
    return allTabs.filter((tab) => ['overview', 'klientresan', 'bookings', 'programs'].includes(tab.id));
  }, [loggedInStaff]);

  const tabsToShow = useMemo(
    () =>
      visibleTabs.filter((tab) => {
        if ((tab.id === 'bookings' || tab.id === 'analytics') && !integrationSettings.isBookingEnabled) {
          return false;
        }
        if (tab.id === 'klientresan' && !(integrationSettings.isClientJourneyEnabled ?? true)) {
          return false;
        }
        return true;
      }),
    [visibleTabs, integrationSettings]
  );

  const [activeTab, setActiveTab] = useState<CoachTab>(tabsToShow[0]?.id || 'overview');
  const [selectedLocationTabId, setSelectedLocationTabId] = useState<string>('all');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<OneOnOneSession | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<OneOnOneSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<OneOnOneSession | null>(null);
  const [initialDateForBooking, setInitialDateForBooking] = useState<string | null>(null);
  const [managedClassInfo, setManagedClassInfo] = useState<{ scheduleId: string; date: string } | null>(null);
  const [isCreateScheduleModalOpen, setIsCreateScheduleModalOpen] = useState(false);
  const [calendarFilters, setCalendarFilters] = useState({
    showMySessionsOnly: false,
    showGroupClasses: true,
    showOneOnOneSessions: true,
  });
  const [selectedCoachFilter, setSelectedCoachFilter] = useState<string>('all');


  // Filter all data based on logged-in staff's role and location
  const participantsForView = useMemo(() => {
    // Admins (including impersonating System Owners) see all participants.
    if (loggedInStaff?.role === 'Admin') {
      return participantDirectory;
    }

    // Coaches see participants in their location.
    if (loggedInStaff?.role === 'Coach') {
      return participantDirectory.filter((p) => p.locationId === loggedInStaff.locationId);
    }

    // Fallback for any other case
    return [];
  }, [participantDirectory, loggedInStaff]);

  const visibleParticipantIds = useMemo(() => new Set(participantsForView.map((p) => p.id)), [participantsForView]);

  const workoutLogsForView = useMemo(() => workoutLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [workoutLogs, visibleParticipantIds]);
  const generalActivityLogsForView = useMemo(() => generalActivityLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [
    generalActivityLogs,
    visibleParticipantIds,
  ]);
  const goalCompletionLogsForView = useMemo(() => goalCompletionLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [
    goalCompletionLogs,
    visibleParticipantIds,
  ]);
  const participantGoalsForView = useMemo(() => participantGoals.filter((goal) => visibleParticipantIds.has(goal.participantId)), [
    participantGoals,
    visibleParticipantIds,
  ]);
  const userStrengthStatsForView = useMemo(() => userStrengthStats.filter((stat) => visibleParticipantIds.has(stat.participantId)), [
    userStrengthStats,
    visibleParticipantIds,
  ]);
  const userConditioningStatsForView = useMemo(() => userConditioningStatsHistory.filter((stat) => visibleParticipantIds.has(stat.participantId)), [
    userConditioningStatsHistory,
    visibleParticipantIds,
  ]);
  const clubMembershipsForView = useMemo(() => clubMemberships.filter((membership) => visibleParticipantIds.has(membership.participantId)), [
    clubMemberships,
    visibleParticipantIds,
  ]);

  const oneOnOneSessionsForView = useMemo(() => {
    if (!loggedInStaff) return [];

    // Admins (including impersonating System Owners) see all sessions.
    if (loggedInStaff.role === 'Admin') {
      return oneOnOneSessions;
    }

    // Coaches see sessions linked to them or to members at their location.
    if (loggedInStaff.role === 'Coach') {
      const coachSessionIds = new Set(oneOnOneSessions.filter((s) => s.coachId === loggedInStaff.id).map((s) => s.id));
      const memberSessionIds = new Set(oneOnOneSessions.filter((s) => visibleParticipantIds.has(s.participantId)).map((s) => s.id));
      const allVisibleSessionIds = new Set([...coachSessionIds, ...memberSessionIds]);
      return oneOnOneSessions.filter((s) => allVisibleSessionIds.has(s.id));
    }

    return [];
  }, [oneOnOneSessions, loggedInStaff, visibleParticipantIds]);

  const coachNotesForView = useMemo(() => coachNotes.filter((note) => visibleParticipantIds.has(note.participantId)), [coachNotes, visibleParticipantIds]);

  const allActivityLogsForView = useMemo(
    () => [...workoutLogsForView, ...generalActivityLogsForView, ...goalCompletionLogsForView],
    [workoutLogsForView, generalActivityLogsForView, goalCompletionLogsForView]
  );

  const classInstanceForManagement = useMemo(() => {
    if (!managedClassInfo) return null;

    const { scheduleId, date } = managedClassInfo;
    const schedule = groupClassSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;
  
    const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === scheduleId && ex.date === date);
  
    if (exception && (exception.status === 'DELETED' || !exception.status)) {
        return null;
    }

    const overriddenSchedule = {
      ...schedule,
      startTime: exception?.newStartTime || schedule.startTime,
      durationMinutes: exception?.newDurationMinutes || schedule.durationMinutes,
      coachId: exception?.newCoachId || schedule.coachId,
      maxParticipants: exception?.newMaxParticipants || schedule.maxParticipants,
    };

    const classDef = groupClassDefinitions.find((d) => d.id === overriddenSchedule.groupClassId);
    const coach = staffMembers.find((c) => c.id === overriddenSchedule.coachId);
    if (!classDef || !coach) return null;

    const [year, month, day] = date.split('-').map(Number);
    const classDate = new Date(year, month - 1, day);

    const [hour, minute] = overriddenSchedule.startTime.split(':').map(Number);
    const startDateTime = new Date(classDate);
    startDateTime.setHours(hour, minute, 0, 0);

    const allBookingsForInstance = participantBookings.filter((b) => b.scheduleId === schedule.id && b.classDate === date && b.status !== 'CANCELLED');
    const bookedUsers = allBookingsForInstance.filter((b) => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
    const waitlistedUsers = allBookingsForInstance.filter((b) => b.status === 'WAITLISTED');

    return {
      instanceId: `${schedule.id}-${date}`,
      date,
      startDateTime,
      scheduleId,
      className: classDef.name,
      duration: overriddenSchedule.durationMinutes,
      coachName: coach.name,
      coachId: coach.id,
      locationId: overriddenSchedule.locationId,
      maxParticipants: overriddenSchedule.maxParticipants,
      bookedCount: bookedUsers.length,
      waitlistCount: waitlistedUsers.length,
      isFull: bookedUsers.length >= overriddenSchedule.maxParticipants,
      allBookingsForInstance,
      color: classDef.color || getColorForCategory(classDef.name),
    };
  }, [managedClassInfo, groupClassSchedules, groupClassDefinitions, staffMembers, participantBookings, getColorForCategory, groupClassScheduleExceptions]);

  // NEW: Memos for location filtering in the Bookings tab
  const schedulesForLocationTab = useMemo(() => {
    if (selectedLocationTabId === 'all' || !locations.some((l) => l.id === selectedLocationTabId)) return groupClassSchedules;
    return groupClassSchedules.filter((s) => s.locationId === selectedLocationTabId);
  }, [groupClassSchedules, selectedLocationTabId, locations]);

  const scheduleIdsInLocation = useMemo(() => {
    return new Set(schedulesForLocationTab.map((s) => s.id));
  }, [schedulesForLocationTab]);

  const bookingsForLocationTab = useMemo(() => {
    return participantBookings.filter((b) => scheduleIdsInLocation.has(b.scheduleId));
  }, [participantBookings, scheduleIdsInLocation]);

  const sessionsForLocationTab = useMemo(() => {
    if (selectedLocationTabId === 'all' || !locations.some((l) => l.id === selectedLocationTabId)) return oneOnOneSessionsForView;
    const staffIdsInLocation = new Set(staffMembers.filter((s) => s.locationId === selectedLocationTabId).map((s) => s.id));
    return oneOnOneSessionsForView.filter((session) => staffIdsInLocation.has(session.coachId));
  }, [oneOnOneSessionsForView, staffMembers, selectedLocationTabId, locations]);

  const coachFilterOptions = useMemo(() => {
    if (!loggedInStaff || loggedInStaff.role !== 'Admin') return [];
    
    const myPassOption = { value: loggedInStaff.id, label: 'Mina pass' };
    
    const coachOptions = staffMembers
        .filter(s => s.isActive)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => ({ value: s.id, label: s.name }));

    // Ensure "Mina pass" isn't duplicated if the admin is in the coach list
    const uniqueCoachOptions = coachOptions.filter(c => c.value !== loggedInStaff.id);

    return [
        { value: 'all', label: 'Alla coacher' },
        myPassOption,
        ...uniqueCoachOptions
    ];
  }, [loggedInStaff, staffMembers]);

  const filteredSchedules = useMemo(() => {
    let schedules = schedulesForLocationTab;
    if (!calendarFilters.showGroupClasses) {
        return [];
    }
    if (loggedInStaff?.role === 'Admin') {
        if (selectedCoachFilter !== 'all') {
            schedules = schedules.filter(schedule => schedule.coachId === selectedCoachFilter);
        }
    } else if (loggedInStaff?.role === 'Coach') {
        if (calendarFilters.showMySessionsOnly) {
            schedules = schedules.filter(schedule => schedule.coachId === loggedInStaff.id);
        }
    }
    
    return schedules;
  }, [schedulesForLocationTab, calendarFilters, loggedInStaff, selectedCoachFilter]);

  const filteredSessions = useMemo(() => {
      let sessions = sessionsForLocationTab;
      if (!calendarFilters.showOneOnOneSessions) {
          return [];
      }
      if (loggedInStaff?.role === 'Admin') {
          if (selectedCoachFilter !== 'all') {
              sessions = sessions.filter(session => session.coachId === selectedCoachFilter);
          }
      } else if (loggedInStaff?.role === 'Coach') {
          if (calendarFilters.showMySessionsOnly) {
              sessions = sessions.filter(session => session.coachId === loggedInStaff.id);
          }
      }
      return sessions;
  }, [sessionsForLocationTab, calendarFilters, loggedInStaff, selectedCoachFilter]);

  const getTabButtonStyle = (tabName: CoachTab) => {
    return activeTab === tabName ? 'border-flexibel text-flexibel' : 'border-transparent text-gray-500 active:text-gray-700 active:border-gray-300';
  };

  const handleSaveOrUpdateSession = (session: OneOnOneSession) => {
    setOneOnOneSessionsData((prev) => {
      const index = prev.findIndex((s) => s.id === session.id);
      if (index > -1) {
        const newSessions = [...prev];
        newSessions[index] = session;
        return newSessions;
      } else {
        return [...prev, session];
      }
    });
    setSessionToEdit(null);
  };
  
  const handleSaveSchedule = (schedule: GroupClassSchedule) => {
    setGroupClassSchedulesData(prev => {
        const exists = prev.some(s => s.id === schedule.id);
        if (exists) {
            return prev.map(s => s.id === schedule.id ? schedule : s);
        }
        return [...prev, schedule];
    });
};

  const handleOpenMeetingModal = useCallback((session: OneOnOneSession) => {
    setSelectedSessionForModal(session);
    setIsMeetingModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((session: OneOnOneSession) => {
    setSessionToEdit(session);
    setInitialDateForBooking(null);
    setIsBookingModalOpen(true);
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setSessionToEdit(null);
    setInitialDateForBooking(date.toISOString().split('T')[0]);
    setIsBookingModalOpen(true);
  }, []);

  const handleConfirmDeleteSession = () => {
    if (!sessionToDelete) return;
    setOneOnOneSessionsData((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
    setSessionToDelete(null);
  };

  if (orgDataError) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <h2 className="text-2xl font-bold text-red-800">Fel vid datainläsning</h2>
          <p className="mt-2 text-lg text-red-700">{orgDataError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {tabsToShow.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle(tab.id)}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div role="tabpanel" hidden={activeTab !== 'overview'}>
        {activeTab === 'overview' && (
          <>
            <EngagementOpportunities participants={participantsForView} workoutLogs={workoutLogsForView} oneOnOneSessions={oneOnOneSessionsForView} isOnline={isOnline} />
            <MemberManagement
              participants={participantsForView}
              allParticipantGoals={participantGoalsForView}
              allActivityLogs={allActivityLogsForView}
              coachNotes={coachNotesForView}
              oneOnOneSessions={oneOnOneSessionsForView}
              loggedInStaff={loggedInStaff}
              isOnline={isOnline}
            />
          </>
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'klientresan'}>
        {activeTab === 'klientresan' && loggedInStaff && (
          <ClientJourneyView
            participants={participantsForView}
            allActivityLogs={allActivityLogsForView}
            oneOnOneSessions={oneOnOneSessionsForView}
            loggedInStaff={loggedInStaff}
            allParticipantGoals={participantGoalsForView}
            coachNotes={coachNotesForView}
            isOnline={isOnline}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'programs'}>
        {activeTab === 'programs' && <WorkoutManagement participants={participantsForView} isOnline={isOnline} />}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'bookings'}>
        {activeTab === 'bookings' && loggedInStaff && (
          <div className="space-y-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Location Tabs">
                <button
                  onClick={() => setSelectedLocationTabId('all')}
                  className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${
                    selectedLocationTabId === 'all'
                      ? 'border-flexibel text-flexibel'
                      : 'border-transparent text-gray-500 active:text-gray-700 active:border-gray-300'
                  }`}
                >
                  Alla orter
                </button>
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocationTabId(loc.id)}
                    className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${
                      selectedLocationTabId === loc.id
                        ? 'border-flexibel text-flexibel'
                        : 'border-transparent text-gray-500 active:text-gray-700 active:border-gray-300'
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </nav>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Kalenderöversikt</h3>
                <Button onClick={() => setIsCreateScheduleModalOpen(true)}>
                    Lägg ut nytt pass
                </Button>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border mb-4 space-y-4">
                  <h4 className="text-lg font-semibold text-gray-700">Filter</h4>
                  {loggedInStaff.role === 'Admin' ? (
                      <Select
                          label="Visa pass för"
                          id="coach-filter"
                          value={selectedCoachFilter}
                          onChange={(e) => setSelectedCoachFilter(e.target.value)}
                          options={coachFilterOptions}
                          inputSize="sm"
                      />
                  ) : (
                      <ToggleSwitch
                          id="show-my-sessions-only"
                          label="Visa endast mina pass"
                          checked={calendarFilters.showMySessionsOnly}
                          onChange={(checked) => setCalendarFilters(prev => ({ ...prev, showMySessionsOnly: checked }))}
                      />
                  )}
                  <div className="flex items-center gap-6 pt-2 border-t">
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                              type="checkbox"
                              checked={calendarFilters.showGroupClasses}
                              onChange={(e) => setCalendarFilters(prev => ({ ...prev, showGroupClasses: e.target.checked }))}
                              className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                          />
                          <span className="text-base font-medium text-gray-700">Visa Gruppass</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                              type="checkbox"
                              checked={calendarFilters.showOneOnOneSessions}
                              onChange={(e) => setCalendarFilters(prev => ({ ...prev, showOneOnOneSessions: e.target.checked }))}
                              className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                          />
                          <span className="text-base font-medium text-gray-700">Visa 1-on-1 bokningar</span>
                      </label>
                  </div>
              </div>
              <CalendarView
                sessions={filteredSessions}
                participants={participantDirectory}
                coaches={staffMembers}
                onSessionClick={handleOpenMeetingModal}
                onDayClick={handleDayClick}
                onSessionEdit={handleOpenEditModal}
                onSessionDelete={setSessionToDelete}
                groupClassSchedules={filteredSchedules}
                groupClassDefinitions={groupClassDefinitions}
                groupClassScheduleExceptions={groupClassScheduleExceptions}
                bookings={bookingsForLocationTab}
                onGroupClassClick={(instance) => setManagedClassInfo({ scheduleId: instance.scheduleId, date: instance.date })}
                loggedInCoachId={loggedInStaff.id}
              />
              <BookOneOnOneModal
                isOpen={isBookingModalOpen}
                onClose={() => {
                  setIsBookingModalOpen(false);
                  setSessionToEdit(null);
                  setInitialDateForBooking(null);
                }}
                onSave={handleSaveOrUpdateSession}
                sessionToEdit={sessionToEdit}
                participants={participantsForView}
                coaches={staffMembers}
                loggedInCoachId={loggedInStaff.id}
                initialDate={initialDateForBooking}
                staffAvailability={staffAvailability}
              />
              <CreateScheduleModal
                isOpen={isCreateScheduleModalOpen}
                onClose={() => setIsCreateScheduleModalOpen(false)}
                onSave={handleSaveSchedule}
                scheduleToEdit={null} // Only for creating new schedules from this button
                classDefinitions={groupClassDefinitions}
                locations={locations}
                coaches={staffMembers}
              />
              {selectedSessionForModal && user && (
                <MeetingDetailsModal
                  isOpen={isMeetingModalOpen}
                  onClose={() => setIsMeetingModalOpen(false)}
                  session={selectedSessionForModal}
                  coach={staffMembers.find((s) => s.id === selectedSessionForModal.coachId) || null}
                  currentUserId={user.id}
                  onAddComment={onAddComment}
                  onDeleteComment={onDeleteComment}
                  onToggleCommentReaction={onToggleCommentReaction}
                  onEdit={() => {
                    if (!selectedSessionForModal) return;
                    setIsMeetingModalOpen(false);
                    handleOpenEditModal(selectedSessionForModal);
                  }}
                  onDelete={() => {
                    if (!selectedSessionForModal) return;
                    setIsMeetingModalOpen(false);
                    setSessionToDelete(selectedSessionForModal);
                  }}
                  readOnlyComments={false}
                />
              )}
              <ConfirmationModal
                isOpen={!!sessionToDelete}
                onClose={() => setSessionToDelete(null)}
                onConfirm={handleConfirmDeleteSession}
                title="Ta bort 1-on-1 Session"
                message={`Är du säker på att du vill ta bort sessionen "${sessionToDelete?.title}"? Detta kan inte ångras.`}
                confirmButtonText="Ja, ta bort"
              />
            </div>
          </div>
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'analytics'}>
        {activeTab === 'analytics' && (
          <Suspense fallback={<LoadingSpinner />}>
            <AnalyticsDashboard />
          </Suspense>
        )}
      </div>
      
      <div role="tabpanel" hidden={activeTab !== 'insights'}>
        {activeTab === 'insights' && (
          <AIBusinessInsights
            locations={locations}
            participants={participantsForView}
            allActivityLogs={allActivityLogsForView}
            workouts={workouts}
            oneOnOneSessions={oneOnOneSessionsForView}
            staffMembers={staffMembers}
            isOnline={isOnline}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'leaderboards'}>
        {activeTab === 'leaderboards' && (
          <LeaderboardManagement
            participants={participantsForView}
            allActivityLogs={allActivityLogsForView}
            workoutLogs={workoutLogsForView}
            userStrengthStats={userStrengthStatsForView}
            userConditioningStats={userConditioningStatsForView}
            workouts={workouts}
            clubMemberships={clubMembershipsForView}
            setClubMemberships={setClubMembershipsData}
            leaderboardSettings={leaderboardSettings}
            setLeaderboardSettings={setLeaderboardSettingsData}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'events'}>
        {activeTab === 'events' && (
          <EventManagement
            events={coachEvents}
            setEvents={setCoachEventsData}
            participants={participantsForView}
            workoutLogs={workoutLogsForView}
            weeklyHighlightSettings={weeklyHighlightSettings}
            setWeeklyHighlightSettings={setWeeklyHighlightSettingsData}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'personal'}>
        {activeTab === 'personal' && loggedInStaff && (
          <StaffManagement
            staff={staffMembers}
            setStaff={setStaffMembersData}
            locations={locations}
            availability={staffAvailability}
            setAvailability={setStaffAvailabilityData}
            loggedInStaff={loggedInStaff}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'settings'}>
        {activeTab === 'settings' && <SettingsManagement loggedInStaff={loggedInStaff} />}
      </div>

      {classInstanceForManagement && (
        <ClassManagementModal
          isOpen={!!classInstanceForManagement}
          onClose={() => setManagedClassInfo(null)}
          classInstance={classInstanceForManagement}
          participants={participantDirectory}
          groupClassScheduleExceptions={groupClassScheduleExceptions}
          onCheckIn={onCheckInParticipant}
          onUnCheckIn={onUnCheckInParticipant}
          onBookClass={onBookClass}
          onCancelBooking={onCancelBooking}
          onPromoteFromWaitlist={onPromoteFromWaitlist}
          onCancelClassInstance={onCancelClassInstance}
          onUpdateClassInstance={onUpdateClassInstance}
        />
      )}
    </div>
  );
};
