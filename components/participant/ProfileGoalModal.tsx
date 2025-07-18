

import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ProfileGoalForm, ProfileGoalFormRef } from './ProfileGoalForm';
import { ParticipantProfile, ParticipantGoalData, GenderOption, ParticipantGamificationStats } from '../../types';

interface ProfileGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null; // This is the latest goal, used for pre-filling
  allParticipantGoals: ParticipantGoalData[]; // History of goals
  participantGamificationStats: ParticipantGamificationStats | null;
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; enableLeaderboardParticipation?: boolean; },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
    migratedWorkoutCount?: number
  ) => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>) => void;
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
  const formRef = useRef<ProfileGoalFormRef>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
    }
  }, [isOpen]);

  const handleSaveAndClose = () => {
    if (formRef.current) {
      setIsSaving(true);
      setHasSaved(false);
      const savedSuccessfully = formRef.current.submitForm();
      if (savedSuccessfully) {
        setHasSaved(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setIsSaving(false);
      }
    }
  };

  if (!isOpen) return null;

  const isProfileIncomplete = !currentProfile || !currentProfile.age || !currentProfile.gender || currentProfile.gender === '-';
  const modalTitle = isProfileIncomplete ? "Slutför Din Profil" : "Profil & Mål";

  let saveButtonText = "Spara Profil & Mål";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl">
      <div>
        {isProfileIncomplete && (
          <div className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800" role="alert">
              <p className="font-bold">Viktigt!</p>
              <p>För att appen ska fungera optimalt och ge dig korrekta jämförelser, vänligen fyll i din <strong className="font-semibold">Ålder</strong> och ditt <strong className="font-semibold">Kön</strong>.</p>
          </div>
        )}
        <ProfileGoalForm
          ref={formRef}
          currentProfile={currentProfile}
          currentGoalForForm={currentGoalForForm}
          allParticipantGoals={allParticipantGoals}
          participantGamificationStats={participantGamificationStats}
          onSave={onSave}
          onTriggerAiGoalPrognosis={onTriggerAiGoalPrognosis}
        />
        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
          <Button onClick={handleSaveAndClose} variant="primary" disabled={isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};