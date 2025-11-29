
import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { ParticipantMentalWellbeing } from '../../types';

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
    const finalParticipantId = currentWellbeing?.id || participantId!;
    const newWellbeingData: ParticipantMentalWellbeing = {
      id: finalParticipantId,
      participantId: finalParticipantId,
      stressLevel: values.stress,
      energyLevel: values.energy,
      sleepQuality: values.sleep,
      overallMood: values.mood,
      lastUpdated: new Date().toISOString(),
    };
    onSaveWellbeing(newWellbeingData);
    return true;
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
    </div>
  );
});

MentalWellbeingForm.displayName = "MentalWellbeingForm";
