
import React, { useState, useMemo, useCallback, lazy, Suspense, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  OneOnOneSession,
  CoachEvent,
} from '../../types';
import { MemberManagement } from './MemberManagement';
import { WorkoutManagement } from '../../features/workouts/components/WorkoutManagement';
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
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import { CreateScheduleModal } from '../../features/booking/components/CreateScheduleModal';
import { ToggleSwitch } from '../ToggleSwitch';
import { Select } from '../Input';
import { useCoachData } from '../../features/coach/hooks/useCoachData';
import { useCoachOperations } from '../../features/coach/hooks/useCoachOperations';

const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
  </div>
);

type CoachTab =
  | 'overview'
  | 'klientresan'
  | 'programs'
  | 'bookings'
  | 'analytics'
  | 'insights'
  | 'leaderboards'
  | 'events'
  | 'personal'
  | 'settings';

interface CoachAreaProps {
  onAddComment: (
    logId: string,
    logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session',
    text: string
  ) => void;
  onDeleteComment: (
    logId: string,
    logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session',
    commentId: string
  ) => void;
  onToggleCommentReaction: (
    logId: string,
    logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session',
    commentId: string
  ) => void;
  // Optional overrides
  onCheckInParticipant?: (bookingId: string) => void;
  onUnCheckInParticipant?: (bookingId: string) => void;
  onBookClass?: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking?: (bookingId: string) => void;
  onPromoteFromWaitlist?: (bookingId: string) => void;
  onCancelClassInstance?: (scheduleId: string, classDate: string, status: 'CANCELLED' | 'DELETED') => void;
  onUpdateClassInstance?: (scheduleId: string, classDate: string, updates: any, notify: boolean) => void;
}

