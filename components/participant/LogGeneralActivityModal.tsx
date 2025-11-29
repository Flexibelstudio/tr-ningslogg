
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { GeneralActivityLog } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { DEFAULT_GENERAL_ACTIVITIES } from '../../constants';

interface LogGeneralActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveActivity: (activityData: Omit<GeneralActivityLog, 'id' | 'type' | 'participantId'>, wellbeingData?: { stress: number, energy: number, sleep: number, mood: number }) => void;
}

// Tags relevant for general activities (Running, Walking, Yoga, etc.)
const ACTIVITY_TAGS = [
    "Skönt", "Tungt", "Bra tempo", "Segt", "Ont", 
    "Pigg", "Trött", "Bra väder", "Tidspress", "Backigt", "Intervaller", "Återhämtning"
];

export const LogGeneralActivityModal: React.FC<LogGeneralActivityModalProps> = ({ isOpen, onClose, onSaveActivity }) => {
  const { integrationSettings } = useAppContext();
  const [activityName, setActivityName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [caloriesBurned, setCaloriesBurned] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [comment, setComment] = useState('');
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [completedDate, setCompletedDate] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  const [showRpeInfo, setShowRpeInfo] = useState(false);
  
  // Wellbeing state for "one-click" checkin
  const [wellbeingPreset, setWellbeingPreset] = useState<'good' | 'neutral' | 'bad' | null>(null);


  // Use configured activities or fallback to defaults if empty
  const commonActivitiesForButtons = useMemo(() => {
    const configured = integrationSettings.commonGeneralActivities;
    if (configured && configured.length > 0) {
        return configured;
    }
    return DEFAULT_GENERAL_ACTIVITIES;
  }, [integrationSettings.commonGeneralActivities]);


  useEffect(() => {
    if (isOpen) {
      setActivityName('');
      setDurationMinutes('');
      setCaloriesBurned('');
      setDistanceKm('');
      setComment('');
      setWellbeingPreset(null);
      setRpe(undefined);
      setSelectedTags([]);
      setCompletedDate(new Date().toISOString().split('T')[0]);
      setErrors({});
      setIsSaving(false);
      setHasSaved(false);
      setShowRpeInfo(false);
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!activityName.trim()) {
      newErrors.activityName = 'Aktivitetsnamn är obligatoriskt.';
    }
    if (!durationMinutes.trim()) {
      newErrors.durationMinutes = 'Varaktighet är obligatoriskt.';
    } else if (isNaN(Number(durationMinutes)) || Number(durationMinutes) <= 0 || !Number.isInteger(Number(durationMinutes))) {
      newErrors.durationMinutes = 'Ange en giltig siffra större än 0 för varaktighet (heltal).';
    }
    if (caloriesBurned.trim() && (isNaN(Number(caloriesBurned)) || Number(caloriesBurned) < 0 || !Number.isInteger(Number(caloriesBurned)))) {
      newErrors.caloriesBurned = 'Ange en giltig siffra för kalorier (minst 0, heltal).';
    }
    if (distanceKm.trim() && (isNaN(Number(distanceKm)) || Number(distanceKm) < 0)) {
      newErrors.distanceKm = 'Ange en giltig siffra för distans (minst 0).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    setIsSaving(true);
    setHasSaved(false);
    if (!validate()) {
      setIsSaving(false);
      return;
    }

    const originalTime = new Date().toTimeString().split(' ')[0];
    const finalCompletedDate = new Date(`${completedDate}T${originalTime}`).toISOString();
    
    // Map preset to moodRating
    let moodRating: number | undefined = undefined;
    if (wellbeingPreset === 'good') moodRating = 5;
    else if (wellbeingPreset === 'neutral') moodRating = 3;
    else if (wellbeingPreset === 'bad') moodRating = 2;

    // Create specific wellbeing data based on the preset
    let wellbeingData = undefined;
    if (wellbeingPreset) {
        if (wellbeingPreset === 'good') wellbeingData = { stress: 1, energy: 5, sleep: 5, mood: 5 };
        if (wellbeingPreset === 'neutral') wellbeingData = { stress: 3, energy: 3, sleep: 3, mood: 3 };
        if (wellbeingPreset === 'bad') wellbeingData = { stress: 4, energy: 2, sleep: 2, mood: 2 };
    }

    onSaveActivity({
      activityName: activityName.trim(),
      durationMinutes: Number(durationMinutes),
      caloriesBurned: caloriesBurned.trim() ? Number(caloriesBurned) : undefined,
      distanceKm: distanceKm.trim() ? Number(distanceKm) : undefined,
      comment: comment.trim() || undefined,
      moodRating: moodRating,
      rpe: rpe,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      completedDate: finalCompletedDate,
    }, wellbeingData);
    
    setHasSaved(true);
    setTimeout(() => {
        onClose();
    }, 800);
  };

  const handlePredefinedActivityClick = (name: string) => {
    setActivityName(name);
    if (errors.activityName) {
      setErrors(prev => {
        const updatedErrors = {...prev};
        delete updatedErrors.activityName;
        return updatedErrors;
      });
    }
  };
  
  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };
  
  let saveButtonText = "Spara Aktivitet";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Logga Aktivitet" size="md">
      <div className="space-y-5">
        <Input
          label="Datum"
          type="date"
          value={completedDate}
          onChange={(e) => setCompletedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          required
        />
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">Vanliga aktiviteter:</label>
          <div className="flex flex-wrap gap-2">
            {commonActivitiesForButtons.map(activity => (
              <Button
                key={activity}
                variant="outline"
                size="sm"
                onClick={() => handlePredefinedActivityClick(activity)}
                className={activityName === activity ? 'ring-2 ring-flexibel border-flexibel' : ''}
                aria-pressed={activityName === activity}
              >
                {activity}
              </Button>
            ))}
          </div>
        </div>

        <Input
          label="Aktivitet *"
          name="activityName"
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
          placeholder="Eller skriv egen, t.ex. Powerwalk"
          error={errors.activityName}
          required
        />
        <Input
          label="Tid (min) *"
          name="durationMinutes"
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          placeholder="T.ex. 60"
          min="1"
          step="1"
          error={errors.durationMinutes}
          required
        />
        <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kalorier (kcal)"
              name="caloriesBurned"
              type="number"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
              placeholder="T.ex. 350"
              min="0"
              step="1"
              error={errors.caloriesBurned}
            />
            <Input
              label="Distans (km)"
              name="distanceKm"
              type="number"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="T.ex. 5.3"
              min="0"
              step="0.1"
              error={errors.distanceKm}
            />
        </div>

        {/* RPE - Ansträngning */}
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-gray-700">Hur jobbigt var det? (RPE 1-10)</h3>
                <button 
                    type="button"
                    onClick={() => setShowRpeInfo(!showRpeInfo)}
                    className="text-gray-400 hover:text-flexibel focus:outline-none transition-colors"
                    aria-label="Information om RPE"
                    title="Vad är RPE?"
                >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            
            {showRpeInfo && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-800 animate-fade-in">
                    <p className="font-bold mb-1">RPE (Upplevd ansträngning)</p>
                    <ul className="space-y-1 text-blue-900/80">
                        <li><span className="font-semibold">1-3:</span> Mycket lätt.</li>
                        <li><span className="font-semibold">4-6:</span> Medel. Kan prata obehindrat.</li>
                        <li><span className="font-semibold">7-8:</span> Hårt. Ansträngd andning.</li>
                        <li><span className="font-semibold">9:</span> Mycket hårt. En repetition kvar i tanken.</li>
                        <li><span className="font-semibold">10:</span> Maximalt. Helt slut.</li>
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-10 gap-0.5 sm:gap-1 pb-2">
                {Array.from({length: 10}, (_, i) => i + 1).map(num => {
                    let colorClass = "bg-green-100 text-green-800 border-green-200";
                    if (num > 4) colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                    if (num > 7) colorClass = "bg-red-100 text-red-800 border-red-200";

                    return (
                        <button
                            key={num}
                            onClick={() => setRpe(num)}
                            className={`
                                w-full h-9 sm:h-12 flex items-center justify-center rounded-md border font-bold text-sm sm:text-lg transition-all duration-200
                                ${rpe === num ? `${colorClass.replace('100', '500').replace('800', 'white')} scale-110 shadow-md ring-1 ring-offset-1 ring-gray-300` : `${colorClass} hover:opacity-80`}
                            `}
                        >
                            {num}
                        </button>
                    )
                })}
            </div>
        </div>
        
        {/* Wellbeing Presets - Compact Layout */}
        <div className="space-y-2">
                 <h3 className="text-base font-medium text-gray-800">Hur känns kroppen idag?</h3>
                 <div className="grid grid-cols-3 gap-2">
                    <button 
                        type="button"
                        onClick={() => setWellbeingPreset('good')}
                        className={`flex flex-col items-center justify-center p-2 border-2 rounded-xl transition-all active:scale-95 group text-center h-full ${wellbeingPreset === 'good' ? 'bg-green-100 border-green-500 shadow-md scale-105' : 'bg-white border-gray-200 hover:border-green-300'}`}
                    >
                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🤩</span>
                        <div className="leading-tight">
                            <span className="block text-sm font-bold text-green-800">På topp</span>
                            <span className="block text-[10px] text-green-600">Stark & glad</span>
                        </div>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setWellbeingPreset('neutral')}
                        className={`flex flex-col items-center justify-center p-2 border-2 rounded-xl transition-all active:scale-95 group text-center h-full ${wellbeingPreset === 'neutral' ? 'bg-blue-100 border-blue-500 shadow-md scale-105' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                    >
                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🙂</span>
                        <div className="leading-tight">
                            <span className="block text-sm font-bold text-blue-800">Helt OK</span>
                            <span className="block text-[10px] text-blue-600">Vanlig dag</span>
                        </div>
                    </button>
                    <button 
                        type="button"
                        onClick={() => setWellbeingPreset('bad')}
                        className={`flex flex-col items-center justify-center p-2 border-2 rounded-xl transition-all active:scale-95 group text-center h-full ${wellbeingPreset === 'bad' ? 'bg-orange-100 border-orange-500 shadow-md scale-105' : 'bg-white border-gray-200 hover:border-orange-300'}`}
                    >
                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">😴</span>
                        <div className="leading-tight">
                            <span className="block text-sm font-bold text-orange-800">Sliten</span>
                            <span className="block text-[10px] text-orange-600">Stress/Trött</span>
                        </div>
                    </button>
                </div>
        </div>

        {/* Taggar */}
        <div className="space-y-2">
            <h3 className="text-base font-medium text-gray-700">Beskriv passet</h3>
            <div className="flex flex-wrap gap-2">
                {ACTIVITY_TAGS.map(tag => (
                    <button 
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        className={`
                            px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border
                            ${selectedTags.includes(tag) 
                                ? 'bg-flexibel text-white border-flexibel shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}
                        `}
                    >
                        {tag}
                    </button>
                ))}
            </div>
        </div>
        
        <Textarea
          label="Kommentar (valfri)"
          name="activityComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="T.ex. Kändes bra, vackert väder!"
          rows={2}
        />

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
          <Button onClick={handleSave} variant="primary" disabled={isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
