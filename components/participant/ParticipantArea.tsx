

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog, ActivityLog,
    ParticipantGoalData, ParticipantProfile,
    UserStrengthStat, ParticipantConditioningStat,
    UserRole, ParticipantMentalWellbeing, Exercise, GoalCompletionLog, ParticipantGamificationStats, WorkoutCategory, PostWorkoutSummaryData, NewPB, ParticipantClubMembership, LeaderboardSettings, CoachEvent, GenderOption
} from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Button } from '../Button';
import { WorkoutLogForm } from './WorkoutLogForm';
import { AIProgressFeedbackModal } from './AIProgressFeedbackModal';
import { ParticipantActivityView } from './ParticipantActivityView';
import { PostWorkoutSummaryModal } from './PostWorkoutSummaryModal';
import { LogGeneralActivityModal } from './LogGeneralActivityModal';
import { GeneralActivitySummaryModal } from './GeneralActivitySummaryModal';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import {
    LOCAL_STORAGE_KEYS, WEIGHT_COMPARISONS, FLEXIBEL_PRIMARY_COLOR,
    STRESS_LEVEL_OPTIONS, ENERGY_LEVEL_OPTIONS, SLEEP_QUALITY_OPTIONS, OVERALL_MOOD_OPTIONS,
    WORKOUT_CATEGORY_OPTIONS, LEVEL_COLORS_HEADER, MAIN_LIFTS_CONFIG_HEADER, MOOD_OPTIONS
} from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { FixedHeaderAndTools } from './FixedHeaderAndTools';
import { calculateFlexibelStrengthScoreInternal } from './StrengthComparisonTool';
import { FeedbackPromptToast } from './FeedbackPromptToast';
import { InfoModal } from './InfoModal';
import { FabMenu } from './FabMenu';
import { SelectWorkoutModal } from './SelectWorkoutModal';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { MentalWellbeingModal } from './MentalWellbeingModal';
import { ProfileGoalModal } from './ProfileGoalModal';
import { ALL_PASS_INFO, DetailedPassInformation } from './passDescriptions';
import { ParticipantLeaderboardModal } from './ParticipantLeaderboardModal';
import { StrengthComparisonModal } from './StrengthComparisonModal';
import { ConditioningStatsModal } from './ConditioningStatsModal';
import { PhysiqueManagerModal } from './PhysiqueManagerModal';


const API_KEY = process.env.API_KEY;

const InfoIcon: React.FC<{ onClick: (event: React.MouseEvent) => void; ariaLabel: string }> = ({ onClick, ariaLabel }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white text-flexibel border border-flexibel text-xs font-bold ml-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-flexibel"
        aria-label={ariaLabel}
    >
        i
    </button>
);


