import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog, ActivityLog,
    ParticipantGoalData, ParticipantProfile,
    UserStrengthStat, ParticipantConditioningStat,
    UserRole, ParticipantMentalWellbeing, Exercise, GoalCompletionLog, ParticipantGamificationStats, WorkoutCategory, PostWorkoutSummaryData, NewPB, ParticipantClubMembership, LeaderboardSettings, CoachEvent, GenderOption, Connection, Reaction, Comment, NewBaseline, ParticipantPhysiqueStat, LiftType, Location, Membership, StaffMember, OneOnOneSession, IntegrationSettings,
    GroupClassDefinition, GroupClassSchedule, ParticipantBooking, WorkoutCategoryDefinition
} from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { LOCAL_STORAGE_KEYS } from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { calculateUpdatedStreakAndGamification } from '../../services/gamificationService';
import { calculatePostWorkoutSummary, findAndUpdateStrengthStats } from '../../services/workoutService';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import { LoadingSpinner } from '../LoadingSpinner';
import { Modal } from '../Modal';

const WorkoutLogForm = lazy(() => import('./WorkoutLogForm').then(module => ({ default: module.WorkoutLogForm })));
const AIProgressFeedbackModal = lazy(() => import('./AIProgressFeedbackModal').then(module => ({ default: module.AIProgressFeedbackModal })));
const PostWorkoutSummaryModal = lazy(() => import('./PostWorkoutSummaryModal').then(module => ({ default: module.PostWorkoutSummaryModal })));
const LogGeneralActivityModal = lazy(() => import('./LogGeneralActivityModal').then(module => ({ default: module.LogGeneralActivityModal })));
const GeneralActivitySummaryModal = lazy(() => import('./GeneralActivitySummaryModal').then(module => ({ default: module.GeneralActivitySummaryModal })));
const FeedbackPromptToast = lazy(() => import('./FeedbackPromptToast').then(module => ({ default: module.FeedbackPromptToast })));
const InfoModal = lazy(() => import('./InfoModal').then(module => ({ default: module.InfoModal })));
const FabMenu = lazy(() => import('./FabMenu').then(module => ({ default: module.FabMenu })));
const SelectWorkoutModal = lazy(() => import('./SelectWorkoutModal').then(module => ({ default: module.SelectWorkoutModal })));
const ExerciseSelectionModal = lazy(() => import('./ExerciseSelectionModal').then(module => ({ default: module.ExerciseSelectionModal })));
const MentalWellbeingModal = lazy(() => import('./MentalWellbeingModal').then(module => ({ default: module.MentalWellbeingModal })));
const ProfileModal = lazy(() => import('./ProfileGoalModal').then(module => ({ default: module.ProfileModal })));
const GoalModal = lazy(() => import('./GoalModal').then(module => ({ default: module.GoalModal })));
const StrengthComparisonModal = lazy(() => import('./StrengthComparisonModal').then(module => ({ default: module.StrengthComparisonModal })));
const ConditioningStatsModal = lazy(() => import('./ConditioningStatsModal').then(module => ({ default: module.ConditioningStatsModal })));
const PhysiqueManagerModal = lazy(() => import('./PhysiqueManagerModal').then(module => ({ default: module.PhysiqueManagerModal })));
const CommunityModal = lazy(() => import('./CommunityModal').then(module => ({ default: module.CommunityModal })));
const MeetingDetailsModal = lazy(() => import('./MeetingDetailsModal').then(module => ({ default: module.MeetingDetailsModal })));
const UpgradeModal = lazy(() => import('./UpgradeModal').then(module => ({ default: module.UpgradeModal })));
const BookingView = lazy(() => import('./BookingView').then(module => ({ default: module.BookingView })));
const QrScannerModal = lazy(() => import('./QrScannerModal').then(module => ({ default: module.QrScannerModal })));
const CheckinConfirmationModal = lazy(() => import('./CheckinConfirmationModal').then(module => ({ default: module.CheckinConfirmationModal })));
const AIAssistantModal = lazy(() => import('./AIAssistantModal').then(module => ({ default: module.AIAssistantModal })));
const FlowModal = lazy(() => import('./FlowModal').then(module => ({ default: module.FlowModal })));
const InstallPwaBanner = lazy(() => import('./InstallPwaBanner').then(module => ({ default: module.InstallPwaBanner })));

