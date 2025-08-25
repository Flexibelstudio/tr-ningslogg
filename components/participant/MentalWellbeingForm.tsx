

import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ParticipantMentalWellbeing } from '../../types';
import { STRESS_LEVEL_OPTIONS, ENERGY_LEVEL_OPTIONS, SLEEP_QUALITY_OPTIONS, OVERALL_MOOD_OPTIONS } from '../../constants';

interface ScaleOption {
  value: number;
  label: string;
  emoji: string;
  color: string;
}

interface ScaleSelectorProps {
  label: string;
  options: ScaleOption[];
  selectedValue: number | undefined;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

const ScaleSelector: React.FC<ScaleSelectorProps> = ({ label, options, selectedValue, onChange, ariaLabel }) => {
  return (
    <div>
      <label className="block text-base font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap justify-around items-center p-1 bg-gray-50 rounded-lg shadow-sm" role="radiogroup" aria-label={ariaLabel || label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`p-2 m-1 rounded-full transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-flexibel
              ${selectedValue === option.value ? 'transform scale-125 ring-2 ring-flexibel bg-opacity-30' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
            style={{ backgroundColor: selectedValue === option.value ? `${option.color}33` : 'transparent' }}
            aria-pressed={selectedValue === option.value}
            aria-label={`${option.label} (${option.value} av 5)`}
            role="radio"
            aria-checked={selectedValue === option.value}
            title={option.label}
          >
            <span className="text-3xl" aria-hidden="true">{option.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
};


interface MentalWellbeingFormProps {
  currentWellbeing: ParticipantMentalWellbeing | null;
  participantId: string | undefined;
  onSaveWellbeing: (wellbeingData: ParticipantMentalWellbeing) => void;
}

export interface MentalWellbeingFormRef {
  submitForm: () => boolean;
}

export const MentalWellbeingForm = forwardRef<MentalWellbeingFormRef, MentalWellbeingFormProps>(({
  currentWellbeing,
  participantId,
  onSaveWellbeing,
}, ref) => {
  const [stressLevel, setStressLevel] = useState<number | undefined>(currentWellbeing?.stressLevel);
  const [energyLevel, setEnergyLevel] = useState<number | undefined>(currentWellbeing?.energyLevel);
  const [sleepQuality, setSleepQuality] = useState<number | undefined>(currentWellbeing?.sleepQuality);
  const [overallMood, setOverallMood] = useState<number | undefined>(currentWellbeing?.overallMood);
  const [saveError, setSaveError] = useState<string | null>(null); // New state for save error

  useEffect(() => {
    setStressLevel(currentWellbeing?.stressLevel);
    setEnergyLevel(currentWellbeing?.energyLevel);
    setSleepQuality(currentWellbeing?.sleepQuality);
    setOverallMood(currentWellbeing?.overallMood);
    setSaveError(null); // Reset error when props change
  }, [currentWellbeing]);

  const handleSave = useCallback(() => {
    if (!participantId && !currentWellbeing?.id) {
        setSaveError("Kan inte spara data, deltagar-ID saknas. Fyll i din profil först via 'Profil & Mål' i menyn.");
        return false;
    }
    setSaveError(null); // Clear error if ID exists
    const finalParticipantId = currentWellbeing?.id || participantId!;
    const newWellbeingData: ParticipantMentalWellbeing = {
      id: finalParticipantId,
      participantId: finalParticipantId,
      stressLevel,
      energyLevel,
      sleepQuality,
      overallMood,
      lastUpdated: new Date().toISOString(),
    };
    onSaveWellbeing(newWellbeingData);
    return true;
  }, [participantId, currentWellbeing, stressLevel, energyLevel, sleepQuality, overallMood, onSaveWellbeing]);

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      return handleSave();
    }
  }));

  return (
    <div className="space-y-4 py-2">
      <p className="text-base text-gray-600">
        Logga hur du mår. Det hjälper dig och AI:n att förstå din helhetshälsa. Informationen används för att ge dig bättre råd.
      </p>
      
      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600" role="alert">
          {saveError}
        </div>
      )}
      
      <ScaleSelector
        label="Upplever du stress?"
        ariaLabel="Stressnivå"
        options={STRESS_LEVEL_OPTIONS}
        selectedValue={stressLevel}
        onChange={setStressLevel}
      />
      <ScaleSelector
        label="Hur är din energinivå?"
        ariaLabel="Energinivå"
        options={ENERGY_LEVEL_OPTIONS}
        selectedValue={energyLevel}
        onChange={setEnergyLevel}
      />
      <ScaleSelector
        label="Hur har du sovit?"
        ariaLabel="Sömnkvalitet"
        options={SLEEP_QUALITY_OPTIONS}
        selectedValue={sleepQuality}
        onChange={setSleepQuality}
      />
      <ScaleSelector
        label="Hur är ditt humör generellt?"
        ariaLabel="Allmänt humör"
        options={OVERALL_MOOD_OPTIONS}
        selectedValue={overallMood}
        onChange={setOverallMood}
      />
      
      {currentWellbeing?.lastUpdated && (
        <p className="text-sm text-gray-500 text-center pt-2">
          Senast loggat: {new Date(currentWellbeing.lastUpdated).toLocaleString('sv-SE')}
        </p>
      )}
       {/* Save and Cancel buttons are handled by the parent Modal */}
    </div>
  );
});

MentalWellbeingForm.displayName = "MentalWellbeingForm";