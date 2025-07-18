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
    LeaderboardSettings
} from '../../types';
import { FLEXIBEL_PRIMARY_COLOR, APP_NAME } from '../../constants';
import { ProfileGoalModal } from './ProfileGoalModal'; 

// Icons for tabs/buttons
const ProfileIcon = () => <span className="text-xl mr-1.5" role="img" aria-label="Profil & Mål">🎯</span>;
const TrophyIcon = ({ className }: { className?: string }) => <span className={`text-xl mr-1.5 ${className || ''}`} role="img" aria-label="Topplistor">🏆</span>;


const ChangeAccountIcon = () => ( // Renamed from ChangeRoleIcon and new SVG
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 inline" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);


interface FixedHeaderAndToolsProps {
  participantProfile: ParticipantProfile | null;
  latestGoal: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  userStrengthStats: UserStrengthStat[];
  userConditioningStatsHistory: ParticipantConditioningStat[];
  participantGamificationStats: ParticipantGamificationStats | null;
  clubMemberships: ParticipantClubMembership[];
  onSaveProfileAndGoals: (profileData: Partial<ParticipantProfile>, goalData: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>, markLatestGoalAsCompleted: boolean, noGoalAdviseOptOut: boolean, migratedWorkoutCount?: number) => void;
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
  onSaveConditioningStats: (stats: ParticipantConditioningStat) => void;
  onSaveMentalWellbeing: (wellbeingData: ParticipantMentalWellbeing) => void; // Prop is kept for other potential uses, even if button is removed
  onTriggerAiProgressFeedback: () => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>) => void;
  mainContentRef: React.RefObject<HTMLDivElement>; 
  currentRole: UserRole | null; 
  onSetRole: (role: UserRole | null) => void;
  leaderboardSettings: LeaderboardSettings;
  onOpenLeaderboard: () => void;
}

export const FixedHeaderAndTools: React.FC<FixedHeaderAndToolsProps> = ({
  participantProfile,
  latestGoal,
  allParticipantGoals,
  userStrengthStats,
  userConditioningStatsHistory,
  participantGamificationStats,
  clubMemberships,
  onSaveProfileAndGoals,
  onSaveStrengthStats,
  onSaveConditioningStats,
  onSaveMentalWellbeing,
  onTriggerAiProgressFeedback,
  onTriggerAiGoalPrognosis, 
  mainContentRef, 
  currentRole,
  onSetRole,
  leaderboardSettings,
  onOpenLeaderboard
}) => {
  const [isProfileGoalModalOpen, setIsProfileGoalModalOpen] = useState(false);
  
  const API_KEY_AVAILABLE = process.env.API_KEY;

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
      <div className="sticky top-0 z-30 bg-white shadow-md">
        {/* Top Row: Title, Welcome, Actions */}
        <div className="container mx-auto px-2 py-3 flex flex-wrap items-center justify-between gap-y-2 border-b">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {getGreeting()}{participantProfile?.name ? `, ${participantProfile.name.split(' ')[0]}!` : '!'}
            </h1>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
                
                {latestGoal?.currentWeeklyStreak !== undefined && latestGoal.currentWeeklyStreak > 0 && (
                    <>
                        
                        <span className="text-yellow-600 font-semibold">
                            Streak: {latestGoal.currentWeeklyStreak}v 🔥
                        </span>
                    </>
                )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={onTriggerAiProgressFeedback}
              variant="outline"
              size="sm"
              disabled={!API_KEY_AVAILABLE}
              title={!API_KEY_AVAILABLE ? "API-nyckel saknas för AI" : "Få feedback på din progress"}
              className="flex items-center"
            >
              Feedback
            </Button>
            {currentRole === UserRole.PARTICIPANT && (
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
        <div className="container mx-auto px-1 py-2 flex justify-start sm:justify-around items-center space-x-0 sm:space-x-1 overflow-x-auto whitespace-nowrap">
            <Button
              onClick={() => setIsProfileGoalModalOpen(true)}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0 text-lg"
              title="Visa och redigera din profil och dina mål"
            >
              <ProfileIcon /> Profil & Mål
            </Button>
           <Button
              onClick={onOpenLeaderboard}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0 text-lg"
              title="Visa topplistor och utmaningar"
            >
              <TrophyIcon className={areChallengesActive ? 'animate-pulse-icon' : ''} /> Topplistor
            </Button>
        </div>
      </div>

      {/* Profile & Goals Modal */}
      {isProfileGoalModalOpen && (
        <ProfileGoalModal
          isOpen={isProfileGoalModalOpen}
          onClose={() => setIsProfileGoalModalOpen(false)}
          currentProfile={participantProfile}
          currentGoalForForm={latestGoal}
          allParticipantGoals={allParticipantGoals}
          participantGamificationStats={participantGamificationStats}
          onSave={(profileDataFromForm, goalDataFromForm, markLatestGoalAsCompleted, noGoalAdviseOptOut, migratedWorkoutCount) => {
            onSaveProfileAndGoals(profileDataFromForm, goalDataFromForm, markLatestGoalAsCompleted, noGoalAdviseOptOut, migratedWorkoutCount);
            setIsProfileGoalModalOpen(false);
          }}
          onTriggerAiGoalPrognosis={onTriggerAiGoalPrognosis}
        />
      )}
    </>
  );
};