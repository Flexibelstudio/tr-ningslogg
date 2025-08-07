

import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { GeneralActivityLog } from '../../types';
import { MOOD_OPTIONS } from '../../constants'; // Ensure MOOD_OPTIONS is exported or path is correct

interface GeneralActivitySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: GeneralActivityLog | null;
}

const getMoodEmoji = (moodRating?: number): string => {
  if (moodRating === undefined || moodRating === null) return '';
  const mood = MOOD_OPTIONS.find(m => m.rating === moodRating);
  return mood ? mood.emoji : '';
};

export const GeneralActivitySummaryModal: React.FC<GeneralActivitySummaryModalProps> = ({
  isOpen,
  onClose,
  activity,
}) => {
  if (!isOpen || !activity) return null;

  const dateFormatted = new Date(activity.completedDate).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const moodEmoji = getMoodEmoji(activity.moodRating);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🎉 Aktivitet Loggad! 🎉" size="md">
      <div className="text-center p-2 space-y-6">
        <div className="bg-gradient-to-br from-flexibel to-teal-600 text-white p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold mb-1">{activity.activityName}</h2>
          <p className="text-lg">Snyggt jobbat!</p>
        </div>

        <div className="space-y-3 text-gray-700">
          {activity.durationMinutes > 0 && (
            <div>
              <p className="text-sm text-gray-500 uppercase">Varaktighet</p>
              <p className="text-3xl font-bold text-flexibel">
                {activity.durationMinutes} minuter
              </p>
            </div>
          )}

          {activity.distanceKm && (
            <div>
              <p className="text-sm text-gray-500 uppercase">Distans</p>
              <p className="text-xl font-semibold text-flexibel/90">
                {activity.distanceKm} km
              </p>
            </div>
          )}

          {activity.caloriesBurned && (
            <div>
              <p className="text-sm text-gray-500 uppercase">Kalorier (ca)</p>
              <p className="text-xl font-semibold text-flexibel/90">
                {activity.caloriesBurned} kcal
              </p>
            </div>
          )}
          
          {moodEmoji && (
             <div>
                <p className="text-sm text-gray-500 uppercase">Känsla</p>
                <p className="text-4xl">{moodEmoji}</p>
            </div>
          )}
        </div>

        {activity.comment && (
             <div className="mt-4 pt-3 border-t text-left">
                 <h4 className="text-md font-semibold text-gray-700">Din kommentar:</h4>
                 <p className="text-sm text-gray-600 italic p-2 bg-gray-100 rounded">"{activity.comment}"</p>
            </div>
        )}

        <p className="text-md text-gray-600 pt-4">
          Varje aktivitet räknas! Fortsätt med den goda vanan.
        </p>

        <div className="flex justify-center pt-6 border-t">
          <Button onClick={onClose} variant="primary" size="lg">
            Klar
          </Button>
        </div>
      </div>
    </Modal>
  );
};