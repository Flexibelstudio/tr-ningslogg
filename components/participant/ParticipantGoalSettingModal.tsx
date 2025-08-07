import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantGoalData } from '../../types';
import { GoalForm, GoalFormRef } from './GoalForm';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  onSave: (
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
  ) => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>) => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  currentGoalForForm,
  allParticipantGoals,
  onSave,
  onTriggerAiGoalPrognosis,
}) => {
  const formRef = useRef<GoalFormRef>(null);
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

  const modalTitle = "Mål & Plan";

  let saveButtonText = "Spara Mål & Plan";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl">
      <div>
        {currentGoalForForm && currentGoalForForm.fitnessGoals !== "Inga specifika mål satta" && (
            <div className="mb-6 p-4 bg-violet-50 border border-violet-200 rounded-lg animate-fade-in-down">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Din Aktuella Plan</h3>
                <p className="text-base text-gray-700"><strong>Mål:</strong> {currentGoalForForm.fitnessGoals}</p>
                {currentGoalForForm.coachPrescription && (
                    <div className="mt-3 pt-3 border-t border-violet-200">
                        <h4 className="text-lg font-semibold text-violet-700">Coach Recept:</h4>
                        <p className="text-base text-gray-700 italic mt-1 whitespace-pre-wrap">"{currentGoalForForm.coachPrescription}"</p>
                    </div>
                )}
            </div>
        )}
        <GoalForm
          ref={formRef}
          currentGoalForForm={currentGoalForForm}
          allParticipantGoals={allParticipantGoals}
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
