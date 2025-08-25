import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface CheckinConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
}

export const CheckinConfirmationModal: React.FC<CheckinConfirmationModalProps> = ({ isOpen, onClose, participantName }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="text-center p-6 space-y-6">
        <span className="text-8xl" role="img" aria-label="Success checkmark">✅</span>
        <h2 className="text-4xl font-bold text-gray-800">Incheckad!</h2>
        <p className="text-2xl text-gray-600">
          Välkommen, <span className="font-semibold">{participantName}</span>!
        </p>
        <p className="text-xl text-gray-500">Ha ett grymt pass! 💪</p>
        <Button onClick={onClose} size="lg" className="mt-4">
          Stäng
        </Button>
      </div>
    </Modal>
  );
};