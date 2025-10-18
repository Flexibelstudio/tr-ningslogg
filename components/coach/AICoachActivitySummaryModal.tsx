

import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { renderMarkdown } from '../../utils/textUtils';

interface AICoachActivitySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  aiSummary: string | null;
  error: string | null;
}

export const AICoachActivitySummaryModal: React.FC<AICoachActivitySummaryModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  aiSummary,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Sammanfattning" size="xl">
      <div className="space-y-4 min-h-[250px] max-h-[70vh] flex flex-col">
        {isLoading && (
          <div className="text-center py-8 flex flex-col items-center justify-center flex-grow">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel mx-auto mb-3"></div>
            <p className="text-base text-gray-600">AI analyserar aktivitet...</p>
            <p className="text-sm text-gray-500">Detta kan ta en liten stund.</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex-grow flex flex-col justify-center items-center">
            <p className="font-semibold text-xl">Ett fel uppstod</p>
            <p className="mt-1 text-base">{error}</p>
          </div>
        )}
        {aiSummary && !isLoading && !error && (
          <div className="overflow-y-auto flex-grow p-1">
            <h4 className="text-xl font-semibold text-flexibel mb-3 sticky top-0 bg-white pb-2">AI Insikter:</h4>
            <div className="text-base text-gray-800 leading-relaxed prose prose-base max-w-none">
              {renderMarkdown(aiSummary)}
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