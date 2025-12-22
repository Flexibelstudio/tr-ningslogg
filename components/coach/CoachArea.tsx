
// components/coach/CoachArea.tsx
import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { OneOnOneSession, ParticipantProfile, GroupClassSchedule } from '../../types';
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
import { BirthdayWidget } from './BirthdayWidget'; 
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
import * as dateUtils from '../../utils/dateUtils';

const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
  </div>
);

// --- DASHBOARD COMPONENTS ---
const DashboardCard = ({ title, value, subtext, icon, colorClass, onClick }: { title: string, value: string | number, subtext?: string, icon: React.ReactNode, colorClass: string, onClick?: () => void }) => (
    <div onClick={onClick} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}>
        <div className="flex justify-between items-start mb-2">
            <div className={`p-3 rounded-xl bg-opacity-10 ${colorClass} text-${colorClass.split(' ')[0].replace('bg-', '')}-600`}>
                {icon}
            </div>
            {value !== undefined && <span className="text-3xl font-extrabold text-gray-900">{value}</span>}
        </div>
        <div>
            <h3 className="text-base font-bold text-gray-700">{title}</h3>
            {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
    </div>
);

const NavCard = ({ title, description, icon, color, onClick }: { title: string, description: string, icon: React.ReactNode, color: string, onClick: () => void }) => (
    <button onClick={onClick} className="w-full text-left bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-flexibel/30 transition-all duration-200 group flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform ${color}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-lg font-bold text-gray-800 group-hover:text-flexibel transition-colors">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 ml-auto group-hover:text-flexibel transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </button>
);

const ActionItem = ({ title, count, type, onClick }: { title: string, count: number, type: 'urgent' | 'info' | 'success', onClick: () => void }) => {
    if (count === 0) return null;
    const styles = {
        urgent: 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100',
        info: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
        success: 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100',
    };
    return (
        <button onClick={onClick} className={`w-full flex justify-between items-center p-3 rounded-xl border mb-2 transition-colors ${styles[type]}`}>
            <span className="font-semibold text-sm">{title}</span>
            <span className="font-bold bg-white/50 px-2 py-0.5 rounded-full text-xs">{count}</span>
        </button>
    );
}

// --- MAIN COMPONENT ---

type CoachTab =
  | 'overview'
  | 'members' 
  | 'klientresan'
  | 'programs'
  | 'bookings'
  | 'analytics'
  | 'insights'
  | 'leaderboards'
  | 'events'
  | 'personal'
  | 'settings';

