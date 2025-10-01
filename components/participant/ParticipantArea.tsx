import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog, ActivityLog,
    ParticipantGoalData, ParticipantProfile,
    UserStrengthStat, ParticipantConditioningStat,
    UserRole, ParticipantMentalWellbeing, Exercise, GoalCompletionLog, ParticipantGamificationStats, WorkoutCategory, PostWorkoutSummaryData, NewPB, ParticipantClubMembership, LeaderboardSettings, CoachEvent, GenderOption, Connection, Reaction, Comment, NewBaseline, ParticipantPhysiqueStat, LiftType, Location, Membership, StaffMember, OneOnOneSession, IntegrationSettings,
    GroupClassDefinition, GroupClassSchedule, ParticipantBooking, WorkoutCategoryDefinition, InProgressWorkout, AchievementDefinition, FlowItemLogType
} from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Button } from '../Button';
import { Modal } from '../Modal';
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
    LEVEL_COLORS_HEADER, MAIN_LIFTS_CONFIG_HEADER, MOOD_OPTIONS, CLUB_DEFINITIONS
} from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { calculateFlexibelStrengthScoreInternal, getFssScoreInterpretation as getFssScoreInterpretationFromTool } from './StrengthComparisonTool';
import { FeedbackPromptToast } from './FeedbackPromptToast';
import { InfoModal } from './InfoModal';
import { FabMenu } from './FabMenu';
import { SelectWorkoutModal } from './SelectWorkoutModal';
import { ExerciseSelectionModal } from './ExerciseSelectionModal';
import { MentalWellbeingModal } from './MentalWellbeingModal';
import { ProfileModal } from './ProfileGoalModal';
import { GoalModal } from './GoalModal';
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
import { calculateUpdatedStreakAndGamification, checkAndAwardClubMemberships } from '../../services/gamificationService';
import { calculatePostWorkoutSummary, findAndUpdateStrengthStats } from '../../services/workoutService';
import { NextBookingCard } from './NextBookingCard';
import { AIAssistantModal, AiWorkoutTips } from './AIAssistantModal';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { FlowModal } from './FlowModal';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import { InstallPwaBanner } from './InstallPwaBanner';
import { ConfirmationModal } from '../ConfirmationModal';
import { AchievementToast } from './AchievementToast';
import { AICoachModal } from './AICoachModal';


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

// --- START OF ICONS ---
const TotalPassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h12M4 17h8" />
    </svg>
);

const StreakIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
);

const StrengthIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);
const ConditioningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);
const BodyIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
const LogbookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);
// --- END OF ICONS ---


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
  onToggleReaction: (logId: string, logType: FlowItemLogType, emoji: string) => void;
  onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
  onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onCheckInParticipant: (bookingId: string) => void;
  setProfileOpener: (opener: { open: () => void } | null) => void;
  setParticipantModalOpeners: (openers: {
    openGoalModal: () => void;
    openCommunityModal: () => void;
    openFlowModal: () => void;
    openAiReceptModal: () => void;
  }) => void;
  newFlowItemsCount?: number;
}

