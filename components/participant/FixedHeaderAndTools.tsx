
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '../Button';
import { StrengthComparisonModal } from './StrengthComparisonModal';
import { ConditioningStatsModal } from './ConditioningStatsModal';
import { 
    ParticipantProfile, ParticipantGoalData, UserStrengthStat, 
    ParticipantConditioningStats, ParticipantMentalWellbeing,
    GenderOption, UserRole
} from '../../types';
import { FLEXIBEL_PRIMARY_COLOR, APP_NAME } from '../../constants';
import { ProfileGoalModal } from './ProfileGoalModal'; 

// Icons for tabs/buttons
const ProfileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" /></svg>;
const StrengthIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.5 2.028A1 1 0 0010.5 1h-1A1 1 0 008.5 2.028v2.944A6.974 6.974 0 004 11.532V14a1 1 0 001 1h10a1 1 0 001-1v-2.468A6.974 6.974 0 0011.5 4.972V2.028zM10 16a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" /><path d="M10 13a1 1 0 100-2 1 1 0 000 2z" /></svg>;
const ConditioningIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>;

const AiCoachIcon = () => ( // Renamed from AiFeedbackIcon and new SVG
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.832 8.832 0 01-4.303-1.22A.752.752 0 015 15.247V17a1 1 0 001.624.78L9.049 15.5A7.002 7.002 0 0018 10zm-4.75-2.175a.511.511 0 00-.736-.098l-.004.003-.002.002a2.213 2.213 0 00-.022.018 2.206 2.206 0 00-3.35 1.135 2.206 2.206 0 001.074 2.802c.08.04.162.076.246.107l.004.001.01.003c.094.032.19.06.287.085l.01.002c.11.026.222.046.336.06l.012.001c.125.013.25.02.376.02a2.198 2.198 0 002.022-1.396 2.207 2.207 0 00-1.04-2.827.568.568 0 00-.191-.073zm-2.122 1.35a.75.75 0 10-1.06 1.06.75.75 0 001.06-1.06zM11.977 6.3a.5.5 0 01.5-.5h.046a.5.5 0 01.5.5v.046a.5.5 0 01-.5.5h-.046a.5.5 0 01-.5-.5v-.046zm1.503 1.488a.5.5 0 00-.707 0l-.046.046a.5.5 0 000 .707l.046.046a.5.5 0 00.707 0l.046-.046a.5.5 0 000-.707l-.046-.046zM9.523 6.3a.5.5 0 01.5-.5h.046a.5.5 0 01.5.5v.046a.5.5 0 01-.5.5h-.046a.5.5 0 01-.5-.5v-.046zm1.503 1.488a.5.5 0 00-.707 0l-.046.046a.5.5 0 000 .707l.046.046a.5.5 0 00.707 0l.046-.046a.5.5 0 000-.707l-.046-.046z" clipRule="evenodd" />
    <path d="M7 1a3.5 3.5 0 104.083 3.393.5.5 0 00-.867-.497L10 1.637A2.5 2.5 0 117 1zM4.015 3.38A2.53 2.53 0 013.5 1a2.5 2.5 0 012.215 3.597.5.5 0 00.283.486l.002.001.004.002.006.002.008.003.01.003.013.003.015.003.017.003.018.003a2.494 2.494 0 011.89.027l.019-.003.017-.003.015-.003.013-.003.01-.003.008-.003.006-.002.004-.002.002-.001a.5.5 0 00.283-.486A2.5 2.5 0 017 1a2.53 2.53 0 01-.515 2.38z" />
  </svg>
);

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
  userConditioningStats: ParticipantConditioningStats | null;
  onSaveProfileAndGoals: (profileData: ParticipantProfile, goalData: Omit<ParticipantGoalData, 'id' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>, markLatestGoalAsCompleted: boolean) => void;
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
  onSaveConditioningStats: (stats: ParticipantConditioningStats) => void;
  onSaveMentalWellbeing: (wellbeingData: ParticipantMentalWellbeing) => void; // Prop is kept for other potential uses, even if button is removed
  onTriggerAiProgressFeedback: () => void;
  onTriggerAiGoalPrognosis: () => void; 
  mainContentRef: React.RefObject<HTMLDivElement>; 
  currentRole: UserRole | null; 
  onSetRole: (role: UserRole | null) => void; 
}

