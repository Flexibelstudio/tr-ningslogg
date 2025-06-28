
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog, ActivityLog, ParticipantWorkoutNote,
    ParticipantGoalData, PostWorkoutSummaryData, NewPB, ParticipantProfile,
    GenderOption, UserStrengthStat, ParticipantConditioningStats, LiftType,
    StrengthLevel, AllUserProvidedStrengthMultipliers, StrengthStandardDetail,
    UserRole, ParticipantMentalWellbeing, WorkoutBlock, WorkoutCategory, Exercise, SetDetail, ParticipantGamificationStats
} from '../../types';
import { Button } from '../Button';
import { WorkoutLogForm } from './WorkoutLogForm';
import { AIProgressFeedbackModal } from './AIProgressFeedbackModal';
import { ParticipantActivityView } from './ParticipantActivityView';
import { PostWorkoutSummaryModal } from './PostWorkoutSummaryModal';
import { LogGeneralActivityModal } from './LogGeneralActivityModal';
import { GeneralActivitySummaryModal } from './GeneralActivitySummaryModal';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
    LOCAL_STORAGE_KEYS, WEIGHT_COMPARISONS, FLEXIBEL_PRIMARY_COLOR,
    USER_PROVIDED_STRENGTH_MULTIPLIERS, STRENGTH_STANDARDS_DATA, STRENGTH_LEVEL_ORDER,
    STRESS_LEVEL_OPTIONS, ENERGY_LEVEL_OPTIONS, SLEEP_QUALITY_OPTIONS, OVERALL_MOOD_OPTIONS,
    WORKOUT_CATEGORY_OPTIONS
} from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { FixedHeaderAndTools } from './FixedHeaderAndTools';
import { calculateFlexibelStrengthScoreInternal as calculateFSSForToolInternalOnly } from './StrengthComparisonTool';
import { getPassRecommendations } from '../../utils/passRecommendationHelper';
import { FeedbackPromptToast } from './FeedbackPromptToast';
import { InfoModal } from './InfoModal';
import { FabMenu } from './FabMenu';
import { SelectWorkoutModal } from './SelectWorkoutModal';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { MentalWellbeingModal } from './MentalWellbeingModal';


const API_KEY = process.env.API_KEY;

interface EnrichedSetDetailView { 
  reps: number | string;
  weight?: number | string;
}
interface EnrichedExerciseLogView { 
  exerciseName: string;
  exerciseNotes?: string;
  loggedSets: EnrichedSetDetailView[];
}
interface EnrichedWorkoutSessionView { 
  workoutTitle: string;
  completedDate: string;
  exercises: EnrichedExerciseLogView[];
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

// Updated and new icons
const TargetIcon = (): JSX.Element => (
  <span role="img" aria-label="Måltavla ikon" className="text-2xl">🎯</span>
);

const DumbbellEmojiIcon = (): JSX.Element => (
  <span role="img" aria-label="Hantel ikon" className="text-2xl">🏋️‍♂️</span>
);

const CompositionIcon = (): JSX.Element => (
  <span role="img" aria-label="DNA-sträng ikon" className="text-2xl">🧬</span>
);


const PulseEmojiIcon = (): JSX.Element => (
 <span role="img" aria-label="Hjärta med puls ikon" className="text-2xl">💓</span>
);

const MentalWellbeingEmojiIcon = (): JSX.Element => (
  <span role="img" aria-label="Lugnt ansikte ikon" className="text-2xl">😌</span>
);

const TrophyIcon = (): JSX.Element => (
    <span role="img" aria-label="Pokal ikon" className="text-2xl">🏆</span>
);

const ChevronDownIcon = (): JSX.Element => <span role="img" aria-label="Visa mer"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-transform duration-200 ml-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></span>;
const ChevronUpIcon = (): JSX.Element => <span role="img" aria-label="Visa mindre"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-transform duration-200 ml-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></span>;

const InfoButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }): JSX.Element => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="ml-2 text-flexibel hover:text-flexibel/80 focus:outline-none focus:ring-2 focus:ring-flexibel focus:ring-offset-1 rounded-full p-0.5"
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  </button>
);

// Moved SummaryCard to top level
interface SummaryCardProps {
  title: string;
  icon: JSX.Element;
  onInfoClick?: () => void;
  infoAriaLabel?: string;
  children: React.ReactNode;
  isInitiallyExpanded?: boolean;
  isCollapsible?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  icon,
  onInfoClick,
  infoAriaLabel,
  children,
  isInitiallyExpanded = true,
  isCollapsible = true, // Default to true
}) => {
  const [isExpanded, setIsExpanded] = useState(isCollapsible ? isInitiallyExpanded : true);

  const handleToggleExpand = () => {
    if (isCollapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-lg">
          <button
              className="w-full flex justify-between items-center text-left text-xl sm:text-2xl font-semibold text-gray-700 hover:text-flexibel transition-colors group"
              onClick={handleToggleExpand}
              aria-expanded={isExpanded}
              aria-controls={`summary-content-${title.replace(/\s+/g, '-')}`}
              disabled={!isCollapsible}
          >
              <span className="flex items-center">
                  {icon}
                  <span className="ml-2">{title}</span>
                  {onInfoClick && infoAriaLabel && <InfoButton onClick={onInfoClick} ariaLabel={infoAriaLabel} />}
              </span>
              <span className="flex items-center">
                  {isCollapsible && (isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />)}
              </span>
          </button>
          {isExpanded && (
              <div id={`summary-content-${title.replace(/\s+/g, '-')}`} className="mt-2 text-base text-gray-600 space-y-2">
                  {children}
              </div>
          )}
      </div>
  );
};


const LEVEL_COLORS_HEADER: { [key in StrengthLevel]: string } = {
  'Otränad': '#ef4444',
  'Nybörjare': '#f97316',
  'Medelgod': '#eab308',
  'Avancerad': '#84cc16',
  'Elit': '#14b8a6',
};

const MAIN_LIFTS_CONFIG_HEADER: { lift: LiftType, statKey: keyof UserStrengthStat, label: string }[] = [
    { lift: 'Knäböj', statKey: 'squat1RMaxKg', label: 'Knäböj'},
    { lift: 'Bänkpress', statKey: 'benchPress1RMaxKg', label: 'Bänkpress'},
    { lift: 'Marklyft', statKey: 'deadlift1RMaxKg', label: 'Marklyft'},
    { lift: 'Axelpress', statKey: 'overheadPress1RMaxKg', label: 'Axelpress'},
];

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
        explanation: "Acceptabel balans men det finns utrymme för förbättring – börja jobba mer med viss träning eller kostjusteringar för att nå nästa nivå."
    };
  } else if (score >= 80 && score <= 89) { // Medelgod
    return {
        color: LEVEL_COLORS_HEADER['Medelgod'],
        text: 'Grön',
        explanation: "Bra balans! Du har en hälsosam kroppssammansättning. Fortsätt så!"
    };
  } else if (score >= 90) { // Avancerad / Elit
    return {
        color: LEVEL_COLORS_HEADER['Avancerad'],
        text: 'Grön',
        explanation: "Utmärkt kroppssammansättning! Du är i toppform."
    };
  }
  return null;
};