import { ParticipantActivityView } from './ParticipantActivityView';
import { FixedHeaderAndTools } from './FixedHeaderAndTools';
import { AiWorkoutTips } from './AIAssistantModal';

const API_KEY = process.env.API_KEY;

interface ParticipantAreaProps {
  currentParticipantId: string;
  onSetRole: (role: UserRole | null) => void;
  onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onCheckInParticipant: (bookingId: string) => void;
  setProfileOpener: (opener: { open: () => void } | null) => void;
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
    const { isOnline } = useNetworkStatus();

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


  const mainContentRef = useRef<HTMLDivElement>(null);
  const activityViewRef = useRef<HTMLDivElement>(null);

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
        if (!workoutLog.postWorkoutSummary && workoutLog.entries.length === 0) {
            openWorkoutForEditing(workoutLog);
            return;
        }

        const workoutTemplateForSummary = workouts.find(w => w.id === workoutLog.workoutId);
        
        setLogForSummaryModal(workoutLog);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsPostWorkoutSummaryModalOpen(true);

    } else if (logToEdit.type === 'general') {
        setLastGeneralActivity(logToEdit as GeneralActivityLog);
        setIsGeneralActivitySummaryOpen(true);
    }
  };
  
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

  useEffect(() => {
    setProfileOpener({ open: () => setIsProfileModalOpen(true) });
    return () => setProfileOpener(null);
  }, [setProfileOpener]);

  useEffect(() => {
    if (participantProfile?.isProspect) {
        const isProfileComplete = !!(participantProfile.age && participantProfile.gender && participantProfile.gender !== '-');
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
}, [participantProfile, currentParticipantId]);


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

  useEffect(() => {
    if ('setAppBadge' in navigator) {
      const pendingRequestCount = connections.filter(
        c => c.receiverId === currentParticipantId && c.status === 'pending'
      ).length;

      try {
        if (pendingRequestCount > 0) {
          (navigator as any).setAppBadge(pendingRequestCount);
        } else {
          (navigator as any).clearAppBadge();
        }
      } catch (error) {
        console.error('App Badging API error:', error);
      }
    }
  }, [connections, currentParticipantId]);

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
    return [...myStrengthStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
  }, [myStrengthStats]);

  const openMentalCheckinIfNeeded = useCallback(() => {
    const wasLoggedThisWeek = () => {
        if (!myMentalWellbeing?.lastUpdated) return false;
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

    const summary = calculatePostWorkoutSummary(logWithParticipantId, workouts, myWorkoutLogs, latestStrengthStats);
    const logWithSummary = logWithParticipantId.entries.length > 0
        ? { ...logWithParticipantId, postWorkoutSummary: summary }
        : logWithParticipantId;

    const { needsUpdate, updatedStats } = findAndUpdateStrengthStats(logWithParticipantId, workouts, latestStrengthStats);

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

    const existingLogIndex = workoutLogs.findIndex(l => l.id === logWithSummary.id);
    const updatedWorkoutLogsList = existingLogIndex > -1
        ? workoutLogs.map((l, index) => index === existingLogIndex ? logWithSummary : l)
        : [...workoutLogs, logWithSummary];
    
    setWorkoutLogs(updatedWorkoutLogsList);
    
    const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(myParticipantGoals, myGamificationStats, participantProfile.id, [...updatedWorkoutLogsList, ...myGeneralActivityLogs, ...myGoalCompletionLogs]);
    setParticipantGoals(prev => [...prev.filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
    if (updatedGamificationStats) {
      setParticipantGamificationStats(prev => [...prev.filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
    }

    setIsLogFormOpen(false);
    setCurrentWorkoutLog(undefined);
    setCurrentWorkoutForForm(null);

    if (logWithSummary.entries.length > 0) {
        setLogForSummaryModal(logWithSummary);
        const workoutTemplateForSummary = workouts.find(w => w.id === logWithSummary.workoutId);
        setWorkoutForSummaryModal(workoutTemplateForSummary || null);
        setIsPostWorkoutSummaryModalOpen(true);
    } else if (logWithSummary.postWorkoutComment || logWithSummary.moodRating) {
        const workoutTemplateForSummary = workouts.find(w => w.id === logWithSummary.workoutId);
        const simpleSummaryLog: GeneralActivityLog = {
            type: 'general', id: logWithSummary.id, participantId: logWithSummary.participantId,
            activityName: `Kommentar för: ${workoutTemplateForSummary?.title || 'Okänt pass'}`,
            durationMinutes: 0, comment: logWithSummary.postWorkoutComment,
            moodRating: logWithSummary.moodRating, completedDate: logWithSummary.completedDate,
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
    if (!logForSummaryModal) return;
    setIsPostWorkoutSummaryModalOpen(false);
    openWorkoutForEditing(logForSummaryModal);
  };

  const isAiEnabled = useMemo(() => {
    return myMembership?.type === 'subscription' && (!myMembership.restrictedCategories || myMembership.restrictedCategories.length === 0);
  }, [myMembership]);
  
  const handleStartWorkout = (workout: Workout, isEditing: boolean = false, logToEdit?: WorkoutLog) => {
    if (workout.isModifiable && workout.exerciseSelectionOptions && !isEditing) {
        setWorkoutForExerciseSelection(workout);
        setIsExerciseSelectionModalOpen(true);
        setIsSelectWorkoutModalOpen(false); 
        return;
    }

    if (isEditing && logToEdit) {
        setIsNewSessionForLog(false);
        setAiWorkoutTips(null);
        setCurrentWorkoutLog(logToEdit);
        setCurrentWorkoutForForm(workout);
        setIsLogFormOpen(true);
        setIsSelectWorkoutModalOpen(false);
    } else {
        const previousLogForThisTemplate = myWorkoutLogs.filter(l => l.workoutId === workout.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
        setIsNewSessionForLog(true);
        if (previousLogForThisTemplate && ai && isAiEnabled && isOnline) {
            setPreWorkoutData({ workout, previousLog: previousLogForThisTemplate });
            setIsAIAssistantModalOpen(true);
            setIsSelectWorkoutModalOpen(false);
        } else {
            setAiWorkoutTips(null);
            setCurrentWorkoutLog(previousLogForThisTemplate);
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
                if (!isAiEnabled) { setIsAiUpsellModalOpen(true); }
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
                const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
                aiPrognosisText = response.text;
                setAiFeedback(aiPrognosisText);
            } catch (err) {
                console.error("Error generating AI goal prognosis:", err);
                setAiFeedbackError("Kunde inte generera en prognos för ditt mål. Försök igen senare.");
                throw err;
            } finally { setIsLoadingAiFeedback(false); }
        }
    
        setParticipantGoals(prevGoals => {
            let newGoalsArray = [...prevGoals];
            const participantOldGoals = newGoalsArray.filter(g => g.participantId === currentParticipantId);
    
            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = participantOldGoals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestExistingGoal) {
                    const newGoalCompletionLog: GoalCompletionLog = { type: 'goal_completion', id: crypto.randomUUID(), participantId: currentParticipantId, goalId: latestExistingGoal.id, goalDescription: latestExistingGoal.fitnessGoals, completedDate: new Date().toISOString() };
                    setGoalCompletionLogs(prev => [...prev, newGoalCompletionLog]);
                    newGoalsArray = newGoalsArray.map(g => g.id === latestExistingGoal.id ? { ...g, isCompleted: true, completedDate: new Date().toISOString() } : g);
                }
            }
            
            const latestNonCompletedGoal = participantOldGoals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    
            const isUpdatingExistingGoal = latestNonCompletedGoal && latestNonCompletedGoal.fitnessGoals === goalData.fitnessGoals && latestNonCompletedGoal.workoutsPerWeekTarget === goalData.workoutsPerWeekTarget && (latestNonCompletedGoal.preferences || '') === (goalData.preferences || '') && (latestNonCompletedGoal.targetDate || '') === (goalData.targetDate || '') && !markLatestGoalAsCompleted;
    
            if (isUpdatingExistingGoal) {
                newGoalsArray = newGoalsArray.map(g => g.id === latestNonCompletedGoal.id ? { ...g, coachPrescription: goalData.coachPrescription, aiPrognosis: aiPrognosisText ?? g.aiPrognosis } : g);
            } else if (goalData.fitnessGoals !== "Inga specifika mål satta" || (goalData.fitnessGoals === "Inga specifika mål satta" && !markLatestGoalAsCompleted)) {
                const newGoal: ParticipantGoalData = {
                    id: crypto.randomUUID(), participantId: currentParticipantId, fitnessGoals: goalData.fitnessGoals, workoutsPerWeekTarget: goalData.workoutsPerWeekTarget,
                    preferences: goalData.preferences, targetDate: goalData.targetDate, coachPrescription: goalData.coachPrescription,
                    currentWeeklyStreak: latestNonCompletedGoal?.currentWeeklyStreak || 0,
                    lastStreakUpdateEpochWeekId: latestNonCompletedGoal?.lastStreakUpdateEpochWeekId || dateUtils.getEpochWeekId(new Date()),
                    setDate: new Date().toISOString(), isCompleted: false, aiPrognosis: aiPrognosisText,
                };
                newGoalsArray.push(newGoal);
            }
            return newGoalsArray;
        });
    }, [ai, isAiEnabled, isOnline, latestActiveGoal, currentParticipantId, setParticipantGoals, setGoalCompletionLogs]);
    
    const handleSaveGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'completedDate' | 'type' | 'participantId'>) => {
        const newActivity: GeneralActivityLog = { ...activityData, id: crypto.randomUUID(), participantId: currentParticipantId, completedDate: new Date().toISOString(), type: 'general' };
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
        setTimeout(() => { setIsPhysiqueModalOpen(true); }, 150);
    };

    return (
        <div className="bg-gray-100 min-h-screen">
        {isLogFormOpen && currentWorkoutForForm ? (
            <Suspense fallback={<LoadingSpinner />}>
                <WorkoutLogForm
                    ai={ai} workout={currentWorkoutForForm} allWorkouts={workouts}
                    logForReferenceOrEdit={currentWorkoutLog} isNewSession={isNewSessionForLog}
                    onSaveLog={handleSaveLog} onClose={() => setIsLogFormOpen(false)}
                    latestGoal={latestGoal} participantProfile={participantProfile} latestStrengthStats={latestStrengthStats}
                    myClubMemberships={myClubMemberships} aiTips={aiWorkoutTips} myWorkoutLogs={myWorkoutLogs}
                    integrationSettings={integrationSettings}
                />
            </Suspense>
        ) : (
            <div className="pb-40">
                <FixedHeaderAndTools
                    onOpenGoalModal={() => setIsGoalModalOpen(true)} onOpenCommunity={() => setIsCommunityModalOpen(true)}
                    aiRecept={latestActiveGoal?.aiPrognosis} onOpenAiRecept={() => setIsAiReceptModalOpen(true)}
                    newFlowItemsCount={0} pendingRequestsCount={connections.filter(c => c.receiverId === currentParticipantId && c.status === 'pending').length}
                    onOpenFlowModal={() => setIsFlowModalOpen(true)}
                />
                <div ref={mainContentRef} className="container mx-auto p-4 space-y-6">
                    {/* Main content here */}
                    <div ref={activityViewRef} className="scroll-mt-4">
                        <ParticipantActivityView
                            allActivityLogs={allActivityLogs} allLogsForLeaderboards={allActivityLogsForLeaderboard}
                            workouts={workouts} onViewLogSummary={handleEditLog} onDeleteActivity={handleDeleteActivity}
                            activeGoal={latestActiveGoal} strengthStatsHistory={myStrengthStats} allStrengthStatsForLeaderboards={userStrengthStats}
                            conditioningStatsHistory={myConditioningStats} physiqueHistory={myPhysiqueHistory}
                            clubMemberships={clubMemberships} participantProfile={participantProfile} leaderboardSettings={leaderboardSettings}
                            allParticipantGoals={myParticipantGoals} coachEvents={coachEvents} oneOnOneSessions={myOneOnOneSessions}
                            staffMembers={staffMembers} allParticipants={participantDirectory} currentParticipantId={currentParticipantId}
                            groupClassSchedules={groupClassSchedules} groupClassDefinitions={groupClassDefinitions}
                            allParticipantBookings={allParticipantBookings} locations={locations}
                        />
                    </div>
                </div>
                {participantProfile && !participantProfile.isProspect && (
                    <Suspense fallback={null}>
                        <FabMenu
                            isOpen={isFabMenuOpen} onToggle={handleFabPrimaryAction} onClose={() => setIsFabMenuOpen(false)}
                            workouts={workouts} currentParticipantId={currentParticipantId}
                            onSelectWorkoutCategory={(category) => {
                                setWorkoutCategoryFilter(category);
                                setIsSelectWorkoutModalOpen(true);
                            }}
                            onOpenLogGeneralActivityModal={() => setIsLogGeneralActivityModalOpen(true)}
                            membership={myMembership} onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
                            onOpenBookingModal={() => setIsBookingModalOpen(true)} integrationSettings={integrationSettings}
                            onOpenQrScanner={(mode) => setIsQrScannerOpen(true)} workoutCategories={workoutCategories} myWorkoutLogs={myWorkoutLogs}
                        />
                    </Suspense>
                )}
            </div>
        )}
        
        <Suspense fallback={<LoadingSpinner />}>
            {isPostWorkoutSummaryModalOpen && logForSummaryModal && ( <PostWorkoutSummaryModal isOpen={isPostWorkoutSummaryModalOpen} onFinalize={handleFinalizePostWorkoutSummary} log={logForSummaryModal} workout={workoutForSummaryModal} onEditLog={handleEditLogFromSummary} /> )}
            <LogGeneralActivityModal isOpen={isLogGeneralActivityModalOpen} onClose={() => setIsLogGeneralActivityModalOpen(false)} onSaveActivity={handleSaveGeneralActivity} />
            <GeneralActivitySummaryModal isOpen={isGeneralActivitySummaryOpen} onClose={handleFinalizeGeneralActivitySummary} activity={lastGeneralActivity} />
            <AIProgressFeedbackModal isOpen={isAiFeedbackModalOpen} onClose={() => setIsAiFeedbackModalOpen(false)} isLoading={isLoadingAiFeedback} aiFeedback={aiFeedback} error={aiFeedbackError} modalTitle={currentAiModalTitle} />
            <Modal isOpen={isAiReceptModalOpen} onClose={() => setIsAiReceptModalOpen(false)} title="Ditt AI Recept" size="lg"> <div className="max-h-[70vh] overflow-y-auto pr-2"> {/* Render logic here */} </div> </Modal>
            <SelectWorkoutModal isOpen={isSelectWorkoutModalOpen} onClose={() => setIsSelectWorkoutModalOpen(false)} workouts={workouts} onStartWorkout={handleStartWorkout} categoryFilter={workoutCategoryFilter} membership={myMembership} onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)} currentParticipantId={currentParticipantId} isProspect={participantProfile?.isProspect} />
            <ExerciseSelectionModal isOpen={isExerciseSelectionModalOpen} onClose={() => setIsExerciseSelectionModalOpen(false)} options={workoutForExerciseSelection?.exerciseSelectionOptions} onConfirm={handleExerciseSelectionConfirm} />
            <MentalWellbeingModal isOpen={isMentalCheckinOpen} onClose={() => setIsMentalCheckinOpen(false)} currentWellbeing={myMentalWellbeing || null} participantId={currentParticipantId} onSave={(wellbeingData) => { const existingIndex = participantMentalWellbeing.findIndex(w => w.id === wellbeingData.id); if (existingIndex > -1) { setParticipantMentalWellbeing(prev => prev.map((item, index) => index === existingIndex ? wellbeingData : item)); } else { setParticipantMentalWellbeing(prev => [...prev, wellbeingData]); } }} />
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentProfile={participantProfile || null} onSave={handleSaveProfile} locations={locations} />
            <GoalModal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} currentGoalForForm={latestActiveGoal} allParticipantGoals={myParticipantGoals} onSave={handleSaveGoals} isOnline={isOnline} />
            <StrengthComparisonModal isOpen={isStrengthModalOpen} onClose={() => setIsStrengthModalOpen(false)} participantProfile={participantProfile} latestGoal={latestActiveGoal} userStrengthStatsHistory={myStrengthStats} clubMemberships={myClubMemberships} onSaveStrengthStats={(stats) => setUserStrengthStats(prev => [...prev, stats])} onOpenPhysiqueModal={handleOpenPhysiqueFromStrength} />
            <ConditioningStatsModal isOpen={isConditioningModalOpen} onClose={() => setIsConditioningModalOpen(false)} statsHistory={myConditioningStats} participantProfile={participantProfile} clubMemberships={myClubMemberships} onSaveStats={(statsData) => { const newStat: ParticipantConditioningStat = { id: crypto.randomUUID(), participantId: currentParticipantId, ...statsData, }; setUserConditioningStatsHistory(prev => [...prev, newStat]); }} />
            <PhysiqueManagerModal isOpen={isPhysiqueModalOpen} onClose={() => setIsPhysiqueModalOpen(false)} currentProfile={participantProfile || null} onSave={(physiqueData) => { const newHistoryEntry: ParticipantPhysiqueStat = { id: crypto.randomUUID(), participantId: currentParticipantId, lastUpdated: new Date().toISOString(), ...physiqueData, }; setParticipantPhysiqueHistory(prev => [...prev, newHistoryEntry]); updateParticipantProfile(currentParticipantId, physiqueData); }} />
            <CommunityModal isOpen={isCommunityModalOpen} onClose={() => setIsCommunityModalOpen(false)} currentParticipantId={currentParticipantId} allParticipants={participantDirectory} connections={connections} setConnections={setConnections} />
            {ai && preWorkoutData && participantProfile && ( <AIAssistantModal isOpen={isAIAssistantModalOpen} onClose={() => { setIsAIAssistantModalOpen(false); setPreWorkoutData(null); }} onContinue={handleContinueFromAIAssistant} ai={ai} workout={preWorkoutData.workout} previousLog={preWorkoutData.previousLog} participant={participantProfile} allWorkouts={workouts} /> )}
            <FlowModal isOpen={isFlowModalOpen} onClose={() => { setLastFlowViewTimestamp(new Date().toISOString()); setIsFlowModalOpen(false); }} currentUserId={currentParticipantId} allParticipants={participantDirectory} connections={connections} workoutLogs={workoutLogs} generalActivityLogs={generalActivityLogs} goalCompletionLogs={goalCompletionLogs} coachEvents={coachEvents} workouts={workouts} clubMemberships={clubMemberships} participantGoals={participantGoals} participantPhysiqueHistory={participantPhysiqueHistory} userStrengthStats={userStrengthStats} leaderboardSettings={leaderboardSettings} onToggleReaction={onToggleReaction} onAddComment={onAddComment} onDeleteComment={onDeleteComment} onToggleCommentReaction={onToggleCommentReaction} isProspect={participantProfile?.isProspect} />
            {selectedSessionForModal && ( <MeetingDetailsModal isOpen={!!selectedSessionForModal} onClose={() => setSelectedSessionForModal(null)} session={selectedSessionForModal} coach={staffMembers.find(s => s.id === selectedSessionForModal.coachId) || null} currentUserId={currentParticipantId} onAddComment={onAddComment} onDeleteComment={onDeleteComment} onToggleCommentReaction={onToggleCommentReaction} /> )}
            <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} />
            <UpgradeModal isOpen={isAiUpsellModalOpen} onClose={() => setIsAiUpsellModalOpen(false)} title="Lås upp AI Recept!"> <div className="text-center space-y-4"> <span className="text-7xl" role="img" aria-label="Hjärna">🧠</span> <h3 className="text-3xl font-bold text-gray-800">Få Personlig Vägledning</h3> <p className="text-lg text-gray-600"> Funktionen "AI Recept" analyserar dina mål och ger dig en skräddarsydd plan för att lyckas. Denna funktion är en del av våra fullvärdiga medlemskap. </p> <p className="text-lg text-gray-600 pt-2"> Prata med en coach för att uppgradera och låsa upp denna och många andra funktioner! </p> </div> </UpgradeModal>
            {integrationSettings.isBookingEnabled && ( <BookingView isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} schedules={groupClassSchedules} definitions={groupClassDefinitions} bookings={allParticipantBookings} staff={staffMembers} onBookClass={onBookClass} onCancelBooking={onCancelBooking} currentParticipantId={currentParticipantId} participantProfile={participantProfile} integrationSettings={integrationSettings} membership={myMembership} onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)} /> )}
            {integrationSettings.enableQRCodeScanning && ( <QrScannerModal isOpen={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onWorkoutScan={(workoutData) => { const tempWorkout: Workout = { id: crypto.randomUUID(), ...workoutData, isPublished: false, isModifiable: true, assignedToParticipantId: currentParticipantId, }; handleStartWorkout(tempWorkout); }} onCheckinScan={(checkinData) => { onCheckInParticipant(checkinData.locationId); setCheckinSuccess(true); }} /> )}
            {participantProfile && ( <CheckinConfirmationModal isOpen={checkinSuccess} onClose={() => setCheckinSuccess(false)} participantName={participantProfile.name || 'Medlem'} /> )}
            <FeedbackPromptToast isOpen={showFeedbackPrompt} onAccept={() => { setShowFeedbackPrompt(false); setIsAiFeedbackModalOpen(true); }} onDecline={() => setShowFeedbackPrompt(false)} message="Vill du ha personlig feedback från vår AI-coach på din senaste träningsperiod?" />
            <InstallPwaBanner participantProfile={participantProfile} />
        </Suspense>
      </div>
    );
};