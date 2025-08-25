import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {children}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
          <Button onClick={onClose} variant="primary">
            Stäng
          </Button>
        </div>
      </div>
    </Modal>
  );
};