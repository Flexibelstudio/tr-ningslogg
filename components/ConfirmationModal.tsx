

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'secondary' | 'danger';
  cancelButtonText?: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = "Bekräfta",
  confirmButtonVariant = 'primary',
  cancelButtonText = "Avbryt",
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {typeof message === 'string' ? <p className="text-gray-700 text-base">{message}</p> : message}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
          <Button onClick={onConfirm} variant={confirmButtonVariant}>
            {confirmButtonText}
          </Button>
          <Button onClick={onClose} variant="secondary">
            {cancelButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