// Main ParticipantArea Component
export const ParticipantArea: React.FC<ParticipantAreaProps> = ({
  workouts,
  workoutLogs,
  setWorkoutLogs,
  currentRole,
  onSetRole,
}) => {
  const [currentWorkoutLog, setCurrentWorkoutLog] = useState<WorkoutLog | undefined>(undefined);
  const [isNewSessionForLog, setIsNewSessionForLog] = useState(true);
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [currentWorkoutForForm, setCurrentWorkoutForForm] = useState<Workout | null>(null);

  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  const [participantProfile, setParticipantProfile] = useLocalStorage<ParticipantProfile | null>(LOCAL_STORAGE_KEYS.PARTICIPANT_PROFILE, null);
  const [participantGoals, setParticipantGoals] = useLocalStorage<ParticipantGoalData[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_GOALS, []);
  const [userStrengthStats, setUserStrengthStats] = useLocalStorage<UserStrengthStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_STRENGTH_STATS, []);
  const [userConditioningStats, setUserConditioningStats] = useLocalStorage<ParticipantConditioningStats | null>(LOCAL_STORAGE_KEYS.PARTICIPANT_CONDITIONING_STATS, null);
  const [participantMentalWellbeing, setParticipantMentalWellbeing] = useLocalStorage<ParticipantMentalWellbeing | null>(LOCAL_STORAGE_KEYS.PARTICIPANT_MENTAL_WELLBEING, null);
  const [participantGamificationStats, setParticipantGamificationStats] = useLocalStorage<ParticipantGamificationStats | null>(LOCAL_STORAGE_KEYS.PARTICIPANT_GAMIFICATION_STATS, null);
  const [generalActivityLogs, setGeneralActivityLogs] = useLocalStorage<GeneralActivityLog[]>(LOCAL_STORAGE_KEYS.GENERAL_ACTIVITY_LOGS, []);
  const [lastFeedbackPromptTime, setLastFeedbackPromptTime] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LAST_FEEDBACK_PROMPT_TIME, 0);


  const [isAiFeedbackModalOpen, setIsAiFeedbackModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isLoadingAiFeedback, setIsLoadingAiFeedback] = useState(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
  const [currentAiModalTitle, setCurrentAiModalTitle] = useState("Feedback"); // New state for modal title


  const [isPostWorkoutSummaryModalOpen, setIsPostWorkoutSummaryModalOpen] = useState(false);
  const [logForSummaryModal, setLogForSummaryModal] = useState<WorkoutLog | null>(null);
  const [workoutForSummaryModal, setWorkoutForSummaryModal] = useState<Workout | null>(null);

  const [isLogGeneralActivityModalOpen, setIsLogGeneralActivityModalOpen] = useState(false);
  const [isGeneralActivitySummaryOpen, setIsGeneralActivitySummaryOpen] = useState(false);
  const [lastGeneralActivity, setLastGeneralActivity] = useState<GeneralActivityLog | null>(null);
  
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; content: React.ReactElement }>({ title: '', content: React.createElement('div')});
  
  const [isSelectWorkoutModalOpen, setIsSelectWorkoutModalOpen] = useState(false);
  const [workoutCategoryFilter, setWorkoutCategoryFilter] = useState<WorkoutCategory | undefined>(undefined);
  const [isExerciseSelectionModalOpen, setIsExerciseSelectionModalOpen] = useState(false);
  const [workoutForExerciseSelection, setWorkoutForExerciseSelection] = useState<Workout | null>(null);

  const [isMentalCheckinOpen, setIsMentalCheckinOpen] = useState(false);


  const mainContentRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
    if (API_KEY) {
      try {
        setAi(new GoogleGenAI({apiKey: API_KEY}));
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI in ParticipantArea:", e);
      }
    }
  }, []);

  useEffect(() => {
      const rawData = localStorage.getItem(LOCAL_STORAGE_KEYS.PARTICIPANT_STRENGTH_STATS);
      if (rawData) {
          try {
              const data = JSON.parse(rawData);
              if (data && !Array.isArray(data)) {
                  // This is the old format (a single object). Convert it.
                  setUserStrengthStats([data as UserStrengthStat]);
              }
          } catch (e) {
              console.error("Error migrating strength stats:", e);
              // If parsing fails, it might be corrupt. Clearing it might be an option.
              // For now, we'll just log the error.
          }
      }
  }, [setUserStrengthStats]);


  const allActivityLogs = useMemo<ActivityLog[]>(() => {
    return [...workoutLogs, ...generalActivityLogs].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
  }, [workoutLogs, generalActivityLogs]);

  const latestGoal = useMemo(() => {
    if (participantGoals.length === 0) return null;
    return [...participantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
  }, [participantGoals]);
  
  const latestActiveGoal = useMemo(() => {
     const sortedGoals = [...participantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
     return sortedGoals.find(g => !g.isCompleted) || sortedGoals[0] || null;
  }, [participantGoals]);

  const latestStrengthStats = useMemo(() => {
    if (userStrengthStats.length === 0) return null;
    return userStrengthStats[userStrengthStats.length - 1];
  }, [userStrengthStats]);


  const calculateUpdatedStreakAndGamification = useCallback((
    currentGoals: ParticipantGoalData[],
    gamificationStats: ParticipantGamificationStats | null,
    participantId: string | undefined,
    currentAllActivityLogs: ActivityLog[]
  ): { updatedGoals: ParticipantGoalData[], updatedGamificationStats: ParticipantGamificationStats | null } => {
    if (currentGoals.length === 0 || !participantId) {
      return { updatedGoals: currentGoals, updatedGamificationStats: gamificationStats };
    }
  
    let goalsArray = [...currentGoals];
    const latestSetGoal = goalsArray.sort((a, b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    let goalToUpdate = { ...latestSetGoal };
  
    let newGamificationStats = gamificationStats 
      ? { ...gamificationStats } 
      : { id: participantId, longestStreakWeeks: 0, lastUpdated: new Date().toISOString() };
  
    if (goalToUpdate && goalToUpdate.workoutsPerWeekTarget > 0 && !goalToUpdate.isCompleted) {
      const today = new Date();
      const currentEpochWeekId = dateUtils.getEpochWeekId(today);
  
      if (!goalToUpdate.lastStreakUpdateEpochWeekId || !goalToUpdate.lastStreakUpdateEpochWeekId.includes('-W')) {
        goalToUpdate.lastStreakUpdateEpochWeekId = dateUtils.getEpochWeekId(new Date(goalToUpdate.setDate));
        goalToUpdate.currentWeeklyStreak = 0;
      }
  
      if (goalToUpdate.lastStreakUpdateEpochWeekId !== currentEpochWeekId) {
        const previousEpochWeekId = dateUtils.getPreviousEpochWeekId(currentEpochWeekId);
        const logsLastEpochWeek = currentAllActivityLogs.filter(log => dateUtils.getEpochWeekId(new Date(log.completedDate)) === previousEpochWeekId).length;
        
        if (logsLastEpochWeek >= goalToUpdate.workoutsPerWeekTarget) {
          goalToUpdate.currentWeeklyStreak += 1;
        } else {
          const logsThisEpochWeek = currentAllActivityLogs.filter(log => dateUtils.getEpochWeekId(new Date(log.completedDate)) === currentEpochWeekId).length;
          goalToUpdate.currentWeeklyStreak = logsThisEpochWeek > 0 ? 1 : 0;
        }
  
        goalToUpdate.lastStreakUpdateEpochWeekId = currentEpochWeekId;
        
        if (goalToUpdate.currentWeeklyStreak > (newGamificationStats.longestStreakWeeks || 0)) {
          newGamificationStats.longestStreakWeeks = goalToUpdate.currentWeeklyStreak;
          newGamificationStats.lastUpdated = new Date().toISOString();
        }
      }
    }
  
    const finalGoals = goalsArray.map(g => g.id === goalToUpdate.id ? goalToUpdate : g);
  
    return { updatedGoals: finalGoals, updatedGamificationStats: newGamificationStats };
  }, []);


  const openMentalCheckinIfNeeded = useCallback(() => {
    const wasLoggedToday = () => {
        if (!participantMentalWellbeing?.lastUpdated) return false;
        return dateUtils.isSameDay(new Date(participantMentalWellbeing.lastUpdated), new Date());
    };

    if (!wasLoggedToday()) {
        setIsMentalCheckinOpen(true);
    }
  }, [participantMentalWellbeing]);

  const handleSaveLog = (logData: WorkoutLog) => {
    const existingLogIndex = workoutLogs.findIndex(l => l.id === logData.id);
    let updatedWorkoutLogsList;
    if (existingLogIndex > -1) {
      updatedWorkoutLogsList = workoutLogs.map((l, index) => index === existingLogIndex ? logData : l);
    } else {
      updatedWorkoutLogsList = [...workoutLogs, logData];
    }

    let finalLogDataWithSummary = { ...logData };
    
    if (logData.entries.length > 0) { 
        const summary = calculatePostWorkoutSummary(logData, workouts);
        finalLogDataWithSummary = { ...logData, postWorkoutSummary: summary };
    }
    
    const finalWorkoutLogs = updatedWorkoutLogsList.map(l => l.id === finalLogDataWithSummary.id ? finalLogDataWithSummary : l);
    setWorkoutLogs(finalWorkoutLogs);
    
    // Update streaks and gamification
    const newAllLogs = [...finalWorkoutLogs, ...generalActivityLogs].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(participantGoals, participantGamificationStats, participantProfile?.id, newAllLogs);
    setParticipantGoals(updatedGoals);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(updatedGamificationStats);
    }

    // Close form and open summary modal
    setIsLogFormOpen(false);
    setCurrentWorkoutLog(undefined);
    setCurrentWorkoutForForm(null);

    if (logData.entries.length > 0) {
        setLogForSummaryModal(finalLogDataWithSummary);
        const workoutTemplateForSummary = workouts.find(w => w.id === finalLogDataWithSummary.workoutId);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsPostWorkoutSummaryModalOpen(true);
    }
  };

  const handleFinalizePostWorkoutSummary = () => {
    setIsPostWorkoutSummaryModalOpen(false);
    setLogForSummaryModal(null);
    setWorkoutForSummaryModal(null);
    openMentalCheckinIfNeeded();
  };
  
  const handleEditLogFromSummary = () => {
    if (logForSummaryModal && workoutForSummaryModal) {
      setIsPostWorkoutSummaryModalOpen(false); 
      
      setCurrentWorkoutLog(logForSummaryModal);
      setCurrentWorkoutForForm(workoutForSummaryModal); 
      setIsNewSessionForLog(false); 
      setIsLogFormOpen(true); 
    }
  };

  const calculatePostWorkoutSummary = (log: WorkoutLog, allWorkouts: Workout[]): PostWorkoutSummaryData => {
    let totalWeightLifted = 0;
    const newPBs: NewPB[] = [];

    const workoutTemplate = allWorkouts.find(w => w.id === log.workoutId);
    
    const exercisesInThisLogSession = 
        (log.selectedExercisesForModifiable && log.selectedExercisesForModifiable.length > 0)
        ? log.selectedExercisesForModifiable
        : workoutTemplate?.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];


    log.entries.forEach(entry => {
      const exerciseDetail = exercisesInThisLogSession.find(ex => ex.id === entry.exerciseId);
      if (!exerciseDetail) return;

      let maxWeightForExercise = 0;
      let maxRepsAtMaxWeight = 0;
      let maxRepsOverall = 0;
      let weightAtMaxRepsOverall = 0;

      entry.loggedSets.forEach(set => {
        const weight = typeof set.weight === 'number' ? set.weight : 0;
        const reps = typeof set.reps === 'number' ? set.reps : 0;
        if (set.isCompleted && reps > 0) {
          totalWeightLifted += weight * reps;

          if (weight > maxWeightForExercise) {
            maxWeightForExercise = weight;
            maxRepsAtMaxWeight = reps;
          } else if (weight === maxWeightForExercise && reps > maxRepsAtMaxWeight) {
            maxRepsAtMaxWeight = reps;
          }

          if (reps > maxRepsOverall) {
            maxRepsOverall = reps;
            weightAtMaxRepsOverall = weight;
          } else if (reps === maxRepsOverall && weight > weightAtMaxRepsOverall) {
            weightAtMaxRepsOverall = weight;
          }
        }
      });

      const previousLogsForThisExercise = workoutLogs 
        .filter(prevLog => prevLog.id !== log.id && new Date(prevLog.completedDate) < new Date(log.completedDate))
        .flatMap(prevLog => {
            const prevWorkoutTemplate = allWorkouts.find(w => w.id === prevLog.workoutId);
            const exercisesInPrevLogSession = 
                (prevLog.selectedExercisesForModifiable && prevLog.selectedExercisesForModifiable.length > 0)
                ? prevLog.selectedExercisesForModifiable
                : prevWorkoutTemplate?.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];
            
            const matchingPrevExercise = exercisesInPrevLogSession.find(ex => ex.name === exerciseDetail.name || (ex.baseLiftType && ex.baseLiftType === exerciseDetail.baseLiftType));
            if (matchingPrevExercise) {
                return prevLog.entries.filter(e => e.exerciseId === matchingPrevExercise.id);
            }
            return [];
        });


      let historicMaxWeight = 0;
      let historicMaxRepsAtThatWeight = 0;
      let historicMaxRepsOverall = 0;

      previousLogsForThisExercise.forEach(prevEntry => {
        prevEntry.loggedSets.forEach(prevSet => {
          const prevWeight = typeof prevSet.weight === 'number' ? prevSet.weight : 0;
          const prevReps = typeof prevSet.reps === 'number' ? prevSet.reps : 0;
          if (prevSet.isCompleted && prevReps > 0) {
            if (prevWeight > historicMaxWeight) {
              historicMaxWeight = prevWeight;
              historicMaxRepsAtThatWeight = prevReps;
            } else if (prevWeight === historicMaxWeight && prevReps > historicMaxRepsAtThatWeight) {
              historicMaxRepsAtThatWeight = prevReps;
            }
            if (prevReps > historicMaxRepsOverall) {
              historicMaxRepsOverall = prevReps;
            }
          }
        });
      });
      
      if (maxWeightForExercise > 0 && maxWeightForExercise > historicMaxWeight) {
        newPBs.push({ 
          exerciseName: exerciseDetail.name, 
          achievement: "Nytt PB i vikt!", 
          value: `${maxWeightForExercise} kg x ${maxRepsAtMaxWeight} reps`,
          previousBest: historicMaxWeight > 0 ? `(tidigare ${historicMaxWeight} kg)` : undefined
        });
      } else if (maxWeightForExercise > 0 && maxWeightForExercise === historicMaxWeight && maxRepsAtMaxWeight > historicMaxRepsAtThatWeight) {
         newPBs.push({ 
          exerciseName: exerciseDetail.name, 
          achievement: `Fler reps på ${maxWeightForExercise} kg!`, 
          value: `${maxRepsAtMaxWeight} reps`,
          previousBest: `(tidigare ${historicMaxRepsAtThatWeight} reps)`
        });
      }
      
      if (maxRepsOverall > 0 && maxRepsOverall > historicMaxRepsOverall && 
          !newPBs.some(pb => pb.exerciseName === exerciseDetail.name && pb.achievement.includes("Nytt PB i vikt!"))) {
        newPBs.push({ 
          exerciseName: exerciseDetail.name, 
          achievement: "Nytt PB i reps!", 
          value: `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall} kg`,
          previousBest: historicMaxRepsOverall > 0 ? `(tidigare ${historicMaxRepsOverall} reps)` : undefined
        });
      }
    });

    let animalEquivalent;
    const sortedWeightComparisons = [...WEIGHT_COMPARISONS].sort((a, b) => a.weightKg - b.weightKg);
    for (let i = sortedWeightComparisons.length - 1; i >= 0; i--) {
      const item = sortedWeightComparisons[i];
      if (totalWeightLifted >= item.weightKg && item.weightKg > 0) {
        const count = Math.floor(totalWeightLifted / item.weightKg);
        animalEquivalent = {
          name: item.name,
          count: count,
          unitName: count === 1 ? item.name : (item.pluralName || `${item.name}er`),
          emoji: item.emoji,
        };
        break;
      }
    }

    return { totalWeightLifted, newPBs, animalEquivalent };
  };

  const handleStartWorkout = (workout: Workout, isResuming: boolean = false, existingLog?: WorkoutLog) => {
    if (workout.isModifiable && workout.exerciseSelectionOptions && !isResuming) {
        setWorkoutForExerciseSelection(workout);
        setIsExerciseSelectionModalOpen(true);
        setIsSelectWorkoutModalOpen(false); 
        return;
    }

    let logToUse = existingLog;
    if (!isResuming || !existingLog) {
        const previousLogForThisTemplate = workoutLogs
            .filter(l => l.workoutId === workout.id)
            .sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
        logToUse = previousLogForThisTemplate;
        setIsNewSessionForLog(true);
    } else { 
        setIsNewSessionForLog(false);
    }
    
    setCurrentWorkoutLog(logToUse); 
    setCurrentWorkoutForForm(workout); 
    setIsLogFormOpen(true);
    setIsSelectWorkoutModalOpen(false);
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  };

  const handleExerciseSelectionConfirm = (selectedExercises: Exercise[]) => {
    if (workoutForExerciseSelection) {
        const temporaryWorkoutWithSelectedExercises: Workout = {
            ...workoutForExerciseSelection,
            isModifiable: false, // Mark as no longer needing selection for this session
            blocks: [{ id: crypto.randomUUID(), name: "Valda Övningar", exercises: selectedExercises }],
        };
        handleStartWorkout(temporaryWorkoutWithSelectedExercises);
    }
    setIsExerciseSelectionModalOpen(false);
    setWorkoutForExerciseSelection(null);
  };

    const handleSaveProfileAndGoals = (
        profileData: ParticipantProfile, 
        goalData: Omit<ParticipantGoalData, 'id' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>,
        markLatestGoalAsCompleted: boolean
    ) => {
        setParticipantProfile(profileData);
        
        setParticipantGoals(prevGoals => {
            const nowISO = new Date().toISOString();
            let newGoalsArray = [...prevGoals];
            
            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = newGoalsArray.sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestExistingGoal && !latestExistingGoal.isCompleted) {
                    newGoalsArray = newGoalsArray.map(g => 
                        g.id === latestExistingGoal.id 
                        ? { ...g, isCompleted: true, completedDate: nowISO } 
                        : g
                    );
                }
            }
            
            if (goalData.fitnessGoals !== "Inga specifika mål satta" || 
                (goalData.fitnessGoals === "Inga specifika mål satta" && !markLatestGoalAsCompleted)) {
                
                const latestNonCompleted = newGoalsArray
                    .filter(g => !g.isCompleted)
                    .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                
                if (latestNonCompleted && 
                    latestNonCompleted.fitnessGoals === goalData.fitnessGoals &&
                    latestNonCompleted.workoutsPerWeekTarget === goalData.workoutsPerWeekTarget &&
                    (latestNonCompleted.preferences || '') === (goalData.preferences || '') &&
                    (latestNonCompleted.targetDate || '') === (goalData.targetDate || '')
                    ) {
                      
                } else {
                     newGoalsArray.push({
                        id: crypto.randomUUID(),
                        ...goalData,
                        currentWeeklyStreak: 0, 
                        lastStreakUpdateEpochWeekId: dateUtils.getEpochWeekId(new Date()), 
                        setDate: nowISO,
                        isCompleted: false,
                    });
                }
            }
            return newGoalsArray;
        });
    };

  const handleSaveStrengthStats = (newStat: UserStrengthStat) => {
    setUserStrengthStats(prevStats => [...prevStats, newStat]);
  };
  const handleSaveConditioningStats = (stats: ParticipantConditioningStats) => {
    setUserConditioningStats(stats);
  };
  const handleSaveMentalWellbeing = (wellbeingData: ParticipantMentalWellbeing) => {
    setParticipantMentalWellbeing(wellbeingData);
  };

  const handleTriggerAiProgressFeedback = useCallback(async () => {
    if (!ai || !API_KEY) {
      setAiFeedbackError("AI-tjänsten är inte tillgänglig. API-nyckel saknas.");
      setCurrentAiModalTitle("Fel vid hämtning av feedback");
      setIsAiFeedbackModalOpen(true);
      return;
    }
    
    setIsLoadingAiFeedback(true);
    setAiFeedback(null);
    setAiFeedbackError(null);
    setCurrentAiModalTitle("Feedback");
    setIsAiFeedbackModalOpen(true);

    const profileString = participantProfile ? `Namn: ${participantProfile.name || 'Ej angivet'}, Ålder: ${participantProfile.age || 'Ej angivet'}, Kön: ${participantProfile.gender || 'Ej angivet'}. InBody (om finns): Muskelmassa ${participantProfile.muscleMassKg || 'N/A'} kg, Fettmassa ${participantProfile.fatMassKg || 'N/A'} kg, Score ${participantProfile.inbodyScore || 'N/A'}.` : "Ingen profilinfo.";
    const goalString = latestActiveGoal ? `Mål: "${latestActiveGoal.fitnessGoals}", Mål pass/vecka: ${latestActiveGoal.workoutsPerWeekTarget}, Preferenser: ${latestActiveGoal.preferences || "Inga"}, Måldatum: ${latestActiveGoal.targetDate ? new Date(latestActiveGoal.targetDate).toLocaleDateString('sv-SE') : 'Inget'}.` : "Inga aktiva mål satta.";
    const strengthString = latestStrengthStats ? `Kroppsvikt: ${latestStrengthStats.bodyweightKg || 'N/A'} kg. 1RM: Knäböj ${latestStrengthStats.squat1RMaxKg || 'N/A'} kg, Bänk ${latestStrengthStats.benchPress1RMaxKg || 'N/A'} kg, Mark ${latestStrengthStats.deadlift1RMaxKg || 'N/A'} kg, Axelpress ${latestStrengthStats.overheadPress1RMaxKg || 'N/A'} kg.` : "Ingen styrkestatistik.";
    const conditioningString = userConditioningStats ? `Konditionstester (4 min): Airbike ${userConditioningStats.airbike4MinTest || 'N/A'}, Skierg ${userConditioningStats.skierg4MinMeters || 'N/A'} m, Rodd ${userConditioningStats.rower4MinMeters || 'N/A'} m, Löpband ${userConditioningStats.treadmill4MinMeters || 'N/A'} m.` : "Ingen konditionsstatistik.";
    const mentalString = participantMentalWellbeing ? `Senaste mentala check-in: Stress ${participantMentalWellbeing.stressLevel}/5, Energi ${participantMentalWellbeing.energyLevel}/5, Sömn ${participantMentalWellbeing.sleepQuality}/5, Humör ${participantMentalWellbeing.overallMood}/5.` : "Ingen data om mentalt välbefinnande.";

    const recentLogs = allActivityLogs.slice(0, 10).map(log => {
        let activityDetails = `Typ: ${log.type}, Datum: ${new Date(log.completedDate).toLocaleDateString('sv-SE')}.`;
        if (log.type === 'workout') {
            const workout = workouts.find(w => w.id === (log as WorkoutLog).workoutId);
            activityDetails += ` Pass: ${workout?.title || 'Okänt'}. Kommentar: ${(log as WorkoutLog).postWorkoutComment || '-'}. PB: ${(log as WorkoutLog).postWorkoutSummary?.newPBs.length || 0} st. Humör: ${log.moodRating || '-'}/5.`;
        } else {
            activityDetails += ` Aktivitet: ${(log as GeneralActivityLog).activityName}. Duration: ${(log as GeneralActivityLog).durationMinutes} min. Kommentar: ${(log as GeneralActivityLog).comment || '-'}. Humör: ${log.moodRating || '-'}/5.`;
        }
        return activityDetails;
    }).join('\n');

    const prompt = `Du är "Flexibot", en AI-coach och digital träningskompis från Flexibel Hälsostudio. Din roll är att ge peppande och konstruktiv feedback till medlemmen. Undvik alltid att ge medicinska råd. **Om du behöver hänvisa till en mänsklig coach för mer personlig uppföljning, rådgivning som ligger utanför ditt område (t.ex. medicinska frågor, komplexa skadeproblem), eller för att diskutera djupgående programjusteringar, använd formuleringar som 'ta upp detta med din coach i studion'.** Använd Markdown för att formatera ditt svar (## Rubriker, **fet text**, * punktlistor).

DINA REGLER:
- Om medlemmens mål inkluderar 'styrka', 'muskelmassa', 'bygga muskler', eller 'forma kroppen' OCH kroppsvikt finns i datan, inkludera ett avsnitt \`## Tips för Muskeluppbyggnad\`. Nämn där att ett proteinintag på ca **1.5 gram per kilo kroppsvikt per dag** är viktigt för att bevara och bygga muskler.
- Om medlemmens mål inkluderar 'viktnedgång' eller 'gå ner i vikt', inkludera ett avsnitt \`## Tips för Viktnedgång\`. Informera om att ett sunt mål är att gå ner **ca 0.5 kg per vecka**, eller upp till 1% av kroppsvikten per vecka. Tipsa också om att 'vi på Flexibel kan hjälpa dig med en hållbar plan för detta'.
- Om medlemmens mål innehåller ord som 'starkare' eller 'styrka', och styrkedatan (1RM) är ofullständig (minst ett av baslyften saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att fylla i detta. Exempelvis: "För att vi ska kunna följa din styrkeutveckling på bästa sätt, glöm inte att logga dina maxlyft (1RM) under 'Styrka'-fliken när du har möjlighet!"
- Om medlemmens mål innehåller ord som 'kondition' eller 'flås', och konditionsdatan är ofullständig (minst ett av testerna saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att göra ett test. Exempelvis: "Ett superbra sätt att mäta dina framsteg i kondition är att göra ett av våra 4-minuterstester (t.ex. Airbike eller Rodd) och logga resultatet under 'Kondition'-fliken. Gör ett test nu och ett igen om några månader för att se skillnaden!"

Medlemmens data:
- Profil: ${profileString}
- Mål: ${goalString}
- Styrka: ${strengthString}
- Kondition: ${conditioningString}
- Mentalt: ${mentalString}
- Senaste 10 loggade aktiviteterna:\n${recentLogs || "Inga aktiviteter loggade än."}

Baserat på ALL denna data, ge en sammanfattning och personliga tips. Inkludera:
1.  **## Helhetsbild & Uppmuntran:** En kort, positiv överblick.
2.  **## Progress mot Mål:** Om mål finns, kommentera hur loggningen och ev. resultat relaterar till dem.
3.  **## Styrka & Kondition:** Kommentarer om ev. styrkenivåer (om data finns) eller konditionsresultat. Ge tips för nästa steg om lämpligt.
4.  **## Mentalt Välbefinnande & Balans:** Om data finns, reflektera kort över den och hur den kan kopplas till träning.
5.  **## Observationer från Senaste Aktiviteterna:** Lyft fram något positivt från de senaste loggarna (t.ex. regelbundenhet, variation, PBs, humör).
6.  **## Konkreta Tips & Motivation:** Ge 1-2 specifika, actionable tips baserat på medlemmens helhetsprofil (t.ex. passförslag från Flexibels utbud (PT-Bas, PT-Grupp, HIIT, Workout, Yin Yoga, Postural Yoga, Mindfulness), fokusområde, eller påminnelse). Var kreativ!
7.  **## Avslutning:** Avsluta med pepp!

Om data saknas i vissa områden, nämn det vänligt och uppmuntra till att logga mer för bättre feedback.
Ton: Stöttande, professionell, och lite kul. Använd emojis sparsamt men passande.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", 
            contents: prompt,
        });
        setAiFeedback(response.text);
    } catch (err) {
      console.error("Error fetching AI feedback:", err);
      const typedError = err as Error;
      let errorMessage = "Kunde inte hämta AI-feedback. Försök igen senare.";
      if (typedError.message && typedError.message.includes("API key not valid")) {
        errorMessage = "API-nyckeln är ogiltig. Kontrollera att den är korrekt konfigurerad.";
      }
      setAiFeedbackError(errorMessage);
    } finally {
      setIsLoadingAiFeedback(false);
    }
  }, [ai, participantProfile, latestActiveGoal, latestStrengthStats, userConditioningStats, participantMentalWellbeing, allActivityLogs, workouts, API_KEY]);


  const handleTriggerQuickTipFeedback = useCallback(async () => {
    if (!ai || !API_KEY) {
        setAiFeedbackError("AI-tjänsten är inte tillgänglig. API-nyckel saknas.");
        setCurrentAiModalTitle("Fel vid hämtning av tips");
        setIsAiFeedbackModalOpen(true);
        return;
    }

    setIsLoadingAiFeedback(true);
    setAiFeedback(null);
    setAiFeedbackError(null);
    setCurrentAiModalTitle("Snabbt Tips från Coachen");
    setIsAiFeedbackModalOpen(true);

    const lastLog = allActivityLogs.length > 0 ? allActivityLogs[0] : null;

    if (!lastLog) {
        setAiFeedback("Du har inte loggat någon aktivitet ännu. Logga ett pass så kan jag ge dig tips!");
        setIsLoadingAiFeedback(false);
        return;
    }

    let activityTypePrompt = "";
    let activityNamePrompt = "";
    let activityDatePrompt = new Date(lastLog.completedDate).toLocaleDateString('sv-SE');
    let detailsPrompt = "";
    let commentPrompt = "";
    let moodRatingPrompt = lastLog.moodRating ? `${lastLog.moodRating}/5` : "Ingen skattning.";

    if (lastLog.type === 'workout') {
        activityTypePrompt = "Träningspass";
        const workoutLog = lastLog as WorkoutLog;
        const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
        activityNamePrompt = workoutTemplate?.title || "Okänt Pass";
        commentPrompt = workoutLog.postWorkoutComment || "Ingen kommentar.";

        let workoutDetailsParts = [];
        if (workoutLog.postWorkoutSummary?.totalWeightLifted) {
            workoutDetailsParts.push(`Totalvolym: ${workoutLog.postWorkoutSummary.totalWeightLifted.toLocaleString('sv-SE')} kg.`);
        }
        if (workoutLog.postWorkoutSummary?.newPBs?.length) {
            workoutDetailsParts.push(`Nya Rekord: ${workoutLog.postWorkoutSummary.newPBs.length} st.`);
        }
        if (workoutLog.postWorkoutSummary && workoutLog.postWorkoutSummary.newPBs?.length === 0 && !workoutLog.postWorkoutSummary?.totalWeightLifted) {
             // Handle case where summary exists but PBs and total weight are zero or undefined
            workoutDetailsParts.push("Bra genomfört!");
        }
        if (workoutDetailsParts.length === 0 && !workoutLog.postWorkoutSummary) { // If no summary object at all
            workoutDetailsParts.push("Bra genomfört!");
        } else if (workoutDetailsParts.length === 0 && workoutLog.postWorkoutSummary) { // Summary exists but no relevant data was pushed
             workoutDetailsParts.push("Bra genomfört!");
        }
        detailsPrompt = workoutDetailsParts.join(' ');

    } else if (lastLog.type === 'general') {
        activityTypePrompt = "Allmän aktivitet";
        const generalLog = lastLog as GeneralActivityLog;
        activityNamePrompt = generalLog.activityName;
        commentPrompt = generalLog.comment || "Ingen kommentar.";

        let generalDetailsParts = [];
        if (generalLog.durationMinutes) {
            generalDetailsParts.push(`Tid: ${generalLog.durationMinutes} min.`);
        }
        if (generalLog.distanceKm) {
            generalDetailsParts.push(`Distans: ${generalLog.distanceKm} km.`);
        }
        if (generalLog.caloriesBurned) {
            generalDetailsParts.push(`Kalorier: ${generalLog.caloriesBurned} kcal.`);
        }
        if (generalDetailsParts.length === 0) {
            generalDetailsParts.push("Bra genomfört!");
        }
        detailsPrompt = generalDetailsParts.join(' ');
    }
    
    const shortPrompt = `Du är "Flexibot", en AI-coach från Flexibel Hälsostudio. Ge ETT KORT (max 2-3 meningar) och peppande tips eller en observation baserat ENDAST PÅ FÖLJANDE SENAST LOGGADE aktivitet. Fokusera på något positivt eller ett litet utvecklingsområde. Använd Markdown för fetstil om du vill (t.ex. **viktigt**).

Senaste aktivitet:
- Typ: ${activityTypePrompt}
- Namn/Pass: ${activityNamePrompt}
- Datum: ${activityDatePrompt}
- Detaljer: ${detailsPrompt}
- Kommentar från medlemmen: "${commentPrompt}"
- Medlemmens humör efter passet (1-5, 5 bäst): ${moodRatingPrompt}

Exempel på svar (anpassa till den faktiska aktiviteten):
"Starkt jobbat med **${activityNamePrompt}**! Kul att se ditt engagemang. Ett litet tips: om du kände dig stark, prova att öka vikten lite nästa gång på en av övningarna!"
"Bra kämpat med **${activityNamePrompt}**! Din kommentar '${commentPrompt}' låter positiv. Fortsätt så!"
"Snyggt loggat: **${activityNamePrompt}**! Kom ihåg att även små ökningar i reps eller vikt gör stor skillnad över tid."

Håll det SUPERKORT och direkt. Inga långa utläggningar. Undvik att ge medicinska råd.
Om du behöver hänvisa till en mänsklig coach, använd formuleringar som 'ta upp detta med din coach i studion'.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: shortPrompt,
        });
        setAiFeedback(response.text);
    } catch (err) {
      console.error("Error fetching AI quick tip:", err);
      const typedError = err as Error;
      let errorMessage = "Kunde inte hämta AI-tips. Försök igen senare.";
      if (typedError.message && typedError.message.includes("API key not valid")) {
        errorMessage = "API-nyckeln är ogiltig. Kontrollera att den är korrekt konfigurerad.";
      }
      setAiFeedbackError(errorMessage);
    } finally {
      setIsLoadingAiFeedback(false);
    }
  }, [ai, allActivityLogs, workouts, API_KEY]);

  const handleTriggerAiGoalPrognosis = useCallback(async () => {
    if (allActivityLogs.length < 3) {
      setIsLoadingAiFeedback(false);
      setAiFeedbackError(null);
      setAiFeedback("## 🔮 Prognos Ej Tillgänglig Ännu\n\nFör att kunna göra en bra prognos för ditt mål behöver AI-coachen lite mer data. **Logga minst 3 aktiviteter** så kommer du att kunna se din prognos här.\n\nFortsätt med det goda arbetet! Varje pass tar dig ett steg närmare målet.");
      setCurrentAiModalTitle("Målprognos");
      setIsAiFeedbackModalOpen(true);
      return;
    }

    if (!ai || !API_KEY || !latestActiveGoal) {
      setAiFeedback(null);
      setAiFeedbackError("AI-tjänsten är inte tillgänglig eller så saknas ett aktivt mål att göra en prognos för.");
      setCurrentAiModalTitle("Prognos Ej Tillgänglig");
      setIsAiFeedbackModalOpen(true);
      return;
    }
    
    setIsLoadingAiFeedback(true);
    setAiFeedback(null);
    setAiFeedbackError(null);
    setCurrentAiModalTitle("🔮 AI Prognos: Tid till Mål");
    setIsAiFeedbackModalOpen(true);

    const profileString = participantProfile ? `Namn: ${participantProfile.name || 'Ej angivet'}, Ålder: ${participantProfile.age || 'Ej angivet'}, Kön: ${participantProfile.gender || 'Ej angivet'}.` : "Ingen profilinfo.";
    const goalString = `Mål: "${latestActiveGoal.fitnessGoals}", Mål pass/vecka: ${latestActiveGoal.workoutsPerWeekTarget}, Preferenser: ${latestActiveGoal.preferences || "Inga"}, Måldatum: ${latestActiveGoal.targetDate ? new Date(latestActiveGoal.targetDate).toLocaleDateString('sv-SE') : 'Inget'}.`;
    const strengthString = latestStrengthStats ? `Kroppsvikt: ${latestStrengthStats.bodyweightKg || 'N/A'} kg. 1RM: Knäböj ${latestStrengthStats.squat1RMaxKg || 'N/A'} kg, Bänk ${latestStrengthStats.benchPress1RMaxKg || 'N/A'} kg, Mark ${latestStrengthStats.deadlift1RMaxKg || 'N/A'} kg, Axelpress ${latestStrengthStats.overheadPress1RMaxKg || 'N/A'} kg.` : "Ingen styrkestatistik.";
    const conditioningString = userConditioningStats ? `Konditionstester (4 min): Airbike ${userConditioningStats.airbike4MinTest || 'N/A'}, Skierg ${userConditioningStats.skierg4MinMeters || 'N/A'} m, Rodd ${userConditioningStats.rower4MinMeters || 'N/A'} m, Löpband ${userConditioningStats.treadmill4MinMeters || 'N/A'} m.` : "Ingen konditionsstatistik.";
    const recentLogsSummary = allActivityLogs.slice(0, 5).map(log => 
        `Datum: ${new Date(log.completedDate).toLocaleDateString('sv-SE')}, Typ: ${log.type}, Humör: ${log.moodRating || 'N/A'}/5`
    ).join('\n');


    const prompt = `
      System: Du är "Flexibot", en AI-coach som ger realistiska och peppande prognoser. Du ger ALDRIG ett exakt datum. Använd alltid en tidsram (t.ex. 3-5 månader). Alltid på svenska.

      DINA REGLER FÖR INNEHÅLL:
      - Om medlemmens mål inkluderar 'styrka', 'muskelmassa', 'bygga muskler', eller 'forma kroppen' OCH kroppsvikt finns i datan, inkludera ett tips om proteinintag (ca **1.5g per kg kroppsvikt per dag**) under "Konkreta Tips" eller "Viktiga Faktorer".
      - Om medlemmens mål inkluderar 'viktnedgång' eller 'gå ner i vikt', förklara under "Viktiga Faktorer" att en hållbar takt är **ca 0.5 kg (eller upp till 1%) per vecka**. Under "Konkreta Tips", nämn att "vi på Flexibel kan hjälpa dig med en hållbar plan".
      - Om medlemmens mål innehåller ord som 'starkare' eller 'styrka', och styrkedatan (1RM) är ofullständig (innehåller 'N/A' för Knäböj, Bänkpress, Marklyft eller Axelpress), inkludera ett tips under "Konkreta Tips". Exempel: "För att mäta dina framsteg mot ditt styrkemål, börja med att logga dina 1 Rep Max (1RM) för baslyften: **Knäböj, Bänkpress, Marklyft och Axelpress**. Du hittar detta under 'Styrka'."
      - Om medlemmens mål innehåller ord som 'kondition' eller 'flås', och konditionsdatan är ofullständig (innehåller 'N/A'), inkludera ett tips under "Konkreta Tips". Exempel: "Ett superbra sätt att mäta din kondition är att göra ett av våra 4-minuterstester: **Airbike, Skierg, Rodd eller Löpband**. Logga ditt resultat under 'Kondition' för att se din utveckling!"

      Medlemmens data:
      - Profil: ${profileString}
      - Mål: ${goalString}
      - Styrka: ${strengthString}
      - Kondition: ${conditioningString}
      - Sammanfattning av de 5 senaste loggade aktiviteterna:
      ${recentLogsSummary || "Inga aktiviteter loggade än."}

      DINA REGLER FÖR STRUKTUR (Följ ordningen):
      1.  **## Prognos för ditt mål: "${latestActiveGoal.fitnessGoals.substring(0, 40)}..."**
      2.  **Uppskattad Tidsram:** Ge en realistisk tidsram baserat på målets komplexitet och medlemmens data. **Om målet är ett specifikt styrkemål (t.ex. 'klara 100 kg i bänkpress') och du har medlemmens nuvarande 1RM för samma lyft, MÅSTE du använda detta som utgångspunkt.** Kommentera på avståndet mellan nuvarande max och målet.
      3.  **Jämförelse med ditt Måldatum:**
          *   **Om medlemmen har angett ett måldatum**, jämför din uppskattade tidsram med det och ge konstruktiv feedback.
          *   Exempel på tonfall:
              *   Om medlemmens datum är **realistiskt**: "Ditt satta måldatum den ${latestActiveGoal.targetDate ? new Date(latestActiveGoal.targetDate).toLocaleDateString('sv-SE') : ''} ser ut att vara **mycket realistiskt** med tanke på vår prognos. Fortsätt med din nuvarande plan!"
              *   Om medlemmens datum är **ambitiöst**: "Ditt satta måldatum den ${latestActiveGoal.targetDate ? new Date(latestActiveGoal.targetDate).toLocaleDateString('sv-SE') : ''} är **ambitiöst men möjligt** om du är väldigt dedikerad. Det kommer kräva extra fokus på [faktor, t.ex. kost eller konsistens]."
              *   Om medlemmens datum är **väldigt orealistiskt**: "Ditt satta måldatum den ${latestActiveGoal.targetDate ? new Date(latestActiveGoal.targetDate).toLocaleDateString('sv-SE') : ''} är **väldigt utmanande**. Baserat på din nuvarande data kan det vara svårt att nå dit så snabbt. En mer hållbar tidsram kan vara [AI:s prognos]. Prata gärna med din coach i studion om hur ni kan optimera din plan."
          *   **Om medlemmen INTE har satt ett datum, hoppa över denna punkt helt.**
      4.  **Viktiga Faktorer:** Förklara KORT vilka faktorer som påverkar tidsramen. Exempel: "* **Konsistens:** Att du håller i dina ${latestActiveGoal.workoutsPerWeekTarget} pass/vecka är avgörande. * **Intensitet & Progression:** Att du successivt ökar vikter/reps. * **Kost & Återhämtning:** Spelar en stor roll utanför gymmet."
      5.  **## Konkreta Tips:** Ge 2 korta, konkreta tips baserade på medlemmens data för att optimera resan.
      6.  **Ansvarsfriskrivning:** Avsluta med en mening som: "Kom ihåg att detta är en uppskattning! Din resa är unik. Prata med din coach i studion för en mer detaljerad plan."
      
      Använd Markdown för formatering (**fetstil**, * punktlistor).
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
        });
        setAiFeedback(response.text);
    } catch (err) {
      console.error("Error fetching AI goal prognosis:", err);
      const typedError = err as Error;
      let errorMessage = "Kunde inte generera prognos. Försök igen senare.";
      if (typedError.message && typedError.message.includes("API key not valid")) {
        errorMessage = "API-nyckeln är ogiltig. Kontrollera att den är korrekt konfigurerad.";
      }
      setAiFeedbackError(errorMessage);
    } finally {
      setIsLoadingAiFeedback(false);
    }
  }, [ai, API_KEY, latestActiveGoal, participantProfile, latestStrengthStats, userConditioningStats, allActivityLogs]);


  useEffect(() => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const TEN_DAYS_MS = 10 * ONE_DAY_MS;
    const THIRTY_SECONDS_MS = 30 * 1000;
    const now = Date.now();

    let timeoutId: number | undefined;

    if (ai && API_KEY && (now - lastFeedbackPromptTime > TEN_DAYS_MS) && workoutLogs.length >= 3) {
      timeoutId = window.setTimeout(() => {
        setShowFeedbackPrompt(true);
      }, THIRTY_SECONDS_MS);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [workoutLogs, lastFeedbackPromptTime, ai, API_KEY]);

  const handleAcceptFeedbackPrompt = () => {
    setShowFeedbackPrompt(false);
    setLastFeedbackPromptTime(Date.now());
    handleTriggerQuickTipFeedback();
  };

  const handleDeclineFeedbackPrompt = () => {
    setShowFeedbackPrompt(false);
    setLastFeedbackPromptTime(Date.now()); 
  };

  const handleLogGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'userId'>) => {
    const newActivity: GeneralActivityLog = {
      type: 'general',
      id: crypto.randomUUID(),
      completedDate: new Date().toISOString(),
      ...activityData,
    };
    const updatedGeneralActivityLogsList = [...generalActivityLogs, newActivity];
    setGeneralActivityLogs(updatedGeneralActivityLogsList);
    setLastGeneralActivity(newActivity);
    setIsGeneralActivitySummaryOpen(true);
    
    // Update streaks and gamification
    const newAllLogs = [...workoutLogs, ...updatedGeneralActivityLogsList].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(participantGoals, participantGamificationStats, participantProfile?.id, newAllLogs);
    setParticipantGoals(updatedGoals);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(updatedGamificationStats);
    }
  };
  
  const handleDeleteActivity = (activityId: string, activityType: 'workout' | 'general') => {
    if (activityType === 'workout') {
      setWorkoutLogs(prev => prev.filter(log => log.id !== activityId));
    } else {
      setGeneralActivityLogs(prev => prev.filter(log => log.id !== activityId));
    }
    
  };

    const handleOpenSelectWorkoutModal = (category?: WorkoutCategory) => {
        setWorkoutCategoryFilter(category);
        setIsSelectWorkoutModalOpen(true);
    };

    const publishedWorkouts = useMemo(() => workouts.filter(w => w.isPublished), [workouts]);

  
  const overallStrengthLevel = useMemo(() => {
        if (!latestStrengthStats || !participantProfile?.gender || (participantProfile.gender !== 'Man' && participantProfile.gender !== 'Kvinna') || !latestStrengthStats.bodyweightKg) return 'Ej beräknad';
        const bwKg = latestStrengthStats.bodyweightKg;
        const gender = participantProfile.gender;
        const age = participantProfile.age ? parseInt(participantProfile.age, 10) : undefined;
        let totalLevelIndex = 0;
        let liftCount = 0;

        MAIN_LIFTS_CONFIG_HEADER.forEach(config => {
            const lift1RM = latestStrengthStats[config.statKey] as number | undefined;
            if (lift1RM && lift1RM > 0) {
                const ageFactor = getAgeAdjustmentFactorForHeader(age, config.lift, gender, USER_PROVIDED_STRENGTH_MULTIPLIERS);
                const effective1RM = lift1RM / ageFactor;
                
                const relevantStd = STRENGTH_STANDARDS_DATA.find(s => s.lift === config.lift && s.gender === gender && bwKg >= s.bodyweightCategoryKg.min && bwKg <= s.bodyweightCategoryKg.max);
                if (relevantStd) {
                    for (let i = relevantStd.standards.length - 1; i >= 0; i--) {
                        if (effective1RM >= relevantStd.standards[i].weightKg) {
                            totalLevelIndex += STRENGTH_LEVEL_ORDER.indexOf(relevantStd.standards[i].level);
                            liftCount++;
                            break;
                        }
                    }
                }
            }
        });
        if (liftCount === 0) return 'Data saknas';
        const averageLevelIndex = Math.round(totalLevelIndex / liftCount);
        return STRENGTH_LEVEL_ORDER[averageLevelIndex] || 'Data saknas';
    }, [latestStrengthStats, participantProfile]);

    const overallConditioningText = useMemo(() => {
        if (!userConditioningStats) return "Ingen data";
        const loggedTests = [
            userConditioningStats.airbike4MinTest,
            userConditioningStats.skierg4MinMeters,
            userConditioningStats.rower4MinMeters,
            userConditioningStats.treadmill4MinMeters
        ].filter(Boolean).length;
        if (loggedTests === 0) return "Ingen data";
        if (loggedTests < 4) return `${loggedTests}/4 tester loggade`;
        return "Alla tester loggade";
    }, [userConditioningStats]);

    const overallMentalWellbeingText = useMemo(() => {
        if (!participantMentalWellbeing) return "Ingen data";
        const { stressLevel, energyLevel, sleepQuality, overallMood, lastUpdated } = participantMentalWellbeing;
        if (!stressLevel && !energyLevel && !sleepQuality && !overallMood) return "Ingen data";
        
        const avgScore = [stressLevel, energyLevel, sleepQuality, overallMood].filter(v => v !== undefined).reduce((sum, val) => sum + (val || 0), 0) / 
                         [stressLevel, energyLevel, sleepQuality, overallMood].filter(v => v !== undefined).length;

        if (isNaN(avgScore)) return "Ingen data";

        let moodText = "";
        if (avgScore >= 4.5) moodText = "Toppen! 😄";
        else if (avgScore >= 3.5) moodText = "Bra 😊";
        else if (avgScore >= 2.5) moodText = "Okej 😐";
        else if (avgScore >= 1.5) moodText = "Mindre bra 😟";
        else moodText = "Kämpigt 😩";
        
        return `${moodText} (Snitt: ${avgScore.toFixed(1)}/5)`;
    }, [participantMentalWellbeing]);

    const inBodyIndicator = getInBodyScoreIndicator(participantProfile?.inbodyScore);

    const goalTimelineProgress = useMemo(() => {
        if (!latestActiveGoal || !latestActiveGoal.targetDate || latestActiveGoal.isCompleted) return null;
        const startDate = new Date(latestActiveGoal.setDate);
        const targetDate = new Date(latestActiveGoal.targetDate);
        const today = new Date();

        if (targetDate < startDate) return null; 

        const totalDuration = targetDate.getTime() - startDate.getTime();
        const elapsedDuration = Math.max(0, today.getTime() - startDate.getTime());
        const progressPercent = Math.min(100, (elapsedDuration / totalDuration) * 100);
        
        const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        let statusText = `${daysRemaining} dagar kvar`;
        if (today > targetDate) {
             statusText = `Deadline passerad`;
        } else if (daysRemaining === 0) {
            statusText = "Måldatum idag!";
        }

        return {
            progressPercent,
            startDateFormatted: startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
            targetDateFormatted: targetDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
            statusText,
            isOverdue: today > targetDate && daysRemaining === 0
        };
    }, [latestActiveGoal]);

    const weeklyWorkoutProgress = useMemo(() => {
      if (!latestActiveGoal || !latestActiveGoal.workoutsPerWeekTarget || latestActiveGoal.workoutsPerWeekTarget <= 0 || latestActiveGoal.isCompleted) {
        return null;
      }
      const currentEpochWeekId = dateUtils.getEpochWeekId(new Date());
      const workoutsThisWeekCount = allActivityLogs.filter(log => dateUtils.getEpochWeekId(new Date(log.completedDate)) === currentEpochWeekId).length;
      
      const progressPercent = Math.min(100, (workoutsThisWeekCount / latestActiveGoal.workoutsPerWeekTarget) * 100);
      const isGoalMet = workoutsThisWeekCount >= latestActiveGoal.workoutsPerWeekTarget;

      return {
        workoutsThisWeekCount,
        target: latestActiveGoal.workoutsPerWeekTarget,
        progressPercent,
        isGoalMet
      };
    }, [latestActiveGoal, allActivityLogs]); 
    
    const availableCategoriesForFab = useMemo(() => {
      const categories = new Set<WorkoutCategory>();
      publishedWorkouts.forEach(w => categories.add(w.category));
      return Array.from(categories);
    }, [publishedWorkouts]);

    const triggerFullFeedback = useCallback(() => {
        handleTriggerAiProgressFeedback();
    }, [handleTriggerAiProgressFeedback]);
    
    const completedGoalsCount = useMemo(() => {
        return participantGoals.filter(g => g.isCompleted).length;
    }, [participantGoals]);

    const totalWorkouts = useMemo(() => allActivityLogs.length, [allActivityLogs]);
    
    const longestStreak = useMemo(() => participantGamificationStats?.longestStreakWeeks || 0, [participantGamificationStats]);

    if (isLogFormOpen && currentWorkoutForForm) {
        return (
          <div className="pt-2 pb-4"> {/* Adjusted padding for focused view */}
            <WorkoutLogForm
              ai={ai}
              workout={currentWorkoutForForm}
              allWorkouts={workouts} // Pass the full list of workouts
              logForReferenceOrEdit={currentWorkoutLog}
              isNewSession={isNewSessionForLog}
              onSaveLog={handleSaveLog}
              onClose={() => {
                setIsLogFormOpen(false);
                setCurrentWorkoutLog(undefined);
                setCurrentWorkoutForForm(null);
              }}
              latestGoal={latestActiveGoal}
            />
          </div>
        );
      }

  return (
    <div className="flex flex-col h-full" ref={mainContentRef}>
      <FixedHeaderAndTools
        participantProfile={participantProfile}
        latestGoal={latestGoal}
        allParticipantGoals={participantGoals}
        userStrengthStats={userStrengthStats}
        userConditioningStats={userConditioningStats}
        onSaveProfileAndGoals={handleSaveProfileAndGoals}
        onSaveStrengthStats={handleSaveStrengthStats}
        onSaveConditioningStats={handleSaveConditioningStats}
        onSaveMentalWellbeing={handleSaveMentalWellbeing}
        onTriggerAiProgressFeedback={triggerFullFeedback}
        onTriggerAiGoalPrognosis={handleTriggerAiGoalPrognosis}
        mainContentRef={mainContentRef}
        currentRole={currentRole}
        onSetRole={onSetRole}
      />

      <div className="flex-grow p-1 sm:p-2 md:p-4 space-y-4">
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SummaryCard 
                title="Mina Mål" 
                icon={<TargetIcon />}
                isInitiallyExpanded={true}
                isCollapsible={false} 
            >
                {latestActiveGoal ? (
                    <div className="space-y-3">
                        <p><strong>Mål:</strong> {latestActiveGoal.fitnessGoals}</p>
                        {latestActiveGoal.workoutsPerWeekTarget > 0 && (
                            <p><strong>Mål Pass/Vecka:</strong> {latestActiveGoal.workoutsPerWeekTarget}</p>
                        )}
                        {latestActiveGoal.currentWeeklyStreak > 0 && (
                             <p><strong>Nuvarande Streak:</strong> {latestActiveGoal.currentWeeklyStreak} vecka/or 🔥</p>
                        )}
                        
                        
                        {weeklyWorkoutProgress && (
                          <div className="pt-2">
                              {/* Removed <p className="text-sm font-medium text-gray-700 mb-1">Veckans Pass:</p> */}
                              <div className="w-full bg-gray-200 rounded-full h-3.5 dark:bg-gray-700">
                                  <div 
                                      className="bg-flexibel h-3.5 rounded-full transition-all duration-500 ease-out" 
                                      style={{ width: `${weeklyWorkoutProgress.progressPercent}%`}}
                                      role="progressbar"
                                      aria-valuenow={weeklyWorkoutProgress.workoutsThisWeekCount}
                                      aria-valuemin={0}
                                      aria-valuemax={weeklyWorkoutProgress.target}
                                      aria-label={`Veckans pass progress: ${weeklyWorkoutProgress.workoutsThisWeekCount} av ${weeklyWorkoutProgress.target}`}
                                  ></div>
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                  {weeklyWorkoutProgress.workoutsThisWeekCount} / {weeklyWorkoutProgress.target} pass avklarade.
                                  {weeklyWorkoutProgress.isGoalMet && " Veckomål uppnått! Bra jobbat! 🎉"}
                              </p>
                          </div>
                        )}

                        
                        {goalTimelineProgress && (
                             <div className="pt-2">
                                <p className="text-sm font-medium text-gray-700 mb-1">Måldatum ({goalTimelineProgress.statusText}):</p>
                                <div className="w-full bg-gray-200 rounded-full h-3.5 dark:bg-gray-700">
                                    <div 
                                        className={`${goalTimelineProgress.isOverdue ? 'bg-red-500' : 'bg-yellow-500'} h-3.5 rounded-full transition-all duration-500 ease-out`}
                                        style={{ width: `${goalTimelineProgress.progressPercent}%`}}
                                        role="progressbar"
                                        aria-valuenow={Math.round(goalTimelineProgress.progressPercent)}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label={`Tidsprogress mot måldatum: ${Math.round(goalTimelineProgress.progressPercent)}%`}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Start: {goalTimelineProgress.startDateFormatted}</span>
                                    <span>Mål: {goalTimelineProgress.targetDateFormatted}</span>
                                </div>
                             </div>
                        )}
                    </div>
                ) : (
                    <p>Inga aktiva mål satta. Klicka på "Profil & Mål" i menyn för att sätta nya mål!</p>
                )}
            </SummaryCard>

             <SummaryCard
                title="Mina Prestationer"
                icon={<TrophyIcon />}
                isInitiallyExpanded={false}
                infoAriaLabel="Information om dina prestationer"
                onInfoClick={() => {
                    setInfoModalContent({
                        title: "Mina Prestationer",
                        content: (
                            <div className="space-y-2">
                                <p>Här ser du en sammanfattning av dina framsteg!</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><strong>Totalt antal pass:</strong> Alla dina loggade gympass och andra aktiviteter.</li>
                                    <li><strong>Avklarade Mål:</strong> Antalet mål du har markerat som slutförda.</li>
                                    <li><strong>Längsta Streak:</strong> Det längsta antalet veckor i rad som du har uppnått ditt veckomål för antal pass.</li>
                                </ul>
                            </div>
                        )
                    });
                    setIsInfoModalOpen(true);
                }}
            >
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl" role="img" aria-label="Pass">📈</span>
                        <div>
                            <p className="font-semibold text-gray-800">Totalt antal pass</p>
                            <p className="text-lg">{totalWorkouts} pass</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl" role="img" aria-label="Mål">✅</span>
                        <div>
                            <p className="font-semibold text-gray-800">Avklarade Mål</p>
                            <p className="text-lg">{completedGoalsCount} mål</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl" role="img" aria-label="Längsta streak">🏆</span>
                        <div>
                            <p className="font-semibold text-gray-800">Längsta Streak</p>
                            <p className="text-lg">{longestStreak} {longestStreak === 1 ? 'vecka' : 'veckor'}</p>
                        </div>
                    </div>
                </div>
            </SummaryCard>

            <SummaryCard 
                title="Min Styrka" 
                icon={<DumbbellEmojiIcon />}
                isInitiallyExpanded={false}
                infoAriaLabel="Information om styrka"
                onInfoClick={() => {
                     setInfoModalContent({
                        title: "Min Styrka",
                        content: (
                            <>
                                <p>Här visas en översikt av din styrka.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><strong>FSS (Flexibel Strength Score):</strong> Ett poäng som reflekterar din relativa styrka i de fyra stora baslyften (knäböj, bänkpress, marklyft, axelpress) jämfört med din kroppsvikt.</li>
                                    <li><strong>Övergripande Styrkenivå:</strong> En sammanvägd bedömning (Otränad till Elit) baserat på dina 1RM i förhållande till standardiserade nivåer för ditt kön, ålder och kroppsvikt.</li>
                                </ul>
                                <p className="mt-2">Logga dina 1RM under "Styrka" i menyn högst upp för att se din data här.</p>
                            </>
                        )
                    });
                    setIsInfoModalOpen(true);
                }}
            >
                {latestStrengthStats && latestStrengthStats.bodyweightKg && (latestStrengthStats.squat1RMaxKg || latestStrengthStats.benchPress1RMaxKg || latestStrengthStats.deadlift1RMaxKg || latestStrengthStats.overheadPress1RMaxKg) ? (
                    <div className="space-y-1">
                         {calculateFSSForToolInternalOnly(
                            latestStrengthStats.bodyweightKg,
                            latestStrengthStats.squat1RMaxKg || 0,
                            latestStrengthStats.deadlift1RMaxKg || 0,
                            latestStrengthStats.benchPress1RMaxKg || 0,
                            latestStrengthStats.overheadPress1RMaxKg || 0
                        ) && (
                            <p><strong>FSS:</strong> {calculateFSSForToolInternalOnly(
                                latestStrengthStats.bodyweightKg,
                                latestStrengthStats.squat1RMaxKg || 0,
                                latestStrengthStats.deadlift1RMaxKg || 0,
                                latestStrengthStats.benchPress1RMaxKg || 0,
                                latestStrengthStats.overheadPress1RMaxKg || 0
                            )?.score} <span className="text-sm">({calculateFSSForToolInternalOnly(
                                latestStrengthStats.bodyweightKg,
                                latestStrengthStats.squat1RMaxKg || 0,
                                latestStrengthStats.deadlift1RMaxKg || 0,
                                latestStrengthStats.benchPress1RMaxKg || 0,
                                latestStrengthStats.overheadPress1RMaxKg || 0
                            )?.interpretationText})</span></p>
                        )}
                        <p>
                          <strong>Övergripande Styrkenivå:</strong>{' '}
                          <span style={{ color: LEVEL_COLORS_HEADER[overallStrengthLevel as StrengthLevel] || 'inherit' }}>
                            {overallStrengthLevel}
                          </span>
                        </p>
                    </div>
                ) : (
                    <p>Logga kroppsvikt och 1RM under "Styrka" för att se din nivå och FSS här.</p>
                )}
            </SummaryCard>

            <SummaryCard 
                title="Min Komposition" 
                icon={<CompositionIcon />}
                isInitiallyExpanded={false}
                infoAriaLabel="Information om kroppskomposition"
                onInfoClick={() => {
                    setInfoModalContent({
                        title: "Min Komposition",
                        content: (
                            <>
                                <p>Här visas en översikt av din kroppsdata från en InBody-mätning.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><strong>InBody Score:</strong> En poäng från din InBody-mätning som reflekterar din övergripande kroppssammansättning.</li>
                                    <li><strong>Muskelmassa & Fettmassa:</strong> Dina absoluta värden i kg.</li>
                                </ul>
                                <p className="mt-2">Logga dina InBody-värden under "Profil & Mål" i menyn högst upp.</p>
                            </>
                        )
                    });
                    setIsInfoModalOpen(true);
                }}
            >
                {(participantProfile?.muscleMassKg || participantProfile?.fatMassKg || participantProfile?.inbodyScore) ? (
                    <div className="space-y-1">
                        {participantProfile.inbodyScore !== undefined && inBodyIndicator && (
                            <p><strong>InBody Score:</strong> {participantProfile.inbodyScore} 
                                <span style={{ color: inBodyIndicator.color }} className="font-semibold ml-1">({inBodyIndicator.text})</span>
                            </p>
                        )}
                        {participantProfile.muscleMassKg !== undefined && <p><strong>Muskelmassa:</strong> {participantProfile.muscleMassKg} kg</p>}
                        {participantProfile.fatMassKg !== undefined && <p><strong>Fettmassa:</strong> {participantProfile.fatMassKg} kg</p>}
                    </div>
                ) : (
                    <p>Ingen InBody-data loggad. Fyll i under "Profil & Mål".</p>
                )}
            </SummaryCard>

            <SummaryCard 
                title="Min Kondition" 
                icon={<PulseEmojiIcon />}
                isInitiallyExpanded={false}
                infoAriaLabel="Information om kondition"
                 onInfoClick={() => {
                     setInfoModalContent({
                        title: "Min Kondition",
                        content: (
                             <>
                                <p>Här visas en status på dina loggade konditionstester.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><strong>Konditionstester:</strong> En indikation på hur många av de fyra standardiserade konditionstesterna (Airbike, Skierg, Rodd, Löpband – alla 4 min max effort) du har loggat resultat för.</li>
                                </ul>
                                <p className="mt-2">Logga dina värden under "Kondition" i menyn högst upp.</p>
                            </>
                        )
                    });
                    setIsInfoModalOpen(true);
                }}
            >
                 <p className="mt-2"><strong>Konditionstester:</strong> {overallConditioningText}</p>
                 {overallConditioningText === "Ingen data" && <p className="text-sm">Logga resultat under "Kondition".</p>}
            </SummaryCard>

            <SummaryCard 
                title="Mentalt Välbefinnande" 
                icon={<MentalWellbeingEmojiIcon />}
                isInitiallyExpanded={false}
                infoAriaLabel="Information om mentalt välbefinnande"
                 onInfoClick={() => {
                     setInfoModalContent({
                        title: "Mentalt Välbefinnande",
                        content: (
                            <>
                                <p>Detta kort visar en sammanfattning av din senast loggade skattning av ditt mentala välbefinnande.</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li>Skalan är 1-5, där 5 är bäst för Energi, Sömn och Humör, medan 1 är bäst (lägst) för Stress.</li>
                                    <li>AI-coachen kan använda denna information för att ge mer holistiska råd.</li>
                                </ul>
                                <p className="mt-2">Logga ditt välbefinnande efter ett pass, eller när du vill via en knapp i "Logga Aktivitet" menyn.</p>
                            </>
                        )
                    });
                    setIsInfoModalOpen(true);
                }}
            >
                <p>{overallMentalWellbeingText}</p>
                {overallMentalWellbeingText === "Ingen data" && <p className="text-sm">Logga ditt mående efter ett pass för att se data här.</p>}
                 {participantMentalWellbeing?.lastUpdated && (
                    <p className="text-sm text-gray-400 mt-1">Senast loggat: {new Date(participantMentalWellbeing.lastUpdated).toLocaleDateString('sv-SE')}</p>
                )}
            </SummaryCard>
            
        </div>
        <ParticipantActivityView 
            allActivityLogs={allActivityLogs} 
            workouts={workouts} 
            onViewLogSummary={(log) => {
                if (log.type === 'workout') {
                    const workoutLog = log as WorkoutLog;
                    setLogForSummaryModal(workoutLog);
                    const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
                    setWorkoutForSummaryModal(workoutTemplate || null);
                    setIsPostWorkoutSummaryModalOpen(true);
                } else if (log.type === 'general') {
                    setLastGeneralActivity(log as GeneralActivityLog);
                    setIsGeneralActivitySummaryOpen(true);
                }
            }}
            onDeleteActivity={handleDeleteActivity}
          />
        </div>

      {isPostWorkoutSummaryModalOpen && logForSummaryModal && workoutForSummaryModal && (
        <PostWorkoutSummaryModal
          isOpen={isPostWorkoutSummaryModalOpen}
          onFinalize={handleFinalizePostWorkoutSummary}
          log={logForSummaryModal}
          workout={workoutForSummaryModal}
          onEditLog={handleEditLogFromSummary}
        />
      )}
      <LogGeneralActivityModal
        isOpen={isLogGeneralActivityModalOpen}
        onClose={() => setIsLogGeneralActivityModalOpen(false)}
        onSaveActivity={handleLogGeneralActivity}
      />
      <GeneralActivitySummaryModal
        isOpen={isGeneralActivitySummaryOpen}
        onClose={() => {
          setIsGeneralActivitySummaryOpen(false);
          openMentalCheckinIfNeeded();
        }}
        activity={lastGeneralActivity}
      />

      <FabMenu
        onSelectWorkoutCategory={handleOpenSelectWorkoutModal}
        onOpenLogGeneralActivityModal={() => {
          setIsLogGeneralActivityModalOpen(true);
        }}
        availableCategories={availableCategoriesForFab}
      />
      
      <SelectWorkoutModal
        isOpen={isSelectWorkoutModalOpen}
        onClose={() => setIsSelectWorkoutModalOpen(false)}
        workouts={publishedWorkouts}
        onStartWorkout={handleStartWorkout}
        categoryFilter={workoutCategoryFilter}
      />

      {workoutForExerciseSelection && (
        <ExerciseSelectionModal
          isOpen={isExerciseSelectionModalOpen}
          onClose={() => setIsExerciseSelectionModalOpen(false)}
          options={workoutForExerciseSelection.exerciseSelectionOptions || { list: [], maxSelect: 0 }}
          onConfirm={handleExerciseSelectionConfirm}
        />
      )}

      {ai && (
        <AIProgressFeedbackModal
          isOpen={isAiFeedbackModalOpen}
          onClose={() => setIsAiFeedbackModalOpen(false)}
          isLoading={isLoadingAiFeedback}
          aiFeedback={aiFeedback}
          error={aiFeedbackError}
          modalTitle={currentAiModalTitle}
        />
      )}

      <FeedbackPromptToast
        isOpen={showFeedbackPrompt}
        onAccept={handleAcceptFeedbackPrompt}
        onDecline={handleDeclineFeedbackPrompt}
        message="Du har varit aktiv! Vill du ha snabb feedback från AI-coachen på ditt senaste pass?"
      />
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title={infoModalContent.title}
      >
        {infoModalContent.content}
      </InfoModal>
      <MentalWellbeingModal 
        isOpen={isMentalCheckinOpen}
        onClose={() => setIsMentalCheckinOpen(false)}
        currentWellbeing={participantMentalWellbeing}
        participantId={participantProfile?.id}
        onSave={handleSaveMentalWellbeing}
      />
    </div>
  );
};