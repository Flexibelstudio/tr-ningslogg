import React, { useState, useMemo } from 'react';
import { Workout, WorkoutLog, ParticipantProfile, ParticipantGoalData, GeneralActivityLog, GoalCompletionLog, CoachNote, UserStrengthStat, ParticipantClubMembership, LeaderboardSettings, CoachEvent, Location, StaffMember, Membership, WeeklyHighlightSettings, OneOnOneSession, Comment, WorkoutCategoryDefinition, StaffAvailability, IntegrationSettings, GroupClassDefinition, GroupClassSchedule, ParticipantBooking } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { MemberManagement } from './MemberManagement';
import { ParticipantActivityOverview } from './ParticipantActivityOverview'; 
import { WorkoutManagement } from './WorkoutManagement';
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { LeaderboardManagement } from './LeaderboardManagement';
import { EventManagement } from './EventManagement';
import { SettingsManagement } from './SettingsManagement';
import { StaffManagement } from './StaffManagement';
import { BookOneOnOneModal } from './BookOneOnOneModal';
import { Button } from '../Button';
import { AIBusinessInsights } from './AIBusinessInsights';
import { ClientJourneyView } from './ClientJourneyView';
import { MeetingDetailsModal } from '../participant/MeetingDetailsModal';
import { EngagementOpportunities } from './EngagementOpportunities';
import { ConfirmationModal } from '../ConfirmationModal';
import { CalendarView } from './CalendarView';
import { ScheduleManagement } from './ScheduleManagement';
import { ClassCheckinModal } from './ClassCheckinModal';

type CoachTab = 'overview' | 'klientresan' | 'programs' | 'bookings' | 'insights' | 'leaderboards' | 'events' | 'personal' | 'settings';

interface CoachAreaProps {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
  workoutLogs: WorkoutLog[];
  participantGoals: ParticipantGoalData[];
  setParticipantGoals: (goals: ParticipantGoalData[] | ((prev: ParticipantGoalData[]) => ParticipantGoalData[])) => void;
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  setGoalCompletionLogs: (logs: GoalCompletionLog[] | ((prev: GoalCompletionLog[]) => GoalCompletionLog[])) => void;
  ai: GoogleGenAI | null;
  participantDirectory: ParticipantProfile[];
  setParticipantDirectory: (updater: ParticipantProfile[] | ((prev: ParticipantProfile[]) => ParticipantProfile[])) => void;
  userStrengthStats: UserStrengthStat[];
  clubMemberships: ParticipantClubMembership[];
  setClubMemberships: (updater: ParticipantClubMembership[] | ((prev: ParticipantClubMembership[]) => ParticipantClubMembership[])) => void;
  leaderboardSettings: LeaderboardSettings;
  setLeaderboardSettings: (settings: LeaderboardSettings | ((prev: LeaderboardSettings) => LeaderboardSettings)) => void;
  coachEvents: CoachEvent[];
  setCoachEvents: (events: CoachEvent[] | ((prev: CoachEvent[]) => CoachEvent[])) => void;
  locations: Location[];
  setLocations: (locations: Location[] | ((prev: Location[]) => Location[])) => void;
  staffMembers: StaffMember[];
  setStaffMembers: (staff: StaffMember[] | ((prev: StaffMember[]) => StaffMember[])) => void;
  memberships: Membership[];
  setMemberships: (memberships: Membership[] | ((prev: Membership[]) => Membership[])) => void;
  workoutCategories: WorkoutCategoryDefinition[];
  setWorkoutCategories: (categories: WorkoutCategoryDefinition[] | ((prev: WorkoutCategoryDefinition[]) => WorkoutCategoryDefinition[])) => void;
  coachNotes: CoachNote[];
  setCoachNotes: (notes: CoachNote[] | ((prev: CoachNote[]) => CoachNote[])) => void;
  weeklyHighlightSettings: WeeklyHighlightSettings;
  setWeeklyHighlightSettings: (settings: WeeklyHighlightSettings | ((prev: WeeklyHighlightSettings) => WeeklyHighlightSettings)) => void;
  oneOnOneSessions: OneOnOneSession[];
  setOneOnOneSessions: (sessions: OneOnOneSession[] | ((prev: OneOnOneSession[]) => OneOnOneSession[])) => void;
  staffAvailability: StaffAvailability[];
  setStaffAvailability: (availability: StaffAvailability[] | ((prev: StaffAvailability[]) => StaffAvailability[])) => void;
  loggedInStaff: StaffMember | null;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  visibleTabs?: CoachTab[];
  integrationSettings: IntegrationSettings;
  setIntegrationSettings: (settings: IntegrationSettings | ((prev: IntegrationSettings) => IntegrationSettings)) => void;
  groupClassDefinitions: GroupClassDefinition[];
  setGroupClassDefinitions: (definitions: GroupClassDefinition[] | ((prev: GroupClassDefinition[]) => GroupClassDefinition[])) => void;
  groupClassSchedules: GroupClassSchedule[];
  setGroupClassSchedules: (schedules: GroupClassSchedule[] | ((prev: GroupClassSchedule[]) => GroupClassSchedule[])) => void;
  participantBookings: ParticipantBooking[];
  onCheckInParticipant: (bookingId: string) => void;
}

