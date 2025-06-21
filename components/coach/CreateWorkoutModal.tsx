
import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input'; // Added Select
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { Workout, Exercise, LiftType, WorkoutCategory } from '../../types';
import { BASE_LIFT_TYPE_OPTIONS, WORKOUT_CATEGORY_OPTIONS } from '../../constants'; // Import options

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveWorkout: (workout: Workout) => void;
  workoutToEdit?: Workout | null; // To enable editing
  onUpdateWorkout?: (workout: Workout) => void; // To handle updates
}

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({ 
    isOpen, 
    onClose, 
    onSaveWorkout, 
    workoutToEdit, 
    onUpdateWorkout 
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<WorkoutCategory>('PT-bas'); // Added category state
  const [coachNote, setCoachNote] = useState(''); // New state for coach's note
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseName, setCurrentExerciseName] = useState('');
  const [currentExerciseNotes, setCurrentExerciseNotes] = useState('');
  const [currentExerciseBaseLiftType, setCurrentExerciseBaseLiftType] = useState<LiftType | ''>('');


  const resetForm = () => {
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('PT-bas'); // Reset category
    setCoachNote(''); // Reset coach's note
    setExercises([]);
    setCurrentExerciseName('');
    setCurrentExerciseNotes('');
    setCurrentExerciseBaseLiftType('');
  };

  useEffect(() => {
    if (isOpen) {
      if (workoutToEdit) {
        setTitle(workoutToEdit.title);
        setDate(workoutToEdit.date);
        setCategory(workoutToEdit.category || 'PT-bas'); // Set category from workoutToEdit
        setCoachNote(workoutToEdit.coachNote || ''); // Set coach's note from workoutToEdit
        // Ensure exercises have unique IDs and baseLiftType is preserved
        setExercises(workoutToEdit.exercises.map(ex => ({ 
          ...ex, 
          id: ex.id || crypto.randomUUID(),
          baseLiftType: ex.baseLiftType || undefined 
        })));
      } else {
        resetForm();
      }
    }
  }, [isOpen, workoutToEdit]);

  const handleAddExercise = () => {
    if (currentExerciseName.trim() === '') return;
    setExercises([
      ...exercises,
      { 
        id: crypto.randomUUID(), 
        name: currentExerciseName.trim(), 
        notes: currentExerciseNotes.trim(),
        baseLiftType: currentExerciseBaseLiftType === '' ? undefined : currentExerciseBaseLiftType,
      },
    ]);
    setCurrentExerciseName('');
    setCurrentExerciseNotes('');
    setCurrentExerciseBaseLiftType('');
  };

  const handleRemoveExercise = (id: string) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const handleSubmit = () => {
    if (title.trim() === '' || !date) {
      alert('Titel och datum för passet måste anges.');
      return;
    }
    if (!category) { // Category is now required
      alert('Kategori för passet måste anges.');
      return;
    }
    if (exercises.length === 0) {
      alert('Minst en övning måste läggas till i passet.');
      return;
    }

    if (workoutToEdit && onUpdateWorkout) {
      const updatedWorkout: Workout = {
        ...workoutToEdit,
        title,
        date,
        category, // Include category
        coachNote: coachNote.trim() || undefined, // Include coach's note
        exercises, 
      };
      onUpdateWorkout(updatedWorkout);
    } else {
      const newWorkout: Workout = {
        id: crypto.randomUUID(),
        title,
        date,
        category, // Include category
        coachNote: coachNote.trim() || undefined, // Include coach's note
        exercises,
        isPublished: false, 
      };
      onSaveWorkout(newWorkout);
    }
    onClose();
  };
  
  const modalTitle = workoutToEdit ? "Redigera Pass" : "Nytt Pass";
  const saveButtonText = workoutToEdit ? "Spara Ändringar" : "Spara Pass";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-6">
        <Input
          label="Passtitel"
          name="workoutTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="T.ex. Vecka 1 – Styrka"
          required
        />
        <Input
          label="Datum"
          name="workoutDate"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Select
          label="Kategori *"
          name="workoutCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value as WorkoutCategory)}
          options={WORKOUT_CATEGORY_OPTIONS}
          required
        />
        <Textarea
          label="Coachanteckning till Medlem (valfri)"
          name="coachNote"
          value={coachNote}
          onChange={(e) => setCoachNote(e.target.value)}
          placeholder="T.ex. Fokusera på tekniken i baslyften denna vecka! Ta det lugnt vid behov."
          rows={2}
        />

        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-xl font-semibold text-gray-700">Övningar</h4>
          {exercises.map((ex, index) => (
            <div key={ex.id} className="p-3 bg-gray-100 rounded-lg flex justify-between items-start">
              <div className="flex-grow">
                <p className="text-base font-medium text-gray-800">{index + 1}. {ex.name}</p>
                {ex.notes && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap">Anteckning: {ex.notes}</p>}
                {ex.baseLiftType && <p className="text-sm text-flexibel mt-0.5">Kopplad till: {ex.baseLiftType}</p>}
              </div>
              <Button onClick={() => handleRemoveExercise(ex.id)} variant="danger" size="sm" className="ml-2 flex-shrink-0">Ta bort</Button>
            </div>
          ))}
          {exercises.length === 0 && <p className="text-base text-gray-500">Inga övningar tillagda än.</p>}
        </div>

        <div className="space-y-3 p-4 border rounded-lg bg-gray-100">
          <h5 className="text-lg font-semibold text-gray-600">Lägg till ny övning</h5>
          <Input
            label="Namn på övning"
            name="currentExerciseName"
            value={currentExerciseName}
            onChange={(e) => setCurrentExerciseName(e.target.value)}
            placeholder="T.ex. Knäböj"
          />
          <Textarea
            label="Anteckning (valfri)"
            name="currentExerciseNotes"
            value={currentExerciseNotes}
            onChange={(e) => setCurrentExerciseNotes(e.target.value)}
            placeholder="T.ex. 3 set x 8-10 reps, fokus på teknik"
            rows={2}
          />
          <Select
            label="Baslyft (valfritt)"
            name="currentExerciseBaseLiftType"
            value={currentExerciseBaseLiftType}
            onChange={(e) => setCurrentExerciseBaseLiftType(e.target.value as LiftType | '')}
            options={BASE_LIFT_TYPE_OPTIONS}
          />
          <Button onClick={handleAddExercise} variant="secondary" fullWidth disabled={!currentExerciseName.trim()}>
            Lägg till övning
          </Button>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSubmit} variant="primary">{saveButtonText}</Button>
        </div>
      </div>
    </Modal>
  );
};