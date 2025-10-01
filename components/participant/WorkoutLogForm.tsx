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

const AiCoachIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);

const liftTypeToPlaceholderKey = (lift: LiftType): string => {
    switch (lift) {
        case 'Knäböj': return 'squat';
        case 'Bänkpress': return 'benchpress';
        case 'Marklyft': return 'deadlift';
        case 'Axelpress': return 'axelpress';
        default: return '';
    }
};

export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
    ai,
    workout,
    allWorkouts,
    logForReferenceOrEdit,
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
  type LogView = 'block_selection' | 'logging_block' | 'finalizing';

  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [completedDate, setCompletedDate] = useState<string>('');
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);
  const [showInProgressConfirmationModal, setShowInProgressConfirmationModal] = useState(false);
  const [showBlockInProgressConfirmationModal, setShowBlockInProgressConfirmationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const [initialLogEntries, setInitialLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [initialPostWorkoutComment, setInitialPostWorkoutComment] = useState('');
  const [initialMoodRating, setInitialMoodRating] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<LogView>('block_selection');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentStepInBlock, setCurrentStepInBlock] = useState(0);
  
  const formTopRef = useRef<HTMLDivElement>(null);
  
  const [setToRemove, setSetToRemove] = useState<{ exerciseId: string; setId: string } | null>(null);
  
  const exercisesToLog = useMemo(() => {
    return workout.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]);
  }, [workout.blocks]);
  
  const participantId = participantProfile?.id;
  const storageKey = useMemo(() => {
    if (!participantId) return null;
    return `${LOCAL_STORAGE_KEYS.IN_PROGRESS_WORKOUT}_${participantId}`;
  }, [participantId]);

  // Effect to update the in-progress log on every change
  useEffect(() => {
    if (!storageKey || !isNewSession) return;

    const updateInProgressLog = () => {
      const existingRaw = localStorage.getItem(storageKey);
      // Only update if a draft already exists to prevent race conditions on initial mount.
      if (existingRaw) {
        const inProgressData: InProgressWorkout = {
          participantId: participantId!,
          workoutId: workout.id,
          workoutTitle: workout.title,
          startedAt: JSON.parse(existingRaw).startedAt || new Date().toISOString(),
          logEntries: Array.from(logEntries.entries()),
          postWorkoutComment: postWorkoutComment,
          moodRating: moodRating,
          selectedExercisesForModifiable: workout.isModifiable ? exercisesToLog : undefined,
        };
        localStorage.setItem(storageKey, JSON.stringify(inProgressData));
      }
    };
    
    updateInProgressLog();

  }, [logEntries, postWorkoutComment, moodRating, storageKey, isNewSession, participantId, workout, exercisesToLog]);


  const hasLoggedAnything = useMemo(() => {
    if (logEntries.size === 0) return false;
    for (const sets of logEntries.values()) {
        if (sets.length > 0) {
            return true;
        }
    }
    return false;
  }, [logEntries]);
  
  const handleAddSetToGroup = useCallback((group: { exercises: Exercise[] }) => {
    setLogEntries(prev => {
        const newLogs = new Map(prev);
        group.exercises.forEach(exercise => {
            const sets = newLogs.get(exercise.id) || [];
            const lastSet = sets.length > 0 ? sets[sets.length - 1] : null;
            const newSet: SetDetail = {
                id: crypto.randomUUID(),
                reps: lastSet?.reps ?? '',
                weight: lastSet?.weight ?? '',
                distanceMeters: lastSet?.distanceMeters ?? '',
                durationSeconds: lastSet?.durationSeconds ?? '',
                caloriesKcal: lastSet?.caloriesKcal ?? '',
                isCompleted: false,
            };
            newLogs.set(exercise.id, [...sets, newSet]);
        });
        return newLogs;
    });
  }, []);

  const activeBlock = useMemo(() => {
    if (!activeBlockId) return null;
    return workout.blocks.find(b => b.id === activeBlockId);
  }, [activeBlockId, workout.blocks]);

  const exerciseGroups = useMemo(() => {
    if (!activeBlock) return [];
    
    const groups: { type: 'single' | 'superset', id: string, exercises: Exercise[] }[] = [];
    const processedIds = new Set<string>();

    const exercisesInBlock = activeBlock.exercises || [];

    exercisesInBlock.forEach(exercise => {
        if (processedIds.has(exercise.id)) return;

        if (exercise.supersetIdentifier) {
            const supersetExercises = exercisesInBlock.filter(
                e => e.supersetIdentifier === exercise.supersetIdentifier
            ).sort((a,b) => exercisesInBlock.indexOf(a) - exercisesInBlock.indexOf(b));
            
            supersetExercises.forEach(ex => processedIds.add(ex.id));
            groups.push({
                type: 'superset',
                id: exercise.supersetIdentifier,
                exercises: supersetExercises
            });
        } else {
            processedIds.add(exercise.id);
            groups.push({
                type: 'single',
                id: exercise.id,
                exercises: [exercise]
            });
        }
    });
    return groups;
  }, [activeBlock]);

  const currentGroup = useMemo(() => {
    return exerciseGroups[currentStepInBlock];
  }, [exerciseGroups, currentStepInBlock]);
  
  const validateSetsFilled = useCallback((exercise: Exercise, sets: SetDetail[]): boolean => {
    for (const set of sets) {
        let hasAtLeastOneValue = false;
        const metrics = exercise.loggableMetrics?.length ? exercise.loggableMetrics : ['reps', 'weight'];

        for (const metric of metrics) {
            let value: string | number | undefined;
            switch (metric) {
                case 'reps': value = set.reps; break;
                case 'weight': value = set.weight; break;
                case 'distance': value = set.distanceMeters; break;
                case 'duration': value = set.durationSeconds; break;
                case 'calories': value = set.caloriesKcal; break;
            }

            if (value !== undefined && value !== null && String(value).trim() !== '') {
                hasAtLeastOneValue = true;
                break;
            }
        }
        
        if (!hasAtLeastOneValue) {
            return false;
        }
    }
    return true;
}, []);

  const isCurrentStepValid = useMemo(() => {
    if (!currentGroup) return true; // No group, nothing to validate
    for (const exercise of currentGroup.exercises) {
        const sets = logEntries.get(exercise.id);
        // If there are sets, they must be filled. If no sets, it's valid to proceed.
        if (sets && sets.length > 0 && !validateSetsFilled(exercise, sets)) {
            return false;
        }
    }
    return true;
  }, [currentGroup, logEntries, validateSetsFilled]);

  const isBlockInProgress = useMemo(() => {
    if (!activeBlock) return false;
    for (const exercise of activeBlock.exercises) {
      const sets = logEntries.get(exercise.id) || [];
      if (sets.length > 0 && sets.some(s => !s.isCompleted)) {
        return true; // Found at least one uncompleted set in a non-empty exercise log
      }
    }
    return false;
  }, [activeBlock, logEntries]);

  useEffect(() => {
    if (isNewSession && currentGroup) {
      const hasAnySets = currentGroup.exercises.some(ex => (logEntries.get(ex.id) || []).length > 0);
      if (!hasAnySets) {
        handleAddSetToGroup(currentGroup);
      }
    }
  }, [isNewSession, currentGroup, logEntries, handleAddSetToGroup]);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockSentinelRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.error(`WorkoutLogForm: Failed to acquire screen wake lock.`, err);
        }
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(err => console.error("Failed to release wakelock", err));
      }
    };
  }, []);

  useEffect(() => {
    const newLogEntries = new Map<string, SetDetail[]>();
    if (!isNewSession && logForReferenceOrEdit) {
        logForReferenceOrEdit.entries.forEach(entry => {
            if (entry.loggedSets) {
                newLogEntries.set(entry.exerciseId, entry.loggedSets.map(s => ({
                    ...s, 
                    id: s.id || crypto.randomUUID(),
                    reps: s.reps ?? '',
                    weight: s.weight ?? '',
                })));
            }
        });
        setCompletedDate(new Date(logForReferenceOrEdit.completedDate).toISOString().split('T')[0]);
        setPostWorkoutComment(logForReferenceOrEdit.postWorkoutComment || '');
        setMoodRating(logForReferenceOrEdit.moodRating ?? null);
    } else if (isNewSession && storageKey) {
        setCompletedDate(new Date().toISOString().split('T')[0]);
        // This is a new session, create the initial draft in localStorage.
        const inProgressData: InProgressWorkout = {
          participantId: participantId!,
          workoutId: workout.id,
          workoutTitle: workout.title,
          startedAt: new Date().toISOString(),
          logEntries: [],
          postWorkoutComment: '',
          moodRating: null,
          selectedExercisesForModifiable: workout.isModifiable ? exercisesToLog : undefined,
        };
        localStorage.setItem(storageKey, JSON.stringify(inProgressData));
    }
    setLogEntries(newLogEntries);
    setInitialLogEntries(new Map(newLogEntries));
    setInitialPostWorkoutComment(logForReferenceOrEdit?.postWorkoutComment || '');
    setInitialMoodRating(logForReferenceOrEdit?.moodRating ?? null);
  }, [isNewSession, logForReferenceOrEdit, storageKey, participantId, workout, exercisesToLog]);


  const hasUnsavedChanges = useMemo(() => {
    if (postWorkoutComment !== initialPostWorkoutComment) return true;
    if (moodRating !== initialMoodRating) return true;
    const initialEntriesString = JSON.stringify(Array.from(initialLogEntries.entries()));
    const currentEntriesString = JSON.stringify(Array.from(logEntries.entries()));
    return initialEntriesString !== currentEntriesString;
  }, [logEntries, postWorkoutComment, moodRating, initialLogEntries, initialPostWorkoutComment, initialMoodRating]);

  const handleAttemptClose = () => {
    if (hasUnsavedChanges && !isNewSession) { // Only prompt on edit, not on new (draft is saved)
      setShowExitConfirmationModal(true);
    } else {
      onClose();
    }
  };

  const handleFinalSave = () => {
    setIsSaving(true);
    setHasSaved(false);
    const finalEntries: WorkoutExerciseLog[] = [];
    logEntries.forEach((sets, exerciseId) => {
        const cleanedSets = sets.map(s => {
            const repsStr = (s.reps || '').toString();
            const weightStr = (s.weight || '').toString();
            const distStr = (s.distanceMeters || '').toString();
            const durStr = (s.durationSeconds || '').toString();
            const calStr = (s.caloriesKcal || '').toString();
            return {
                ...s,
                reps: repsStr.trim() ? Number(repsStr.replace(',', '.')) : undefined,
                weight: weightStr.trim() ? Number(weightStr.replace(',', '.')) : undefined,
                distanceMeters: distStr.trim() ? Number(distStr.replace(',', '.')) : undefined,
                durationSeconds: durStr.trim() ? Number(durStr.replace(',', '.')) : undefined,
                caloriesKcal: calStr.trim() ? Number(calStr.replace(',', '.')) : undefined,
            };
        }).filter(s => s.reps !== undefined || s.weight !== undefined || s.distanceMeters !== undefined || s.durationSeconds !== undefined || s.caloriesKcal !== undefined);
        if (cleanedSets.length > 0) {
            finalEntries.push({ exerciseId, loggedSets: cleanedSets });
        }
    });

    const originalTime = (!isNewSession && logForReferenceOrEdit)
      ? new Date(logForReferenceOrEdit.completedDate).toTimeString().split(' ')[0]
      : new Date().toTimeString().split(' ')[0];
    
    const finalCompletedDate = new Date(`${completedDate}T${originalTime}`).toISOString();

    const logData: WorkoutLog = {
      type: 'workout',
      id: !isNewSession && logForReferenceOrEdit ? logForReferenceOrEdit.id : crypto.randomUUID(),
      workoutId: workout.id,
      participantId: '',
      entries: finalEntries,
      completedDate: finalCompletedDate,
      postWorkoutComment: postWorkoutComment.trim(),
      moodRating: moodRating || undefined,
      selectedExercisesForModifiable: workout.isModifiable ? exercisesToLog : undefined,
    };
    onSaveLog(logData);
    
    // Clean up localStorage on successful save.
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }

    setHasSaved(true);
  };
  
  const handleSelectBlock = (blockId: string) => {
    setActiveBlockId(blockId);
    setCurrentStepInBlock(0);
    setCurrentView('logging_block');
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleUpdateSet = (exerciseId: string, setId: string, field: keyof SetDetail, value: any) => {
    let processedValue = String(value);

    const integerFields: (keyof SetDetail)[] = ['reps', 'distanceMeters', 'durationSeconds', 'caloriesKcal'];
    const decimalFields: (keyof SetDetail)[] = ['weight'];

    if (integerFields.includes(field)) {
        processedValue = processedValue.replace(/[^0-9]/g, '');
    } else if (decimalFields.includes(field)) {
        processedValue = processedValue.replace(/,/g, '.');
        processedValue = processedValue.replace(/[^0-9.]/g, '');
        const parts = processedValue.split('.');
        if (parts.length > 1) {
            processedValue = parts.shift() + '.' + parts.join('');
        }
    }
    
    setLogEntries(prev => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        const updatedSets = sets.map(set => set.id === setId ? { ...set, [field]: processedValue } : set);
        newLogs.set(exerciseId, updatedSets);
        return newLogs;
    });
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
     setLogEntries(prev => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        const updatedSets = sets.filter(s => s.id !== setId);
        newLogs.set(exerciseId, updatedSets);
        return newLogs;
    });
    setSetToRemove(null);
  };

  const handleConfirmRemoveSet = () => {
    if (setToRemove) {
        handleRemoveSet(setToRemove.exerciseId, setToRemove.setId);
    }
  };

  const validateActiveBlock = useCallback((): boolean => {
    if (!activeBlock) return true;
    for (const group of exerciseGroups) {
        for (const exercise of group.exercises) {
            const sets = logEntries.get(exercise.id);
            // Only validate if there are sets that have been added. Ignore exercises with no sets.
            if (sets && sets.length > 0 && !validateSetsFilled(exercise, sets)) {
                alert(`Vänligen fyll i minst ett fält för varje set av "${exercise.name}" innan du fortsätter.`);
                return false;
            }
        }
    }
    return true;
  }, [activeBlock, exerciseGroups, logEntries, validateSetsFilled]);

  const validateAllLoggedSets = useCallback((): boolean => {
    for (const block of workout.blocks) {
        for (const exercise of block.exercises) {
            const sets = logEntries.get(exercise.id);
            if (sets && sets.length > 0 && !validateSetsFilled(exercise, sets)) {
                alert(`Vänligen fyll i minst ett fält för varje set av "${exercise.name}" i "${block.name || 'Block'}" innan du avslutar passet.`);
                handleSelectBlock(block.id);
                return false;
            }
        }
    }
    return true;
  }, [workout.blocks, logEntries, validateSetsFilled]);
  
  const hasInProgressBlocks = useCallback((): boolean => {
    for (const block of workout.blocks) {
        const blockExercises = block.exercises || [];
        const hasLoggedEntries = blockExercises.some(ex => (logEntries.get(ex.id) || []).length > 0);
        if (!hasLoggedEntries) continue;

        const allExercisesCompleted = blockExercises.every(ex => {
            const sets = logEntries.get(ex.id) || [];
            return sets.length > 0 && sets.every(s => s.isCompleted);
        });

        if (!allExercisesCompleted) {
            return true; // Found an in-progress block
        }
    }
    return false;
  }, [workout.blocks, logEntries]);

  const handleAttemptFinishWorkout = () => {
    if (validateAllLoggedSets()) {
        if (hasInProgressBlocks()) {
            setShowInProgressConfirmationModal(true);
        } else {
            setCurrentView('finalizing');
        }
    }
  };

  const handleBackToBlockSelection = () => {
    if (!validateActiveBlock()) return;
    setCurrentView('block_selection');
    setActiveBlockId(null);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const goBackToBlockSelectionWithoutValidation = () => {
    setCurrentView('block_selection');
    setActiveBlockId(null);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleNextStep = () => {
    const nextStep = currentStepInBlock + 1;
    if (nextStep < exerciseGroups.length) {
        setCurrentStepInBlock(nextStep);
        formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
        if (isBlockInProgress) {
            setShowBlockInProgressConfirmationModal(true);
        } else {
            handleBackToBlockSelection();
        }
    }
  };
  
  const handlePrevStep = () => {
    const prevStep = currentStepInBlock - 1;
    if (prevStep >= 0) {
        setCurrentStepInBlock(prevStep);
        formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
        goBackToBlockSelectionWithoutValidation();
    }
  };

  return (
    <div className="bg-slate-100 bg-dotted-pattern bg-dotted-size bg-fixed min-h-screen">
      <div ref={formTopRef} className="container mx-auto p-4 max-w-4xl animate-fade-in pb-28">
        
        {currentView === 'block_selection' && (
          <div className="space-y-6">
            <header className="space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{workout.title}</h1>
                        <span className="inline-block bg-slate-200 text-slate-700 text-sm font-semibold px-3 py-1 rounded-full mt-2">
                            Kategori: {workout.category}
                        </span>
                    </div>
                    <Button onClick={handleAttemptClose} variant="secondary" className="whitespace-nowrap flex-shrink-0 !px-4 !text-base sm:!px-6 sm:!text-lg">Avsluta pass</Button>
                </div>
                <div className="w-full sm:w-1/2">
                    <Input
                        label="Datum för passet"
                        type="date"
                        id="workout-date"
                        value={completedDate}
                        onChange={(e) => setCompletedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                    />
                </div>
            </header>
            
            {aiTips?.generalTips && (
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                    <p className="font-semibold text-blue-800 flex items-center"><AiCoachIcon /> Coachens Tips</p>
                    <p className="text-blue-700 mt-1 whitespace-pre-wrap">{aiTips.generalTips}</p>
                </div>
            )}

            {workout.coachNote && (
                <details className="p-4 bg-white rounded-2xl shadow-sm" open>
                    <summary className="text-xl font-semibold text-gray-700 cursor-pointer">Coaching &amp; tips</summary>
                    <p className="mt-2 text-gray-600 whitespace-pre-wrap">{workout.coachNote}</p>
                </details>
            )}

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Redo att starta?</h2>
                <p className="text-lg text-gray-600">Klicka på ett block för att börja logga.</p>
                {workout.blocks.map((block, index) => {
                    const blockExercises = block.exercises || [];
                    const hasLoggedEntries = blockExercises.some(ex => (logEntries.get(ex.id) || []).length > 0);
                    
                    let blockStatus: 'Ej påbörjat' | 'Pågående' | 'Slutfört' = 'Ej påbörjat';
                    let statusClass = 'bg-slate-100 text-slate-600';
                    
                    if (hasLoggedEntries) {
                        const allExercisesCompleted = blockExercises.every(ex => {
                            const sets = logEntries.get(ex.id) || [];
                            return sets.length > 0 && sets.every(s => s.isCompleted);
                        });

                        if (allExercisesCompleted) {
                            blockStatus = 'Slutfört';
                            statusClass = 'bg-green-100 text-green-800';
                        } else {
                            blockStatus = 'Pågående';
                            statusClass = 'bg-yellow-100 text-yellow-800';
                        }
                    }

                    return (
                        <button key={block.id} onClick={() => handleSelectBlock(block.id)} className="w-full text-left p-4 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-flexibel transition-all flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">{block.name || `Block ${index + 1}`}</h3>
                                <p className="text-base text-gray-500">{block.exercises.length} övningar</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusClass}`}>
                                    {blockStatus}
                                </span>
                                <div className="w-12 h-12 flex items-center justify-center bg-flexibel text-white rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t">
                <Button 
                  onClick={handleAttemptFinishWorkout} 
                  fullWidth 
                  size="lg"
                  disabled={!hasLoggedAnything}
                  className={!hasLoggedAnything ? '!bg-gray-400 !border-gray-400' : ''}
                >
                    Färdig med passet, gå till avslut
                </Button>
            </div>
          </div>
        )}
        
        {currentView === 'logging_block' && activeBlock && currentGroup && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{workout.title}</h1>
                    <p className="text-xl text-gray-600">{activeBlock.name || `Block ${workout.blocks.findIndex(b => b.id === activeBlock.id) + 1}`}</p>
                </div>
                <Button onClick={handleAttemptClose} variant="secondary">Avsluta pass</Button>
            </header>
            {currentGroup.type === 'superset' && (
              <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                  <h2 className="text-3xl font-bold text-blue-800">Superset</h2>
              </div>
            )}
            <div className="space-y-8">
              {currentGroup.exercises.map((exercise) => (
                <ExerciseLogCard 
                  key={exercise.id}
                  exercise={exercise} 
                  logEntries={logEntries}
                  handleUpdateSet={handleUpdateSet}
                  setSetToRemove={setSetToRemove}
                  logForReference={logForReferenceOrEdit}
                  aiExerciseTip={aiTips?.exerciseTips.find(tip => tip.exerciseName === exercise.name)?.tip}
                  isNewSession={isNewSession}
                  myWorkoutLogs={myWorkoutLogs}
                  allWorkouts={allWorkouts}
                />
              ))}
            </div>
             <Button fullWidth variant="secondary" size="lg" onClick={() => handleAddSetToGroup(currentGroup)}>
                {currentGroup.type === 'superset' ? 'Lägg till Superset' : 'Lägg till Set'}
            </Button>
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
                <div className="container mx-auto max-w-2xl flex justify-between items-center">
                    <Button variant="outline" onClick={handlePrevStep}>{currentStepInBlock === 0 ? 'Tillbaka' : 'Föregående'}</Button>
                    <p className="text-base font-semibold text-gray-600">Steg {currentStepInBlock + 1} av {exerciseGroups.length}</p>
                    <Button variant="primary" onClick={handleNextStep} disabled={!isCurrentStepValid}>{currentStepInBlock >= exerciseGroups.length - 1 ? 'Avsluta block' : 'Nästa'}</Button>
                </div>
            </div>
          </div>
        )}
        
        {currentView === 'finalizing' && (
          <div className="space-y-6 animate-fade-in bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-700">Slutför Passet</h2>
            <Textarea label="Kommentar (valfri)" value={postWorkoutComment} onChange={(e) => setPostWorkoutComment(e.target.value)} placeholder="Hur kändes passet?" rows={4} />
            <MoodSelectorInput currentRating={moodRating} onSelectRating={setMoodRating} />
            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
              <Button onClick={() => setCurrentView('block_selection')} variant="outline" size="lg">Tillbaka till block</Button>
              <Button onClick={handleFinalSave} size="lg" disabled={isSaving}>{isSaving ? (hasSaved ? 'Sparat! ✓' : 'Sparar...') : 'Spara & Avsluta'}</Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showBlockInProgressConfirmationModal}
        onClose={() => setShowBlockInProgressConfirmationModal(false)}
        onConfirm={() => {
            setShowBlockInProgressConfirmationModal(false);
            handleBackToBlockSelection();
        }}
        title="Avsluta blocket?"
        message="Vissa set är inte markerade som slutförda. Är du säker på att du vill avsluta blocket och gå tillbaka till översikten?"
        confirmButtonText="Ja, avsluta blocket"
        confirmButtonVariant="primary"
      />
      <ConfirmationModal
        isOpen={showExitConfirmationModal}
        onClose={() => setShowExitConfirmationModal(false)}
        onConfirm={onClose}
        title="Avsluta utan att spara?"
        message="Dina ändringar kommer inte sparas."
        confirmButtonText="Ja, avsluta"
      />
      <ConfirmationModal
          isOpen={showInProgressConfirmationModal}
          onClose={() => setShowInProgressConfirmationModal(false)}
          onConfirm={() => {
              setShowInProgressConfirmationModal(false);
              setCurrentView('finalizing');
          }}
          title="Avsluta passet?"
          message="Vissa block är påbörjade men inte helt slutförda. Är du säker på att du vill avsluta passet?"
          confirmButtonText="Ja, avsluta"
          confirmButtonVariant="primary"
      />
      <ConfirmationModal
          isOpen={!!setToRemove}
          onClose={() => setSetToRemove(null)}
          onConfirm={handleConfirmRemoveSet}
          title="Ta bort set?"
          message="Är du säker på att du vill ta bort detta set?"
          confirmButtonText="Ja, ta bort"
      />
    </div>
  );
};
