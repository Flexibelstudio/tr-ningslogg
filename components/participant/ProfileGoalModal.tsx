


import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ProfileGoalForm } from './ProfileGoalForm';
import { ParticipantProfile, ParticipantGoalData, GenderOption, ParticipantGamificationStats } from '../../types';

interface ProfileGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null; // This is the latest goal, used for pre-filling
  allParticipantGoals: ParticipantGoalData[]; // History of goals
  participantGamificationStats: ParticipantGamificationStats | null;
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; muscleMassKg?: number; fatMassKg?: number; inbodyScore?: number },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
    migratedWorkoutCount?: number
  ) => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>) => void;
}

export const ProfileGoalModal: React.FC<ProfileGoalModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  currentGoalForForm,
  allParticipantGoals,
  participantGamificationStats,
  onSave,
  onTriggerAiGoalPrognosis,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil & Mål" size="xl">
      {/* The ProfileGoalForm has its own Save/Cancel buttons which will call onSave/onCancel props */}
      <div className="min-h-[60vh] max-h-[80vh] overflow-y-auto pr-2 -mr-2">
        <ProfileGoalForm
          currentProfile={currentProfile}
          currentGoalForForm={currentGoalForForm}
          allParticipantGoals={allParticipantGoals}
          participantGamificationStats={participantGamificationStats}
          onSave={onSave} // This onSave from props handles data persistence & modal closing
          onCancel={onClose} // Form's cancel button closes this modal
          onTriggerAiGoalPrognosis={onTriggerAiGoalPrognosis}
        />
      </div>
    </Modal>
  );
};