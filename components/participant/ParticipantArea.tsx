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
import { calculateUpdatedStreakAndGamification } from '../../services/gamificationService';
import { calculatePostWorkoutSummary, findAndUpdateStrengthStats } from '../../services/workoutService';
import { NextBookingCard } from './NextBookingCard';
import { AIAssistantModal, AiWorkoutTips } from './AIAssistantModal';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';


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

const getInBodyScoreInterpretation = (score: number | undefined | null): { label: string; color: string; } | null => {
    if (score === undefined || score === null || isNaN(score)) return null;
    if (score >= 90) return { label: 'Utmärkt', color: '#14b8a6' }; // teal-500
    if (score >= 80) return { label: 'Bra', color: '#22c55e' };      // green-500
    if (score >= 70) return { label: 'Medel', color: '#f97316' };     // orange-500
    return { label: 'Under Medel', color: '#ef4444' };     // red-500
};

// Redesigned Card components
const StatCard: React.FC<{ title: string; value: string | number; subValue?: string; icon: React.ReactNode; subValueColor?: string; iconContainerClassName?: string; }> = ({ title, value, subValue, icon, subValueColor, iconContainerClassName }) => (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 flex items-center h-full">
        <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 ${iconContainerClassName || 'bg-flexibel/10 text-flexibel'}`}>
            {icon}
        </div>
        <div className="flex-grow min-w-0">
            <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">{title}</p>
            <div className="flex items-baseline gap-x-1 sm:gap-x-2 flex-wrap">
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{value}</p>
                {subValue && <p className="text-sm sm:text-lg font-bold" style={{ color: subValueColor || '#9ca3af' }}>{subValue}</p>}
            </div>
        </div>
    </div>
);

const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, description, icon, onClick }) => (
    <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 text-left w-full hover:shadow-xl hover:border-flexibel transition-all duration-200 group">
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

const WarningBanner: React.FC<{ message: string, type: 'warning' | 'danger', buttonText: string, onButtonClick: () => void }> = ({ message, type, buttonText, onButtonClick }) => {
    const colors = {
        warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400', button: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' },
        danger: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400', button: 'bg-orange-400 hover:bg-orange-500 text-orange-900' }
    };
    const currentColors = colors[type];

    return (
        <div className={`p-4 rounded-lg border ${currentColors.bg} ${currentColors.border} ${currentColors.text} flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <p className="font-semibold text-center sm:text-left">{message}</p>
            <Button onClick={onButtonClick} className={`!px-4 !py-2 !text-base ${currentColors.button}`}>{buttonText}</Button>
        </div>
    );
};


const ProgressCircle: React.FC<{
  label: string;
  displayText: string;
  displayUnit: string;
  percentage: number;
  colorClass: string;
}> = ({ label, displayText, displayUnit, percentage, colorClass }) => {
  const radius = 52; 
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center p-2 flex-1">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle
            className="text-gray-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
          />
          <circle
            className={colorClass}
            strokeWidth={strokeWidth}
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
          <span className="text-3xl sm:text-4xl font-bold text-gray-800">{displayText}</span>
          <span className="text-base font-medium text-gray-500">{displayUnit}</span>
        </div>
      </div>
      <p className="mt-3 text-base sm:text-lg font-semibold text-gray-600">{label}</p>
    </div>
  );
};

