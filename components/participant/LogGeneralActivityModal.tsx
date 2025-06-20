
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { GeneralActivityLog } from '../../types';
import { MoodSelectorInput } from './MoodSelectorInput'; // Import MoodSelectorInput

interface LogGeneralActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveActivity: (activity: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'userId'>) => void;
}

const EXISTING_GENERAL_ACTIVITIES = ["HIIT", "Workout", "Mindfulness", "Yin Yoga", "Postural Yoga", "Promenad", "Annan aktivitet"];

export const LogGeneralActivityModal: React.FC<LogGeneralActivityModalProps> = ({ isOpen, onClose, onSaveActivity }) => {
  const [activityName, setActivityName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [caloriesBurned, setCaloriesBurned] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [comment, setComment] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(null); // State for mood
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const commonActivitiesForButtons = useMemo(() => {
    const combined: string[] = [];
    EXISTING_GENERAL_ACTIVITIES.forEach(activity => {
        if (!combined.includes(activity)) {
            combined.push(activity);
        }
    });
    return combined;
  }, []);


  useEffect(() => {
    if (isOpen) {
      setActivityName('');
      setDurationMinutes('');
      setCaloriesBurned('');
      setDistanceKm('');
      setComment('');
      setSelectedMood(null); // Reset mood
      setErrors({});
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
    if (!validate()) {
      return;
    }
    onSaveActivity({
      activityName: activityName.trim(),
      durationMinutes: Number(durationMinutes),
      caloriesBurned: caloriesBurned.trim() ? Number(caloriesBurned) : undefined,
      distanceKm: distanceKm.trim() ? Number(distanceKm) : undefined,
      comment: comment.trim() || undefined,
      moodRating: selectedMood !== null ? selectedMood : undefined, // Save mood
    });
    onClose();
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Logga Aktivitet" size="md">
      <div className="space-y-4">
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
        <Input
          label="Kalorier (kcal, valfri)"
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
          label="Distans (km, valfri)"
          name="distanceKm"
          type="number"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          placeholder="T.ex. 5.3"
          min="0"
          step="0.1"
          error={errors.distanceKm}
        />
        <Textarea
          label="Kommentar (valfri)"
          name="activityComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="T.ex. Kändes bra, vackert väder!"
          rows={3}
        />
        <MoodSelectorInput
            currentRating={selectedMood}
            onSelectRating={setSelectedMood}
            label="Känsla?"
        />
        <div className="flex justify-end space-x-3 pt-3 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave} variant="primary">Spara Aktivitet</Button>
        </div>
      </div>
    </Modal>
  );
};
