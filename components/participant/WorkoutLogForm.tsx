
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ConfirmationModal } from '../ConfirmationModal';

interface WorkoutLogFormProps {
  ai: GoogleGenAI | null;
  workout: Workout;
  logForReferenceOrEdit: WorkoutLog | undefined;
  isNewSession: boolean;
  participantWorkoutNote?: string;
  onSaveLog: (log: WorkoutLog) => void;
  onSaveNextTimeNote: (workoutId: string, note: string) => void;
  onClose: () => void;
}

export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
    ai,
    workout,
    logForReferenceOrEdit,
    isNewSession,
    participantWorkoutNote,
    onSaveLog,
    onSaveNextTimeNote,
    onClose
}) => {
  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [nextTimeNoteInput, setNextTimeNoteInput] = useState('');
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);
  const [showSubmitConfirmationModal, setShowSubmitConfirmationModal] = useState(false);

  useEffect(() => {
    const newLogEntries = new Map<string, SetDetail[]>();
    let newPostWorkoutComment = '';
    let newNextTimeNoteInput = ''; // Initialize to empty

    if (!isNewSession && logForReferenceOrEdit) { // Editing an existing log
        workout.exercises.forEach(ex => {
            const loggedEntry = logForReferenceOrEdit.entries.find(e => e.exerciseId === ex.id);
            if (loggedEntry && loggedEntry.loggedSets && loggedEntry.loggedSets.length > 0) {
                newLogEntries.set(ex.id, loggedEntry.loggedSets.map(s => ({
                    ...s,
                    id: s.id || crypto.randomUUID(),
                    weight: s.weight !== undefined && s.weight !== null ? String(s.weight) : '',
                    reps: s.reps !== undefined && s.reps !== null ? String(s.reps) : '',
                 })));
            } else {
                newLogEntries.set(ex.id, [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }]);
            }
        });
        newPostWorkoutComment = logForReferenceOrEdit.postWorkoutComment || '';
        newNextTimeNoteInput = participantWorkoutNote || ''; // When editing, prefill with the existing note for this workout type
    } else { // Handling new sessions (isNewSession is true)
        workout.exercises.forEach(ex => {
            let setsToInit: SetDetail[] = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
            
            if (isNewSession && logForReferenceOrEdit) { 
                const previousExerciseLog = logForReferenceOrEdit.entries.find(e => e.exerciseId === ex.id);
                if (previousExerciseLog && previousExerciseLog.loggedSets && previousExerciseLog.loggedSets.length > 0) {
                    setsToInit = previousExerciseLog.loggedSets.map(() => ({
                        id: crypto.randomUUID(),
                        reps: '', 
                        weight: '', 
                        isCompleted: false
                    }));
                    if (setsToInit.length === 0) { 
                         setsToInit = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
                    }
                }
            }
            newLogEntries.set(ex.id, setsToInit);
        });
        newPostWorkoutComment = ''; 
        newNextTimeNoteInput = ''; // For new sessions, always start with an empty "next time" note input field
    }

    setLogEntries(newLogEntries);
    setPostWorkoutComment(newPostWorkoutComment);
    setNextTimeNoteInput(newNextTimeNoteInput);

}, [workout.id, workout.exercises, logForReferenceOrEdit, isNewSession, participantWorkoutNote]);


  const handleSetInputChange = (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const updatedSets = sets.map(s =>
        s.id === setId ? { ...s, [field]: value } : s
      );
      newEntries.set(exerciseId, updatedSets);
      return newEntries;
    });
  };

  const handleSetCompletionChange = (exerciseId: string, setId: string, completed: boolean) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const updatedSets = sets.map(s =>
        s.id === setId ? { ...s, isCompleted: completed } : s
      );
      newEntries.set(exerciseId, updatedSets);
      return newEntries;
    });
  };

  const handleAddSet = (exerciseId: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const lastSetWeight = sets.length > 0 ? sets[sets.length - 1].weight : '';
      newEntries.set(exerciseId, [...sets, { id: crypto.randomUUID(), reps: '', weight: lastSetWeight, isCompleted: false }]);
      return newEntries;
    });
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const filteredSets = sets.filter(s => s.id !== setId);
      newEntries.set(exerciseId, filteredSets.length > 0 ? filteredSets : [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }]);
      return newEntries;
    });
  };

  const actuallySubmitLog = () => {
    const entriesToSave: WorkoutExerciseLog[] = [];
    let allInputsValid = true;

    logEntries.forEach((sets, exerciseId) => {
      const completedSets = sets.filter(s => s.isCompleted);
      if (completedSets.length === 0) return;

      const validatedAndCompletedSets: SetDetail[] = [];
      for (const currentSet of completedSets) {
        const repsValueString = String(currentSet.reps).trim();
        const weightValueString = String(currentSet.weight).trim();
        
        const repsValue = repsValueString === '' ? '' : Number(repsValueString);
        const weightValue = weightValueString === '' ? undefined : Number(weightValueString);

        if (repsValueString === '' || isNaN(Number(repsValue)) || Number(repsValue) < 0 || !Number.isInteger(Number(repsValue))) {
            allInputsValid = false;
        }
        if (weightValueString !== '' && weightValue !== undefined) {
            if (isNaN(Number(weightValue)) || Number(weightValue) < 0 || (Number(weightValue) * 10) % 5 !== 0) {
                allInputsValid = false;
            }
        }
        validatedAndCompletedSets.push({
            id: currentSet.id, reps: repsValue, weight: weightValue, isCompleted: true
        });
      }
      if (validatedAndCompletedSets.length > 0) {
          entriesToSave.push({ exerciseId, loggedSets: validatedAndCompletedSets });
      }
    });

    if (!allInputsValid) {
        alert("För slutförda set: reps måste vara angivna som positiva heltal. Vikt, om angiven, måste vara positiv och i hela eller halva kilon (t.ex. 100 eller 100.5).");
        return;
    }

    if (entriesToSave.length === 0) {
        alert("Inga set har markerats som slutförda och/eller har giltig data. Avsluta passet utan att spara eller markera minst ett set som slutfört med giltig data.");
        return;
    }

    const newLog: WorkoutLog = {
      type: 'workout',
      id: (isNewSession || !logForReferenceOrEdit) ? crypto.randomUUID() : logForReferenceOrEdit.id,
      workoutId: workout.id,
      entries: entriesToSave,
      completedDate: (isNewSession || !logForReferenceOrEdit) ? new Date().toISOString() : logForReferenceOrEdit.completedDate,
      postWorkoutComment: postWorkoutComment.trim() || undefined,
    };
    onSaveLog(newLog);
    onSaveNextTimeNote(workout.id, nextTimeNoteInput.trim());
  };

  const needsConfirmation = (): boolean => {
    if (logEntries.size === 0) return false;
    for (const sets of logEntries.values()) {
      for (const setDetail of sets) {
        if (!setDetail.isCompleted) {
          return true;
        }
        const repsEmpty = String(setDetail.reps).trim() === '';
        const weightEmpty = String(setDetail.weight).trim() === '';
        
        if (repsEmpty || weightEmpty) {
            return true;
        }
      }
    }
    return false;
  };

  const handleSubmitLogAttempt = () => {
    if (needsConfirmation()) {
      setShowSubmitConfirmationModal(true);
    } else {
      actuallySubmitLog();
    }
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirmationModal(false);
    actuallySubmitLog();
  };

  const handleCloseAttempt = () => {
    if (needsConfirmation()) {
      setShowExitConfirmationModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    onClose();
    setShowExitConfirmationModal(false);
  };


  return (
    <>
    <div className="bg-white p-2 sm:p-3 rounded-lg shadow-2xl max-w-full mx-auto my-4">
      <div className="flex justify-between items-start mb-6 pb-4 border-b">
        <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-flexibel">{workout.title}</h2>
            <p className="text-base text-gray-500">Passets datum: {new Date(workout.date).toLocaleDateString('sv-SE')}</p>
            {isNewSession && logForReferenceOrEdit && <p className="text-sm text-blue-600 italic">Ny logg, baserat på {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
            {!isNewSession && logForReferenceOrEdit && <p className="text-sm text-orange-600 italic">Redigerar logg från {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
        </div>
        <Button onClick={handleCloseAttempt} variant="secondary" size="sm">Stäng</Button>
      </div>

      {workout.coachNote && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-300 rounded-lg">
          <h5 className="text-base font-semibold text-blue-700">Tips från Coachen för detta pass:</h5>
          <p className="text-base text-blue-600 italic whitespace-pre-wrap">{workout.coachNote}</p>
        </div>
      )}

      {participantWorkoutNote && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
          <h5 className="text-base font-semibold text-yellow-700">Din minnesanteckning för denna typ av pass:</h5>
          <p className="text-base text-yellow-600 italic whitespace-pre-wrap">{participantWorkoutNote}</p>
        </div>
      )}

      <p className="mb-6 text-base text-gray-700">Logga resultat. Jämför. Markera slutförda set.</p>

      <div className="space-y-8">
        {workout.exercises.map((exercise, index) => {
          const currentLoggedSets = logEntries.get(exercise.id) || [];
          const previousExerciseDataForDisplay = logForReferenceOrEdit?.entries.find(e => e.exerciseId === exercise.id);

          return (
            <div key={exercise.id} className="p-4 bg-gray-100 rounded-lg shadow-sm">
              <h4 className="text-xl font-semibold text-gray-800 mb-1">{index + 1}. {exercise.name}</h4>
              {exercise.notes && <p className="text-sm sm:text-base text-gray-500 mb-2">Coach: <span className="italic">{exercise.notes}</span></p>}

              <div className="space-y-3">
                {currentLoggedSets.map((setDetail, setIndex) => {
                  const previousSetDataForDisplay = previousExerciseDataForDisplay?.loggedSets?.[setIndex];
                  const repsInputId = `reps-${exercise.id}-${setDetail.id}`;
                  const weightInputId = `weight-${exercise.id}-${setDetail.id}`;
                  return (
                    <div
                        key={setDetail.id}
                        className={`p-3 rounded-md border transition-colors duration-150 ease-in-out ${
                            setDetail.isCompleted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                          <p className="text-base font-medium text-flexibel">Set {setIndex + 1}</p>
                          {currentLoggedSets.length > 1 && (
                               <Button onClick={() => handleRemoveSet(exercise.id, setDetail.id)} variant="danger" size="sm" className="px-2 py-0.5 text-xs">
                                  Ta bort set
                               </Button>
                          )}
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 items-end">
                        <Input
                          label="Reps"
                          id={repsInputId}
                          name={repsInputId}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Antal"
                          value={setDetail.reps}
                          onChange={(e) => handleSetInputChange(exercise.id, setDetail.id, 'reps', e.target.value)}
                          min="0"
                          step="1"
                        />
                        <Input
                          label="Vikt (kg)"
                          id={weightInputId}
                          name={weightInputId}
                          type="number"
                          inputMode="decimal"
                          placeholder="Vikt"
                          value={setDetail.weight}
                          onChange={(e) => handleSetInputChange(exercise.id, setDetail.id, 'weight', e.target.value)}
                          min="0"
                          step="0.5"
                        />
                        <button
                            onClick={() => handleSetCompletionChange(exercise.id, setDetail.id, !setDetail.isCompleted)}
                            className={`p-2 rounded-md transition-colors h-10 w-10 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                setDetail.isCompleted
                                ? 'bg-green-100 hover:bg-green-200 text-green-700 focus:ring-green-500'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-600 focus:ring-flexibel'
                            }`}
                            aria-pressed={setDetail.isCompleted}
                            aria-label={setDetail.isCompleted ? "Markera set som ofullständigt" : "Markera set som fullständigt"}
                            title={setDetail.isCompleted ? "Setet är markerat som slutfört" : "Markera setet som slutfört"}
                        >
                            {setDetail.isCompleted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                   <rect x="5" y="5" width="14" height="14" rx="1" ry="1" className="text-gray-400" />
                                </svg>
                            )}
                        </button>
                      </div>
                      {previousSetDataForDisplay && (
                        <p className="mt-2 text-sm text-gray-500">
                          Förra gången: {previousSetDataForDisplay.reps || '0'} reps
                          {previousSetDataForDisplay.weight !== undefined && previousSetDataForDisplay.weight !== '' ? ` @ ${previousSetDataForDisplay.weight} kg` : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button onClick={() => handleAddSet(exercise.id)} variant="outline" size="sm" className="mt-3">
                Lägg till set
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t space-y-6">
        <Textarea
            label="Passkommentar (hur kändes det?)"
            name="postWorkoutComment"
            value={postWorkoutComment}
            onChange={(e) => setPostWorkoutComment(e.target.value)}
            placeholder="T.ex. Kändes starkt idag, bra energi!"
            rows={3}
        />
        <Textarea
            label="Minnesanteckning (nästa gång)"
            name="nextTimeNoteInput"
            value={nextTimeNoteInput}
            onChange={(e) => setNextTimeNoteInput(e.target.value)}
            placeholder="T.ex. Öka vikten på knäböj, fokusera på djupet i utfall..."
            rows={3}
        />
      </div>

      <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row justify-end gap-3">
        <Button onClick={handleSubmitLogAttempt} size="lg" className="order-1 w-full">Avsluta pass</Button>
      </div>
    </div>
      {showExitConfirmationModal && (
        <ConfirmationModal
          isOpen={showExitConfirmationModal}
          onClose={() => setShowExitConfirmationModal(false)}
          onConfirm={handleConfirmExit}
          title="Bekräfta Stängning"
          message="Vill du avsluta passet trots att allt inte är loggat och eller bockat?"
          confirmButtonText="Ja, stäng ändå"
          confirmButtonVariant="danger"
          cancelButtonText="Nej, fortsätt logga"
        />
      )}
      {showSubmitConfirmationModal && (
        <ConfirmationModal
          isOpen={showSubmitConfirmationModal}
          onClose={() => setShowSubmitConfirmationModal(false)}
          onConfirm={handleConfirmSubmit}
          title="Bekräfta Avslutning av Pass"
          message="Vill du avsluta passet trots att allt inte är loggat och eller bockat? Endast slutförda set kommer att sparas."
          confirmButtonText="Ja, avsluta passet"
          confirmButtonVariant="primary" 
          cancelButtonText="Nej, fortsätt logga"
        />
      )}
    </>
  );
};
