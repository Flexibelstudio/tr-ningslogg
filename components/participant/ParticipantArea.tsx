




import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog, ActivityLog,
    ParticipantGoalData, ParticipantProfile,
    UserStrengthStat, ParticipantConditioningStat,
    UserRole, ParticipantMentalWellbeing, Exercise, GoalCompletionLog, ParticipantGamificationStats, WorkoutCategory, PostWorkoutSummaryData, NewPB, ParticipantClubMembership, LeaderboardSettings, CoachEvent, GenderOption, Connection, Reaction, Comment, NewBaseline, ParticipantPhysiqueStat, LiftType, Location, Membership, StaffMember, OneOnOneSession, IntegrationSettings,
    GroupClassDefinition, GroupClassSchedule, ParticipantBooking, WorkoutCategoryDefinition
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
    LEVEL_COLORS_HEADER, MAIN_LIFTS_CONFIG_HEADER, MOOD_OPTIONS
} from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { FixedHeaderAndTools } from './FixedHeaderAndTools';
import { calculateFlexibelStrengthScoreInternal, getFssScoreInterpretation as getFssScoreInterpretationFromTool } from './StrengthComparisonTool';
import { FeedbackPromptToast } from './FeedbackPromptToast';
import { InfoModal } from './InfoModal';
import { FabMenu } from './FabMenu';
import { SelectWorkoutModal } from './SelectWorkoutModal';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { MentalWellbeingModal } from './MentalWellbeingModal';
import { ProfileModal } from './ProfileGoalModal';
import { GoalModal } from './ParticipantGoalSettingModal';
import { ALL_PASS_INFO, DetailedPassInformation } from './passDescriptions';
import { StrengthComparisonModal } from './StrengthComparisonModal';
import { ConditioningStatsModal } from './ConditioningStatsModal';
import { PhysiqueManagerModal } from './PhysiqueManagerModal';
import { CommunityModal } from './CommunityModal';
import { UpcomingMeetingCard } from './UpcomingMeetingCard';
import { MeetingDetailsModal } from './MeetingDetailsModal';
import { UpgradeModal } from './UpgradeModal';
import { BookingView } from './BookingView';
import { QrScannerModal } from './QrScannerModal';
import { CheckinConfirmationModal } from './CheckinConfirmationModal';


const API_KEY = process.env.API_KEY;

// Helper function to render AI Markdown content
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
  return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>;
};

const renderFormattedMarkdown = (feedback: string | null): JSX.Element[] | null => {
  if (!feedback) return null;
  const lines = feedback.split('\n');
  const renderedElements: JSX.Element[] = [];
  let currentListItems: JSX.Element[] = [];
  let listKeySuffix = 0;
  const flushList = () => {
    if (currentListItems.length > 0) {
      renderedElements.push(<ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">{currentListItems}</ul>);
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
      renderedElements.push(<h4 key={`h4-${i}`} className="text-xl font-bold text-gray-800 flex items-center mb-2 mt-4">{icon} <span dangerouslySetInnerHTML={{ __html: headerText }} /></h4>);
    } else if (lineContent.startsWith('### ')) {
      flushList();
      const headerText = lineContent.substring(4).trim();
      const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
      renderedElements.push(<h5 key={`h5-${i}`} className="text-lg font-bold text-gray-700 flex items-center mb-1 mt-3">{icon} <span dangerouslySetInnerHTML={{ __html: headerText }} /></h5>);
    } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
      const listItemText = lineContent.substring(2).trim();
      currentListItems.push(<li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />);
    } else {
      flushList();
      if (lineContent.trim() !== '') {
        renderedElements.push(<p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />);
      }
    }
  }
  flushList();
  return renderedElements;
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

    const e1RM = weight / (1.0278 - (0.0278 * reps));

    if (e1RM < weight) {
        return null;
    }

    return (Math.round(e1RM * 2) / 2);
};

const getInBodyScoreInterpretation = (score: number | undefined | null): { label: string; color: string; } | null => {
    if (score === undefined || score === null || isNaN(score)) return null;
    if (score >= 90) return { label: 'Utmärkt', color: '#14b8a6' }; // teal-500
    if (score >= 80) return { label: 'Bra', color: '#22c55e' };      // green-500
    if (score >= 70) return { label: 'Medel', color: '#f97316' };     // orange-500
    return { label: 'Under Medel', color: '#ef4444' };     // red-500
};

// Redesigned Card components
const StatCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: React.ReactNode; subValueColor?: string; }> = ({ title, value, subValue, icon, subValueColor }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-flexibel/10 text-flexibel mr-4">
            {icon}
        </div>
        <div className="flex-grow min-w-0">
            <p className="text-base font-medium text-gray-500 leading-tight">{title}</p>
            <div className="flex items-baseline gap-x-2 flex-wrap">
                <p className="text-3xl sm:text-4xl font-bold text-gray-800">{value}</p>
                {subValue && <p className="text-sm sm:text-base font-bold" style={{ color: subValueColor || '#9ca3af' }}>{subValue}</p>}
            </div>
        </div>
    </div>
);

const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, description, icon, onClick }) => (
    <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-left w-full hover:shadow-md hover:border-flexibel transition-all duration-200 group">
        <div className="flex items-center justify-between">
            <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100 text-flexibel mr-4 group-hover:bg-flexibel/10 transition-colors">
                    {icon}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    <p className="text-base text-gray-500">{description}</p>
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-flexibel transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
    </button>
);