export const CoachArea: React.FC = () => {
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
    participantDirectory: allParticipants, // Alias to avoid confusion and define correctly
    leads,
    prospectIntroCalls,
  } = useCoachData();

  const ops = useCoachOperations();

  const onCheckInParticipant = ops.handleCheckInParticipant;
  const onUnCheckInParticipant = ops.handleUnCheckInParticipant;
  const onBookClass = ops.handleBookClass;
  const onCancelBooking = ops.handleCancelBooking;
  const onPromoteFromWaitlist = ops.handlePromoteFromWaitlist;
  const onCancelClassInstance = ops.handleCancelClassInstance;
  const { handleAddComment, handleDeleteComment, handleToggleCommentReaction } = ops;

  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  
  // -- DASHBOARD STATS CALCULATIONS --
  const dashboardStats = useMemo(() => {
      const activeMembers = participantsForView.filter(p => p.isActive).length;
      const pendingApprovals = participantsForView.filter(p => p.approvalStatus === 'pending').length;
      
      const newLeadsCount = (leads || []).filter(l => l.status === 'new').length;
      const unlinkedCallsCount = (prospectIntroCalls || []).filter(c => c.status === 'unlinked').length;
      
      const today = dateUtils.toYYYYMMDD(new Date());
      const todaysBookings = participantBookings.filter(b => b.classDate === today && b.status !== 'CANCELLED').length;
      
      const expiringSoon = participantsForView.filter(p => {
          if (!p.bindingEndDate) return false;
          const daysLeft = Math.ceil((new Date(p.bindingEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft >= 0 && daysLeft <= 30;
      }).length;

      return { activeMembers, pendingApprovals, newLeadsCount, unlinkedCallsCount, todaysBookings, expiringSoon };
  }, [participantsForView, leads, prospectIntroCalls, participantBookings]);

  const allTabs: { id: CoachTab; label: string }[] = [
    { id: 'overview', label: 'Översikt' },
    { id: 'members', label: 'Register' },
    { id: 'klientresan', label: `Klientresan${(dashboardStats.newLeadsCount + dashboardStats.unlinkedCallsCount) > 0 ? ` (${dashboardStats.newLeadsCount + dashboardStats.unlinkedCallsCount})` : ''}` },
    { id: 'bookings', label: 'Bokningar' },
    { id: 'programs', label: 'Program' },
    { id: 'events', label: 'Händelser' },
    { id: 'leaderboards', label: 'Topplistor' },
    { id: 'insights', label: 'AI Insikter' },
    { id: 'analytics', label: 'Data' },
    { id: 'personal', label: 'Personal' },
    { id: 'settings', label: 'Inställningar' },
  ];

  const visibleTabs = useMemo(() => {
    if (loggedInStaff?.role === 'Admin') {
      return allTabs;
    }
    return allTabs.filter((tab) =>
      ['overview', 'members', 'klientresan', 'bookings', 'programs'].includes(tab.id)
    );
  }, [loggedInStaff, dashboardStats]);

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
  const [initialDateForSchedule, setInitialDateForSchedule] = useState<string | null>(null);
  const [managedClassInfo, setManagedClassInfo] = useState<{ scheduleId: string; date: string } | null>(null);
  const [isCreateScheduleModalOpen, setIsCreateScheduleModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<GroupClassSchedule | null>(null);

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
      ? 'border-flexibel text-flexibel bg-flexibel/5'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50';
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
    setInitialDateForSchedule(date.toISOString().split('T')[0]);
    setScheduleToEdit(null);
    setIsCreateScheduleModalOpen(true);
  }, []);

  const handleEditScheduleFromModal = useCallback(() => {
    if (!managedClassInfo) return;
    const schedule = groupClassSchedules.find(s => s.id === managedClassInfo.scheduleId);
    if (schedule) {
        setManagedClassInfo(null);
        setScheduleToEdit(schedule);
        setInitialDateForSchedule(null);
        setIsCreateScheduleModalOpen(true);
    }
  }, [managedClassInfo, groupClassSchedules]);

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
    <div className="space-y-8 pb-10">
      {/* Top Navigation */}
      <div className="border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur z-20 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex space-x-2 overflow-x-auto hide-scrollbar" aria-label="Tabs">
          {tabsToShow.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(`/coach/${tab.id}`)}
              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base transition-colors ${getTabButtonStyle(tab.id)}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* DASHBOARD VIEW */}
      {activeTab === 'overview' && loggedInStaff && (
         <div className="animate-fade-in space-y-6">
             <header className="flex flex-col gap-1 mb-4">
                 <h1 className="text-3xl font-extrabold text-gray-900">Hej {loggedInStaff.name.split(' ')[0]}! 👋</h1>
                 <p className="text-gray-500">Här är läget i din studio idag.</p>
             </header>

             {/* KPI Grid */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <DashboardCard 
                    title="Aktiva Medlemmar" 
                    value={dashboardStats.activeMembers} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    colorClass="bg-blue-50 text-blue-600"
                    onClick={() => navigate('/coach/members')}
                 />
                 <DashboardCard 
                    title="Bokningar Idag" 
                    value={dashboardStats.todaysBookings} 
                    subtext="passbokningar"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    colorClass="bg-purple-50 text-purple-600"
                    onClick={() => navigate('/coach/bookings')}
                 />
                 <DashboardCard 
                    title="Nya Leads" 
                    value={dashboardStats.newLeadsCount}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}
                    colorClass="bg-orange-50 text-orange-600"
                    onClick={() => navigate('/coach/klientresan')}
                 />
                  <DashboardCard 
                    title="Utgående avtal" 
                    value={dashboardStats.expiringSoon}
                    subtext="inom 30 dagar"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    colorClass="bg-yellow-50 text-yellow-600"
                    onClick={() => navigate('/coach/klientresan')}
                 />
             </div>

             {/* Main Content Grid */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Navigation */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-bold text-gray-800">Genvägar</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NavCard 
                            title="Register & Klientkort" 
                            description="Hantera medlemmar, anteckningar och status." 
                            icon="👥" 
                            color="bg-blue-100 text-blue-700"
                            onClick={() => navigate('/coach/members')}
                        />
                        <NavCard 
                            title="Kalender & Schema" 
                            description="Boka 1-on-1, se gruppass och schema." 
                            icon="🗓️" 
                            color="bg-purple-100 text-purple-700"
                            onClick={() => navigate('/coach/bookings')}
                        />
                         <NavCard 
                            title="Klientresan & Sälj" 
                            description="Bearbeta leads och följ upp riskzoner." 
                            icon="🚀" 
                            color="bg-orange-100 text-orange-700"
                            onClick={() => navigate('/coach/klientresan')}
                        />
                         <NavCard 
                            title="Bygg Program" 
                            description="Skapa och tilldela pass." 
                            icon="💪" 
                            color="bg-green-100 text-green-700"
                            onClick={() => navigate('/coach/programs')}
                        />
                    </div>

                    {/* Quick Stats Widgets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <EngagementOpportunities
                            participants={participantsForView}
                            workoutLogs={workoutLogsForView}
                            oneOnOneSessions={oneOnOneSessionsForView}
                            isOnline={isOnline}
                        />
                        <BirthdayWidget participants={participantsForView} />
                    </div>
                </div>

                {/* Right Col: Action Center */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 sticky top-24">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-2 h-6 bg-flexibel rounded-full"></span>
                            Action Center
                        </h3>
                        
                        {dashboardStats.pendingApprovals > 0 ? (
                            <ActionItem 
                                title="Väntar på godkännande" 
                                count={dashboardStats.pendingApprovals} 
                                type="urgent" 
                                onClick={() => navigate('/coach/members')} 
                            />
                        ) : (
                            <p className="text-sm text-gray-400 italic mb-2">Inga konton att godkänna.</p>
                        )}
                        
                        {dashboardStats.newLeadsCount > 0 ? (
                            <ActionItem 
                                title="Nya leads att kontakta" 
                                count={dashboardStats.newLeadsCount} 
                                type="urgent" 
                                onClick={() => navigate('/coach/klientresan')} 
                            />
                        ) : (
                             <p className="text-sm text-gray-400 italic mb-2">Inga nya leads.</p>
                        )}
                        
                        {dashboardStats.unlinkedCallsCount > 0 && (
                             <ActionItem 
                                title="Okopplade Introsamtal" 
                                count={dashboardStats.unlinkedCallsCount} 
                                type="info" 
                                onClick={() => navigate('/coach/klientresan')} 
                            />
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-100">
                             <p className="text-xs text-gray-500 italic">
                                Verifiering av PB sker nu direkt i medlemmarnas klientkort under fliken 'Styrka'.
                             </p>
                        </div>
                    </div>
                </div>
             </div>
         </div>
      )}

      {/* MEMBERS LIST VIEW */}
      {activeTab === 'members' && (
         <div className="animate-fade-in">
             <MemberManagement
              participants={participantsForView}
              allParticipantGoals={participantGoalsForView}
              allActivityLogs={allActivityLogsForView}
              coachNotes={coachNotesForView}
              oneOnOneSessions={oneOnOneSessionsForView}
              loggedInStaff={loggedInStaff}
              isOnline={isOnline}
            />
         </div>
      )}

      {/* CLIENT JOURNEY VIEW */}
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

      <div role="tabpanel" hidden={activeTab !== 'programs'}>
        {activeTab === 'programs' && (
          <WorkoutManagement participants={participantsForView} isOnline={isOnline} />
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'bookings'}>
        {activeTab === 'bookings' && loggedInStaff && (
          <div className="space-y-8 animate-fade-in">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Location Tabs">
                <button
                  onClick={() => setSelectedLocationTabId('all')}
                  className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${
                    selectedLocationTabId === 'all'
                      ? 'border-flexibel text-flexibel bg-flexibel/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
                        ? 'border-flexibel text-flexibel bg-flexibel/5'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setSessionToEdit(null); setIsBookingModalOpen(true); }}>Boka 1-on-1</Button>
                    <Button onClick={() => { setScheduleToEdit(null); setInitialDateForSchedule(null); setIsCreateScheduleModalOpen(true); }}>Lägg ut nytt pass</Button>
                </div>
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
                participants={allParticipants || []}
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
                participants={allParticipants}
                coaches={staffMembers}
                loggedInCoachId={loggedInStaff.id}
                initialDate={initialDateForBooking}
                staffAvailability={staffAvailability}
              />
              <CreateScheduleModal
                isOpen={isCreateScheduleModalOpen}
                onClose={() => {
                    setIsCreateScheduleModalOpen(false);
                    setInitialDateForSchedule(null);
                    setScheduleToEdit(null);
                }}
                onSave={ops.handleSaveSchedule}
                scheduleToEdit={scheduleToEdit}
                classDefinitions={groupClassDefinitions}
                locations={locations}
                coaches={staffMembers}
                initialDate={initialDateForSchedule}
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
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onToggleCommentReaction={handleToggleCommentReaction}
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
          participants={allParticipants || []}
          groupClassScheduleExceptions={groupClassScheduleExceptions}
          onCheckIn={onCheckInParticipant}
          onUnCheckIn={onUnCheckInParticipant}
          onBookClass={onBookClass}
          onCancelBooking={onCancelBooking}
          onPromoteFromWaitlist={onPromoteFromWaitlist}
          onCancelClassInstance={onCancelClassInstance}
          onEditSchedule={handleEditScheduleFromModal}
        />
      )}
    </div>
  );
};
