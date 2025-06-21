

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Workout, WorkoutLog, GeneralActivityLog, ActivityLog, ParticipantWorkoutNote, ParticipantGoalData, PostWorkoutSummaryData, NewPB, ParticipantProfile, GenderOption, UserStrengthStats, ParticipantConditioningStats, LiftType, StrengthLevel, AllUserProvidedStrengthMultipliers, StrengthStandardDetail, UserRole, ParticipantMentalWellbeing } from '../../types';
import { Button } from '../Button';
import { WorkoutLogForm } from './WorkoutLogForm';
import { AIProgressFeedbackModal } from './AIProgressFeedbackModal';
import { ParticipantActivityView } from './ParticipantActivityView';
import { PostWorkoutSummaryModal } from './PostWorkoutSummaryModal'; 
import { LogGeneralActivityModal } from './LogGeneralActivityModal';
import { GeneralActivitySummaryModal } from './GeneralActivitySummaryModal'; 
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS, WEIGHT_COMPARISONS, FLEXIBEL_PRIMARY_COLOR, USER_PROVIDED_STRENGTH_MULTIPLIERS, STRENGTH_STANDARDS_DATA, STRENGTH_LEVEL_ORDER, STRESS_LEVEL_OPTIONS, ENERGY_LEVEL_OPTIONS, SLEEP_QUALITY_OPTIONS, OVERALL_MOOD_OPTIONS } from '../../constants'; 
import * as dateUtils from '../../utils/dateUtils';
import { FixedHeaderAndTools } from './FixedHeaderAndTools';
import { calculateFlexibelStrengthScoreInternal as calculateFSSForToolInternalOnly } from './StrengthComparisonTool';
import { getPassRecommendations } from '../../utils/passRecommendationHelper';
import { FeedbackPromptToast } from './FeedbackPromptToast'; 
import { InfoModal } from './InfoModal';


const API_KEY = process.env.API_KEY;

interface EnrichedSetDetail {
  reps: number | string;
  weight?: number | string;
}
interface EnrichedExerciseLog {
  exerciseName: string;
  exerciseNotes?: string;
  loggedSets: EnrichedSetDetail[];
}
interface EnrichedWorkoutSession {
  workoutTitle: string;
  completedDate: string;
  exercises: EnrichedExerciseLog[];
  postWorkoutComment?: string;
  moodRating?: number; 
}

interface ParticipantAreaProps {
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  setWorkoutLogs: (logs: WorkoutLog[] | ((prevLogs: WorkoutLog[]) => WorkoutLog[])) => void;
  currentRole: UserRole | null; 
  onSetRole: (role: UserRole | null) => void; 
}

// Icons for summary cards, moved here
const GoalOverviewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-flexibel" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 019 17.414V11.414L3.293 6.707A1 1 0 013 6V3zm11 1H6v1.586l4 4 4-4V4z" clipRule="evenodd" /></svg>;
const StrengthOverviewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-flexibel" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.5 2.028A1 1 0 0010.5 1h-1A1 1 0 008.5 2.028v2.944A6.974 6.974 0 004 11.532V14a1 1 0 001 1h10a1 1 0 001-1v-2.468A6.974 6.974 0 0011.5 4.972V2.028zM10 16a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" /><path d="M10 13a1 1 0 100-2 1 1 0 000 2z" /></svg>;
const BodyCompOverviewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-flexibel" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>;
const MentalWellbeingOverviewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-flexibel" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.53l.79.79A5.047 5.047 0 0010 4a5.047 5.047 0 00-.79.32L10 3.53zM12.68 5.71A5.024 5.024 0 0010 5a5.023 5.023 0 00-2.68.71L10 8.41l2.68-2.7zM6 8a4 4 0 014-4 .5.5 0 010 1A3 3 0 007 8a.5.5 0 01-1 0zm8 0a.5.5 0 01-1 0A3 3 0 0013 5a.5.5 0 010-1 4 4 0 014 4zM4.21 5.71A5.024 5.024 0 007.32 5a5.023 5.023 0 002.68.71L7.29 8.41 4.21 5.71zM10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-transform duration-200" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
const ChevronUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-transform duration-200" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;

const InfoButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }} // Stop propagation to prevent card toggle
    className="ml-2 text-flexibel hover:text-flexibel/80 focus:outline-none focus:ring-2 focus:ring-flexibel focus:ring-offset-1 rounded-full p-0.5"
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  </button>
);


const LEVEL_COLORS_HEADER: { [key in StrengthLevel]: string } = {
  'Otränad': '#ef4444', 
  'Nybörjare': '#f97316',
  'Medelgod': '#eab308', 
  'Avancerad': '#84cc16', 
  'Elit': '#14b8a6', 
};

const MAIN_LIFTS_CONFIG_HEADER: { lift: LiftType, statKey: keyof UserStrengthStats, label: string }[] = [
    { lift: 'Knäböj', statKey: 'squat1RMaxKg', label: 'Knäböj'},
    { lift: 'Bänkpress', statKey: 'benchPress1RMaxKg', label: 'Bänkpress'},
    { lift: 'Marklyft', statKey: 'deadlift1RMaxKg', label: 'Marklyft'},
    { lift: 'Axelpress', statKey: 'overheadPress1RMaxKg', label: 'Axelpress'},
];

// Helper to get age adjustment factor
const getAgeAdjustmentFactorForHeader = (
    age: number | undefined,
    lift: LiftType,
    gender: GenderOption | undefined,
    multipliers: AllUserProvidedStrengthMultipliers
): number => {
    if (!age || !gender || (gender !== 'Man' && gender !== 'Kvinna') ) return 1.0;
    const liftKey = lift.toLowerCase() as keyof AllUserProvidedStrengthMultipliers;
    if (!multipliers[liftKey]) return 1.0;
    const liftData = multipliers[liftKey];
    const genderKey = gender === 'Man' ? 'män' : 'kvinnor';
    const genderSpecificMultipliers = liftData[genderKey];
    if (!genderSpecificMultipliers || !genderSpecificMultipliers.justering) return 1.0;
    const ageAdjustments = genderSpecificMultipliers.justering;
    const ageRanges = Object.keys(ageAdjustments).sort((a,b) => parseInt(a.split('-')[0],10) - parseInt(b.split('-')[0],10));
    if (ageRanges.length > 0) {
        const firstRangeMinAge = parseInt(ageRanges[0].split('-')[0], 10);
        if (age < firstRangeMinAge) return 1.0;
    } else { return 1.0; }
    for (const range of ageRanges) {
        const [minAge, maxAge] = range.split('-').map(Number);
        if (age >= minAge && age <= maxAge) return ageAdjustments[range as keyof typeof ageAdjustments.justering];
    }
    if (ageRanges.length > 0) {
        const lastRangeMaxAge = parseInt(ageRanges[ageRanges.length - 1].split('-')[1], 10);
        if (age > lastRangeMaxAge) return ageAdjustments[ageRanges[ageRanges.length - 1] as keyof typeof ageAdjustments.justering];
    }
    return 1.0;
};

interface FlexibelStrengthScoreResultForDisplay {
  score: number;
  interpretationText: string;
  recommendations: { name: string; motivation: string }[];
}

interface InBodyScoreIndicator {
  color: string;
  text: 'Röd' | 'Orange' | 'Grön';
  explanation: string;
}

const getInBodyScoreIndicator = (score?: number): InBodyScoreIndicator | null => {
  if (score === undefined || score === null) return null;

  if (score < 60) {
    return { 
        color: LEVEL_COLORS_HEADER['Otränad'], 
        text: 'Röd',
        explanation: "Indikerar bristande balans – t.ex. låg muskelmassa eller hög fett. Bra att sätta fokus och prioritera styrka/träning."
    };
  } else if (score >= 60 && score <= 79) { 
    return { 
        color: LEVEL_COLORS_HEADER['Nybörjare'], 
        text: 'Orange',
        explanation: "Acceptabel balans men det finns utrymme för förbättring – börja jobba mer med viss träning/kost för att höja scoren."
    };
  } else { 
    return { 
        color: LEVEL_COLORS_HEADER['Avancerad'], 
        text: 'Grön',
        explanation: "Stark balans, hög muskel- vs fettnivå – fortsätt med det nuvarande upplägget."
    };
  }
};