const WeeklyGoalCard: React.FC<{ progress: { completed: number; target: number; percentage: number; } | null }> = ({ progress }) => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = progress ? circumference - (progress.percentage / 100) * circumference : circumference;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 flex-shrink-0">
                <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle className="text-gray-200" strokeWidth="12" stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
                    <circle
                        className="text-flexibel"
                        strokeWidth="12"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r={radius}
                        cx="60"
                        cy="60"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {progress ? (
                        <>
                            <span className="text-3xl font-bold text-gray-800">{progress.completed}</span>
                            <span className="text-base font-medium text-gray-500">/ {progress.target} pass</span>
                        </>
                    ) : (
                        <span className="text-3xl font-bold text-gray-400">-</span>
                    )}
                </div>
            </div>
            <div className="text-center sm:text-left">
                <h3 className="text-2xl font-bold text-gray-800">Veckans Mål</h3>
                {progress ? (
                    <p className="text-lg text-gray-600">Du är på god väg! Fortsätt med den goda vanan.</p>
                ) : (
                    <p className="text-lg text-gray-600">Sätt ett veckomål i din profil för att följa din progress här.</p>
                )}
            </div>
        </div>
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
  participantPhysiqueHistory: ParticipantPhysiqueStat[];
  setParticipantPhysiqueHistory: (history: ParticipantPhysiqueStat[] | ((prev: ParticipantPhysiqueStat[]) => ParticipantPhysiqueStat[])) => void;
  participantMentalWellbeing: ParticipantMentalWellbeing[];
  setParticipantMentalWellbeing: (wellbeing: ParticipantMentalWellbeing[] | ((prev: ParticipantMentalWellbeing[]) => ParticipantMentalWellbeing[])) => void;
  participantGamificationStats: ParticipantGamificationStats[];
  setParticipantGamificationStats: (stats: ParticipantGamificationStats[] | ((prev: ParticipantGamificationStats[]) => ParticipantGamificationStats[])) => void;
  
  clubMemberships: ParticipantClubMembership[];
  leaderboardSettings: LeaderboardSettings;
  coachEvents: CoachEvent[];
  connections: Connection[];
  setConnections: (connections: Connection[] | ((prev: Connection[]) => Connection[])) => void;
  lastFlowViewTimestamp: string | null;
  setLastFlowViewTimestamp: (timestamp: string | null | ((prev: string | null) => string | null)) => void;
  locations: Location[];
  memberships: Membership[];
  staffMembers: StaffMember[];
  oneOnOneSessions: OneOnOneSession[];
  workoutCategories: WorkoutCategoryDefinition[];

  currentRole: UserRole | null;
  onSetRole: (role: UserRole | null) => void;
  onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
  integrationSettings: IntegrationSettings;
  groupClassSchedules: GroupClassSchedule[];
  groupClassDefinitions: GroupClassDefinition[];
  allParticipantBookings: ParticipantBooking[];
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onCheckInParticipant: (bookingId: string) => void;
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
  participantPhysiqueHistory,
  setParticipantPhysiqueHistory,
  participantMentalWellbeing,
  setParticipantMentalWellbeing,
  participantGamificationStats,
  setParticipantGamificationStats,
  
  clubMemberships,
  leaderboardSettings,
  coachEvents,
  connections,
  setConnections,
  lastFlowViewTimestamp,
  setLastFlowViewTimestamp,
  locations,
  memberships,
  staffMembers,
  oneOnOneSessions,
  workoutCategories,

  currentRole,
  onSetRole,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  openProfileModalOnInit,
  onProfileModalOpened,
  isStaffViewingSelf,
  onSwitchToStaffView,
  integrationSettings,
  groupClassSchedules,
  groupClassDefinitions,
  allParticipantBookings,
  onBookClass,
  onCancelBooking,
  onCheckInParticipant,
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
  const [isAiReceptModalOpen, setIsAiReceptModalOpen] = useState(false);


  const [isPostWorkoutSummaryModalOpen, setIsPostWorkoutSummaryModalOpen] = useState(false);
  const [logForSummaryModal, setLogForSummaryModal] = useState<WorkoutLog | null>(null);
  const [workoutForSummaryModal, setWorkoutForSummaryModal] = useState<Workout | null>(null);

  const [isLogGeneralActivityModalOpen, setIsLogGeneralActivityModalOpen] = useState(false);
  const [isGeneralActivitySummaryOpen, setIsGeneralActivitySummaryOpen] = useState(false);
  const [lastGeneralActivity, setLastGeneralActivity] = useState<GeneralActivityLog | null>(null);
  
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isSelectWorkoutModalOpen, setIsSelectWorkoutModalOpen] = useState(false);
  const [workoutCategoryFilter, setWorkoutCategoryFilter] = useState<WorkoutCategory | undefined>(undefined);
  const [isExerciseSelectionModalOpen, setIsExerciseSelectionModalOpen] = useState(false);
  const [workoutForExerciseSelection, setWorkoutForExerciseSelection] = useState<Workout | null>(null);

  const [isMentalCheckinOpen, setIsMentalCheckinOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isStrengthModalOpen, setIsStrengthModalOpen] = useState(false);
  const [isConditioningModalOpen, setIsConditioningModalOpen] = useState(false);
  const [isPhysiqueModalOpen, setIsPhysiqueModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState<boolean>(false);


  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<OneOnOneSession | null>(null);
  const [showMeetingToast, setShowMeetingToast] = useState(false);


  const mainContentRef = useRef<HTMLDivElement>(null);

  const handleDeleteActivity = (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => {
    if (activityType === 'workout') {
        setWorkoutLogs(prev => prev.filter(log => log.id !== activityId));
    } else if (activityType === 'general') {
        setGeneralActivityLogs(prev => prev.filter(log => log.id !== activityId));
    } else if (activityType === 'goal_completion') {
        setGoalCompletionLogs(prev => prev.filter(log => log.id !== activityId));
    }
  };

  const handleEditLog = (logToEdit: ActivityLog) => {
    if (isLogFormOpen) return;

    if (logToEdit.type === 'workout') {
      const workoutLog = logToEdit as WorkoutLog;
      const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);

      if (!workoutTemplate && !workoutLog.selectedExercisesForModifiable) {
        alert("Kunde inte hitta passmallen för denna logg och ingen anpassad struktur är sparad. Redigering är inte möjlig.");
        return;
      }
      
      if (workoutLog.selectedExercisesForModifiable && workoutLog.selectedExercisesForModifiable.length > 0) {
        const workoutForForm: Workout = {
            id: workoutLog.workoutId,
            title: workoutTemplate?.title || 'Anpassat Pass',
            category: workoutTemplate?.category || 'Annat',
            isPublished: false,
            isModifiable: true,
            blocks: [{ id: crypto.randomUUID(), name: "Valda Övningar", exercises: workoutLog.selectedExercisesForModifiable }]
        };
        handleStartWorkout(workoutForForm, true, workoutLog);
      } else if (workoutTemplate) {
        handleStartWorkout(workoutTemplate, true, workoutLog);
      } else {
        console.error("Logikfel i handleEditLog: Varken mall eller sparade övningar hittades.");
      }
    } else if (logToEdit.type === 'general') {
      setLastGeneralActivity(logToEdit as GeneralActivityLog);
      setIsGeneralActivitySummaryOpen(true);
    }
  };
  
  // Memoized data for the current participant
  const participantProfile = useMemo(() => participantDirectory.find(p => p.id === currentParticipantId), [participantDirectory, currentParticipantId]);
  const myWorkoutLogs = useMemo(() => workoutLogs.filter(l => l.participantId === currentParticipantId), [workoutLogs, currentParticipantId]);
  const myGeneralActivityLogs = useMemo(() => generalActivityLogs.filter(l => l.participantId === currentParticipantId), [generalActivityLogs, currentParticipantId]);
  const myGoalCompletionLogs = useMemo(() => goalCompletionLogs.filter(g => g.participantId === currentParticipantId), [goalCompletionLogs, currentParticipantId]);
  const myParticipantGoals = useMemo(() => participantGoals.filter(g => g.participantId === currentParticipantId), [participantGoals, currentParticipantId]);
  const myStrengthStats = useMemo(() => userStrengthStats.filter(s => s.participantId === currentParticipantId), [userStrengthStats, currentParticipantId]);
  const myConditioningStats = useMemo(() => userConditioningStatsHistory.filter(s => s.participantId === currentParticipantId), [userConditioningStatsHistory, currentParticipantId]);
  const myPhysiqueHistory = useMemo(() => participantPhysiqueHistory.filter(s => s.participantId === currentParticipantId), [participantPhysiqueHistory, currentParticipantId]);
  const myMentalWellbeing = useMemo(() => participantMentalWellbeing.find(w => w.id === currentParticipantId), [participantMentalWellbeing, currentParticipantId]);
  const myGamificationStats = useMemo(() => participantGamificationStats.find(s => s.id === currentParticipantId), [participantGamificationStats, currentParticipantId]);
  const myClubMemberships = useMemo(() => clubMemberships.filter(c => c.participantId === currentParticipantId), [clubMemberships, currentParticipantId]);
  const myMembership = useMemo(() => memberships.find(m => m.id === participantProfile?.membershipId), [memberships, participantProfile]);
  const myOneOnOneSessions = useMemo(() => oneOnOneSessions.filter(s => s.participantId === currentParticipantId), [oneOnOneSessions, currentParticipantId]);
  
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
        setIsProfileModalOpen(true);
        onProfileModalOpened();
    }
  }, [openProfileModalOnInit, onProfileModalOpened]);

  const myUpcomingSessions = useMemo(() => {
    return myOneOnOneSessions
      .filter(s => s.status === 'scheduled' && new Date(s.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [myOneOnOneSessions]);

  useEffect(() => {
    const todaysMeetings = myUpcomingSessions.filter(s => dateUtils.isSameDay(new Date(s.startTime), new Date()));
    if (todaysMeetings.length > 0 && !sessionStorage.getItem('flexibel_meetingToastShown')) {
        setShowMeetingToast(true);
        sessionStorage.setItem('flexibel_meetingToastShown', 'true');
    }
  }, [myUpcomingSessions]);

  const allActivityLogs = useMemo<ActivityLog[]>(() => {
    return [...myWorkoutLogs, ...myGeneralActivityLogs, ...myGoalCompletionLogs].sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
  }, [myWorkoutLogs, myGeneralActivityLogs, myGoalCompletionLogs]);

  const allActivityLogsForLeaderboard = useMemo<ActivityLog[]>(() => {
    return [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];
  }, [workoutLogs, generalActivityLogs, goalCompletionLogs]);

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
    if (!myConditioningStats || myConditioningStats.length === 0) return { airbike4MinKcal: null, skierg4MinMeters: null, rower4MinMeters: null, rower2000mTimeSeconds: null, treadmill4MinMeters: null };

    const findLastValue = (key: keyof Omit<ParticipantConditioningStat, 'id'|'lastUpdated'|'participantId'>): {value: string, date: string} | null => {
        const sorted = [...myConditioningStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        for(const stat of sorted) {
            const statValue = stat[key];
            if (statValue !== undefined && statValue !== null) {
                return { value: String(statValue), date: stat.lastUpdated };
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
  
  const latestPhysique = useMemo(() => {
      if (myPhysiqueHistory.length === 0) return null;
      return [...myPhysiqueHistory].sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
  }, [myPhysiqueHistory]);


  const flexibelStrengthScore = useMemo(() => {
    if (latestStrengthStats && participantProfile) {
        return calculateFlexibelStrengthScoreInternal(latestStrengthStats, participantProfile)?.totalScore;
    }
    return null;
  }, [latestStrengthStats, participantProfile]);

  const fssScoreInterpretation = getFssScoreInterpretationFromTool(flexibelStrengthScore);

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
    const summary = calculatePostWorkoutSummary(logWithParticipantId, workouts, latestStrengthStats);
    const logWithSummary = logWithParticipantId.entries.length > 0
        ? { ...logWithParticipantId, postWorkoutSummary: summary }
        : logWithParticipantId;

    // Check for new 1RMs from the workout log and update strength stats
    let statsToUpdate: Partial<UserStrengthStat> = latestStrengthStats ? { ...latestStrengthStats } : {};
    let needsUpdate = false;
    
    const workoutTemplate = workouts.find(w => w.id === logWithParticipantId.workoutId);
    if (workoutTemplate && logWithParticipantId.entries.length > 0) {
        const allExercisesInTemplate = (logWithParticipantId.selectedExercisesForModifiable && logWithParticipantId.selectedExercisesForModifiable.length > 0)
            ? logWithParticipantId.selectedExercisesForModifiable
            : workoutTemplate.blocks.flatMap(b => b.exercises);

        logWithParticipantId.entries.forEach(entry => {
            const exerciseDetail = allExercisesInTemplate.find(ex => ex.id === entry.exerciseId);
            if (!exerciseDetail) return;
            const liftType = exerciseDetail.name as LiftType;

            if (liftType === 'Knäböj' || liftType === 'Bänkpress' || liftType === 'Marklyft' || liftType === 'Axelpress') {
                let bestE1RMInLog = 0;
                entry.loggedSets.forEach(set => {
                    if (set.isCompleted && set.weight !== undefined && set.reps !== undefined) {
                        const e1RM = calculateEstimated1RM(set.weight, set.reps);
                        if (e1RM && e1RM > bestE1RMInLog) {
                            bestE1RMInLog = e1RM;
                        }
                    }
                });

                if (bestE1RMInLog > 0) {
                    if (liftType === 'Knäböj' && bestE1RMInLog > (statsToUpdate.squat1RMaxKg || 0)) {
                        statsToUpdate.squat1RMaxKg = bestE1RMInLog;
                        needsUpdate = true;
                    } else if (liftType === 'Bänkpress' && bestE1RMInLog > (statsToUpdate.benchPress1RMaxKg || 0)) {
                        statsToUpdate.benchPress1RMaxKg = bestE1RMInLog;
                        needsUpdate = true;
                    } else if (liftType === 'Marklyft' && bestE1RMInLog > (statsToUpdate.deadlift1RMaxKg || 0)) {
                        statsToUpdate.deadlift1RMaxKg = bestE1RMInLog;
                        needsUpdate = true;
                    } else if (liftType === 'Axelpress' && bestE1RMInLog > (statsToUpdate.overheadPress1RMaxKg || 0)) {
                        statsToUpdate.overheadPress1RMaxKg = bestE1RMInLog;
                        needsUpdate = true;
                    }
                }
            }
        });
    }

    if (needsUpdate) {
        const newStatRecord: UserStrengthStat = {
            id: crypto.randomUUID(),
            participantId: participantProfile.id,
            lastUpdated: new Date().toISOString(),
            bodyweightKg: latestStrengthStats?.bodyweightKg || participantProfile.bodyweightKg,
            squat1RMaxKg: statsToUpdate.squat1RMaxKg,
            benchPress1RMaxKg: statsToUpdate.benchPress1RMaxKg,
            deadlift1RMaxKg: statsToUpdate.deadlift1RMaxKg,
            overheadPress1RMaxKg: statsToUpdate.overheadPress1RMaxKg,
        };
        setUserStrengthStats(prev => [...prev, newStatRecord]);
    }


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

  const calculatePostWorkoutSummary = (log: WorkoutLog, allWorkouts: Workout[], latestStrengthStats: UserStrengthStat | null): PostWorkoutSummaryData => {
    let totalWeightLifted = 0;
    const bodyweightRepsSummary: { exerciseName: string; totalReps: number }[] = [];
    const newPBs: NewPB[] = [];
    const newBaselines: NewBaseline[] = [];

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
      let totalRepsForThisBodyweightExercise = 0;

      let bestSetForE1RM = { weight: 0, reps: 0 };
      let bestE1RMForExercise = 0;

      const isEffectivelyBodyweight = exerciseDetail.isBodyweight || entry.loggedSets.every(s => s.weight === undefined || s.weight === null || s.weight === 0);

      entry.loggedSets.forEach(set => {
        const reps = typeof set.reps === 'number' ? set.reps : 0;
        const weight = typeof set.weight === 'number' ? set.weight : 0;
        const distance = typeof set.distanceMeters === 'number' ? set.distanceMeters : 0;
        const calories = typeof set.caloriesKcal === 'number' ? set.caloriesKcal : 0;

        if (set.isCompleted) {
            if (isEffectivelyBodyweight) {
                totalRepsForThisBodyweightExercise += reps;
            } else if (reps > 0 && weight > 0) {
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
            
             // E1RM calculation for main lifts
            if (['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'].includes(exerciseDetail.name)) {
                const e1RM = calculateEstimated1RM(set.weight, set.reps);
                if (e1RM && e1RM > bestE1RMForExercise) {
                    bestE1RMForExercise = e1RM;
                    bestSetForE1RM = { weight, reps };
                }
            }
        }
      });

      if (isEffectivelyBodyweight && totalRepsForThisBodyweightExercise > 0) {
        bodyweightRepsSummary.push({
            exerciseName: exerciseDetail.name,
            totalReps: totalRepsForThisBodyweightExercise,
        });
      }

      // Find historic 1RM from Strength page
      let historic1RMFromStrengthPage = 0;
      if (latestStrengthStats && exerciseDetail.name) {
          const liftName = exerciseDetail.name as LiftType;
          switch (liftName) {
              case 'Knäböj': historic1RMFromStrengthPage = latestStrengthStats.squat1RMaxKg || 0; break;
              case 'Bänkpress': historic1RMFromStrengthPage = latestStrengthStats.benchPress1RMaxKg || 0; break;
              case 'Marklyft': historic1RMFromStrengthPage = latestStrengthStats.deadlift1RMaxKg || 0; break;
              case 'Axelpress': historic1RMFromStrengthPage = latestStrengthStats.overheadPress1RMaxKg || 0; break;
          }
      }

      // Find historic max from previous workout LOGS
      const previousLogsForThisExercise = myWorkoutLogs
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

      let historicMaxWeightFromLogs = 0;
      let historicMaxRepsAtThatWeight = 0;
      let historicMaxRepsOverall = 0;
      let historicMaxDistance = 0;
      let historicMaxCalories = 0;
      let historicE1RMFromLogs = 0;

      previousLogsForThisExercise.forEach(prevEntry => {
        prevEntry.loggedSets.forEach(prevSet => {
          const prevWeight = typeof prevSet.weight === 'number' ? prevSet.weight : 0;
          const prevReps = typeof prevSet.reps === 'number' ? prevSet.reps : 0;
          const prevDistance = typeof prevSet.distanceMeters === 'number' ? prevSet.distanceMeters : 0;
          const prevCalories = typeof prevSet.caloriesKcal === 'number' ? prevSet.caloriesKcal : 0;

          if (prevSet.isCompleted) {
            if (prevWeight > historicMaxWeightFromLogs) {
              historicMaxWeightFromLogs = prevWeight;
              historicMaxRepsAtThatWeight = prevReps;
            } else if (prevWeight === historicMaxWeightFromLogs && prevReps > historicMaxRepsAtThatWeight) {
              historicMaxRepsAtThatWeight = prevReps;
            }
            if (prevReps > historicMaxRepsOverall) {
              historicMaxRepsOverall = prevReps;
            }
            if (prevDistance > historicMaxDistance) historicMaxDistance = prevDistance;
            if (prevCalories > historicMaxCalories) historicMaxCalories = prevCalories;
            
            const historicE1RM = calculateEstimated1RM(prevSet.weight, prevSet.reps);
            if (historicE1RM && historicE1RM > historicE1RMFromLogs) {
                historicE1RMFromLogs = historicE1RM;
            }
          }
        });
      });
      
      const hasHistory = previousLogsForThisExercise.length > 0 || historic1RMFromStrengthPage > 0;

      if (!hasHistory) {
        let baselineValue = '';
        if (maxWeightForExercise > 0) {
            baselineValue = `${maxWeightForExercise} kg x ${maxRepsAtMaxWeight} reps`;
        } else if (maxRepsOverall > 0) {
            baselineValue = `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`;
        } else if (maxDistance > 0) {
            baselineValue = `${maxDistance} m`;
        } else if (maxCalories > 0) {
            baselineValue = `${maxCalories} kcal`;
        }

        if (baselineValue) {
          newBaselines.push({
            exerciseName: exerciseDetail.name,
            value: baselineValue
          });
        }
      } else {
          const trueHistoricBestE1RM = Math.max(historicE1RMFromLogs, historic1RMFromStrengthPage);
          if (bestE1RMForExercise > trueHistoricBestE1RM) {
              newPBs.push({ 
                exerciseName: exerciseDetail.name, 
                achievement: "Nytt PB i vikt!", 
                value: `${bestSetForE1RM.weight} kg x ${bestSetForE1RM.reps} reps`,
                previousBest: trueHistoricBestE1RM > 0 ? `(tidigare ${trueHistoricBestE1RM.toFixed(1)} kg)` : undefined,
                baseLiftType: exerciseDetail.baseLiftType
              });
          }
          
          if (maxRepsOverall > 0 && maxRepsOverall > historicMaxRepsOverall && 
              !newPBs.some(pb => pb.exerciseName === exerciseDetail.name)) { // Avoid duplicate PBs for the same exercise
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i reps!", 
              value: `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`,
              previousBest: historicMaxRepsOverall > 0 ? `(tidigare ${historicMaxRepsOverall} reps)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }

          if (maxDistance > 0 && maxDistance > historicMaxDistance) {
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i distans!", 
              value: `${maxDistance} m`,
              previousBest: historicMaxDistance > 0 ? `(tidigare ${historicMaxDistance} m)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }
          if (maxCalories > 0 && maxCalories > historicMaxCalories) {
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i kalorier!", 
              value: `${maxCalories} kcal`,
              previousBest: historicMaxCalories > 0 ? `(tidigare ${historicMaxCalories} kcal)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }
      }
    });

    let animalEquivalent;
    const maxCount = 150;
    const minWeightKgForItem = totalWeightLifted > 0 ? totalWeightLifted / maxCount : 0;

    const candidateComparisons = WEIGHT_COMPARISONS.filter(item =>
        item.weightKg > 0 &&
        totalWeightLifted >= item.weightKg &&
        item.weightKg >= minWeightKgForItem
    );

    if (candidateComparisons.length > 0) {
        const randomItem = candidateComparisons[Math.floor(Math.random() * candidateComparisons.length)];
        const count = Math.floor(totalWeightLifted / randomItem.weightKg);

        if (count > 0) {
          animalEquivalent = {
              name: randomItem.name,
              count: count,
              unitName: count === 1 ? randomItem.name : (randomItem.pluralName || randomItem.name),
              emoji: randomItem.emoji,
          };
        }
    } else if (totalWeightLifted > 0) {
        const sortedWeightComparisons = [...WEIGHT_COMPARISONS].sort((a, b) => a.weightKg - b.weightKg);
        for (let i = sortedWeightComparisons.length - 1; i >= 0; i--) {
            const item = sortedWeightComparisons[i];
            if (totalWeightLifted >= item.weightKg && item.weightKg > 0) {
                const count = Math.floor(totalWeightLifted / item.weightKg);
                 if (count > 0) {
                    animalEquivalent = {
                        name: item.name,
                        count: count,
                        unitName: count === 1 ? item.name : (item.pluralName || item.name),
                        emoji: item.emoji,
                    };
                    break;
                 }
            }
        }
    }

    return { totalWeightLifted, newPBs, newBaselines, animalEquivalent, bodyweightRepsSummary };
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

    const handleSaveProfile = (
        profileData: Partial<Pick<ParticipantProfile, 'name' | 'age' | 'gender' | 'enableLeaderboardParticipation' | 'isSearchable' | 'locationId' | 'enableInBodySharing'>>
    ) => {
        setParticipantDirectory(prev => prev.map(p => 
            p.id === currentParticipantId 
            ? { ...p, ...profileData, id: currentParticipantId, lastUpdated: new Date().toISOString() } 
            : p
        ));
    };
    
    const handleSaveGoals = (
        goalData: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>,
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean
    ) => {
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

        const previousGoal = latestActiveGoal;
        const goalHasChanged = !previousGoal || 
                               markLatestGoalAsCompleted ||
                               previousGoal.fitnessGoals !== goalData.fitnessGoals ||
                               previousGoal.workoutsPerWeekTarget !== goalData.workoutsPerWeekTarget ||
                               previousGoal.targetDate !== goalData.targetDate ||
                               previousGoal.preferences !== goalData.preferences;

        const hasNewMeaningfulGoal = goalData.fitnessGoals !== "Inga specifika mål satta" && goalData.fitnessGoals.trim() !== '';

        if (hasNewMeaningfulGoal && goalHasChanged) {
            setTimeout(() => {
                handleTriggerAiGoalPrognosis(goalData);
            }, 300);
        }
    };


  const handleSavePhysique = (physiqueData: Partial<Pick<ParticipantProfile, 'bodyweightKg' | 'muscleMassKg' | 'fatMassKg' | 'inbodyScore'>>) => {
    if (!currentParticipantId) return;

    if (Object.values(physiqueData).some(v => v !== undefined)) {
        const newHistoryEntry: ParticipantPhysiqueStat = {
            id: crypto.randomUUID(),
            participantId: currentParticipantId,
            lastUpdated: new Date().toISOString(),
            bodyweightKg: physiqueData.bodyweightKg,
            muscleMassKg: physiqueData.muscleMassKg,
            fatMassKg: physiqueData.fatMassKg,
            inbodyScore: physiqueData.inbodyScore,
        };
        setParticipantPhysiqueHistory(prev => [...prev, newHistoryEntry]);
    }

    setParticipantDirectory(prev => prev.map(p =>
      p.id === currentParticipantId
        ? { ...p, ...physiqueData, lastUpdated: new Date().toISOString() }
        : p
    ));
    setIsPhysiqueModalOpen(false);

    if (physiqueData.bodyweightKg !== undefined && physiqueData.bodyweightKg !== null) {
      const latestStrengthStatForSync = myStrengthStats.length > 0 
        ? [...myStrengthStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0]
        : null;
      
      if (!latestStrengthStatForSync || latestStrengthStatForSync.bodyweightKg !== physiqueData.bodyweightKg) {
        const newStat: UserStrengthStat = {
          id: crypto.randomUUID(),
          participantId: currentParticipantId,
          bodyweightKg: physiqueData.bodyweightKg,
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

  const handleTriggerAiGoalPrognosis = useCallback(async (
    goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>
) => {
    if (!ai || !API_KEY) {
        setAiFeedbackError("AI-tjänsten är inte tillgänglig. API-nyckel saknas.");
        setCurrentAiModalTitle("Fel vid hämtning av prognos");
        setIsAiFeedbackModalOpen(true);
        return;
    }

    const goalToAnalyze = goalDataOverride || latestActiveGoal;
    if (!goalToAnalyze || goalToAnalyze.fitnessGoals === "Inga specifika mål satta") {
        return;
    }

    setIsLoadingAiFeedback(true);
    setAiFeedback(null);
    setAiFeedbackError(null);
    setCurrentAiModalTitle("AI Recept för ditt mål");
    setIsAiFeedbackModalOpen(true);

    const prompt = `Du är "Flexibot", en AI-coach och digital träningskompis från Flexibel Hälsostudio. Din roll är att ge en personlig, motiverande och vetenskapligt grundad prognos och rekommendation (ett "recept") för en medlem som precis satt ett nytt mål. Svaret ska vara på svenska och formaterat med Markdown (## Rubriker, **fet text**, * punktlistor).

    Medlemmens nya mål:
    - Målbeskrivning: "${goalToAnalyze.fitnessGoals}"
    - Mål (pass/vecka): ${goalToAnalyze.workoutsPerWeekTarget}
    - Måldatum: ${goalToAnalyze.targetDate ? new Date(goalToAnalyze.targetDate).toLocaleDateString('sv-SE') : 'Inget satt'}
    - Preferenser/Övrigt: "${goalToAnalyze.preferences || 'Inga'}"

    Ditt uppdrag: Skapa ett inspirerande "recept" för att hjälpa medlemmen att lyckas. Inkludera följande sektioner:
    1.  **## Prognos & Pepp:** Ge en kort, positiv bedömning av målets realism och uppmuntra medlemmen.
    2.  **## Nyckelpass för Framgång:** Rekommendera 2-3 specifika pass-typer från Flexibels utbud som är extra viktiga för att nå detta mål. Motivera kort varför. Tillgängliga pass: PT-BAS (fokus baslyft/styrka), PT-GRUPP (styrka & kondition), WORKOUT (funktionell styrka & uthållighet), HIIT (högintensiv kondition), Yin Yoga (rörlighet/återhämtning), Postural Yoga (hållning/balans), Mindfulness (mentalt fokus).
    3.  **## Att Tänka På:** Ge 2-3 konkreta, handlingsbara tips relaterade till målet. Det kan handla om teknik, kost, återhämtning eller mental inställning.
    4.  **## Lycka Till!** Avsluta med en positiv och motiverande hälsning.

    Håll en stöttande och professionell ton. Undvik medicinska råd.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        setParticipantGoals(prev => {
            const latestGoalForParticipant = prev
                .filter(g => g.participantId === currentParticipantId && !g.isCompleted)
                .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];

            if (latestGoalForParticipant) {
                return prev.map(g => 
                    g.id === latestGoalForParticipant.id 
                    ? {...g, aiPrognosis: response.text} 
                    : g
                );
            }
            return prev;
        });
        setAiFeedback(response.text);
    } catch (err) {
        console.error("Error generating AI goal prognosis:", err);
        setAiFeedbackError("Kunde inte generera en prognos för ditt mål. Försök igen senare.");
    } finally {
        setIsLoadingAiFeedback(false);
    }
}, [ai, latestActiveGoal, setParticipantGoals, currentParticipantId]);

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

    const coachPlanString = latestActiveGoal?.coachPrescription
        ? `
        OBLIGATORISK INSTRUKTION FRÅN COACH:
        Du MÅSTE basera din feedback på coachens plan. Din feedback ska stötta och förstärka planen. Avvik ALDRIG från den.
        Coachens Plan: "${latestActiveGoal.coachPrescription}"
        `
        : "";

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

${coachPlanString}

DINA REGLER:
- Om medlemmens mål inkluderar 'styrka', 'muskelmassa', 'bygga muskler', eller 'forma kroppen' OCH kroppsvikt finns i datan, inkludera ett avsnitt \`## Tips för Muskeluppbyggnad\`. Nämn där att ett proteinintag på ca **1.5 gram per kilo kroppsvikt per dag** är viktigt för att bevara och bygga muskler.
- Om medlemmens mål inkluderar 'viktnedgång' eller 'gå ner i vikt', inkludera ett avsnitt \`## Tips för Viktnedgång\`. Informera om att ett sunt mål är att gå ner **ca 0.5 kg per vecka**, eller upp till 1% av kroppsvikten per vecka. Tipsa också om att 'vi på Flexibel kan hjälpa dig med en hållbar plan för detta'.
- Om medlemmens mål innehåller ord som 'starkare' eller 'styrka', och styrkedatan (1RM) är ofullständig (minst ett av baslyften saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att fylla i detta. Exempelvis: "För att vi ska kunna följa din styrkeutveckling på bästa sätt, glöm inte att logga dina maxlyft (1RM) via **'Styrka'**-knappen i menyn högst upp när du har möjlighet!"
- Om medlemmens mål innehåller ord som 'kondition' eller 'flås', och konditionsdatan är ofullständig (minst ett av testerna saknas), inkludera då ett tips under "Konkreta Tips & Motivation" om att göra ett test. Exempelvis: "Ett superbra sätt att mäta dina framsteg i kondition är att göra ett av våra 4-minuterstester (t.ex. Airbike eller Rodd) och logga resultatet via **'Kondition'**-knappen i menyn högst upp. Gör ett test nu och ett igen om några månader för att se skillnaden!"
- Inkludera ALLTID ett avsnitt \`## Rörelse i Vardagen 🚶‍♀️\`. I detta avsnitt, ge råd om vikten av daglig rörelse utanför gymmet. Uppmuntra medlemmen att sikta på att uppnå WHO:s rekommendationer för fysisk aktivitet, vilket är minst **150-300 minuter medelintensiv aktivitet** eller **75-150 minuter högintensiv aktivitet** per vecka, plus muskelstärkande aktiviteter minst två dagar i veckan. Ge konkreta exempel som raska promenader, cykling, eller att ta trapporna.

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
6.  **## Rörelse i Vardagen 🚶‍♀️:** Ge råd om vardagsmotion och WHO:s rekommendationer.
7.  **## Konkreta Tips & Motivation:** Ge 1-2 specifika, actionable tips baserat på medlemmens helhetsprofil (t.ex. passförslag från Flexibels utbud (PT-Bas, PT-Grupp, HIIT, Workout, Yin Yoga, Postural Yoga, Mindfulness), fokusområde, eller påminnelse). Var kreativ!
8.  **## Avslutning:** Avsluta med pepp!

Om data saknas i vissa områden, nämn det vänligt och uppmuntra till att logga mer för bättre feedback.
Ton: Stöttande, professionell, och lite kul. Använd emojis sparsamt men passande.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        setAiFeedback(response.text);
    } catch (error) {
        console.error("Error fetching AI progress feedback:", error);
        setAiFeedbackError("Kunde inte hämta feedback från AI. Försök igen senare.");
    } finally {
        setIsLoadingAiFeedback(false);
    }
  }, [ai, latestActiveGoal, participantProfile, latestStrengthStats, latestConditioningValues, myMentalWellbeing, allActivityLogs, workouts]);
  
  const handleLogGeneralActivitySave = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'participantId'>) => {
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
    const updatedLogs = [...generalActivityLogs, newLog];
    setGeneralActivityLogs(updatedLogs);
    
    // Update streaks and gamification
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(myParticipantGoals, myGamificationStats, participantProfile.id, [...myWorkoutLogs, ...updatedLogs, ...myGoalCompletionLogs]);
    setParticipantGoals(prev => [...prev.filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(prev => [...prev.filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
    }

    setIsLogGeneralActivityModalOpen(false);
    setLastGeneralActivity(newLog);
    setIsGeneralActivitySummaryOpen(true);
  };

  const handleOpenLogWorkout = (category: WorkoutCategory) => {
    setWorkoutCategoryFilter(category);
    setIsSelectWorkoutModalOpen(true);
  };
  
  const handleOpenMeetingModal = (session: OneOnOneSession) => {
    setSelectedSessionForModal(session);
    setIsMeetingModalOpen(true);
  };
  
  const handleOpenQrScanner = (mode: 'workout' | 'checkin') => {
    setIsQrScannerOpen(true);
  };
  
  const handleWorkoutScan = (workoutData: Omit<Workout, 'id' | 'isPublished'>) => {
    const scannedWorkout: Workout = {
        ...workoutData,
        id: crypto.randomUUID(),
        isPublished: false,
    };
    handleStartWorkout(scannedWorkout);
  };

  const handleCheckinScan = (checkinData: { type: 'flexibel-checkin', locationId: string }) => {
    setCheckinSuccess(true);
  
    // Now, let's find the booking to check in
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
  
    const todaysBookings = allParticipantBookings
      .filter(b => b.participantId === currentParticipantId && b.classDate === todayStr && b.status === 'BOOKED')
      .map(booking => {
        const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
        if (!schedule || schedule.locationId !== checkinData.locationId) return null;
  
        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const classTime = new Date();
        classTime.setHours(hour, minute, 0, 0);
  
        return { booking, classTime };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => Math.abs(a.classTime.getTime() - now.getTime()) - Math.abs(b.classTime.getTime() - now.getTime()));
  
    const closestBooking = todaysBookings[0];
    if (closestBooking && Math.abs(closestBooking.classTime.getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
      onCheckInParticipant(closestBooking.booking.id);
    }
  };

  useEffect(() => {
    // On first load for a participant, if they've never viewed the flow,
    // set the timestamp to now to avoid showing all historical items as "new".
    if (!lastFlowViewTimestamp) {
      setLastFlowViewTimestamp(new Date().toISOString());
    }
  }, [lastFlowViewTimestamp, setLastFlowViewTimestamp]);

  const newFlowItemsCount = useMemo(() => {
    if (!lastFlowViewTimestamp) {
      return 0;
    }
    const lastViewDate = new Date(lastFlowViewTimestamp);
    
    const friendIds = new Set<string>();
    connections.forEach(conn => {
        if (conn.status === 'accepted') {
            if (conn.requesterId === currentParticipantId) friendIds.add(conn.receiverId);
            if (conn.receiverId === currentParticipantId) friendIds.add(conn.requesterId);
        }
    });
    const allowedParticipantIds = new Set([currentParticipantId, ...friendIds]);
    
    let count = 0;
    const isNew = (dateStr: string | undefined) => dateStr && new Date(dateStr) > lastViewDate;

    coachEvents.forEach(event => {
        if (isNew(event.createdDate)) count++;
    });

    const newWorkoutLogs = workoutLogs.filter(log => allowedParticipantIds.has(log.participantId) && isNew(log.completedDate));
    count += newWorkoutLogs.length;
    count += generalActivityLogs.filter(log => allowedParticipantIds.has(log.participantId) && isNew(log.completedDate)).length;
    count += goalCompletionLogs.filter(log => allowedParticipantIds.has(log.participantId) && isNew(log.completedDate)).length;

    participantGoals.forEach(goal => {
        if (allowedParticipantIds.has(goal.participantId) && isNew(goal.setDate) && !goal.isCompleted) count++;
    });
    
    clubMemberships.forEach(membership => {
        if (allowedParticipantIds.has(membership.participantId) && isNew(membership.achievedDate)) {
            const membershipDate = new Date(membership.achievedDate).getTime();
            const isFromNewWorkout = newWorkoutLogs.some(log => {
                if (log.participantId !== membership.participantId) return false;
                const logDate = new Date(log.completedDate).getTime();
                return Math.abs(logDate - membershipDate) < 5000;
            });
            if (!isFromNewWorkout) {
                count++;
            }
        }
    });

    const statsByParticipant = userStrengthStats.reduce((acc, stat) => {
        if (allowedParticipantIds.has(stat.participantId)) {
            if (!acc[stat.participantId]) acc[stat.participantId] = [];
            acc[stat.participantId].push(stat);
        }
        return acc;
    }, {} as Record<string, UserStrengthStat[]>);

    Object.entries(statsByParticipant).forEach(([participantId, stats]) => {
        if (stats.length < 2) return;
        const sortedStats = stats.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
        const author = participantDirectory.find(p => p.id === participantId);
        if (!author) return;
        const latestStat = sortedStats[sortedStats.length - 1];
        if (isNew(latestStat.lastUpdated)) {
            const previousStat = sortedStats[sortedStats.length - 2];
            const latestFss = calculateFlexibelStrengthScoreInternal(latestStat, author);
            const previousFss = calculateFlexibelStrengthScoreInternal(previousStat, author);
            if (latestFss && previousFss && latestFss.totalScore > previousFss.totalScore) {
                count++;
            }
        }
    });

    const physiqueByParticipant = participantPhysiqueHistory.reduce((acc, history) => {
        if (allowedParticipantIds.has(history.participantId)) {
            if (!acc[history.participantId]) acc[history.participantId] = [];
            acc[history.participantId].push(history);
        }
        return acc;
    }, {} as Record<string, ParticipantPhysiqueStat[]>);
    
    Object.entries(physiqueByParticipant).forEach(([participantId, history]) => {
        if (history.length < 2) return;
        const sortedHistory = history.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
        const latestHistory = sortedHistory[sortedHistory.length - 1];
        if (isNew(latestHistory.lastUpdated)) {
            const previousHistory = sortedHistory[sortedHistory.length - 2];
            if (latestHistory.inbodyScore && previousHistory.inbodyScore && latestHistory.inbodyScore > previousHistory.inbodyScore) {
                count++;
            }
        }
    });

    if (leaderboardSettings.weeklyPBChallengeEnabled || leaderboardSettings.weeklySessionChallengeEnabled) {
        if (isNew(dateUtils.getStartOfWeek(new Date()).toISOString())) {
            count++;
        }
    }

    // Add count for new comments on my logs/sessions
    const myWorkoutLogsWithComments = workoutLogs.filter(l => l.participantId === currentParticipantId && l.comments && l.comments.length > 0);
    const myGeneralLogsWithComments = generalActivityLogs.filter(l => l.participantId === currentParticipantId && l.comments && l.comments.length > 0);
    const mySessionsWithComments = oneOnOneSessions.filter(s => s.participantId === currentParticipantId && s.comments && s.comments.length > 0);

    const myContentWithComments = [...myWorkoutLogsWithComments, ...myGeneralLogsWithComments, ...mySessionsWithComments];

    myContentWithComments.forEach(item => {
        const newCommentsByOthers = item.comments!.filter(comment => 
            comment.authorId !== currentParticipantId && isNew(comment.createdDate)
        );
        count += newCommentsByOthers.length;
    });


    return count;
  }, [
    lastFlowViewTimestamp, connections, currentParticipantId, participantDirectory,
    coachEvents, workoutLogs, generalActivityLogs, goalCompletionLogs, 
    participantGoals, clubMemberships, userStrengthStats, participantPhysiqueHistory,
    leaderboardSettings, oneOnOneSessions
  ]);
  
  const pendingRequestsCount = useMemo(() => {
    return connections.filter(conn => conn.receiverId === currentParticipantId && conn.status === 'pending').length;
  }, [connections, currentParticipantId]);


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
  
  const inbodyScoreInterpretation = getInBodyScoreInterpretation(latestPhysique?.inbodyScore);
  const streak = latestActiveGoal?.currentWeeklyStreak || 0;
  const hasStreak = streak > 0;

  return (
    <div className="bg-gray-100 pb-28" ref={mainContentRef}>
      {isFabMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsFabMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <FixedHeaderAndTools
          participantProfile={participantProfile}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenGoalModal={() => setIsGoalModalOpen(true)}
          currentRole={currentRole}
          onSetRole={onSetRole}
          onTriggerAiProgressFeedback={handleTriggerAiProgressFeedback}
          onOpenCommunity={() => setIsCommunityModalOpen(true)}
          newFlowItemsCount={newFlowItemsCount}
          pendingRequestsCount={pendingRequestsCount}
          onViewFlow={() => setLastFlowViewTimestamp(new Date().toISOString())}
          currentUserId={currentParticipantId}
          allParticipants={participantDirectory}
          connections={connections}
          workouts={workouts}
          workoutLogs={workoutLogs}
          generalActivityLogs={generalActivityLogs}
          goalCompletionLogs={goalCompletionLogs}
          coachEvents={coachEvents}
          participantGoals={participantGoals}
          participantPhysiqueHistory={participantPhysiqueHistory}
          clubMemberships={clubMemberships}
          userStrengthStatsHistory={userStrengthStats}
          leaderboardSettings={leaderboardSettings}
          onToggleReaction={onToggleReaction}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          latestGoal={latestActiveGoal}
          isStaffViewingSelf={isStaffViewingSelf}
          onSwitchToStaffView={onSwitchToStaffView}
          aiRecept={latestActiveGoal?.aiPrognosis}
          onOpenAiRecept={() => setIsAiReceptModalOpen(true)}
      />

      <div className="container mx-auto p-4 space-y-6">
        {myUpcomingSessions.length > 0 && (
          <UpcomingMeetingCard
            sessions={myUpcomingSessions}
            staff={staffMembers}
            onOpenModal={handleOpenMeetingModal}
          />
        )}
       
        {/* ----- Redesigned Dashboard Starts Here ----- */}
        <WeeklyGoalCard progress={weeklyProgress} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <StatCard 
                title="Totalt Antal Pass" 
                value={allActivityLogs.length} 
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>}
            />
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center">
                <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg mr-4 transition-colors duration-300 ${hasStreak ? 'bg-flexibel-orange/10 text-flexibel-orange animate-pulse-icon' : 'bg-flexibel/10 text-flexibel'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A8 8 0 0117.657 18.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                </div>
                <div className="flex-grow min-w-0">
                    <p className="text-base font-medium text-gray-500 leading-tight">Nuvarande Streak</p>
                    <div className="flex items-baseline gap-x-2 flex-wrap">
                        <p className="text-3xl sm:text-4xl font-bold text-gray-800">{streak}</p>
                        <p className="text-sm sm:text-base font-bold text-gray-400">veckor</p>
                    </div>
                </div>
            </div>
             <StatCard 
                title="FSS" 
                value={flexibelStrengthScore ? Math.round(flexibelStrengthScore) : '-'} 
                subValue={fssScoreInterpretation?.label || "Styrkepoäng"}
                subValueColor={fssScoreInterpretation?.color}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <StatCard 
                title="InBody" 
                value={latestPhysique?.inbodyScore ?? '-'} 
                subValue={inbodyScoreInterpretation?.label}
                subValueColor={inbodyScoreInterpretation?.color}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" /></svg>}
            />
        </div>

        <div className="pt-4 space-y-4">
            <ToolCard 
                title="Min Styrka"
                description="Se dina 1RM, styrkenivåer och historik."
                onClick={() => setIsStrengthModalOpen(true)}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
             <ToolCard 
                title="Min Kondition"
                description="Logga och följ dina konditionstest."
                onClick={() => setIsConditioningModalOpen(true)}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
            />
             <ToolCard 
                title="Min Kropp (InBody)"
                description="Logga vikt och kroppssammansättning."
                onClick={() => setIsPhysiqueModalOpen(true)}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" /></svg>}
            />
        </div>
        {/* ----- Dashboard Ends Here ----- */}

        <ParticipantActivityView
            allActivityLogs={allActivityLogs}
            workouts={workouts}
            onViewLogSummary={handleEditLog}
            onDeleteActivity={handleDeleteActivity}
            activeGoal={latestActiveGoal}
            strengthStatsHistory={myStrengthStats}
            conditioningStatsHistory={myConditioningStats}
            physiqueHistory={myPhysiqueHistory}
            clubMemberships={myClubMemberships}
            participantProfile={participantProfile}
            leaderboardSettings={leaderboardSettings}
            allParticipantGoals={myParticipantGoals}
            coachEvents={coachEvents}
            oneOnOneSessions={myOneOnOneSessions}
            staffMembers={staffMembers}
            allParticipants={participantDirectory}
            currentParticipantId={currentParticipantId}
            groupClassSchedules={groupClassSchedules}
            groupClassDefinitions={groupClassDefinitions}
            allParticipantBookings={allParticipantBookings}
        />
      </div>

      <FabMenu
        isOpen={isFabMenuOpen}
        onToggle={() => setIsFabMenuOpen(prev => !prev)}
        onClose={() => setIsFabMenuOpen(false)}
        workouts={workouts}
        currentParticipantId={currentParticipantId}
        onSelectWorkoutCategory={handleOpenLogWorkout}
        onOpenLogGeneralActivityModal={() => setIsLogGeneralActivityModalOpen(true)}
        restrictedCategories={myMembership?.restrictedCategories}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onOpenBookingModal={() => setIsBookingModalOpen(true)}
        integrationSettings={integrationSettings}
        onOpenQrScanner={handleOpenQrScanner}
        workoutCategories={workoutCategories}
      />

      <SelectWorkoutModal
        isOpen={isSelectWorkoutModalOpen}
        onClose={() => setIsSelectWorkoutModalOpen(false)}
        workouts={workouts}
        onStartWorkout={handleStartWorkout}
        categoryFilter={workoutCategoryFilter}
        membership={myMembership}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        currentParticipantId={currentParticipantId}
      />
      
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {workoutForExerciseSelection && (
        <ExerciseSelectionModal
            isOpen={isExerciseSelectionModalOpen}
            onClose={() => setIsExerciseSelectionModalOpen(false)}
            options={workoutForExerciseSelection.exerciseSelectionOptions}
            onConfirm={handleExerciseSelectionConfirm}
        />
      )}

      <AIProgressFeedbackModal
        isOpen={isAiFeedbackModalOpen}
        onClose={() => setIsAiFeedbackModalOpen(false)}
        isLoading={isLoadingAiFeedback}
        aiFeedback={aiFeedback}
        error={aiFeedbackError}
        modalTitle={currentAiModalTitle}
      />
      
      <AIProgressFeedbackModal
        isOpen={isAiReceptModalOpen}
        onClose={() => setIsAiReceptModalOpen(false)}
        isLoading={false}
        aiFeedback={latestActiveGoal?.aiPrognosis || null}
        error={null}
        modalTitle="AI Coach Recept"
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
        onSaveActivity={handleLogGeneralActivitySave}
      />
      <GeneralActivitySummaryModal
        isOpen={isGeneralActivitySummaryOpen}
        onClose={() => {setIsGeneralActivitySummaryOpen(false); openMentalCheckinIfNeeded(); }}
        activity={lastGeneralActivity}
      />
       
      <FeedbackPromptToast
        isOpen={showFeedbackPrompt}
        onAccept={() => { setShowFeedbackPrompt(false); handleTriggerAiProgressFeedback(); }}
        onDecline={() => setShowFeedbackPrompt(false)}
        message="Du har varit aktiv! Vill du ha AI-feedback på din senaste progress?"
      />
      
      <MentalWellbeingModal
        isOpen={isMentalCheckinOpen}
        onClose={() => setIsMentalCheckinOpen(false)}
        currentWellbeing={myMentalWellbeing || null}
        participantId={currentParticipantId}
        onSave={handleSaveMentalWellbeing}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={participantProfile}
        onSave={handleSaveProfile}
        locations={locations}
      />
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        currentGoalForForm={latestActiveGoal}
        allParticipantGoals={myParticipantGoals}
        onSave={handleSaveGoals}
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
      <CommunityModal
        isOpen={isCommunityModalOpen}
        onClose={() => setIsCommunityModalOpen(false)}
        currentParticipantId={currentParticipantId}
        allParticipants={participantDirectory}
        connections={connections}
        setConnections={setConnections}
      />
      {selectedSessionForModal && (
        <MeetingDetailsModal
            isOpen={isMeetingModalOpen}
            onClose={() => setIsMeetingModalOpen(false)}
            session={selectedSessionForModal}
            coach={staffMembers.find(s => s.id === selectedSessionForModal.coachId) || null}
            currentUserId={currentParticipantId}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
        />
      )}
      {integrationSettings.isBookingEnabled && (
        <BookingView
            isOpen={isBookingModalOpen}
            onClose={() => setIsBookingModalOpen(false)}
            schedules={groupClassSchedules}
            definitions={groupClassDefinitions}
            bookings={allParticipantBookings}
            staff={staffMembers}
            onBookClass={onBookClass}
            onCancelBooking={onCancelBooking}
            currentParticipantId={currentParticipantId}
            participantProfile={participantProfile}
            integrationSettings={integrationSettings}
        />
      )}
      <QrScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          onWorkoutScan={handleWorkoutScan}
          onCheckinScan={handleCheckinScan}
      />
      {checkinSuccess && participantProfile && (
        <CheckinConfirmationModal
            isOpen={checkinSuccess}
            onClose={() => setCheckinSuccess(false)}
            participantName={participantProfile.name || 'Medlem'}
        />
      )}
    </div>
  );
};