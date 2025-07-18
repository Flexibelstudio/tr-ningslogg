import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutLog, WorkoutExerciseLog, SetDetail, Exercise, WorkoutBlock, ParticipantGoalData, LoggableMetric, ParticipantProfile, UserStrengthStat, ParticipantClubMembership } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ConfirmationModal } from '../ConfirmationModal';
import { INTENSITY_LEVELS, CLUB_DEFINITIONS } from '../../constants';
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

const calculateEstimated1RM = (weightStr?: number | string, repsStr?: number | string): string | null => {
    const weight = parseFloat(String(weightStr || '').replace(',', '.'));
    const reps = parseInt(String(repsStr || ''), 10);

    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return null;
    }
    
    // Formula is most accurate for reps <= 12
    if (reps > 12) {
        return null;
    }

    if (reps === 1) {
        return weight.toFixed(1);
    }

    // Brzycki Formula
    const e1RM = weight / (1.0278 - (0.0278 * reps));

    if (e1RM < weight) {
        return null;
    }

    // Round to the nearest 0.5
    return (Math.round(e1RM * 2) / 2).toFixed(1);
};


const renderMarkdownBlock = (text: string | null): JSX.Element | null => {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedElements: JSX.Element[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    let lineContent = lines[i];

    lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');

    if (lineContent.startsWith('### ')) {
      const headerText = lineContent.substring(4).trim();
      renderedElements.push(
        <h3 key={`h3-${i}`} className="text-xl font-semibold text-violet-800 mb-2" dangerouslySetInnerHTML={{ __html: headerText }}></h3>
      );
    } else if (lineContent.trim() !== '') {
       renderedElements.push(
        <p key={`p-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: lineContent }} />
      );
    }
  }
  return <div className="space-y-1">{renderedElements}</div>;
};

const formatPreviousSetDisplay = (setData: SetDetail, exerciseIsBodyweight?: boolean): string => {
    const parts: string[] = [];
    if (setData.reps) parts.push(`${setData.reps} reps`);
    if (setData.weight !== undefined && setData.weight !== null && String(setData.weight).trim() !== '') {
        if (exerciseIsBodyweight && Number(setData.weight) === 0) {
            if (!setData.reps) parts.push(`(KV)`);
        } else {
            parts.push(`@ ${setData.weight} kg`);
        }
    }
    if (setData.distanceMeters) parts.push(`${setData.distanceMeters} m`);
    if (setData.durationSeconds) parts.push(`${setData.durationSeconds} sek`);
    if (setData.caloriesKcal) parts.push(`${setData.caloriesKcal} kcal`);

    if (parts.length === 0) return "Inga data";
    
    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
        if (i === 1 && parts[0].includes('reps') && parts[1].startsWith('@')) {
            result += ` ${parts[i]}`; 
        } else {
            result += ` / ${parts[i]}`; 
        }
    }
    return result;
};

const AiTipComponent = ({ tip }: { tip: string }) => (
    <div className="mt-2 mb-2 p-2 bg-violet-50 border-l-4 border-violet-400 rounded-r-md text-sm text-violet-800">
        <div className="flex items-start">
            <span className="text-violet-600 mr-2 text-base pt-0.5 shrink-0" role="img" aria-label="AI tip">💡</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        </div>
    </div>
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
  const [isLoadingAiSuggestion, setIsLoadingAiSuggestion] = useState(false);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(true);

  const [quickLogRounds, setQuickLogRounds] = useState<Record<string, string>>({});
  const [quickLoggedSupersets, setQuickLoggedSupersets] = useState<Record<string, number>>({});

  const [currentView, setCurrentView] = useState<LogView>('block_selection');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [currentStepInBlock, setCurrentStepInBlock] = useState(0);

  const formTopRef = useRef<HTMLDivElement>(null);


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
      if (!ai || !isNewSession || !logForReferenceOrEdit) {
        return;
      }
  
      setIsLoadingAiSuggestion(true);
      setIsSuggestionVisible(true);
      setAiTips(null);
  
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

      const strengthStatsString = latestStrengthStats ? `Nuvarande 1RM: Knäböj ${latestStrengthStats.squat1RMaxKg || 'N/A'} kg, Bänkpress ${latestStrengthStats.benchPress1RMaxKg || 'N/A'} kg, Marklyft ${latestStrengthStats.deadlift1RMaxKg || 'N/A'} kg, Axelpress ${latestStrengthStats.overheadPress1RMaxKg || 'N/A'} kg.` : 'Ingen styrkestatistik registrerad.';
      
      const allClubDefinitionsString = CLUB_DEFINITIONS.map(club => {
        let definition = `- Klubb: "${club.name}" (${club.description}). Typ: ${club.type}.`;
        if (club.type === 'LIFT' || club.type === 'BODYWEIGHT_LIFT') {
            definition += ` Övning: ${club.liftType}.`;
        }
        if (club.threshold) {
            definition += ` Gräns: ${club.threshold}${club.conditioningMetric === 'rower2000mTimeSeconds' ? 's' : (club.type === 'LIFT' ? 'kg' : '')}.`;
        }
        if (club.multiplier && participantProfile?.bodyweightKg) {
            definition += ` Multiplier: ${club.multiplier}x kroppsvikt (ca ${Math.round(participantProfile.bodyweightKg * club.multiplier)} kg).`;
        } else if (club.multiplier) {
            definition += ` Multiplier: ${club.multiplier}x kroppsvikt.`;
        }
        return definition;
      }).join('\n');

      const achievedClubsString = myClubMemberships.map(membership => {
        const clubInfo = CLUB_DEFINITIONS.find(c => c.id === membership.clubId);
        return clubInfo ? `- ${clubInfo.name}` : '';
      }).filter(Boolean).join('\n') || 'Inga uppnådda klubbar än.';
  
      const prompt = `
        System: Du är en extremt kompetent AI-coach (Flexibot) på Flexibel Hälsostudio. Din uppgift är att ge korta, koncisa och vetenskapligt grundade tips inför ett pass och strukturera dem i ett JSON-objekt. Svara på svenska.

        JSON-STRUKTUR:
        Du MÅSTE svara med ett JSON-objekt som följer schemat.
        - "generalTips": En sträng för generella tips om passet som helhet, ELLER null om inga generella tips finns. Om du ger ett generellt tips, starta strängen med "### Dagens Tips! ✨".
        - "exerciseTips": En lista med objekt för varje övning du vill ge ett specifikt tips för.
            - "exerciseName": Exakt namn på övningen (t.ex. "Knäböj").
            - "tip": En kort, action-orienterad rekommendation för den specifika övningen. Använd Markdown för **fetstil**.

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
        1.  **FÖLJ JSON-STRUKTUREN EXAKT.**
        2.  Skapa ett tips i "exerciseTips"-listan för **VARJE** övning i passet där du kan ge en meningsfull rekommendation baserat på tidigare data. Om det inte finns något vettigt att säga, utelämna den övningen från listan.
        3.  **Ge tips för "Nästa Klubb"**:
            *   Analysera medlemmens nuvarande 1RM (om det finns) mot listan av tillgängliga klubbar.
            *   Identifiera en eller två klubbar som medlemmen är **nära** att uppnå (t.ex. inom 5-10 kg från en viktbaserad klubb, eller inom 10-15% från en kroppsviktsbaserad klubb).
            *   Om du hittar en lämplig "nästa klubb", **lägg till ett motiverande tips** i "generalTips"-sektionen. Inled tipset med "### Nästa Steg! 🚀\\n". Exempel: "### Nästa Steg! 🚀\\nDu närmar dig **100kg-klubben i Bänkpress**! Fortsätt med konsekvent träning på tunga vikter så är du snart där."
            *   Ge **INTE** detta tips om medlemmen redan är med i den klubben. Använd listan över "Uppnådda klubbar" för att verifiera detta.
        4.  **Analysera föregående prestation NOGGRANT**:
            *   Titta på både **objektiv data** (set, reps, vikt, distans etc.) och **subjektiv feedback** (kommentar, känsla).
            *   Om medlemmen skrev att det var "**tungt**" eller om känslan var **låg (1-2/5)**, var FÖRSIKTIG med att föreslå progression, även om alla reps klarades.

        5.  **Ge SMARTA progressionsförslag (baserat på UTRUSTNING och KÄNSLA)**:
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

        6.  **Anpassa efter MÅL**:
            *   Om målet är **Styrka**: Fokusera på viktökning.
            *   Om målet är **Muskelmassa**: Fokusera på att öka reps eller set.
        7.  **Var Uppmuntrande**: Håll en positiv och motiverande ton.
        8.  **Håll det KORT**: Max 3-4 meningar totalt per tips.

        Medlemmens Mål: ${goalStringForPrompt}
        Nuvarande Pass: ${currentWorkoutString}
        Medlemmens Styrkestatus: ${strengthStatsString}
        Uppnådda Klubbar:
        ${achievedClubsString}

        Föregående logg för ett liknande pass (${new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}):
        - Kommentar: "${logForReferenceOrEdit.postWorkoutComment || 'Ingen'}"
        - Känsla: ${logForReferenceOrEdit.moodRating ? `${logForReferenceOrEdit.moodRating}/5` : 'Ingen'}
        - Prestation:\n${previousPerformanceString || 'Ingen detaljerad data.'}

        Alla tillgängliga klubbar och deras krav (för din analys av "Nästa Klubb"):
        ${allClubDefinitionsString}
      `;
  
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
            generalTips: { type: Type.STRING, nullable: true, description: "General tips for the entire workout session. Can be null." },
            exerciseTips: {
                type: Type.ARRAY,
                description: "A list of tips specific to individual exercises.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        exerciseName: { type: Type.STRING, description: "The exact name of the exercise." },
                        tip: { type: Type.STRING, description: "The specific tip for this exercise." }
                    },
                    required: ["exerciseName", "tip"]
                }
            }
        }
      };

      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        const parsedTips = JSON.parse(response.text);
        setAiTips(parsedTips);
      } catch (error) {
        console.error("Failed to get or parse AI suggestion:", error);
        setAiTips(null);
      } finally {
        setIsLoadingAiSuggestion(false);
      }
    };
  
    fetchAiSuggestion();
  }, [ai, isNewSession, logForReferenceOrEdit, latestGoal, workout, latestStrengthStats, myClubMemberships, participantProfile]);


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
        exercisesToLog.forEach(ex => {
            const blockForCurrentExercise = workout.blocks.find(b => b.exercises.some(e => e.id === ex.id));
            const isQuickLogEnabledForBlock = blockForCurrentExercise?.isQuickLogEnabled || false;

            let setsToInit: SetDetail[] = [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }];
            if (isNewSession && logForReferenceOrEdit) { 
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
    setInitialLogEntries(new Map(JSON.parse(JSON.stringify(Array.from(newLogEntries)))));
    
    setPostWorkoutComment(newPostWorkoutComment);
    setInitialPostWorkoutComment(newPostWorkoutComment);

    const initialMood = isNewSession ? null : (logForReferenceOrEdit?.moodRating || null);
    setMoodRating(initialMood);
    setInitialMoodRating(initialMood);

    setIsSaving(false);
    setHasSaved(false);
    setShowExitConfirmationModal(false);
    setIsSuggestionVisible(true);
    setQuickLoggedSupersets({});
    setCurrentView('block_selection');
  }, [workout.id, exercisesToLog, logForReferenceOrEdit, isNewSession, allWorkouts, workout.blocks]);

  const loggableStepsInActiveBlock = useMemo(() => {
    if (!activeBlockId) return [];
    const block = workout.blocks.find(b => b.id === activeBlockId);
    if (!block) return [];

    const steps: { type: 'single' | 'superset', exercises: Exercise[] }[] = [];
    const processedIds = new Set<string>();

    block.exercises.forEach(ex => {
        if (processedIds.has(ex.id)) return;

        if (ex.supersetIdentifier) {
            const supersetExercises = block.exercises.filter(e => e.supersetIdentifier === ex.supersetIdentifier);
            steps.push({ type: 'superset', exercises: supersetExercises });
            supersetExercises.forEach(e => processedIds.add(e.id));
        } else {
            steps.push({ type: 'single', exercises: [ex] });
            processedIds.add(ex.id);
        }
    });
    return steps;
  }, [activeBlockId, workout.blocks]);

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

  const handleAddSupersetRound = (supersetIdentifier: string) => {
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === activeBlockId)?.exercises || [];
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

  const handleRemoveSupersetRound = (supersetIdentifier: string, roundIndex: number) => {
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === activeBlockId)?.exercises || [];
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

  const handleApplyQuickLogOrAddOne = (supersetIdentifier: string) => {
    if (!activeBlockId) return;
    const roundsStr = quickLogRounds[supersetIdentifier] || '';
    const rounds = parseInt(roundsStr, 10);

    if (roundsStr.trim() !== '' && !isNaN(rounds) && rounds > 0) {
      setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === activeBlockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        
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
      handleAddSupersetRound(supersetIdentifier);
    }
  };

  const handleUndoQuickLog = (supersetIdentifier: string) => {
    if (!activeBlockId) return;
    setQuickLoggedSupersets(prev => {
        const newState = { ...prev };
        delete newState[supersetIdentifier];
        return newState;
    });
    setLogEntries(prev => {
        const newEntries = new Map(prev);
        const activeBlockExercises = workout.blocks.find(b => b.id === activeBlockId)?.exercises || [];
        const exercisesInSuperset = activeBlockExercises.filter(ex => ex.supersetIdentifier === supersetIdentifier);
        exercisesInSuperset.forEach(ex => {
            newEntries.set(ex.id, [{ id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false }]);
        });
        return newEntries;
    });
  };

  const handleFinalSubmit = () => {
    setIsSaving(true);
    setHasSaved(false);
    const entriesToSave: WorkoutExerciseLog[] = [];
    let allInputsValid = true;
    let firstErrorMessage = "";

    logEntries.forEach((sets, exerciseId) => {
        if (!allInputsValid) return; 

        const exerciseDetails = exercisesToLog.find(ex => ex.id === exerciseId);
        const loggableMetrics = exerciseDetails?.loggableMetrics?.length ? exerciseDetails.loggableMetrics : ['reps', 'weight'];

        const validatedAndCompletedSets: SetDetail[] = [];
        const completedSets = sets.filter(s => s.isCompleted);

        for (const currentSet of completedSets) {
            let hasAtLeastOneMetric = false;
            const newSetToSave: SetDetail = { id: currentSet.id, isCompleted: true };

            for (const metric of loggableMetrics) {
                let valueStr: string | number | undefined;
                let key: keyof SetDetail = 'reps'; 
                let isInt = false;

                switch(metric) {
                    case 'reps': valueStr = currentSet.reps; key = 'reps'; isInt = true; break;
                    case 'weight': valueStr = currentSet.weight; key = 'weight'; break;
                    case 'distance': valueStr = currentSet.distanceMeters; key = 'distanceMeters'; break;
                    case 'duration': valueStr = currentSet.durationSeconds; key = 'durationSeconds'; isInt = true; break;
                    case 'calories': valueStr = currentSet.caloriesKcal; key = 'caloriesKcal'; isInt = true; break;
                }

                if (valueStr !== undefined && String(valueStr).trim() !== '') {
                    const numValue = Number(String(valueStr).replace(',', '.'));
                    if (isNaN(numValue) || numValue < 0 || (isInt && !Number.isInteger(numValue))) {
                        allInputsValid = false;
                        firstErrorMessage = `Ogiltigt värde för '${metric}' i övningen '${exerciseDetails?.name}'. Ange ett positivt ${isInt ? 'heltal' : 'tal'}.`;
                        break; 
                    }
                    if (key === 'weight' && Math.round(numValue * 10) % 5 !== 0) {
                        allInputsValid = false;
                        firstErrorMessage = `Vikt för '${exerciseDetails?.name}' måste vara i hela eller halva kilon (t.ex. 100 eller 100.5).`;
                        break;
                    }
                    (newSetToSave as any)[key] = numValue;
                    hasAtLeastOneMetric = true;
                }
            }
            if (!allInputsValid) break; 

            if (hasAtLeastOneMetric) {
                validatedAndCompletedSets.push(newSetToSave);
            } else {
                allInputsValid = false;
                firstErrorMessage = `Ett slutfört set för '${exerciseDetails?.name}' saknar data. Fyll i värden eller avmarkera setet.`;
                break; 
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

    if (!participantProfile?.id) {
        alert("Kan inte spara logg: Användar-ID saknas. Kontrollera att din profil är korrekt ifylld.");
        setIsSaving(false);
        return;
    }

    const newLog: WorkoutLog = {
      type: 'workout',
      id: (isNewSession || !logForReferenceOrEdit) ? crypto.randomUUID() : logForReferenceOrEdit.id,
      workoutId: workout.id,
      participantId: participantProfile.id,
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
  
  const handleGoToFinalize = () => {
    let hasCompletedSets = false;
    logEntries.forEach(sets => {
        if (sets.some(s => s.isCompleted)) {
            hasCompletedSets = true;
        }
    });

    if (!hasCompletedSets && !isNewSession) {
         setCurrentView('finalizing');
         formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
         return;
    }

    if (!hasCompletedSets) {
        if (!confirm("Du har inte markerat några set som slutförda. Passet kommer sparas utan övningsdata. Vill du fortsätta för att lämna en kommentar och känsla?")) {
            return;
        }
    }
    setCurrentView('finalizing');
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const hasEnteredData = useCallback((): boolean => {
    if (currentView === 'finalizing') return true;
    
    // A simple string comparison is not ideal for complex objects but is reliable for deep equality check here.
    const entriesChanged = JSON.stringify(Array.from(logEntries.entries())) !== JSON.stringify(Array.from(initialLogEntries.entries()));
    const commentChanged = postWorkoutComment !== initialPostWorkoutComment;
    const moodChanged = moodRating !== initialMoodRating;

    return entriesChanged || commentChanged || moodChanged;
  }, [logEntries, initialLogEntries, postWorkoutComment, initialPostWorkoutComment, moodRating, initialMoodRating, currentView]);

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

  const handleSelectBlock = (blockId: string) => {
    setActiveBlockId(blockId);
    setCurrentStepInBlock(0);
    setCurrentView('logging_block');
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavigateStep = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
        if (currentStepInBlock < loggableStepsInActiveBlock.length - 1) {
            setCurrentStepInBlock(prev => prev + 1);
        } else {
            setCurrentView('block_selection');
            setActiveBlockId(null);
        }
    } else { // prev
        if (currentStepInBlock > 0) {
            setCurrentStepInBlock(prev => prev - 1);
        } else {
            setCurrentView('block_selection');
            setActiveBlockId(null);
        }
    }
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getBlockStatus = useCallback((block: WorkoutBlock): 'not_started' | 'in_progress' | 'completed' => {
    if (!block.exercises || block.exercises.length === 0) {
      return 'completed';
    }

    const allSetsForBlock = block.exercises.flatMap(ex => logEntries.get(ex.id) || []);
    if (allSetsForBlock.length === 0) {
      return 'not_started';
    }
    
    const completedSetsCount = allSetsForBlock.filter(s => s.isCompleted).length;
    
    if (completedSetsCount === 0) {
        return 'not_started';
    }

    if (completedSetsCount === allSetsForBlock.length) {
      return 'completed';
    }
    
    return 'in_progress';
  }, [logEntries]);

  const allBlocksCompleted = useMemo(() => {
    const blocksWithExercises = workout.blocks?.filter(b => b.exercises && b.exercises.length > 0) || [];
    if (blocksWithExercises.length === 0) {
      return true;
    }
    return blocksWithExercises.every(block => getBlockStatus(block) === 'completed');
  }, [workout.blocks, getBlockStatus]);

  const renderSingleExercise = (exercise: Exercise) => {
    const exerciseTip = isNewSession ? aiTips?.exerciseTips.find(t => t.exerciseName.toLowerCase() === exercise.name.toLowerCase()) : null;
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
          <h4 className="text-xl font-bold text-gray-800 mb-2">{exercise.name} {exercise.isBodyweight && <span className="text-sm text-green-600">(KV)</span>}</h4>
          {exercise.notes && <p className="text-sm text-gray-500 mb-2">Coach: <span className="italic">{exercise.notes}</span></p>}
          <div className="space-y-2">
            {currentLoggedSets.map((setDetail, setIndex) => {
              const previousSetDataForDisplay = previousExerciseDataForDisplay?.loggedSets?.[setIndex];
              const estimated1RM = (exercise.baseLiftType && !exercise.isBodyweight) ? calculateEstimated1RM(setDetail.weight, setDetail.reps) : null;
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
                      <div className="w-24 flex-shrink-0"></div>
                  </div>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 flex flex-wrap gap-2">
                        {loggableMetrics.map(metric => (
                            <Input
                                key={metric} containerClassName="flex-1 min-w-[90px]" inputSize="sm" id={`${metric}-${exercise.id}-${setDetail.id}`}
                                name={`${metric}-${exercise.id}-${setDetail.id}`} type={metricInputMap[metric].type} inputMode={metric === 'reps' ? 'numeric' : 'decimal'}
                                placeholder={metricInputMap[metric].placeholder}
                                value={(setDetail as any)[metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric] || ''}
                                onChange={(e) => handleSetInputChange(exercise.id, setDetail.id, (metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric), e.target.value)}
                                min="0" step={metricInputMap[metric].step}
                            />
                        ))}
                    </div>
                    <button 
                        onClick={() => handleSetCompletionChange(exercise.id, setDetail.id, !setDetail.isCompleted)} 
                        className={`flex-shrink-0 w-16 flex items-center justify-center p-1 rounded-lg transition-colors ${setDetail.isCompleted ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`} 
                        aria-pressed={setDetail.isCompleted} title={setDetail.isCompleted ? "Markera som ej slutfört" : "Markera som slutfört"}
                    >
                      {setDetail.isCompleted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  </div>
                  {estimated1RM && (
                    <div className="text-right mt-1.5 pr-1">
                        <p className="text-sm text-gray-600">
                            <span role="img" aria-label="calculation">📊</span> Estimerat 1RM: 
                            <span className="font-bold text-flexibel ml-1">{estimated1RM} kg</span>
                        </p>
                    </div>
                  )}
                  {previousSetDataForDisplay && (<p className="text-sm text-gray-500 mt-2">Föregående: {formatPreviousSetDisplay(previousSetDataForDisplay, exercise.isBodyweight)}</p>)}
                </div>
              )
            })}
            {exerciseTip && <AiTipComponent tip={exerciseTip.tip} />}
            <Button onClick={() => handleAddStandaloneSet(exercise.id)} variant="secondary" size="sm" className="w-full">Lägg till Set</Button>
          </div>
        </div>
      );
  };

  const renderSuperset = (supersetExercises: Exercise[], supersetId: string) => {
    const isQuickLogged = quickLoggedSupersets[supersetId];
    if (isQuickLogged) {
        return (
            <div key={`quick-log-confirm-${supersetId}`} className="p-3 bg-green-100 border border-green-300 rounded-md shadow-sm my-4 flex justify-between items-center gap-2">
                <span className="text-green-800 font-semibold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {isQuickLogged} rundor loggade
                </span>
                <Button onClick={() => handleUndoQuickLog(supersetId)} variant="ghost" size="sm" className="!text-sm text-gray-600 hover:text-gray-900">
                    Ångra
                </Button>
            </div>
        );
    }
    
    const supersetTitle = supersetExercises.map(e => e.name).join(' + ');
    const firstExerciseInSuperset = supersetExercises[0];
    
    const supersetTips = isNewSession ? supersetExercises
        .map(ex => aiTips?.exerciseTips.find(t => t.exerciseName.toLowerCase() === ex.name.toLowerCase()))
        .filter((t): t is { exerciseName: string; tip: string } => !!t)
        : [];

    let maxSetsInSuperset = 0;
    supersetExercises.forEach(ex => {
        const sets = logEntries.get(ex.id) || [];
        if (sets.length > maxSetsInSuperset) maxSetsInSuperset = sets.length;
    });
    if (maxSetsInSuperset === 0) maxSetsInSuperset = 1;

    const blockForThisSuperset = workout.blocks.find(b => b.id === activeBlockId);
    
    return (
        <div key={supersetId} className="p-4 bg-white border-l-4 border-blue-500 rounded-r-lg shadow-lg my-4">
            <h4 className="text-xl font-bold text-blue-800 mb-2">Superset: {supersetTitle}</h4>
            {firstExerciseInSuperset.notes && <p className="text-sm text-gray-500 mb-2">Coach: <span className="italic">{firstExerciseInSuperset.notes}</span></p>}
            
            {Array.from({ length: maxSetsInSuperset }).map((_, roundIndex) => (
                <div key={`superset-${supersetId}-round-${roundIndex}`} className="mt-2 pt-2 border-t border-gray-200 first:border-t-0 first:mt-0">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-base font-medium text-blue-700">Runda {roundIndex + 1}</p>
                        {maxSetsInSuperset > 1 && (<Button onClick={() => handleRemoveSupersetRound(supersetId, roundIndex)} variant="danger" size="sm" className="!px-1.5 !py-0.5 !text-xs">Ta bort Runda</Button>)}
                    </div>
                    {supersetExercises.map(exInSS => {
                        const setDetail = (logEntries.get(exInSS.id) || [])[roundIndex] || {id: crypto.randomUUID(), reps: '', weight: '', isCompleted: false};
                        const loggableMetricsForSS = getLoggableMetrics(exInSS);
                        const estimated1RM_SS = (exInSS.baseLiftType && !exInSS.isBodyweight) ? calculateEstimated1RM(setDetail.weight, setDetail.reps) : null;

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
                                              key={metric} containerClassName="flex-1 min-w-[90px]" inputSize="sm" id={`${metric}-${exInSS.id}-${setDetail.id}`}
                                              name={`${metric}-${exInSS.id}-${setDetail.id}`} type={metricInputMap[metric].type} inputMode={metric === 'reps' ? 'numeric' : 'decimal'}
                                              placeholder={metricInputMap[metric].placeholder}
                                              value={(setDetail as any)[metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric] || ''}
                                              onChange={(e) => handleSetInputChange(exInSS.id, setDetail.id, (metric === 'distance' ? 'distanceMeters' : metric === 'duration' ? 'durationSeconds' : metric === 'calories' ? 'caloriesKcal' : metric), e.target.value)}
                                              min="0" step={metricInputMap[metric].step}
                                          />
                                      ))}
                                  </div>
                                  <button 
                                      onClick={() => handleSetCompletionChange(exInSS.id, setDetail.id, !setDetail.isCompleted)} 
                                      className={`flex-shrink-0 w-16 flex items-center justify-center p-1 rounded-lg transition-colors ${setDetail.isCompleted ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`} 
                                      aria-pressed={setDetail.isCompleted} title={setDetail.isCompleted ? "Markera som ej slutfört" : "Markera som slutfört"}
                                  >
                                    {setDetail.isCompleted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                  </button>
                              </div>
                              {estimated1RM_SS && (
                                <div className="text-right mt-1.5 pr-1">
                                    <p className="text-sm text-gray-600">
                                        <span role="img" aria-label="calculation">📊</span> Estimerat 1RM: 
                                        <span className="font-bold text-flexibel ml-1">{estimated1RM_SS} kg</span>
                                    </p>
                                </div>
                              )}
                              {previousSetDataForDisplaySS && (<p className="text-sm text-gray-500 mt-2">Föregående: {formatPreviousSetDisplay(previousSetDataForDisplaySS, exInSS.isBodyweight)}</p>)}
                          </div>
                        );
                    })}
                </div>
            ))}

            {supersetTips.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 space-y-3">
                    {supersetTips.map(tip => (
                        <div key={tip.exerciseName}>
                            <p className="text-sm font-semibold text-gray-700 mb-1">{tip.exerciseName}:</p>
                            <div className="p-2 bg-violet-50 border-l-4 border-violet-400 rounded-r-md text-sm text-violet-800">
                                <div className="flex items-start">
                                    <span className="text-violet-600 mr-2 text-base pt-0.5 shrink-0" role="img" aria-label="AI tip">💡</span>
                                    <div className="flex-1" dangerouslySetInnerHTML={{ __html: tip.tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {blockForThisSuperset?.isQuickLogEnabled ? (
                <div className="flex items-end gap-2 mt-3 pt-3 border-t border-gray-200">
                    <Input
                        label="Snabblogga" inputSize="sm" id={`quick-log-integrated-${supersetId}`} type="number"
                        placeholder="Antal rundor..." value={quickLogRounds[supersetId] || ''}
                        onChange={(e) => handleQuickLogRoundsChange(supersetId, e.target.value)}
                    />
                    <Button 
                        onClick={() => handleApplyQuickLogOrAddOne(supersetId)} 
                        variant="secondary" size="sm" className="whitespace-nowrap flex-shrink-0"
                    >
                        {(quickLogRounds[supersetId] && parseInt(quickLogRounds[supersetId], 10) > 0)
                        ? `Logga ${quickLogRounds[supersetId]} rundor`
                        : 'Lägg till 1 runda'}
                    </Button>
                </div>
            ) : (
                <Button onClick={() => handleAddSupersetRound(supersetId)} variant="secondary" size="sm" className="mt-3 w-full">Lägg till en runda</Button>
            )}
        </div>
    );
  };
  
  return (
    <div className="relative" ref={formTopRef}>
      {isLoadingAiSuggestion && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg text-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-flexibel mb-4"></div>
          <p className="text-xl font-bold text-gray-800">Flexibot tänker...</p>
          <p className="text-base text-gray-600">Hämtar personliga tips för ditt pass.</p>
        </div>
      )}

      <div className={`space-y-4 ${isLoadingAiSuggestion ? 'opacity-20' : 'transition-opacity duration-300'}`}>
        {currentView !== 'logging_block' && (
            <div className="p-4 bg-white rounded-lg shadow-md border">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-flexibel">{workout.title}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <p className="text-base text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                        {intensityDetail && (
                            <span className={`inline-block ${intensityDetail.twBadgeClass} text-sm font-semibold px-2.5 py-1 rounded-full`}>
                            Fokus: {intensityDetail.label}
                            </span>
                        )}
                    </div>
                    {(isNewSession && logForReferenceOrEdit) && <p className="text-sm text-gray-500 italic mt-1">Ny logg, baserat på {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
                    {!isNewSession && logForReferenceOrEdit && <p className="text-sm text-orange-600 italic mt-1">Redigerar logg från {new Date(logForReferenceOrEdit.completedDate).toLocaleDateString('sv-SE')}.</p>}
                </div>
                <Button onClick={handleCloseAttempt} variant="outline" size="sm" className="ml-auto flex-shrink-0">Stäng</Button>
            </div>
            
             <details className="mt-4 pt-4 border-t border-gray-200 group" open={isSuggestionVisible} onToggle={(e) => setIsSuggestionVisible((e.target as HTMLDetailsElement).open)}>
                <summary className="text-base font-semibold text-gray-600 cursor-pointer hover:text-gray-800 list-none flex justify-between items-center py-1">
                    <span>Coachning &amp; tips</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </summary>
                <div className="space-y-4 mt-2">
                    {!isLoadingAiSuggestion && aiTips?.generalTips && (
                        <div className="animate-fade-in-down">{renderMarkdownBlock(aiTips.generalTips)}</div>
                    )}
                    {workout.coachNote && (
                        <div><h5 className="text-lg font-semibold text-gray-800">Coachanteckning</h5><p className="text-base text-gray-700 italic whitespace-pre-wrap mt-1">{workout.coachNote}</p></div>
                    )}
                    {intensityDetail && workout.intensityInstructions && (
                        <div className={`mt-2 p-3 rounded-lg border ${intensityDetail.twClass}`}>
                            <h5 className="text-lg font-semibold text-current">Instruktioner ({intensityDetail.label})</h5>
                            <p className="text-base text-current/90 italic whitespace-pre-wrap mt-1">{workout.intensityInstructions}</p>
                            {intensityDetail.pbSuggestion && (<p className="mt-2 pt-2 border-t border-current/20 text-sm font-bold text-current">{intensityDetail.pbSuggestion}</p>)}
                        </div>
                    )}
                </div>
            </details>
            </div>
        )}

        {currentView === 'block_selection' && (
            <div className="space-y-4 animate-fade-in-down">
                <h3 className="text-xl font-semibold text-gray-700 px-2">Välj ett block att börja med:</h3>
                {workout.blocks.map((block, index) => {
                    const status = getBlockStatus(block);
                    const statusStyles = {
                        not_started: { text: 'Ej påbörjat', color: 'text-gray-500', iconColor: 'bg-gray-400' },
                        in_progress: { text: 'Pågår', color: 'text-yellow-600', iconColor: 'bg-yellow-500' },
                        completed: { text: 'Slutfört', color: 'text-green-600', iconColor: 'bg-green-500' }
                    };
                    return (
                        <div key={block.id} 
                            className="bg-white p-4 rounded-xl shadow-lg border-2 border-transparent hover:border-flexibel focus-within:border-flexibel focus-within:ring-2 focus-within:ring-flexibel/50 transition-all duration-200 ease-in-out group cursor-pointer"
                            onClick={() => handleSelectBlock(block.id)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Starta ${block.name || `Block ${index + 1}`}`}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectBlock(block.id)}>

                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-xl font-bold text-gray-800">{block.name || `Block ${index + 1}`}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{block.exercises.length} {block.exercises.length === 1 ? 'övning' : 'övningar'}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block w-3 h-3 rounded-full ${statusStyles[status].iconColor}`}></span>
                                        <span className={`text-sm font-semibold ${statusStyles[status].color}`}>
                                            {statusStyles[status].text}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-flexibel/10 group-hover:bg-flexibel text-flexibel group-hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div className="mt-6 pt-4 border-t">
                    <Button 
                        onClick={handleGoToFinalize} 
                        variant="primary"
                        size="md" 
                        fullWidth
                        disabled={!allBlocksCompleted && isNewSession}
                        title={!allBlocksCompleted && isNewSession ? "Du måste slutföra alla set med ifylld data i alla block först." : "Gå till avslutningsvyn"}
                    >
                        Färdig med passet, gå till avslut
                    </Button>
                </div>
            </div>
        )}

        {currentView === 'logging_block' && activeBlockId && (
            <div className="animate-fade-in-down pb-28">
                {/* Exercise content area */}
                <div>
                    {loggableStepsInActiveBlock[currentStepInBlock].type === 'single'
                        ? renderSingleExercise(loggableStepsInActiveBlock[currentStepInBlock].exercises[0])
                        : renderSuperset(loggableStepsInActiveBlock[currentStepInBlock].exercises, loggableStepsInActiveBlock[currentStepInBlock].exercises[0].supersetIdentifier!)
                    }
                </div>

                {/* Sticky Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-3 z-40">
                    <div className="container mx-auto max-w-4xl">
                        <div className="grid grid-cols-3 gap-2 items-center">
                            <div className="text-left">
                                <Button onClick={() => handleNavigateStep('prev')} variant="outline" size="md">
                                    {currentStepInBlock === 0 ? 'Översikt' : 'Föregående'}
                                </Button>
                            </div>
                            <div className="text-center">
                                <h3 className="text-base font-bold text-gray-800 truncate px-2 hidden sm:block">
                                    {workout.blocks.find(b => b.id === activeBlockId)?.name || `Block ${workout.blocks.findIndex(b => b.id === activeBlockId) + 1}`}
                                </h3>
                                <span className="text-sm font-semibold text-gray-600">Steg {currentStepInBlock + 1} av {loggableStepsInActiveBlock.length}</span>
                            </div>
                            <div className="text-right">
                                <Button onClick={() => handleNavigateStep('next')} variant="primary" size="md">
                                    {currentStepInBlock === loggableStepsInActiveBlock.length - 1 ? 'Klart' : 'Nästa'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {currentView === 'finalizing' && (
           <div className="animate-fade-in-down">
              <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl mt-6 border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Avsluta Pass</h3>
                <div className="space-y-4">
                    <Textarea label="Kommentar (valfri)" name="postWorkoutComment" value={postWorkoutComment} onChange={(e) => setPostWorkoutComment(e.target.value)} placeholder="T.ex. Kändes bra, vackert väder!" rows={2} />
                    <MoodSelectorInput
                        currentRating={moodRating}
                        onSelectRating={setMoodRating}
                        label="Känsla? *"
                    />
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
                <Button onClick={handleFinalSubmit} variant="primary" size="md" fullWidth disabled={isSaving || hasSaved || moodRating === null}>
                  {saveButtonText}
                </Button>
                <Button onClick={() => setCurrentView('block_selection')} variant="secondary" size="md" fullWidth disabled={isSaving}>
                  Gå tillbaka
                </Button>
              </div>
           </div>
        )}

        {showExitConfirmationModal && ( <ConfirmationModal isOpen={showExitConfirmationModal} onClose={() => setShowExitConfirmationModal(false)} onConfirm={handleConfirmExit} title="Avsluta Loggning?" message="Du har osparade ändringar. Är du säker på att du vill avsluta utan att spara?" confirmButtonText="Avsluta ändå" /> )}
      </div>
    </div>
  );
};