export const CoachArea: React.FC<CoachAreaProps> = ({ 
  workouts, 
  setWorkouts, 
  workoutLogs,
  participantGoals,
  setParticipantGoals,
  generalActivityLogs,
  goalCompletionLogs,
  setGoalCompletionLogs,
  ai,
  participantDirectory,
  setParticipantDirectory,
  userStrengthStats,
  clubMemberships,
  setClubMemberships,
  leaderboardSettings,
  setLeaderboardSettings,
  coachEvents,
  setCoachEvents,
  locations,
  setLocations,
  staffMembers,
  setStaffMembers,
  memberships,
  setMemberships,
  workoutCategories,
  setWorkoutCategories,
  coachNotes,
  setCoachNotes,
  weeklyHighlightSettings,
  setWeeklyHighlightSettings,
  oneOnOneSessions,
  setOneOnOneSessions,
  staffAvailability,
  setStaffAvailability,
  loggedInStaff,
  onAddComment,
  onDeleteComment,
  visibleTabs,
  integrationSettings,
  setIntegrationSettings,
  groupClassDefinitions,
  setGroupClassDefinitions,
  groupClassSchedules,
  setGroupClassSchedules,
  participantBookings,
  onCheckInParticipant,
}) => {
  const allTabs: { id: CoachTab, label: string }[] = [
    { id: 'overview', label: 'Medlemmar' },
    { id: 'klientresan', label: 'Klientresan' },
    { id: 'bookings', label: 'Bokningar' },
    { id: 'programs', label: 'Program & Pass' },
    { id: 'events', label: 'Händelser' },
    { id: 'leaderboards', label: 'Topplistor' },
    { id: 'insights', label: 'Insikter' },
    { id: 'personal', label: 'Personal & Schema' },
    { id: 'settings', label: 'Inställningar' },
  ];

  const tabsToShow = useMemo(() =>
    (visibleTabs ? allTabs.filter(tab => visibleTabs.includes(tab.id)) : allTabs)
      .filter(tab => tab.id !== 'bookings' || integrationSettings.isBookingEnabled)
  , [visibleTabs, integrationSettings.isBookingEnabled]);

  const [activeTab, setActiveTab] = useState<CoachTab>(tabsToShow[0]?.id || 'overview');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<OneOnOneSession | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<OneOnOneSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<OneOnOneSession | null>(null);
  const [initialDateForBooking, setInitialDateForBooking] = useState<string | null>(null);
  const [classInstanceForCheckin, setClassInstanceForCheckin] = useState<any | null>(null);

  // Filter all data based on logged-in staff's role and location
  const participantsForView = useMemo(() => {
    if (loggedInStaff?.role === 'Admin') {
      return participantDirectory;
    }
    if (loggedInStaff?.role === 'Coach') {
      return participantDirectory.filter(p => p.locationId === loggedInStaff.locationId);
    }
    return [];
  }, [participantDirectory, loggedInStaff]);

  const visibleParticipantIds = useMemo(() => new Set(participantsForView.map(p => p.id)), [participantsForView]);

  const workoutLogsForView = useMemo(() => workoutLogs.filter(log => visibleParticipantIds.has(log.participantId)), [workoutLogs, visibleParticipantIds]);
  const generalActivityLogsForView = useMemo(() => generalActivityLogs.filter(log => visibleParticipantIds.has(log.participantId)), [generalActivityLogs, visibleParticipantIds]);
  const goalCompletionLogsForView = useMemo(() => goalCompletionLogs.filter(log => visibleParticipantIds.has(log.participantId)), [goalCompletionLogs, visibleParticipantIds]);
  const participantGoalsForView = useMemo(() => participantGoals.filter(goal => visibleParticipantIds.has(goal.participantId)), [participantGoals, visibleParticipantIds]);
  const userStrengthStatsForView = useMemo(() => userStrengthStats.filter(stat => visibleParticipantIds.has(stat.participantId)), [userStrengthStats, visibleParticipantIds]);
  const clubMembershipsForView = useMemo(() => clubMemberships.filter(membership => visibleParticipantIds.has(membership.participantId)), [clubMemberships, visibleParticipantIds]);
  
  const oneOnOneSessionsForView = useMemo(() => {
    if (loggedInStaff?.role === 'Admin') {
      return oneOnOneSessions;
    }
    if (loggedInStaff?.role === 'Coach') {
        const coachSessionIds = new Set(oneOnOneSessions.filter(s => s.coachId === loggedInStaff.id).map(s => s.id));
        const memberSessionIds = new Set(oneOnOneSessions.filter(s => visibleParticipantIds.has(s.participantId)).map(s => s.id));
        const allVisibleSessionIds = new Set([...coachSessionIds, ...memberSessionIds]);
        return oneOnOneSessions.filter(s => allVisibleSessionIds.has(s.id));
    }
    return [];
  }, [oneOnOneSessions, loggedInStaff, visibleParticipantIds]);

  const coachNotesForView = useMemo(() => coachNotes.filter(note => visibleParticipantIds.has(note.participantId)), [coachNotes, visibleParticipantIds]);
  
  const allActivityLogsForView = useMemo(() => [...workoutLogsForView, ...generalActivityLogsForView, ...goalCompletionLogsForView], [workoutLogsForView, generalActivityLogsForView, goalCompletionLogsForView]);

  const getTabButtonStyle = (tabName: CoachTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };
    
  const handleSaveOrUpdateSession = (session: OneOnOneSession) => {
    setOneOnOneSessions(prev => {
        const index = prev.findIndex(s => s.id === session.id);
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

  const handleOpenMeetingModal = (session: OneOnOneSession) => {
    setSelectedSessionForModal(session);
    setIsMeetingModalOpen(true);
  };
  
  const handleOpenEditModal = (session: OneOnOneSession) => {
    setSessionToEdit(session);
    setInitialDateForBooking(null);
    setIsBookingModalOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setSessionToEdit(null);
    setInitialDateForBooking(date.toISOString().split('T')[0]);
    setIsBookingModalOpen(true);
  };
  
  const handleConfirmDeleteSession = () => {
    if (!sessionToDelete) return;
    setOneOnOneSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
    setSessionToDelete(null);
  };


  return (
    <div className="space-y-8">
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                {tabsToShow.map(tab => (
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
                    <EngagementOpportunities 
                        ai={ai}
                        participants={participantsForView}
                        workoutLogs={workoutLogsForView}
                        oneOnOneSessions={oneOnOneSessionsForView}
                    />
                    <MemberManagement 
                        participants={participantsForView}
                        setParticipants={setParticipantDirectory}
                        allParticipantGoals={participantGoalsForView}
                        setParticipantGoals={setParticipantGoals}
                        allActivityLogs={allActivityLogsForView}
                        coachNotes={coachNotesForView}
                        setCoachNotes={setCoachNotes}
                        ai={ai}
                        locations={locations}
                        memberships={memberships}
                        oneOnOneSessions={oneOnOneSessionsForView}
                        setOneOnOneSessions={setOneOnOneSessions}
                        staffMembers={staffMembers}
                        loggedInStaff={loggedInStaff}
                        setGoalCompletionLogs={setGoalCompletionLogs}
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        workoutCategories={workoutCategories}
                        staffAvailability={staffAvailability}
                    />
                </>
            )}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 'klientresan'}>
            {activeTab === 'klientresan' && loggedInStaff && (
                <ClientJourneyView
                    ai={ai}
                    participants={participantsForView}
                    allActivityLogs={allActivityLogsForView}
                    oneOnOneSessions={oneOnOneSessionsForView}
                    locations={locations}
                    staffMembers={staffMembers}
                    loggedInStaff={loggedInStaff}
                    allParticipantGoals={participantGoalsForView}
                    setParticipantGoals={setParticipantGoals}
                    setGoalCompletionLogs={setGoalCompletionLogs}
                    coachNotes={coachNotesForView}
                    setCoachNotes={setCoachNotes}
                    setOneOnOneSessions={setOneOnOneSessions}
                    workouts={workouts}
                    setWorkouts={setWorkouts}
                    workoutCategories={workoutCategories}
                    staffAvailability={staffAvailability}
                />
            )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'programs'}>
            {activeTab === 'programs' && (
                <WorkoutManagement 
                    workouts={workouts}
                    setWorkouts={setWorkouts}
                    ai={ai}
                    workoutCategories={workoutCategories}
                    participants={participantsForView}
                />
            )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'bookings'}>
            {activeTab === 'bookings' && loggedInStaff && (
              <div className="space-y-8">
                <ScheduleManagement 
                  schedules={groupClassSchedules}
                  setSchedules={setGroupClassSchedules}
                  classDefinitions={groupClassDefinitions}
                  locations={locations}
                  coaches={staffMembers}
                />
                <div className="pt-8 border-t">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">1-on-1 & Gruppass Kalender</h3>
                  <CalendarView 
                      sessions={oneOnOneSessionsForView}
                      participants={participantDirectory}
                      coaches={staffMembers}
                      onSessionClick={handleOpenMeetingModal}
                      onDayClick={handleDayClick}
                      onSessionEdit={handleOpenEditModal}
                      onSessionDelete={setSessionToDelete}
                      groupClassSchedules={groupClassSchedules}
                      groupClassDefinitions={groupClassDefinitions}
                      bookings={participantBookings}
                      onGroupClassClick={(instance) => setClassInstanceForCheckin(instance)}
                  />
                  <BookOneOnOneModal
                      isOpen={isBookingModalOpen}
                      onClose={() => { setIsBookingModalOpen(false); setSessionToEdit(null); setInitialDateForBooking(null); }}
                      onSave={handleSaveOrUpdateSession}
                      sessionToEdit={sessionToEdit}
                      participants={participantsForView}
                      coaches={staffMembers}
                      loggedInCoachId={loggedInStaff.id}
                      initialDate={initialDateForBooking}
                      staffAvailability={staffAvailability}
                  />
                  {selectedSessionForModal && (
                       <MeetingDetailsModal
                          isOpen={isMeetingModalOpen}
                          onClose={() => setIsMeetingModalOpen(false)}
                          session={selectedSessionForModal}
                          coach={loggedInStaff}
                          currentUserId={loggedInStaff.id}
                          onAddComment={onAddComment}
                          onDeleteComment={onDeleteComment}
                      />
                  )}
                  {classInstanceForCheckin && (
                      <ClassCheckinModal
                          isOpen={!!classInstanceForCheckin}
                          onClose={() => setClassInstanceForCheckin(null)}
                          classInstance={classInstanceForCheckin}
                          participants={participantDirectory}
                          onCheckIn={onCheckInParticipant}
                      />
                  )}
                  <ConfirmationModal
                      isOpen={!!sessionToDelete}
                      onClose={() => setSessionToDelete(null)}
                      onConfirm={handleConfirmDeleteSession}
                      title="Ta bort 1-on-1 Session"
                      message={`Är du säker på att du vill ta bort sessionen "${sessionToDelete?.title}" med ${participantDirectory.find(p => p.id === sessionToDelete?.participantId)?.name}? Detta kan inte ångras.`}
                      confirmButtonText="Ja, ta bort"
                  />
                </div>
              </div>
            )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'insights'}>
            {activeTab === 'insights' && (
                <>
                    <ParticipantActivityOverview 
                        workoutLogs={workoutLogsForView} 
                        workouts={workouts} 
                        ai={ai} 
                    />
                    <AIBusinessInsights
                        ai={ai}
                        locations={locations}
                        participants={participantsForView}
                        allActivityLogs={allActivityLogsForView}
                        workouts={workouts}
                        oneOnOneSessions={oneOnOneSessionsForView}
                        staffMembers={staffMembers}
                    />
                </>
            )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'leaderboards'}>
            {activeTab === 'leaderboards' && (
                <LeaderboardManagement
                  participants={participantsForView}
                  allActivityLogs={allActivityLogsForView}
                  workoutLogs={workoutLogsForView}
                  userStrengthStats={userStrengthStatsForView}
                  clubMemberships={clubMembershipsForView}
                  setClubMemberships={setClubMemberships}
                  leaderboardSettings={leaderboardSettings}
                  setLeaderboardSettings={setLeaderboardSettings}
                />
            )}
        </div>

         <div role="tabpanel" hidden={activeTab !== 'events'}>
            {activeTab === 'events' && (
                <EventManagement
                    events={coachEvents}
                    setEvents={setCoachEvents}
                    participants={participantDirectory}
                    workoutLogs={workoutLogs}
                    ai={ai}
                    weeklyHighlightSettings={weeklyHighlightSettings}
                    setWeeklyHighlightSettings={setWeeklyHighlightSettings}
                />
            )}
        </div>
         <div role="tabpanel" hidden={activeTab !== 'personal'}>
            {activeTab === 'personal' && loggedInStaff && (
                <StaffManagement
                    staff={staffMembers}
                    setStaff={setStaffMembers}
                    locations={locations}
                    availability={staffAvailability}
                    setAvailability={setStaffAvailability}
                    loggedInStaff={loggedInStaff}
                />
            )}
        </div>
        <div role="tabpanel" hidden={activeTab !== 'settings'}>
            {activeTab === 'settings' && (
                <SettingsManagement
                    locations={locations}
                    setLocations={setLocations}
                    memberships={memberships}
                    setMemberships={setMemberships}
                    workoutCategories={workoutCategories}
                    setWorkoutCategories={setWorkoutCategories}
                    workouts={workouts}
                    setWorkouts={setWorkouts}
                    participants={participantDirectory}
                    setParticipants={setParticipantDirectory}
                    integrationSettings={integrationSettings}
                    setIntegrationSettings={setIntegrationSettings}
                    loggedInStaff={loggedInStaff}
                />
            )}
        </div>
    </div>
  );
};