interface MentalWellbeingIndicator {
    label: string;
    value?: number;
    options: { value: number; label: string; emoji: string; color: string }[];
    display: { text: string; emoji: string; color: string } | null;
}

const getMentalWellbeingIndicators = (wellbeingData?: ParticipantMentalWellbeing | null): MentalWellbeingIndicator[] => {
    if (!wellbeingData) return [];

    const indicators: MentalWellbeingIndicator[] = [];

    const stressDisplay = wellbeingData.stressLevel ? STRESS_LEVEL_OPTIONS.find(opt => opt.value === wellbeingData.stressLevel) : null;
    indicators.push({
        label: "Stress",
        value: wellbeingData.stressLevel,
        options: STRESS_LEVEL_OPTIONS,
        display: stressDisplay ? { text: stressDisplay.label, emoji: stressDisplay.emoji, color: stressDisplay.color } : null
    });

    const energyDisplay = wellbeingData.energyLevel ? ENERGY_LEVEL_OPTIONS.find(opt => opt.value === wellbeingData.energyLevel) : null;
    indicators.push({
        label: "Energi",
        value: wellbeingData.energyLevel,
        options: ENERGY_LEVEL_OPTIONS,
        display: energyDisplay ? { text: energyDisplay.label, emoji: energyDisplay.emoji, color: energyDisplay.color } : null
    });
    
    const sleepDisplay = wellbeingData.sleepQuality ? SLEEP_QUALITY_OPTIONS.find(opt => opt.value === wellbeingData.sleepQuality) : null;
    indicators.push({
        label: "Sömn",
        value: wellbeingData.sleepQuality,
        options: SLEEP_QUALITY_OPTIONS,
        display: sleepDisplay ? { text: sleepDisplay.label, emoji: sleepDisplay.emoji, color: sleepDisplay.color } : null
    });

    const moodDisplay = wellbeingData.overallMood ? OVERALL_MOOD_OPTIONS.find(opt => opt.value === wellbeingData.overallMood) : null;
    indicators.push({
        label: "Humör",
        value: wellbeingData.overallMood,
        options: OVERALL_MOOD_OPTIONS,
        display: moodDisplay ? { text: moodDisplay.label, emoji: moodDisplay.emoji, color: moodDisplay.color } : null
    });

    return indicators.filter(ind => ind.value !== undefined); // Only return indicators that have a value
};


