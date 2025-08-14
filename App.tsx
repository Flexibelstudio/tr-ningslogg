import React, { useState, useEffect, useCallback } from 'react';
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
import { CoachArea } from './components/coach/CoachArea';
import { ParticipantArea } from './components/participant/ParticipantArea';
import { LOCAL_STORAGE_KEYS, CLUB_DEFINITIONS } from './constants'; 
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; 
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { SystemOwnerArea } from './components/SystemOwnerArea';

const API_KEY = process.env.API_KEY;

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
    } = useAppContext();
    
    const auth = useAuth();

    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const [welcomeModalShown, setWelcomeModalShown] = useLocalStorage<boolean>(
        LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT,
        false
    );
    const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);


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

    const handleToggleReaction = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => {
        if (!auth.currentParticipantId) return;
        
        const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const myReactions = (log.reactions || []).filter((r: Reaction) => r.participantId === auth.currentParticipantId);
                    let updatedReactions = [...(log.reactions || [])];

                    if (myReactions.length > 0) { // I have reacted before
                        const myExistingReaction = myReactions.find(r => r.emoji === emoji);
                        updatedReactions = updatedReactions.filter(r => r.participantId !== auth.currentParticipantId);
                        if (!myExistingReaction) { // I reacted with a different emoji, so add the new one
                            updatedReactions.push({ participantId: auth.currentParticipantId, emoji });
                        }
                    } else { // First time I react
                        updatedReactions.push({ participantId: auth.currentParticipantId, emoji });
                    }
                    return { ...log, reactions: updatedReactions };
                }
                return log;
            });
        };

        if (logType === 'workout') {
            setWorkoutLogsData(updater as any);
        } else if (logType === 'general') {
            setGeneralActivityLogsData(updater as any);
        } else if (logType === 'coach_event') {
            setCoachEventsData(updater as any);
        }
    }, [setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, auth.currentParticipantId]);

    const handleAddComment = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => {
        const authorId = auth.user?.id;
        if (!authorId) return;

        let authorName = auth.user.name;
        // If a staff member is viewing as themselves, they are commenting as their participant profile.
        if (auth.isStaffViewingAsParticipant && auth.currentParticipantId) {
            const pProfile = participantDirectory.find(p => p.id === auth.currentParticipantId);
            if(pProfile) authorName = pProfile.name || auth.user.name;
        }

        const newComment: Comment = {
            id: crypto.randomUUID(),
            authorId: authorId,
            authorName: authorName,
            text,
            createdDate: new Date().toISOString(),
        };
        
        const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const updatedComments = [...(log.comments || []), newComment];
                    return { ...log, comments: updatedComments };
                }
                return log;
            });
        };

        if (logType === 'workout') {
            setWorkoutLogsData(updater as any);
        } else if (logType === 'general') {
            setGeneralActivityLogsData(updater as any);
        } else if (logType === 'coach_event') {
            setCoachEventsData(updater as any);
        } else if (logType === 'one_on_one_session') {
            setOneOnOneSessionsData(prev => 
                prev.map(session => {
                    if (session.id === logId) {
                        const updatedComments = [...(session.comments || []), newComment];
                        return { ...session, comments: updatedComments };
                    }
                    return session;
                })
            );
        }
    }, [setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, auth.user, auth.isStaffViewingAsParticipant, auth.currentParticipantId, participantDirectory]);

    const handleDeleteComment = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => {
        const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
            return logs.map(log => {
                if (log.id === logId) {
                    const updatedComments = (log.comments || []).filter((c: Comment) => c.id !== commentId);
                    return { ...log, comments: updatedComments };
                }
                return log;
            });
        };

        if (logType === 'workout') {
            setWorkoutLogsData(updater as any);
        } else if (logType === 'general') {
            setGeneralActivityLogsData(updater as any);
        } else if (logType === 'coach_event') {
            setCoachEventsData(updater as any);
        } else if (logType === 'one_on_one_session') {
            setOneOnOneSessionsData(prev => 
                prev.map(session => {
                    if (session.id === logId) {
                        const updatedComments = (session.comments || []).filter((c: Comment) => c.id !== commentId);
                        return { ...session, comments: updatedComments };
                    }
                    return session;
                })
            );
        }
    }, [setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData]);


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

    useEffect(() => {
        if (auth.currentRole === UserRole.PARTICIPANT && auth.currentParticipantId) {
        const profile = participantDirectory.find(p => p.id === auth.currentParticipantId);
        const isProfileComplete = !!(profile && profile.age && profile.gender && profile.gender !== '-');
        
        if (welcomeModalShown && !isProfileComplete) {
            setOpenProfileModalOnInit(true);
        }
        if (!welcomeModalShown) {
            setIsWelcomeModalOpen(true);
        }
        }
    }, [auth.currentRole, auth.currentParticipantId, welcomeModalShown, participantDirectory]);
    
    const handleOpenProfileInParticipantView = () => {
        auth.viewAsParticipant();
        setOpenProfileModalOnInit(true);
    };

    const renderMainView = () => {
        if (auth.isLoading) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
                    <p className="text-white mt-4 text-lg">Laddar...</p>
                </div>
            )
        }
        
        if (!auth.user) {
            return <Login />;
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
                        openProfileModalOnInit={openProfileModalOnInit}
                        onProfileModalOpened={() => setOpenProfileModalOnInit(false)}
                        isStaffViewingSelf={auth.isStaffViewingAsParticipant}
                        onSwitchToStaffView={auth.stopViewingAsParticipant}
                        onCheckInParticipant={handleCheckInParticipant}
                        onBookClass={handleBookClass}
                        onCancelBooking={handleCancelBooking}
                    />
                    <WelcomeModal 
                        isOpen={isWelcomeModalOpen}
                        onClose={() => {
                            setIsWelcomeModalOpen(false);
                            setWelcomeModalShown(true);
                            const profile = participantDirectory.find(p => p.id === auth.currentParticipantId);
                            const isProfileComplete = !!(profile && profile.age && profile.gender && profile.gender !== '-');
                            if (!isProfileComplete) {
                                setOpenProfileModalOnInit(true);
                            }
                        }}
                    />
                </>
            );
        }
        
        // Fallback for unexpected states, e.g., a user without roles.
        return <Login />;
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <Navbar onOpenProfileInParticipantView={handleOpenProfileInParticipantView} />
            <main>{renderMainView()}</main>
        </div>
    );
}

export const App: React.FC = () => {
    return (
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    );
};