
import React from 'react';

interface MoodSelectorInputProps {
  currentRating: number | null;
  onSelectRating: (rating: number) => void;
  label?: string;
}

export const MOOD_OPTIONS: { rating: number; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😩', label: 'Mycket dåligt / Helt slut' },
  { rating: 2, emoji: '😟', label: 'Ganska dåligt / Trött' },
  { rating: 3, emoji: '😐', label: 'Neutralt / Okej' },
  { rating: 4, emoji: '😊', label: 'Ganska bra / Pigg' },
  { rating: 5, emoji: '😄', label: 'Mycket bra / Toppenform' },
];

export const MoodSelectorInput: React.FC<MoodSelectorInputProps> = ({ currentRating, onSelectRating, label = "Hur kändes det?" }) => {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
      <div className="flex justify-around items-center p-2 bg-gray-100 rounded-lg" role="radiogroup" aria-label={label}>
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
            <span className="text-3xl sm:text-4xl" aria-hidden="true">{mood.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
