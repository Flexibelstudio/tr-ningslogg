
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Workout, WorkoutLog, GeneralActivityLog,
    ParticipantGoalData, 
    UserStrengthStat, ParticipantConditioningStat,
    WorkoutCategory, 
    ParticipantClubMembership, 
    OneOnOneSession, 
    InProgressWorkout, AchievementDefinition, 
    UserPushSubscription,
    ActivityLog,
    Exercise
} from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { WorkoutLogForm } from '../../features/workouts/components/WorkoutLogForm';
import { AIProgressFeedbackModal } from './AIProgressFeedbackModal';
import { ParticipantActivityView } from './ParticipantActivityView';
import { PostWorkoutSummaryModal } from '../../features/workouts/components/PostWorkoutSummaryModal';
import { LogGeneralActivityModal } from './LogGeneralActivityModal';
import { GeneralActivitySummaryModal } from './GeneralActivitySummaryModal';
import {
    LOCAL_STORAGE_KEYS, CLUB_DEFINITIONS, VAPID_PUBLIC_KEY
} from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { FeedbackPromptToast } from './FeedbackPromptToast';
import { FabMenu } from './FabMenu';
import { SelectWorkoutModal } from '../../features/workouts/components/SelectWorkoutModal';
import { ExerciseSelectionModal } from '../../features/workouts/components/ExerciseSelectionModal';
import { MentalWellbeingModal } from './MentalWellbeingModal';
import { ProfileModal } from './ProfileGoalModal';
import { GoalModal } from './GoalModal';
import { StrengthComparisonModal } from './StrengthComparisonModal';
import { ConditioningStatsModal } from './ConditioningStatsModal';
import { PhysiqueManagerModal } from './PhysiqueManagerModal';
import { CommunityModal } from './CommunityModal';
import { UpcomingMeetingCard } from './UpcomingMeetingCard';
import { MeetingDetailsModal } from '../../features/booking/components/MeetingDetailsModal';
import { UpgradeModal } from './UpgradeModal';
import { BookingView } from '../../features/booking/components/BookingView';
import { QrScannerModal } from './QrScannerModal';
import { CheckinConfirmationModal } from './CheckinConfirmationModal';
import { calculateUpdatedStreakAndGamification, checkAndAwardClubMemberships } from '../../services/gamificationService';
import { calculatePostWorkoutSummary, findAndUpdateStrengthStats } from '../../services/workoutService';
import { NextBookingCard } from '../../features/booking/components/NextBookingCard';
import { AIAssistantModal, AiWorkoutTips } from '../../features/workouts/components/AIAssistantModal';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { FlowModal } from './FlowModal';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import { InstallPwaBanner } from './InstallPwaBanner';
import { ConfirmationModal } from '../ConfirmationModal';
import { AchievementToast } from './AchievementToast';
import { AICoachModal } from './AICoachModal';
import { callGeminiApiFn } from '../../firebaseClient';
import { db } from '../../firebaseConfig';
import { useNotifications } from '../../context/NotificationsContext';
import { sanitizeDataForFirebase } from '../../utils/firestoreUtils';
import { useParticipantData } from '../../features/participant/hooks/useParticipantData';
import { useParticipantOperations } from '../../features/participant/hooks/useParticipantOperations';
import { ParticipantDashboardView } from './ParticipantDashboardView'; // Import this explicitly

