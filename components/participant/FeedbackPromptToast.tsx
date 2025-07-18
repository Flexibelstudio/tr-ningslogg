
import React from 'react';
import { Button } from '../Button';

interface FeedbackPromptToastProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  message: string;
}

export const FeedbackPromptToast: React.FC<FeedbackPromptToastProps> = ({
  isOpen,
  onAccept,
  onDecline,
  message,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[100] w-auto max-w-sm p-4 bg-white rounded-lg shadow-xl border border-gray-200"
    >
      <p className="text-base text-gray-700 mb-3">{message}</p>
      <div className="flex justify-end space-x-2">
        <Button onClick={onDecline} variant="secondary" size="sm">
          Stäng
        </Button>
        <Button onClick={onAccept} variant="primary" size="sm">
          Ja, tack!
        </Button>
      </div>
    </div>
  );
};
