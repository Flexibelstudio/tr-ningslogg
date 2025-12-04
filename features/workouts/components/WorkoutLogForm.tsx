
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise, WorkoutBlock, ParticipantGoalData, LoggableMetric, ParticipantProfile, UserStrengthStat, ParticipantClubMembership, IntegrationSettings, LiftType, InProgressWorkout } from '../../../types';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Textarea } from '../../../components/Textarea';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { CLUB_DEFINITIONS, LOCAL_STORAGE_KEYS } from '../../../constants';
import { MoodSelectorInput } from '../../../components/participant/MoodSelectorInput';
import { calculateEstimated1RM } from '../../../utils/workoutUtils';
import { AiWorkoutTips } from './AIAssistantModal';
import { ExerciseLogCard } from './ExerciseLogCard';

interface WorkoutLogFormProps {
  workout: Workout;
  allWorkouts: Workout[];
  logForReferenceOrEdit: WorkoutLog | undefined;
  logForReference?: WorkoutLog;
  isNewSession: boolean;
  onSaveLog: (log: WorkoutLog, wellbeingData?: { stress: number, energy: number, sleep: number, mood: number }) => Promise<void>;
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

// Predefined tags for quick selection
const FEEDBACK_TAGS = [
    "Stark", "Tungt", "Bra flow", "Segt", "Ont", 
    "Pigg", "Trött", "Bra musik", "Tidspress", "Tekniskt", "Roligt"
];

export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
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
  type LogView = 'block_selection' | 'logging_block' | 'logging_quick_block' | 'finalizing';

  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [completedDate, setCompletedDate] = useState<string>('');
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);
  const [showInProgressConfirmationModal, setShowInProgressConfirmationModal] = useState(false);
  const [showBlockInProgressConfirmationModal, setShowBlockInProgressConfirmationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);
  
  const [showRpeInfo, setShowRpeInfo] = useState(false);

  // Wellbeing state for "one-click" checkin
  const [wellbeingPreset, setWellbeingPreset] = useState<'good' | 'neutral' | 'bad' | null>(null);


  const [initialLogEntries, setInitialLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [initialPostWorkoutComment, setInitialPostWorkoutComment] = useState('');
  const [initialMoodRating, setInitialMoodRating] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<LogView>('block_selection');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentStepInBlock, setCurrentStepInBlock] = useState(0);
  
  const formTopRef = useRef<HTMLDivElement>(null);
  
  const [setToRemove, setSetToRemove] = useState<{ exerciseId: string; setId: string } | null>(null);

  // --- New Quick Log State ---
  const [quickLogStep, setQuickLogStep] = useState<'template' | 'review'>('template');
  const [quickLogTotalRounds, setQuickLogTotalRounds] = useState('1');

  
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
        if ((sets as SetDetail[]).length > 0) {
            return true;
        }
    }
    return false;
  }, [logEntries]);
  
  const handleAddSetToGroup = useCallback((group: { exercises: Exercise[] }) => {
    setLogEntries((prev: Map<string, SetDetail[]>) => {
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
    // FIX: Ensure activeBlock.exercises is treated as an array to prevent errors when iterating.
    for (const exercise of (activeBlock?.exercises || [])) {
      // FIX: Ensure `logEntries.get(exercise.id)` is treated as an array to prevent errors when accessing its properties.
      const sets = logEntries.get(exercise.id) || ([] as SetDetail[]);
      if (sets.length > 0 && sets.some(s => !s.isCompleted)) {
        return true; // Found at least one uncompleted set in a non-empty exercise log
      }
    }
    return false;
  }, [activeBlock, logEntries]);

  useEffect(() => {
    if (isNewSession && currentGroup) {
      // FIX: Ensure `logEntries.get(ex.id)` is treated as an array before checking length to prevent runtime errors.
      const hasAnySets = (currentGroup?.exercises || []).some(ex => (logEntries.get(ex.id) || []).length > 0);
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
        // FIX: Added optional chaining to prevent crash if logForReferenceOrEdit.entries is undefined.
        (logForReferenceOrEdit?.entries || []).forEach(entry => {
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
        setRpe(logForReferenceOrEdit.rpe);
        setSelectedTags(logForReferenceOrEdit.tags || []);
        // Reconstruct preset from mood if possible (simple approximation)
        if (logForReferenceOrEdit.moodRating === 5) setWellbeingPreset('good');
        else if (logForReferenceOrEdit.moodRating === 3) setWellbeingPreset('neutral');
        else if (logForReferenceOrEdit.moodRating === 2) setWellbeingPreset('bad');

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
    setShowExitConfirmationModal(true);
  };
  
    const handleWellbeingPresetClick = (type: 'good' | 'neutral' | 'bad') => {
        setWellbeingPreset(type);
        // Auto-set mood rating based on preset for workout log compatibility
        if (type === 'good') setMoodRating(5);
        if (type === 'neutral') setMoodRating(3);
        if (type === 'bad') setMoodRating(2);
    };

    const handleFinalSave = async () => {
        setIsSaving(true);
        setHasSaved(false);

        const currentLogEntries = logEntries as Map<string, SetDetail[]>;
        const finalEntries: WorkoutExerciseLog[] = Array.from((currentLogEntries || new Map<string, SetDetail[]>()).entries()).map(([exerciseId, sets]) => {
            const typedSets = sets as SetDetail[];
            const cleanedSets = (typedSets || []).map(s => {
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
            return { exerciseId, loggedSets: cleanedSets };
        }).filter(entry => (entry.loggedSets || []).length > 0);

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
            rpe: rpe || undefined,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
            selectedExercisesForModifiable: workout.isModifiable ? exercisesToLog : undefined,
        };
        
        // Create specific wellbeing data based on the preset
        let wellbeingData = undefined;
        if (wellbeingPreset) {
            if (wellbeingPreset === 'good') wellbeingData = { stress: 1, energy: 5, sleep: 5, mood: 5 };
            if (wellbeingPreset === 'neutral') wellbeingData = { stress: 3, energy: 3, sleep: 3, mood: 3 };
            if (wellbeingPreset === 'bad') wellbeingData = { stress: 4, energy: 2, sleep: 2, mood: 2 };
        }

        try {
            await onSaveLog(logData, wellbeingData);
            if (storageKey) {
                localStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.error(error); // Error is alerted in parent
            setIsSaving(false); // Reset button on failure
        }
    };
  
  const handleSelectBlock = (blockId: string) => {
    const block = workout.blocks.find(b => b.id === blockId);
    setActiveBlockId(blockId);

    if (block?.isQuickLogEnabled) {
      // FIX: Add optional chaining and fallback empty array
      const hasTemplateEntries = (block?.exercises || []).some(ex => (logEntries.get(ex.id) || []).length > 0);
      if (!hasTemplateEntries) {
        setLogEntries((prev) => {
          const newLogs = new Map(prev as Map<string, SetDetail[]>);
          // FIX: Add optional chaining and fallback empty array
          (block?.exercises || []).forEach(exercise => {
            const newSet: SetDetail = {
              id: crypto.randomUUID(),
              reps: '', weight: '', distanceMeters: '', durationSeconds: '', caloriesKcal: '', isCompleted: false,
            };
            newLogs.set(exercise.id, [newSet]);
          });
          return newLogs;
        });
      }
      setQuickLogStep('template');
      setQuickLogTotalRounds('1');
      setCurrentView('logging_quick_block');
    } else {
      setCurrentStepInBlock(0);
      setCurrentView('logging_block');
    }
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
    
    setLogEntries((prev: Map<string, SetDetail[]>) => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        const updatedSets = sets.map(set => set.id === setId ? { ...set, [field]: processedValue } : set);
        newLogs.set(exerciseId, updatedSets);
        return newLogs;
    });
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
     setLogEntries((prev: Map<string, SetDetail[]>) => {
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
        if (block.isQuickLogEnabled) continue; // Skip validation for quick-log blocks
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
        if (block.isQuickLogEnabled) continue;
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
    if (currentView === 'logging_block' && !validateActiveBlock()) return;
    
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

  // --- Quick Log Specific Handlers ---
  const handleLogAndAction = (action: 'finish' | 'review') => {
    if (!activeBlock) return;
    const totalRounds = Number(quickLogTotalRounds);
    if (isNaN(totalRounds) || totalRounds <= 0) {
      alert("Ange ett giltigt antal varv (större än 0).");
      return;
    }
  
    // Validate template round
    for (const exercise of activeBlock.exercises) {
        const templateSets = (logEntries.get(exercise.id) || []) as SetDetail[];
        if (templateSets.length === 0) {
            alert(`Logga minst ett set för "${exercise.name}" som mall.`);
            return;
        }
        if (!validateSetsFilled(exercise, templateSets)) {
            alert(`Fyll i mallen för "${exercise.name}" korrekt.`);
            return;
        }
    }

    setLogEntries((prev: Map<string, SetDetail[]>) => {
        const newLogs = new Map(prev);
        activeBlock.exercises.forEach(ex => {
            const templateSets = (newLogs.get(ex.id) || []) as SetDetail[];
            if (templateSets.length === 0) return;

            const expandedSets: SetDetail[] = [];
            for (let i = 0; i < totalRounds; i++) {
                templateSets.forEach(templateSet => {
                    expandedSets.push({
                        ...templateSet,
                        id: crypto.randomUUID(),
                        isCompleted: true, // Mark all as complete immediately
                    });
                });
            }
            newLogs.set(ex.id, expandedSets);
        });
        
        if (action === 'finish') {
            const virtualExerciseId = `QUICK_LOG_BLOCK_ID::${activeBlock.id}`;
            newLogs.set(virtualExerciseId, [{
                id: crypto.randomUUID(),
                reps: totalRounds,
                isCompleted: true
            }]);
        }
        return newLogs;
    });

    if (action === 'finish') {
        handleBackToBlockSelection();
    } else { // action === 'review'
        setQuickLogStep('review');
    }
  };

  const handleBackToTemplate = () => {
    if (!activeBlock) return;
    setLogEntries((prev: Map<string, SetDetail[]>) => {
        const newLogs = new Map(prev);
        activeBlock.exercises.forEach(ex => {
            newLogs.delete(ex.id);
        });
        return newLogs;
    });
    setQuickLogStep('template');
  };

  const handleFinishQuickLogBlock = () => {
    if (!activeBlock) return;
    if (!validateActiveBlock()) return;

    // Add virtual entry for summary modal compatibility
    setLogEntries((prev: Map<string, SetDetail[]>) => {
      const newLogs = new Map(prev);
      const virtualExerciseId = `QUICK_LOG_BLOCK_ID::${activeBlock.id}`;
      const totalRounds = Number(quickLogTotalRounds);
      
      if (totalRounds > 0) {
        newLogs.set(virtualExerciseId, [{
          id: crypto.randomUUID(),
          reps: totalRounds,
          isCompleted: true
        }]);
      }
      return newLogs;
    });
  
    handleBackToBlockSelection();
  };
  
  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
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
                    <Button onClick={handleAttemptClose} variant="danger" className="whitespace-nowrap flex-shrink-0 !px-4 !text-base sm:!px-6 sm:!text-lg">Avbryt & stäng</Button>
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
                    const isQuickLogBlock = block.isQuickLogEnabled;
                    const quickLogEntry = logEntries.get(`QUICK_LOG_BLOCK_ID::${block.id}`);
                    const hasLoggedQuickLog = isQuickLogBlock && quickLogEntry && (quickLogEntry || []).length > 0 && Number(quickLogEntry[0].reps) > 0;
                    const hasLoggedEntries = blockExercises.some(ex => (logEntries.get(ex.id) || []).length > 0);
                    
                    let blockStatus: 'Ej påbörjat' | 'Pågående' | 'Slutfört' = 'Ej påbörjat';
                    let statusClass = 'bg-slate-100 text-slate-600';
                    
                    if (hasLoggedQuickLog) {
                        blockStatus = 'Slutfört';
                        statusClass = 'bg-green-100 text-green-800';
                    } else if (hasLoggedEntries) {
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
                                <p className="text-base text-gray-500">{block.exercises.length} övningar {isQuickLogBlock && <span className="text-xs font-bold text-blue-600">(SNABBLOGG)</span>}</p>
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
        
        {currentView === 'logging_quick_block' && activeBlock && (
            <div className="space-y-6">
                <header>
                    <h1 className="text-3xl font-bold text-gray-800">{workout.title}</h1>
                    <p className="text-xl text-gray-600">{activeBlock.name || `Block ${workout.blocks.findIndex(b => b.id === activeBlock.id) + 1}`}</p>
                </header>

                {quickLogStep === 'template' && (
                    <div className="space-y-8 animate-fade-in">
                        <h2 className="text-2xl font-semibold text-gray-700">Steg 1: Logga ett "Mallvarv"</h2>
                        <p className="text-base text-gray-600">Fyll i reps och vikt för ett typiskt varv. Detta kommer att kopieras till alla andra varv.</p>
                        {activeBlock.exercises.map(ex => (
                            <ExerciseLogCard
                                key={ex.id}
                                exercise={ex}
                                logEntries={logEntries}
                                handleUpdateSet={handleUpdateSet}
                                setSetToRemove={setSetToRemove}
                                isNewSession={isNewSession}
                                myWorkoutLogs={myWorkoutLogs}
                                allWorkouts={allWorkouts}
                                logForReference={logForReferenceOrEdit}
                            />
                        ))}
                        <div className="p-4 bg-white rounded-lg border shadow-sm space-y-3">
                            <h2 className="text-2xl font-semibold text-gray-700">Steg 2: Ange totalt antal varv</h2>
                             <Input label="Antal varv totalt" type="number" value={quickLogTotalRounds} onChange={e => setQuickLogTotalRounds(e.target.value)} min="1" />
                        </div>
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t">
                            <div className="container mx-auto max-w-2xl flex items-center gap-2">
                                <Button variant="secondary" size="md" onClick={handleBackToBlockSelection} className="flex-1">Tillbaka</Button>
                                <Button variant="primary" size="md" onClick={() => handleLogAndAction('review')} className="flex-1">Logga & Granska</Button>
                            </div>
                        </div>
                    </div>
                )}
                
                {quickLogStep === 'review' && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-2xl font-semibold text-gray-700">Steg 3: Granska & Justera</h2>
                        <p className="text-base text-gray-600">Här är alla dina varv ifyllda. Justera vid behov och avsluta sedan blocket.</p>
                        <div className="space-y-4">
                            {activeBlock.exercises.map(ex => (
                                <ExerciseLogCard
                                    key={ex.id}
                                    exercise={ex}
                                    logEntries={logEntries}
                                    handleUpdateSet={handleUpdateSet}
                                    setSetToRemove={setSetToRemove}
                                    isNewSession={isNewSession}
                                    myWorkoutLogs={myWorkoutLogs}
                                    allWorkouts={allWorkouts}
                                    logForReference={logForReferenceOrEdit}
                                />
                            ))}
                        </div>
                         <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t">
                            <div className="container mx-auto max-w-2xl flex justify-between items-center">
                                <Button variant="outline" size="lg" onClick={handleBackToTemplate}>Tillbaka till Mall</Button>
                                <Button variant="primary" size="lg" onClick={handleFinishQuickLogBlock}>Avsluta block</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {currentView === 'logging_block' && activeBlock && currentGroup && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{workout.title}</h1>
                    <p className="text-xl text-gray-600">{activeBlock.name || `Block ${workout.blocks.findIndex(b => b.id === activeBlock.id) + 1}`}</p>
                </div>
                <Button onClick={handleAttemptClose} variant="danger">Avbryt & stäng</Button>
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
            
            {/* Wellbeing Presets - Compact Layout */}
            <div className="space-y-4">
                 <h3 className="text-lg font-semibold text-gray-800">Hur känns kroppen idag?</h3>
                 <div className="grid grid-cols-3 gap-2">
                    <button 
                        type="button"
                        onClick={() => handleWellbeingPresetClick('good')}
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
                        onClick={() => handleWellbeingPresetClick('neutral')}
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
                        onClick={() => handleWellbeingPresetClick('bad')}
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

            {/* RPE - Ansträngning */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">Hur jobbigt var det? (RPE 1-10)</h3>
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
                            <li><span className="font-semibold">4-6:</span> Medel.</li>
                            <li><span className="font-semibold">7-8:</span> Jobbigt.</li>
                            <li><span className="font-semibold">9:</span> Mycket jobbigt.</li>
                            <li><span className="font-semibold">10:</span> Sjukt jobbigt.</li>
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-10 gap-1 pb-2">
                    {Array.from({length: 10}, (_, i) => i + 1).map(num => {
                        let colorClass = "bg-green-100 text-green-800 border-green-200";
                        if (num > 4) colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                        if (num > 7) colorClass = "bg-red-100 text-red-800 border-red-200";

                        return (
                            <button
                                key={num}
                                onClick={() => setRpe(num)}
                                className={`
                                    w-full aspect-[3/4] sm:h-12 sm:aspect-auto rounded-md border font-bold text-lg transition-all duration-200
                                    ${rpe === num ? `${colorClass.replace('100', '500').replace('800', 'white')} scale-110 shadow-md ring-1 ring-offset-1 ring-gray-300` : `${colorClass} hover:opacity-80`}
                                `}
                            >
                                {num}
                            </button>
                        )
                    })}
                </div>
            </div>
            
            {/* Taggar */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Beskriv passet med taggar</h3>
                <div className="flex flex-wrap gap-2">
                    {FEEDBACK_TAGS.map(tag => (
                        <button 
                            key={tag}
                            onClick={() => handleToggleTag(tag)}
                            className={`
                                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
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

            <Textarea label="Kommentar (valfri)" value={postWorkoutComment} onChange={(e) => setPostWorkoutComment(e.target.value)} placeholder="Hur kändes passet?" rows={4} />
            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t">
              <Button onClick={() => setCurrentView('block_selection')} variant="outline" size="lg">Tillbaka till block</Button>
              <Button onClick={handleFinalSave} size="lg" disabled={isSaving}>{isSaving ? 'Sparar...' : 'Spara & Avsluta'}</Button>
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
        title="Är du säker?"
        message="Dina loggade set för detta pass kommer inte att sparas. Vill du verkligen avbryta?"
        confirmButtonText="Ja, avbryt"
        cancelButtonText="Nej, fortsätt"
        confirmButtonVariant="danger"
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