export const FixedHeaderAndTools: React.FC<FixedHeaderAndToolsProps> = ({
  participantProfile,
  latestGoal,
  allParticipantGoals,
  userStrengthStats,
  userConditioningStats,
  onSaveProfileAndGoals,
  onSaveStrengthStats,
  onSaveConditioningStats,
  onSaveMentalWellbeing,
  onTriggerAiProgressFeedback,
  onTriggerAiGoalPrognosis, 
  mainContentRef, 
  currentRole,
  onSetRole,
}) => {
  const [isProfileGoalModalOpen, setIsProfileGoalModalOpen] = useState(false);
  const [isStrengthModalOpen, setIsStrengthModalOpen] = useState(false);
  const [isConditioningModalOpen, setIsConditioningModalOpen] = useState(false);


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

  return (
    <>
      <div className="sticky top-0 z-30 bg-white shadow-md">
        {/* Top Row: Title, Welcome, Actions */}
        <div className="container mx-auto px-2 py-3 flex flex-wrap items-center justify-between gap-y-2 border-b">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
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
              title={!API_KEY_AVAILABLE ? "API-nyckel saknas för AI" : "AI-coach för din progress"}
              className="flex items-center"
            >
              <span className="mr-1.5">Feedback</span>
              <span className="hidden sm:inline">AI-coach</span>
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
              className="flex items-center flex-shrink-0"
              title="Visa och redigera din profil och dina mål"
            >
              <ProfileIcon /> Profil & Mål
            </Button>
           <Button
              onClick={() => setIsStrengthModalOpen(true)}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0"
              title="Visa och redigera din styrka"
            >
              <StrengthIcon /> Styrka
            </Button>
            <Button
              onClick={() => setIsConditioningModalOpen(true)}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0"
              title="Visa och redigera din kondition"
            >
              <ConditioningIcon /> Kondition
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
          onSave={(profileDataFromForm, goalDataFromForm, markLatestGoalAsCompleted, noGoalAdviseOptOutIgnored) => {
            const newProfile: ParticipantProfile = {
              id: participantProfile?.id || crypto.randomUUID(),
              name: profileDataFromForm.name,
              age: profileDataFromForm.age,
              gender: profileDataFromForm.gender,
              muscleMassKg: profileDataFromForm.muscleMassKg,
              fatMassKg: profileDataFromForm.fatMassKg,
              inbodyScore: profileDataFromForm.inbodyScore,
              lastUpdated: new Date().toISOString(),
            };
            
            // goalDataFromForm now includes targetDate
            onSaveProfileAndGoals(newProfile, goalDataFromForm, markLatestGoalAsCompleted);
            setIsProfileGoalModalOpen(false);
          }}
          onTriggerAiGoalPrognosis={onTriggerAiGoalPrognosis}
        />
      )}

      {/* Strength Modal */}
      {isStrengthModalOpen && (
        <StrengthComparisonModal
          isOpen={isStrengthModalOpen}
          onClose={() => setIsStrengthModalOpen(false)}
          participantProfile={participantProfile}
          latestGoal={latestGoal}
          userStrengthStatsHistory={userStrengthStats}
          onSaveStrengthStats={onSaveStrengthStats}
        />
      )}

      {/* Conditioning Modal */}
      {isConditioningModalOpen && (
        <ConditioningStatsModal
          isOpen={isConditioningModalOpen}
          onClose={() => setIsConditioningModalOpen(false)}
          currentStats={userConditioningStats}
          participantId={participantProfile?.id}
          onSaveStats={onSaveConditioningStats}
        />
      )}
    </>
  );
};