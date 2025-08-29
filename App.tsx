import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { 
    UserRole, Workout, WorkoutLog, ActivityLog, ParticipantGamificationStats, ParticipantGoalData, 
    GeneralActivityLog, GoalCompletionLog, ParticipantConditioningStat, ParticipantProfile, 
    UserStrengthStat, ParticipantMentalWellbeing, ParticipantClubMembership, LeaderboardSettings, 
    CoachEvent, Connection, Comment, Reaction, ParticipantPhysiqueStat, Location, StaffMember, 
    Membership, OneOnOneSession, WorkoutCategoryDefinition, StaffAvailability, 
    IntegrationSettings, GroupClassDefinition, GroupClassSchedule, ParticipantBooking, BookingStatus
} from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Navbar } from './components/Navbar';
import { LOCAL_STORAGE_KEYS } from './constants'; 
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; 
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Button } from './components/Button';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { OfflineBanner } from './components/OfflineBanner';
import { ParticipantNavbarActions } from './components/participant/ParticipantArea';

const CoachArea = lazy(() => import('./components/coach/CoachArea').then(m => ({ default: m.CoachArea })));
const ParticipantArea = lazy(() => import('./components/participant/ParticipantArea').then(m => ({ default: m.ParticipantArea })));
const SystemOwnerArea = lazy(() => import('./components/SystemOwnerArea').then(m => ({ default: m.SystemOwnerArea })));

const API_KEY = process.env.API_KEY;

const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-flexibel"></div>
    </div>
);

type FlowItemLogType = 'workout' | 'general' | 'coach_event' | 'one_on_one_session' | 'goal_completion' | 'participant_club_membership' | 'user_strength_stat' | 'participant_physique_stat' | 'participant_goal_data' | 'participant_conditioning_stat';