// Main ParticipantArea Component
export const ParticipantArea: React.FC<ParticipantAreaProps> = ({
  currentParticipantId,
  onSetRole,
  onToggleReaction,
  onAddComment,
  onDeleteComment,
  onToggleCommentReaction,
  openProfileModalOnInit,
  onProfileModalOpened,
  isStaffViewingSelf,
  onSwitchToStaffView,
  onBookClass,
  onCancelBooking,
  onCheckInParticipant,
  setProfileOpener,
  setParticipantModalOpeners,
  newFlowItemsCount = 0,
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
        clubMemberships, setClubMembershipsData: setClubMemberships,
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
    const { isOnline } = useNetworkStatus();

  const [currentWorkoutLog, setCurrentWorkoutLog] = useState<WorkoutLog | undefined>(undefined);
  const [logForReference, setLogForReference] = useState<WorkoutLog | undefined>(undefined);
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
  const [isAICoachModalOpen, setIsAICoachModalOpen] = useState(false);

  const [isAIAssistantModalOpen, setIsAIAssistantModalOpen] = useState(false);
  const [preWorkoutData, setPreWorkoutData] = useState<{ workout: Workout, previousLog: WorkoutLog } | null>(null);
  const [aiWorkoutTips, setAiWorkoutTips] = useState<AiWorkoutTips | null>(null);


  const [isPostWorkoutSummaryModalOpen, setIsPostWorkoutSummaryModalOpen] = useState(false);
  const [logForSummaryModal, setLogForSummaryModal] = useState<WorkoutLog | null>(null);
  const [workoutForSummaryModal, setWorkoutForSummaryModal] = useState<Workout | null>(null);
  const [isNewCompletion, setIsNewCompletion] = useState(false);

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
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isAiUpsellModalOpen, setIsAiUpsellModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState<boolean>(false);


  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<OneOnOneSession | null>(null);
  const [showMeetingToast, setShowMeetingToast] = useState(false);
  const [showIncompleteProfileBanner, setShowIncompleteProfileBanner] = useState(false);

  const [inProgressWorkout, setInProgressWorkout] = useState<InProgressWorkout | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [workoutIntent, setWorkoutIntent] = useState<WorkoutCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [newlyAchievedClub, setNewlyAchievedClub] = useState<AchievementDefinition | null>(null);

  const mainContentRef = useRef<HTMLDivElement>(null);
  const activityViewRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(() => 
    `${LOCAL_STORAGE_KEYS.IN_PROGRESS_WORKOUT}_${currentParticipantId}`, 
    [currentParticipantId]
  );

  useEffect(() => {
    setParticipantModalOpeners({
        openGoalModal: () => setIsGoalModalOpen(true),
        openCommunityModal: () => setIsCommunityModalOpen(true),
        openFlowModal: () => setIsFlowModalOpen(true),
        openAiReceptModal: () => setIsAiReceptModalOpen(true),
    });
  }, [setParticipantModalOpeners, setIsGoalModalOpen, setIsCommunityModalOpen, setIsFlowModalOpen, setIsAiReceptModalOpen]);

  useEffect(() => {
    const rawData = localStorage.getItem(storageKey);
    if (rawData) {
        try {
            const parsedData: InProgressWorkout = JSON.parse(rawData);
            setInProgressWorkout(parsedData);
        } catch (e) {
            console.error("Failed to parse in-progress workout data", e);
            localStorage.removeItem(storageKey);
        }
    }
  }, [storageKey]);

  const handleDeleteInProgressWorkout = () => {
    localStorage.removeItem(storageKey);
    setInProgressWorkout(null);
  };
  
  const handleResumeWorkout = () => {
    if (!inProgressWorkout) return;

    let workoutTemplate = workouts.find(w => w.id === inProgressWorkout.workoutId);
    
    if (!workoutTemplate && inProgressWorkout.selectedExercisesForModifiable) {
        workoutTemplate = {
            id: inProgressWorkout.workoutId,
            title: inProgressWorkout.workoutTitle,
            category: 'Annat',
            isPublished: false,
            isModifiable: true,
            blocks: [{ id: crypto.randomUUID(), name: "Valda Övningar", exercises: inProgressWorkout.selectedExercisesForModifiable }]
        };
    }

    if (!workoutTemplate) {
        alert("Kunde inte hitta passmallen för det pågående passet. Utkastet tas bort.");
        handleDeleteInProgressWorkout();
        return;
    }

    const logToEdit: WorkoutLog = {
        type: 'workout',
        id: 'in-progress-session',
        workoutId: inProgressWorkout.workoutId,
        participantId: currentParticipantId,
        completedDate: new Date().toISOString(),
        entries: inProgressWorkout.logEntries.map(([exerciseId, loggedSets]) => ({
            exerciseId,
            loggedSets
        })),
        postWorkoutComment: inProgressWorkout.postWorkoutComment,
        moodRating: inProgressWorkout.moodRating ?? undefined,
        selectedExercisesForModifiable: inProgressWorkout.selectedExercisesForModifiable,
    };
    
    handleStartWorkout(workoutTemplate, true, logToEdit);
    setInProgressWorkout(null);
    setShowResumeModal(false);
    setWorkoutIntent(null);
  };

  const handleAttemptLogWorkout = (category: WorkoutCategory) => {
    if (inProgressWorkout) {
        setWorkoutIntent(category);
        setShowResumeModal(true);
    } else {
        setWorkoutCategoryFilter(category);
        setIsSelectWorkoutModalOpen(true);
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

  const openWorkoutForEditing = (logToEdit: WorkoutLog) => {
    const workoutTemplate = workouts.find(w => w.id === logToEdit.workoutId);

    // FIX: Calculate and set the correct reference log for editing.
    // The reference log is the most recent log of the same workout template that was completed *before* the log being edited.
    const referenceLog = myWorkoutLogs
        .filter(l => l.workoutId === logToEdit.workoutId && new Date(l.completedDate) < new Date(logToEdit.completedDate))
        .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
    setLogForReference(referenceLog);


    if (!workoutTemplate && !logToEdit.selectedExercisesForModifiable) {
        alert("Kunde inte hitta passmallen för denna logg och ingen anpassad struktur är sparad. Redigering är inte möjlig.");
        return;
    }
    
    if (logToEdit.selectedExercisesForModifiable && logToEdit.selectedExercisesForModifiable.length > 0) {
        const workoutForForm: Workout = {
            id: logToEdit.workoutId,
            title: workoutTemplate?.title || 'Anpassat Pass',
            category: workoutTemplate?.category || 'Annat',
            isPublished: false,
            isModifiable: true,
            blocks: [{ id: crypto.randomUUID(), name: "Valda Övningar", exercises: logToEdit.selectedExercisesForModifiable }]
        };
        handleStartWorkout(workoutForForm, true, logToEdit);
    } else if (workoutTemplate) {
        handleStartWorkout(workoutTemplate, true, logToEdit);
    } else {
        console.error("Logikfel i openWorkoutForEditing: Varken mall eller sparade övningar hittades.");
    }
  };

  const handleEditLog = (logToEdit: ActivityLog) => {
    if (isLogFormOpen) return;

    if (logToEdit.type === 'workout') {
        const workoutLog = logToEdit as WorkoutLog;

        // If the log has no entries and no summary, it's likely just a mood/comment entry.
        // Opening the summary modal for this wouldn't show much. Fall back to edit form.
        if (!workoutLog.postWorkoutSummary && workoutLog.entries.length === 0) {
            openWorkoutForEditing(workoutLog);
            return;
        }

        // Default action: show the summary modal (the "diploma").
        const workoutTemplateForSummary = workouts.find(w => w.id === workoutLog.workoutId);
        
        setLogForSummaryModal(workoutLog);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsNewCompletion(false);
        setIsPostWorkoutSummaryModalOpen(true);

    } else if (logToEdit.type === 'general') {
        setLastGeneralActivity(logToEdit as GeneralActivityLog);
        setIsGeneralActivitySummaryOpen(true);
    }
  };
  
  // Memoized data for the current participant
  const participantProfile = useMemo(() => participantDirectory.find(p => p.id === currentParticipantId), [participantDirectory, currentParticipantId]);
  const myWorkoutLogs = useMemo(() => workoutLogs.filter(l => l.participantId === currentParticipantId).sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()), [workoutLogs, currentParticipantId]);
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

  useEffect(() => {
    setProfileOpener({ open: () => setIsProfileModalOpen(true) });
    return () => setProfileOpener(null);
  }, [setProfileOpener]);

  useEffect(() => {
    const membershipName = myMembership?.name?.toLowerCase();
    const isStartProgram = membershipName === 'startprogram';

    if (isStartProgram) {
        const isProfileComplete = !!(participantProfile?.age && participantProfile?.gender && participantProfile?.gender !== '-');
        if (!isProfileComplete) {
            const prospectModalShownKey = `flexibel_prospectProfileModalShown_${currentParticipantId}`;
            const hasBeenShown = localStorage.getItem(prospectModalShownKey) === 'true';
            setShowIncompleteProfileBanner(hasBeenShown);
        } else {
            setShowIncompleteProfileBanner(false);
        }
    } else {
        setShowIncompleteProfileBanner(false);
    }
}, [participantProfile, myMembership, currentParticipantId]);


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

  const nextMeetingForCard = useMemo(() => {
    if (myUpcomingSessions.length === 0) {
      return null;
    }
    const nextSession = myUpcomingSessions[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999); // Include the entire 7th day

    if (new Date(nextSession.startTime) <= sevenDaysFromNow) {
      return nextSession;
    }
    return null;
  }, [myUpcomingSessions]);

  // APP BADGING LOGIC
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      const pendingRequestCount = connections.filter(
        c => c.receiverId === currentParticipantId && c.status === 'pending'
      ).length;

      const totalUnreadCount = pendingRequestCount + (newFlowItemsCount || 0);

      try {
        if (totalUnreadCount > 0) {
          (navigator as any).setAppBadge(totalUnreadCount);
        } else {
          (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.error('App Badging API error:', error);
      }
    }
  }, [connections, currentParticipantId, newFlowItemsCount]);

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

    const findLastValue = (key: keyof Omit<ParticipantConditioningStat, 'id'|'lastUpdated'|'participantId'|'reactions'|'comments'>): {value: string, date: string} | null => {
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
      // FIX: The sort function was comparing 'b.lastUpdated' with 'a.setDate', which does not exist on ParticipantPhysiqueStat. Corrected to use 'a.lastUpdated'.
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
    const wasLoggedThisWeek = () => {
        if (!myMentalWellbeing?.lastUpdated) return false;
        // Check if the last update was in the same week as today. Monday is the start of the week.
        return dateUtils.isSameWeek(new Date(myMentalWellbeing.lastUpdated), new Date());
    };

    if (!wasLoggedThisWeek()) {
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
    setLogForReference(undefined);
    setCurrentWorkoutForForm(null);

    if (logWithSummary.entries.length > 0) {
        setLogForSummaryModal(logWithSummary);
        const workoutTemplateForSummary = workouts.find(w => w.id === logWithSummary.workoutId);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsNewCompletion(true);
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
    setIsNewCompletion(false);
    openMentalCheckinIfNeeded();
  };
  
  const handleEditLogFromSummary = () => {
    if (!logForSummaryModal) return;
    setIsPostWorkoutSummaryModalOpen(false);
    openWorkoutForEditing(logForSummaryModal);
  };

  const isAiEnabled = useMemo(() => {
    return myMembership?.type === 'subscription';
  }, [myMembership]);
  
  const handleStartWorkout = (workout: Workout, isEditing: boolean = false, logToEdit?: WorkoutLog) => {
    // Handle modifiable workouts where user needs to select exercises first.
    // This only applies when starting a *new* session, not editing an existing one.
    if (workout.isModifiable && workout.exerciseSelectionOptions && !isEditing) {
        setWorkoutForExerciseSelection(workout);
        setIsExerciseSelectionModalOpen(true);
        setIsSelectWorkoutModalOpen(false); 
        return;
    }

    // --- Editing Flow ---
    if (isEditing && logToEdit) {
        // Note: logForReference is already set by `openWorkoutForEditing`
        setIsNewSessionForLog(false);
        setAiWorkoutTips(null); // No pre-workout tips when editing.
        setCurrentWorkoutLog(logToEdit);
        setCurrentWorkoutForForm(workout);
        setIsLogFormOpen(true);
        setIsSelectWorkoutModalOpen(false);
    } 
    // --- New Session Flow ---
    else {
        // Find the most recent previous log of this workout template to use for reference.
        const previousLogForThisTemplate = myWorkoutLogs
            .filter(l => l.workoutId === workout.id)
            .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
        
        setIsNewSessionForLog(true);
        setLogForReference(undefined); // Clear reference log for new sessions

        // If a previous log exists and AI is enabled, show the AI assistant.
        if (previousLogForThisTemplate && ai && isAiEnabled && isOnline) {
            setPreWorkoutData({ workout, previousLog: previousLogForThisTemplate });
            setIsAIAssistantModalOpen(true);
            setIsSelectWorkoutModalOpen(false);
        } else {
            // Otherwise, just open the log form for a new session.
            setAiWorkoutTips(null);
            setCurrentWorkoutLog(previousLogForThisTemplate); // Pass for placeholder values ("last time you did...")
            setCurrentWorkoutForForm(workout);
            setIsLogFormOpen(true);
            setIsSelectWorkoutModalOpen(false);
        }
    }
    
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
};

  const handleFabPrimaryAction = () => {
    setIsFabMenuOpen(prev => !prev);
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
        profileData: Partial<Pick<ParticipantProfile, 'name' | 'age' | 'gender' | 'enableLeaderboardParticipation' | 'isSearchable' | 'locationId' | 'enableInBodySharing' | 'enableFssSharing' | 'photoURL'>>
    ) => {
        try {
            await updateParticipantProfile(currentParticipantId, profileData);
        } catch (error) {
            alert("Ett fel uppstod när profilen skulle sparas. Dina ändringar har inte sparats.");
        }
    };
    
    const handleSaveGoals = useCallback(async (
        goalData: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>,
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean
    ) => {
        const goalTextChanged = (latestActiveGoal?.fitnessGoals || '') !== goalData.fitnessGoals;
        const preferencesChanged = (latestActiveGoal?.preferences || '') !== (goalData.preferences || '');
        const hasMeaningfulGoal = goalData.fitnessGoals && goalData.fitnessGoals !== "Inga specifika mål satta";
        const shouldTriggerAi = hasMeaningfulGoal && (!latestActiveGoal?.aiPrognosis || goalTextChanged || preferencesChanged || markLatestGoalAsCompleted);
        
        let aiPrognosisText: string | undefined = undefined;
    
        if (shouldTriggerAi) {
            if (!ai || !isAiEnabled || !isOnline) {
                if (!isAiEnabled) {
                    setIsAiUpsellModalOpen(true);
                }
                throw new Error("AI is not available, enabled, or the user is offline.");
            }
    
            setIsLoadingAiFeedback(true);
            setAiFeedback(null);
            setAiFeedbackError(null);
            setCurrentAiModalTitle("Coachens tips för att du ska nå ditt mål");
            setIsAiFeedbackModalOpen(true);
    
            const prompt = `Du är "Flexibot", en AI-coach och digital träningskompis från Flexibel Hälsostudio. Din roll är att ge en personlig, motiverande och vetenskapligt grundad prognos och rekommendation (ett "recept") för en medlem som precis satt ett nytt mål. Svaret ska vara på svenska och formaterat med Markdown (## Rubriker, **fet text**, * punktlistor).
    
            Medlemmens nya mål:
            - Målbeskrivning: "${goalData.fitnessGoals}"
            - Mål (pass/vecka): ${goalData.workoutsPerWeekTarget}
            - Måldatum: ${goalData.targetDate ? new Date(goalData.targetDate).toLocaleDateString('sv-SE') : 'Inget satt'}
            - Preferenser/Övrigt: "${goalData.preferences || 'Inga'}"
    
            Ditt uppdrag: Skapa ett inspirerande "recept" för att hjälpa medlemmen att lyckas. Inkludera följande sektioner:
            1.  **## Prognos & Pepp:** Ge en kort, positiv bedömning av målets realism och uppmuntra medlemmen.
            2.  **## Nyckelpass för Framgång:** Rekommendera 2-3 specifika pass-typer från Flexibels utbud som är extra viktiga för att nå detta mål. Tillgängliga pass: PT-BAS (fokus baslyft/styrka), PT-GRUPP (styrka & kondition), WORKOUT (funktionell styrka & uthållighet), HIIT (högintensiv kondition), Yin Yoga (rörlighet/återhämtning), Postural Yoga (hållning/balans), Mindfulness (mentalt fokus).
            3.  **## Att Tänka På:** Ge 2-3 konkreta, handlingsbara tips relaterade till målet. Om du ger kostråd, rekommendera gärna att de kan använda ett verktyg som [kostloggen.se](https://kostloggen.se) för att få en bra överblick över sitt intag.
            4.  **## Lycka Till!** Avsluta med en positiv och motiverande hälsning.
    
            Håll en stöttande och professionell ton. Undvik medicinska råd.`;
    
            try {
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                aiPrognosisText = response.text;
                setAiFeedback(aiPrognosisText);
            } catch (err) {
                console.error("Error generating AI goal prognosis:", err);
                setAiFeedbackError("Kunde inte generera en prognos för ditt mål. Försök igen senare.");
                throw err;
            } finally {
                setIsLoadingAiFeedback(false);
            }
        }
    
        setParticipantGoals(prevGoals => {
            let newGoalsArray = [...prevGoals];
            const participantOldGoals = newGoalsArray.filter(g => g.participantId === currentParticipantId);
    
            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = participantOldGoals
                    .filter(g => !g.isCompleted)
                    .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                
                if (latestExistingGoal) {
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
            
            const latestNonCompletedGoal = participantOldGoals
                .filter(g => !g.isCompleted)
                .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    
            const isUpdatingExistingGoal = latestNonCompletedGoal &&
                latestNonCompletedGoal.fitnessGoals === goalData.fitnessGoals &&
                latestNonCompletedGoal.workoutsPerWeekTarget === goalData.workoutsPerWeekTarget &&
                (latestNonCompletedGoal.preferences || '') === (goalData.preferences || '') &&
                (latestNonCompletedGoal.targetDate || '') === (goalData.targetDate || '') &&
                !markLatestGoalAsCompleted;
    
            if (isUpdatingExistingGoal) {
                newGoalsArray = newGoalsArray.map(g => 
                    g.id === latestNonCompletedGoal.id 
                    ? { ...g, coachPrescription: goalData.coachPrescription, aiPrognosis: aiPrognosisText ?? g.aiPrognosis } 
                    : g
                );
            } else if (goalData.fitnessGoals !== "Inga specifika mål satta" || 
                (goalData.fitnessGoals === "Inga specifika mål satta" && !markLatestGoalAsCompleted)) {
                
                const newGoal: ParticipantGoalData = {
                    id: crypto.randomUUID(),
                    participantId: currentParticipantId,
                    fitnessGoals: goalData.fitnessGoals,
                    workoutsPerWeekTarget: goalData.workoutsPerWeekTarget,
                    preferences: goalData.preferences,
                    targetDate: goalData.targetDate,
                    coachPrescription: goalData.coachPrescription,
                    currentWeeklyStreak: latestNonCompletedGoal?.currentWeeklyStreak || 0,
                    lastStreakUpdateEpochWeekId: latestNonCompletedGoal?.lastStreakUpdateEpochWeekId || dateUtils.getEpochWeekId(new Date()),
                    setDate: new Date().toISOString(),
                    isCompleted: false,
                    aiPrognosis: aiPrognosisText,
                };
                newGoalsArray.push(newGoal);
            }
            return newGoalsArray;
        });
    }, [ai, isAiEnabled, isOnline, latestActiveGoal, currentParticipantId, setParticipantGoals, setGoalCompletionLogs]);
    
    const handleSaveGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'participantId'>) => {
        const newActivity: GeneralActivityLog = {
            ...activityData,
            id: crypto.randomUUID(),
            participantId: currentParticipantId,
            completedDate: new Date().toISOString(),
            type: 'general',
        };
        setGeneralActivityLogs(prev => [...prev, newActivity]);
        setLastGeneralActivity(newActivity);
        setIsGeneralActivitySummaryOpen(true);
    };

    const handleFinalizeGeneralActivitySummary = () => {
        setIsGeneralActivitySummaryOpen(false);
        setLastGeneralActivity(null);
        openMentalCheckinIfNeeded();
    };
    
    const handleOpenPhysiqueFromStrength = () => {
        setIsStrengthModalOpen(false);
        // Use a small delay to ensure a smooth transition between modals
        setTimeout(() => {
          setIsPhysiqueModalOpen(true);
        }, 150);
      };

    // New useEffect for gamification
    useEffect(() => {
        if (!participantProfile || isNewUser) return;

        // Check for new club memberships
        const newAchievements = checkAndAwardClubMemberships(
            participantProfile,
            allActivityLogs,
            myStrengthStats,
            myConditioningStats,
            myClubMemberships,
            workouts
        );

        if (newAchievements.length > 0) {
            setClubMemberships(prev => [...prev, ...newAchievements]);
            
            // Show toast for the first new achievement
            const firstNewClubId = newAchievements[0].clubId;
            const clubDef = CLUB_DEFINITIONS.find(c => c.id === firstNewClubId);
            if (clubDef) {
                setNewlyAchievedClub({
                    id: clubDef.id,
                    name: clubDef.name,
                    description: clubDef.description,
                    icon: clubDef.icon
                });
            }
        }

    }, [allActivityLogs, myStrengthStats, myConditioningStats, participantProfile, myClubMemberships, workouts, setClubMemberships, isNewUser]);

    return (
        <div className="bg-gray-100 bg-dotted-pattern bg-dotted-size bg-fixed min-h-screen">
        {isLogFormOpen && currentWorkoutForForm ? (
            <WorkoutLogForm
            ai={ai}
            workout={currentWorkoutForForm}
            allWorkouts={workouts}
            logForReferenceOrEdit={currentWorkoutLog}
            logForReference={logForReference}
            isNewSession={isNewSessionForLog}
            onSaveLog={handleSaveLog}
            onClose={() => setIsLogFormOpen(false)}
            latestGoal={latestGoal}
            participantProfile={participantProfile}
            latestStrengthStats={latestStrengthStats}
            myClubMemberships={myClubMemberships}
            aiTips={aiWorkoutTips}
            myWorkoutLogs={myWorkoutLogs}
            integrationSettings={integrationSettings}
            />
        ) : (
            <div className="pb-40">
                <div ref={mainContentRef} className="container mx-auto px-2 sm:px-4 py-4 space-y-3">
                    {inProgressWorkout && (
                        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded-r-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-down">
                            <div>
                                <h3 className="font-bold text-lg text-yellow-800">Pågående pass hittat!</h3>
                                <p className="text-base text-yellow-700">Vill du fortsätta passet "{inProgressWorkout.workoutTitle}"?</p>
                            </div>
                            <div className="flex gap-3 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="!text-red-600" onClick={() => setShowDeleteConfirm(true)}>
                                    Ta bort utkast
                                </Button>
                                <Button variant="primary" size="md" onClick={handleResumeWorkout}>
                                    Fortsätt passet
                                </Button>
                            </div>
                        </div>
                    )}
                    {showIncompleteProfileBanner && (
                        <WarningBanner 
                            message="Slutför din profil för att få tillgång till alla funktioner och mer precisa jämförelser!" 
                            type="warning"
                            buttonText="Slutför Profil"
                            onButtonClick={() => setIsProfileModalOpen(true)}
                        />
                    )}
                    {nextMeetingForCard && (
                        <UpcomingMeetingCard
                            session={nextMeetingForCard}
                            staffMember={staffMembers.find(s => s.id === nextMeetingForCard.coachId)}
                            onOpenModal={setSelectedSessionForModal}
                        />
                    )}

                    {isNewUser && (
                        <div className="p-4 bg-white rounded-xl shadow-lg border text-center">
                            <h2 className="text-2xl font-bold text-gray-800">Välkommen!</h2>
                            <p className="mt-2 text-lg text-gray-600">Sätt dina mål och logga ditt första pass för att komma igång.</p>
                        </div>
                    )}
                    
                    {latestActiveGoal && (
                        <GoalProgressCard goal={latestActiveGoal} logs={allActivityLogs} />
                    )}

                    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                            {/* Total Sessions Stat */}
                            <div className="flex items-center justify-center sm:justify-start px-2 sm:px-4">
                                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-green-100 text-green-700 mr-3 sm:mr-4">
                                    <TotalPassIcon />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Totalt Antal Pass</p>
                                    <p className="text-2xl sm:text-3xl font-bold text-gray-800">{allActivityLogs.length}</p>
                                </div>
                            </div>

                            {/* Current Streak Stat */}
                            <div className="flex items-center justify-center sm:justify-start px-2 sm:px-4">
                                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-green-100 text-green-700 mr-3 sm:mr-4">
                                    <StreakIcon />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Nuvarande Streak</p>
                                    <div className="flex items-baseline gap-x-1 sm:gap-x-2 flex-wrap">
                                        <p className="text-2xl sm:text-3xl font-bold text-gray-800">{latestActiveGoal?.currentWeeklyStreak || 0}</p>
                                        <p className="text-sm sm:text-lg font-bold text-gray-500">veckor</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <ToolCard 
                            title="Min Styrka"
                            description="Se dina 1RM, styrkenivåer och historik."
                            icon={<StrengthIcon />}
                            onClick={() => setIsStrengthModalOpen(true)}
                        />
                         <ToolCard 
                            title="Min Kondition"
                            description="Se och uppdatera dina konditionstester."
                            icon={<ConditioningIcon />}
                            onClick={() => setIsConditioningModalOpen(true)}
                        />
                         <ToolCard 
                            title="Min Kropp"
                            description="Se och uppdatera dina InBody-resultat."
                            icon={<BodyIcon />}
                            onClick={() => setIsPhysiqueModalOpen(true)}
                        />
                    </div>
                    <div ref={activityViewRef} className="scroll-mt-4">
                        <ParticipantActivityView
                            allActivityLogs={allActivityLogs}
                            allLogsForLeaderboards={allActivityLogsForLeaderboard}
                            workouts={workouts}
                            onViewLogSummary={handleEditLog}
                            onDeleteActivity={handleDeleteActivity}
                            activeGoal={latestActiveGoal}
                            strengthStatsHistory={myStrengthStats}
                            allStrengthStatsForLeaderboards={userStrengthStats}
                            conditioningStatsHistory={myConditioningStats}
                            physiqueHistory={myPhysiqueHistory}
                            clubMemberships={myClubMemberships}
                            allClubMemberships={clubMemberships}
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
                            locations={locations}
                            onCancelBooking={onCancelBooking}
                            integrationSettings={integrationSettings}
                        />
                    </div>
                </div>
                
                {participantProfile && (
                    <FabMenu
                        isOpen={isFabMenuOpen}
                        onToggle={handleFabPrimaryAction}
                        onClose={() => setIsFabMenuOpen(false)}
                        workouts={workouts}
                        currentParticipantId={currentParticipantId}
                        onAttemptLogWorkout={handleAttemptLogWorkout}
                        onOpenLogGeneralActivityModal={() => setIsLogGeneralActivityModalOpen(true)}
                        membership={myMembership}
                        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
                        onOpenBookingModal={() => setIsBookingModalOpen(true)}
                        integrationSettings={integrationSettings}
                        onOpenQrScanner={(mode) => setIsQrScannerOpen(true)}
                        workoutCategories={workoutCategories}
                        myWorkoutLogs={myWorkoutLogs}
                        onOpenAICoachModal={() => setIsAICoachModalOpen(true)}
                    />
                )}
            </div>
        )}
        <InstallPwaBanner />
        <AchievementToast achievement={newlyAchievedClub} onClose={() => setNewlyAchievedClub(null)} />
        <FeedbackPromptToast 
            isOpen={showFeedbackPrompt} 
            onAccept={() => {
                setShowFeedbackPrompt(false);
                setIsAiFeedbackModalOpen(true);
            }}
            onDecline={() => setShowFeedbackPrompt(false)}
            message="Vill du ha personlig feedback från AI-coachen baserat på ditt senaste pass?"
        />
        <AIProgressFeedbackModal 
            isOpen={isAiFeedbackModalOpen} 
            onClose={() => setIsAiFeedbackModalOpen(false)}
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
            isNewCompletion={isNewCompletion}
        />
        <LogGeneralActivityModal 
            isOpen={isLogGeneralActivityModalOpen}
            onClose={() => setIsLogGeneralActivityModalOpen(false)}
            onSaveActivity={handleSaveGeneralActivity}
        />
        <GeneralActivitySummaryModal 
            isOpen={isGeneralActivitySummaryOpen}
            onClose={handleFinalizeGeneralActivitySummary}
            activity={lastGeneralActivity}
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
        <ExerciseSelectionModal
            isOpen={isExerciseSelectionModalOpen}
            onClose={() => setIsExerciseSelectionModalOpen(false)}
            options={workoutForExerciseSelection?.exerciseSelectionOptions}
            onConfirm={handleExerciseSelectionConfirm}
        />
        <MentalWellbeingModal
            isOpen={isMentalCheckinOpen}
            onClose={() => setIsMentalCheckinOpen(false)}
            currentWellbeing={myMentalWellbeing || null}
            participantId={participantProfile?.id}
            onSave={(wellbeingData) => {
                setParticipantMentalWellbeing(prev => {
                    const existing = prev.find(w => w.id === wellbeingData.id);
                    if (existing) {
                        return prev.map(w => w.id === wellbeingData.id ? wellbeingData : w);
                    }
                    return [...prev, wellbeingData];
                });
            }}
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
            isOnline={isOnline}
        />
        <StrengthComparisonModal
            isOpen={isStrengthModalOpen}
            onClose={() => setIsStrengthModalOpen(false)}
            participantProfile={participantProfile}
            latestGoal={latestGoal}
            userStrengthStatsHistory={myStrengthStats}
            clubMemberships={myClubMemberships}
            onSaveStrengthStats={(stats) => setUserStrengthStats(prev => [...prev.filter(s => s.participantId !== currentParticipantId), stats])}
            onOpenPhysiqueModal={handleOpenPhysiqueFromStrength}
        />
        <ConditioningStatsModal
            isOpen={isConditioningModalOpen}
            onClose={() => setIsConditioningModalOpen(false)}
            statsHistory={myConditioningStats}
            participantProfile={participantProfile}
            clubMemberships={myClubMemberships}
            onSaveStats={(statsData) => {
                const newStat: ParticipantConditioningStat = {
                    id: crypto.randomUUID(),
                    participantId: currentParticipantId,
                    ...statsData,
                };
                setUserConditioningStatsHistory(prev => [...prev, newStat]);
            }}
        />
        <PhysiqueManagerModal
            isOpen={isPhysiqueModalOpen}
            onClose={() => setIsPhysiqueModalOpen(false)}
            currentProfile={participantProfile}
            onSave={(physiqueData) => {
                const newHistoryEntry: ParticipantPhysiqueStat = {
                    id: crypto.randomUUID(),
                    participantId: currentParticipantId,
                    lastUpdated: new Date().toISOString(),
                    ...physiqueData,
                };
                setParticipantPhysiqueHistory(prev => [...prev, newHistoryEntry]);
                updateParticipantProfile(currentParticipantId, physiqueData);
            }}
        />
        <CommunityModal
            isOpen={isCommunityModalOpen}
            onClose={() => setIsCommunityModalOpen(false)}
            currentParticipantId={currentParticipantId}
            allParticipants={participantDirectory}
            connections={connections}
            setConnections={setConnections}
        />
        <FlowModal 
            isOpen={isFlowModalOpen}
            onClose={() => {
                setIsFlowModalOpen(false);
                setLastFlowViewTimestamp(new Date().toISOString());
            }}
            currentUserId={currentParticipantId}
            allParticipants={participantDirectory}
            connections={connections}
            workoutLogs={workoutLogs}
            generalActivityLogs={generalActivityLogs}
            goalCompletionLogs={goalCompletionLogs}
            coachEvents={coachEvents}
            workouts={workouts}
            clubMemberships={clubMemberships}
            participantGoals={participantGoals}
            participantPhysiqueHistory={participantPhysiqueHistory}
            userStrengthStats={userStrengthStats}
            leaderboardSettings={leaderboardSettings}
            onToggleReaction={onToggleReaction}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onToggleCommentReaction={onToggleCommentReaction}
            locations={locations}
            userConditioningStatsHistory={userConditioningStatsHistory}
        />
        <UpgradeModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
        />
        <UpgradeModal
            isOpen={isAiUpsellModalOpen}
            onClose={() => setIsAiUpsellModalOpen(false)}
            title="Uppgradera för AI-recept!"
        >
            <p className="text-lg text-gray-600">
                Funktionen för att få ett AI-genererat recept för att nå ditt mål är en del av våra premium-medlemskap.
            </p>
        </UpgradeModal>
        {integrationSettings.isBookingEnabled &&
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
                membership={myMembership}
                onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
            />
        }
        <QrScannerModal
            isOpen={isQrScannerOpen}
            onClose={() => setIsQrScannerOpen(false)}
            onWorkoutScan={(workoutData) => {
                const tempWorkout: Workout = {
                    ...workoutData,
                    id: crypto.randomUUID(),
                    isPublished: false,
                    isModifiable: true,
                };
                handleStartWorkout(tempWorkout);
            }}
            onCheckinScan={(checkinData) => {
                onCheckInParticipant(checkinData.locationId);
                setCheckinSuccess(true);
            }}
        />
        {participantProfile &&
            <CheckinConfirmationModal
                isOpen={checkinSuccess}
                onClose={() => setCheckinSuccess(false)}
                participantName={participantProfile.name || "Medlem"}
            />
        }
        {selectedSessionForModal && (
            <MeetingDetailsModal
                isOpen={!!selectedSessionForModal}
                onClose={() => setSelectedSessionForModal(null)}
                session={selectedSessionForModal}
                coach={staffMembers.find(s => s.id === selectedSessionForModal.coachId) || null}
                currentUserId={currentParticipantId}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onToggleCommentReaction={onToggleCommentReaction}
            />
        )}
        <ConfirmationModal
            isOpen={showResumeModal}
            onClose={() => setShowResumeModal(false)}
            onConfirm={handleResumeWorkout}
            title="Fortsätta påbörjat pass?"
            message={
                <>
                  <p>Du har ett påbörjat pass: "{inProgressWorkout?.workoutTitle}".</p>
                  <p className="mt-2">Vill du fortsätta logga det eller starta ett nytt pass från kategorin '{workoutIntent}'?</p>
                </>
            }
            confirmButtonText="Fortsätt passet"
            cancelButtonText="Starta nytt"
        />
         <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={() => {
                handleDeleteInProgressWorkout();
                setShowDeleteConfirm(false);
            }}
            title="Ta bort utkast?"
            message={`Är du säker på att du vill ta bort det pågående utkastet för "${inProgressWorkout?.workoutTitle}"? Detta kan inte ångras.`}
            confirmButtonText="Ja, ta bort"
            cancelButtonText="Avbryt"
        />
        {preWorkoutData && ai && participantProfile && (
            <AIAssistantModal
                isOpen={isAIAssistantModalOpen}
                onClose={() => {
                    setIsAIAssistantModalOpen(false);
                    setPreWorkoutData(null);
                }}
                onContinue={handleContinueFromAIAssistant}
                ai={ai}
                workout={preWorkoutData.workout}
                previousLog={preWorkoutData.previousLog}
                participant={participantProfile}
            />
        )}
        <AICoachModal
            isOpen={isAICoachModalOpen}
            onClose={() => setIsAICoachModalOpen(false)}
            ai={ai}
            participantProfile={participantProfile}
            myWorkoutLogs={myWorkoutLogs}
            myGeneralActivityLogs={myGeneralActivityLogs}
            latestGoal={latestActiveGoal}
            allWorkouts={workouts}
        />
    </div>
    );
};
