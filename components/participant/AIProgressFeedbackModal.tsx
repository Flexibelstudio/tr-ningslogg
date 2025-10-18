

import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { renderMarkdown } from '../../utils/textUtils';

interface AIProgressFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  aiFeedback: string | null; // Expects raw Markdown here
  error: string | null;
  modalTitle?: string; // New prop for dynamic title
}

export const AIProgressFeedbackModal: React.FC<AIProgressFeedbackModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  aiFeedback, // Raw Markdown feedback
  error,
  modalTitle, // Use the new prop
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle || "Feedback"} size="xl">
      <div className="space-y-4 min-h-[200px] max-h-[70vh] flex flex-col">
        {isLoading && (
          <div className="text-center py-8 flex flex-col items-center justify-center flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel mx-auto mb-3"></div>
            <p className="text-lg text-gray-600">Coachen analyserar & ger feedback...</p>
            <p className="text-base text-gray-500">Detta kan ta en liten stund.</p>
          </div>
        )}
        {error && !isLoading && (
           <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex-grow flex flex-col justify-center items-center">
            <p className="font-semibold text-xl">Ett fel uppstod</p>
            <p className="mt-1 text-base">{error}</p>
          </div>
        )}
        {aiFeedback && !isLoading && !error && (
          <div className="overflow-y-auto flex-grow p-1 pr-2">
            <div className="bg-gray-50 rounded-md text-gray-800 leading-relaxed prose prose-base max-w-none">
              {renderMarkdown(aiFeedback)}
            </div>
          </div>
        )}
        <div className="flex justify-end pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary">
            Stäng
          </Button>
        </div>
      </div>
    </Modal>
  );
};