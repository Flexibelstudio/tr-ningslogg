import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantGoalData } from '../../types';
import { GoalForm, GoalFormRef } from './GoalForm';
import { ConfirmationModal } from '../ConfirmationModal';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  onSave: (
    goalData: {
      fitnessGoals: string;
      workoutsPerWeekTarget: number;
      preferences?: string;
      targetDate?: string;
      coachPrescription?: string;
    },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean
  ) => Promise<void>;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>) => Promise<void>;
  isOnline: boolean;
}

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose, currentGoalForForm, allParticipantGoals, onSave, onTriggerAiGoalPrognosis, isOnline }) => {
  const formRef = useRef<GoalFormRef>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
      setIsConfirmOpen(false);
    }
  }, [isOpen]);

  const proceedToSave = async () => {
    if (formRef.current) {
      setIsSaving(true);
      setHasSaved(false);
      const savedSuccessfully = await formRef.current.submitForm();
      if (savedSuccessfully) {
        setHasSaved(true);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setIsSaving(false);
      }
    }
  };

  const handleSaveAndClose = async () => {
    if (formRef.current) {
      const formData = formRef.current.getFormData();

      const hasChanges = currentGoalForForm
        ? formData.fitnessGoals !== (currentGoalForForm.fitnessGoals || '') ||
          formData.workoutsPerWeekTarget !== currentGoalForForm.workoutsPerWeekTarget ||
          (formData.targetDate || '') !== (currentGoalForForm.targetDate || '') ||
          (formData.preferences || '') !== (currentGoalForForm.preferences || '')
        : true;

      const isOverwriting = currentGoalForForm && !currentGoalForForm.isCompleted && !formData.markGoalCompleted && hasChanges && formData.fitnessGoals !== 'Inga specifika mål satta';

      if (isOverwriting) {
        setIsConfirmOpen(true);
      } else {
        await proceedToSave();
      }
    }
  };

  const handleConfirmOverwrite = async () => {
    setIsConfirmOpen(false);
    await proceedToSave();
  };

  if (!isOpen) return null;

  const modalTitle = 'Mål & Plan';

  let saveButtonText = 'Spara Mål & Plan';
  if (isSaving && !hasSaved) saveButtonText = 'Sparar...';
  if (hasSaved) saveButtonText = 'Sparat! ✓';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl">
      <div>
        {currentGoalForForm && currentGoalForForm.fitnessGoals !== 'Inga specifika mål satta' && (
          <div className="mb-6 p-4 bg-violet-50 border border-violet-200 rounded-lg animate-fade-in-down">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Din Aktuella Plan</h3>
            <p className="text-base text-gray-700">
              <strong>Mål:</strong> {currentGoalForForm.fitnessGoals}
            </p>
            {currentGoalForForm.coachPrescription && (
              <div className="mt-3 pt-3 border-t border-violet-200">
                <h4 className="text-lg font-semibold text-violet-700">Coach Recept:</h4>
                <p className="text-base text-gray-700 italic mt-1 whitespace-pre-wrap">"{currentGoalForForm.coachPrescription}"</p>
              </div>
            )}
          </div>
        )}
        <GoalForm ref={formRef} currentGoalForForm={currentGoalForForm} allParticipantGoals={allParticipantGoals} onSave={onSave} onTriggerAiGoalPrognosis={onTriggerAiGoalPrognosis} isOnline={isOnline} />
        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>
            Avbryt
          </Button>
          <Button onClick={handleSaveAndClose} variant="primary" disabled={isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmOverwrite}
        title="Ersätta aktivt mål?"
        message="Du har ett aktivt mål som inte är slutfört. Om du sparar ett nytt mål kommer det gamla att arkiveras som ej uppnått. Vill du fortsätta?"
        confirmButtonText="Ja, ersätt och spara"
        cancelButtonText="Avbryt"
      />
    </Modal>
  );
};
