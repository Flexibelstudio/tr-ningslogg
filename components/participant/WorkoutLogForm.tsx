import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise, WorkoutBlock, ParticipantGoalData, LoggableMetric } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ConfirmationModal } from '../ConfirmationModal';
import { INTENSITY_LEVELS } from '../../constants';
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
}

// Chevron Icons (re-defined here for locality, could be moved to a shared util if used more broadly)
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 group-hover:text-white/80 transition-colors ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 group-hover:text-white/80 transition-colors ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const LinkIconSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-1.5-1.5a2 2 0 112.828-2.828l1.5 1.5a.5.5 0 00.707-.707l-1.5-1.5a3.5 3.5 0 00-4.95 4.95l-3 3a3.5 3.5 0 004.95 4.95l1.5-1.5a.5.5 0 00-.707-.707l-1.5 1.5a2 2 0 01-2.828-2.828l3-3a2 2 0 012.828 0z" clipRule="evenodd" />
  </svg>
);

const renderMarkdown = (text: string | null): JSX.Element | null => {
  if (!text) return null;
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .split('\n')
    .map((line, index) => `<p key=${index}>${line}</p>`)
    .join('');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

const formatPreviousSetDisplay = (setData: SetDetail, exerciseIsBodyweight?: boolean): string => {
    const parts: string[] = [];
    if (setData.reps) parts.push(`${setData.reps} reps`);
    if (setData.weight !== undefined && setData.weight !== null && String(setData.weight).trim() !== '') {
        if (exerciseIsBodyweight && Number(setData.weight) === 0) {
            // (KV) is only shown if there are no reps. If there are reps, it's implied.
            if (!setData.reps) parts.push(`(KV)`);
        } else {
            parts.push(`@ ${setData.weight} kg`);
        }
    }
    if (setData.distanceMeters) parts.push(`${setData.distanceMeters} m`);
    if (setData.durationSeconds) parts.push(`${setData.durationSeconds} sek`);
    if (setData.caloriesKcal) parts.push(`${setData.caloriesKcal} kcal`);

    if (parts.length === 0) return "Inga data";
    
    // Smart joining logic
    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
        if (i === 1 && parts[0].includes('reps') && parts[1].startsWith('@')) {
            result += ` ${parts[i]}`; // "12 reps @ 80 kg"
        } else {
            result += ` / ${parts[i]}`; // "1500 m / 300 sek"
        }
    }
    return result;
};


