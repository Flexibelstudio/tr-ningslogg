
import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ConditioningStatsForm, ConditioningStatsFormRef } from './ConditioningStatsForm';
import { ParticipantConditioningStats } from '../../types';

interface ConditioningStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStats: ParticipantConditioningStats | null;
  participantId: string | undefined;
  onSaveStats: (statsData: ParticipantConditioningStats) => void;
}

export const ConditioningStatsModal: React.FC<ConditioningStatsModalProps> = ({
  isOpen,
  onClose,
  currentStats,
  participantId,
  onSaveStats,
}) => {
  const formRef = useRef<ConditioningStatsFormRef>(null);
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

  if (!isOpen) {
    return null;
  }

  let saveButtonText = "Spara Kondition";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Min Kondition" size="lg">
      <div className="flex flex-col min-h-[50vh]">
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
          <ConditioningStatsForm
            ref={formRef}
            currentStats={currentStats}
            onSaveStats={onSaveStats}
            participantId={participantId}
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>
            Avbryt
          </Button>
          <Button onClick={handleSaveAndClose} variant="primary" disabled={isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