const AppContent: React.FC = () => {
    const {
        participantDirectory, setParticipantDirectoryData,
        memberships,
        workoutLogs, setWorkoutLogsData,
        generalActivityLogs, setGeneralActivityLogsData,
        coachEvents, setCoachEventsData,
        oneOnOneSessions, setOneOnOneSessionsData,
        participantBookings, setParticipantBookingsData,
        groupClassSchedules,
        isOrgDataLoading,
        isGlobalDataLoading, // Get new loading state
        branding,
        setGoalCompletionLogsData,
        setClubMembershipsData,
        setUserStrengthStatsData,
        setParticipantPhysiqueHistoryData,
        setParticipantGoalsData,
        setUserConditioningStatsHistoryData,
    } = useAppContext();
    
    const auth = useAuth();
    const [view, setView] = useState<'login' | 'register'>('login');
    const [registrationPendingMessage, setRegistrationPendingMessage] = useState(false);

    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const [welcomeModalShown, setWelcomeModalShown] = useLocalStorage<boolean>(
        LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT,
        false
    );
    const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);
    const [profileOpener, setProfileOpener] = useState<{ open: () => void } | null>(null);
    const [cachedLogo, setCachedLogo] = useState<string | null>(() => {
        const lastOrgId = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID);
        if (lastOrgId) {
            return localStorage.getItem(`flexibel_logo_${lastOrgId}`);
        }
        return null;
    });
    const [participantNavbarActions, setParticipantNavbarActions] = useState<ParticipantNavbarActions | null>(null);

    useEffect(() => {
        if (auth.currentRole !== UserRole.PARTICIPANT) {
            setParticipantNavbarActions(null);
        }
    }, [auth.currentRole]);

    useEffect(() => {
        if (auth.organizationId) {
            const logo = localStorage.getItem(`flexibel_logo_${auth.organizationId}`);
            setCachedLogo(logo);
        } else if (!auth.isLoading) {
            // If auth is resolved and there's no orgId, it means user is logged out.
            setCachedLogo(null);
        }
    }, [auth.organizationId, auth.isLoading]);


    const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string) => {
        const existingBooking = participantBookings.find(b =>
            b.participantId === participantId &&
            b.scheduleId === scheduleId &&
            b.classDate === classDate &&
            b.status !== 'CANCELLED'
        );

        if (existingBooking) {
            console.warn('Participant is already booked or on the waitlist for this class.');
            return;
        }

        const schedule = groupClassSchedules.find(s => s.id === scheduleId);
        if (!schedule) {
            console.error("Schedule not found");
            return;
        }
    
        const bookedCount = participantBookings.filter(b => b.scheduleId === scheduleId && b.classDate === classDate && b.status === 'BOOKED').length;
        
        const newStatus = bookedCount >= schedule.maxParticipants ? 'WAITLISTED' : 'BOOKED';
    
        const newBooking: ParticipantBooking = {
            id: crypto.randomUUID(),
            participantId,
            scheduleId,
            classDate,
            bookingDate: new Date().toISOString(),
            status: newStatus
        };
        
        setParticipantBookingsData(prev => [...prev, newBooking]);
    
        if (newStatus === 'BOOKED') {
            setParticipantDirectoryData(prevParticipants => {
                const participant = prevParticipants.find(p => p.id === participantId);
                if (!participant || !participant.membershipId) return prevParticipants;
    
                const membership = memberships.find(m => m.id === participant.membershipId);
                if (membership?.type === 'clip_card' && participant.clipCardStatus) {
                    return prevParticipants.map(p => 
                        p.id === participantId 
                        ? { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                        : p
                    );
                }
                return prevParticipants;
            });
        }
    }, [groupClassSchedules, participantBookings, memberships, setParticipantBookingsData, setParticipantDirectoryData]);

    const handleCancelBooking = useCallback((bookingId: string) => {
        const bookingToCancel = participantBookings.find(b => b.id === bookingId);
        if (!bookingToCancel) return;
    
        const wasBooked = bookingToCancel.status === 'BOOKED' || bookingToCancel.status === 'CHECKED-IN';
    
        let promotedBooking: ParticipantBooking | undefined;
        if (wasBooked) {
            const waitlisters = participantBookings
                .filter(b => 
                    b.scheduleId === bookingToCancel.scheduleId && 
                    b.classDate === bookingToCancel.classDate && 
                    b.status === 'WAITLISTED'
                )
                .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
            
            if (waitlisters.length > 0) {
                const participantToPromote = participantDirectory.find(p => p.id === waitlisters[0].participantId);
                const membership = participantToPromote ? memberships.find(m => m.id === participantToPromote.membershipId) : undefined;
                
                let canBePromoted = true;
                if (membership?.type === 'clip_card' && (!participantToPromote?.clipCardStatus || participantToPromote.clipCardStatus.remainingClips <= 0)) {
                    canBePromoted = false;
                }
                if (canBePromoted) {
                    promotedBooking = waitlisters[0];
                }
            }
        }
    
        setParticipantDirectoryData(prev => {
            let nextState = [...prev];
            
            if (wasBooked) {
                const participantToRefund = nextState.find(p => p.id === bookingToCancel.participantId);
                const membership = participantToRefund ? memberships.find(m => m.id === participantToRefund.membershipId) : undefined;
                if (membership?.type === 'clip_card' && participantToRefund?.clipCardStatus) {
                    nextState = nextState.map(p => 
                        p.id === participantToRefund.id 
                        ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips + 1 }, lastUpdated: new Date().toISOString() }
                        : p
                    );
                }
            }
    
            if (promotedBooking) {
                const participantToPromote = nextState.find(p => p.id === promotedBooking!.participantId);
                const membership = participantToPromote ? memberships.find(m => m.id === participantToPromote.membershipId) : undefined;
                if (membership?.type === 'clip_card' && participantToPromote?.clipCardStatus) {
                     nextState = nextState.map(p => 
                        p.id === participantToPromote.id 
                        ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                        : p
                    );
                }
            }
            
            return nextState;
        });
    
        setParticipantBookingsData(prev => {
            let nextState = prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' as BookingStatus } : b);
            if (promotedBooking) {
                const promotedIdx = nextState.findIndex(b => b.id === promotedBooking!.id);
                if (promotedIdx !== -1) {
                    nextState[promotedIdx] = { ...nextState[promotedIdx], status: 'BOOKED' as BookingStatus };
                }
            }
            return nextState;
        });
    
    }, [participantBookings, participantDirectory, memberships, setParticipantBookingsData, setParticipantDirectoryData]);

    const handlePromoteFromWaitlist = useCallback((bookingId: string) => {
        setParticipantBookingsData(prevBookings => {
            const bookingToPromote = prevBookings.find(b => b.id === bookingId);
            if (!bookingToPromote || bookingToPromote.status !== 'WAITLISTED') {
                return prevBookings;
            }

            const schedule = groupClassSchedules.find(s => s.id === bookingToPromote.scheduleId);
            if (!schedule) return prevBookings;
            
            const bookedCount = prevBookings.filter(b => b.scheduleId === bookingToPromote.scheduleId && b.classDate === bookingToPromote.classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')).length;
            if (bookedCount >= schedule.maxParticipants) {
                console.warn("Attempted to promote from waitlist to a full class.");
                return prevBookings;
            }

            const participant = participantDirectory.find(p => p.id === bookingToPromote.participantId);
            const membership = participant ? memberships.find(m => m.id === participant.membershipId) : undefined;
            if (membership?.type === 'clip_card' && participant?.clipCardStatus && participant.clipCardStatus.remainingClips > 0) {
                setParticipantDirectoryData(prevParts => prevParts.map(p => 
                    p.id === participant.id 
                    ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                    : p
                ));
            }

            return prevBookings.map(b => b.id === bookingId ? { ...b, status: 'BOOKED' as BookingStatus } : b);
        });
    }, [groupClassSchedules, participantDirectory, memberships, setParticipantBookingsData, setParticipantDirectoryData]);

    const handleCheckInParticipant = useCallback((bookingId: string) => {
        setParticipantBookingsData(prev =>
        prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' as BookingStatus } : b))
        );
    }, [setParticipantBookingsData]);

    const handleToggleReaction = useCallback((logId: string, logType: FlowItemLogType, emoji: string) => {
        if (!auth.currentParticipantId) return;

        const updater = (logs: any[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const myReactions = (log.reactions || []).filter((r: Reaction) => r.participantId === auth.currentParticipantId);
                    let updatedReactions = [...(log.reactions || [])];

                    if (myReactions.length > 0) {
                        const myExistingReaction = myReactions.find(r => r.emoji === emoji);
                        updatedReactions = updatedReactions.filter(r => r.participantId !== auth.currentParticipantId);
                        if (!myExistingReaction) {
                            updatedReactions.push({ participantId: auth.currentParticipantId, emoji });
                        }
                    } else {
                        updatedReactions.push({ participantId: auth.currentParticipantId, emoji });
                    }
                    return { ...log, reactions: updatedReactions };
                }
                return log;
            });
        };

        switch (logType) {
            case 'workout': setWorkoutLogsData(updater); break;
            case 'general': setGeneralActivityLogsData(updater); break;
            case 'coach_event': setCoachEventsData(updater); break;
            case 'goal_completion': setGoalCompletionLogsData(updater); break;
            case 'participant_club_membership': setClubMembershipsData(updater); break;
            case 'user_strength_stat': setUserStrengthStatsData(updater); break;
            case 'participant_physique_stat': setParticipantPhysiqueHistoryData(updater); break;
            case 'participant_goal_data': setParticipantGoalsData(updater); break;
            case 'participant_conditioning_stat': setUserConditioningStatsHistoryData(updater); break;
            default: console.warn(`Unsupported logType for reaction: ${logType}`);
        }
    }, [
        auth.currentParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData,
        setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData,
        setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData
    ]);

    const handleAddComment = useCallback((logId: string, logType: FlowItemLogType, text: string) => {
        const authorId = auth.user?.id;
        if (!authorId) return;

        let authorName = auth.user.name;
        if (auth.isStaffViewingAsParticipant && auth.currentParticipantId) {
            const pProfile = participantDirectory.find(p => p.id === auth.currentParticipantId);
            if(pProfile) authorName = pProfile.name || auth.user.name;
        }

        const newComment: Comment = {
            id: crypto.randomUUID(), authorId, authorName, text,
            createdDate: new Date().toISOString(),
        };
        
        const updater = (logs: any[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const updatedComments = [...(log.comments || []), newComment];
                    return { ...log, comments: updatedComments };
                }
                return log;
            });
        };
        
        switch (logType) {
            case 'workout': setWorkoutLogsData(updater); break;
            case 'general': setGeneralActivityLogsData(updater); break;
            case 'coach_event': setCoachEventsData(updater); break;
            case 'one_on_one_session': setOneOnOneSessionsData(updater); break;
            case 'goal_completion': setGoalCompletionLogsData(updater); break;
            case 'participant_club_membership': setClubMembershipsData(updater); break;
            case 'user_strength_stat': setUserStrengthStatsData(updater); break;
            case 'participant_physique_stat': setParticipantPhysiqueHistoryData(updater); break;
            case 'participant_goal_data': setParticipantGoalsData(updater); break;
            case 'participant_conditioning_stat': setUserConditioningStatsHistoryData(updater); break;
            default: console.warn(`Unsupported logType for add comment: ${logType}`);
        }
    }, [
        auth.user, auth.isStaffViewingAsParticipant, auth.currentParticipantId, participantDirectory,
        setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData,
        setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData,
        setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData
    ]);

    const handleDeleteComment = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
        const updater = (logs: any[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const updatedComments = (log.comments || []).filter((c: Comment) => c.id !== commentId);
                    return { ...log, comments: updatedComments };
                }
                return log;
            });
        };

        switch (logType) {
            case 'workout': setWorkoutLogsData(updater); break;
            case 'general': setGeneralActivityLogsData(updater); break;
            case 'coach_event': setCoachEventsData(updater); break;
            case 'one_on_one_session': setOneOnOneSessionsData(updater); break;
            case 'goal_completion': setGoalCompletionLogsData(updater); break;
            case 'participant_club_membership': setClubMembershipsData(updater); break;
            case 'user_strength_stat': setUserStrengthStatsData(updater); break;
            case 'participant_physique_stat': setParticipantPhysiqueHistoryData(updater); break;
            case 'participant_goal_data': setParticipantGoalsData(updater); break;
            case 'participant_conditioning_stat': setUserConditioningStatsHistoryData(updater); break;
            default: console.warn(`Unsupported logType for delete comment: ${logType}`);
        }
    }, [
        setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData,
        setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData,
        setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData
    ]);

    const handleToggleCommentReaction = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
        if (!auth.currentParticipantId) return;
        const participantId = auth.currentParticipantId;
    
        const updater = (prevLogs: any[]) => {
            return prevLogs.map(log => {
                if (log.id === logId) {
                    const updatedComments = (log.comments || []).map((comment: Comment) => {
                        if (comment.id === commentId) {
                            const existingReactions = comment.reactions || [];
                            const myReactionIndex = existingReactions.findIndex(r => r.participantId === participantId);
    
                            if (myReactionIndex > -1) {
                                return { ...comment, reactions: existingReactions.filter((_, index) => index !== myReactionIndex) };
                            } else {
                                return { ...comment, reactions: [...existingReactions, { participantId, emoji: '❤️' }] };
                            }
                        }
                        return comment;
                    });
                    return { ...log, comments: updatedComments };
                }
                return log;
            });
        };
        
        switch(logType) {
            case 'workout': setWorkoutLogsData(updater); break;
            case 'general': setGeneralActivityLogsData(updater); break;
            case 'coach_event': setCoachEventsData(updater); break;
            case 'one_on_one_session': setOneOnOneSessionsData(updater); break;
            case 'goal_completion': setGoalCompletionLogsData(updater); break;
            case 'participant_club_membership': setClubMembershipsData(updater); break;
            case 'user_strength_stat': setUserStrengthStatsData(updater); break;
            case 'participant_physique_stat': setParticipantPhysiqueHistoryData(updater); break;
            case 'participant_goal_data': setParticipantGoalsData(updater); break;
            case 'participant_conditioning_stat': setUserConditioningStatsHistoryData(updater); break;
            default: console.warn(`Unsupported logType for comment reaction: ${logType}`);
        }
    }, [
        auth.currentParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData,
        setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData,
        setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData,
        setUserConditioningStatsHistoryData
    ]);


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

    const prospectModalShownKey = auth.currentParticipantId ? `flexibel_prospectProfileModalShown_${auth.currentParticipantId}` : null;

    useEffect(() => {
        if (auth.currentRole === UserRole.PARTICIPANT && auth.currentParticipantId && participantDirectory.length > 0) {
            const profile = participantDirectory.find(p => p.id === auth.currentParticipantId);
    
            // Welcome modal logic
            if (!welcomeModalShown) {
                setIsWelcomeModalOpen(true);
            }
    
            // New logic for initial profile modal for prospects
            if (profile?.isProspect) {
                const isProfileComplete = !!(profile.age && profile.gender && profile.gender !== '-');
                if (!isProfileComplete) {
                    const hasBeenShown = prospectModalShownKey ? localStorage.getItem(prospectModalShownKey) === 'true' : false;
                    if (!hasBeenShown) {
                        setOpenProfileModalOnInit(true);
                    }
                }
            }
        }
    }, [auth.currentRole, auth.currentParticipantId, welcomeModalShown, participantDirectory, prospectModalShownKey]);
    
    const handleProfileModalOpened = () => {
        const profile = participantDirectory.find(p => p.id === auth.currentParticipantId);
        if (profile?.isProspect && prospectModalShownKey) {
            localStorage.setItem(prospectModalShownKey, 'true');
        }
        setOpenProfileModalOnInit(false);
    };

    const handleOpenProfile = () => {
        // If we are in participant view (either as a real participant or a staff member)
        if (auth.currentRole === UserRole.PARTICIPANT && profileOpener) {
            profileOpener.open();
        } 
        // If we are a staff member in coach view or system owner, switch to participant view and open it
        else if (auth.currentRole === UserRole.COACH || (auth.user?.roles.systemOwner && !auth.isImpersonating)) {
            auth.viewAsParticipant();
            setOpenProfileModalOnInit(true);
        }
    };

    const renderMainView = () => {
        // Show a loader if auth is determining state, or if we are logged out and still fetching global data.
        if (auth.isLoading || (!auth.user && isGlobalDataLoading)) {
            const logo = cachedLogo;
             return (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-dotted-pattern bg-dotted-size z-50">
                    <div>
                        {logo ? (
                           <img src={logo} alt="Logotyp" className="h-24 w-auto object-contain" />
                        ) : (
                           <img src="/icon-512x512.png" alt="Logotyp" className="h-24 w-auto object-contain" />
                        )}
                    </div>
                </div>
            )
        }
        
        if (registrationPendingMessage) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
                    <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-4 text-center">
                        <h2 className="text-3xl font-semibold text-green-700">Tack för din registrering!</h2>
                        <p className="text-lg text-gray-600">
                            Ditt konto väntar på godkännande av en coach. Godkännande sker vanligtvis inom 2 timmar. Du kommer inte kunna logga in förrän det är godkänt.
                        </p>
                        <Button onClick={() => {
                            setRegistrationPendingMessage(false);
                            setView('login');
                        }} fullWidth size="lg">Tillbaka till inloggning</Button>
                    </div>
                </div>
            );
        }
        
        if (!auth.user) {
            if (view === 'login') {
                return <Login onSwitchToRegister={() => setView('register')} />;
            }
            if (view === 'register') {
                return <Register onSwitchToLogin={() => setView('login')} onRegistrationSuccess={() => setRegistrationPendingMessage(true)} />;
            }
        }
        
        // If user is authenticated, but org data is loading, show the branded loader.
        if (auth.user && isOrgDataLoading) {
            const logo = cachedLogo || branding?.logoBase64;
             return (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-dotted-pattern bg-dotted-size z-50">
                    <div>
                        {logo ? (
                           <img src={logo} alt="Logotyp" className="h-24 w-auto object-contain" />
                        ) : (
                           <img src="/icon-512x512.png" alt="Logotyp" className="h-24 w-auto object-contain" />
                        )}
                    </div>
                </div>
            );
        }

        if (auth.user.roles.systemOwner && !auth.isImpersonating) {
            return <SystemOwnerArea />;
        }

        if (auth.currentRole === UserRole.COACH) {
            return (
                <div className="container mx-auto p-4 sm:p-6">
                    <CoachArea
                        ai={ai}
                        onAddComment={handleAddComment}
                        onDeleteComment={handleDeleteComment}
                        onToggleCommentReaction={handleToggleCommentReaction}
                        onCheckInParticipant={handleCheckInParticipant}
                        onBookClass={handleBookClass}
                        onCancelBooking={handleCancelBooking}
                        onPromoteFromWaitlist={handlePromoteFromWaitlist}
                    />
                </div>
            );
        }
        
        if (auth.currentRole === UserRole.PARTICIPANT && auth.currentParticipantId) {
            return (
                <>
                    <ParticipantArea
                        currentParticipantId={auth.currentParticipantId}
                        onSetRole={auth.logout}
                        onToggleReaction={handleToggleReaction}
                        onAddComment={handleAddComment}
                        onDeleteComment={handleDeleteComment}
                        onToggleCommentReaction={handleToggleCommentReaction}
                        openProfileModalOnInit={openProfileModalOnInit}
                        onProfileModalOpened={handleProfileModalOpened}
                        isStaffViewingSelf={auth.isStaffViewingAsParticipant}
                        onSwitchToStaffView={auth.stopViewingAsParticipant}
                        onCheckInParticipant={handleCheckInParticipant}
                        onBookClass={handleBookClass}
                        onCancelBooking={handleCancelBooking}
                        setProfileOpener={setProfileOpener}
                        setNavbarActions={setParticipantNavbarActions}
                    />
                    <WelcomeModal 
                        isOpen={isWelcomeModalOpen}
                        onClose={() => {
                            setIsWelcomeModalOpen(false);
                            setWelcomeModalShown(true);
                        }}
                    />
                </>
            );
        }
        
        // Fallback for unexpected states, e.g., a user without roles.
        return <Login onSwitchToRegister={() => setView('register')} />;
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <Navbar onOpenProfile={handleOpenProfile} participantActions={participantNavbarActions} />
            <OfflineBanner />
            <main>
                <Suspense fallback={<LoadingSpinner />}>
                    {renderMainView()}
                </Suspense>
            </main>
        </div>
    );
}

export const App: React.FC = () => {
    return (
      <AuthProvider>
        <AppProvider>
          <NetworkStatusProvider>
            <AppContent />
          </NetworkStatusProvider>
        </AppProvider>
      </AuthProvider>
    );
};