export const ParticipantArea: React.FC<ParticipantAreaProps> = ({ 
    workouts, 
    workoutLogs, 
    setWorkoutLogs,
    currentRole, 
    onSetRole 
}) => {
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [participantWorkoutNotes, setParticipantWorkoutNotes] = useLocalStorage<ParticipantWorkoutNote[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_WORKOUT_NOTES, []);
  
  const [participantProfile, setParticipantProfile] = useLocalStorage<ParticipantProfile | null>(
    LOCAL_STORAGE_KEYS.PARTICIPANT_PROFILE,
    null
  );
  const [participantGoals, setParticipantGoals] = useLocalStorage<ParticipantGoalData[]>(
    LOCAL_STORAGE_KEYS.PARTICIPANT_GOALS,
    [] 
  );
  const [userStrengthStats, setUserStrengthStats] = useLocalStorage<UserStrengthStats | null>(
    LOCAL_STORAGE_KEYS.PARTICIPANT_STRENGTH_STATS,
    null
  );
   const [userConditioningStats, setUserConditioningStats] = useLocalStorage<ParticipantConditioningStats | null>(
    LOCAL_STORAGE_KEYS.PARTICIPANT_CONDITIONING_STATS,
    null
  );
  const [participantMentalWellbeing, setParticipantMentalWellbeing] = useLocalStorage<ParticipantMentalWellbeing | null>(
    LOCAL_STORAGE_KEYS.PARTICIPANT_MENTAL_WELLBEING,
    null
  );

  const [generalActivityLogs, setGeneralActivityLogs] = useLocalStorage<GeneralActivityLog[]>(LOCAL_STORAGE_KEYS.GENERAL_ACTIVITY_LOGS, []);
  const [isGeneralActivityModalOpen, setIsGeneralActivityModalOpen] = useState(false);
  const [isGeneralActivitySummaryModalOpen, setIsGeneralActivitySummaryModalOpen] = useState(false); 
  const [currentGeneralActivityForSummary, setCurrentGeneralActivityForSummary] = useState<GeneralActivityLog | null>(null); 


  const [workoutForLogging, setWorkoutForLogging] = useState<Workout | null>(null);
  const [logToUseAsReferenceOrEdit, setLogToUseAsReferenceOrEdit] = useState<WorkoutLog | null>(null);
  const [isNewSessionFlag, setIsNewSessionFlag] = useState<boolean>(false);

  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [currentLogForSummary, setCurrentLogForSummary] = useState<WorkoutLog | null>(null);
  const [currentWorkoutForSummary, setCurrentWorkoutForSummary] = useState<Workout | null>(null);

  const [isAiProgressModalOpen, setIsAiProgressModalOpen] = useState(false);
  const [aiProgressFeedback, setAiProgressFeedback] = useState<string | null>(null);
  const [isAiProgressLoading, setIsAiProgressLoading] = useState(false);
  const [aiProgressError, setAiProgressError] = useState<string | null>(null);

  const mainContentRef = useRef<HTMLDivElement>(null);

  // For contextual feedback prompt
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [lastFeedbackPromptTime, setLastFeedbackPromptTime] = useLocalStorage<number>(
    LOCAL_STORAGE_KEYS.LAST_FEEDBACK_PROMPT_TIME,
    0
  );

  const [summaryCardStates, setSummaryCardStates] = useState({
    // 'goals' card is now always open, so its state is not strictly needed for toggle.
    // Keeping the structure for other cards if they exist or are added.
    strength: false,
    bodyComp: false,
    mentalWellbeing: false,
  });

  const [isStrengthInfoModalOpen, setIsStrengthInfoModalOpen] = useState(false);
  const [isBodyCompInfoModalOpen, setIsBodyCompInfoModalOpen] = useState(false);


  type SummaryCardKey = keyof typeof summaryCardStates;

  const toggleSummaryCard = (cardKey: SummaryCardKey) => {
    setSummaryCardStates(prev => ({ ...prev, [cardKey]: !prev[cardKey] }));
  };


  const triggerFeedbackPromptIfAppropriate = useCallback(() => {
    const now = Date.now();
    // Cooldown period: 30 minutes. For testing, use a shorter period like 10 seconds.
    const COOLDOWN_PERIOD = 30 * 60 * 1000; 
    // const COOLDOWN_PERIOD = 10 * 1000; // Test: 10 seconds
    if (now - lastFeedbackPromptTime > COOLDOWN_PERIOD) {
      setShowFeedbackToast(true);
      // Note: lastFeedbackPromptTime is updated when the toast is actioned (accepted/declined)
    }
  }, [lastFeedbackPromptTime, setLastFeedbackPromptTime, setShowFeedbackToast]);

  
  useEffect(() => {
    if (API_KEY) {
      try {
        setAi(new GoogleGenAI({ apiKey: API_KEY }));
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI:", e);
      }
    } else {
      console.warn("API_KEY for Gemini not found. AI features will be disabled.");
    }
  }, []);

  const getLatestGoal = useCallback((): ParticipantGoalData | null => {
    if (participantGoals.length === 0) {
      return null;
    }
    const sortedGoals = [...participantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
    return sortedGoals[0];
  }, [participantGoals]);


  useEffect(() => {
    const latestGoal = getLatestGoal();
    const allLogs: ActivityLog[] = [...workoutLogs, ...generalActivityLogs];

    if (!latestGoal || latestGoal.workoutsPerWeekTarget <= 0) {
      if (latestGoal && latestGoal.currentWeeklyStreak > 0) {
        setParticipantGoals(prevGoals => {
            if (prevGoals.length === 0) return [];
            const updatedGoals = [...prevGoals];
            const lastGoalIndex = updatedGoals.findIndex(g => g.id === latestGoal.id); 
            if (lastGoalIndex !== -1) { 
                 updatedGoals[lastGoalIndex] = {
                    ...updatedGoals[lastGoalIndex],
                    currentWeeklyStreak: 0,
                    lastStreakUpdateEpochWeekId: ''
                };
                return updatedGoals;
            }
            return prevGoals;
        });
      }
      return;
    }

    const { workoutsPerWeekTarget } = latestGoal;

    const logsByWeek: Record<string, ActivityLog[]> = {};
    allLogs.forEach(log => {
      const weekId = dateUtils.getEpochWeekId(new Date(log.completedDate));
      if (!logsByWeek[weekId]) {
        logsByWeek[weekId] = [];
      }
      logsByWeek[weekId].push(log);
    });

    const sortedLoggedWeekIds = Object.keys(logsByWeek).sort((a, b) => {
      const aDate = dateUtils.getDateFromEpochWeekId(a);
      const bDate = dateUtils.getDateFromEpochWeekId(b);
      return aDate.getTime() - bDate.getTime();
    });

    if (sortedLoggedWeekIds.length === 0) {
      if (latestGoal.currentWeeklyStreak > 0) {
        setParticipantGoals(prevGoals => {
            if (prevGoals.length === 0) return [];
            const updatedGoals = [...prevGoals];
            const lastGoalIndex = updatedGoals.findIndex(g => g.id === latestGoal.id);
            if (lastGoalIndex !== -1) {
                updatedGoals[lastGoalIndex] = { ...updatedGoals[lastGoalIndex], currentWeeklyStreak: 0, lastStreakUpdateEpochWeekId: '' };
                return updatedGoals;
            }
            return prevGoals;
        });
      }
      return;
    }

    let calculatedStreak = 0;
    let lastWeekOfCalculatedStreak = ""; 

    for (let i = sortedLoggedWeekIds.length - 1; i >= 0; i--) {
      const currentIterationWeekId = sortedLoggedWeekIds[i];
      const logsInThisIterationWeek = logsByWeek[currentIterationWeekId]?.length || 0;

      if (logsInThisIterationWeek >= workoutsPerWeekTarget) {
        if (calculatedStreak === 0) { 
          calculatedStreak = 1;
          lastWeekOfCalculatedStreak = currentIterationWeekId;
        } else {
          const expectedPreviousSequentialWeekId = dateUtils.getPreviousEpochWeekId(lastWeekOfCalculatedStreak);
          if (currentIterationWeekId === expectedPreviousSequentialWeekId) {
            calculatedStreak++;
            lastWeekOfCalculatedStreak = currentIterationWeekId; 
          } else {
            break; 
          }
        }
      } else {
        if (i === sortedLoggedWeekIds.length - 1) { 
            const currentWeekId = dateUtils.getEpochWeekId(new Date());
             if (currentIterationWeekId === currentWeekId || new Date(dateUtils.getDateFromEpochWeekId(currentIterationWeekId)) < new Date()) {
                calculatedStreak = 0;
                lastWeekOfCalculatedStreak = "";
            }
        }
        break; 
      }
    }
    
    let finalLastStreakEpochWeekId = "";
    if (calculatedStreak > 0 && lastWeekOfCalculatedStreak) {
        finalLastStreakEpochWeekId = lastWeekOfCalculatedStreak;
    }
    
    const currentGoal = getLatestGoal(); 
    if (currentGoal && (currentGoal.currentWeeklyStreak !== calculatedStreak || currentGoal.lastStreakUpdateEpochWeekId !== finalLastStreakEpochWeekId)) {
       setParticipantGoals(prevGoals => {
            if (prevGoals.length === 0) return [];
            const updatedGoals = [...prevGoals];
            const lastGoalIndex = updatedGoals.findIndex(g => g.id === currentGoal.id);
            if (lastGoalIndex !== -1) {
                updatedGoals[lastGoalIndex] = { 
                    ...updatedGoals[lastGoalIndex], 
                    currentWeeklyStreak: calculatedStreak, 
                    lastStreakUpdateEpochWeekId: finalLastStreakEpochWeekId 
                };
                return updatedGoals;
            }
            return prevGoals;
        });
    }
  }, [workoutLogs, generalActivityLogs, participantGoals, getLatestGoal, setParticipantGoals]);


  const handleSaveProfileAndGoals = useCallback((
    profileUpdate: ParticipantProfile, 
    newGoalData: ParticipantGoalData 
  ) => {
    setParticipantProfile(profileUpdate);
    setParticipantGoals(prevGoals => {
        return [...prevGoals, newGoalData];
    });
    triggerFeedbackPromptIfAppropriate();
  }, [setParticipantProfile, setParticipantGoals, triggerFeedbackPromptIfAppropriate]);


  const handleSaveNextTimeNote = (workoutId: string, note: string) => {
    setParticipantWorkoutNotes(prevNotes => {
      const existingNoteIndex = prevNotes.findIndex(n => n.workoutId === workoutId);
      const updatedNotes = [...prevNotes];
      if (note.trim() === '') { 
        if (existingNoteIndex > -1) {
            updatedNotes.splice(existingNoteIndex, 1);
        }
      } else { 
        const newNoteEntry: ParticipantWorkoutNote = { workoutId, note, lastUpdated: new Date().toISOString() };
        if (existingNoteIndex > -1) {
          updatedNotes[existingNoteIndex] = newNoteEntry;
        } else {
          updatedNotes.push(newNoteEntry);
        }
      }
      return updatedNotes;
    });
  };

  const resetLogFormState = () => {
    setWorkoutForLogging(null); 
    setLogToUseAsReferenceOrEdit(null);
    setIsNewSessionFlag(false);
  };

  const calculatePostWorkoutSummary = (
    log: WorkoutLog, 
    workout: Workout, 
    allPastLogsForPBs: WorkoutLog[] 
  ): PostWorkoutSummaryData | undefined => {
    let totalWeightLiftedVolume = 0;
    log.entries.forEach(entry => {
      entry.loggedSets.forEach(set => {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (reps > 0 && weight > 0) {
          totalWeightLiftedVolume += weight * reps;
        } else if (reps > 0 && weight === 0) { 
            totalWeightLiftedVolume += reps * 1; 
        }
      });
    });

    let itemEquivalent: PostWorkoutSummaryData['animalEquivalent'] = undefined; 
    if (totalWeightLiftedVolume > 0) { 
        const sortedItems = [...WEIGHT_COMPARISONS].sort((a, b) => b.weightKg - a.weightKg); 
        for (const item of sortedItems) {
          if (totalWeightLiftedVolume >= item.weightKg) {
            const count = Math.floor(totalWeightLiftedVolume / item.weightKg);
            if (count > 0) {
              itemEquivalent = { 
                name: item.name, 
                count, 
                unitName: count > 1 ? (item.pluralName || `${item.name}s`) : item.name, 
                emoji: item.emoji 
              };
              break;
            }
          }
        }
         if (!itemEquivalent && WEIGHT_COMPARISONS.length > 0) {
            const smallestItem = WEIGHT_COMPARISONS.sort((a,b) => a.weightKg - b.weightKg)[0]; 
            if (smallestItem && totalWeightLiftedVolume >= smallestItem.weightKg * 0.3) { 
                 itemEquivalent = { name: `nästan en ${smallestItem.name}`, count: 1, unitName: '', emoji: smallestItem.emoji };
            }
        }
    }

    const newPBs: NewPB[] = [];
    log.entries.forEach(currentEntry => {
      const exerciseDetails = workout.exercises.find(ex => ex.id === currentEntry.exerciseId);
      if (!exerciseDetails) return;

      let maxWeightThisSessionForExercise = 0;
      let maxRepsAtMaxWeightThisSession = 0;
      let maxRepsAtAnyWeightThisSession =0;
      let weightForMaxRepsAtAnyWeight = 0;

      currentEntry.loggedSets.forEach(set => {
        const currentWeight = Number(set.weight) || 0;
        const currentReps = Number(set.reps) || 0;

        if (currentWeight > maxWeightThisSessionForExercise) {
            maxWeightThisSessionForExercise = currentWeight;
            maxRepsAtMaxWeightThisSession = currentReps;
        } else if (currentWeight === maxWeightThisSessionForExercise) {
            maxRepsAtMaxWeightThisSession = Math.max(maxRepsAtMaxWeightThisSession, currentReps);
        }
        
        if (currentReps > maxRepsAtAnyWeightThisSession) {
            maxRepsAtAnyWeightThisSession = currentReps;
            weightForMaxRepsAtAnyWeight = currentWeight;
        }
      });

      const logsForPBComparison = allPastLogsForPBs.filter(prevLog => prevLog.id !== log.id && prevLog.workoutId === workout.id);
      let historicalMaxWeightForExercise = 0;
      let historicalMaxRepsAtHistoricalMaxWeight = 0;
      let historicalMaxRepsAtAnyWeightForExercise = 0;

      logsForPBComparison.forEach(prevLog => {
        prevLog.entries.forEach(prevExerciseEntry => {
          if (prevExerciseEntry.exerciseId === currentEntry.exerciseId) {
            prevExerciseEntry.loggedSets.forEach(prevSet => {
                const prevWeight = Number(prevSet.weight) || 0;
                const prevReps = Number(prevSet.reps) || 0;

                if (prevWeight > historicalMaxWeightForExercise) {
                    historicalMaxWeightForExercise = prevWeight;
                    historicalMaxRepsAtHistoricalMaxWeight = prevReps;
                } else if (prevWeight === historicalMaxWeightForExercise) {
                    historicalMaxRepsAtHistoricalMaxWeight = Math.max(historicalMaxRepsAtHistoricalMaxWeight, prevReps);
                }

                if (prevReps > historicalMaxRepsAtAnyWeightForExercise) {
                    historicalMaxRepsAtAnyWeightForExercise = prevReps;
                }
            });
          }
        });
      });

      if (maxWeightThisSessionForExercise > 0 && maxWeightThisSessionForExercise > historicalMaxWeightForExercise) {
        newPBs.push({
          exerciseName: exerciseDetails.name,
          achievement: `Nytt PB i vikt!`,
          value: `${maxWeightThisSessionForExercise} kg${maxRepsAtMaxWeightThisSession > 0 ? ` x ${maxRepsAtMaxWeightThisSession} reps` : ''}`,
          previousBest: historicalMaxWeightForExercise > 0 ? `(tidigare ${historicalMaxWeightForExercise} kg${historicalMaxRepsAtHistoricalMaxWeight > 0 ? ` x ${historicalMaxRepsAtHistoricalMaxWeight} reps` : ''})` : '(första gången med vikt!)',
        });
      } else if (maxWeightThisSessionForExercise > 0 && maxWeightThisSessionForExercise === historicalMaxWeightForExercise && maxRepsAtMaxWeightThisSession > historicalMaxRepsAtHistoricalMaxWeight) {
         newPBs.push({
          exerciseName: exerciseDetails.name,
          achievement: `Nytt PB i reps på vikten ${maxWeightThisSessionForExercise} kg!`,
          value: `${maxRepsAtMaxWeightThisSession} reps`,
          previousBest: `(tidigare ${historicalMaxRepsAtHistoricalMaxWeight} reps på ${historicalMaxWeightForExercise} kg)`,
        });
      } else if (maxRepsAtAnyWeightThisSession > 0 && maxRepsAtAnyWeightThisSession > historicalMaxRepsAtAnyWeightForExercise) {
         newPBs.push({
          exerciseName: exerciseDetails.name,
          achievement: `Nytt PB i reps!`,
          value: `${maxRepsAtAnyWeightThisSession} reps${weightForMaxRepsAtAnyWeight > 0 ? ` @ ${weightForMaxRepsAtAnyWeight} kg` : ''}`,
          previousBest: historicalMaxRepsAtAnyWeightForExercise > 0 ? `(tidigare ${historicalMaxRepsAtAnyWeightForExercise} reps)` : '(första gången med reps!)',
        });
      }
    });

    return { totalWeightLifted: totalWeightLiftedVolume, animalEquivalent: itemEquivalent, newPBs };
  };
  
  const handleSaveLog = (log: WorkoutLog) => {
    const workout = workouts.find(w => w.id === log.workoutId);
    if (!workout) {
        console.error("Workout template not found for log:", log);
        resetLogFormState(); 
        return;
    }
    
    const allLogsForThisWorkoutTemplate = workoutLogs.filter(wl => wl.workoutId === workout.id);
    const summaryData = calculatePostWorkoutSummary(log, workout, allLogsForThisWorkoutTemplate);

    const logWithSummary: WorkoutLog = { ...log, postWorkoutSummary: summaryData }; 

    setWorkoutLogs(prevLogs => {
      const existingIndex = prevLogs.findIndex(l => l.id === logWithSummary.id);
      if (existingIndex > -1) {
        const updatedLogs = [...prevLogs];
        updatedLogs[existingIndex] = logWithSummary;
        return updatedLogs;
      }
      return [...prevLogs, logWithSummary];
    });

    setCurrentLogForSummary(logWithSummary); 
    setCurrentWorkoutForSummary(workout);
    
    resetLogFormState();
    setShowSummaryModal(true); 
  };

  const handleFinalizePostWorkoutSummary = useCallback((moodRating: number | null) => {
    if (currentLogForSummary && moodRating !== null) {
      setWorkoutLogs(prevLogs => prevLogs.map(log =>
        log.id === currentLogForSummary.id 
          ? { ...log, moodRating: moodRating, postWorkoutSummary: currentLogForSummary.postWorkoutSummary } 
          : log
      ));
    }
    setShowSummaryModal(false);
    setCurrentLogForSummary(null);
    setCurrentWorkoutForSummary(null);
    triggerFeedbackPromptIfAppropriate(); 
  }, [currentLogForSummary, setWorkoutLogs, triggerFeedbackPromptIfAppropriate]);


  const handleStartWorkout = (workout: Workout) => {
    const lastLogForThisWorkout = workoutLogs
      .filter(log => log.workoutId === workout.id)
      .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
    
    setLogToUseAsReferenceOrEdit(lastLogForThisWorkout || null);
    setIsNewSessionFlag(true); 
    setWorkoutForLogging(workout);
  };

  const handleEditLog = (logId: string) => {
    const logToEdit = workoutLogs.find(log => log.id === logId);
    if (logToEdit) {
      const workoutTemplate = workouts.find(w => w.id === logToEdit.workoutId);
      if (workoutTemplate) {
        setLogToUseAsReferenceOrEdit(logToEdit);
        setIsNewSessionFlag(false); 
        setWorkoutForLogging(workoutTemplate);
        setShowSummaryModal(false); 
      } else {
        alert("Kunde inte hitta passmallen för denna logg. Redigering är inte möjlig.");
      }
    }
  };

  const handleDeleteActivity = (activityId: string, activityType: 'workout' | 'general') => {
    if (activityType === 'workout') {
      setWorkoutLogs(prev => prev.filter(log => log.id !== activityId));
    } else if (activityType === 'general') {
      setGeneralActivityLogs(prev => prev.filter(log => log.id !== activityId));
    }
    if (currentLogForSummary && currentLogForSummary.id === activityId) {
        setShowSummaryModal(false);
        setCurrentLogForSummary(null);
        setCurrentWorkoutForSummary(null);
    }
  };

  const handleViewLogSummaryFromActivityView = (log: ActivityLog) => {
    if (log.type === 'workout') {
        const workoutLog = log as WorkoutLog;
        const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
        if (workoutTemplate) {
            if (!workoutLog.postWorkoutSummary) {
                 const allLogsForThisWorkoutTemplate = workoutLogs.filter(wl => wl.workoutId === workoutTemplate.id);
                 const summaryData = calculatePostWorkoutSummary(workoutLog, workoutTemplate, allLogsForThisWorkoutTemplate);
                 workoutLog.postWorkoutSummary = summaryData; 
            }
            setCurrentLogForSummary(workoutLog); 
            setCurrentWorkoutForSummary(workoutTemplate);
            setShowSummaryModal(true);
        } else {
            alert("Passmallen för denna logg kunde inte hittas. Kan inte visa sammanfattning.");
        }
    }
};

  const handleSaveStrengthStats = useCallback((stats: UserStrengthStats) => {
    setUserStrengthStats(stats);
    triggerFeedbackPromptIfAppropriate();
  }, [setUserStrengthStats, triggerFeedbackPromptIfAppropriate]);

  const handleSaveConditioningStats = useCallback((stats: ParticipantConditioningStats) => {
    setUserConditioningStats(stats);
    triggerFeedbackPromptIfAppropriate();
  }, [setUserConditioningStats, triggerFeedbackPromptIfAppropriate]);

  const handleSaveMentalWellbeing = useCallback((wellbeingData: ParticipantMentalWellbeing) => {
    setParticipantMentalWellbeing(wellbeingData);
    triggerFeedbackPromptIfAppropriate();
  }, [setParticipantMentalWellbeing, triggerFeedbackPromptIfAppropriate]);


  const handleSaveGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'userId'>) => {
    const newActivityLog: GeneralActivityLog = {
        id: crypto.randomUUID(), 
        completedDate: new Date().toISOString(), 
        type: 'general',
        ...activityData, 
    };
    setGeneralActivityLogs(prev => [...prev, newActivityLog]);
    setCurrentGeneralActivityForSummary(newActivityLog);
    setIsGeneralActivityModalOpen(false); 
    setIsGeneralActivitySummaryModalOpen(true); 
  };

  const handleCloseGeneralActivitySummary = useCallback(() => {
    setIsGeneralActivitySummaryModalOpen(false);
    setCurrentGeneralActivityForSummary(null);
    triggerFeedbackPromptIfAppropriate(); 
  }, [triggerFeedbackPromptIfAppropriate]);


  const generateAiProgressFeedback = async () => {
    if (!ai) {
      setAiProgressError("AI-tjänsten är inte tillgänglig. API-nyckel kan saknas.");
      setIsAiProgressModalOpen(true);
      return;
    }
    
    setIsAiProgressLoading(true);
    setAiProgressFeedback(null);
    setAiProgressError(null);
    setIsAiProgressModalOpen(true);

    const profileString = participantProfile ? `Namn: ${participantProfile.name || 'Ej angivet'}, Ålder: ${participantProfile.age || 'Ej angivet'}, Kön: ${participantProfile.gender || 'Ej angivet'}` : "Ingen profil angiven.";
    const userBodyweightString = userStrengthStats?.bodyweightKg ? `Kroppsvikt: ${userStrengthStats.bodyweightKg} kg.` : "Kroppsvikt: Ej angivet.";
    const goalString = getLatestGoal() ? `Aktuellt mål: "${getLatestGoal()!.fitnessGoals}" (Siktar på ${getLatestGoal()!.workoutsPerWeekTarget} pass/vecka). Streak: ${getLatestGoal()!.currentWeeklyStreak} veckor.` : "Inga mål satta.";
    
    const recentLogsForPrompt: EnrichedWorkoutSession[] = workoutLogs
        .sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
        .slice(0, 10) 
        .map(log => {
            const workoutTemplate = workouts.find(w => w.id === log.workoutId);
            const enrichedExercises: EnrichedExerciseLog[] = log.entries.map(entry => {
                const exerciseDetails = workoutTemplate?.exercises.find(ex => ex.id === entry.exerciseId);
                return {
                    exerciseName: exerciseDetails?.name || "Okänd övning",
                    exerciseNotes: exerciseDetails?.notes,
                    loggedSets: entry.loggedSets.map(s => ({ reps: s.reps, weight: s.weight }))
                };
            }).filter(e => e.loggedSets.length > 0 && e.loggedSets.some(s => s.reps !== '' || (s.weight !== '' && s.weight !== undefined)));
            
            return {
                workoutTitle: workoutTemplate?.title || "Okänt pass",
                completedDate: log.completedDate,
                exercises: enrichedExercises,
                postWorkoutComment: log.postWorkoutComment,
                moodRating: log.moodRating 
            };
        }).filter(session => session.exercises.length > 0);

    const generalActivityString = generalActivityLogs.length > 0 
      ? `Senaste generella aktiviteter (upp till 5): \n${generalActivityLogs.slice(0,5).map(ga => `- ${ga.activityName} (${ga.durationMinutes} min, ${new Date(ga.completedDate).toLocaleDateString('sv-SE')})${ga.moodRating ? `, Känsla: ${ga.moodRating}/5` : ''}`).join('\n')}`
      : "Inga generella aktiviteter loggade nyligen.";

    
    const inbodyScore = participantProfile?.inbodyScore;
    const inbodyIndicator = inbodyScore !== undefined ? getInBodyScoreIndicator(inbodyScore) : null;
    const inbodyStatusString = inbodyIndicator ? `${inbodyScore} (vilket är ${inbodyIndicator.text} nivå)` : "Inte angivet";

    const strengthLevelsString = mainLiftsSummary.map(s => 
        `- ${s.label}: ${s.value} (Nivå: ${s.level})`
    ).join('\n');

    const mentalWellbeingString = participantMentalWellbeing
        ? `Mentalt Välbefinnande (Skala 1-5. För stress: 1=Mycket Låg, 5=Mycket Hög. För övriga: 1=Mycket Låg/Dålig, 5=Mycket Hög/Bra):
          - Stressnivå: ${participantMentalWellbeing.stressLevel !== undefined ? STRESS_LEVEL_OPTIONS.find(o=>o.value === participantMentalWellbeing.stressLevel)?.label || participantMentalWellbeing.stressLevel+'/5' : 'Ej angivet'}
          - Energinivå: ${participantMentalWellbeing.energyLevel !== undefined ? ENERGY_LEVEL_OPTIONS.find(o=>o.value === participantMentalWellbeing.energyLevel)?.label || participantMentalWellbeing.energyLevel+'/5' : 'Ej angivet'}
          - Sömnkvalitet: ${participantMentalWellbeing.sleepQuality !== undefined ? SLEEP_QUALITY_OPTIONS.find(o=>o.value === participantMentalWellbeing.sleepQuality)?.label || participantMentalWellbeing.sleepQuality+'/5' : 'Ej angivet'}
          - Allmänt Humör: ${participantMentalWellbeing.overallMood !== undefined ? OVERALL_MOOD_OPTIONS.find(o=>o.value === participantMentalWellbeing.overallMood)?.label || participantMentalWellbeing.overallMood+'/5' : 'Ej angivet'}`
        : "Inget data för mentalt välbefinnande loggat.";


    const prompt = `Du är en uppmuntrande och insiktsfull AI-träningsassistent för en medlem på Flexibel Hälsostudio. Ge personlig feedback och motivation baserat på medlemmens profil, mål, mentala välbefinnande och senast loggade träningspass/aktiviteter. Använd Markdown för att formatera ditt svar (## Rubriker, **fet text**, * punktlistor).

Medlemsinformation:
- Profil: ${profileString}
- ${userBodyweightString}
- Mål: ${goalString}
- InBody Score: ${inbodyStatusString} ('Grön nivå' är 80+ poäng)
- Styrkenivåer för baslyft: ('Grön nivå' = Avancerad eller Elit)
${strengthLevelsString}
- ${mentalWellbeingString}
- ${generalActivityString}
- Senaste träningspass (upp till 10 senaste):
${JSON.stringify(recentLogsForPrompt, null, 2)}

Baserat på ovanstående information:
1.  **## Sammanfattning & Uppmuntran:** Ge en kort, positiv sammanfattning. Uppmuntra ansträngningar. Beröm streak. Kommentera humördata.
2.  **## Progress & Råd - InBody och Styrka:**
    *   **InBody:** Om målet är 'Grön nivå' (80+), ge råd för att uppnå, bibehålla eller förbättra poängen. Koppla till kost om relevant (se punkt 5).
    *   **Styrka:** För varje baslyft, om medlemmen är på 'Grön nivå' (Avancerad/Elit), ge råd för att bibehålla/finslipa. Om under, ge råd för att nå 'Avancerad'. Anpassa råden till eventuella mål och nuvarande prestationer.
3.  **## Mentalt Välbefinnande & Balans:**
    *   Om stressnivån är 4 eller 5 (hög/mycket hög), eller om energi/sömn/humör är 1 eller 2 (låg/dålig), rekommendera Yoga (Yin, Postural) och/eller Mindfulness. Förklara kort fördelarna (t.ex. stressreduktion, återhämtning).
    *   Om träningsvolymen är hög och stressen är hög, föreslå att överväga att justera intensitet/frekvens för balans.
4.  **## Observationer från Pass & Aktiviteter:** Finns det intressanta mönster i loggade pass/aktiviteter? Peka på positiva saker.
5.  **## Små Tips, Motivation & Kostinsikt:**
    *   Ge 1-2 korta, generella träningstips eller motivationshöjare.
    *   **Kost:** Om medlemmens kroppsvikt är angiven i "Medlemsinformation", påminn om kostens betydelse. Uppmuntra till ett proteinintag på cirka 1.5 gram per kilo kroppsvikt per dygn för att bygga och bevara muskelmassa, särskilt vid viktnedgång. Förklara att behovet ibland kan vara högre.
6.  **## Särskilda Råd (om relevant):**
    *   Om medlemmens mål ("fitnessGoals") eller kommentarer innehåller nyckelord som "gå ner i vikt", "viktnedgång", "bränna fett", "kost", "diet", "viktresa", "tappa kilon", inkludera då: "För att optimera din viktresa är kosten en mycket viktig del. För personlig rådgivning och mer information om vårt kostprogram 'Praktisk Viktkontroll' och vår app 'Kostloggen', prata med en coach."
7.  **## Avslutning:** Avsluta peppande. Uppmuntra medlemmen att kontakta en coach på Flexibel för ytterligare råd och stöd. Avsluta alltid ditt svar med exakt denna text på två rader:
Med vänliga hälsningar,
Teamet på Flexibel

Håll svaret till ca 250-400 ord.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
        });
        setAiProgressFeedback(response.text);
    } catch (e) {
      console.error("AI Progress Feedback Error:", e);
      const typedError = e as Error;
      if (typedError && typedError.message && typedError.message.includes("API key not valid")) {
        setAiProgressError("AI-tjänsten är inte tillgänglig. API-nyckeln är ogiltig. Kontakta administratören.");
      } else {
        setAiProgressError("Kunde inte hämta AI-feedback just nu. Försök igen senare.");
      }
    } finally {
      setIsAiProgressLoading(false);
    }
  };
  
  const publishedWorkouts = useMemo(() => workouts.filter(w => w.isPublished).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [workouts]);
  const allUserActivities: ActivityLog[] = useMemo(() => [...workoutLogs, ...generalActivityLogs].sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()), [workoutLogs, generalActivityLogs]);

  const latestGoalForDisplay = getLatestGoal(); 

  const fssDataForDisplay = useMemo<FlexibelStrengthScoreResultForDisplay | null>(() => {
    if (userStrengthStats && userStrengthStats.bodyweightKg &&
        userStrengthStats.squat1RMaxKg && userStrengthStats.deadlift1RMaxKg &&
        userStrengthStats.benchPress1RMaxKg && userStrengthStats.overheadPress1RMaxKg) {
        
        const scoreCalc = calculateFSSForToolInternalOnly(
            Number(userStrengthStats.bodyweightKg),
            Number(userStrengthStats.squat1RMaxKg),
            Number(userStrengthStats.deadlift1RMaxKg),
            Number(userStrengthStats.benchPress1RMaxKg),
            Number(userStrengthStats.overheadPress1RMaxKg)
        );

        if (scoreCalc) {
            const recommendations = getPassRecommendations(
                scoreCalc.score,
                latestGoalForDisplay?.fitnessGoals,
                latestGoalForDisplay?.preferences
            );
            return {
                score: scoreCalc.score,
                interpretationText: scoreCalc.interpretationText,
                recommendations: recommendations
            };
        }
    }
    return null;
  }, [userStrengthStats, latestGoalForDisplay]);

  const mainLiftsSummary = useMemo(() => {
    if (!userStrengthStats || !participantProfile || !participantProfile.gender || (participantProfile.gender !== 'Man' && participantProfile.gender !== 'Kvinna')) {
        return MAIN_LIFTS_CONFIG_HEADER.map(cfg => ({
            label: cfg.label,
            value: userStrengthStats?.[cfg.statKey] ? `${userStrengthStats[cfg.statKey]} kg` : 'N/A',
            level: 'N/A' as StrengthLevel | 'N/A',
            levelColor: '#d1d5db' 
        }));
    }
    
    const bwKg = Number(userStrengthStats.bodyweightKg);
    const userAge = participantProfile.age ? parseInt(participantProfile.age, 10) : undefined;
    const userGender = participantProfile.gender;

    if (isNaN(bwKg) || bwKg <=0) {
       return MAIN_LIFTS_CONFIG_HEADER.map(cfg => ({
            label: cfg.label,
            value: userStrengthStats?.[cfg.statKey] ? `${userStrengthStats[cfg.statKey]} kg` : 'N/A',
            level: 'N/A' as StrengthLevel | 'N/A',
            levelColor: '#d1d5db' 
        }));
    }

    return MAIN_LIFTS_CONFIG_HEADER.map(cfg => {
        const raw1RM = Number(userStrengthStats[cfg.statKey]);
        if (isNaN(raw1RM) || raw1RM < 0) {
            return { label: cfg.label, value: 'N/A', level: 'N/A' as StrengthLevel | 'N/A', levelColor: '#d1d5db'};
        }

        const ageFactor = getAgeAdjustmentFactorForHeader(userAge, cfg.lift, userGender, USER_PROVIDED_STRENGTH_MULTIPLIERS);
        const effective1RM = parseFloat((raw1RM / ageFactor).toFixed(2));

        const relevantStandards = STRENGTH_STANDARDS_DATA.filter(s => s.lift === cfg.lift && s.gender === userGender);
        if (relevantStandards.length === 0) {
            return { label: cfg.label, value: `${raw1RM} kg`, level: 'N/A' as StrengthLevel | 'N/A', levelColor: '#d1d5db' };
        }
        
        let bestMatchStandardSet = relevantStandards.reduce((best, current) => {
          if (!best) return current;
          const currentFits = bwKg >= current.bodyweightCategoryKg.min && bwKg <= current.bodyweightCategoryKg.max;
          const bestFits = bwKg >= best.bodyweightCategoryKg.min && bwKg <= best.bodyweightCategoryKg.max;
          if (currentFits && !bestFits) return current;
          if (!currentFits && bestFits) return best;
          if (!currentFits && !bestFits) { 
             const bestMid = (best.bodyweightCategoryKg.min + best.bodyweightCategoryKg.max) / 2;
             const currentMid = (current.bodyweightCategoryKg.min + current.bodyweightCategoryKg.max) / 2;
             return Math.abs(bwKg - currentMid) < Math.abs(bwKg - bestMid) ? current : best;
          }
          return current;
        }, undefined as typeof relevantStandards[0] | undefined);

        if (!bestMatchStandardSet) {
             bestMatchStandardSet = relevantStandards.sort((a,b) => {
                const aDist = Math.min(Math.abs(bwKg - a.bodyweightCategoryKg.min), Math.abs(bwKg - a.bodyweightCategoryKg.max));
                const bDist = Math.min(Math.abs(bwKg - b.bodyweightCategoryKg.min), Math.abs(bwKg - b.bodyweightCategoryKg.max));
                return aDist - bDist;
            })[0];
        }

        if (!bestMatchStandardSet) {
           return { label: cfg.label, value: `${raw1RM} kg`, level: 'N/A' as StrengthLevel | 'N/A', levelColor: '#d1d5db' };
        }

        const standardsForBodyweight = [...bestMatchStandardSet.standards].sort(
            (a, b) => STRENGTH_LEVEL_ORDER.indexOf(a.level) - STRENGTH_LEVEL_ORDER.indexOf(b.level)
        );

        let currentLevel: StrengthLevel = 'Otränad';
        for (let i = standardsForBodyweight.length - 1; i >= 0; i--) {
            if (effective1RM >= standardsForBodyweight[i].weightKg) {
                currentLevel = standardsForBodyweight[i].level;
                break;
            }
        }
        return { label: cfg.label, value: `${raw1RM} kg`, level: currentLevel, levelColor: LEVEL_COLORS_HEADER[currentLevel] };
    });

  }, [userStrengthStats, participantProfile]);

  const mentalWellbeingIndicators = useMemo(() => getMentalWellbeingIndicators(participantMentalWellbeing), [participantMentalWellbeing]);


  if (workoutForLogging) {
    return (
      <WorkoutLogForm
        ai={ai}
        workout={workoutForLogging}
        logForReferenceOrEdit={logToUseAsReferenceOrEdit || undefined}
        isNewSession={isNewSessionFlag}
        participantWorkoutNote={participantWorkoutNotes.find(note => note.workoutId === workoutForLogging.id)?.note}
        onSaveLog={handleSaveLog}
        onSaveNextTimeNote={handleSaveNextTimeNote}
        onClose={resetLogFormState}
      />
    );
  }

  return (
    <div className="relative">
      <FixedHeaderAndTools
        participantProfile={participantProfile}
        latestGoal={latestGoalForDisplay}
        allParticipantGoals={participantGoals}
        userStrengthStats={userStrengthStats}
        userConditioningStats={userConditioningStats}
        participantMentalWellbeing={participantMentalWellbeing}
        ai={ai}
        onSaveProfileAndGoals={handleSaveProfileAndGoals}
        onSaveStrengthStats={handleSaveStrengthStats}
        onSaveConditioningStats={handleSaveConditioningStats}
        onSaveMentalWellbeing={handleSaveMentalWellbeing}
        onTriggerAiProgressFeedback={generateAiProgressFeedback}
        mainContentRef={mainContentRef}
        currentRole={currentRole}
        onSetRole={onSetRole}
      />
      
      <div ref={mainContentRef} className="space-y-8"> 
        
        <div className="container mx-auto px-0 pt-0"> 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Mina Mål & Framsteg - Always Expanded */}
            <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="w-full flex items-center justify-between text-left group mb-2">
                    <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                        <GoalOverviewIcon /> <span className="ml-2">Mina Mål & Framsteg</span>
                    </h4>
                    {/* Chevron icon removed */}
                </div>
                <div id="goals-content" className="text-base space-y-1 text-gray-600">
                    {latestGoalForDisplay ? (
                        <>
                            <p><strong>Målsättning:</strong> {latestGoalForDisplay.fitnessGoals || "Ej specificerat"}</p>
                            <p><strong>Veckomål:</strong> {latestGoalForDisplay.workoutsPerWeekTarget} pass</p>
                            {latestGoalForDisplay.currentWeeklyStreak > 0 ? (
                                <p><strong>Nuvarande Streak:</strong> {latestGoalForDisplay.currentWeeklyStreak} veckor 🔥</p>
                            ) : (
                                <p>Ingen aktiv streak just nu.</p>
                            )}
                        </>
                    ) : (
                        <p className="italic">Inga aktiva mål satta. Fyll i under "Profil & Mål".</p>
                    )}
                </div>
            </div>

            
            <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                <button
                    onClick={() => toggleSummaryCard('strength')}
                    className="w-full flex items-center justify-between text-left group"
                    aria-expanded={summaryCardStates.strength}
                    aria-controls="strength-content"
                >
                    <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                        <StrengthOverviewIcon /> <span className="ml-2">Min Styrka</span>
                        <InfoButton onClick={() => setIsStrengthInfoModalOpen(true)} ariaLabel="Information om Min Styrka" />
                    </h4>
                    {summaryCardStates.strength ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
                {summaryCardStates.strength && (
                    <div id="strength-content" className="mt-2">
                        {fssDataForDisplay ? (
                            <div className="text-base space-y-1 text-gray-600 mb-2">
                                <p><strong>Flexibel Strength Score:</strong> <span className="font-bold text-2xl" style={{color: FLEXIBEL_PRIMARY_COLOR}}>{fssDataForDisplay.score}</span></p>
                                <p>{fssDataForDisplay.interpretationText}</p>
                            </div>
                        ) : (
                            <p className="text-base text-gray-500 italic mb-2">Fyll i profil ('Profil & Mål') och dina 1RM ('Min Fysik') för din Flexibel Strength Score.</p>
                        )}
                        <ul className="text-sm space-y-1 text-gray-600">
                            {mainLiftsSummary.map(lift => (
                                <li key={lift.label} className="flex justify-between items-center">
                                    <span>{lift.label}: <span className="font-medium">{lift.value}</span></span>
                                    {lift.level !== 'N/A' && (
                                        <span 
                                            className="px-1.5 py-0.5 rounded-full text-white text-xs" 
                                            style={{ backgroundColor: lift.levelColor }}
                                        >
                                            {lift.level}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            
            
            <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                 <button
                    onClick={() => toggleSummaryCard('bodyComp')}
                    className="w-full flex items-center justify-between text-left group"
                    aria-expanded={summaryCardStates.bodyComp}
                    aria-controls="bodycomp-content"
                >
                    <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                        <BodyCompOverviewIcon /> <span className="ml-2">Kroppssammansättning</span>
                        <InfoButton onClick={() => setIsBodyCompInfoModalOpen(true)} ariaLabel="Information om Kroppssammansättning" />
                    </h4>
                    {summaryCardStates.bodyComp ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
                {summaryCardStates.bodyComp && (
                    <div id="bodycomp-content" className="mt-2 text-base space-y-1 text-gray-600">
                        {participantProfile && (participantProfile.muscleMassKg !== undefined || participantProfile.fatMassKg !== undefined || participantProfile.inbodyScore !== undefined) ? (
                            <>
                                {participantProfile.muscleMassKg !== undefined && <p><strong>Muskelmassa:</strong> {participantProfile.muscleMassKg} kg</p>}
                                {participantProfile.fatMassKg !== undefined && <p><strong>Fettmassa:</strong> {participantProfile.fatMassKg} kg</p>}
                                
                                {participantProfile.inbodyScore !== undefined && participantProfile.inbodyScore !== null && (() => {
                                    const indicator = getInBodyScoreIndicator(participantProfile.inbodyScore);
                                    return (
                                        <div className="mt-1">
                                            <p className="flex items-center">
                                                <strong>InBody Score:</strong>&nbsp;
                                                <span className="font-bold text-2xl mr-2" style={{color: FLEXIBEL_PRIMARY_COLOR}}>
                                                    {participantProfile.inbodyScore}
                                                </span>
                                                {indicator && (
                                                    <span className="flex items-center text-base ml-1">
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                width: '12px',
                                                                height: '12px',
                                                                borderRadius: '50%',
                                                                backgroundColor: indicator.color,
                                                                marginRight: '6px',
                                                            }}
                                                            aria-hidden="true"
                                                        ></span>
                                                        <span style={{ color: indicator.color }}>{indicator.text}</span>
                                                    </span>
                                                )}
                                            </p>
                                            {indicator && indicator.explanation && (
                                                <p className="text-sm text-gray-500 mt-1 italic">
                                                    <span className="font-semibold not-italic" style={{color: indicator.color}}>→</span> {indicator.explanation}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                                <p className="text-sm text-gray-400 mt-1">Senast uppdaterad: {new Date(participantProfile.lastUpdated).toLocaleDateString('sv-SE')}</p>
                            </>
                        ): (
                            <p className="italic">Ingen InBody-data. Lägg till via "Profil & Mål".</p>
                        )}
                    </div>
                )}
            </div>
            
            
             <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                <button
                    onClick={() => toggleSummaryCard('mentalWellbeing')}
                    className="w-full flex items-center justify-between text-left group"
                    aria-expanded={summaryCardStates.mentalWellbeing}
                    aria-controls="mental-wellbeing-content"
                >
                    <h4 className="text-lg font-semibold text-gray-700 flex items-center">
                        <MentalWellbeingOverviewIcon /> <span className="ml-2">Mitt Mentala</span>
                    </h4>
                    {summaryCardStates.mentalWellbeing ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </button>
                {summaryCardStates.mentalWellbeing && (
                    <div id="mental-wellbeing-content" className="mt-2">
                        {mentalWellbeingIndicators.length > 0 ? (
                            <ul className="text-sm space-y-1.5 text-gray-600">
                                {mentalWellbeingIndicators.map(indicator => indicator.display && (
                                    <li key={indicator.label} className="flex justify-between items-center">
                                        <span>{indicator.label}:</span>
                                        <span 
                                            className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center"
                                            style={{ backgroundColor: `${indicator.display.color}20`, color: indicator.display.color }}
                                        >
                                            <span className="mr-1 text-base">{indicator.display.emoji}</span>
                                            {indicator.display.text}
                                        </span>
                                    </li>
                                ))}
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t">Senast uppdaterad: {new Date(participantMentalWellbeing!.lastUpdated).toLocaleDateString('sv-SE')}</p>
                            </ul>
                        ) : (
                            <p className="text-base text-gray-500 italic">Ingen data loggad. Logga via "Mitt Mentala".</p>
                        )}
                    </div>
                )}
            </div>

          </div>
        </div>


        
        <section>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-6">Tillgängliga Pass</h2>
          {publishedWorkouts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg shadow-md">
              <svg className="mx-auto h-12 w-12 text-flexibel/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-xl font-semibold text-gray-700">Inga publicerade pass</h3>
              <p className="mt-1 text-base text-gray-500">Inga publicerade pass än. Försök senare.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {publishedWorkouts.map((workout) => (
                <div key={workout.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-out">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                      <div>
                          <h3 className="text-2xl font-semibold text-flexibel">{workout.title}</h3>
                          <p className="text-base text-gray-500">Datum: {new Date(workout.date).toLocaleDateString('sv-SE')}</p>
                          <p className="text-base text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                      </div>
                      <Button onClick={() => handleStartWorkout(workout)} size="md" className="w-full sm:w-auto flex-shrink-0">
                        Starta Pass
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Button>
                  </div>
                  <details className="mt-4 text-base">
                    <summary className="cursor-pointer text-flexibel hover:underline font-medium">Visa övningar ({workout.exercises.length})</summary>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-600">
                      {workout.exercises.map((ex) => (
                        <li key={ex.id} className="text-base">
                          <span className="font-semibold">{ex.name}:</span> {ex.notes}
                          {ex.baseLiftType && <span className="text-sm text-flexibel/80 font-normal ml-1">({ex.baseLiftType})</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>

        
        <ParticipantActivityView 
          allActivityLogs={allUserActivities} 
          workouts={workouts} 
          onViewLogSummary={handleViewLogSummaryFromActivityView}
          onDeleteActivity={handleDeleteActivity}
        />
      </div> 
      
      
      {currentLogForSummary && currentWorkoutForSummary && (
        <PostWorkoutSummaryModal
            isOpen={showSummaryModal}
            onFinalize={handleFinalizePostWorkoutSummary} 
            log={currentLogForSummary}
            workout={currentWorkoutForSummary}
            onEditLog={() => handleEditLog(currentLogForSummary.id)}
        />
      )}
      <AIProgressFeedbackModal
        isOpen={isAiProgressModalOpen}
        onClose={() => setIsAiProgressModalOpen(false)}
        isLoading={isAiProgressLoading}
        aiFeedback={aiProgressFeedback}
        error={aiProgressError}
      />
      <LogGeneralActivityModal
        isOpen={isGeneralActivityModalOpen}
        onClose={() => setIsGeneralActivityModalOpen(false)}
        onSaveActivity={handleSaveGeneralActivity}
      />
      <GeneralActivitySummaryModal
        isOpen={isGeneralActivitySummaryModalOpen}
        onClose={handleCloseGeneralActivitySummary}
        activity={currentGeneralActivityForSummary}
      />

      <FeedbackPromptToast
        isOpen={showFeedbackToast}
        message="Data uppdaterad! Vill du ha tips från Coachen?"
        onAccept={() => {
          generateAiProgressFeedback();
          setShowFeedbackToast(false);
          setLastFeedbackPromptTime(Date.now());
        }}
        onDecline={() => {
          setShowFeedbackToast(false);
          setLastFeedbackPromptTime(Date.now());
        }}
      />

      {isStrengthInfoModalOpen && (
        <InfoModal
          isOpen={isStrengthInfoModalOpen}
          onClose={() => setIsStrengthInfoModalOpen(false)}
          title="Information om Min Styrka"
        >
          <div className="space-y-3 text-base text-gray-700">
            <p><strong>Flexibel Strength Score (FSS):</strong> Ett sammanvägt mått på din relativa styrka i baslyften (knäböj, bänkpress, marklyft, axelpress) i förhållande till din kroppsvikt. Poängen ger en indikation på din allmänna styrkebalans.</p>
            <p><strong>Styrkenivåer:</strong> Visar din nuvarande nivå (Otränad till Elit) för varje baslyft, baserat på standardiserade tabeller justerade för kön, kroppsvikt och ålder. Detta hjälper dig att se var du ligger och vad du kan sikta på.</p>
            <p><strong>Varför är styrka viktigt?</strong> God grundstyrka är fundamental för en välmående kropp. Det bidrar till:</p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li>Ökad benmassa och minskad risk för benskörhet.</li>
              <li>Förbättrad metabolism och kroppssammansättning.</li>
              <li>Bättre kroppshållning och minskad risk för skador.</li>
              <li>Ökad förmåga att klara av vardagens fysiska krav.</li>
              <li>Förbättrat mentalt välbefinnande.</li>
            </ul>
          </div>
        </InfoModal>
      )}

      {isBodyCompInfoModalOpen && (
        <InfoModal
          isOpen={isBodyCompInfoModalOpen}
          onClose={() => setIsBodyCompInfoModalOpen(false)}
          title="Information om Kroppssammansättning"
        >
          <div className="space-y-3 text-base text-gray-700">
            <p><strong>InBody Score:</strong> En poäng från InBody-mätningen (0-100) som reflekterar din övergripande kroppssammansättning. Högre poäng indikerar generellt en hälsosammare balans mellan muskler och fett.</p>
            <ul className="list-disc list-inside pl-2 space-y-1 text-sm">
                <li><strong>Grön nivå (80+):</strong> Stark balans, hög muskel- vs fettnivå.</li>
                <li><strong>Orange nivå (60-79):</strong> Acceptabel balans, utrymme för förbättring.</li>
                <li><strong>Röd nivå (&lt;60):</strong> Indikerar obalans, t.ex. låg muskelmassa eller hög fettprocent.</li>
            </ul>
            <p><strong>Muskelmassa (kg):</strong> Total mängd muskler i kroppen. Viktig för styrka, metabolism och allmän hälsa.</p>
            <p><strong>Fettmassa (kg):</strong> Total mängd fett i kroppen. En viss mängd är nödvändig, men för hög fettmassa kan öka risken för hälsoproblem.</p>
            <p><strong>Varför är kroppssammansättning viktigt?</strong> En hälsosam kroppssammansättning, med tillräcklig muskelmassa och en hälsosam fettnivå, är kopplad till:</p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li>Minskad risk för kroniska sjukdomar (t.ex. typ 2-diabetes, hjärt-kärlsjukdom).</li>
              <li>Bättre energinivåer och fysisk funktion.</li>
              <li>Stöd för en stark metabolism.</li>
              <li>Förbättrad hormonbalans och allmänt välbefinnande.</li>
            </ul>
            <p>Prata med din coach för att tolka dina InBody-resultat och sätta relevanta mål.</p>
          </div>
        </InfoModal>
      )}


      
        <div className="fixed bottom-6 right-6 z-40">
            <Button
                id="fab-main-button"
                onClick={() => setIsGeneralActivityModalOpen(true)}
                variant="secondary" 
                className="rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl"
                aria-label="Logga Annan Aktivitet"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </Button>
      </div>
    </div>
  );
};