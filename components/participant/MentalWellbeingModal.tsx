
import React, { useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { MentalWellbeingForm, MentalWellbeingFormRef } from './MentalWellbeingForm';
import { ParticipantMentalWellbeing } from '../../types';

interface MentalWellbeingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWellbeing: ParticipantMentalWellbeing | null;
  participantId: string | undefined; // Used if currentWellbeing is null to create a new ID
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

  const handleSaveAndClose = () => {
    if (formRef.current) {
      const savedSuccessfully = formRef.current.submitForm();
      if (savedSuccessfully) {
        onClose();
      }
      // If save failed, form itself might show an alert, modal stays open.
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mitt Mentala Välbefinnande" size="lg">
      <div className="flex flex-col min-h-[50vh]">
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
          <MentalWellbeingForm
            ref={formRef}
            currentWellbeing={currentWellbeing}
            participantId={participantId}
            onSaveWellbeing={onSave} // onSave from props will be called by submitForm
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary">
            Avbryt
          </Button>
          <Button onClick={handleSaveAndClose} variant="primary">
            Spara Data
          </Button>
        </div>
      </div>
    </Modal>
  );
};
