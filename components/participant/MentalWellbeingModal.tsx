
import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { MentalWellbeingForm, MentalWellbeingFormRef } from './MentalWellbeingForm';
import { ParticipantMentalWellbeing } from '../../types';

interface MentalWellbeingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWellbeing: ParticipantMentalWellbeing | null;
  participantId: string | undefined;
  onSave: (wellbeingData: ParticipantMentalWellbeing) => void;
}

export const MentalWellbeingModal: React.FC<MentalWellbeingModalProps> = ({
  isOpen,
  onClose,
  currentWellbeing,
  participantId,
  onSave,
}) => {
  const formRef = useRef<MentalWellbeingFormRef>(null);
  // We can keep isSaving state if we want to show a spinner, but for instant click it's fast.
  // The form handles the save call.

  const handleSaveInternal = (data: ParticipantMentalWellbeing) => {
      onSave(data);
      // Close shortly after save to give visual feedback if we added any, 
      // but for now instantaneous feels snappier.
      onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mitt Mentala Välbefinnande" size="md">
      <div className="flex flex-col">
        <div className="flex-grow pr-2 -mr-2 mb-4">
          <MentalWellbeingForm
            ref={formRef}
            currentWellbeing={currentWellbeing}
            participantId={participantId}
            onSaveWellbeing={handleSaveInternal}
          />
        </div>
        <div className="flex justify-center pt-2 border-t mt-auto">
          <Button onClick={onClose} variant="ghost" size="md" className="text-gray-500">
            Hoppa över
          </Button>
        </div>
      </div>
    </Modal>
  );
};