// --- REUSABLE CARD COMPONENTS ---
function ToolCard({ title, description, icon, onClick }: { title: string; description: string; icon: React.ReactNode; onClick: () => void; }) {
    return (
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
}

function WarningBanner({ message, type, buttonText, onButtonClick }: { message: string, type: 'warning' | 'danger', buttonText: string, onButtonClick: () => void }) {
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

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


interface ParticipantAreaProps {
  currentParticipantId: string;
  // Removed old props as they are now handled internally via hooks
  openProfileModalOnInit: boolean;
  onProfileModalOpened: () => void;
  isStaffViewingSelf?: boolean;
  onSwitchToStaffView?: () => void;
  setProfileOpener: (opener: { open: () => void } | null) => void;
  setParticipantModalOpeners: (openers: {
    openGoalModal: () => void;
    openCommunityModal: () => void;
    openFlowModal: () => void;
  }) => void;
  newFlowItemsCount?: number;
  operationInProgress: string[];
}

// Main ParticipantArea Component
export const ParticipantArea: React.FC<ParticipantAreaProps> = ({
  currentParticipantId,
  openProfileModalOnInit,
  onProfileModalOpened,
  isStaffViewingSelf,
  onSwitchToStaffView,
  setProfileOpener,
  setParticipantModalOpeners,
  newFlowItemsCount = 0,
  operationInProgress,
}) => {
    // Hook 1: Get All Data
    const {
        participantProfile,
        myWorkoutLogs,
        myGeneralActivityLogs,
        myGoalCompletionLogs,
        allActivityLogs,
        allActivityLogsForLeaderboard,
        myStrengthStats,
        latestStrengthStats,
        myConditioningStats,
        latestConditioningValues,
        myPhysiqueHistory,
        latestPhysique,
        myMentalWellbeing,
        myGamificationStats,
        myClubMemberships,
        myParticipantGoals,
        latestGoal,
        latestActiveGoal,
        myOneOnOneSessions,
        myUpcomingSessions,
        nextMeetingForCard,
        nextBooking,
        flexibelStrengthScore,
        fssScoreInterpretation,
        isNewUser,
        allParticipantBookings, 
        groupClassSchedules,
        groupClassDefinitions,
        staffMembers,
        connections,
        coachEvents
    } = useParticipantData(currentParticipantId);

    // Hook 2: Operations
    const {
        handleBookClass,
        handleCancelBooking,
        handleSelfCheckIn,
        handleLocationCheckIn,
        handleToggleReaction,
        handleAddComment,
        handleDeleteComment,
        handleToggleCommentReaction
    } = useParticipantOperations(currentParticipantId);

    const {
        participantDirectory, 
        updateParticipantProfile,
        workouts = [],
        workoutLogs = [], setWorkoutLogsData,
        participantGoals = [], setParticipantGoalsData,
        generalActivityLogs = [], setGeneralActivityLogsData,
        goalCompletionLogs = [], setGoalCompletionLogsData,
        userStrengthStats = [], setUserStrengthStatsData,
        userConditioningStatsHistory = [], setUserConditioningStatsHistoryData,
        participantPhysiqueHistory = [], setParticipantPhysiqueHistoryData,
        participantMentalWellbeing = [], setParticipantMentalWellbeingData,
        participantGamificationStats = [], setParticipantGamificationStatsData,
        clubMemberships = [], setClubMembershipsData,
        leaderboardSettings = { leaderboardsEnabled: true, weeklyPBChallengeEnabled: true, weeklySessionChallengeEnabled: true },
        setConnectionsData,
        lastFlowViewTimestamp, setLastFlowViewTimestampData,
        locations = [],
        memberships = [],
        workoutCategories = [],
        integrationSettings = { enableQRCodeScanning: false, isBookingEnabled: false, isClientJourneyEnabled: true, isScheduleEnabled: true },
        groupClassScheduleExceptions = [],
        setUserPushSubscriptionsData,
    } = useAppContext();
    const { organizationId } = useAuth();
    const { isOnline } = useNetworkStatus();
    const { addNotification } = useNotifications();

    const [currentWorkoutLog, setCurrentWorkoutLog] = useState<WorkoutLog | undefined>(undefined);
    const [logForReference, setLogForReference] = useState<WorkoutLog | undefined>(undefined);
    const [isNewSessionForLog, setIsNewSessionForLog] = useState(true);
    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [currentWorkoutForForm, setCurrentWorkoutForForm] = useState<Workout | null>(null);

    const [isAiFeedbackModalOpen, setIsAiFeedbackModalOpen] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [isLoadingAiFeedback, setIsLoadingAiFeedback] = useState(false);
    const [aiFeedbackError, setAiFeedbackError] = useState<string | null>(null);
    const [currentAiModalTitle, setCurrentAiModalTitle] = useState("Feedback");
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

    const [isBirthDatePromptOpen, setIsBirthDatePromptOpen] = useState(false);
    const [hasDismissedPromptThisSession, setHasDismissedPromptThisSession] = useState(false);

    const [showNotificationBanner, setShowNotificationBanner] = useState(false);

    const storageKey = useMemo(() => 
        `${LOCAL_STORAGE_KEYS.IN_PROGRESS_WORKOUT}_${currentParticipantId}`, 
        [currentParticipantId]
    );

    const myMembership = useMemo(() => memberships.find(m => m.id === participantProfile?.membershipId), [memberships, participantProfile]);

    const isAiEnabled = useMemo(() => {
        return myMembership?.type === 'subscription';
    }, [myMembership]);

    // --- NEW: Push Notification Logic ---
    useEffect(() => {
        if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
            if (Notification.permission === 'default') {
                setShowNotificationBanner(true);
            }
        }
    }, []);

    const handleEnableNotifications = async () => {
        setShowNotificationBanner(false);
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeUserToPush();
        } else {
            addNotification({
                type: 'WARNING',
                title: 'Notiser blockerade',
                message: 'Du kan ändra detta i din webbläsare/s inställningar.'
            });
        }
    };

    const subscribeUserToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
    
            if (existingSubscription) {
                saveSubscription(existingSubscription);
                return;
            }
            
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey,
            });
    
            saveSubscription(subscription);
        } catch (error) {
            console.error('Failed to subscribe the user: ', error);
            addNotification({
                type: 'ERROR',
                title: 'Fel vid prenumeration',
                message: 'Kunde inte aktivera push-notiser. Försök igen senare.'
            });
        }
    };

    const saveSubscription = (subscription: PushSubscription) => {
        const subscriptionJSON = subscription.toJSON();
        
        if (participantProfile && participantProfile.notificationSettings?.pushEnabled !== true) {
            updateParticipantProfile(currentParticipantId, {
              notificationSettings: {
                ...participantProfile.notificationSettings,
                pushEnabled: true,
                waitlistPromotion: true, 
                sessionReminder: true, 
                classCancellation: true 
              }
            });
        }

        const newSubscriptionRecord: UserPushSubscription = {
            id: crypto.randomUUID(),
            participantId: currentParticipantId,
            subscription: subscriptionJSON,
        };
    
        setUserPushSubscriptionsData(prev => {
            const existing = (prev || []).find(sub => sub.subscription.endpoint === subscriptionJSON.endpoint);
            if (existing) {
                return prev;
            }
            return [...(prev || []), newSubscriptionRecord];
        });
        
        addNotification({
            type: 'SUCCESS',
            title: 'Notiser Aktiverade',
            message: 'Du kommer nu att få push-notiser.'
        });
    };
    
    const handleSaveLog = async (logData: WorkoutLog) => {
        if (!participantProfile?.id || !organizationId || !db) {
            throw new Error("Profil- eller organisationsinformation saknas. Kan inte spara logg.");
        }

        const logWithParticipantId: WorkoutLog = { ...logData, participantId: participantProfile.id };
        const summary = calculatePostWorkoutSummary(logWithParticipantId, workouts, myWorkoutLogs, myStrengthStats);
        const logWithSummary = logWithParticipantId.entries.length > 0 ? { ...logWithParticipantId, postWorkoutSummary: summary } : logWithParticipantId;

        const { needsUpdate, updatedStats } = findAndUpdateStrengthStats(logWithParticipantId, workouts, myStrengthStats);

        let newStatRecord: UserStrengthStat | undefined;
        if (needsUpdate) {
            newStatRecord = {
                id: crypto.randomUUID(),
                participantId: participantProfile.id,
                lastUpdated: new Date().toISOString(),
                bodyweightKg: latestStrengthStats?.bodyweightKg || participantProfile.bodyweightKg,
                squat1RMaxKg: updatedStats.squat1RMaxKg,
                benchPress1RMaxKg: updatedStats.benchPress1RMaxKg,
                deadlift1RMaxKg: updatedStats.deadlift1RMaxKg,
                overheadPress1RMaxKg: updatedStats.overheadPress1RMaxKg,
            };
        }

        const tempUpdatedWorkoutLogs = workoutLogs.some(l => l.id === logWithSummary.id)
            ? workoutLogs.map(l => (l.id === logWithSummary.id ? logWithSummary : l))
            : [...workoutLogs, logWithSummary];

        const { updatedGoals, updatedGamificationStats } = calculateUpdatedStreakAndGamification(
            myParticipantGoals, myGamificationStats, participantProfile.id,
            [...tempUpdatedWorkoutLogs, ...myGeneralActivityLogs, ...myGoalCompletionLogs]
        );

        const batch = db.batch();

        const { id: logId, ...logSaveData } = logWithSummary;
        const logRef = db.collection('organizations').doc(organizationId).collection('workoutLogs').doc(logId);
        batch.set(logRef, sanitizeDataForFirebase(logSaveData));

        if (newStatRecord) {
            const { id: statId, ...statSaveData } = newStatRecord;
            const statRef = db.collection('organizations').doc(organizationId).collection('userStrengthStats').doc(statId);
            batch.set(statRef, sanitizeDataForFirebase(statSaveData));
        }

        const oldGoalsMap = new Map(myParticipantGoals.map(g => [g.id, g]));
        updatedGoals.forEach(goal => {
            const oldGoal = oldGoalsMap.get(goal.id);
            if (!oldGoal || JSON.stringify(oldGoal) !== JSON.stringify(goal)) {
                const { id: goalId, ...goalSaveData } = goal;
                const goalRef = db.collection('organizations').doc(organizationId).collection('participantGoals').doc(goalId);
                batch.set(goalRef, sanitizeDataForFirebase(goalSaveData));
            }
        });

        if (updatedGamificationStats) {
            const { id: gamificationId, ...gamificationSaveData } = updatedGamificationStats;
            const gamificationRef = db.collection('organizations').doc(organizationId).collection('participantGamificationStats').doc(gamificationId);
            batch.set(gamificationRef, sanitizeDataForFirebase(gamificationSaveData));
        }

        try {
            await batch.commit();

            if (newStatRecord) {
                setUserStrengthStatsData(prev => [...(prev || []), newStatRecord!]);
            }
            setWorkoutLogsData(tempUpdatedWorkoutLogs);
            setParticipantGoalsData(prev => [...(prev || []).filter(g => g.participantId !== currentParticipantId), ...updatedGoals]);
            if (updatedGamificationStats) {
                setParticipantGamificationStatsData(prev => [...(prev || []).filter(s => s.id !== currentParticipantId), updatedGamificationStats]);
            }

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
        } catch (error) {
            console.error("Failed to save workout log batch:", error);
            alert("Kunde inte spara passet. Kontrollera din anslutning och försök igen.");
            throw error; 
        }
    };

    useEffect(() => {
        setParticipantModalOpeners({
            openGoalModal: () => setIsGoalModalOpen(true),
            openCommunityModal: () => setIsCommunityModalOpen(true),
            openFlowModal: () => setIsFlowModalOpen(true),
        });
    }, [setParticipantModalOpeners]);

    useEffect(() => {
        const rawData = localStorage.getItem(storageKey);
        if (rawData) {
            try {
                const parsedData: InProgressWorkout = JSON.parse(rawData);
                setInProgressWorkout(parsedData);
            } catch (e) {
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
            setWorkoutLogsData(prev => prev.filter(log => log.id !== activityId));
        } else if (activityType === 'general') {
            setGeneralActivityLogsData(prev => prev.filter(log => log.id !== activityId));
        } else if (activityType === 'goal_completion') {
            setGoalCompletionLogsData(prev => prev.filter(log => log.id !== activityId));
        }
    };
  
    const openWorkoutForEditing = useCallback((logToEdit: WorkoutLog) => {
        const workoutTemplate = workouts.find(w => w.id === logToEdit.workoutId);

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
        }
    }, [myWorkoutLogs, workouts]);

    const handleEditLog = useCallback((logToEdit: ActivityLog) => {
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
            setIsNewCompletion(false);
            setIsPostWorkoutSummaryModalOpen(true);

        } else if (logToEdit.type === 'general') {
            setLastGeneralActivity(logToEdit as GeneralActivityLog);
            setIsGeneralActivitySummaryOpen(true);
        }
    }, [isLogFormOpen, openWorkoutForEditing, workouts]);
  
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
            const isProfileComplete = !!(participantProfile?.birthDate && participantProfile?.gender && participantProfile?.gender !== '-');
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


    useEffect(() => {
        const todaysMeetings = myUpcomingSessions.filter(s => dateUtils.isSameDay(new Date(s.startTime), new Date()));
        if (todaysMeetings.length > 0 && !sessionStorage.getItem('flexibel_meetingToastShown')) {
            setShowMeetingToast(true);
            sessionStorage.setItem('flexibel_meetingToastShown', 'true');
        }
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

    const openMentalCheckinIfNeeded = useCallback(() => {
        const wasLoggedThisWeek = () => {
            if (!myMentalWellbeing?.lastUpdated) return false;
            return dateUtils.isSameWeek(new Date(myMentalWellbeing.lastUpdated), new Date());
        };

        if (!wasLoggedThisWeek()) {
            setIsMentalCheckinOpen(true);
        }
    }, [myMentalWellbeing]);

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

    const handleStartWorkout = useCallback((workout: Workout, isEditing: boolean = false, logToEdit?: WorkoutLog) => {
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
        } 
        else {
            const previousLogForThisTemplate = myWorkoutLogs
                .filter(l => l.workoutId === workout.id)
                .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
            
            setIsNewSessionForLog(true);
            setLogForReference(undefined);

            if (previousLogForThisTemplate && isAiEnabled && isOnline) {
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
    }, [isAiEnabled, isOnline, myWorkoutLogs]);

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
        profileData: Partial<any>
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
            if (!isAiEnabled || !isOnline) {
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
            3.  **## Att Tänka På:** Ge 2-3 konkreta, handlingsbara tips relaterade till målet.
            4.  **## Lycka Till!** Avsluta med en positiv och motiverande hälsning.`;
    
            try {
                const result = await callGeminiApiFn({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                
                const { text, error } = result.data as { text?: string; error?: string };
                
                if (error) {
                    throw new Error(`Cloud Function error: ${error}`);
                }
                
                aiPrognosisText = text;
                setAiFeedback(aiPrognosisText);
            } catch (err) {
                console.error("Error generating AI goal prognosis via Cloud Function:", err);
                const errorMessage = err instanceof Error ? err.message : "Kunde inte generera en prognos för ditt mål. Försök igen senare.";
                setAiFeedbackError(errorMessage);
                throw err;
            } finally {
                setIsLoadingAiFeedback(false);
            }
        }
    
        setParticipantGoalsData(prevGoals => {
            let newGoalsArray = [...(prevGoals || [])];
            const participantOldGoals = newGoalsArray.filter(g => g.participantId === currentParticipantId);
    
            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = participantOldGoals
                    .filter(g => !g.isCompleted)
                    .sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                
                if (latestExistingGoal) {
                    const newGoalCompletionLog: any = {
                        type: 'goal_completion',
                        id: crypto.randomUUID(),
                        participantId: currentParticipantId,
                        goalId: latestExistingGoal.id,
                        goalDescription: latestExistingGoal.fitnessGoals,
                        completedDate: new Date().toISOString(),
                    };
                    setGoalCompletionLogsData(prev => [...(prev || []), newGoalCompletionLog]);
                    
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
    }, [isAiEnabled, isOnline, latestActiveGoal, currentParticipantId, setParticipantGoalsData, setGoalCompletionLogsData]);
    
    const handleSaveGeneralActivity = (activityData: Omit<GeneralActivityLog, 'id' | 'type' | 'participantId'>) => {
        const newActivity: GeneralActivityLog = {
            ...activityData,
            id: crypto.randomUUID(),
            participantId: currentParticipantId,
            type: 'general',
        };
        setGeneralActivityLogsData(prev => [...(prev || []), newActivity]);
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
        setTimeout(() => {
          setIsPhysiqueModalOpen(true);
        }, 150);
    };

    useEffect(() => {
        if (!participantProfile || isNewUser) return;

        const newAchievements = checkAndAwardClubMemberships(
            participantProfile,
            allActivityLogs,
            myStrengthStats,
            myConditioningStats,
            myClubMemberships,
            workouts
        );

        if (newAchievements.length > 0) {
            setClubMembershipsData(prev => [...(prev || []), ...newAchievements]);
            
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

    }, [allActivityLogs, myStrengthStats, myConditioningStats, participantProfile, myClubMemberships, workouts, setClubMembershipsData, isNewUser]);

    const handleDismissBirthDatePrompt = () => {
        setIsBirthDatePromptOpen(false);
        setHasDismissedPromptThisSession(true);
    };

    const handleOpenProfileFromPrompt = () => {
        setIsBirthDatePromptOpen(false);
        setHasDismissedPromptThisSession(true);
        setIsProfileModalOpen(true);
    };

    return (
        <div className="bg-gray-100 bg-dotted-pattern bg-dotted-size bg-fixed min-h-screen">
        {isLogFormOpen && currentWorkoutForForm ? (
            <WorkoutLogForm
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
                    {showNotificationBanner && (
                        <div className="p-3 bg-blue-100 border-l-4 border-blue-500 rounded-r-lg flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 animate-fade-in-down">
                            <div>
                                <h3 className="font-bold text-blue-800">Missa inga uppdateringar!</h3>
                                <p className="text-sm text-blue-700">Aktivera notiser för att direkt få veta när du får en plats från kölistan.</p>
                            </div>
                            <div className="flex gap-2 self-end sm:self-center flex-shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => setShowNotificationBanner(false)}>Senare</Button>
                                <Button size="sm" onClick={handleEnableNotifications}>Aktivera</Button>
                            </div>
                        </div>
                    )}
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

                    {nextBooking && (
                         <NextBookingCard nextBooking={nextBooking} />
                    )}

                    {isNewUser && (
                        <div className="p-4 bg-white rounded-xl shadow-lg border text-center">
                            <h2 className="text-2xl font-bold text-gray-800">Välkommen!</h2>
                            <p className="mt-2 text-lg text-gray-600">Sätt dina mål och logga ditt första pass för att komma igång.</p>
                        </div>
                    )}
                    
                    <ParticipantDashboardView 
                        participant={participantProfile || {} as any}
                        latestGoal={latestActiveGoal}
                        allActivityLogs={allActivityLogs}
                        onToolCardClick={(tool) => {
                             if (tool === 'strength') setIsStrengthModalOpen(true);
                             if (tool === 'conditioning') setIsConditioningModalOpen(true);
                             if (tool === 'physique') setIsPhysiqueModalOpen(true);
                        }}
                    />

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
                            groupClassScheduleExceptions={groupClassScheduleExceptions}
                            allParticipantBookings={allParticipantBookings}
                            locations={locations}
                            onCancelBooking={handleCancelBooking}
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
                setParticipantMentalWellbeingData(prev => {
                    const existing = (prev || []).find(w => w.id === wellbeingData.id);
                    if (existing) {
                        return (prev || []).map(w => w.id === wellbeingData.id ? wellbeingData : w);
                    }
                    return [...(prev || []), wellbeingData];
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
            onSaveStrengthStats={(stats) => setUserStrengthStatsData(prev => [...prev.filter(s => s.participantId !== currentParticipantId), stats])}
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
                setUserConditioningStatsHistoryData(prev => [...prev, newStat]);
            }}
        />
        <PhysiqueManagerModal
            isOpen={isPhysiqueModalOpen}
            onClose={() => setIsPhysiqueModalOpen(false)}
            currentProfile={participantProfile}
            onSave={(physiqueData) => {
                const newHistoryEntry: ParticipantPhysiqueStat = {
                    id: crypto.randomUUID(),
                    participantId: participant.id,
                    lastUpdated: new Date().toISOString(),
                    ...physiqueData,
                };
                setParticipantPhysiqueHistoryData(prev => [...prev, newHistoryEntry]);
                updateParticipantProfile(participant.id, physiqueData);
            }}
        />
        <CommunityModal
            isOpen={isCommunityModalOpen}
            onClose={() => setIsCommunityModalOpen(false)}
            currentParticipantId={currentParticipantId}
            allParticipants={participantDirectory}
            connections={connections}
            setConnections={setConnectionsData}
        />
        <FlowModal 
            isOpen={isFlowModalOpen}
            onClose={() => {
                setIsFlowModalOpen(false);
                setLastFlowViewTimestampData(new Date().toISOString());
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
            onToggleReaction={handleToggleReaction}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onToggleCommentReaction={handleToggleCommentReaction}
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
                groupClassScheduleExceptions={groupClassScheduleExceptions}
                staff={staffMembers}
                onBookClass={handleBookClass}
                onCancelBooking={handleCancelBooking}
                currentParticipantId={currentParticipantId}
                participantProfile={participantProfile}
                integrationSettings={integrationSettings}
                membership={myMembership}
                onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
                operationInProgress={operationInProgress}
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
                    category: 'Annat',
                    blocks: workoutData.blocks
                };
                handleStartWorkout(tempWorkout);
            }}
            onSelfCheckIn={(classInstanceId) => handleSelfCheckIn(currentParticipantId, classInstanceId, 'self_qr')}
            onLocationCheckIn={(locationId) => handleLocationCheckIn(currentParticipantId, locationId)}
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
                coach={staffMembers.find(s => s.id === selectedSessionForModal?.coachId) || null}
                currentUserId={currentParticipantId}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onToggleCommentReaction={handleToggleCommentReaction}
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
        {preWorkoutData && participantProfile && (
            <AIAssistantModal
                isOpen={isAIAssistantModalOpen}
                onClose={() => {
                    setIsAIAssistantModalOpen(false);
                    setPreWorkoutData(null);
                }}
                onContinue={handleContinueFromAIAssistant}
                workout={preWorkoutData.workout}
                previousLog={preWorkoutData.previousLog}
                participant={participantProfile}
            />
        )}
        <AICoachModal
            isOpen={isAICoachModalOpen}
            onClose={() => setIsAICoachModalOpen(false)}
            participantProfile={participantProfile}
            myWorkoutLogs={myWorkoutLogs}
            myGeneralActivityLogs={myGeneralActivityLogs}
            latestGoal={latestActiveGoal}
            allWorkouts={workouts}
            membership={myMembership}
        />
        <Modal
            isOpen={isBirthDatePromptOpen}
            onClose={handleDismissBirthDatePrompt}
            title="📅 Uppdatera din profil!"
            size="lg"
        >
            <div className="p-4 text-center space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">
                    För en bättre upplevelse!
                </h3>
                <p className="text-base text-gray-600">
                    Hej! För att kunna ge dig mer exakta styrkeberäkningar (FSS) och personliga insikter, skulle vi uppskatta om du lade till ditt födelsedatum i din profil.
                </p>
                <div className="flex justify-center gap-4 pt-4">
                    <Button variant="secondary" onClick={handleDismissBirthDatePrompt}>
                        Påminn mig senare
                    </Button>
                    <Button variant="primary" onClick={handleOpenProfileFromPrompt}>
                        Gå till profil
                    </Button>
                </div>
            </div>
        </Modal>
    </div>
    );
};
