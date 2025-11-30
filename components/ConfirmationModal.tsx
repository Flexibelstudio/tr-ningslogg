<<<<<<< HEAD
=======

>>>>>>> origin/staging
import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
<<<<<<< HEAD
  onConfirm: () => void;
=======
  onConfirm?: () => void;
>>>>>>> origin/staging
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'secondary' | 'danger';
  cancelButtonText?: string;
<<<<<<< HEAD
=======
  children?: React.ReactNode;
>>>>>>> origin/staging
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
<<<<<<< HEAD
=======
  children,
>>>>>>> origin/staging
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {typeof message === 'string' ? <p className="text-gray-700 text-base">{message}</p> : message}
<<<<<<< HEAD
        {/* FIX: Add missing border-t and border-gray-200 classes for consistent styling. */}
        <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200">
          <Button onClick={onClose} variant="secondary">
            {cancelButtonText}
          </Button>
          <Button onClick={onConfirm} variant={confirmButtonVariant}>
            {confirmButtonText}
          </Button>
        </div>
=======
        
        {children}

        {onConfirm && (
            <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200">
            <Button onClick={onClose} variant="secondary">
                {cancelButtonText}
            </Button>
            <Button onClick={onConfirm} variant={confirmButtonVariant}>
                {confirmButtonText}
            </Button>
            </div>
        )}
>>>>>>> origin/staging
      </div>
    </Modal>
  );
};
