
import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { StrengthComparisonTool, StrengthComparisonToolRef } from './StrengthComparisonTool';
import { ParticipantProfile, UserStrengthStat, ParticipantGoalData } from '../../types';

interface StrengthComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantProfile: ParticipantProfile | null;
  latestGoal: ParticipantGoalData | null;
  userStrengthStatsHistory: UserStrengthStat[];
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
}

export const StrengthComparisonModal: React.FC<StrengthComparisonModalProps> = ({
  isOpen,
  onClose,
  participantProfile,
  latestGoal,
  userStrengthStatsHistory,
  onSaveStrengthStats,
}) => {
  const formRef = useRef<StrengthComparisonToolRef>(null);
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

  let saveButtonText = "Spara Styrkestatus";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Min Styrka" size="xl">
      <div className="flex flex-col min-h-[50vh]">
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
          <StrengthComparisonTool
            ref={formRef}
            profile={participantProfile}
            strengthStatsHistory={userStrengthStatsHistory}
            latestGoal={latestGoal}
            onSaveStrengthStats={onSaveStrengthStats}
            isEmbedded={true}
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