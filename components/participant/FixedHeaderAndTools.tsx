import React, { useState, useCallback, useRef } from 'react';
import { Button } from '../Button';
import { StrengthComparisonModal } from './StrengthComparisonModal';
import { ConditioningStatsModal } from './ConditioningStatsModal';
import { 
    ParticipantProfile, ParticipantGoalData, UserStrengthStat, 
    ParticipantConditioningStat, ParticipantMentalWellbeing,
    GenderOption, UserRole,
    ParticipantGamificationStats,
    ParticipantClubMembership,
    LeaderboardSettings,
    Workout,
    WorkoutLog,
    GeneralActivityLog,
    GoalCompletionLog,
    CoachEvent,
    Connection,
    Reaction,
    Comment,
    ParticipantPhysiqueStat,
} from '../../types';
import { FLEXIBEL_PRIMARY_COLOR, APP_NAME } from '../../constants';
import { ProfileModal } from './ProfileGoalModal';
import { GoalModal } from './ParticipantGoalSettingModal';
import { FlowModal } from './FlowModal';
import { Avatar } from '../Avatar';

// SVG Icons for a more professional look
const GoalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5l-7.5 7.5-3.5-3.5" /></svg>;
const PersonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const FlowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const CommunityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const AiReceptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;


const ChangeAccountIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 inline" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);


interface FixedHeaderAndToolsProps {
  participantProfile: ParticipantProfile | null;
  onOpenProfileModal: () => void;
  onOpenGoalModal: () => void;
  currentRole: UserRole | null; 
  onSetRole: (role: UserRole | null) => void;
  onTriggerAiProgressFeedback: () => void;
  onOpenCommunity: () => void;
  aiRecept?: string | null;
  onOpenAiRecept: () => void;
  
  // For FlowModal and notifications
  newFlowItemsCount: number;
  pendingRequestsCount: number;
  onViewFlow: () => void;
  currentUserId: string;
  allParticipants: ParticipantProfile[];
  connections: Connection[];
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  coachEvents: CoachEvent[];
  participantGoals: ParticipantGoalData[];
  participantPhysiqueHistory: ParticipantPhysiqueStat[];
  clubMemberships: ParticipantClubMembership[];
  userStrengthStats: UserStrengthStat[];
  leaderboardSettings: LeaderboardSettings;
  onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  latestGoal: ParticipantGoalData | null; // Added for streak display
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
}

export const FixedHeaderAndTools: React.FC<FixedHeaderAndToolsProps> = ({
  participantProfile,
  onOpenProfileModal,
  onOpenGoalModal,
  currentRole,
  onSetRole,
  onTriggerAiProgressFeedback,
  onOpenCommunity,
  aiRecept,
  onOpenAiRecept,
  newFlowItemsCount,
  pendingRequestsCount,
  onViewFlow,
  currentUserId,
  allParticipants,
  connections,
  workouts,
  workoutLogs,
  generalActivityLogs,
  goalCompletionLogs,
  coachEvents,
  participantGoals,
  participantPhysiqueHistory,
  clubMemberships,
  userStrengthStats,
  leaderboardSettings,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  latestGoal,
  isStaffViewingSelf,
  onSwitchToStaffView,
}) => {
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  
  const API_KEY_AVAILABLE = process.env.API_KEY;

  const handleOpenFlowModal = () => {
    onViewFlow();
    setIsFlowModalOpen(true);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) {
        return "God morgon";
    }
    if (hour < 18) {
        return "God dag";
    }
    return "God kväll";
  };
  
  const areChallengesActive = leaderboardSettings.weeklyPBChallengeEnabled && leaderboardSettings.weeklySessionChallengeEnabled;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white shadow-md">
        {/* Top Row: Title, Welcome, Actions */}
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-4">
            <Avatar name={participantProfile?.name} photoURL={participantProfile?.photoURL} size="md" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                {getGreeting()}{participantProfile?.name ? `, ${participantProfile.name.split(' ')[0]}!` : '!'}
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isStaffViewingSelf && currentRole === UserRole.PARTICIPANT && (
                <Button 
                    onClick={() => onSetRole(null)} 
                    variant="secondary" 
                    size="sm" 
                    className="flex items-center"
                    title="Byt till coach-vy eller välj om användarkonto"
                >
                  <ChangeAccountIcon/>
                  <span className="hidden sm:inline">Byt konto</span>
                </Button>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="container mx-auto px-2 py-1 flex justify-around items-center border-t border-gray-200">
            <Button
              onClick={onOpenProfileModal}
              variant='ghost'
              size="sm"
              className="flex flex-col items-center h-auto p-2 text-gray-600 hover:text-flexibel"
              title="Min Profil"
              aria-label="Min Profil"
            >
              <PersonIcon />
              <span className="text-xs mt-1 font-semibold">Profil</span>
            </Button>
             <Button
              onClick={onOpenGoalModal}
              variant='ghost'
              size="sm"
              className="flex flex-col items-center h-auto p-2 text-gray-600 hover:text-flexibel"
              title="Mål & Plan"
              aria-label="Mål & Plan"
            >
              <GoalIcon />
              <span className="text-xs mt-1 font-semibold">Mål</span>
            </Button>
            {aiRecept && (
              <Button
                onClick={onOpenAiRecept}
                variant='ghost'
                size="sm"
                className="flex flex-col items-center h-auto p-2 text-gray-600 hover:text-flexibel"
                title="Coachens tips för att du ska nå ditt mål"
                aria-label="Coachens tips för att du ska nå ditt mål"
              >
                <AiReceptIcon />
                <span className="text-xs mt-1 font-semibold">Recept</span>
              </Button>
            )}
            <Button
              onClick={handleOpenFlowModal}
              variant='ghost'
              size="sm"
              className="relative flex flex-col items-center h-auto p-2 text-gray-600 hover:text-flexibel"
              title="Flöde"
              aria-label="Flöde"
            >
                <FlowIcon />
                <span className="text-xs mt-1 font-semibold">Flöde</span>
                {newFlowItemsCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {newFlowItemsCount}
                    </span>
                )}
            </Button>
           <Button
              onClick={onOpenCommunity}
              variant='ghost'
              size="sm"
              className="relative flex flex-col items-center h-auto p-2 text-gray-600 hover:text-flexibel"
              title="Community"
              aria-label="Community"
            >
              <CommunityIcon />
              <span className="text-xs mt-1 font-semibold">Community</span>
              {pendingRequestsCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingRequestsCount}
                  </span>
              )}
            </Button>
        </div>
      </header>
      <FlowModal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        currentUserId={currentUserId}
        allParticipants={allParticipants}
        connections={connections}
        workouts={workouts}
        workoutLogs={workoutLogs}
        generalActivityLogs={generalActivityLogs}
        goalCompletionLogs={goalCompletionLogs}
        coachEvents={coachEvents}
        participantGoals={participantGoals}
        participantPhysiqueHistory={participantPhysiqueHistory}
        clubMemberships={clubMemberships}
        userStrengthStats={userStrengthStats}
        leaderboardSettings={leaderboardSettings}
        onToggleReaction={onToggleReaction}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
      />
    </>
  );
};