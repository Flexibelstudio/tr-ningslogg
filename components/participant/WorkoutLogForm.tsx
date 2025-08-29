import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise, WorkoutBlock, ParticipantGoalData, LoggableMetric, ParticipantProfile, UserStrengthStat, ParticipantClubMembership, IntegrationSettings, LiftType, InProgressWorkout } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ConfirmationModal } from '../ConfirmationModal';
import { CLUB_DEFINITIONS, LOCAL_STORAGE_KEYS } from '../../constants';
import { MoodSelectorInput } from './MoodSelectorInput';
import { calculateEstimated1RM } from '../../utils/workoutUtils';
import { AiWorkoutTips } from './AIAssistantModal';
import { ExerciseLogCard } from './ExerciseLogCard';

interface WorkoutLogFormProps {
  ai: GoogleGenAI | null;
  workout: Workout;
  allWorkouts: Workout[];
  logForReferenceOrEdit: WorkoutLog | undefined;
  logForReference?: WorkoutLog;
  isNewSession: boolean;
  onSaveLog: (log: WorkoutLog) => void;
  onClose: () => void;
  latestGoal: ParticipantGoalData | null;
  participantProfile: ParticipantProfile | null;
  latestStrengthStats: UserStrengthStat | null;
  myClubMemberships: ParticipantClubMembership[];
  aiTips: AiWorkoutTips | null;
  myWorkoutLogs: WorkoutLog[];
  integrationSettings: IntegrationSettings;
}

// Type definition for the Screen Wake Lock API's sentinel object.
type WakeLockSentinel = EventTarget & {
  release: () => Promise<void>;
  type: 'screen';
  released: boolean;
};

