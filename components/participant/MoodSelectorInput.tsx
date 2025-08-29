import React from 'react';
import { MOOD_OPTIONS } from '../../constants';

interface MoodSelectorInputProps {
  currentRating: number | null;
  onSelectRating: (rating: number) => void;
  label?: string;
}

export const MoodSelectorInput: React.FC<MoodSelectorInputProps> = ({ currentRating, onSelectRating, label = "Hur kändes det?" }) => {
  return (
    <div>
      {label && <label className="block text-base font-medium text-gray-700 mb-2">{label}</label>}
      <div className="flex justify-around items-center p-3 bg-gray-100 rounded-lg" role="radiogroup" aria-label={label}>
        {MOOD_OPTIONS.map((mood) => (
          <button
            key={mood.rating}
            type="button"
            onClick={() => onSelectRating(mood.rating)}
            className={`p-2 rounded-full transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-flexibel
              ${currentRating === mood.rating ? 'transform scale-125 ring-2 ring-flexibel bg-flexibel/20' : 'hover:scale-110'}`}
            aria-pressed={currentRating === mood.rating}
            aria-label={`${mood.label} (${mood.rating} av 5)`}
            role="radio"
            aria-checked={currentRating === mood.rating}
          >
            <span className="text-4xl sm:text-5xl" aria-hidden="true">{mood.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
};