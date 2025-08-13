
import React, { useEffect } from 'react';
import { AchievementDefinition } from '../../types';

interface AchievementToastProps {
  achievement: AchievementDefinition | null;
  onClose: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onClose }) => {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [achievement, onClose]);

  if (!achievement) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-16 sm:bottom-4 right-4 z-[100] w-auto max-w-sm p-4 bg-yellow-400 text-yellow-900 rounded-lg shadow-xl border border-yellow-500"
    >
      <div className="flex items-center">
        <span className="text-2xl mr-3" aria-hidden="true">{achievement.icon}</span>
        <div>
          <p className="font-bold text-sm">Ny Prestation Upplåst!</p>
          <p className="text-sm">{achievement.name}</p>
        </div>
        <button
            onClick={onClose}
            className="ml-auto -mx-1.5 -my-1.5 bg-yellow-400 text-yellow-900 rounded-lg focus:ring-2 focus:ring-yellow-500 p-1.5 hover:bg-yellow-500 inline-flex h-8 w-8"
            aria-label="Stäng"
        >
            <span className="sr-only">Stäng</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
            ></path>
            </svg>
        </button>
      </div>
    </div>
  );
};