const GoalProgressCard: React.FC<{ goal: ParticipantGoalData | null, logs: ActivityLog[] }> = ({ goal, logs }) => {
    if (goal && goal.targetDate) {
        const startDate = new Date(goal.setDate);
        const targetDate = new Date(goal.targetDate);
        const today = new Date();

        const totalDays = Math.max(1, (targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        const daysPassed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        const daysRemaining = Math.max(0, totalDays - daysPassed);
        const timePercentage = Math.min(100, (daysPassed / totalDays) * 100);
        
        const weeklyTarget = goal.workoutsPerWeekTarget > 0 ? goal.workoutsPerWeekTarget : 0;
        
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
        const weeklyPercentage = weeklyTarget > 0 ? Math.min(100, (logsThisWeek / weeklyTarget) * 100) : 0;

        const totalWeeks = Math.max(1, totalDays / 7);
        const targetWorkouts = weeklyTarget > 0 ? Math.round(totalWeeks * weeklyTarget) : 0;
        const completedWorkouts = logs.filter(log => new Date(log.completedDate) >= startDate && new Date(log.completedDate) <= targetDate).length;
        const workoutPercentage = targetWorkouts > 0 ? Math.min(100, (completedWorkouts / targetWorkouts) * 100) : 0;


        return (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="flex justify-center sm:justify-around items-start gap-4">
                    {weeklyTarget > 0 && (
                        <ProgressCircle
                            label="Veckans Pass"
                            displayText={`${logsThisWeek} / ${weeklyTarget}`}
                            displayUnit="pass"
                            percentage={weeklyPercentage}
                            colorClass="text-flexibel-orange"
                        />
                    )}
                    {targetWorkouts > 0 && (
                        <ProgressCircle
                            label="Totalt för Målperioden"
                            displayText={`${completedWorkouts} / ${targetWorkouts}`}
                            displayUnit="pass"
                            percentage={workoutPercentage}
                            colorClass="text-flexibel"
                        />
                    )}
                </div>
                
                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-2 text-base">
                        <span className="font-semibold text-gray-700">Tidslinje</span>
                        <span className="font-bold text-gray-800">{Math.round(daysRemaining)} dagar kvar</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${timePercentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>Start: {startDate.toLocaleDateString('sv-SE')}</span>
                        <span>Mål: {targetDate.toLocaleDateString('sv-SE')}</span>
                    </div>
                </div>
            </div>
        );
    }
    
    // Fallback if no target date is set
    const progress = useMemo(() => {
        if (!goal || !goal.workoutsPerWeekTarget || goal.workoutsPerWeekTarget <= 0) return null;
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
        return { completed: logsThisWeek, target: goal.workoutsPerWeekTarget };
    }, [goal, logs]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
             <div className="flex justify-center sm:justify-around items-start mt-4 gap-4">
                {progress && (
                    <ProgressCircle
                        label="Veckans Pass"
                        displayText={`${progress.completed} / ${progress.target}`}
                        displayUnit="pass"
                        percentage={Math.min(100, (progress.completed / progress.target) * 100)}
                        colorClass="text-flexibel-orange"
                    />
                )}
                {!progress && <p className="text-gray-500 p-8">Sätt ett veckomål för att se din progress här!</p>}
            </div>
        </div>
    );
};



interface ParticipantAreaProps {
  currentParticipantId: string;
  onSetRole: (role: UserRole | null) => void;
  onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onCheckInParticipant: (bookingId: string) => void;
}

// Main ParticipantArea Component
export const ParticipantArea: React.FC<ParticipantAreaProps> = ({
  currentParticipantId,
  onSetRole,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  openProfileModalOnInit,
  onProfileModalOpened,
  isStaffViewingSelf,
  onSwitchToStaffView,
  onBookClass,
  onCancelBooking,
  onCheckInParticipant,
}) => {
    const {
        participantDirectory,
        updateParticipantProfile,
        workouts,
        workoutLogs, setWorkoutLogsData: setWorkoutLogs,
        participantGoals, setParticipantGoalsData: setParticipantGoals,
        generalActivityLogs, setGeneralActivityLogsData: setGeneralActivityLogs,
        goalCompletionLogs, setGoalCompletionLogsData: setGoalCompletionLogs,
        userStrengthStats, setUserStrengthStatsData: setUserStrengthStats,
        userConditioningStatsHistory, setUserConditioningStatsHistoryData: setUserConditioningStatsHistory,
        participantPhysiqueHistory, setParticipantPhysiqueHistoryData: setParticipantPhysiqueHistory,
        participantMentalWellbeing, setParticipantMentalWellbeingData: setParticipantMentalWellbeing,
        participantGamificationStats, setParticipantGamificationStatsData: setParticipantGamificationStats,
        clubMemberships,
        leaderboardSettings,
        coachEvents,
        connections, setConnectionsData: setConnections,
        lastFlowViewTimestamp, setLastFlowViewTimestampData: setLastFlowViewTimestamp,
        locations,
        memberships,
        staffMembers,
        oneOnOneSessions,
        workoutCategories,
        integrationSettings,
        groupClassSchedules,
        groupClassDefinitions,
        participantBookings: allParticipantBookings,
    } = useAppContext();
    const { currentRole } = useAuth();

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

  const [isAIAssistantModalOpen, setIsAIAssistantModalOpen] = useState(false);
  const [preWorkoutData, setPreWorkoutData] = useState<{ workout: Workout, previousLog: WorkoutLog } | null>(null);
  const [aiWorkoutTips, setAiWorkoutTips] = useState<AiWorkoutTips | null>(null);


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
  const [isAiUpsellModalOpen, setIsAiUpsellModalOpen] = useState(false);
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

  const nextBooking = useMemo(() => {
    const now = new Date();
    const myBookings = allParticipantBookings
        .filter(b => b.participantId === currentParticipantId && (b.status === 'BOOKED' || b.status === 'WAITLISTED'))
        .map(booking => {
            const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
            if (!schedule) return null;

            const [hour, minute] = schedule.startTime.split(':').map(Number);
            const [year, month, day] = booking.classDate.split('-').map(Number);
            const startDateTime = new Date(year, month - 1, day, hour, minute);

            if (startDateTime < now) return null;

            const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
            const coach = staffMembers.find(s => s.id === schedule.coachId);

            if (!classDef || !coach) return null;

            return { booking, schedule, classDef, coach, startDateTime };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    
    return myBookings[0] || null;
  }, [allParticipantBookings, currentParticipantId, groupClassSchedules, groupClassDefinitions, staffMembers]);


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

    // 1. Calculate summary using the new service
    const summary = calculatePostWorkoutSummary(
        logWithParticipantId, 
        workouts, 
        myWorkoutLogs, // Pass this as an argument now
        latestStrengthStats
    );
    const logWithSummary = logWithParticipantId.entries.length > 0
        ? { ...logWithParticipantId, postWorkoutSummary: summary }
        : logWithParticipantId;

    // 2. Check for PBs and update strength stats using the new service
    const { needsUpdate, updatedStats } = findAndUpdateStrengthStats(
        logWithParticipantId,
        workouts,
        latestStrengthStats
    );

    if (needsUpdate) {
        const newStatRecord: UserStrengthStat = {
            id: crypto.randomUUID(),
            participantId: participantProfile.id,
            lastUpdated: new Date().toISOString(),
            bodyweightKg: latestStrengthStats?.bodyweightKg || participantProfile.bodyweightKg,
            squat1RMaxKg: updatedStats.squat1RMaxKg,
            benchPress1RMaxKg: updatedStats.benchPress1RMaxKg,
            deadlift1RMaxKg: updatedStats.deadlift1RMaxKg,
            overheadPress1RMaxKg: updatedStats.overheadPress1RMaxKg,
        };
        setUserStrengthStats(prev => [...prev, newStatRecord]);
    }

    // 3. Save the log itself
    const existingLogIndex = workoutLogs.findIndex(l => l.id === logWithSummary.id);
    const updatedWorkoutLogsList = existingLogIndex > -1
        ? workoutLogs.map((l, index) => index === existingLogIndex ? logWithSummary : l)
        : [...workoutLogs, logWithSummary];
    
    setWorkoutLogs(updatedWorkoutLogsList);
    
    // 4. Update streaks and gamification using the new service
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(
        myParticipantGoals, 
        myGamificationStats, 
        participantProfile.id, 
        [...updatedWorkoutLogsList, ...myGeneralActivityLogs, ...myGoalCompletionLogs]
    );
    setParticipantGoals(prev => [...prev.filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(prev => [...prev.filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
    }

    // 5. Final UI steps
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

  const isAiEnabled = useMemo(() => {
    return myMembership?.type === 'subscription' && (!myMembership.restrictedCategories || myMembership.restrictedCategories.length === 0);
  }, [myMembership]);
  
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
    
    if (isNewSessionForLog && logToUse && ai && isAiEnabled) {
      setPreWorkoutData({ workout, previousLog: logToUse });
      setIsAIAssistantModalOpen(true);
      setIsSelectWorkoutModalOpen(false);
    } else {
      setAiWorkoutTips(null);
      setCurrentWorkoutLog(logToUse); 
      setCurrentWorkoutForForm(workout); 
      setIsLogFormOpen(true);
      setIsSelectWorkoutModalOpen(false);
    }
    
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  };

  const handleContinueFromAIAssistant = (tips: AiWorkoutTips) => {
    if (preWorkoutData) {
      setAiWorkoutTips(tips);
      setCurrentWorkoutLog(preWorkoutData.previousLog);
      setCurrentWorkoutForForm(preWorkoutData.workout);
      setIsLogFormOpen(true);
    }
    setIsAIAssistantModalOpen(false);
    setPreWorkoutData(null);
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

    const handleSaveProfile = async (
        profileData: Partial<Pick<ParticipantProfile, 'name' | 'age' | 'gender' | 'enableLeaderboardParticipation' | 'isSearchable' | 'locationId' | 'enableInBodySharing' | 'enableFssSharing'>>
    ) => {
        try {
            await updateParticipantProfile(currentParticipantId, profileData);
        } catch (error) {
            alert("Ett fel uppstod när profilen skulle sparas. Dina ändringar har inte sparats.");
        }
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


  const handleSavePhysique = async (physiqueData: Partial<Pick<ParticipantProfile, 'bodyweightKg' | 'muscleMassKg' | 'fatMassKg' | 'inbodyScore'>>) => {
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
    
    try {
        await updateParticipantProfile(currentParticipantId, physiqueData);
    } catch (error) {
        alert("Ett fel uppstod när din kroppsdata skulle sparas.");
    }

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
        updateParticipantProfile(currentParticipantId, { bodyweightKg: newStat.bodyweightKg });
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
    if (!ai || !API_KEY || !isAiEnabled) {
        setIsAiUpsellModalOpen(true);
        return;
    }

    const goalToAnalyze = goalDataOverride || latestActiveGoal;
    if (!goalToAnalyze || goalToAnalyze.fitnessGoals === "Inga specifika mål satta") {
        return;
    }

    setIsLoadingAiFeedback(true);
    setAiFeedback(null);
    setAiFeedbackError(null);
    setCurrentAiModalTitle("Coachens tips för att du ska nå ditt mål");
    setIsAiFeedbackModalOpen(true);

    const prompt = `Du är "Flexibot", en AI-coach och digital träningskompis från Flexibel Hälsostudio. Din roll är att ge en personlig, motiverande och vetenskapligt grundad prognos och rekommendation (ett "recept") för en medlem som precis satt ett nytt mål. Svaret ska vara på svenska och formaterat med Markdown (## Rubriker, **fet text**, * punktlistor).

    Medlemmens nya mål:
    - Målbeskrivning: "${goalToAnalyze.fitnessGoals}"
    - Mål (pass/vecka): ${goalToAnalyze.workoutsPerWeekTarget}
    - Måldatum: ${goalToAnalyze.targetDate ? new Date(goalToAnalyze.targetDate).toLocaleDateString('sv-SE') : 'Inget satt'}
    - Preferenser/Övrigt: "${goalToAnalyze.preferences || 'Inga'}"

    Ditt uppdrag: Skapa ett inspirerande "recept" för att hjälpa medlemmen att lyckas. Inkludera följande sektioner:
    1.  **## Prognos & Pepp:** Ge en kort, positiv bedömning av målets realism och uppmuntra medlemmen.
    2.  **## Nyckelpass för Framgång:** Rekommendera 2-3 specifika pass-typer från Flexibels utbud som är extra viktiga för att nå detta mål. Tillgängliga pass: PT-BAS (fokus baslyft/styrka), PT-GRUPP (styrka & kondition), WORKOUT (funktionell styrka & uthållighet), HIIT (högintensiv kondition), Yin Yoga (rörlighet/återhämtning), Postural Yoga (hållning/balans), Mindfulness (mentalt fokus).
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
}, [ai, latestActiveGoal, setParticipantGoals, currentParticipantId, isAiEnabled]);
  
  const handleTriggerAiProgressFeedback = useCallback(async () => {
    if (!ai || !API_KEY || !isAiEnabled) {
      setIsUpgradeModalOpen(true);
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
- Inkludera ALLTID ett avsnitt \`## Rörelse i Vardagen 🚶‍♀️\`. I detta avsnitt, ge råd om vikten av daglig rörelse utanför gymmet. Uppmuntra medlemmen att sikta på att uppnå WHO:s rekommendationer för fysisk aktivitet, vilket är minst **150-300 minuter medelintensiv aktivitet** eller **75-150 minuter högintensiv aktivitet** per vecka, plus muskelstärkande aktiviteter minst två dagar i vecka. Ge konkreta exempel som raska promenader, cykling, eller att ta trapporna.

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
  }, [ai, latestActiveGoal, participantProfile, latestStrengthStats, latestConditioningValues, myMentalWellbeing, allActivityLogs, workouts, isAiEnabled]);
  
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

  const handleBookClassAttempt = (participantId: string, scheduleId: string, classDate: string) => {
      const schedule = groupClassSchedules.find(s => s.id === scheduleId);
      const classDef = schedule ? groupClassDefinitions.find(d => d.id === schedule.groupClassId) : null;
      
      if (myMembership?.type === 'clip_card') {
          const status = participantProfile?.clipCardStatus;
          if (!status || status.remainingClips <= 0) {
              setIsUpgradeModalOpen(true);
              return;
          }
          if (status.expiryDate && new Date(status.expiryDate) < new Date(classDate)) {
              setIsUpgradeModalOpen(true);
              return;
          }
          if (classDef && myMembership.clipCardCategories && myMembership.clipCardCategories.length > 0) {
              const restrictedLower = myMembership.clipCardCategories.map(c => c.toLowerCase());
              if (restrictedLower.includes(classDef.name.toLowerCase())) {
                  setIsUpgradeModalOpen(true);
                  return;
              }
          }
      }

      if (myMembership?.type === 'subscription' && classDef && myMembership.restrictedCategories && myMembership.restrictedCategories.length > 0) {
        const restrictedLower = myMembership.restrictedCategories.map(c => c.toLowerCase());
        if (restrictedLower.includes(classDef.name.toLowerCase())) {
            setIsUpgradeModalOpen(true);
            return;
        }
      }

      onBookClass(participantId, scheduleId, classDate);
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

  const clipCardWarning = useMemo(() => {
    if (myMembership?.type !== 'clip_card' || !participantProfile?.clipCardStatus) {
        return null;
    }
    const { remainingClips, expiryDate } = participantProfile.clipCardStatus;
    const today = new Date();
    
    if (expiryDate) {
        const expiry = new Date(expiryDate);
        const daysUntilExpiry = (expiry.getTime() - today.getTime()) / (1000 * 3600 * 24);
        if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
            return {
                type: 'danger',
                message: `Ditt klippkort går ut om ${Math.ceil(daysUntilExpiry)} dagar! Förnya nu för att träna utan avbrott.`
            };
        }
    }
    if (remainingClips <= 2) {
        return {
            type: 'warning',
            message: `Du har bara ${remainingClips} klipp kvar. Dags att fylla på för att fortsätta din träningsresa!`
        };
    }
    return null;
  }, [myMembership, participantProfile]);


  if (isLogFormOpen && currentWorkoutForForm) {
    return (
      <WorkoutLogForm
        ai={isAiEnabled ? ai : null}
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
        aiTips={aiWorkoutTips}
      />
    );
  }
  
  const inbodyScoreInterpretation = getInBodyScoreInterpretation(latestPhysique?.inbodyScore);
  const streak = latestActiveGoal?.currentWeeklyStreak || 0;
  const hasStreak = streak > 0;

  return (
    <div className="bg-gray-100 bg-dotted-pattern bg-dotted-size bg-fixed pb-28" ref={mainContentRef}>
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
          userStrengthStats={userStrengthStats}
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

      <div className="container mx-auto p-4 space-y-4">
        {clipCardWarning && (
            <WarningBanner
                message={clipCardWarning.message}
                type={clipCardWarning.type as 'warning' | 'danger'}
                buttonText="Förnya / Uppgradera"
                onButtonClick={() => setIsUpgradeModalOpen(true)}
            />
        )}
        {myUpcomingSessions.length > 0 && (
          <UpcomingMeetingCard
            sessions={myUpcomingSessions}
            staff={staffMembers}
            onOpenModal={handleOpenMeetingModal}
          />
        )}
        
        {/* ----- Redesigned Dashboard Starts Here ----- */}
        <GoalProgressCard goal={latestActiveGoal} logs={allActivityLogs} />

        <div className={`grid grid-cols-1 ${integrationSettings.isBookingEnabled ? 'md:grid-cols-2' : ''} gap-4`}>
            {integrationSettings.isBookingEnabled && (
                <NextBookingCard 
                    nextBooking={nextBooking}
                />
            )}
            {/* Combined Stats Card */}
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 flex items-center justify-around h-full">
                {/* Total Sessions Part */}
                <div className="flex items-center">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 bg-flexibel/10 text-flexibel">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Totalt Antal Pass</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-800">{allActivityLogs.length}</p>
                    </div>
                </div>
                
                <div className="h-16 w-px bg-gray-200 mx-2 sm:mx-4"></div>

                {/* Current Streak Part */}
                <div className="flex items-center">
                    <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg mr-3 sm:mr-4 transition-colors duration-300 ${hasStreak ? 'bg-flexibel-orange/10 text-flexibel-orange animate-pulse-icon' : 'bg-flexibel/10 text-flexibel'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A8 8 0 0117.657 18.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Nuvarande Streak</p>
                        <div className="flex items-baseline gap-x-1 sm:gap-x-2 flex-wrap">
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{streak}</p>
                            <p className="text-sm sm:text-lg font-bold" style={{ color: '#9ca3af' }}>veckor</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {myMembership?.type === 'clip_card' && participantProfile?.clipCardStatus && (
            <div className="grid grid-cols-1 gap-4">
                <StatCard 
                    title="Klipp Kvar"
                    value={participantProfile.clipCardStatus.remainingClips}
                    subValue={participantProfile.clipCardStatus.expiryDate ? `Giltigt till: ${new Date(participantProfile.clipCardStatus.expiryDate).toLocaleDateString('sv-SE')}` : "Obegränsad tid"}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>}
                />
            </div>
        )}

        <div className="space-y-4">
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
        membership={myMembership}
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

      <UpgradeModal
        isOpen={isAiUpsellModalOpen}
        onClose={() => setIsAiUpsellModalOpen(false)}
        title="Få en personlig plan med AI!"
        message={
          <>
            <span className="text-7xl" role="img" aria-label="hjärna">🧠</span>
            <h3 className="text-3xl font-bold text-gray-800">Bra jobbat med att sätta ett mål!</h3>
            <p className="text-lg text-gray-600">
              Med ett fullvärdigt medlemskap hade du nu fått en personlig, AI-genererad plan och prognos för hur du bäst når detta mål.
            </p>
            <div className="p-4 bg-violet-50 rounded-lg border border-violet-200 text-left text-violet-800 space-y-2">
                <p className="text-lg"><strong>Fördelar med AI-coachen:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-base">
                    <li>Få ett skräddarsytt "recept" med passrekommendationer för just ditt mål.</li>
                    <li>Få konkreta tips på vad du ska fokusera på för att lyckas.</li>
                    <li>Få kontinuerlig, personlig feedback på dina framsteg.</li>
                    <li>Nå dina mål snabbare och mer effektivt!</li>
                </ul>
            </div>
          </>
        }
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
        modalTitle="Coachens tips för att du ska nå ditt mål"
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
            onBookClass={handleBookClassAttempt}
            onCancelBooking={onCancelBooking}
            currentParticipantId={currentParticipantId}
            participantProfile={participantProfile}
            integrationSettings={integrationSettings}
            membership={myMembership}
            onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
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
      {participantProfile && preWorkoutData && (
        <AIAssistantModal
            isOpen={isAIAssistantModalOpen}
            onClose={() => setIsAIAssistantModalOpen(false)}
            onContinue={handleContinueFromAIAssistant}
            ai={ai!}
            workout={preWorkoutData.workout}
            previousLog={preWorkoutData.previousLog}
            participant={participantProfile}
            allWorkouts={workouts}
        />
       )}
    </div>
  );
};
