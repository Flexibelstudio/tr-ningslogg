

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '../Button';
// ProfileGoalForm will be rendered inside ProfileGoalModal
import { PhysiqueManagerModal } from './PhysiqueManagerModal'; 
import { 
    ParticipantProfile, ParticipantGoalData, UserStrengthStats, 
    ParticipantConditioningStats, ParticipantMentalWellbeing, // Added ParticipantMentalWellbeing
    GenderOption, UserRole
} from '../../types';
import { GoogleGenAI } from "@google/genai";
import { FLEXIBEL_PRIMARY_COLOR, APP_NAME } from '../../constants';
import { ProfileGoalModal } from './ProfileGoalModal'; 
import { MentalWellbeingModal } from './MentalWellbeingModal'; // New import

// Icons for tabs/buttons
const ProfileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" /></svg>;
const PhysiqueIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11h14v7H2v-7zm0-9h3v5H2V2zm4 0h3v2H6V2zm4 0h3v3h-3V2zM2 0h14a2 2 0 012 2v14a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z"/></svg>; 
const MentalWellbeingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.53l.79.79A5.047 5.047 0 0010 4a5.047 5.047 0 00-.79.32L10 3.53zM12.68 5.71A5.024 5.024 0 0010 5a5.023 5.023 0 00-2.68.71L10 8.41l2.68-2.7zM6 8a4 4 0 014-4 .5.5 0 010 1A3 3 0 007 8a.5.5 0 01-1 0zm8 0a.5.5 0 01-1 0A3 3 0 0013 5a.5.5 0 010-1 4 4 0 014 4zM4.21 5.71A5.024 5.024 0 007.32 5a5.023 5.023 0 002.68.71L7.29 8.41 4.21 5.71zM10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" /></svg>;

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
  userStrengthStats: UserStrengthStats | null;
  userConditioningStats: ParticipantConditioningStats | null;
  participantMentalWellbeing: ParticipantMentalWellbeing | null; // New prop
  ai: GoogleGenAI | null;
  onSaveProfileAndGoals: (profileData: ParticipantProfile, goalData: ParticipantGoalData) => void;
  onSaveStrengthStats: (stats: UserStrengthStats) => void;
  onSaveConditioningStats: (stats: ParticipantConditioningStats) => void;
  onSaveMentalWellbeing: (wellbeingData: ParticipantMentalWellbeing) => void; // New prop
  onTriggerAiProgressFeedback: () => void;
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
  participantMentalWellbeing, // Destructure new prop
  ai,
  onSaveProfileAndGoals,
  onSaveStrengthStats,
  onSaveConditioningStats,
  onSaveMentalWellbeing, // Destructure new prop
  onTriggerAiProgressFeedback,
  mainContentRef, 
  currentRole,
  onSetRole,
}) => {
  const [isProfileGoalModalOpen, setIsProfileGoalModalOpen] = useState(false);
  const [isPhysiqueModalOpen, setIsPhysiqueModalOpen] = useState(false);
  const [isMentalWellbeingModalOpen, setIsMentalWellbeingModalOpen] = useState(false); // New state

  const API_KEY_AVAILABLE = process.env.API_KEY;

  return (
    <>
      <div className="sticky top-0 z-30 bg-white shadow-md">
        {/* Top Row: Title, Welcome, Actions */}
        <div className="container mx-auto px-2 py-3 flex flex-wrap items-center justify-between gap-y-2 border-b">
          <div className="flex items-baseline space-x-3">
            <h1 className="text-2xl font-bold" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
              {APP_NAME}
            </h1>
            <div className="hidden sm:block">
              {participantProfile?.name && (
                <span className="text-base text-gray-700">Välkommen, {participantProfile.name}!</span>
              )}
              {latestGoal?.currentWeeklyStreak !== undefined && latestGoal.currentWeeklyStreak > 0 && (
                <span className="text-sm text-yellow-600 ml-2">
                  Streak: {latestGoal.currentWeeklyStreak}v 🔥
                </span>
              )}
               {(participantProfile?.name || latestGoal?.currentWeeklyStreak) ? null : 
                <span className="text-sm text-gray-500">(Sätt mål för streak!)</span>
               }
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={onTriggerAiProgressFeedback}
              variant="outline"
              size="sm"
              disabled={!ai || !API_KEY_AVAILABLE}
              title={!API_KEY_AVAILABLE ? "API-nyckel saknas för AI" : "AI-coach för din progress"}
              className="flex items-center"
            >
              <span className="mr-1.5">Coachtips</span>
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
        <div className="container mx-auto px-1 py-2 flex justify-start sm:justify-around items-center space-x-1 sm:space-x-2 overflow-x-auto whitespace-nowrap">
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
              onClick={() => setIsPhysiqueModalOpen(true)}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0"
              title="Visa och redigera din fysik (styrka & kondition)"
            >
              <PhysiqueIcon /> Fysik
            </Button>
            <Button
              onClick={() => setIsMentalWellbeingModalOpen(true)}
              variant='ghost'
              size="sm"
              className="flex items-center flex-shrink-0"
              title="Logga och reflektera över ditt mentala välbefinnande"
            >
              <MentalWellbeingIcon /> Mentalt
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
          onSave={(profileData, goalData, preferencesLegacy, noGoalAdviseOptOut) => {
            const newProfile: ParticipantProfile = {
              id: participantProfile?.id || crypto.randomUUID(),
              name: profileData.name,
              age: profileData.age,
              gender: profileData.gender,
              muscleMassKg: profileData.muscleMassKg,
              fatMassKg: profileData.fatMassKg,
              inbodyScore: profileData.inbodyScore,
              lastUpdated: new Date().toISOString(),
            };

            const newGoal: ParticipantGoalData = {
              id: crypto.randomUUID(), // Always create a new goal entry
              fitnessGoals: goalData.fitnessGoals,
              workoutsPerWeekTarget: goalData.workoutsPerWeekTarget,
              preferences: goalData.preferences,
              currentWeeklyStreak: 0, // New goal entries start with a fresh streak context
              lastStreakUpdateEpochWeekId: '', // Streak calculation will handle this
              setDate: new Date().toISOString(),
            };
            onSaveProfileAndGoals(newProfile, newGoal);
            setIsProfileGoalModalOpen(false);
          }}
        />
      )}

      {/* Physique Manager Modal */}
      {isPhysiqueModalOpen && (
        <PhysiqueManagerModal
          isOpen={isPhysiqueModalOpen}
          onClose={() => setIsPhysiqueModalOpen(false)}
          participantProfile={participantProfile}
          latestGoal={latestGoal}
          userStrengthStats={userStrengthStats}
          userConditioningStats={userConditioningStats}
          onSaveStrengthStats={onSaveStrengthStats}
          onSaveConditioningStats={onSaveConditioningStats}
        />
      )}

      {/* Mental Wellbeing Modal */}
      {isMentalWellbeingModalOpen && (
        <MentalWellbeingModal
          isOpen={isMentalWellbeingModalOpen}
          onClose={() => setIsMentalWellbeingModalOpen(false)}
          currentWellbeing={participantMentalWellbeing}
          participantId={participantProfile?.id}
          onSave={onSaveMentalWellbeing}
        />
      )}
    </>
  );
};
