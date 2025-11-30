
<<<<<<< HEAD

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

=======
import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ParticipantMentalWellbeing } from '../../types';
>>>>>>> origin/staging

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
<<<<<<< HEAD
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
=======
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setSaveError(null);
  }, [currentWellbeing]);

  const handleSave = useCallback((values: { stress: number, energy: number, sleep: number, mood: number }) => {
    if (!participantId && !currentWellbeing?.id) {
        setSaveError("Kan inte spara data, deltagar-ID saknas.");
        return false;
    }
    setSaveError(null);
>>>>>>> origin/staging
    const finalParticipantId = currentWellbeing?.id || participantId!;
    const newWellbeingData: ParticipantMentalWellbeing = {
      id: finalParticipantId,
      participantId: finalParticipantId,
<<<<<<< HEAD
      stressLevel,
      energyLevel,
      sleepQuality,
      overallMood,
=======
      stressLevel: values.stress,
      energyLevel: values.energy,
      sleepQuality: values.sleep,
      overallMood: values.mood,
>>>>>>> origin/staging
      lastUpdated: new Date().toISOString(),
    };
    onSaveWellbeing(newWellbeingData);
    return true;
<<<<<<< HEAD
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
=======
  }, [participantId, currentWellbeing, onSaveWellbeing]);

  // Expose a submitForm that does nothing now, as buttons handle it, 
  // but we keep the ref interface for compatibility if needed by parent logic.
  useImperativeHandle(ref, () => ({
    submitForm: () => false 
  }));

  const handlePresetClick = (type: 'good' | 'neutral' | 'bad') => {
      if (type === 'good') {
          handleSave({ stress: 1, energy: 5, sleep: 5, mood: 5 });
      } else if (type === 'neutral') {
          handleSave({ stress: 3, energy: 3, sleep: 3, mood: 3 });
      } else if (type === 'bad') {
          handleSave({ stress: 4, energy: 2, sleep: 2, mood: 2 });
      }
  };

  return (
    <div className="space-y-4 py-2">
        <div className="text-center space-y-4">
            <p className="text-base text-gray-600">Hur känns kroppen och knoppen idag?</p>
            
            {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600" role="alert">
                {saveError}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button 
                    type="button"
                    onClick={() => handlePresetClick('good')}
                    className="flex flex-row sm:flex-col items-center justify-center p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 transition-all active:scale-95 group text-left sm:text-center"
                >
                    <span className="text-4xl mr-4 sm:mr-0 sm:mb-2 group-hover:scale-110 transition-transform">🤩</span>
                    <div>
                        <span className="block text-lg font-bold text-green-800">På topp</span>
                        <span className="block text-xs text-green-700">Stark, pigg & glad</span>
                    </div>
                </button>
                <button 
                    type="button"
                    onClick={() => handlePresetClick('neutral')}
                    className="flex flex-row sm:flex-col items-center justify-center p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95 group text-left sm:text-center"
                >
                    <span className="text-4xl mr-4 sm:mr-0 sm:mb-2 group-hover:scale-110 transition-transform">🙂</span>
                    <div>
                        <span className="block text-lg font-bold text-blue-800">Helt OK</span>
                        <span className="block text-xs text-blue-700">Vanlig dag</span>
                    </div>
                </button>
                <button 
                    type="button"
                    onClick={() => handlePresetClick('bad')}
                    className="flex flex-row sm:flex-col items-center justify-center p-4 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 hover:border-orange-300 transition-all active:scale-95 group text-left sm:text-center"
                >
                    <span className="text-4xl mr-4 sm:mr-0 sm:mb-2 group-hover:scale-110 transition-transform">😴</span>
                    <div>
                        <span className="block text-lg font-bold text-orange-800">Sliten</span>
                        <span className="block text-xs text-orange-700">Stressad eller trött</span>
                    </div>
                </button>
            </div>
        </div>
      
      {currentWellbeing?.lastUpdated && (
        <p className="text-xs text-gray-400 text-center pt-4">
          Senast incheckad: {new Date(currentWellbeing.lastUpdated).toLocaleString('sv-SE')}
        </p>
      )}
>>>>>>> origin/staging
    </div>
  );
});

<<<<<<< HEAD
MentalWellbeingForm.displayName = "MentalWellbeingForm";
=======
MentalWellbeingForm.displayName = "MentalWellbeingForm";
>>>>>>> origin/staging