export const WorkoutLogForm: React.FC<WorkoutLogFormProps> = ({
    ai,
    workout,
    allWorkouts,
    logForReferenceOrEdit,
    isNewSession,
    onSaveLog,
    onClose,
    latestGoal
}) => {
  const [logEntries, setLogEntries] = useState<Map<string, SetDetail[]>>(new Map());
  const [postWorkoutComment, setPostWorkoutComment] = useState('');
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [showExitConfirmationModal, setShowExitConfirmationModal] = useState(false);
  const [showSubmitConfirmationModal, setShowSubmitConfirmationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);
  const [expandedBlocksInForm, setExpandedBlocksInForm] = useState<Set<string>>(new Set());
  
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isLoadingAiSuggestion, setIsLoadingAiSuggestion] = useState(false);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(true);

  const [quickLogRounds, setQuickLogRounds] = useState<Record<string, string>>({});
  const [quickLoggedSupersets, setQuickLoggedSupersets] = useState<Record<string, number>>({});

  const exercisesToLog = useMemo(() => {
    return workout.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]);
  }, [workout.blocks]);

  const intensityDetail = useMemo(() => {
    if (workout.category === 'PT-bas' && workout.intensityLevel) {
      return INTENSITY_LEVELS.find(l => l.value === workout.intensityLevel);
    }
    return null;
  }, [workout.category, workout.intensityLevel]);
  
  useEffect(() => {
    const fetchAiSuggestion = async () => {
      // Corrected condition: Don't require a goal to be set.
      if (!ai || !isNewSession || !logForReferenceOrEdit) {
        return;
      }
  
      setIsLoadingAiSuggestion(true);
      setIsSuggestionVisible(true);
  
      const goalKeywords = {
        strength: ["styrka", "starkare", "1rm", "maxlyft"],
        hypertrophy: ["muskelmassa", "bygga muskler", "hypertrofi", "muskeltillväxt", "forma kroppen"],
      };
      
      const containsKeywords = (text: string | undefined, keywords: string[]): boolean => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword));
      };
      
      const goalExists = latestGoal && latestGoal.fitnessGoals && latestGoal.fitnessGoals !== "Inga specifika mål satta";

      const primaryGoal = (() => {
        if (!goalExists) return "Allmän Hälsa";
        if (containsKeywords(latestGoal?.fitnessGoals, goalKeywords.strength)) return "Styrka";
        if (containsKeywords(latestGoal?.fitnessGoals, goalKeywords.hypertrophy)) return "Muskelmassa";
        return "Allmän Hälsa";
      })();
  
      const goalStringForPrompt = goalExists 
        ? `Medlemmens Mål: ${primaryGoal} (${latestGoal.fitnessGoals})`
        : "Medlemmens Mål: Inga specifika mål satta. Fokusera på generell progression och god teknik.";

      const prevWorkoutTemplate = allWorkouts.find(w => w.id === logForReferenceOrEdit.workoutId);
  
      let previousPerformanceString = '';
      workout.blocks.flatMap(b => b.exercises).forEach(ex => {
        const matchingPrevEx = prevWorkoutTemplate?.blocks.flatMap(b => b.exercises).find(prevEx => prevEx.name === ex.name || (ex.baseLiftType && prevEx.baseLiftType === ex.baseLiftType));
        if (matchingPrevEx) {
            const prevEntry = logForReferenceOrEdit.entries.find(e => e.exerciseId === matchingPrevEx.id);
            if (prevEntry?.loggedSets?.length > 0) {
                previousPerformanceString += `    - Prestation för ${ex.name}:\n`;
                prevEntry.loggedSets.forEach((set, i) => {
                    const setDisplayText = formatPreviousSetDisplay(set, ex.isBodyweight);
                    previousPerformanceString += `        - Set ${i+1}: ${setDisplayText} (${set.isCompleted ? 'Slutfört' : 'Ej slutfört'})\n`;
                });
            }
        }
      });
      
      const currentWorkoutString = `Nuvarande Pass: ${workout.title}\nÖvningar i passet:\n` + workout.blocks.flatMap(b => b.exercises).map(ex => `- ${ex.name}: ${ex.notes || 'Inga anteckningar'}`).join('\n');
  
      const prompt = `
        System: Du är en extremt kompetent AI-coach (Flexibot) på Flexibel Hälsostudio. Du ger korta, koncisa och vetenskapligt grundade tips inför ett pass. Svara på svenska och använd Markdown för **fetstil**.

        VIKTIGT KONTEXT (Utrustning & Progression):
        1.  **Analysera övningens namn för att avgöra utrustning:**
            *   Om namnet innehåller **"Hantel", "Dumbbell", "DB", "Kettlebell", "KB"**, antag att det är en hantel- eller kettlebellövning.
            *   För övningar som "Knäböj", "Bänkpress", "Marklyft", "Axelpress" utan specifik utrustning i namnet, antag att det är en **skivstångsövning**.

        2.  **Anpassa progressionsförslag efter utrustning:**
            *   **För hantel/kettlebell-övningar:** Föreslå en ökning till nästa logiska standardvikt, oftast **1-2 kg tyngre per hantel/kettlebell**. Exempel: från 10 kg till 12 kg, eller från 16 kg till 18 kg. Föreslå **ALDRIG** ökningar som 10.5 kg för dessa.
            *   **För skivstångsövningar:** Använd kunskapen om tillgängliga viktskivor (0.25, 0.5, 1.25, 2.5, 5, 10, 20 kg). Den minsta möjliga ökningen är **0.5 kg**. Föreslå ökningar som är praktiskt möjliga, t.ex. "+2.5 kg" (en 1.25kg-skiva på varje sida) eller "+1 kg" (en 0.5kg-skiva på varje sida).
            *   **För konditionsövningar (distans/tid/kcal):** Föreslå att öka en av parametrarna, t.ex. "Försök springa 100m längre" eller "Sikta på 5 kcal mer".

        3.  **Anpassa progressionsstorlek efter övningstyp:**
            *   Stora underkroppslyft (Knäböj, Marklyft) tål större ökningar.
            *   Överkroppslyft (Bänkpress, Axelpress, Rodd) kräver mindre, mer precisa ökningar.

        DINA REGLER:
        1.  Starta alltid med "### Dagens Tips! ✨".
        2.  Ge 1-2 korta, supertydliga och säkra tips.
        3.  **Analysera föregående prestation NOGGRANT**:
            *   Titta på både **objektiv data** (set, reps, vikt, distans etc.) och **subjektiv feedback** (kommentar, känsla).
            *   Om medlemmen skrev att det var "**tungt**" eller om känslan var **låg (1-2/5)**, var FÖRSIKTIG med att föreslå progression, även om alla reps klarades.

        4.  **Ge SMARTA progressionsförslag (baserat på UTRUSTNING och KÄNSLA)**:
            *   **Identifiera först utrustning** (se kontext ovan).
            *   **Om föregående pass var LÄTT och alla reps klarades**:
                *   För **skivstångsövningar**: Föreslå en lämplig viktökning (t.ex. +2.5 kg till 5 kg för underkropp, +1 kg till 2.5 kg för överkropp).
                *   För **hantel/kettlebell-övningar**: Föreslå en ökning till nästa logiska standardvikt. Exempel: "Eftersom Hantelpress kändes lätt på 10 kg, prova **12 kg** hantlarna idag!"
            *   **Om föregående pass var TUNGT men alla reps klarades**:
                *   Föreslå att **köra på samma vikt igen** för att bygga självförtroende.
                *   **ELLER**, för **skivstångsövningar**, föreslå en **mikro-ökning** (+0.5 kg eller +1 kg). Exempel: "Grymt kämpat med Axelpress! Eftersom det var tungt, sikta på samma vikt igen, eller prova en liten ökning till **20.5 kg**."
                *   För **hantel/kettlebell-övningar** där mikro-ökning inte är möjlig, rekommendera istället att **öka antalet reps** på samma vikt. Exempel: "Starkt jobbat med Goblet Squat! Eftersom 20 kg kändes tungt, sikta på samma vikt idag men försök klara **en rep till** på varje set."
            *   **Om reps missades**:
                *   Föreslå att köra samma vikt igen och fokusera på att slå föregående repsantal.

        5.  **Anpassa efter MÅL**:
            *   Om målet är **Styrka**: Fokusera på viktökning.
            *   Om målet är **Muskelmassa**: Fokusera på att öka reps eller set.
        6.  **Var Uppmuntrande**: Håll en positiv och motiverande ton.
        7.  **Håll det KORT**: Max 3-4 meningar totalt.

        Medlemmens Mål: ${goalStringForPrompt}
        Nuvarande Pass: ${currentWorkoutString}

        Föregående logg för ett liknande pass (${new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}):
        - Kommentar: "${logForReferenceOrEdit.postWorkoutComment || 'Ingen'}"
        - Känsla: ${logForReferenceOrEdit.moodRating ? `${logForReferenceOrEdit.moodRating}/5` : 'Ingen'}
        - Prestation:\n${previousPerformanceString || 'Ingen detaljerad data.'}
      `;
  
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-preview-04-17', contents: prompt });
        setAiSuggestion(response.text);
      } catch (error) {
        console.error("Failed to get AI suggestion:", error);
        setAiSuggestion(null);
      } finally {
        setIsLoadingAiSuggestion(false);
      }
    };
  
    fetchAiSuggestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, isNewSession, logForReferenceOrEdit, latestGoal, workout]);


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
            } else {
                newLogEntries.set(ex.id, [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }]);
            }
        });
        newPostWorkoutComment = logForReferenceOrEdit.postWorkoutComment || '';
    } else {
        // NEW SESSION:
        exercisesToLog.forEach(ex => {
            const blockForCurrentExercise = workout.blocks.find(b => b.exercises.some(e => e.id === ex.id));
            const isQuickLogEnabledForBlock = blockForCurrentExercise?.isQuickLogEnabled || false;

            let setsToInit: SetDetail[] = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
            if (isNewSession && logForReferenceOrEdit) { // logForReferenceOrEdit here is the *previous* log of this type
                const exercisesInRefLog = logForReferenceOrEdit.selectedExercisesForModifiable || [];
                let previousExerciseDataForRefId: string | undefined;
                if (exercisesInRefLog.length > 0) {
                    const previousExerciseData = exercisesInRefLog.find(refEx => refEx.name === ex.name || (refEx.baseLiftType && refEx.baseLiftType === ex.baseLiftType));
                    if (previousExerciseData) previousExerciseDataForRefId = previousExerciseData.id;
                } else {
                     const workoutTemplateForRef = allWorkouts.find(w => w.id === logForReferenceOrEdit.workoutId);
                     const exerciseInTemplateForRef = workoutTemplateForRef?.blocks.flatMap(b => b.exercises).find(refEx => refEx.name === ex.name || (refEx.baseLiftType && refEx.baseLiftType === ex.baseLiftType));
                     if (exerciseInTemplateForRef) previousExerciseDataForRefId = exerciseInTemplateForRef.id;
                }
                if (previousExerciseDataForRefId) {
                    const previousLogEntryForThisExercise = logForReferenceOrEdit.entries.find(e => e.exerciseId === previousExerciseDataForRefId);
                    if (previousLogEntryForThisExercise && previousLogEntryForThisExercise.loggedSets && previousLogEntryForThisExercise.loggedSets.length > 0) {
                        
                        // If the block is NOT a quick-log block, pre-populate sets from previous log.
                        // Otherwise, it defaults to one empty set.
                        if (!isQuickLogEnabledForBlock) {
                            setsToInit = previousLogEntryForThisExercise.loggedSets.map((prevSet) => ({
                                id: crypto.randomUUID(),
                                reps: '',
                                weight: prevSet.weight !== undefined ? String(prevSet.weight) : '',
                                isCompleted: false
                            }));
                            if (setsToInit.length === 0) {
                                setsToInit = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
                            }
                        }
                    }
                }
            }
            newLogEntries.set(ex.id, setsToInit);
        });
        newPostWorkoutComment = '';
    }
    setLogEntries(newLogEntries);
    setPostWorkoutComment(newPostWorkoutComment);
    setMoodRating(isNewSession ? null : (logForReferenceOrEdit?.moodRating || null));
    setIsSaving(false);
    setHasSaved(false);
    setShowExitConfirmationModal(false);
    setShowSubmitConfirmationModal(false);
    // Expand the first block by default for new sessions
    setExpandedBlocksInForm(isNewSession && workout.blocks.length > 0 ? new Set([workout.blocks[0].id]) : new Set());
    setIsSuggestionVisible(true);
    setQuickLoggedSupersets({});
  }, [workout.id, exercisesToLog, logForReferenceOrEdit, isNewSession, allWorkouts, workout.blocks]);

  const handleToggleBlockExpandInForm = (blockId: string) => {
    setExpandedBlocksInForm(prev => {
      // If the clicked block is already open, close it (empty the set).
      if (prev.has(blockId)) {
        return new Set();
      }
      // Otherwise, open the clicked one (which automatically closes any other).
      return new Set([blockId]);
    });
  };

  const handleSetInputChange = (exerciseId: string, setId: string, field: keyof Omit<SetDetail, 'id' | 'isCompleted'>, value: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const updatedSets = sets.map(s => s.id === setId ? { ...s, [field]: value } : s);
      newEntries.set(exerciseId, updatedSets);
      return newEntries;
    });
  };

  const handleSetCompletionChange = (exerciseId: string, setId: string, completed: boolean) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const updatedSets = sets.map(s => s.id === setId ? { ...s, isCompleted: completed } : s);
      newEntries.set(exerciseId, updatedSets);
      return newEntries;
    });
  };

  const handleAddStandaloneSet = (exerciseId: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      const sets = newEntries.get(exerciseId) || [];
      const lastSet = sets.length > 0 ? sets[sets.length - 1] : undefined;
      newEntries.set(exerciseId, [...sets, { 
          id: crypto.randomUUID(), 
          reps: '', 
          weight: lastSet?.weight || '',
          distanceMeters: '',
          durationSeconds: '',
          caloriesKcal: '',
          isCompleted: false 
      }]);
      return newEntries;
    });
  };

  const handleRemoveStandaloneSet = (exerciseId: string, setId: string) => {
    setLogEntries(prev => {
      const newEntries = new Map(prev);
      let sets = newEntries.get(exerciseId) || [];
      sets = sets.filter(s => s.id !== setId);
      if (sets.length === 0) {
        sets = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
      }
      newEntries.set(exerciseId, sets);
      return newEntries;
    });
  };

  const handleAddSupersetRound = (blockId: string, supersetIdentifier: string) => {
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === blockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        exercisesInSuperset.forEach(ex => {
            const sets = newEntries.get(ex.id) || [];
            const lastSet = sets.length > 0 ? sets[sets.length - 1] : undefined;
            newEntries.set(ex.id, [...sets, { 
                id: crypto.randomUUID(), 
                reps: '', 
                weight: lastSet?.weight || '',
                distanceMeters: '',
                durationSeconds: '',
                caloriesKcal: '',
                isCompleted: false 
            }]);
        });
        return newEntries;
    });
  };

  const handleRemoveSupersetRound = (blockId: string, supersetIdentifier: string, roundIndex: number) => {
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === blockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        exercisesInSuperset.forEach(ex => {
            let sets = [...(newEntries.get(ex.id) || [])];
            if (roundIndex >= 0 && roundIndex < sets.length) {
                sets.splice(roundIndex, 1);
            }
            if (sets.length === 0) {
                 sets = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
            }
            newEntries.set(ex.id, sets);
        });
        return newEntries;
    });
  };
  
  const handleQuickLogRoundsChange = (supersetId: string, value: string) => {
      setQuickLogRounds(prev => ({ ...prev, [supersetId]: value }));
  };

  const handleApplyQuickLogOrAddOne = (blockId: string, supersetIdentifier: string) => {
    const roundsStr = quickLogRounds[supersetIdentifier] || '';
    const rounds = parseInt(roundsStr, 10);

    if (roundsStr.trim() !== '' && !isNaN(rounds) && rounds > 0) {
      setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === blockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        
        // Create a map to hold the template data from the first round.
        const firstRoundTemplate = new Map<string, Partial<SetDetail>>();

        exercisesInSuperset.forEach(ex => {
            const existingSets = prev.get(ex.id) || [];
            if (existingSets.length > 0) {
                firstRoundTemplate.set(ex.id, existingSets[0]);
            }
        });

        exercisesInSuperset.forEach(ex => {
            const template = firstRoundTemplate.get(ex.id) || {};
            const loggableMetrics = ex.loggableMetrics || ['reps', 'weight'];
            
            const newSets: SetDetail[] = Array.from({ length: rounds }, () => {
                const newSet: SetDetail = { id: crypto.randomUUID(), isCompleted: true };
                if (loggableMetrics.includes('reps')) newSet.reps = (template.reps && String(template.reps).trim() !== '') ? template.reps : '1';
                if (loggableMetrics.includes('weight')) newSet.weight = (template.weight !== undefined && String(template.weight).trim() !== '') ? template.weight : '0';
                if (loggableMetrics.includes('distance')) newSet.distanceMeters = (template.distanceMeters && String(template.distanceMeters).trim() !== '') ? template.distanceMeters : '0';
                if (loggableMetrics.includes('duration')) newSet.durationSeconds = (template.durationSeconds && String(template.durationSeconds).trim() !== '') ? template.durationSeconds : '0';
                if (loggableMetrics.includes('calories')) newSet.caloriesKcal = (template.caloriesKcal && String(template.caloriesKcal).trim() !== '') ? template.caloriesKcal : '0';
                return newSet;
            });
            newEntries.set(ex.id, newSets);
        });

        return newEntries;
      });
      setQuickLoggedSupersets(prev => ({...prev, [supersetIdentifier]: rounds }));
      handleQuickLogRoundsChange(supersetIdentifier, '');
    } else {
      handleAddSupersetRound(blockId, supersetIdentifier);
    }
  };

  const handleUndoQuickLog = (blockId: string, supersetIdentifier: string) => {
    setQuickLoggedSupersets(prev => {
        const newState = { ...prev };
        delete newState[supersetIdentifier];
        return newState;
    });
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === blockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        exercisesInSuperset.forEach(ex => {
            newEntries.set(ex.id, [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }]);
        });
        return newEntries;
    });
  };

  const actuallySubmitLog = () => {
    const entriesToSave: WorkoutExerciseLog[] = [];
    let allInputsValid = true;
    let firstErrorMessage = "";

    logEntries.forEach((sets, exerciseId) => {
        if (!allInputsValid) return; // Stop processing if an error was found

        const exerciseDetails = exercisesToLog.find(ex => ex.id === exerciseId);
        const loggableMetrics = exerciseDetails?.loggableMetrics?.length ? exerciseDetails.loggableMetrics : ['reps', 'weight'];

        const validatedAndCompletedSets: SetDetail[] = [];
        const completedSets = sets.filter(s => s.isCompleted);

        for (const currentSet of completedSets) {
            let hasAtLeastOneMetric = false;
            const newSetToSave: SetDetail = { id: currentSet.id, isCompleted: true };

            for (const metric of loggableMetrics) {
                let valueStr: string | number | undefined;
                let key: keyof SetDetail = 'reps'; // default
                let isInt = false;

                switch(metric) {
                    case 'reps': valueStr = currentSet.reps; key = 'reps'; isInt = true; break;
                    case 'weight': valueStr = currentSet.weight; key = 'weight'; break;
                    case 'distance': valueStr = currentSet.distanceMeters; key = 'distanceMeters'; break;
                    case 'duration': valueStr = currentSet.durationSeconds; key = 'durationSeconds'; isInt = true; break;
                    case 'calories': valueStr = currentSet.caloriesKcal; key = 'caloriesKcal'; isInt = true; break;
                }

                if (valueStr !== undefined && String(valueStr).trim() !== '') {
                    const numValue = Number(valueStr);
                    if (isNaN(numValue) || numValue < 0 || (isInt && !Number.isInteger(numValue))) {
                        allInputsValid = false;
                        firstErrorMessage = `Ogiltigt värde för '${metric}' i övningen '${exerciseDetails?.name}'. Ange ett positivt ${isInt ? 'heltal' : 'tal'}.`;
                        break; // break from metric loop
                    }
                    if (key === 'weight' && (numValue * 10) % 5 !== 0) {
                        allInputsValid = false;
                        firstErrorMessage = `Vikt för '${exerciseDetails?.name}' måste vara i hela eller halva kilon (t.ex. 100 eller 100.5).`;
                        break;
                    }
                    (newSetToSave as any)[key] = numValue;
                    hasAtLeastOneMetric = true;
                }
            }
            if (!allInputsValid) break; // break from set loop

            if (hasAtLeastOneMetric) {
                validatedAndCompletedSets.push(newSetToSave);
            } else {
                allInputsValid = false;
                firstErrorMessage = `Ett slutfört set för '${exerciseDetails?.name}' saknar data. Fyll i värden eller avmarkera setet.`;
                break; // break from set loop
            }
        }
        if (validatedAndCompletedSets.length > 0) {
            entriesToSave.push({ exerciseId, loggedSets: validatedAndCompletedSets });
        }
    });

    if (!allInputsValid) {
        alert(firstErrorMessage || "Något gick fel med valideringen. Kontrollera dina ifyllda värden.");
        setIsSaving(false);
        return;
    }
    if (entriesToSave.length === 0 && !postWorkoutComment.trim()) {
        alert("Inga slutförda set eller kommentarer att spara. Markera minst ett set som slutfört eller skriv en kommentar.");
        setIsSaving(false);
        return;
    }

    const participantId = logForReferenceOrEdit?.participantId || latestGoal?.participantId;

    if (!participantId) {
        alert("Kan inte spara logg: Användar-ID saknas. Kontrollera att din profil är korrekt ifylld.");
        setIsSaving(false);
        return;
    }

    const newLog: WorkoutLog = {
      type: 'workout',
      id: (isNewSession || !logForReferenceOrEdit) ? crypto.randomUUID() : logForReferenceOrEdit.id,
      workoutId: workout.id,
      participantId,
      entries: entriesToSave,
      completedDate: (isNewSession || !logForReferenceOrEdit) ? new Date().toISOString() : logForReferenceOrEdit.completedDate,
      postWorkoutComment: postWorkoutComment.trim() || undefined,
      moodRating: moodRating || undefined,
    };

    if (workout.isModifiable) {
        newLog.selectedExercisesForModifiable = workout.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]);
    }
    onSaveLog(newLog);
    setHasSaved(true);
  };

  const hasPotentiallyIncompleteDataForSubmit = (): boolean => {
    // This function can be simplified now that `actuallySubmitLog` has robust validation.
    // It's mostly to catch sets that are partially filled but not marked complete.
    for (const sets of logEntries.values()) {
        for (const setDetail of sets) {
            if (!setDetail.isCompleted) {
                const hasData = (setDetail.reps && String(setDetail.reps).trim() !== '') ||
                                (setDetail.weight && String(setDetail.weight).trim() !== '') ||
                                (setDetail.distanceMeters && String(setDetail.distanceMeters).trim() !== '') ||
                                (setDetail.durationSeconds && String(setDetail.durationSeconds).trim() !== '') ||
                                (setDetail.caloriesKcal && String(setDetail.caloriesKcal).trim() !== '');
                if (hasData) return true; // Found a non-completed set with data
            }
        }
    }
    return false;
  };

  const handleSubmitLogAttempt = () => {
    setIsSaving(true);
    setHasSaved(false);
    if (hasPotentiallyIncompleteDataForSubmit()) {
      setShowSubmitConfirmationModal(true);
    } else {
      actuallySubmitLog();
    }
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirmationModal(false);
    actuallySubmitLog();
  };

  const handleCancelSubmitConfirmation = () => {
    setShowSubmitConfirmationModal(false);
    setIsSaving(false);
  };

  const hasEnteredData = useCallback((): boolean => {
    for (const sets of logEntries.values()) {
      for (const setDetail of sets) {
        const hasData = (setDetail.reps && String(setDetail.reps).trim() !== '') ||
                        (setDetail.weight !== undefined && String(setDetail.weight).trim() !== '') ||
                        (setDetail.distanceMeters && String(setDetail.distanceMeters).trim() !== '') ||
                        (setDetail.durationSeconds && String(setDetail.durationSeconds).trim() !== '') ||
                        (setDetail.caloriesKcal && String(setDetail.caloriesKcal).trim() !== '');
        if (hasData) return true;
      }
    }
    if (!isNewSession && logForReferenceOrEdit) {
      if (postWorkoutComment.trim() !== (logForReferenceOrEdit.postWorkoutComment || '').trim()) return true;
      if (moodRating !== (logForReferenceOrEdit.moodRating || null)) return true;
    } else {
      if (postWorkoutComment.trim() !== '') return true;
      if (moodRating !== null) return true;
    }
    return false;
  }, [logEntries, postWorkoutComment, moodRating, isNewSession, logForReferenceOrEdit]);

  const handleCloseAttempt = () => {
    if (hasEnteredData() && !hasSaved) {
      setShowExitConfirmationModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirmationModal(false);
    onClose();
  };

  let overallExerciseCounter = 0;
  const saveButtonText = isSaving ? "Sparar..." : (hasSaved ? "Sparat! ✓" : "Slutför & Spara Pass");

  const metricInputMap: { [key in LoggableMetric]: { placeholder: string, type: string, step?: string } } = {
    reps: { placeholder: 'Reps', type: 'number', step: '1' },
    weight: { placeholder: 'Vikt (kg)', type: 'number', step: '0.5' },
    distance: { placeholder: 'Distans (m)', type: 'number', step: '1' },
    duration: { placeholder: 'Tid (sek)', type: 'number', step: '1' },
    calories: { placeholder: 'Kcal', type: 'number', step: '1' },
  };

  const getLoggableMetrics = (exercise: Exercise): LoggableMetric[] => {
      return exercise.loggableMetrics && exercise.loggableMetrics.length > 0 ? exercise.loggableMetrics : ['reps', 'weight'];
  };
  

  return (
    <div className="relative">
      {isLoadingAiSuggestion && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg text-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-flexibel mb-4"></div>
          <p className="text-xl font-bold text-gray-800">Flexibot tänker...</p>
          <p className="text-base text-gray-600">Hämtar personliga tips för ditt pass.</p>
        </div>
      )}

      <div className={`space-y-4 ${isLoadingAiSuggestion ? 'opacity-20' : 'transition-opacity duration-300'}`}>
        {isSuggestionVisible && !isLoadingAiSuggestion && aiSuggestion && (
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg shadow-sm relative animate-fade-in-down">
            <button
              onClick={() => setIsSuggestionVisible(false)}
              className="absolute top-1 right-1 text-violet-400 hover:text-violet-600"
              aria-label="Stäng tips"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="prose prose-base prose-strong:text-violet-800 text-violet-700 max-w-none">
              {renderMarkdown(aiSuggestion)}
            </div>
          </div>
        )}

        <div className="p-4 bg-white rounded-lg shadow-md border">
          <div className="flex justify-between items-start mb-3">
            <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-flexibel">{workout.title}</h2>
                <p className="text-base text-gray-500 mt-1">
                  Kategori: <span className="font-medium">{workout.category}</span>
                  {intensityDetail && ` | Fokus: ${intensityDetail.label}`}
                </p>
                {(isNewSession && logForReferenceOrEdit) && <p className="text-sm text-gray-500 italic mt-1">Ny logg, baserat på {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
                {!isNewSession && logForReferenceOrEdit && <p className="text-sm text-orange-600 italic mt-1">Redigerar logg från {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
            </div>
            <Button onClick={handleCloseAttempt} variant="outline" size="sm" className="ml-auto flex-shrink-0">Stäng</Button>
          </div>
          {workout.coachNote && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-base text-gray-700 italic whitespace-pre-wrap">{workout.coachNote}</p>
              </div>
          )}
        </div>

        {intensityDetail && workout.intensityInstructions && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2 shadow-sm">
              <h5 className="text-lg font-semibold text-yellow-800">Instruktioner ({intensityDetail.label})</h5>
              <p className="text-base text-yellow-700 italic whitespace-pre-wrap">{workout.intensityInstructions}</p>
              {intensityDetail.pbSuggestion && (<p className="mt-2 pt-2 border-t border-yellow-200 text-base text-red-600 font-bold">{intensityDetail.pbSuggestion}</p>)}
          </div>
        )}

        <div className="space-y-3">
          {workout.blocks.map((block, blockIndex) => {
            const processedSupersetIdsThisRenderForThisBlock = new Set<string>();
            const blockId = block.id || `block-log-${blockIndex}`;
            const isBlockExpanded = expandedBlocksInForm.has(blockId);
            const hasCompletedSetsInBlock = block.exercises.some(ex =>
              (logEntries.get(ex.id) || []).some(set => set.isCompleted)
            );

            return (
              <div key={blockId} className="rounded-lg shadow-md overflow-hidden">
                <button
                  onClick={() => handleToggleBlockExpandInForm(blockId)}
                  className="w-full flex justify-between items-center p-4 bg-gray-700 text-white hover:bg-gray-600 transition-colors group"
                  aria-expanded={isBlockExpanded}
                  aria-controls={`block-content-log-${blockId}`}
                >
                  <div className="flex items-center">
                    {hasCompletedSetsInBlock && <span className="text-green-400 mr-3 text-xl" role="img" aria-label="Block slutfört">✅</span>}
                    <h3 className="text-xl font-bold text-left">
                      {block.name || `Block ${blockIndex + 1}`}
                    </h3>
                  </div>
                  {isBlockExpanded ? <ChevronUpIcon className="text-white"/> : <ChevronDownIcon className="text-white"/>}
                </button>

                {isBlockExpanded && (
                  <div id={`block-content-log-${blockId}`} className="p-3 sm:p-4 bg-gray-100">
                      {block.exercises.map((exercise) => {
                         if (exercise.supersetIdentifier) {
                          if (processedSupersetIdsThisRenderForThisBlock.has(exercise.supersetIdentifier)) return null;
                          processedSupersetIdsThisRenderForThisBlock.add(exercise.supersetIdentifier);
                          
                          const isQuickLogged = quickLoggedSupersets[exercise.supersetIdentifier];
                          if (isQuickLogged) {
                              return (
                                  <div key={`quick-log-confirm-${exercise.supersetIdentifier}`} className="p-3 bg-green-100 border border-green-300 rounded-md shadow-sm my-4 flex justify-between items-center gap-2">
                                      <span className="text-green-800 font-semibold flex items-center">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                          {isQuickLogged} rundor loggade
                                      </span>
                                      <Button onClick={() => handleUndoQuickLog(block.id, exercise.supersetIdentifier!)} variant="ghost" size="sm" className="!text-sm text-gray-600 hover:text-gray-900">
                                          Ångra
                                      </Button>
                                  </div>
                              );
                          }

                          const exercisesInThisSuperset = block.exercises.filter(ex => ex.supersetIdentifier === exercise.supersetIdentifier);
                          const firstExerciseInSuperset = exercisesInThisSuperset[0];
                          overallExerciseCounter++;
                          const supersetTitle = exercisesInThisSuperset.map(e => e.name).join(' + ');
                          let maxSetsInSuperset = 0;
                          exercisesInThisSuperset.forEach(ex => {
                              const sets = logEntries.get(ex.id) || [];
                              if (sets.length > maxSetsInSuperset) maxSetsInSuperset = sets.length;
                          });
                          if (maxSetsInSuperset === 0) maxSetsInSuperset = 1;
                          return (
                              <div key={exercise.supersetIdentifier} className="p-4 bg-white border-l-4 border-blue-500 rounded-r-lg shadow-lg my-4">
                                  <h4 className="text-xl font-bold text-blue-800 mb-2">{overallExerciseCounter}. Superset: {supersetTitle}</h4>
                                  {firstExerciseInSuperset.notes && <p className="text-sm text-gray-500 mb-2">Coach: <span className="italic">{firstExerciseInSuperset.notes}</span></p>}
                                  
                                  {Array.from({ length: maxSetsInSuperset }).map((_, roundIndex) => (
                                      <div key={`superset-${exercise.supersetIdentifier}-round-${roundIndex}`} className="mt-2 pt-2 border-t border-gray-200 first:border-t-0 first:mt-0">
                                          <div className="flex justify-between items-center mb-1">
                                              <p className="text-base font-medium text-blue-700">Runda {roundIndex + 1}</p>
                                              {maxSetsInSuperset > 1 && (<Button onClick={() => handleRemoveSupersetRound(block.id, exercise.supersetIdentifier!, roundIndex)} variant="danger" size="sm" className="!px-1.5 !py-0.5 !text-xs">Ta bort Runda</Button>)}
                                          </div>
                                          {exercisesInThisSuperset.map(exInSS => {
                                              const setDetail = (logEntries.get(exInSS.id) || [])[roundIndex] || {id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false};
                                              const loggableMetricsForSS = getLoggableMetrics(exInSS);

                                              let previousSetDataForDisplaySS: SetDetail | undefined;
                                              if (logForReferenceOrEdit) {
                                                  const exercisesInRefLogSS = logForReferenceOrEdit.selectedExercisesForModifiable || [];
                                                  let refExerciseIdToFindSS = exInSS.id;
                                                  if (exercisesInRefLogSS.length > 0) {
                                                      const refExerciseSS = exercisesInRefLogSS.find(refEx => refEx.name === exInSS.name || (refEx.baseLiftType && refEx.baseLiftType === exInSS.baseLiftType));
                                                      if (refExerciseSS) refExerciseIdToFindSS = refExerciseSS.id;
                                                  } else {
                                                      const workoutTemplateForRefSS = allWorkouts.find(w => w.id === logForReferenceOrEdit.workoutId);
                                                      const exerciseInTemplateForRefSS = workoutTemplateForRefSS?.blocks.flatMap(b => b.exercises).find(refEx => refEx.name === exInSS.name || (refEx.baseLiftType && refEx.baseLiftType === exInSS.baseLiftType));
                                                      if (exerciseInTemplateForRefSS) refExerciseIdToFindSS = exerciseInTemplateForRefSS.id;
                                                  }
                                                  const previousEntryForExInSS = logForReferenceOrEdit.entries.find(e => e.exerciseId === refExerciseIdToFindSS);
                                                  previousSetDataForDisplaySS = previousEntryForExInSS?.loggedSets?.[roundIndex];
                                              }
                                              return (
                                                <div key={exInSS.id + '-' + setDetail.id} className={`p-2 mt-2 rounded-lg border-2 transition-colors duration-150 ease-in-out ${setDetail.isCompleted ? 'bg-green-50 border-green-300' : 'bg-white border-gray-300'}`}>
                                                    <p className="text-base font-semibold text-gray-700 mb-1">{exInSS.name} {exInSS.isBodyweight && <span className="text-sm text-green-600">(KV)</span>}</p>
                                                    <div className="flex items-stretch gap-2">
                                                        <div className="flex-1 flex flex-wrap gap-2">
                                                            {loggableMetricsForSS.map(metric => (
                                                                <Input
                                                                    key={metric}
                                                                    containerClassName="flex-1 min-w-[90px]"
                                                                    inputSize="sm"
                                                                    id={`${metric}-${exInSS.id}-${setDetail.id}`}
                                                                    name={`${metric}-${exInSS.id}-${setDetail.id}`}
                                                                    type={metricInputMap[metric].type}
                                                                    inputMode={metric === 'reps' ? 'numeric' : 'decimal'}
                                                                    placeholder={metricInputMap[metric].placeholder}
                                                                    value={(setDetail as any)[metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric] || ''}
                                                                    onChange={(e) => handleSetInputChange(exInSS.id, setDetail.id, (metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric), e.target.value)}
                                                                    min="0"
                                                                    step={metricInputMap[metric].step}
                                                                />
                                                            ))}
                                                        </div>
                                                        <button 
                                                            onClick={() => handleSetCompletionChange(exInSS.id, setDetail.id, !setDetail.isCompleted)} 
                                                            className={`flex-shrink-0 w-16 flex items-center justify-center p-1 rounded-lg transition-colors ${setDetail.isCompleted ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`} 
                                                            aria-pressed={setDetail.isCompleted} 
                                                            title={setDetail.isCompleted ? "Markera som ej slutfört" : "Markera som slutfört"}
                                                        >
                                                          {setDetail.isCompleted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                        </button>
                                                    </div>
                                                    {previousSetDataForDisplaySS && (<p className="text-sm text-gray-500 mt-2">Föregående: {formatPreviousSetDisplay(previousSetDataForDisplaySS, exInSS.isBodyweight)}</p>)}
                                                </div>
                                              );
                                          })}
                                      </div>
                                  ))}

                                  {block.isQuickLogEnabled ? (
                                      <div className="flex items-end gap-2 mt-3 pt-3 border-t border-gray-200">
                                          <Input
                                              label="Snabblogga"
                                              inputSize="sm"
                                              id={`quick-log-integrated-${exercise.supersetIdentifier}`}
                                              type="number"
                                              placeholder="Antal rundor..."
                                              value={quickLogRounds[exercise.supersetIdentifier!] || ''}
                                              onChange={(e) => handleQuickLogRoundsChange(exercise.supersetIdentifier!, e.target.value)}
                                          />
                                          <Button 
                                              onClick={() => handleApplyQuickLogOrAddOne(block.id, exercise.supersetIdentifier!)} 
                                              variant="secondary" 
                                              size="sm"
                                              className="whitespace-nowrap flex-shrink-0"
                                          >
                                              {(quickLogRounds[exercise.supersetIdentifier!] && parseInt(quickLogRounds[exercise.supersetIdentifier!]!, 10) > 0)
                                              ? `Logga ${quickLogRounds[exercise.supersetIdentifier!]} rundor`
                                              : 'Lägg till 1 runda'}
                                          </Button>
                                      </div>
                                  ) : (
                                      <Button onClick={() => handleAddSupersetRound(block.id, exercise.supersetIdentifier!)} variant="secondary" size="sm" className="mt-3 w-full">Lägg till en runda</Button>
                                  )}
                              </div>
                          );
                         } else {
                          overallExerciseCounter++;
                          const currentLoggedSets = logEntries.get(exercise.id) || [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
                           if (currentLoggedSets.length === 0) currentLoggedSets.push({ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false });
                          let previousExerciseDataForDisplay: WorkoutExerciseLog | undefined;
                          if (logForReferenceOrEdit) {
                              const exercisesInRefLog = logForReferenceOrEdit.selectedExercisesForModifiable || [];
                              let refExerciseIdToFind = exercise.id;
                              if (exercisesInRefLog.length > 0) {
                                  const refExercise = exercisesInRefLog.find(refEx => refEx.name === exercise.name || (refEx.baseLiftType && refEx.baseLiftType === exercise.baseLiftType));
                                  if (refExercise) refExerciseIdToFind = refExercise.id;
                              } else {
                                   const workoutTemplateForRef = allWorkouts.find(w => w.id === logForReferenceOrEdit.workoutId);
                                   const exerciseInTemplateForRef = workoutTemplateForRef?.blocks.flatMap(b => b.exercises).find(refEx => refEx.name === exercise.name || (refEx.baseLiftType && refEx.baseLiftType === exercise.baseLiftType));
                                   if (exerciseInTemplateForRef) refExerciseIdToFind = exerciseInTemplateForRef.id;
                              }
                              previousExerciseDataForDisplay = logForReferenceOrEdit.entries.find(e => e.exerciseId === refExerciseIdToFind);
                          }
                          const loggableMetrics = getLoggableMetrics(exercise);
                          return (
                              <div key={exercise.id} className="p-4 bg-white rounded-lg shadow-lg my-4">
                                <h4 className="text-xl font-bold text-gray-800 mb-2">{overallExerciseCounter}. {exercise.name} {exercise.isBodyweight && <span className="text-sm text-green-600">(KV)</span>}</h4>
                                {exercise.notes && <p className="text-sm text-gray-500 mb-2">Coach: <span className="italic">{exercise.notes}</span></p>}
                                <div className="space-y-2">
                                  {currentLoggedSets.map((setDetail, setIndex) => {
                                    const previousSetDataForDisplay = previousExerciseDataForDisplay?.loggedSets?.[setIndex];
                                    return (
                                      <div key={setDetail.id} className={`p-2 rounded-lg border-2 transition-colors duration-150 ease-in-out ${setDetail.isCompleted ? 'bg-green-50 border-green-300' : 'bg-white border-gray-300'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="w-24 flex-shrink-0">
                                                {currentLoggedSets.length > 1 && (
                                                    <Button onClick={() => handleRemoveStandaloneSet(exercise.id, setDetail.id)} variant="danger" size="sm" className="!px-1.5 !py-0.5 !text-xs">
                                                        Ta bort set
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-base font-medium text-flexibel flex-grow text-center">Set {setIndex + 1}</p>
                                            <div className="w-24 flex-shrink-0"></div> {/* Spacer to keep title centered */}
                                        </div>
                                        <div className="flex items-stretch gap-2">
                                          <div className="flex-1 flex flex-wrap gap-2">
                                              {loggableMetrics.map(metric => (
                                                  <Input
                                                      key={metric}
                                                      containerClassName="flex-1 min-w-[90px]"
                                                      inputSize="sm"
                                                      id={`${metric}-${exercise.id}-${setDetail.id}`}
                                                      name={`${metric}-${exercise.id}-${setDetail.id}`}
                                                      type={metricInputMap[metric].type}
                                                      inputMode={metric === 'reps' ? 'numeric' : 'decimal'}
                                                      placeholder={metricInputMap[metric].placeholder}
                                                      value={(setDetail as any)[metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric] || ''}
                                                      onChange={(e) => handleSetInputChange(exercise.id, setDetail.id, (metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric), e.target.value)}
                                                      min="0"
                                                      step={metricInputMap[metric].step}
                                                  />
                                              ))}
                                          </div>
                                          <button 
                                              onClick={() => handleSetCompletionChange(exercise.id, setDetail.id, !setDetail.isCompleted)} 
                                              className={`flex-shrink-0 w-16 flex items-center justify-center p-1 rounded-lg transition-colors ${setDetail.isCompleted ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`} 
                                              aria-pressed={setDetail.isCompleted} 
                                              title={setDetail.isCompleted ? "Markera som ej slutfört" : "Markera som slutfört"}
                                          >
                                            {setDetail.isCompleted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                          </button>
                                        </div>
                                        {previousSetDataForDisplay && (<p className="text-sm text-gray-500 mt-2">Föregående: {formatPreviousSetDisplay(previousSetDataForDisplay, exercise.isBodyweight)}</p>)}
                                      </div>
                                    )
                                  })}
                                  <Button onClick={() => handleAddStandaloneSet(exercise.id)} variant="secondary" size="sm" className="mt-2 w-full">Lägg till Set</Button>
                                </div>
                              </div>
                            );
                         }
                      })}
                      {block.exercises.length === 0 && <p className="text-gray-500 p-2">Inga övningar i detta block.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl mt-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Avsluta Pass</h3>
          <div className="space-y-4">
              <Textarea label="Kommentar (valfri)" name="postWorkoutComment" value={postWorkoutComment} onChange={(e) => setPostWorkoutComment(e.target.value)} placeholder="T.ex. Kändes bra, vackert väder!" rows={2} />
              <MoodSelectorInput
              currentRating={moodRating}
              onSelectRating={setMoodRating}
              label="Känsla?"
              />
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={handleSubmitLogAttempt} variant="primary" size="md" fullWidth disabled={isSaving || hasSaved}>{saveButtonText}</Button>
        </div>

        {showExitConfirmationModal && ( <ConfirmationModal isOpen={showExitConfirmationModal} onClose={() => setShowExitConfirmationModal(false)} onConfirm={handleConfirmExit} title="Avsluta Loggning?" message="Du har osparade ändringar. Är du säker på att du vill avsluta utan att spara?" confirmButtonText="Avsluta ändå" /> )}
        {showSubmitConfirmationModal && ( <ConfirmationModal isOpen={showSubmitConfirmationModal} onClose={handleCancelSubmitConfirmation} onConfirm={handleConfirmSubmit} title="Bekräfta Spara" message={ <div><p className="mb-2">Vissa ifyllda set är inte markerade som 'slutförda' och kommer inte att sparas.</p><p className="font-semibold">Endast 'slutförda' set sparas.</p><p>Vill du fortsätta och spara?</p></div>} confirmButtonText="Ja, spara ändå" confirmButtonVariant="primary" /> )}
      </div>
    </div>
  );
};