import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise, WorkoutBlock, ParticipantGoalData, LoggableMetric, ParticipantProfile, UserStrengthStat, ParticipantClubMembership } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ConfirmationModal } from '../ConfirmationModal';
import { CLUB_DEFINITIONS } from '../../constants';
import { MoodSelectorInput } from './MoodSelectorInput';

interface WorkoutLogFormProps {
  ai: GoogleGenAI | null;
  workout: Workout;
  allWorkouts: Workout[];
  logForReferenceOrEdit: WorkoutLog | undefined;
  isNewSession: boolean;
  onSaveLog: (log: WorkoutLog) => void;
  onClose: () => void;
  latestGoal: ParticipantGoalData | null;
  participantProfile: ParticipantProfile | null;
  latestStrengthStats: UserStrengthStat | null;
  myClubMemberships: ParticipantClubMembership[];
}

interface AiWorkoutTips {
  generalTips: string | null;
  exerciseTips: {
    exerciseName: string;
    tip: string;
  }[];
}

const formatPreviousSet = (setData: Partial<SetDetail>): string => {
    const parts = [];
    if (setData.reps !== undefined && setData.reps !== null && String(setData.reps).trim()) parts.push(`${setData.reps}r`);
    if (setData.weight !== undefined && setData.weight !== null && String(setData.weight).trim()) parts.push(`${setData.weight}kg`);
    if (setData.distanceMeters !== undefined && setData.distanceMeters !== null && String(setData.distanceMeters).trim()) parts.push(`${setData.distanceMeters}m`);
    if (setData.durationSeconds !== undefined && setData.durationSeconds !== null && String(setData.durationSeconds).trim()) parts.push(`${setData.durationSeconds}s`);
    if (setData.caloriesKcal !== undefined && setData.caloriesKcal !== null && String(setData.caloriesKcal).trim()) parts.push(`${setData.caloriesKcal}kcal`);
    
    const weightIndex = parts.findIndex(p => p.includes('kg'));
    if (weightIndex > 0) {
        const weightPart = parts.splice(weightIndex, 1)[0];
        return `${parts.join(', ')} @ ${weightPart}`;
    }

    return parts.join(', ');
};

const calculateEstimated1RM = (weightStr?: number | string, repsStr?: number | string): number | null => {
    const weight = parseFloat(String(weightStr || '').replace(',', '.'));
    const reps = parseInt(String(repsStr || ''), 10);

    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return null;
    }
    
    if (reps > 12) {
        return null;
    }

    if (reps === 1) {
        return weight;
    }

    // Brzycki Formula
    const e1RM = weight / (1.0278 - (0.0278 * reps));

    if (e1RM < weight) {
        return null;
    }

    return (Math.round(e1RM * 2) / 2);
};


const CheckmarkButton: React.FC<{ isCompleted: boolean; onClick: () => void; }> = ({ isCompleted, onClick }) => {
  const baseClasses = 'w-16 h-12 flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 border';
  
  const stateClasses = isCompleted
    ? 'bg-flexibel text-white border-flexibel focus:ring-flexibel'
    : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300 focus:ring-gray-400';
  
  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${stateClasses}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
};

interface QuickLogSummary {
  sets: string;
  reps: string;
  weight: string;
  distanceMeters: string;
  durationSeconds: string;
  caloriesKcal: string;
}

const AiCoachIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-flexibel" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);