export const CoachArea: React.FC<CoachAreaProps> = ({
  onAddComment,
  onDeleteComment,
  onToggleCommentReaction,
  onCheckInParticipant: propCheckIn,
  onUnCheckInParticipant: propUnCheckIn,
  onBookClass: propBookClass,
  onCancelBooking: propCancelBooking,
  onPromoteFromWaitlist: propPromote,
  onCancelClassInstance: propCancelInstance,
  onUpdateClassInstance: propUpdateInstance,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentPath = location.pathname.split('/').pop();
  const activeTab = (currentPath && currentPath !== 'coach' ? currentPath : 'overview') as CoachTab;

  const {
    loggedInStaff,
    participantsForView,
    workoutLogsForView,
    oneOnOneSessionsForView,
    allActivityLogsForView,
    participantGoalsForView,
    coachNotesForView,
    workouts,
    leaderboardSettings,
    userStrengthStatsForView,
    userConditioningStatsForView,
    clubMembershipsForView,
    coachEvents,
    weeklyHighlightSettings,
    staffMembers,
    locations,
    staffAvailability,
    integrationSettings,
    groupClassDefinitions,
    groupClassSchedules,
    groupClassScheduleExceptions,
    participantBookings,
    orgDataError,
    getClassInstanceDetails,
    // Ensure these are destructured:
    participantDirectory, 
    leads,
    prospectIntroCalls,
  } = useCoachData();

  const ops = useCoachOperations();

  const onCheckInParticipant = propCheckIn || ops.handleCheckInParticipant;
  const onUnCheckInParticipant = propUnCheckIn || ops.handleUnCheckInParticipant;
  const onBookClass = propBookClass || ops.handleBookClass;
  const onCancelBooking = propCancelBooking || ops.handleCancelBooking;
  const onPromoteFromWaitlist = propPromote || ops.handlePromoteFromWaitlist;
  const onCancelClassInstance = propCancelInstance || ops.handleCancelClassInstance;
  // const onUpdateClassInstance = propUpdateInstance || ops.handleUpdateClassInstance; // Not used by simple management modal

  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  // Explicitly define variables to prevent ReferenceErrors if they are accessed elsewhere in the component or cached renders
  const newLeads = useMemo(() => {
      return (leads || []).filter(l => l.status === 'new');
  }, [leads]);

  const unlinkedCalls = useMemo(() => {
      return (prospectIntroCalls || []).filter(c => c.status === 'unlinked');
  }, [prospectIntroCalls]);

  const newLeadsCount = newLeads.length;
  const unlinkedCallsCount = unlinkedCalls.length;
  const totalJourneyBadge = newLeadsCount + unlinkedCallsCount;

  const allTabs: { id: CoachTab; label: string }[] = [
    { id: 'overview', label: 'Medlemmar' },
    { id: 'klientresan', label: `Klientresan${totalJourneyBadge > 0 ? ` (${totalJourneyBadge})` : ''}` },
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
      return allTabs;
    }
    return allTabs.filter((tab) =>
      ['overview', 'klientresan', 'bookings', 'programs'].includes(tab.id)
    );
  }, [loggedInStaff, totalJourneyBadge]);

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

  const classInstanceForManagement = useMemo(() => {
    if (!managedClassInfo) return null;
    return getClassInstanceDetails(managedClassInfo.scheduleId, managedClassInfo.date);
  }, [managedClassInfo, getClassInstanceDetails]);

  const schedulesForLocationTab = useMemo(() => {
    if (selectedLocationTabId === 'all' || !locations.some((l) => l.id === selectedLocationTabId))
      return groupClassSchedules;
    return groupClassSchedules.filter((s) => s.locationId === selectedLocationTabId);
  }, [groupClassSchedules, selectedLocationTabId, locations]);

  const scheduleIdsInLocation = useMemo(
    () => new Set(schedulesForLocationTab.map((s) => s.id)),
    [schedulesForLocationTab]
  );

  const bookingsForLocationTab = useMemo(() => {
    return participantBookings.filter((b) => scheduleIdsInLocation.has(b.scheduleId));
  }, [participantBookings, scheduleIdsInLocation]);

  const sessionsForLocationTab = useMemo(() => {
    if (selectedLocationTabId === 'all' || !locations.some((l) => l.id === selectedLocationTabId))
      return oneOnOneSessionsForView;
    const staffIdsInLocation = new Set(
      staffMembers.filter((s) => s.locationId === selectedLocationTabId).map((s) => s.id)
    );
    return oneOnOneSessionsForView.filter((session) => staffIdsInLocation.has(session.coachId));
  }, [oneOnOneSessionsForView, staffMembers, selectedLocationTabId, locations]);

  const coachFilterOptions = useMemo(() => {
    if (!loggedInStaff || loggedInStaff.role !== 'Admin') return [];
    const myPassOption = { value: loggedInStaff.id, label: 'Mina pass' };
    const coachOptions = staffMembers
      .filter((s) => s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: s.id, label: s.name }));
    const uniqueCoachOptions = coachOptions.filter((c) => c.value !== loggedInStaff.id);
    return [
      { value: 'all', label: 'Alla coacher' },
      myPassOption,
      ...uniqueCoachOptions,
    ];
  }, [loggedInStaff, staffMembers]);

  const filteredSchedules = useMemo(() => {
    let schedules = schedulesForLocationTab;
    if (!calendarFilters.showGroupClasses) return [];
    if (loggedInStaff?.role === 'Admin') {
      if (selectedCoachFilter !== 'all') {
        schedules = schedules.filter((schedule) => schedule.coachId === selectedCoachFilter);
      }
    } else if (loggedInStaff?.role === 'Coach') {
      if (calendarFilters.showMySessionsOnly) {
        schedules = schedules.filter((schedule) => schedule.coachId === loggedInStaff.id);
      }
    }
    return schedules;
  }, [schedulesForLocationTab, calendarFilters, loggedInStaff, selectedCoachFilter]);

  const filteredSessions = useMemo(() => {
    let sessions = sessionsForLocationTab;
    if (!calendarFilters.showOneOnOneSessions) return [];
    if (loggedInStaff?.role === 'Admin') {
      if (selectedCoachFilter !== 'all') {
        sessions = sessions.filter((session) => session.coachId === selectedCoachFilter);
      }
    } else if (loggedInStaff?.role === 'Coach') {
      if (calendarFilters.showMySessionsOnly) {
        sessions = sessions.filter((session) => session.coachId === loggedInStaff.id);
      }
    }
    return sessions;
  }, [sessionsForLocationTab, calendarFilters, loggedInStaff, selectedCoachFilter]);

  const getTabButtonStyle = (tabName: CoachTab) => {
    return activeTab === tabName
      ? 'border-flexibel text-flexibel'
      : 'border-transparent text-gray-500 active:text-gray-700 active:border-gray-300';
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
              onClick={() => navigate(`/coach/${tab.id}`)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle(
                tab.id
              )}`}
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
            <EngagementOpportunities
              participants={participantsForView}
              workoutLogs={workoutLogsForView}
              oneOnOneSessions={oneOnOneSessionsForView}
              isOnline={isOnline}
            />
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
        {activeTab === 'programs' && (
          <WorkoutManagement participants={participantsForView} isOnline={isOnline} />
        )}
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
                <Button onClick={() => setIsCreateScheduleModalOpen(true)}>Lägg ut nytt pass</Button>
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
                    onChange={(checked) =>
                      setCalendarFilters((prev) => ({ ...prev, showMySessionsOnly: checked }))
                    }
                  />
                )}
                <div className="flex items-center gap-6 pt-2 border-t">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calendarFilters.showGroupClasses}
                      onChange={(e) =>
                        setCalendarFilters((prev) => ({
                          ...prev,
                          showGroupClasses: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                    />
                    <span className="text-base font-medium text-gray-700">
                      Visa Gruppass
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calendarFilters.showOneOnOneSessions}
                      onChange={(e) =>
                        setCalendarFilters((prev) => ({
                          ...prev,
                          showOneOnOneSessions: e.target.checked,
                        }))
                      }
                      className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                    />
                    <span className="text-base font-medium text-gray-700">
                      Visa 1-on-1 bokningar
                    </span>
                  </label>
                </div>
              </div>
              <CalendarView
                sessions={filteredSessions}
                participants={participantDirectory || []} // Use optional chaining or default to [] if participantDirectory is undefined
                coaches={staffMembers}
                onSessionClick={handleOpenMeetingModal}
                onDayClick={handleDayClick}
                onSessionEdit={handleOpenEditModal}
                onSessionDelete={setSessionToDelete}
                groupClassSchedules={filteredSchedules}
                groupClassDefinitions={groupClassDefinitions}
                groupClassScheduleExceptions={groupClassScheduleExceptions}
                bookings={bookingsForLocationTab}
                onGroupClassClick={(instance) =>
                  setManagedClassInfo({
                    scheduleId: instance.scheduleId,
                    date: instance.date,
                  })
                }
                loggedInCoachId={loggedInStaff.id}
              />
              <BookOneOnOneModal
                isOpen={isBookingModalOpen}
                onClose={() => {
                  setIsBookingModalOpen(false);
                  setSessionToEdit(null);
                  setInitialDateForBooking(null);
                }}
                onSave={(session) => {
                  ops.handleSaveOrUpdateSession(session);
                  setSessionToEdit(null);
                }}
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
                onSave={ops.handleSaveSchedule}
                scheduleToEdit={null}
                classDefinitions={groupClassDefinitions}
                locations={locations}
                coaches={staffMembers}
              />
              {selectedSessionForModal && user && (
                <MeetingDetailsModal
                  isOpen={isMeetingModalOpen}
                  onClose={() => setIsMeetingModalOpen(false)}
                  session={selectedSessionForModal}
                  coach={
                    staffMembers.find((s) => s.id === selectedSessionForModal.coachId) ||
                    null
                  }
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
                onConfirm={() => {
                  if (sessionToDelete) {
                    ops.handleDeleteSession(sessionToDelete.id);
                    setSessionToDelete(null);
                  }
                }}
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
            setClubMemberships={ops.setClubMemberships}
            leaderboardSettings={leaderboardSettings}
            setLeaderboardSettings={ops.setLeaderboardSettings}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'events'}>
        {activeTab === 'events' && (
          <EventManagement
            events={coachEvents}
            setEvents={ops.setEvents}
            participants={participantsForView}
            workoutLogs={workoutLogsForView}
            weeklyHighlightSettings={weeklyHighlightSettings}
            setWeeklyHighlightSettings={ops.setWeeklyHighlightSettings}
          />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'personal'}>
        {activeTab === 'personal' && loggedInStaff && (
          <StaffManagement
            staff={staffMembers}
            setStaff={ops.setStaff}
            locations={locations}
            availability={staffAvailability}
            setAvailability={ops.setAvailability}
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
          participants={participantDirectory || []}
          groupClassScheduleExceptions={groupClassScheduleExceptions}
          onCheckIn={onCheckInParticipant}
          onUnCheckIn={onUnCheckInParticipant}
          onBookClass={onBookClass}
          onCancelBooking={onCancelBooking}
          onPromoteFromWaitlist={onPromoteFromWaitlist}
          onCancelClassInstance={onCancelClassInstance}
        />
      )}
    </div>
  );
};