// Helper Components (Icons and SummaryCard)
interface SummaryCardProps {
    title: React.ReactNode;
    icon: JSX.Element;
    children: React.ReactNode;
    isInitiallyCollapsed?: boolean;
    previewContent?: React.ReactNode;
    cardClassName?: string;
}
const SummaryCard: React.FC<SummaryCardProps> = ({ title, icon, children, isInitiallyCollapsed = false, previewContent, cardClassName }) => {
    const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed);
    const contentId = `summary-card-content-${Math.random()}`;
    
    return (
        <div className={`bg-white rounded-xl shadow-lg border border-gray-200 transition-all duration-300 ease-in-out ${cardClassName || ''}`}>
            <button
                className="w-full p-4 flex justify-between items-center text-left"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
            >
                <div className="flex items-center">
                    <div className="mr-3">{icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 flex items-center">{title}</h3>
                      {isCollapsed && previewContent && (
                        <div className="mt-1 text-sm text-gray-600 animate-fade-in-down">
                          {previewContent}
                        </div>
                      )}
                    </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-500 transition-transform duration-300 ${!isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {!isCollapsed && (
                <div id={contentId} className="px-4 pb-4 animate-fade-in-down">
                    <div className="border-t pt-3">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};


const WelcomeBanner = () => (
    <div className="bg-white p-4 rounded-lg shadow-md border border-flexibel/50 mb-6 text-center animate-fade-in-down">
        <p className="text-lg text-gray-700">
            Välkommen! Börja med att klicka på <strong className="font-semibold text-flexibel">"Profil & Mål"</strong> i menyn högst upp och ange din information.
        </p>
    </div>
);

const Timeline: React.FC<{ startDate: string, targetDate: string }> = ({ startDate, targetDate }) => {
    const start = new Date(startDate);
    const end = new Date(targetDate);
    const today = new Date();

    const totalDuration = end.getTime() - start.getTime();
    const elapsedDuration = today.getTime() - start.getTime();
    
    let progressPercentage = (elapsedDuration / totalDuration) * 100;
    progressPercentage = Math.max(0, Math.min(100, progressPercentage));

    const daysTotal = Math.round(totalDuration / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));


    return (
        <div className="w-full">
            <div className="relative h-2.5 w-full rounded-full bg-gray-200">
                <div className="absolute top-0 left-0 h-full rounded-full bg-flexibel" style={{ width: `${progressPercentage}%` }}></div>
                <div className="absolute top-0 h-full w-full flex items-center" style={{ left: `${progressPercentage}%` }}>
                    <div className="relative z-10">
                        <div className="h-4 w-4 rounded-full bg-white border-2 border-flexibel shadow -ml-2"></div>
                        <span className="absolute top-5 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-600 bg-white px-1 rounded whitespace-nowrap">Idag</span>
                    </div>
                </div>
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-1.5 px-1">
                <span>{start.toLocaleDateString('sv-SE', {day: 'numeric', month: 'short'})}</span>
                <span className="font-bold text-flexibel">{daysRemaining} dagar kvar</span>
                <span>{end.toLocaleDateString('sv-SE', {day: 'numeric', month: 'short'})}</span>
            </div>
        </div>
    );
};

const GoalPaceIndicator: React.FC<{ goal: ParticipantGoalData | null, logs: ActivityLog[] }> = ({ goal, logs }) => {
    if (!goal || !goal.workoutsPerWeekTarget || goal.workoutsPerWeekTarget <= 0) {
        return (
            <>
                <p className="text-3xl font-bold text-gray-800">-</p>
                <p className="text-sm text-gray-400 mt-1">Sätt ett veckomål.</p>
            </>
        );
    }

    const today = new Date();
    const goalSetDate = new Date(goal.setDate);
    const daysSinceGoalSet = Math.max(0, (today.getTime() - goalSetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceGoalSet < 1) {
        return (
            <>
                <p className="text-3xl font-bold text-gray-800">🚀</p>
                <p className="text-sm text-gray-400 mt-1">Nytt mål startat!</p>
            </>
        );
    }
    
    const weeksSinceGoalSet = Math.max(1/7, daysSinceGoalSet / 7);
    const totalWorkoutsSinceGoalSet = logs.filter(log => new Date(log.completedDate) >= goalSetDate).length;
    const currentAveragePace = totalWorkoutsSinceGoalSet / weeksSinceGoalSet;
    const targetPace = goal.workoutsPerWeekTarget;
    
    const paceRatio = targetPace > 0 ? currentAveragePace / targetPace : 1;

    let status: { text: string; color: string; icon: string; };
    if (paceRatio >= 0.95) {
        status = { text: 'I fas', color: 'text-green-600', icon: '✅' };
    } else if (paceRatio >= 0.75) {
        status = { text: 'Lite efter', color: 'text-yellow-600', icon: '⚠️' };
    } else {
        status = { text: 'Efter schemat', color: 'text-red-600', icon: '❌' };
    }

    return (
        <>
            <p className={`text-2xl font-bold ${status.color}`}>
                <span className="mr-1">{status.icon}</span>
                {status.text}
            </p>
            <p className="text-sm text-gray-500 mt-1" title={`Ditt snitt är ${currentAveragePace.toFixed(1)} pass/vecka`}>
                Snitt: {currentAveragePace.toFixed(1)} <span className="text-gray-400">/ Mål: {targetPace}</span>
            </p>
        </>
    );
};


interface ParticipantAreaProps {
  currentParticipantId: string;
  participantDirectory: ParticipantProfile[];
  setParticipantDirectory: (updater: ParticipantProfile[] | ((prev: ParticipantProfile[]) => ParticipantProfile[])) => void;
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  setWorkoutLogs: (logs: WorkoutLog[] | ((prev: WorkoutLog[]) => WorkoutLog[])) => void;
  participantGoals: ParticipantGoalData[];
  setParticipantGoals: (goals: ParticipantGoalData[] | ((prev: ParticipantGoalData[]) => ParticipantGoalData[])) => void;
  generalActivityLogs: GeneralActivityLog[];
  setGeneralActivityLogs: (logs: GeneralActivityLog[] | ((prev: GeneralActivityLog[]) => GeneralActivityLog[])) => void;
  goalCompletionLogs: GoalCompletionLog[];
  setGoalCompletionLogs: (logs: GoalCompletionLog[] | ((prev: GoalCompletionLog[]) => GoalCompletionLog[])) => void;
  
  userStrengthStats: UserStrengthStat[];
  setUserStrengthStats: (stats: UserStrengthStat[] | ((prev: UserStrengthStat[]) => UserStrengthStat[])) => void;
  userConditioningStatsHistory: ParticipantConditioningStat[];
  setUserConditioningStatsHistory: (stats: ParticipantConditioningStat[] | ((prev: ParticipantConditioningStat[]) => ParticipantConditioningStat[])) => void;
  participantMentalWellbeing: ParticipantMentalWellbeing[];
  setParticipantMentalWellbeing: (wellbeing: ParticipantMentalWellbeing[] | ((prev: ParticipantMentalWellbeing[]) => ParticipantMentalWellbeing[])) => void;
  participantGamificationStats: ParticipantGamificationStats[];
  setParticipantGamificationStats: (stats: ParticipantGamificationStats[] | ((prev: ParticipantGamificationStats[]) => ParticipantGamificationStats[])) => void;
  
  clubMemberships: ParticipantClubMembership[];
  leaderboardSettings: LeaderboardSettings;
  coachEvents: CoachEvent[];

  currentRole: UserRole | null;
  onSetRole: (role: UserRole | null) => void;
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
}

// Main ParticipantArea Component
export const ParticipantArea: React.FC<ParticipantAreaProps> = ({
  currentParticipantId,
  participantDirectory,
  setParticipantDirectory,
  workouts,
  workoutLogs,
  setWorkoutLogs,
  participantGoals,
  setParticipantGoals,
  generalActivityLogs,
  setGeneralActivityLogs,
  goalCompletionLogs,
  setGoalCompletionLogs,
  
  userStrengthStats,
  setUserStrengthStats,
  userConditioningStatsHistory,
  setUserConditioningStatsHistory,
  participantMentalWellbeing,
  setParticipantMentalWellbeing,
  participantGamificationStats,
  setParticipantGamificationStats,
  
  clubMemberships,
  leaderboardSettings,
  coachEvents,

  currentRole,
  onSetRole,
  openProfileModalOnInit,
  onProfileModalOpened,
}) => {
  const [currentWorkoutLog, setCurrentWorkoutLog] = useState<WorkoutLog | undefined>(undefined);
  const [isNewSessionForLog, setIsNewSessionForLog] = useState(true);
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [currentWorkoutForForm, setCurrentWorkoutForForm] = useState<Workout | null>(null);

  const [ai, setAi] = useState<GoogleGenAI | null>(null);

  const [lastFeedbackPromptTime, setLastFeedbackPromptTime] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.LAST_FEEDBACK_PROMPT_TIME, 0);

  const [isAiFeedbackModalOpen, setIsAiFeedbackModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isLoadingAiFeedback, setIsLoadingAiFeedback] = useState(false);
  const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
  const [currentAiModalTitle, setCurrentAiModalTitle] = useState("Feedback"); 

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
  const [isProfileGoalModalOpen, setIsProfileGoalModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  const [isStrengthModalOpen, setIsStrengthModalOpen] = useState(false);
  const [isConditioningModalOpen, setIsConditioningModalOpen] = useState(false);
  const [isPhysiqueModalOpen, setIsPhysiqueModalOpen] = useState(false);


  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // Memoized data for the current participant
  const participantProfile = useMemo(() => participantDirectory.find(p => p.id === currentParticipantId), [participantDirectory, currentParticipantId]);
  const myWorkoutLogs = useMemo(() => workoutLogs.filter(l => l.participantId === currentParticipantId), [workoutLogs, currentParticipantId]);
  const myGeneralActivityLogs = useMemo(() => generalActivityLogs.filter(l => l.participantId === currentParticipantId), [generalActivityLogs, currentParticipantId]);
  const myGoalCompletionLogs = useMemo(() => goalCompletionLogs.filter(l => l.participantId === currentParticipantId), [goalCompletionLogs, currentParticipantId]);
  const myParticipantGoals = useMemo(() => participantGoals.filter(g => g.participantId === currentParticipantId), [participantGoals, currentParticipantId]);
  const myStrengthStats = useMemo(() => userStrengthStats.filter(s => s.participantId === currentParticipantId), [userStrengthStats, currentParticipantId]);
  const myConditioningStats = useMemo(() => userConditioningStatsHistory.filter(s => s.participantId === currentParticipantId), [userConditioningStatsHistory, currentParticipantId]);
  const myMentalWellbeing = useMemo(() => participantMentalWellbeing.find(w => w.id === currentParticipantId), [participantMentalWellbeing, currentParticipantId]);
  const myGamificationStats = useMemo(() => participantGamificationStats.find(s => s.id === currentParticipantId), [participantGamificationStats, currentParticipantId]);
  const myClubMemberships = useMemo(() => clubMemberships.filter(c => c.participantId === currentParticipantId), [clubMemberships, currentParticipantId]);
  
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
    if (openProfileModalOnInit) {
        setIsProfileGoalModalOpen(true);
        onProfileModalOpened();
    }
  }, [openProfileModalOnInit, onProfileModalOpened]);

  const allActivityLogs = useMemo<ActivityLog[]>(() => {
    return [...myWorkoutLogs, ...myGeneralActivityLogs, ...myGoalCompletionLogs].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
  }, [myWorkoutLogs, myGeneralActivityLogs, myGoalCompletionLogs]);

  const allActivityLogsForLeaderboard = useMemo<ActivityLog[]>(() => {
    return [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];
  }, [workoutLogs, generalActivityLogs, goalCompletionLogs]);

  const optedInParticipants = useMemo(() => {
    return participantDirectory.filter(p => p.enableLeaderboardParticipation && p.isActive);
  }, [participantDirectory]);

  const isNewUser = useMemo(() => {
    return allActivityLogs.length === 0 && myParticipantGoals.length === 0;
  }, [allActivityLogs, myParticipantGoals]);


  const latestGoal = useMemo(() => {
    if (myParticipantGoals.length === 0) return null;
    return [...myParticipantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
  }, [myParticipantGoals]);
  
  const latestActiveGoal = useMemo(() => {
     const sortedGoals = [...myParticipantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
     return sortedGoals.find(g => !g.isCompleted) || sortedGoals[0] || null;
  }, [myParticipantGoals]);

  const latestStrengthStats = useMemo(() => {
    if (myStrengthStats.length === 0) return null;
    // Sort to be sure we get the latest entry by date
    return [...myStrengthStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
  }, [myStrengthStats]);

  const latestConditioningValues = useMemo(() => {
    if (!myConditioningStats || myConditioningStats.length === 0) return null;

    const findLastValue = (key: keyof Omit<ParticipantConditioningStat, 'id'|'lastUpdated'|'participantId'>): {value: string, date: string} | null => {
        for(let i = myConditioningStats.length - 1; i >= 0; i--) {
            const statValue = myConditioningStats[i][key];
            if (statValue !== undefined && statValue !== null) {
                return { value: String(statValue), date: myConditioningStats[i].lastUpdated };
            }
        }
        return null;
    };

    return {
        airbike4MinKcal: findLastValue('airbike4MinKcal'),
        skierg4MinMeters: findLastValue('skierg4MinMeters'),
        rower4MinMeters: findLastValue('rower4MinMeters'),
        rower2000mTimeSeconds: findLastValue('rower2000mTimeSeconds'),
        treadmill4MinMeters: findLastValue('treadmill4MinMeters'),
    };
  }, [myConditioningStats]);

  const flexibelStrengthScore = useMemo(() => {
    if (latestStrengthStats && participantProfile) {
        return calculateFlexibelStrengthScoreInternal(latestStrengthStats, participantProfile);
    }
    return null;
  }, [latestStrengthStats, participantProfile]);

  const getFssIndicator = (score: number | undefined): { color: string; } | null => {
      if (score === undefined || score === null) return null;
      if (score < 70) return { color: LEVEL_COLORS_HEADER['Otränad'] };
      if (score < 85) return { color: LEVEL_COLORS_HEADER['Medelgod'] };
      return { color: LEVEL_COLORS_HEADER['Avancerad'] };
  };

  const weeklyProgress = useMemo(() => {
    if (!latestActiveGoal || !latestActiveGoal.workoutsPerWeekTarget || latestActiveGoal.workoutsPerWeekTarget <= 0) {
      return null;
    }

    const startOfWeek = dateUtils.getStartOfWeek(new Date());
    const logsThisWeek = allActivityLogs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
    const target = latestActiveGoal.workoutsPerWeekTarget;
    const percentage = Math.min(100, (logsThisWeek / target) * 100);

    return {
      completed: logsThisWeek,
      target: target,
      percentage: percentage,
    };
  }, [allActivityLogs, latestActiveGoal]);

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
        if (!myMentalWellbeing?.lastUpdated) return false;
        return dateUtils.isSameDay(new Date(myMentalWellbeing.lastUpdated), new Date());
    };

    if (!wasLoggedToday()) {
        setIsMentalCheckinOpen(true);
    }
  }, [myMentalWellbeing]);

  const handleSaveLog = (logData: WorkoutLog) => {
    if (!participantProfile?.id) {
        alert("Profilinformation saknas. Kan inte spara logg.");
        return;
    }

    const logWithParticipantId: WorkoutLog = { ...logData, participantId: participantProfile.id };

    // Calculate summary if there are entries
    const logWithSummary = logWithParticipantId.entries.length > 0
        ? { ...logWithParticipantId, postWorkoutSummary: calculatePostWorkoutSummary(logWithParticipantId, workouts) }
        : logWithParticipantId;

    const existingLogIndex = workoutLogs.findIndex(l => l.id === logWithSummary.id);
    const updatedWorkoutLogsList = existingLogIndex > -1
        ? workoutLogs.map((l, index) => index === existingLogIndex ? logWithSummary : l)
        : [...workoutLogs, logWithSummary];
    
    setWorkoutLogs(updatedWorkoutLogsList);
    
    // Update streaks and gamification for the current user
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(myParticipantGoals, myGamificationStats, participantProfile.id, [...updatedWorkoutLogsList, ...myGeneralActivityLogs, ...myGoalCompletionLogs]);
    setParticipantGoals(prev => [...prev.filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(prev => [...prev.filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
    }

    // Close form and open summary modal
    setIsLogFormOpen(false);
    setCurrentWorkoutLog(undefined);
    setCurrentWorkoutForForm(null);

    if (logWithSummary.entries.length > 0) {
        setLogForSummaryModal(logWithSummary);
        const workoutTemplateForSummary = workouts.find(w => w.id === logWithSummary.workoutId);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsPostWorkoutSummaryModalOpen(true);
    } else if (logWithSummary.postWorkoutComment || logWithSummary.moodRating) {
        // If only comment/mood was saved, show a simpler summary modal for feedback
        const workoutTemplateForSummary = workouts.find(w => w.id === logWithSummary.workoutId);
        const simpleSummaryLog: GeneralActivityLog = {
            type: 'general', 
            id: logWithSummary.id,
            participantId: logWithSummary.participantId,
            activityName: `Kommentar för: ${workoutTemplateForSummary?.title || 'Okänt pass'}`,
            durationMinutes: 0,
            comment: logWithSummary.postWorkoutComment,
            moodRating: logWithSummary.moodRating,
            completedDate: logWithSummary.completedDate,
        };
        setLastGeneralActivity(simpleSummaryLog);
        setIsGeneralActivitySummaryOpen(true);
    } else {
        openMentalCheckinIfNeeded();
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
      let maxDistance = 0;
      let maxCalories = 0;

      entry.loggedSets.forEach(set => {
        const reps = typeof set.reps === 'number' ? set.reps : 0;
        const weight = typeof set.weight === 'number' ? set.weight : 0;
        const distance = typeof set.distanceMeters === 'number' ? set.distanceMeters : 0;
        const calories = typeof set.caloriesKcal === 'number' ? set.caloriesKcal : 0;

        if (set.isCompleted && (reps > 0 || distance > 0 || calories > 0)) {
            if (reps > 0 && weight > 0) {
              totalWeightLifted += weight * reps;
            }

            // PBs for weight/reps
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

            // PBs for new metrics
            if (distance > maxDistance) maxDistance = distance;
            if (calories > maxCalories) maxCalories = calories;
        }
      });

      const previousLogsForThisExercise = workoutLogs
        .filter(prevLog => prevLog.participantId === currentParticipantId && prevLog.id !== log.id && new Date(prevLog.completedDate) < new Date(log.completedDate))
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
      let historicMaxDistance = 0;
      let historicMaxCalories = 0;

      previousLogsForThisExercise.forEach(prevEntry => {
        prevEntry.loggedSets.forEach(prevSet => {
          const prevWeight = typeof prevSet.weight === 'number' ? prevSet.weight : 0;
          const prevReps = typeof prevSet.reps === 'number' ? prevSet.reps : 0;
          const prevDistance = typeof prevSet.distanceMeters === 'number' ? prevSet.distanceMeters : 0;
          const prevCalories = typeof prevSet.caloriesKcal === 'number' ? prevSet.caloriesKcal : 0;

          if (prevSet.isCompleted) {
            if (prevWeight > historicMaxWeight) {
              historicMaxWeight = prevWeight;
              historicMaxRepsAtThatWeight = prevReps;
            } else if (prevWeight === historicMaxWeight && prevReps > historicMaxRepsAtThatWeight) {
              historicMaxRepsAtThatWeight = prevReps;
            }
            if (prevReps > historicMaxRepsOverall) {
              historicMaxRepsOverall = prevReps;
            }
            if (prevDistance > historicMaxDistance) historicMaxDistance = prevDistance;
            if (prevCalories > historicMaxCalories) historicMaxCalories = prevCalories;
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

      if (maxDistance > 0 && maxDistance > historicMaxDistance) {
        newPBs.push({ 
          exerciseName: exerciseDetail.name, 
          achievement: "Nytt PB i distans!", 
          value: `${maxDistance} m`,
          previousBest: historicMaxDistance > 0 ? `(tidigare ${historicMaxDistance} m)` : undefined
        });
      }
      if (maxCalories > 0 && maxCalories > historicMaxCalories) {
        newPBs.push({ 
          exerciseName: exerciseDetail.name, 
          achievement: "Nytt PB i kalorier!", 
          value: `${maxCalories} kcal`,
          previousBest: historicMaxCalories > 0 ? `(tidigare ${historicMaxCalories} kcal)` : undefined
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
        const previousLogForThisTemplate = myWorkoutLogs
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
            isModifiable: true,
            exerciseSelectionOptions: undefined,
            blocks: [{ id: crypto.randomUUID(), name: "Valda Övningar", exercises: selectedExercises }],
        };
        handleStartWorkout(temporaryWorkoutWithSelectedExercises);
    }
  };

    const saveProfileAndGoalsData = (
        profileData: Partial<Pick<ParticipantProfile, 'name' | 'age' | 'gender' | 'enableLeaderboardParticipation'>>, 
        goalData: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>,
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean,
        migratedWorkoutCount?: number
    ) => {
        setParticipantDirectory(prev => prev.map(p => 
            p.id === currentParticipantId 
            ? { ...p, ...profileData, id: currentParticipantId, lastUpdated: new Date().toISOString() } 
            : p
        ));
        
        setParticipantGoals(prevGoals => {
            let newGoalsArray = [...prevGoals];
            const myOldGoals = newGoalsArray.filter(g => g.participantId === currentParticipantId);

            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = myOldGoals.sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestExistingGoal && !latestExistingGoal.isCompleted) {
                    const newGoalCompletionLog: GoalCompletionLog = {
                        type: 'goal_completion',
                        id: crypto.randomUUID(),
                        participantId: currentParticipantId,
                        goalId: latestExistingGoal.id,
                        goalDescription: latestExistingGoal.fitnessGoals,
                        completedDate: new Date().toISOString(),
                    };
                    setGoalCompletionLogs(prev => [...prev, newGoalCompletionLog]);
                    
                    newGoalsArray = newGoalsArray.map(g => 
                        g.id === latestExistingGoal.id 
                        ? { ...g, isCompleted: true, completedDate: new Date().toISOString() } 
                        : g
                    );
                }
            }
            
            if (goalData.fitnessGoals !== "Inga specifika mål satta" || 
                (goalData.fitnessGoals === "Inga specifika mål satta" && !markLatestGoalAsCompleted)) {
                
                const myLatestNonCompleted = myOldGoals
                    .filter(g => !g.isCompleted)
                    .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                
                if (myLatestNonCompleted && 
                    myLatestNonCompleted.fitnessGoals === goalData.fitnessGoals &&
                    myLatestNonCompleted.workoutsPerWeekTarget === goalData.workoutsPerWeekTarget &&
                    (myLatestNonCompleted.preferences || '') === (goalData.preferences || '') &&
                    (myLatestNonCompleted.targetDate || '') === (goalData.targetDate || '')
                    ) {
                      // No change, do nothing.
                } else {
                     const newGoal: ParticipantGoalData = {
                        id: crypto.randomUUID(),
                        participantId: currentParticipantId,
                        ...goalData,
                        currentWeeklyStreak: 0, 
                        lastStreakUpdateEpochWeekId: dateUtils.getEpochWeekId(new Date()), 
                        setDate: new Date().toISOString(),
                        isCompleted: false,
                    };
                    newGoalsArray.push(newGoal);
                }
            }
            return newGoalsArray;
        });

        if (migratedWorkoutCount !== undefined) {
            setParticipantGamificationStats(prev => {
               const existingStatIndex = prev.findIndex(s => s.id === currentParticipantId);
               const newStat = {
                   ...(existingStatIndex > -1 ? prev[existingStatIndex] : { id: currentParticipantId, longestStreakWeeks: 0 }),
                   migratedWorkoutCount,
                   lastUpdated: new Date().toISOString(),
               };
               if (existingStatIndex > -1) {
                   const newStats = [...prev];
                   newStats[existingStatIndex] = newStat;
                   return newStats;
               }
               return [...prev, newStat];
            });
        }
    };

  const handleSaveProfileAndGoals = (
        profileData: { name?: string; age?: string; gender?: GenderOption; enableLeaderboardParticipation?: boolean; }, 
        goalData: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>,
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean,
        migratedWorkoutCount?: number
    ) => {
        const previousGoal = latestActiveGoal;
        const goalHasChanged = !previousGoal || 
                               markLatestGoalAsCompleted ||
                               previousGoal.fitnessGoals !== goalData.fitnessGoals ||
                               previousGoal.workoutsPerWeekTarget !== goalData.workoutsPerWeekTarget ||
                               previousGoal.targetDate !== goalData.targetDate ||
                               previousGoal.preferences !== goalData.preferences;

        const hasNewMeaningfulGoal = goalData.fitnessGoals !== "Inga specifika mål satta" && goalData.fitnessGoals.trim() !== '';

        saveProfileAndGoalsData(profileData, goalData, markLatestGoalAsCompleted, noGoalAdviseOptOut, migratedWorkoutCount);

        if (hasNewMeaningfulGoal && goalHasChanged) {
            setTimeout(() => {
                handleTriggerAiGoalPrognosis(goalData);
            }, 300);
        }
    };

  const handleSavePhysique = (physiqueData: Partial<ParticipantProfile>) => {
    if (!currentParticipantId) return;
    setParticipantDirectory(prev => prev.map(p =>
      p.id === currentParticipantId
        ? { ...p, ...physiqueData, lastUpdated: new Date().toISOString() }
        : p
    ));
    setIsPhysiqueModalOpen(false);

    // Sync bodyweight update to strength stats history
    if (physiqueData.bodyweightKg !== undefined && physiqueData.bodyweightKg !== null) {
      const latestStrengthStatForSync = myStrengthStats.length > 0 
        ? [...myStrengthStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0]
        : null;
      
      // Only add a new stat entry if the bodyweight has actually changed to avoid duplicate entries.
      if (!latestStrengthStatForSync || latestStrengthStatForSync.bodyweightKg !== physiqueData.bodyweightKg) {
        const newStat: UserStrengthStat = {
          id: crypto.randomUUID(),
          participantId: currentParticipantId,
          bodyweightKg: physiqueData.bodyweightKg,
          // Carry over latest 1RMs so they are not lost when only updating bodyweight
          squat1RMaxKg: latestStrengthStatForSync?.squat1RMaxKg,
          benchPress1RMaxKg: latestStrengthStatForSync?.benchPress1RMaxKg,
          deadlift1RMaxKg: latestStrengthStatForSync?.deadlift1RMaxKg,
          overheadPress1RMaxKg: latestStrengthStatForSync?.overheadPress1RMaxKg,
          lastUpdated: new Date().toISOString(),
        };
        setUserStrengthStats(prevStats => [...prevStats, newStat]);
      }
    }
  };

  const handleSaveStrengthStats = (newStat: UserStrengthStat) => {
    if (!currentParticipantId || newStat.participantId !== currentParticipantId) {
      console.error("Attempted to save strength stats for incorrect participant.");
      return;
    }
    setUserStrengthStats(prevStats => [...prevStats, newStat]);
    
    // Sync bodyweight back to the main profile
    if (newStat.bodyweightKg !== undefined && newStat.bodyweightKg !== null) {
      setParticipantDirectory(prev => prev.map(p =>
        p.id === currentParticipantId
          ? { ...p, bodyweightKg: newStat.bodyweightKg, lastUpdated: new Date().toISOString() }
          : p
      ));
    }
  };
  const handleSaveConditioningStats = (stats: Omit<ParticipantConditioningStat, 'participantId'>) => {
    setUserConditioningStatsHistory(prev => [...prev, {...stats, participantId: currentParticipantId}]);
  };
  const handleSaveMentalWellbeing = (wellbeingData: Omit<ParticipantMentalWellbeing, 'id' | 'participantId'>) => {
    setParticipantMentalWellbeing(prev => {
        const existingIndex = prev.findIndex(w => w.id === currentParticipantId);
        const newWellbeing = {
            id: currentParticipantId,
            participantId: currentParticipantId,
            ...wellbeingData,
            lastUpdated: new Date().toISOString(),
        };
        if (existingIndex > -1) {
            const newState = [...prev];
            newState[existingIndex] = newWellbeing;
            return newState;
        }
        return [...prev, newWellbeing];
    });
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
    const conditioningString = latestConditioningValues ? `Konditionstester (4 min): Airbike ${latestConditioningValues.airbike4MinKcal?.value || 'N/A'} kcal, Skierg ${latestConditioningValues.skierg4MinMeters?.value || 'N/A'} m, Rodd (2000m) ${latestConditioningValues.rower2000mTimeSeconds?.value || 'N/A'}s, Löpband ${latestConditioningValues.treadmill4MinMeters?.value || 'N/A'} m.` : "Ingen konditionsstatistik.";
    const mentalString = myMentalWellbeing ? `Senaste mentala check-in: Stress ${myMentalWellbeing.stressLevel}/5, Energi ${myMentalWellbeing.energyLevel}/5, Sömn ${myMentalWellbeing.sleepQuality}/5, Humör ${myMentalWellbeing.overallMood}/5.` : "Ingen data om mentalt välbefinnande.";

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
- Om medlemmens mål innehåller ord som 'starkare' eller 'styrka', och styrkedatan (1RM) är ofullständig (minst ett av baslyften saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att fylla i detta. Exempelvis: "För att vi ska kunna följa din styrkeutveckling på bästa sätt, glöm inte att logga dina maxlyft (1RM) via **'Styrka'**-knappen i menyn högst upp när du har möjlighet!"
- Om medlemmens mål innehåller ord som 'kondition' eller 'flås', och konditionsdatan är ofullständig (minst ett av testerna saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att göra ett test. Exempelvis: "Ett superbra sätt att mäta dina framsteg i kondition är att göra ett av våra 4-minuterstester (t.ex. Airbike eller Rodd) och logga resultatet via **'Kondition'**-knappen i menyn högst upp. Gör ett test nu och ett igen om några månader för att se skillnaden!"

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
            model: "gemini-2.5-flash", 
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
  }, [ai, participantProfile, latestActiveGoal, latestStrengthStats, latestConditioningValues, myMentalWellbeing, allActivityLogs, workouts, API_KEY]);


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
            model: "gemini-2.5-flash",
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

  const handleTriggerAiGoalPrognosis = useCallback(async (goalDataOverride?: Partial<Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>>) => {
    const goalToAnalyze = goalDataOverride ? 
        { ...latestActiveGoal, ...goalDataOverride, fitnessGoals: goalDataOverride.fitnessGoals || "Inget mål angett" } : 
        latestActiveGoal;

    if (!ai || !API_KEY || !goalToAnalyze) {
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
    const goalString = `Mål: "${goalToAnalyze.fitnessGoals}", Mål pass/vecka: ${goalToAnalyze.workoutsPerWeekTarget}, Preferenser: ${goalToAnalyze.preferences || "Inga"}, Måldatum: ${goalToAnalyze.targetDate ? new Date(goalToAnalyze.targetDate).toLocaleDateString('sv-SE') : 'Inget'}.`;
    const strengthString = latestStrengthStats ? `Kroppsvikt: ${latestStrengthStats.bodyweightKg || 'N/A'} kg. 1RM: Knäböj ${latestStrengthStats.squat1RMaxKg || 'N/A'} kg, Bänk ${latestStrengthStats.benchPress1RMaxKg || 'N/A'} kg, Mark ${latestStrengthStats.deadlift1RMaxKg || 'N/A'} kg, Axelpress ${latestStrengthStats.overheadPress1RMaxKg || 'N/A'} kg.` : "Ingen styrkestatistik.";
    const conditioningString = latestConditioningValues ? `Konditionstester (4 min): Airbike ${latestConditioningValues.airbike4MinKcal?.value || 'N/A'}, Skierg ${latestConditioningValues.skierg4MinMeters?.value || 'N/A'} m, Rodd ${latestConditioningValues.rower4MinMeters?.value || 'N/A'} m, Löpband ${latestConditioningValues.treadmill4MinMeters?.value || 'N/A'} m.` : "Ingen konditionsstatistik.";
    const recentLogsSummary = allActivityLogs.slice(0, 5).map(log => 
        `Datum: ${new Date(log.completedDate).toLocaleDateString('sv-SE')}, Typ: ${log.type}, Humör: ${log.moodRating || 'N/A'}/5`
    ).join('\n');
    
    const passInfoString = ALL_PASS_INFO.map(p => 
        `- **Pass:** "${p.name}"\n` +
        `  - **Beskrivning:** ${p.typeDescription}\n` +
        `  - **Fokus:** ${p.focusArea.join(', ')}\n` +
        `  - **Passar bäst för mål som:** ${(p.suitedForGoals || []).join(', ')}`
    ).join('\n\n');

    const prompt = `
      System: Du är "Flexibot", en AI-coach som ger realistiska och peppande prognoser baserat på ett nyligen satt mål. Ditt svar ska skapa en tydlig röd tråd från mål till handling. Svara alltid på svenska och använd Markdown.

      DINA REGLER:
      1.  **Prognos:** Ge en tidsram (t.ex. "inom 3-5 månader"), inte ett exakt datum.
      2.  **Passrekommendationer:** Baserat på målet, rekommendera **1 till 3 pass** från listan nedan.
      3.  **Motivation:** För varje rekommenderat pass, ge en kort, motiverande förklaring till **varför** det hjälper medlemmen nå sitt specifika mål. Koppla motivationen direkt till målet.
      4.  **Helhet:** Väv ihop prognosen och rekommendationerna. Exempel: "För att nå ditt mål inom den här tidsramen, är dessa pass extra viktiga för dig...".
      5.  **Tips:** Inkludera andra relevanta tips (om protein, viktnedgång, fylla i 1RM osv.) om det passar målet, baserat på den ursprungliga kontexten. Om medlemmens mål inkluderar 'styrka', 'muskelmassa', 'bygga muskler', eller 'forma kroppen' OCH kroppsvikt finns i datan, inkludera ett tips om proteinintag (ca **1.5 gram per kilo kroppsvikt per dag**). Om medlemmens mål inkluderar 'viktnedgång' eller 'gå ner i vikt', informera om att ett sunt mål är att gå ner **ca 0.5 kg per vecka**.
      6.  **OM data saknas (få loggar):** Börja med att uppmuntra medlemmen att logga mer för att få en mer exakt prognos. Exempel: "Kul med ett nytt mål! Detta är en första prognos. Ju mer du loggar, desto bättre blir den."

      MEDLEMMENS DATA:
      - Profil: ${profileString}
      - Mål: ${goalString}
      - Styrka: ${strengthString}
      - Kondition: ${conditioningString}
      - Senaste 5 loggade aktiviteterna:
      ${recentLogsSummary || "Inga aktiviteter loggade än."}

      TILLGÄNGLIGA PASS PÅ FLEXIBEL:
      ${passInfoString}

      STRUKTURERA DITT SVAR SÅ HÄR:
      ## 🔮 Min Prognos för Dig
      [Här skriver du din tidsuppskattning och en kort, peppande översikt.]

      ## 🎯 Dina Nyckelpass för Framgång
      [Lista dina 1-3 rekommenderade pass här med **fetmarkerade** namn och en kort motivation för varje.]

      ## 💡 Bra att Tänka På
      [Lägg till dina övriga tips här, om det är relevant för målet.]

      ## ✨ Lycka Till!
      [Avsluta med en peppande mening.]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        setAiFeedback(response.text);
        
        // Save the prognosis to the latest goal
        setParticipantGoals(prevGoals => {
            const myGoals = prevGoals.filter(g => g.participantId === currentParticipantId);
            const latestGoalToSort = myGoals.sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
            if (latestGoalToSort) {
                return prevGoals.map(g => 
                    g.id === latestGoalToSort.id 
                    ? { ...g, aiPrognosis: response.text } 
                    : g
                );
            }
            return prevGoals;
        });

    } catch (err) {
        console.error("Error fetching AI goal prognosis:", err);
        const typedError = err as Error;
        let errorMessage = "Kunde inte hämta AI-prognos. Försök igen senare.";
        if (typedError.message && typedError.message.includes("API key not valid")) {
            errorMessage = "API-nyckeln är ogiltig. Kontrollera att den är korrekt konfigurerad.";
        }
        setAiFeedbackError(errorMessage);
    } finally {
        setIsLoadingAiFeedback(false);
    }
  }, [ai, latestActiveGoal, participantProfile, latestStrengthStats, latestConditioningValues, allActivityLogs, API_KEY, currentParticipantId, setParticipantGoals]);

  const handleSaveGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'participantId'>) => {
    if (!participantProfile?.id) {
        alert("Profilinformation saknas. Kan inte spara aktivitet.");
        return;
    }
    const newLog: GeneralActivityLog = {
      type: 'general',
      id: crypto.randomUUID(),
      participantId: participantProfile.id,
      ...activityData,
      completedDate: new Date().toISOString(),
    };
    const updatedGeneralLogsList = [...generalActivityLogs, newLog];
    setGeneralActivityLogs(updatedGeneralLogsList);

    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(myParticipantGoals, myGamificationStats, currentParticipantId, [...myWorkoutLogs, ...updatedGeneralLogsList, ...myGoalCompletionLogs]);
    setParticipantGoals(prev => [...prev.filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
    if(updatedGamificationStats) {
      setParticipantGamificationStats(prev => [...prev.filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
    }

    setIsLogGeneralActivityModalOpen(false);
    setLastGeneralActivity(newLog);
    setIsGeneralActivitySummaryOpen(true);
  };
  
  const handleViewLogSummary = (log: ActivityLog) => {
      if (log.type === 'workout') {
          const workoutTemplateForSummary = workouts.find(w => w.id === (log as WorkoutLog).workoutId);
          setLogForSummaryModal(log as WorkoutLog);
          setWorkoutForSummaryModal(workoutTemplateForSummary || null);
          setIsPostWorkoutSummaryModalOpen(true);
      }
  };

  const handleDeleteActivity = (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => {
      if (activityType === 'workout') {
          setWorkoutLogs(prev => prev.filter(log => log.id !== activityId));
      } else if (activityType === 'general') {
          setGeneralActivityLogs(prev => prev.filter(log => log.id !== activityId));
      } else if (activityType === 'goal_completion') {
          setGoalCompletionLogs(prev => prev.filter(log => log.id !== activityId));
      }
  };

  const availableCategoriesForFab = useMemo(() => {
    const categories = new Set<WorkoutCategory>();
    workouts.filter(w => w.isPublished).forEach(w => categories.add(w.category));
    return Array.from(categories);
  }, [workouts]);

  const getIconForHeader = (headerText: string): JSX.Element | null => {
    const lowerHeaderText = headerText.toLowerCase();
    if (lowerHeaderText.includes("prognos")) return <span className="mr-2 text-xl" role="img" aria-label="Prognos">🔮</span>;
    if (lowerHeaderText.includes("nyckelpass") || lowerHeaderText.includes("rekommendera")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommenderade pass">🎟️</span>;
    if (lowerHeaderText.includes("tänka på") || lowerHeaderText.includes("tips") || lowerHeaderText.includes("motivation")) return <span className="mr-2 text-xl" role="img" aria-label="Tips">💡</span>;
    if (lowerHeaderText.includes("lycka till") || lowerHeaderText.includes("avslutning")) return <span className="mr-2 text-xl" role="img" aria-label="Avslutning">🎉</span>;
    if (lowerHeaderText.includes("sammanfattning") || lowerHeaderText.includes("uppmuntran")) return <span className="mr-2 text-xl" role="img" aria-label="Sammanfattning">⭐</span>;
    if (lowerHeaderText.includes("progress") || lowerHeaderText.includes("inbody") || lowerHeaderText.includes("styrka")) return <span className="mr-2 text-xl" role="img" aria-label="Framsteg">💪</span>;
    if (lowerHeaderText.includes("mentalt välbefinnande") || lowerHeaderText.includes("balans")) return <span className="mr-2 text-xl" role="img" aria-label="Mentalt välbefinnande">🧘</span>;
    if (lowerHeaderText.includes("observationer") || lowerHeaderText.includes("pass") || lowerHeaderText.includes("aktiviteter")) return <span className="mr-2 text-xl" role="img" aria-label="Observationer">👀</span>;
    if (lowerHeaderText.includes("särskilda råd")) return <span className="mr-2 text-xl" role="img" aria-label="Särskilda råd">ℹ️</span>;
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>; // Default icon
  };

  const renderAiPrognosis = (feedback: string | null): JSX.Element[] | null => {
    if (!feedback) return null;
    const lines = feedback.split('\n');
    const renderedElements: JSX.Element[] = [];
    let currentListItems: JSX.Element[] = [];
    let listKeySuffix = 0;
  
    const flushList = () => {
      if (currentListItems.length > 0) {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
        listKeySuffix++;
      }
    };
  
    for (let i = 0; i < lines.length; i++) {
      let lineContent = lines[i];
      lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
  
      if (lineContent.startsWith('## ')) {
        flushList();
        const headerText = lineContent.substring(3).trim();
        const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
        renderedElements.push(
          <h4 key={`h4-${i}`} className="text-lg font-bold text-gray-800 flex items-center mb-1.5 mt-3">
            {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
          </h4>
        );
      } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
        const listItemText = lineContent.substring(2).trim();
        currentListItems.push(
          <li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />
        );
      } else {
        flushList(); 
        if (lineContent.trim() !== '') {
          renderedElements.push(
            <p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />
          );
        }
      }
    }
    flushList(); 
    return renderedElements;
  };

  if (isLogFormOpen && currentWorkoutForForm) {
    return (
      <WorkoutLogForm
        ai={ai}
        workout={currentWorkoutForForm}
        allWorkouts={workouts}
        logForReferenceOrEdit={currentWorkoutLog}
        isNewSession={isNewSessionForLog}
        onSaveLog={handleSaveLog}
        onClose={() => setIsLogFormOpen(false)}
        latestGoal={latestActiveGoal}
        participantProfile={participantProfile}
        latestStrengthStats={latestStrengthStats}
        myClubMemberships={myClubMemberships}
      />
    );
  }
  
  const strengthContent = (
      <div className="space-y-4 text-base text-gray-700">
          <p>Detta kort visar dina senaste registrerade maxlyft (1RM - Repetition Maximum).</p>
          <p><strong className="font-semibold">Flexibel Strength Score (FSS)</strong> är ett internt mått vi använder för att ge en snabb indikation på din relativa styrka, liknande andra poängsystem som Wilks-poäng. Vår FSS-poäng baseras på dina 1RM-resultat i knäböj, bänkpress, marklyft och axelpress, justerat för din kroppsvikt, ålder och kön. Poängen jämförs sedan med standardiserade styrkenivåer (från Otränad till Elit) för att ge dig en helhetsbild.</p>
      </div>
  );

  const conditioningContent = (
      <div className="space-y-4 text-base text-gray-700">
          <p>Detta kort visar dina senaste resultat från våra 4-minuters konditionstester.</p>
          <p>Syftet med testerna är att mäta din maximala arbetskapacitet över 4 minuter (din "maximala aeroba effekt"). Genom att göra om testerna med jämna mellanrum kan du se konkreta bevis på dina konditionsförbättringar.</p>
      </div>
  );

  const bodyContent = (
      <div className="space-y-4 text-base text-gray-700">
          <p>Detta kort visar dina senaste mätvärden från InBody-vågen. Värdena uppdateras när du fyller i dem under "Profil & Mål".</p>
          <p><strong className="font-semibold">InBody Score</strong> är ett helhetsbetyg på din kroppssammansättning, baserat på balansen mellan din muskel- och fettmassa. Ett högre värde (där 80+ anses vara mycket bra) indikerar generellt en hälsosammare komposition.</p>
      </div>
  );

  return (
    <div className="flex flex-col h-full">
      <FixedHeaderAndTools
        participantProfile={participantProfile}
        latestGoal={latestActiveGoal}
        allParticipantGoals={myParticipantGoals}
        userStrengthStats={myStrengthStats}
        userConditioningStatsHistory={myConditioningStats}
        participantGamificationStats={myGamificationStats}
        clubMemberships={myClubMemberships}
        onSaveProfileAndGoals={handleSaveProfileAndGoals}
        onSaveStrengthStats={handleSaveStrengthStats}
        onSaveConditioningStats={handleSaveConditioningStats}
        onSaveMentalWellbeing={handleSaveMentalWellbeing}
        onTriggerAiProgressFeedback={handleTriggerAiProgressFeedback}
        onTriggerAiGoalPrognosis={handleTriggerAiGoalPrognosis}
        mainContentRef={mainContentRef}
        currentRole={currentRole}
        onSetRole={onSetRole}
        leaderboardSettings={leaderboardSettings}
        onOpenLeaderboard={() => setIsLeaderboardModalOpen(true)}
      />
      <div ref={mainContentRef} className="container mx-auto px-2 sm:px-4 pt-4 flex-grow space-y-6">
        {isNewUser && (
            <WelcomeBanner />
        )}

        {/* New Compact Stats Section */}
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 animate-fade-in-down">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 text-center">
                <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-600">Veckans Mål</p>
                    {weeklyProgress ? (
                        <>
                            <p className="text-3xl font-bold text-flexibel">{weeklyProgress.completed} / {weeklyProgress.target}</p>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-flexibel h-2.5 rounded-full" style={{ width: `${weeklyProgress.percentage}%` }}></div>
                            </div>
                        </>
                    ) : <p className="text-base text-gray-400 mt-1">Sätt ett mål.</p>}
                </div>
                 <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-600">Totalt Antal Pass</p>
                    <p className="text-3xl font-bold text-gray-800">{(myGamificationStats?.migratedWorkoutCount || 0) + allActivityLogs.length}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-600">Nuvarande Streak</p>
                     <p className="text-3xl font-bold text-flexibel-orange"><span className="mr-1">🔥</span>{latestActiveGoal?.currentWeeklyStreak || 0}</p>
                </div>
                 <div className="space-y-1">
                    <p className="text-base font-semibold text-gray-600">Måluppfyllelse</p>
                    <GoalPaceIndicator goal={latestActiveGoal} logs={allActivityLogs} />
                </div>
            </div>
            {latestActiveGoal?.targetDate && latestActiveGoal.setDate && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                     <h4 className="text-base font-semibold text-gray-500 text-center mb-2">Tidslinje till Mål</h4>
                     <Timeline startDate={latestActiveGoal.setDate} targetDate={latestActiveGoal.targetDate} />
                </div>
            )}
        </div>

        {/* Re-introduced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-down">
             <SummaryCard 
                title={<span>Min Styrka <InfoIcon onClick={(e) => { e.stopPropagation(); setInfoModalContent({ title: 'Om Min Styrka', content: strengthContent }); setIsInfoModalOpen(true); }} ariaLabel="Läs mer om Min Styrka" /></span>} 
                icon={<span className="text-2xl" role="img" aria-label="Styrka">💪</span>}
                isInitiallyCollapsed={true}
                previewContent={flexibelStrengthScore ? 
                  <p>FSS: <strong className="text-flexibel">{flexibelStrengthScore.score.toFixed(1)}</strong></p> : 
                  <p>Ingen styrkedata.</p>}
            >
                <div className="space-y-3">
                    {latestStrengthStats ? (
                        <ul className="space-y-1 text-base">
                            {MAIN_LIFTS_CONFIG_HEADER.map(lift => {
                                const value = latestStrengthStats[lift.statKey];
                                return value ? <li key={lift.statKey}><strong>{lift.lift}:</strong> {value} kg</li> : null;
                            })}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-base">Inga 1RM har loggats. Klicka på knappen nedan för att lägga till din data.</p>
                    )}
                    <Button onClick={() => setIsStrengthModalOpen(true)} variant="outline" size="sm" fullWidth>Visa & Logga</Button>
                </div>
            </SummaryCard>
            
            <SummaryCard 
                title={<span>Min Kondition <InfoIcon onClick={(e) => { e.stopPropagation(); setInfoModalContent({ title: 'Om Min Kondition', content: conditioningContent }); setIsInfoModalOpen(true); }} ariaLabel="Läs mer om Min Kondition" /></span>}
                icon={<span className="text-2xl" role="img" aria-label="Kondition">💖</span>}
                isInitiallyCollapsed={true}
                 previewContent={latestConditioningValues?.airbike4MinKcal ?
                  <p>Airbike (4min): <strong className="text-flexibel">{latestConditioningValues.airbike4MinKcal.value} kcal</strong></p> : 
                  <p>Inga konditionstest loggade.</p>}
            >
                 <div className="space-y-3">
                    {latestConditioningValues ? (
                        <ul className="space-y-1 text-base">
                            {latestConditioningValues.airbike4MinKcal && <li><strong>Airbike (4min):</strong> {latestConditioningValues.airbike4MinKcal.value} kcal</li>}
                            {latestConditioningValues.skierg4MinMeters && <li><strong>SkiErg (4min):</strong> {latestConditioningValues.skierg4MinMeters.value} m</li>}
                            {latestConditioningValues.rower4MinMeters && <li><strong>Rodd (4min):</strong> {latestConditioningValues.rower4MinMeters.value} m</li>}
                            {latestConditioningValues.treadmill4MinMeters && <li><strong>Löpband (4min):</strong> {latestConditioningValues.treadmill4MinMeters.value} m</li>}
                            {latestConditioningValues.rower2000mTimeSeconds && <li><strong>Rodd (2000m):</strong> {Math.floor(Number(latestConditioningValues.rower2000mTimeSeconds.value) / 60)}min {Number(latestConditioningValues.rower2000mTimeSeconds.value) % 60}s</li>}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-base">Inga konditionstest har loggats. Klicka på knappen nedan för att lägga till din data.</p>
                    )}
                     <Button onClick={() => setIsConditioningModalOpen(true)} variant="outline" size="sm" fullWidth>Visa & Logga</Button>
                </div>
            </SummaryCard>
            
            <SummaryCard 
                title={<span>Min Kropp (InBody) <InfoIcon onClick={(e) => { e.stopPropagation(); setInfoModalContent({ title: 'Om Min Kropp', content: bodyContent }); setIsInfoModalOpen(true); }} ariaLabel="Läs mer om Min Kropp" /></span>}
                icon={<span className="text-2xl" role="img" aria-label="Kropp">🧬</span>}
                isInitiallyCollapsed={true}
                previewContent={participantProfile?.inbodyScore ? 
                  <p>Senaste poäng: <strong className="text-flexibel">{participantProfile.inbodyScore}</strong></p> : 
                  <p>Ingen InBody-data.</p>}
            >
                <div className="space-y-3">
                    {participantProfile?.inbodyScore || participantProfile?.bodyweightKg ? (
                        <ul className="space-y-1 text-base">
                            {participantProfile.bodyweightKg && <li><strong>Kroppsvikt:</strong> {participantProfile.bodyweightKg.toLocaleString('sv-SE')} kg</li>}
                            {participantProfile.inbodyScore && <li><strong>Poäng:</strong> {participantProfile.inbodyScore}</li>}
                            {participantProfile.muscleMassKg && <li><strong>Muskelmassa:</strong> {participantProfile.muscleMassKg.toLocaleString('sv-SE')} kg</li>}
                            {participantProfile.fatMassKg && <li><strong>Fettmassa:</strong> {participantProfile.fatMassKg.toLocaleString('sv-SE')} kg</li>}
                            <li className="text-xs text-gray-500 pt-1">Senast uppdaterad: {new Date(participantProfile.lastUpdated).toLocaleDateString('sv-SE')}</li>
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-base">Ingen data har loggats. Klicka på knappen nedan för att lägga till din data.</p>
                    )}
                    <Button onClick={() => setIsPhysiqueModalOpen(true)} variant="outline" size="sm" fullWidth>Visa & Logga</Button>
                </div>
            </SummaryCard>

            <SummaryCard 
                title="AI Coach Recept" 
                icon={<span className="text-2xl" role="img" aria-label="AI Coach">🤖</span>} 
                isInitiallyCollapsed={true} 
                cardClassName="bg-violet-50 border-violet-200"
            >
                {latestActiveGoal?.aiPrognosis ? (
                     <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                        {renderAiPrognosis(latestActiveGoal.aiPrognosis)}
                     </div>
                ) : (
                     <p className="text-gray-500">Sätt ett nytt mål under "Profil & Mål" för att få ett personligt recept från AI-coachen!</p>
                )}
            </SummaryCard>
        </div>

         <div className="mt-6 animate-fade-in-down">
            <ParticipantActivityView 
                allActivityLogs={allActivityLogs} 
                workouts={workouts}
                onViewLogSummary={handleViewLogSummary}
                onDeleteActivity={handleDeleteActivity}
                activeGoal={latestActiveGoal}
                strengthStatsHistory={myStrengthStats}
                conditioningStatsHistory={myConditioningStats}
                clubMemberships={myClubMemberships}
                participantProfile={participantProfile}
                leaderboardSettings={leaderboardSettings}
                allParticipantGoals={myParticipantGoals}
                coachEvents={coachEvents}
            />
        </div>
      </div>
      
      {/* Modals that can be triggered from this area */}
      <AIProgressFeedbackModal
        isOpen={isAiFeedbackModalOpen}
        onClose={() => {
            setIsAiFeedbackModalOpen(false);
            const FEEDBACK_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
            setLastFeedbackPromptTime(Date.now() + FEEDBACK_COOLDOWN_MS);
        }}
        isLoading={isLoadingAiFeedback}
        aiFeedback={aiFeedback}
        error={aiFeedbackError}
        modalTitle={currentAiModalTitle}
      />
      <PostWorkoutSummaryModal
        isOpen={isPostWorkoutSummaryModalOpen}
        onFinalize={handleFinalizePostWorkoutSummary}
        log={logForSummaryModal}
        workout={workoutForSummaryModal}
        onEditLog={handleEditLogFromSummary}
      />
      <LogGeneralActivityModal
        isOpen={isLogGeneralActivityModalOpen}
        onClose={() => setIsLogGeneralActivityModalOpen(false)}
        onSaveActivity={handleSaveGeneralActivity}
      />
      <GeneralActivitySummaryModal
        isOpen={isGeneralActivitySummaryOpen}
        onClose={() => setIsGeneralActivitySummaryOpen(false)}
        activity={lastGeneralActivity}
      />
      <SelectWorkoutModal
        isOpen={isSelectWorkoutModalOpen}
        onClose={() => setIsSelectWorkoutModalOpen(false)}
        workouts={workouts.filter(w => w.isPublished)}
        onStartWorkout={handleStartWorkout}
        categoryFilter={workoutCategoryFilter}
      />
      <ExerciseSelectionModal
        isOpen={isExerciseSelectionModalOpen}
        onClose={() => {
          setIsExerciseSelectionModalOpen(false);
          setWorkoutForExerciseSelection(null);
        }}
        options={workoutForExerciseSelection?.exerciseSelectionOptions}
        onConfirm={handleExerciseSelectionConfirm}
      />
      <MentalWellbeingModal 
        isOpen={isMentalCheckinOpen}
        onClose={() => setIsMentalCheckinOpen(false)}
        currentWellbeing={myMentalWellbeing}
        participantId={participantProfile?.id}
        onSave={handleSaveMentalWellbeing}
      />
       <ProfileGoalModal
          isOpen={isProfileGoalModalOpen}
          onClose={() => setIsProfileGoalModalOpen(false)}
          currentProfile={participantProfile}
          currentGoalForForm={latestActiveGoal}
          allParticipantGoals={myParticipantGoals}
          participantGamificationStats={myGamificationStats}
          onSave={handleSaveProfileAndGoals}
          onTriggerAiGoalPrognosis={handleTriggerAiGoalPrognosis}
        />
       <StrengthComparisonModal
          isOpen={isStrengthModalOpen}
          onClose={() => setIsStrengthModalOpen(false)}
          participantProfile={participantProfile}
          latestGoal={latestActiveGoal}
          userStrengthStatsHistory={myStrengthStats}
          clubMemberships={myClubMemberships}
          onSaveStrengthStats={handleSaveStrengthStats}
        />
       <ConditioningStatsModal
          isOpen={isConditioningModalOpen}
          onClose={() => setIsConditioningModalOpen(false)}
          statsHistory={myConditioningStats}
          participantProfile={participantProfile}
          clubMemberships={myClubMemberships}
          onSaveStats={handleSaveConditioningStats}
        />
      <PhysiqueManagerModal
        isOpen={isPhysiqueModalOpen}
        onClose={() => setIsPhysiqueModalOpen(false)}
        currentProfile={participantProfile}
        onSave={handleSavePhysique}
      />

      <FeedbackPromptToast 
        isOpen={showFeedbackPrompt}
        onAccept={() => {
            setShowFeedbackPrompt(false);
            handleTriggerAiProgressFeedback();
        }}
        onDecline={() => setShowFeedbackPrompt(false)}
        message="Vill du ha en snabb AI-analys av dina senaste framsteg?"
      />

       <InfoModal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            title={infoModalContent.title}
        >
            {infoModalContent.content}
        </InfoModal>

        <ParticipantLeaderboardModal
            isOpen={isLeaderboardModalOpen}
            onClose={() => setIsLeaderboardModalOpen(false)}
            currentParticipantId={currentParticipantId}
            participants={optedInParticipants}
            allActivityLogs={allActivityLogsForLeaderboard}
            userStrengthStats={userStrengthStats}
            clubMemberships={clubMemberships}
            leaderboardSettings={leaderboardSettings}
        />

      <FabMenu 
        onSelectWorkoutCategory={(category) => {
          setWorkoutCategoryFilter(category);
          setIsSelectWorkoutModalOpen(true);
        }}
        onOpenLogGeneralActivityModal={() => setIsLogGeneralActivityModalOpen(true)}
        availableCategories={availableCategoriesForFab}
      />
    </div>
  );
};