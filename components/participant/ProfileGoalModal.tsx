
import React from 'react';
import { Modal } from '../Modal';
import { ProfileGoalForm } from './ProfileGoalForm';
import { ParticipantProfile, ParticipantGoalData, GenderOption } from '../../types';

interface ProfileGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null; // This is the latest goal, used for pre-filling
  allParticipantGoals: ParticipantGoalData[]; // History of goals
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; muscleMassKg?: number; fatMassKg?: number; inbodyScore?: number },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; },
    preferencesLegacy: string, // Kept for signature compatibility if form still uses it
    noGoalAdviseOptOut: boolean
  ) => void;
}

export const ProfileGoalModal: React.FC<ProfileGoalModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  currentGoalForForm,
  allParticipantGoals,
  onSave,
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
          onSave={onSave} // This onSave from props handles data persistence & modal closing
          onCancel={onClose} // Form's cancel button closes this modal
        />
      </div>
    </Modal>
  );
};
