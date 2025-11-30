
<<<<<<< HEAD
import React, { useRef, useState, useEffect } from 'react'; // Added useState, useEffect
=======
import React, { useRef, useState, useEffect } from 'react';
>>>>>>> origin/staging
import { Modal } from '../Modal';
import { Button } from '../Button';
import { MentalWellbeingForm, MentalWellbeingFormRef } from './MentalWellbeingForm';
import { ParticipantMentalWellbeing } from '../../types';

interface MentalWellbeingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWellbeing: ParticipantMentalWellbeing | null;
<<<<<<< HEAD
  participantId: string | undefined; // Used if currentWellbeing is null to create a new ID
=======
  participantId: string | undefined;
>>>>>>> origin/staging
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
<<<<<<< HEAD
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
            // setIsSaving(false); // Will be reset by useEffect on isOpen
            // setHasSaved(false); // Will be reset by useEffect on isOpen
        }, 800);
      } else {
        // If save failed, form itself might show an alert, modal stays open.
        setIsSaving(false); // Re-enable button if save failed
      }
    }
=======
  // We can keep isSaving state if we want to show a spinner, but for instant click it's fast.
  // The form handles the save call.

  const handleSaveInternal = (data: ParticipantMentalWellbeing) => {
      onSave(data);
      // Close shortly after save to give visual feedback if we added any, 
      // but for now instantaneous feels snappier.
      onClose();
>>>>>>> origin/staging
  };

  if (!isOpen) {
    return null;
  }

<<<<<<< HEAD
  let saveButtonText = "Spara";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mitt Mentala Välbefinnande" size="lg">
=======
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mitt Mentala Välbefinnande" size="md">
>>>>>>> origin/staging
      <div className="flex flex-col">
        <div className="flex-grow pr-2 -mr-2 mb-4">
          <MentalWellbeingForm
            ref={formRef}
            currentWellbeing={currentWellbeing}
            participantId={participantId}
<<<<<<< HEAD
            onSaveWellbeing={onSave} // onSave from props will be called by submitForm
          />
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary" size="lg" disabled={isSaving}>
            Hoppa över
          </Button>
          <Button onClick={handleSaveAndClose} variant="primary" size="lg" disabled={isSaving}>
            {saveButtonText}
          </Button>
=======
            onSaveWellbeing={handleSaveInternal}
          />
        </div>
        <div className="flex justify-center pt-2 border-t mt-auto">
          <Button onClick={onClose} variant="ghost" size="md" className="text-gray-500">
            Hoppa över
          </Button>
>>>>>>> origin/staging
        </div>
      </div>
    </Modal>
  );
};
