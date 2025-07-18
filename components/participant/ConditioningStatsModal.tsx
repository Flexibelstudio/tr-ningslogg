
import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ConditioningStatsForm, ConditioningStatsFormRef } from './ConditioningStatsForm';
import { ParticipantConditioningStat, ParticipantProfile, ParticipantClubMembership } from '../../types';

interface ConditioningStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  statsHistory: ParticipantConditioningStat[];
  participantProfile: ParticipantProfile | null;
  clubMemberships: ParticipantClubMembership[];
  onSaveStats: (statsData: Omit<ParticipantConditioningStat, 'id' | 'participantId'>) => void;
}

export const ConditioningStatsModal: React.FC<ConditioningStatsModalProps> = ({
  isOpen,
  onClose,
  statsHistory,
  participantProfile,
  clubMemberships,
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

  const handleSave = () => {
    if (formRef.current) {
      setIsSaving(true);
      setHasSaved(false);
      const savedSuccessfully = formRef.current.submitForm();
      if (savedSuccessfully) {
        setHasSaved(true);
        setTimeout(() => {
          setIsSaving(false);
          setHasSaved(false);
        }, 2000);
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
            statsHistory={statsHistory}
            onSaveStats={onSaveStats}
            participantProfile={participantProfile}
            clubMemberships={clubMemberships}
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>
            Stäng
          </Button>
          <Button onClick={handleSave} variant="primary" disabled={isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