export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
    ai,
    workout,
    allWorkouts,
    logForReferenceOrEdit,
    isNewSession,
    onSaveLog,
    onClose,
    latestGoal,
    participantProfile,
    latestStrengthStats,
    myClubMemberships,
}) => {
  type LogView = 'block_selection' | 'logging_block' | 'finalizing';

  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const [initialLogEntries, setInitialLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [initialPostWorkoutComment, setInitialPostWorkoutComment] = useState('');
  const [initialMoodRating, setInitialMoodRating] = useState<number | null>(null);
  
  const [aiTips, setAiTips] = useState<AiWorkoutTips | null>(null);
  const [isLoadingAiTips, setIsLoadingAiTips] = useState(false);
  const [isAiTipsVisible, setIsAiTipsVisible] = useState(true);

  const [currentView, setCurrentView] = useState<LogView>('block_selection');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentStepInBlock, setCurrentStepInBlock] = useState(0);
  
  const formTopRef = useRef<HTMLDivElement>(null);
  
  const [quickLogSummaries, setQuickLogSummaries] = useState<Map<string, QuickLogSummary>>(new Map());
  const [exerciseOverrides, setExerciseOverrides] = useState<Map<string, Partial<Exercise>>>(new Map());

  const [setToRemove, setSetToRemove] = useState<{ exerciseId: string; setIndex: number } | null>(null);


  const exercisesToLog = useMemo(() => {
    return workout.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]);
  }, [workout.blocks]);

  const hasLoggedData = useMemo(() => {
    if (logEntries.size === 0) return false;
    for (const sets of logEntries.values()) {
        for (const set of sets) {
            // A set is considered logged if it has any value in any of its metric fields.
            if (String(set.reps || '').trim() ||
                String(set.weight || '').trim() ||
                String(set.distanceMeters || '').trim() ||
                String(set.durationSeconds || '').trim() ||
                String(set.caloriesKcal || '').trim()) {
                return true;
            }
        }
    }
    return false;
  }, [logEntries]);
  
  const handleAddSet = useCallback((exerciseId: string) => {
    const exercise = exercisesToLog.find(ex => ex.id === exerciseId);
    let prefilledData: Partial<Omit<SetDetail, 'id'|'isCompleted'>> = {};

    if (exercise) {
        const match = exercise.notes.match(/PREFILL:([^=]+)=([^;]+)/);
        if (match) {
            const [, key, value] = match;
            prefilledData[key as keyof typeof prefilledData] = value;
        }
    }

    setLogEntries(prev => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        
        if (sets.length > 0) {
            const lastSet = sets[sets.length - 1];
            if (lastSet.weight !== undefined && lastSet.weight !== null) {
                prefilledData.weight = lastSet.weight;
            }
        }

        const newSet: SetDetail = {
            id: crypto.randomUUID(),
            isCompleted: false,
            ...prefilledData
        };
        newLogs.set(exerciseId, [...sets, newSet]);
        return newLogs;
    });
  }, [exercisesToLog]);

  const handleAddSetToSuperset = useCallback((supersetExercises: Exercise[]) => {
    setLogEntries(prev => {
        const newLogs = new Map(prev);
        supersetExercises.forEach(ex => {
            let prefilledData: Partial<Omit<SetDetail, 'id'|'isCompleted'>> = {};
            const match = ex.notes.match(/PREFILL:([^=]+)=([^;]+)/);
            if (match) {
                const [, key, value] = match;
                prefilledData[key as keyof typeof prefilledData] = value;
            }

            const sets = newLogs.get(ex.id) || [];
            if (sets.length > 0) {
                const lastSet = sets[sets.length - 1];
                if (lastSet.weight !== undefined && lastSet.weight !== null) {
                    prefilledData.weight = lastSet.weight;
                }
            }

            const newSet: SetDetail = { 
                id: crypto.randomUUID(), 
                isCompleted: false,
                ...prefilledData
            };
            newLogs.set(ex.id, [...sets, newSet]);
        });
        return newLogs;
    });
  }, []);

  const activeBlock = useMemo(() => {
    if (!activeBlockId) return null;
    return workout.blocks.find(b => b.id === activeBlockId);
  }, [activeBlockId, workout.blocks]);

  const exerciseGroups = useMemo(() => {
    if (!activeBlock || activeBlock.isQuickLogEnabled) return [];
    
    const groups: { type: 'single' | 'superset', id: string, exercises: Exercise[] }[] = [];
    const processedIds = new Set<string>();

    const exercisesInBlock = activeBlock.exercises || [];

    exercisesInBlock.forEach(exercise => {
        if (processedIds.has(exercise.id)) return;

        if (exercise.supersetIdentifier) {
            const supersetExercises = exercisesInBlock.filter(
                e => e.supersetIdentifier === exercise.supersetIdentifier
            ).sort((a,b) => exercisesInBlock.indexOf(a) - exercisesInBlock.indexOf(b)); // Keep original order
            
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

  useEffect(() => {
    if (isNewSession && currentGroup) {
      const firstExercise = currentGroup.exercises[0];
      const sets = logEntries.get(firstExercise.id);

      if (!sets || sets.length === 0) {
        if (currentGroup.type === 'single') {
          handleAddSet(firstExercise.id);
        } else if (currentGroup.type === 'superset') {
          handleAddSetToSuperset(currentGroup.exercises);
        }
      }
    }
  }, [isNewSession, currentGroup, logEntries, handleAddSet, handleAddSetToSuperset]);


  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockSentinelRef.current = await navigator.wakeLock.request('screen');
          wakeLockSentinelRef.current.addEventListener('release', () => {});
        } catch (err) {
          const typedError = err as Error;
          console.error(`WorkoutLogForm: Failed to acquire screen wake lock: ${typedError.name}, ${typedError.message}`);
        }
      } else {
        console.warn('WorkoutLogForm: Screen Wake Lock API not supported.');
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (wakeLockSentinelRef.current !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleVisibilityChange);
    return () => {
      if (wakeLockSentinelRef.current !== null) {
        wakeLockSentinelRef.current.release()
          .then(() => { wakeLockSentinelRef.current = null; })
          .catch((err) => { const typedError = err as Error; console.error(`WorkoutLogForm: Failed to release screen wake lock: ${typedError.name}, ${typedError.message}`); });
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const newLogEntries = new Map<string, SetDetail[]>();
    let newPostWorkoutComment = '';
    
    const sourceExercisesForInit =
        (!isNewSession && logForReferenceOrEdit?.selectedExercisesForModifiable && logForReferenceOrEdit.selectedExercisesForModifiable.length > 0)
        ? logForReferenceOrEdit.selectedExercisesForModifiable
        : exercisesToLog;

    if (!isNewSession && logForReferenceOrEdit) {
        sourceExercisesForInit.forEach(ex => {
            const loggedEntry = logForReferenceOrEdit.entries.find(e => e.exerciseId === ex.id);
            if (loggedEntry && loggedEntry.loggedSets && loggedEntry.loggedSets.length > 0) {
                newLogEntries.set(ex.id, loggedEntry.loggedSets.map(s => ({
                    ...s, id: s.id || crypto.randomUUID(),
                    reps: s.reps !== undefined && s.reps !== null ? String(s.reps) : '',
                    weight: s.weight !== undefined && s.weight !== null ? String(s.weight) : '',
                    distanceMeters: s.distanceMeters !== undefined && s.distanceMeters !== null ? String(s.distanceMeters) : '',
                    durationSeconds: s.durationSeconds !== undefined && s.durationSeconds !== null ? String(s.durationSeconds) : '',
                    caloriesKcal: s.caloriesKcal !== undefined && s.caloriesKcal !== null ? String(s.caloriesKcal) : '',
                })));
            }
        });
        newPostWorkoutComment = logForReferenceOrEdit.postWorkoutComment || '';
        const initialMood = logForReferenceOrEdit.moodRating ?? null;
        setInitialMoodRating(initialMood);
        setMoodRating(initialMood);
    }

    setLogEntries(newLogEntries);
    setInitialLogEntries(new Map(newLogEntries));
    setPostWorkoutComment(newPostWorkoutComment);
    setInitialPostWorkoutComment(newPostWorkoutComment);

    const newQuickLogSummaries = new Map<string, QuickLogSummary>();
    workout.blocks.forEach(block => {
        if (block.isQuickLogEnabled) {
            (block.exercises || []).forEach(ex => {
                const setsForEx = newLogEntries.get(ex.id) || [];
                if (setsForEx.length > 0) { // Existing log being edited
                    const firstSet = setsForEx[0];
                    newQuickLogSummaries.set(ex.id, {
                        sets: String(setsForEx.length),
                        reps: String(firstSet.reps || ''),
                        weight: String(firstSet.weight || ''),
                        distanceMeters: String(firstSet.distanceMeters || ''),
                        durationSeconds: String(firstSet.durationSeconds || ''),
                        caloriesKcal: String(firstSet.caloriesKcal || ''),
                    });
                } else { // New log session
                    const summary: QuickLogSummary = { 
                        sets: String(ex.notes.match(/(\d+)\s*set/)?.[1] || ''), 
                        reps: '', 
                        weight: '', 
                        distanceMeters: '', 
                        durationSeconds: '', 
                        caloriesKcal: '' 
                    };
                    const match = ex.notes.match(/PREFILL:([^=]+)=([^;]+)/);
                    if (match) {
                        const [, key, value] = match;
                        if (Object.prototype.hasOwnProperty.call(summary, key)) {
                            (summary as any)[key] = value;
                        }
                    }
                    newQuickLogSummaries.set(ex.id, summary);
                }
            });
        }
    });
    setQuickLogSummaries(newQuickLogSummaries);
    setExerciseOverrides(new Map());

  }, [isNewSession, logForReferenceOrEdit, exercisesToLog, workout.blocks]);

  useEffect(() => {
    const getAiTips = async () => {
        if (!ai || !isNewSession || !logForReferenceOrEdit) {
            return;
        }

        setIsLoadingAiTips(true);
        setIsAiTipsVisible(true);
        setAiTips(null);

        try {
            const previousPerformance = logForReferenceOrEdit.entries.map(entry => {
                const exercise = exercisesToLog.find(e => e.id === entry.exerciseId);
                if (!exercise) return null;
                const sets = entry.loggedSets.map(s => {
                    let parts = [];
                    if (s.reps !== undefined && s.reps !== null) parts.push(`${s.reps} reps`);
                    if (s.weight !== undefined && s.weight !== null) parts.push(`@ ${s.weight} kg`);
                    if (s.distanceMeters) parts.push(`${s.distanceMeters} m`);
                    if (s.durationSeconds) parts.push(`${s.durationSeconds} s`);
                    if (s.caloriesKcal) parts.push(`${s.caloriesKcal} kcal`);
                    return parts.join(' ');
                }).join(', ');
                return `${exercise.name}: ${sets}`;
            }).filter(Boolean).join('\n');

            const prompt = `
            Du är Flexibot, en motiverande och kunnig AI-träningscoach. En medlem ska precis starta passet "${workout.title}" som de har kört tidigare. Ge dem peppande och användbara tips baserat på deras senaste prestation.
            
            Senaste prestation i detta pass:
            ${previousPerformance}

            Medlemmens nuvarande mål: "${latestGoal?.fitnessGoals || 'Inget specifikt mål satt'}"

            Ditt uppdrag:
            1.  Ge ett allmänt, peppande tips för hela passet.
            2.  Ge 2-3 specifika, action-orienterade tips för några av nyckelövningarna. Föreslå små förbättringar, som att öka vikten lite, sikta på ett rep till, eller fokusera på en teknisk detalj. Var positiv! Exempel: "På Knäböj gjorde du 8 reps på 50kg. Sikta på 9 reps den här gången om det känns bra!"
            
            Returnera ditt svar som ett JSON-objekt med exakt denna struktur:
            {
              "generalTips": "Din allmänna peppande kommentar här.",
              "exerciseTips": [
                { "exerciseName": "Namn på övning 1", "tip": "Ditt specifika tips för övning 1." },
                { "exerciseName": "Namn på övning 2", "tip": "Ditt specifika tips för övning 2." }
              ]
            }
            `;
            
            const responseSchema = {
              type: Type.OBJECT,
              properties: {
                generalTips: { type: Type.STRING, description: "Ett allmänt, peppande tips för hela passet." },
                exerciseTips: {
                  type: Type.ARRAY,
                  description: "En lista med specifika tips för enskilda övningar.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      exerciseName: { type: Type.STRING, description: "Namnet på övningen tipset gäller." },
                      tip: { type: Type.STRING, description: "Det specifika, action-orienterade tipset." }
                    },
                    required: ["exerciseName", "tip"]
                  }
                }
              },
              required: ["generalTips", "exerciseTips"]
            };
            
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });
            const parsedResponse = JSON.parse(response.text);
            setAiTips(parsedResponse);
        } catch (error) {
            console.error("Error fetching AI workout tips:", error);
        } finally {
            setIsLoadingAiTips(false);
        }
    };

    getAiTips();
  }, [ai, isNewSession, logForReferenceOrEdit, workout, latestGoal, exercisesToLog]);

  const hasUnsavedChanges = useMemo(() => {
    if (postWorkoutComment !== initialPostWorkoutComment) return true;
    if (moodRating !== initialMoodRating) return true;

    const initialEntriesString = JSON.stringify(Array.from(initialLogEntries.entries()));
    const currentEntriesString = JSON.stringify(Array.from(logEntries.entries()));
    
    return initialEntriesString !== currentEntriesString;
  }, [logEntries, postWorkoutComment, moodRating, initialLogEntries, initialPostWorkoutComment, initialMoodRating]);

  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmationModal(true);
    } else {
      onClose();
    }
  };

  const handleFinalSave = () => {
    setIsSaving(true);
    setHasSaved(false);

    if (activeBlock && activeBlock.isQuickLogEnabled) {
        syncQuickLogSummariesToLogEntries(activeBlock.id);
    }

    const finalEntries: WorkoutExerciseLog[] = [];
    logEntries.forEach((sets, exerciseId) => {
        const cleanedSets = sets.map(s => ({
            ...s,
            reps: String(s.reps || '').trim() ? Number(String(s.reps).replace(',', '.')) : undefined,
            weight: String(s.weight || '').trim() ? Number(String(s.weight).replace(',', '.')) : undefined,
            distanceMeters: String(s.distanceMeters || '').trim() ? Number(String(s.distanceMeters).replace(',', '.')) : undefined,
            durationSeconds: String(s.durationSeconds || '').trim() ? Number(String(s.durationSeconds).replace(',', '.')) : undefined,
            caloriesKcal: String(s.caloriesKcal || '').trim() ? Number(String(s.caloriesKcal).replace(',', '.')) : undefined,
        })).filter(s => 
            s.reps !== undefined ||
            s.weight !== undefined ||
            s.distanceMeters !== undefined ||
            s.durationSeconds !== undefined ||
            s.caloriesKcal !== undefined
        );
        if (cleanedSets.length > 0) {
            finalEntries.push({
                exerciseId: exerciseId,
                loggedSets: cleanedSets,
            });
        }
    });

    const logData: WorkoutLog = {
      type: 'workout',
      id: !isNewSession && logForReferenceOrEdit ? logForReferenceOrEdit.id : crypto.randomUUID(),
      workoutId: workout.id,
      participantId: '', // Will be set in ParticipantArea
      entries: finalEntries,
      completedDate: !isNewSession && logForReferenceOrEdit ? logForReferenceOrEdit.completedDate : new Date().toISOString(),
      postWorkoutComment: postWorkoutComment.trim(),
      moodRating: moodRating || undefined,
      selectedExercisesForModifiable: workout.isModifiable ? exercisesToLog : undefined,
    };
    onSaveLog(logData);
    setHasSaved(true);
  };
  
  const syncQuickLogSummariesToLogEntries = (blockId: string) => {
    const block = workout.blocks.find(b => b.id === blockId);
    if (!block || !block.isQuickLogEnabled) return;

    setLogEntries(prev => {
        const newLogs = new Map(prev);
        (block.exercises || []).forEach(ex => {
            const override = exerciseOverrides.get(ex.id);
            const effectiveExercise = { ...ex, ...override };

            const summary = quickLogSummaries.get(ex.id);
            if (!summary || !summary.sets) {
                newLogs.delete(ex.id);
                return;
            }

            const numSets = parseInt(summary.sets, 10);
            if (isNaN(numSets) || numSets <= 0) {
                newLogs.delete(ex.id);
                return;
            }
            
            const metricsToSave = effectiveExercise.loggableMetrics || ['reps', 'weight'];

            const newSetDetails: SetDetail[] = [];
            for (let i = 0; i < numSets; i++) {
                newSetDetails.push({
                    id: crypto.randomUUID(),
                    isCompleted: true,
                    reps: metricsToSave.includes('reps') && summary.reps ? Number(String(summary.reps).replace(',', '.')) : undefined,
                    weight: metricsToSave.includes('weight') && summary.weight ? Number(String(summary.weight).replace(',', '.')) : undefined,
                    distanceMeters: metricsToSave.includes('distance') && summary.distanceMeters ? Number(String(summary.distanceMeters).replace(',', '.')) : undefined,
                    durationSeconds: metricsToSave.includes('duration') && summary.durationSeconds ? Number(String(summary.durationSeconds).replace(',', '.')) : undefined,
                    caloriesKcal: metricsToSave.includes('calories') && summary.caloriesKcal ? Number(String(summary.caloriesKcal).replace(',', '.')) : undefined,
                });
            }
            newLogs.set(ex.id, newSetDetails);
        });
        return newLogs;
    });
};

  const leaveBlockView = (callback: () => void) => {
    if (activeBlock && activeBlock.isQuickLogEnabled) {
        syncQuickLogSummariesToLogEntries(activeBlock.id);
    }
    callback();
  };

  const handleSelectBlock = (blockId: string) => {
    leaveBlockView(() => {
        setActiveBlockId(blockId);
        setCurrentStepInBlock(0);
        setCurrentView('logging_block');
        if (formTopRef.current) {
            formTopRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    });
  };
  
  const handleUpdateSet = (exerciseId: string, setIndex: number, field: keyof SetDetail, value: any) => {
    setLogEntries(prev => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        const updatedSets = [...sets];
        if (updatedSets[setIndex]) {
            updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: value };
            newLogs.set(exerciseId, updatedSets);
        }
        return newLogs;
    });
  };

  const handleUpdateQuickLogSummary = (exerciseId: string, field: keyof QuickLogSummary, value: string) => {
    setQuickLogSummaries(prev => {
        const newSummaries = new Map(prev);
        const currentSummary = newSummaries.get(exerciseId) || { sets: '', reps: '', weight: '', distanceMeters: '', durationSeconds: '', caloriesKcal: '' };
        newSummaries.set(exerciseId, { ...currentSummary, [field]: value });
        return newSummaries;
    });
  };

  const handleRemoveSet = (exerciseId: string, setIndex: number) => {
     setLogEntries(prev => {
        const newLogs = new Map(prev);
        const sets = newLogs.get(exerciseId) || [];
        if (sets.length > 0) {
            const updatedSets = sets.filter((_, i) => i !== setIndex);
            newLogs.set(exerciseId, updatedSets);
        }
        return newLogs;
    });
  };

  const handleConfirmRemoveSet = () => {
    if (setToRemove) {
        handleRemoveSet(setToRemove.exerciseId, setToRemove.setIndex);
    }
    setSetToRemove(null);
  };

  const handleToggleBodyweightOverride = useCallback((exercise: Exercise) => {
    const isCurrentlyBodyweight = (exerciseOverrides.get(exercise.id)?.isBodyweight) ?? exercise.isBodyweight;
    
    setExerciseOverrides(prev => {
        const newOverrides = new Map(prev);
        if (isCurrentlyBodyweight) {
            newOverrides.delete(exercise.id);
        } else {
            newOverrides.set(exercise.id, { isBodyweight: true, loggableMetrics: ['reps'] });
        }
        return newOverrides;
    });

    if (!isCurrentlyBodyweight && quickLogSummaries.has(exercise.id)) {
        setQuickLogSummaries(prev => {
            const newSummaries = new Map(prev);
            const currentSummary = newSummaries.get(exercise.id);
            if (currentSummary) {
                newSummaries.set(exercise.id, { ...currentSummary, weight: '' });
            }
            return newSummaries;
        });
    }
  }, [exerciseOverrides, quickLogSummaries]);
  
  const handleBackToBlockSelection = () => {
    leaveBlockView(() => {
        setCurrentView('block_selection');
        if (formTopRef.current) {
            formTopRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    });
  };
  
  const handleNextStep = () => {
    if (!activeBlock) return;
  
    if (activeBlock.isQuickLogEnabled) {
      // For quick log, "Next" always means finishing the block.
      handleBackToBlockSelection();
      return;
    }
  
    const isLastStepInBlock = currentStepInBlock >= exerciseGroups.length - 1;
    if (isLastStepInBlock) {
      handleBackToBlockSelection();
    } else {
      setCurrentStepInBlock(prev => prev + 1);
      if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const handlePreviousStep = () => {
    if (!activeBlock) return;
  
    if (activeBlock.isQuickLogEnabled) {
      // For quick log, "Previous" should take you back to block selection.
      handleBackToBlockSelection();
      return;
    }
  
    if (currentStepInBlock > 0) {
      setCurrentStepInBlock(prev => prev - 1);
      if (formTopRef.current) formTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleBackToBlockSelection();
    }
  };
  
  if (isSaving) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
        <p className="mt-4 text-xl text-gray-600">{hasSaved ? "Passet är sparat! 🎉" : "Sparar ditt pass..."}</p>
      </div>
    );
  }
  
  const renderWorkoutOverview = () => {
    const getBlockStatus = (block: WorkoutBlock) => {
        const exercisesInBlock = block.exercises || [];
        if (exercisesInBlock.length === 0) return { text: 'Tomt', color: 'text-gray-400' };

        if (block.isQuickLogEnabled) {
            const firstExId = exercisesInBlock[0].id;
            const sets = logEntries.get(firstExId) || [];
            return sets.length > 0 && sets.every(s => s.isCompleted)
                ? { text: 'Slutfört', color: 'text-green-600' }
                : { text: 'Ej påbörjat', color: 'text-gray-500' };
        }

        const completedExercises = exercisesInBlock.filter(ex => {
            const sets = logEntries.get(ex.id) || [];
            return sets.length > 0 && sets.every(s => s.isCompleted);
        }).length;

        if (completedExercises === exercisesInBlock.length && exercisesInBlock.length > 0) {
            return { text: 'Slutfört', color: 'text-green-600' };
        }
        if (exercisesInBlock.some(ex => (logEntries.get(ex.id) || []).length > 0)) {
            return { text: 'Påbörjat', color: 'text-yellow-600' };
        }
        return { text: 'Ej påbörjat', color: 'text-gray-500' };
    };

    return (
        <div className="bg-gray-100 min-h-screen pb-28">
            <div className="bg-white p-4 shadow-sm">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">{workout.title}</h1>
                    <Button variant="outline" size="sm" onClick={handleAttemptClose}>Stäng</Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm bg-gray-200 text-gray-700 px-2 py-1 rounded-full">Kategori: {workout.category}</span>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {isAiTipsVisible && (isLoadingAiTips || aiTips) && (
                    <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 animate-fade-in-down">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                <AiCoachIcon />
                                <h3 className="font-semibold text-lg text-gray-800">Coachens Tips</h3>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="!p-1 h-auto"
                                onClick={() => setIsAiTipsVisible(false)}
                                aria-label="Dölj tips"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </Button>
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200 min-h-[100px]">
                            {isLoadingAiTips && (
                                <div className="flex flex-col items-center justify-center text-center p-4 text-blue-700">
                                    <svg className="w-12 h-12 animate-spin text-flexibel" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="font-semibold mt-3 text-lg">Flexibot analyserar...</p>
                                    <p className="text-sm text-blue-600">Skapar personliga tips baserat på ditt senaste pass.</p>
                                </div>
                            )}
                            {aiTips && !isLoadingAiTips && (
                                <div className="space-y-2 text-gray-700">
                                    {aiTips.generalTips && <p className="font-medium">💡 {aiTips.generalTips}</p>}
                                    {aiTips.exerciseTips && aiTips.exerciseTips.length > 0 && (
                                        <ul className="space-y-1 list-disc pl-5">
                                            {aiTips.exerciseTips.map((tip, index) => (
                                                <li key={index}><strong className="font-semibold">{tip.exerciseName}:</strong> {tip.tip}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <details className="bg-white p-4 rounded-lg shadow-sm" open>
                    <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between items-center">
                        Coaching & tips
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform duration-200 details-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="mt-3 pt-3 border-t space-y-3">
                        {workout.coachNote && (
                            <div>
                                <h4 className="font-semibold text-gray-800">Coachanteckning</h4>
                                <p className="text-gray-600 whitespace-pre-wrap">{workout.coachNote}</p>
                            </div>
                        )}
                    </div>
                </details>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-800 text-center">Redo att starta?</h2>
                    <p className="text-center text-gray-600 mb-4">Klicka på ett block för att börja logga.</p>
                    <div className="space-y-3">
                        {workout.blocks.map((block, index) => {
                            const status = getBlockStatus(block);
                            const badgeClasses: Record<string, string> = {
                                'text-green-600': 'bg-green-100 text-green-700',
                                'text-yellow-600': 'bg-yellow-100 text-yellow-700',
                                'text-gray-500': 'bg-gray-100 text-gray-600',
                                'text-gray-400': 'bg-gray-100 text-gray-500'
                            };
                            const badgeClass = badgeClasses[status.color as keyof typeof badgeClasses] || 'bg-gray-100 text-gray-600';

                            return (
                                <button key={block.id} onClick={() => handleSelectBlock(block.id)} className="w-full flex items-center justify-between p-4 rounded-xl bg-white shadow-xl border-2 border-transparent hover:border-flexibel focus:outline-none focus:ring-2 focus:ring-flexibel focus:ring-offset-2 transition-all duration-200">
                                    <div>
                                        <p className="font-semibold text-xl text-gray-800">{block.name || `Block ${index + 1}`}</p>
                                        <p className="text-sm text-gray-500">{(block.exercises || []).length} övningar</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${badgeClass}`}>{status.text}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-flexibel" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                <Button 
                    fullWidth 
                    size="lg" 
                    onClick={() => leaveBlockView(() => setCurrentView('finalizing'))}
                    disabled={!hasLoggedData}
                    title={!hasLoggedData ? "Logga minst ett set för att kunna avsluta passet." : "Avsluta och summera passet"}
                >
                    Färdig med passet, gå till avslut
                </Button>
            </div>
            <style>{`
                details > summary::-webkit-details-marker { display: none; }
                details[open] .details-arrow { transform: rotate(180deg); }
            `}</style>
        </div>
    );
  };

  const renderFinalizingView = () => (
    <div className="space-y-6 px-4 py-6 sm:px-6">
        <h3 className="text-3xl font-bold text-gray-800 text-center">Bra jobbat!</h3>
        <p className="text-center text-lg text-gray-600">Lägg till en kommentar och betygsätt passet för att slutföra.</p>
        <Textarea 
            label="Kommentar om passet (valfritt)"
            value={postWorkoutComment}
            onChange={(e) => setPostWorkoutComment(e.target.value)}
            placeholder="Hur kändes det? Något speciellt att notera?"
            rows={4}
        />
        <MoodSelectorInput
            currentRating={moodRating}
            onSelectRating={setMoodRating}
        />
        <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="ghost" onClick={() => handleBackToBlockSelection()}>Tillbaka till blocköversikt</Button>
            <Button size="lg" onClick={handleFinalSave}>Slutför & Spara Pass</Button>
        </div>
    </div>
  );
  
  return (
    <>
      <div className="bg-gray-50 min-h-screen">
        <div ref={formTopRef}>
            {currentView === 'block_selection' && renderWorkoutOverview()}
            {currentView === 'finalizing' && renderFinalizingView()}
            {currentView === 'logging_block' && activeBlock && (() => {
                const currentBlockIndex = workout.blocks.findIndex(b => b.id === activeBlockId);
                
                if (activeBlock.isQuickLogEnabled) {
                    return (
                        <>
                            <div className="px-4 py-6 sm:px-6 pb-28">
                                <div className="mb-6">
                                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{activeBlock.name || `Block ${currentBlockIndex + 1}`}</h1>
                                    <p className="mt-2 text-base text-gray-600">Logga dina resultat för varje övning. Om du gjorde samma reps och vikt på alla set, fyll i dem här tillsammans med totalt antal set.</p>
                                </div>
                                <div className="space-y-4">
                                  {(activeBlock.exercises || []).map(ex => {
                                      const override = exerciseOverrides.get(ex.id);
                                      const effectiveExercise = { ...ex, ...override };
                                      const effectiveIsBodyweight = effectiveExercise.isBodyweight;

                                      const summary = quickLogSummaries.get(ex.id) || { sets: '', reps: '', weight: '', distanceMeters: '', durationSeconds: '', caloriesKcal: '' };
                                      const defaultMetrics: LoggableMetric[] = ['reps', 'weight'];
                                      const metricsToShow = effectiveExercise.loggableMetrics?.length ? effectiveExercise.loggableMetrics : defaultMetrics;

                                      return (
                                          <div key={ex.id} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                                              <div className="flex justify-between items-start mb-2">
                                                  <div>
                                                      <p className="font-semibold text-gray-800 text-lg">{ex.name} {effectiveIsBodyweight && <span className="text-sm font-semibold text-green-600">(Kroppsvikt)</span>}</p>
                                                      <p className="text-sm text-gray-600">{ex.notes}</p>
                                                  </div>
                                                  <Button variant="ghost" size="sm" className="!text-xs flex-shrink-0" onClick={() => handleToggleBodyweightOverride(ex)}>
                                                      {effectiveIsBodyweight ? 'Logga med vikt' : 'Endast kroppsvikt'}
                                                  </Button>
                                              </div>
                                              <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                                                  <Input label="Totalt Set/Varv" type="tel" value={summary.sets} onChange={e => handleUpdateQuickLogSummary(ex.id, 'sets', e.target.value)} inputSize="sm" placeholder="Antal" containerClassName="flex-1 min-w-[100px]" />

                                                  {metricsToShow.includes('reps') && (
                                                      <Input label="Reps/varv" type="tel" value={summary.reps} onChange={e => handleUpdateQuickLogSummary(ex.id, 'reps', e.target.value)} inputSize="sm" placeholder="per set" containerClassName="flex-1 min-w-[70px]" />
                                                  )}
                                                  {metricsToShow.includes('weight') && (
                                                      <Input label="Vikt (kg)" type="tel" value={summary.weight} onChange={e => handleUpdateQuickLogSummary(ex.id, 'weight', e.target.value)} inputSize="sm" placeholder="per set" containerClassName="flex-1 min-w-[80px]" />
                                                  )}
                                                  
                                                  {metricsToShow.includes('duration') && (
                                                      <Input label="Tid (s)" type="tel" value={summary.durationSeconds} onChange={e => handleUpdateQuickLogSummary(ex.id, 'durationSeconds', e.target.value)} inputSize="sm" placeholder="per set" containerClassName="flex-1 min-w-[70px]" />
                                                  )}
                                                  {metricsToShow.includes('distance') && (
                                                      <Input label="Distans (m)" type="tel" value={summary.distanceMeters} onChange={e => handleUpdateQuickLogSummary(ex.id, 'distanceMeters', e.target.value)} inputSize="sm" placeholder="per set" containerClassName="flex-1 min-w-[80px]" />
                                                  )}
                                                  {metricsToShow.includes('calories') && (
                                                      <Input label="Kalorier (kcal)" type="tel" value={summary.caloriesKcal} onChange={e => handleUpdateQuickLogSummary(ex.id, 'caloriesKcal', e.target.value)} inputSize="sm" placeholder="per set" containerClassName="flex-1 min-w-[90px]" />
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                                </div>
                            </div>
                            <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-4 border-t">
                                <div className="container mx-auto flex justify-between items-center">
                                <Button variant="outline" onClick={handlePreviousStep}>
                                    Tillbaka
                                </Button>
                                <div className="text-center">
                                    <p className="font-bold text-gray-800">{activeBlock.name || `Block ${currentBlockIndex + 1}`}</p>
                                    <p className="text-sm text-gray-500">Snabbloggning</p>
                                </div>
                                <Button onClick={handleNextStep}>
                                    Avsluta block
                                </Button>
                                </div>
                            </div>
                        </>
                    );
                }
                
                const totalGroupsInBlock = exerciseGroups.length;
                const currentGroup = exerciseGroups[currentStepInBlock];
                if (!currentGroup) {
                    return (
                        <div className="px-4 py-10 text-center">
                            <p className="text-lg text-gray-500">Detta block har inga övningar.</p>
                            <Button onClick={handleNextStep} className="mt-4">
                                Gå till blocköversikt
                            </Button>
                        </div>
                    );
                }

                const isLastGroupInBlock = currentStepInBlock === totalGroupsInBlock - 1;
                const isFirstGroupInBlock = currentStepInBlock === 0;

                if (currentGroup.type === 'superset') {
                    return (
                        <>
                            <div className="px-4 py-6 sm:px-6 pb-28">
                                <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                                    <h1 className="text-3xl sm:text-4xl font-bold text-blue-800">Superset</h1>
                                    <p className="mt-2 text-base text-blue-700">Logga ett set för varje övning, vila, och lägg sedan till nästa set för hela gruppen.</p>
                                </div>

                                <div className="space-y-6">
                                    {currentGroup.exercises.map(exercise => {
                                        const loggedSets = logEntries.get(exercise.id) || [];
                                        const isOverriddenBodyweight = exerciseOverrides.get(exercise.id)?.isBodyweight;
                                        const effectiveIsBodyweight = isOverriddenBodyweight !== undefined ? isOverriddenBodyweight : exercise.isBodyweight;
                                        const isMainLift = ['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'].includes(exercise.name);
                                        const exerciseAiTip = isNewSession && aiTips?.exerciseTips.find(tip => tip.exerciseName === exercise.name);
                                        return (
                                            <div key={exercise.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-gray-800">{exercise.name} {effectiveIsBodyweight && <span className="text-sm font-semibold text-green-600">(Kroppsvikt)</span>}</h2>
                                                        <p className="mt-1 text-sm text-gray-600">Coach: {exercise.notes}</p>
                                                        {exerciseAiTip && (
                                                            <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-xs text-blue-800 rounded-r-lg animate-fade-in-down">
                                                                <p><span className="font-semibold">💡 Tips:</span> {exerciseAiTip.tip}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="!text-xs" onClick={() => handleToggleBodyweightOverride(exercise)}>
                                                        {effectiveIsBodyweight ? 'Logga med vikt' : 'Endast kroppsvikt'}
                                                    </Button>
                                                </div>
                                                <div className="mt-4 space-y-3">
                                                    {loggedSets.map((set, setIndex) => {
                                                        const previousSetData = isNewSession ? logForReferenceOrEdit?.entries.find(e => e.exerciseId === exercise.id)?.loggedSets[setIndex] : null;
                                                        const previousSetString = previousSetData ? formatPreviousSet(previousSetData) : null;
                                                        const override = exerciseOverrides.get(exercise.id);
                                                        const effectiveExercise = { ...exercise, ...override };

                                                        const defaultMetrics: LoggableMetric[] = ['reps', 'weight'];
                                                        const metricsToShow = effectiveExercise.isBodyweight
                                                            ? ['reps']
                                                            : (effectiveExercise.loggableMetrics?.length ? effectiveExercise.loggableMetrics : defaultMetrics);
                                                        const metricPlaceholders: Record<LoggableMetric, string> = { reps: 'Reps', weight: 'Vikt (kg)', distance: 'Distans (m)', duration: 'Tid (s)', calories: 'Kalorier (kcal)' };
                                                        const metricKeys: Record<LoggableMetric, keyof Omit<SetDetail, 'id' | 'isCompleted'>> = { reps: 'reps', weight: 'weight', distance: 'distanceMeters', duration: 'durationSeconds', calories: 'caloriesKcal' };
                                                        const e1RM = isMainLift ? calculateEstimated1RM(set.weight, set.reps) : null;
                                                        return (
                                                            <div key={set.id} className="flex flex-col bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                                                <div className="flex justify-between items-center text-sm min-h-[24px] px-1 mb-2">
                                                                    <div className="flex items-baseline gap-4">
                                                                        <p className="font-bold text-gray-700 text-lg">Set {setIndex + 1}</p>
                                                                        {previousSetString ? (<p className="text-gray-500" title={`Förra passet: ${previousSetString}`}>Förra: <span className="font-semibold">{previousSetString}</span></p>) : null}
                                                                    </div>
                                                                    {e1RM && (<div className="text-right"><p className="font-bold text-flexibel">e1RM: {e1RM.toFixed(1)} kg</p></div>)}
                                                                </div>
                                                                <div className="flex items-stretch gap-2 sm:gap-3">
                                                                    <div className="flex-grow flex items-stretch gap-2">
                                                                        <div className={`grid grid-cols-${metricsToShow.length === 1 ? '1' : Math.min(2, metricsToShow.length)} gap-2 flex-grow`}>
                                                                            {metricsToShow.map(metric => (
                                                                                <Input key={metric} type="tel" placeholder={metricPlaceholders[metric]} value={set[metricKeys[metric]] || ''} onChange={(e) => handleUpdateSet(exercise.id, setIndex, metricKeys[metric], e.target.value)} className="text-center" inputSize="md" />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={() => setSetToRemove({ exerciseId: exercise.id, setIndex: setIndex })} className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0" aria-label={`Ta bort set ${setIndex + 1}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                                                    <CheckmarkButton isCompleted={!!set.isCompleted} onClick={() => handleUpdateSet(exercise.id, setIndex, 'isCompleted', !set.isCompleted)} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-6">
                                    <Button 
                                    onClick={() => handleAddSetToSuperset(currentGroup.exercises)}
                                    variant="secondary"
                                    size="lg"
                                    fullWidth
                                    className="!rounded-xl"
                                    >
                                    Lägg till Set till Superset
                                    </Button>
                                </div>
                            </div>
                             <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-4 border-t">
                                <div className="container mx-auto flex justify-between items-center">
                                    <Button variant="outline" onClick={handlePreviousStep}>
                                        {isFirstGroupInBlock ? 'Tillbaka' : 'Föregående'}
                                    </Button>
                                    <div className="text-center">
                                        <p className="font-bold text-gray-800">{activeBlock.name || `Block ${currentBlockIndex + 1}`}</p>
                                        <p className="text-sm text-gray-500">Steg {currentStepInBlock + 1} av {totalGroupsInBlock}</p>
                                    </div>
                                    <Button onClick={handleNextStep}>
                                        {isLastGroupInBlock ? 'Avsluta block' : 'Nästa'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    );
                }
                
                const currentExercise = currentGroup.exercises[0];
                const loggedSets = logEntries.get(currentExercise.id) || [];
                const isOverriddenBodyweight = exerciseOverrides.get(currentExercise.id)?.isBodyweight;
                const effectiveIsBodyweight = isOverriddenBodyweight !== undefined ? isOverriddenBodyweight : currentExercise.isBodyweight;
                const isMainLift = ['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'].includes(currentExercise.name);
                const exerciseAiTip = isNewSession && aiTips?.exerciseTips.find(tip => tip.exerciseName === currentExercise.name);
                
                return (
                    <>
                    <div className="px-4 py-6 sm:px-6 pb-28">
                        <div className="mb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{currentExercise.name} {effectiveIsBodyweight && <span className="text-base align-middle font-semibold text-green-600">(Kroppsvikt)</span>}</h1>
                                    <p className="mt-2 text-base text-gray-600">Coach: {currentExercise.notes}</p>
                                    {exerciseAiTip && (
                                        <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-800 rounded-r-lg animate-fade-in-down">
                                            <p><span className="font-semibold">💡 Tips:</span> {exerciseAiTip.tip}</p>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" className="!text-xs flex-shrink-0" onClick={() => handleToggleBodyweightOverride(currentExercise)}>
                                    {effectiveIsBodyweight ? 'Logga med vikt' : 'Endast kroppsvikt'}
                                </Button>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                        {loggedSets.map((set, setIndex) => {
                            const previousSetData = isNewSession ? logForReferenceOrEdit?.entries.find(e => e.exerciseId === currentExercise.id)?.loggedSets[setIndex] : null;
                            const previousSetString = previousSetData ? formatPreviousSet(previousSetData) : null;
                            const override = exerciseOverrides.get(currentExercise.id);
                            const effectiveExercise = { ...currentExercise, ...override };
                            const defaultMetrics: LoggableMetric[] = ['reps', 'weight'];
                            const metricsToShow = effectiveExercise.isBodyweight ? ['reps'] : (effectiveExercise.loggableMetrics?.length ? effectiveExercise.loggableMetrics : defaultMetrics);
                            const metricPlaceholders: Record<LoggableMetric, string> = { reps: 'Reps', weight: 'Vikt (kg)', distance: 'Distans (m)', duration: 'Tid (s)', calories: 'Kalorier (kcal)' };
                            const metricKeys: Record<LoggableMetric, keyof Omit<SetDetail, 'id' | 'isCompleted'>> = { reps: 'reps', weight: 'weight', distance: 'distanceMeters', duration: 'durationSeconds', calories: 'caloriesKcal' };
                            const e1RM = isMainLift ? calculateEstimated1RM(set.weight, set.reps) : null;
                            return (
                                <div key={set.id} className="flex flex-col bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center text-sm min-h-[24px] px-1 mb-2">
                                        <div className="flex items-baseline gap-4">
                                            <p className="font-bold text-gray-700 text-lg">Set {setIndex + 1}</p>
                                            {previousSetString ? (<p className="text-gray-500" title={`Förra passet: ${previousSetString}`}>Förra: <span className="font-semibold">{previousSetString}</span></p>) : null}
                                        </div>
                                        {e1RM && (<div className="text-right"><p className="font-bold text-flexibel">e1RM: {e1RM.toFixed(1)} kg</p></div>)}
                                    </div>
                                    <div className="flex items-stretch gap-2 sm:gap-3">
                                        <div className="flex-grow flex items-stretch gap-2">
                                            <div className={`grid grid-cols-${metricsToShow.length === 1 ? '1' : Math.min(2, metricsToShow.length)} gap-2 flex-grow`}>
                                                {metricsToShow.map(metric => (
                                                    <Input key={metric} type="tel" placeholder={metricPlaceholders[metric]} value={set[metricKeys[metric]] || ''} onChange={(e) => handleUpdateSet(currentExercise.id, setIndex, metricKeys[metric], e.target.value)} className="text-center" inputSize="md" />
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => setSetToRemove({ exerciseId: currentExercise.id, setIndex: setIndex })} className="w-12 h-12 flex items-center justify-center rounded-lg bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0" aria-label={`Ta bort set ${setIndex + 1}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                        <CheckmarkButton isCompleted={!!set.isCompleted} onClick={() => handleUpdateSet(currentExercise.id, setIndex, 'isCompleted', !set.isCompleted)} />
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                        
                        <div className="mt-6">
                            <Button 
                            onClick={() => handleAddSet(currentExercise.id)}
                            variant="secondary"
                            size="lg"
                            fullWidth
                            className="!rounded-xl"
                            >
                            Lägg till Set
                            </Button>
                        </div>
                    </div>

                    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-4 border-t">
                        <div className="container mx-auto flex justify-between items-center">
                            <Button variant="outline" onClick={handlePreviousStep}>
                                {isFirstGroupInBlock ? 'Tillbaka' : 'Föregående'}
                            </Button>
                            <div className="text-center">
                                <p className="font-bold text-gray-800">{activeBlock.name || `Block ${currentBlockIndex + 1}`}</p>
                                <p className="text-sm text-gray-500">Steg {currentStepInBlock + 1} av {totalGroupsInBlock}</p>
                            </div>
                            <Button onClick={handleNextStep}>
                                {isLastGroupInBlock ? 'Avsluta block' : 'Nästa'}
                            </Button>
                        </div>
                    </div>
                    </>
                );
            })()}
        </div>
      </div>
      <ConfirmationModal
        isOpen={showExitConfirmationModal}
        onClose={() => setShowExitConfirmationModal(false)}
        onConfirm={onClose}
        title="Avsluta Passet?"
        message="Du har osparade ändringar. Är du säker på att du vill avsluta utan att spara?"
        confirmButtonText="Ja, avsluta"
      />
      <ConfirmationModal
        isOpen={!!setToRemove}
        onClose={() => setSetToRemove(null)}
        onConfirm={handleConfirmRemoveSet}
        title="Ta bort set?"
        message="Är du säker på att du vill ta bort detta set? Detta kan inte ångras."
        confirmButtonText="Ja, ta bort"
      />
    </>
  );
};