export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
  ai,
  workout,
  allWorkouts,
  logForReferenceOrEdit: logForEdit,
  logForReference,
  isNewSession,
  onSaveLog,
  onClose,
  latestGoal,
  participantProfile,
  latestStrengthStats,
  myClubMemberships,
  aiTips,
  myWorkoutLogs,
  integrationSettings,
}) => {
  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [setToRemove, setSetToRemove] = useState<{ exerciseId: string; setId: string } | null>(null);
  
  const initialLogState = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const storageKey = useMemo(() => 
    participantProfile ? `${LOCAL_STORAGE_KEYS.IN_PROGRESS_WORKOUT}_${participantProfile.id}` : null, 
    [participantProfile]
  );
  
  const exercisesForThisSession = useMemo(() => {
    return (logForEdit?.selectedExercisesForModifiable && logForEdit.selectedExercisesForModifiable.length > 0)
        ? logForEdit.selectedExercisesForModifiable
        : workout.blocks.flatMap(b => b.exercises);
  }, [workout, logForEdit]);

  // --- ROBUST SCREEN WAKE LOCK LOGIC ---
  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      try {
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current!.addEventListener('release', () => {
            console.log('Screen Wake Lock was released');
          });
          console.log('Screen Wake Lock acquired');
        }
      } catch (err: any) {
        console.error(`Could not acquire wake lock: ${err.name}, ${err.message}`);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      wakeLockRef.current.release();
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    acquireWakeLock();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', acquireWakeLock);
    
    // Release lock when component unmounts
    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', acquireWakeLock);
    };
  }, [acquireWakeLock, releaseWakeLock]);


  useEffect(() => {
    const newLogEntries = new Map<string, SetDetail[]>();
    const exercises = exercisesForThisSession;
        
    exercises.forEach(exercise => {
      const existingEntry = logForEdit?.entries.find(e => e.exerciseId === exercise.id);
      if (existingEntry && existingEntry.loggedSets.length > 0) {
        newLogEntries.set(exercise.id, existingEntry.loggedSets);
      } else {
        const targetSets = parseInt(String(exercise.targetSets || 1), 10) || 1;
        const previousSets = logForEdit?.entries.find(e => e.exerciseId === exercise.id)?.loggedSets;
        const newSets: SetDetail[] = Array.from({ length: targetSets }, (_, i) => ({
          id: crypto.randomUUID(),
          reps: previousSets?.[i]?.reps ?? '',
          weight: previousSets?.[i]?.weight ?? '',
          distanceMeters: previousSets?.[i]?.distanceMeters ?? '',
          durationSeconds: previousSets?.[i]?.durationSeconds ?? '',
          caloriesKcal: previousSets?.[i]?.caloriesKcal ?? '',
          isCompleted: false,
        }));
        newLogEntries.set(exercise.id, newSets);
      }
    });
    setLogEntries(newLogEntries);
    setPostWorkoutComment(logForEdit?.postWorkoutComment || '');
    setMoodRating(logForEdit?.moodRating || null);

    initialLogState.current = JSON.stringify({
      entries: Array.from(newLogEntries.entries()),
      comment: logForEdit?.postWorkoutComment || '',
      mood: logForEdit?.moodRating || null
    });
  }, [workout, logForEdit, exercisesForThisSession]);

  // Autosave logic
  useEffect(() => {
    if (!storageKey) return;
    
    const currentState = JSON.stringify({
      entries: Array.from(logEntries.entries()),
      comment: postWorkoutComment,
      mood: moodRating
    });
    
    if (currentState !== initialLogState.current) {
        const inProgressData: InProgressWorkout = {
            participantId: participantProfile!.id,
            workoutId: workout.id,
            workoutTitle: workout.title,
            startedAt: new Date().toISOString(),
            logEntries: Array.from(logEntries.entries()),
            postWorkoutComment: postWorkoutComment,
            moodRating: moodRating ?? undefined,
            selectedExercisesForModifiable: workout.isModifiable ? exercisesForThisSession : undefined,
        };
        localStorage.setItem(storageKey, JSON.stringify(inProgressData));
    }

  }, [logEntries, postWorkoutComment, moodRating, storageKey, workout, participantProfile, exercisesForThisSession]);

  const handleUpdateSet = useCallback((exerciseId: string, setId: string, field: keyof SetDetail, value: any) => {
    setLogEntries(prevMap => {
      const newMap = new Map(prevMap);
      const sets = newMap.get(exerciseId);
      if (sets) {
        const newSets = sets.map(s => s.id === setId ? { ...s, [field]: value } : s);
        newMap.set(exerciseId, newSets);
      }
      return newMap;
    });
  }, []);

  const handleAddSet = useCallback((exerciseId: string) => {
    setLogEntries(prevMap => {
      const newMap = new Map(prevMap);
      const sets = newMap.get(exerciseId) || [];
      const lastSet = sets[sets.length - 1];
      const newSet: SetDetail = {
        id: crypto.randomUUID(),
        reps: lastSet?.reps ?? '',
        weight: lastSet?.weight ?? '',
        distanceMeters: lastSet?.distanceMeters ?? '',
        durationSeconds: lastSet?.durationSeconds ?? '',
        caloriesKcal: lastSet?.caloriesKcal ?? '',
        isCompleted: false,
      };
      newMap.set(exerciseId, [...sets, newSet]);
      return newMap;
    });
  }, []);
  
  const handleConfirmRemoveSet = () => {
    if (setToRemove) {
      const { exerciseId, setId } = setToRemove;
      setLogEntries(prevMap => {
        const newMap = new Map(prevMap);
        const sets = newMap.get(exerciseId);
        if (sets) {
            if (sets.length > 1) {
                newMap.set(exerciseId, sets.filter(s => s.id !== setId));
            } else {
                newMap.set(exerciseId, [{...sets[0], reps: '', weight: '', isCompleted: false}]);
            }
        }
        return newMap;
      });
      setSetToRemove(null);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    const currentState = JSON.stringify({
      entries: Array.from(logEntries.entries()),
      comment: postWorkoutComment,
      mood: moodRating
    });
    return currentState !== initialLogState.current;
  }, [logEntries, postWorkoutComment, moodRating, initialLogState]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setHasSaved(false);

    const log: WorkoutLog = {
      type: 'workout',
      id: logForEdit?.id || crypto.randomUUID(),
      workoutId: workout.id,
      participantId: participantProfile!.id,
      entries: Array.from(logEntries.entries()).map(([exerciseId, loggedSets]) => ({
        exerciseId,
        loggedSets,
      })),
      completedDate: logForEdit?.completedDate || new Date().toISOString(),
      postWorkoutComment,
      moodRating: moodRating ?? undefined,
      selectedExercisesForModifiable: logForEdit?.selectedExercisesForModifiable ?? (workout.isModifiable ? exercisesForThisSession : undefined),
    };
    
    if (storageKey) {
        localStorage.removeItem(storageKey);
    }

    onSaveLog(log);
    
    setHasSaved(true);
  };
  
  let saveButtonText = isNewSession ? 'Slutför Pass' : 'Spara Ändringar';
  if (isSaving && !hasSaved) saveButtonText = 'Sparar...';
  if (hasSaved) saveButtonText = 'Sparat! ✓';

  const allBlocks = workout.blocks || [];
  
  return (
    <div className="container mx-auto p-4 pb-32">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{workout.title}</h1>
        </div>

        {allBlocks.map(block => {
            const exercisesInBlock = block.exercises;
            if (exercisesInBlock.length === 0) return null;
            return (
                <div key={block.id} className="mb-12">
                    {block.name && <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">{block.name}</h2>}
                    <div className="space-y-10">
                        {exercisesInBlock.map(exercise => (
                            <div key={exercise.id}>
                                <ExerciseLogCard
                                    exercise={exercise}
                                    logEntries={logEntries}
                                    handleUpdateSet={handleUpdateSet}
                                    setSetToRemove={setSetToRemove}
                                    logForReference={logForReference}
                                    aiExerciseTip={aiTips?.exerciseTips.find(tip => tip.exerciseName === exercise.name)?.tip}
                                />
                                <Button
                                    onClick={() => handleAddSet(exercise.id)}
                                    variant="outline"
                                    size="sm"
                                    className="mt-4 w-full"
                                >
                                    Lägg till set
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })}
        {workout.isModifiable && allBlocks.length === 1 && allBlocks[0].exercises.length > 0 && (
             <div className="space-y-10">
                {allBlocks[0].exercises.map(exercise => (
                     <div key={exercise.id}>
                        <ExerciseLogCard
                            exercise={exercise}
                            logEntries={logEntries}
                            handleUpdateSet={handleUpdateSet}
                            setSetToRemove={setSetToRemove}
                            logForReference={logForReference}
                            aiExerciseTip={aiTips?.exerciseTips.find(tip => tip.exerciseName === exercise.name)?.tip}
                        />
                        <Button
                            onClick={() => handleAddSet(exercise.id)}
                            variant="outline"
                            size="sm"
                            className="mt-4 w-full"
                        >
                            Lägg till set
                        </Button>
                    </div>
                ))}
            </div>
        )}

        <div className="mt-12 space-y-6 bg-white p-6 rounded-2xl shadow-lg border">
            <Textarea
                label="Kommentar (valfri)"
                value={postWorkoutComment}
                onChange={e => setPostWorkoutComment(e.target.value)}
                placeholder="Hur kändes passet? Något speciellt att notera?"
                rows={4}
            />
            <MoodSelectorInput
                currentRating={moodRating}
                onSelectRating={setMoodRating}
            />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t z-20">
            <div className="container mx-auto flex justify-end items-center gap-3">
                <Button onClick={handleClose} variant="secondary">
                    {hasUnsavedChanges ? 'Avbryt & Radera' : 'Stäng'}
                </Button>
                <Button onClick={handleSave} variant="primary" disabled={isSaving}>
                    {saveButtonText}
                </Button>
            </div>
        </div>

        <ConfirmationModal
            isOpen={showExitConfirm}
            onClose={() => setShowExitConfirm(false)}
            onConfirm={() => {
                if (storageKey) {
                    localStorage.removeItem(storageKey);
                }
                onClose();
            }}
            title="Avbryta passet?"
            message="Är du säker? Alla osparade ändringar och loggade set för detta pass kommer att raderas."
            confirmButtonText="Ja, avbryt"
            confirmButtonVariant="danger"
        />
        <ConfirmationModal
            isOpen={!!setToRemove}
            onClose={() => setSetToRemove(null)}
            onConfirm={handleConfirmRemoveSet}
            title="Ta bort set?"
            message="Är du säker på att du vill ta bort detta set?"
            confirmButtonText="Ja, ta bort"
            confirmButtonVariant="danger"
        />
    </div>
  );
};