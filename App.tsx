import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';

import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { Button } from './components/Button';
import { ConfirmationModal } from './components/ConfirmationModal';
import { DevToolbar } from './components/DevToolbar';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { Register } from './components/Register';
import { TermsModal } from './components/TermsModal';
import { WelcomeModal } from './components/participant/WelcomeModal';
import { UpdateNoticeModal } from './components/participant/UpdateNoticeModal';
import { LOCAL_STORAGE_KEYS } from './constants';
import { FlowItemLogType, User, UserRole, GeneralActivityLog } from './types';
import { useNotifications } from './context/NotificationsContext';
import { logAnalyticsEvent } from './utils/analyticsLogger';

const CoachArea = lazy(() => import('./components/coach/CoachArea').then((m) => ({ default: m.CoachArea })));
const ParticipantArea = lazy(() => import('./components/participant/ParticipantArea').then((m) => ({ default: m.ParticipantArea })));
const SystemOwnerArea = lazy(() => import('./components/SystemOwnerArea').then((m) => ({ default: m.SystemOwnerArea })));
const PublicLeadForm = lazy(() => import('./components/public/PublicLeadForm').then((m) => ({ default: m.PublicLeadForm })));
const ZapierWebhookHandler = lazy(() => import('./components/api/ZapierWebhookHandler').then((m) => ({ default: m.ZapierWebhookHandler })));

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-flexibel"></div>
  </div>
);

const AppContent: React.FC = () => {
  // NEW ROUTING LOGIC for public lead form
  if (window.location.pathname.startsWith('/public/lead-form')) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <PublicLeadForm />
      </Suspense>
    );
  }

  // Add back webhook handler for preview environment
  if (window.location.pathname.startsWith('/api/zapier-lead-webhook')) {
    return (
      <Suspense fallback={<div>Processing...</div>}>
        <ZapierWebhookHandler />
      </Suspense>
    );
  }

  const {
    participantDirectory,
    memberships,
    workoutLogs,
    generalActivityLogs,
    coachEvents,
    oneOnOneSessions,
    participantBookings,
    setParticipantBookingsData,
    groupClassSchedules,
    groupClassDefinitions: definitions,
    isOrgDataLoading,
    isGlobalDataLoading, // Get new loading state
    branding,
    goalCompletionLogs,
    clubMemberships,
    userStrengthStats,
    participantPhysiqueHistory,
    participantGoals,
    setParticipantGoalsData,
    userConditioningStatsHistory,
    connections,
    lastFlowViewTimestamp,
    updateUser,
    setWorkoutLogsData,
    setGeneralActivityLogsData,
    setGoalCompletionLogsData,
    setClubMembershipsData,
    setUserStrengthStatsData,
    setParticipantPhysiqueHistoryData,
    setUserConditioningStatsHistoryData,
    setCoachEventsData,
    setOneOnOneSessionsData,
    setParticipantDirectoryData,
  } = useAppContext();

  const auth = useAuth();
  const { addNotification } = useNotifications();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [registrationPendingMessage, setRegistrationPendingMessage] = useState(false);

  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeModalShown, setWelcomeModalShown] = useState(() => localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT) === 'true');
  const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);
  const [profileOpener, setProfileOpener] = useState<{ open: () => void } | null>(null);
  const [cachedLogo, setCachedLogo] = useState<string | null>(() => {
    const lastOrgId = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID);
    if (lastOrgId) {
      return localStorage.getItem(`flexibel_logo_${lastOrgId}`);
    }
    return null;
  });

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasCheckedTerms, setHasCheckedTerms] = useState(false);

  useEffect(() => {
    if (auth.user && !auth.user.termsAcceptedTimestamp && !hasCheckedTerms) {
      setShowTermsModal(true);
      setHasCheckedTerms(true);
    }
  }, [auth.user, hasCheckedTerms]);

  const handleAcceptTerms = useCallback(async () => {
    if (auth.user) {
      try {
        await updateUser(auth.user.id, { termsAcceptedTimestamp: new Date().toISOString() });
        setShowTermsModal(false);
      } catch (error) {
        console.error('Failed to accept terms:', error);
        alert('Kunde inte spara ditt godkännande. Vänligen försök igen.');
      }
    }
  }, [auth.user, updateUser]);

  // --- Update Notice Logic ---
  const UPDATE_NOTICE_KEY = 'updateNotice_v3_AICoach'; // Unique key for this update version
  const LAST_SEEN_UPDATE_KEY = 'flexibel_lastSeenUpdateNotice'; // Local storage key to track what the user has seen
  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnreadUpdate, setHasUnreadUpdate] = useState(false); // State for the notification dot

  useEffect(() => {
    if (auth.user && auth.currentRole === 'participant') {
      // Logic for the notification dot
      const lastSeenVersion = localStorage.getItem(LAST_SEEN_UPDATE_KEY);
      if (lastSeenVersion !== UPDATE_NOTICE_KEY) {
        setHasUnreadUpdate(true);
      }
    }
  }, [auth.user, auth.currentRole]);

  const handleOpenLatestUpdateView = useCallback(() => {
    setShowLatestUpdateView(true);
    // Mark the update as seen to remove the dot
    localStorage.setItem(LAST_SEEN_UPDATE_KEY, UPDATE_NOTICE_KEY);
    setHasUnreadUpdate(false);
  }, []);
  // --- END: Update Notice Logic ---

  // State for modal openers to be passed from ParticipantArea to Navbar
  const [participantModalOpeners, setParticipantModalOpeners] = useState({
    openGoalModal: () => {},
    openCommunityModal: () => {},
    openFlowModal: () => {},
    openAiReceptModal: () => {},
  });

  // Derived data for Navbar, calculated here in the common ancestor component
  const { aiRecept, pendingRequestsCount, newFlowItemsCount } = useMemo(() => {
    if (auth.currentRole !== 'participant' || !auth.currentParticipantId) {
      return { aiRecept: null, pendingRequestsCount: 0, newFlowItemsCount: 0 };
    }

    const myParticipantGoals = participantGoals.filter((g) => g.participantId === auth.currentParticipantId);
    const sortedGoals = [...myParticipantGoals].sort((a, b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
    const latestActiveGoal = sortedGoals.find((g) => !g.isCompleted) || sortedGoals[0] || null;

    const recept = latestActiveGoal?.aiPrognosis;
    const requests = connections.filter((c) => c.receiverId === auth.currentParticipantId && c.status === 'pending').length;

    // --- NEW newFlowItemsCount logic ---
    let count = 0;
    if (lastFlowViewTimestamp) {
      // Only calculate if user has visited the flow before
      const lastViewTime = new Date(lastFlowViewTimestamp).getTime();
      const myId = auth.currentParticipantId;

      const myFriendsIds = new Set<string>();
      connections.forEach((c) => {
        if (c.status === 'accepted') {
          if (c.requesterId === myId) myFriendsIds.add(c.receiverId);
          if (c.receiverId === myId) myFriendsIds.add(c.requesterId);
        }
      });

      const newNotificationItems = new Set<string>();

      // 1. New posts/events from coaches
      coachEvents.forEach((event) => {
        if (new Date(event.createdDate).getTime() > lastViewTime) {
          newNotificationItems.add(`event-${event.id}`);
        }
      });

      // This is a comprehensive list of all things that can appear in the flow from another user
      const allUserContent: (
        | typeof workoutLogs[0]
        | typeof generalActivityLogs[0]
        | typeof goalCompletionLogs[0]
        | typeof clubMemberships[0]
        | typeof userStrengthStats[0]
        | typeof participantPhysiqueHistory[0]
        | typeof participantGoals[0]
        | typeof userConditioningStatsHistory[0]
      )[] = [
        ...workoutLogs,
        ...generalActivityLogs,
        ...goalCompletionLogs,
        ...clubMemberships,
        ...userStrengthStats,
        ...participantPhysiqueHistory,
        ...participantGoals,
        ...userConditioningStatsHistory,
      ];

      allUserContent.forEach((item) => {
        const itemDate = new Date(
          'completedDate' in item
            ? item.completedDate
            : 'achievedDate' in item
            ? item.achievedDate
            : 'setDate' in item
            ? item.setDate
            : item.lastUpdated
        ).getTime();

        // 2. New content created by friends
        if (myFriendsIds.has((item as { participantId: string }).participantId) && itemDate > lastViewTime) {
          newNotificationItems.add(`item-${item.id}`);
        }

        // 3. New interactions on my content
        if ((item as { participantId: string }).participantId === myId) {
          (item.comments || []).forEach((comment) => {
            if (comment.authorId !== myId && new Date(comment.createdDate).getTime() > lastViewTime) {
              newNotificationItems.add(`comment-${comment.id}`);
            }
          });
          (item.reactions || []).forEach((reaction) => {
            // The 'createdDate' on Reaction is the new field.
            if (reaction.participantId !== myId && new Date(reaction.createdDate).getTime() > lastViewTime) {
              newNotificationItems.add(`reaction-${item.id}-${reaction.participantId}-${reaction.emoji}`);
            }
          });
        }
      });
      count = newNotificationItems.size;
    }

    return { aiRecept: recept, pendingRequestsCount: requests, newFlowItemsCount: count };
  }, [
    auth.currentRole,
    auth.currentParticipantId,
    participantGoals,
    connections,
    lastFlowViewTimestamp,
    coachEvents,
    workoutLogs,
    generalActivityLogs,
    goalCompletionLogs,
    clubMemberships,
    userStrengthStats,
    participantPhysiqueHistory,
    userConditioningStatsHistory,
  ]);

  useEffect(() => {
    if (auth.organizationId) {
      const logo = localStorage.getItem(`flexibel_logo_${auth.organizationId}`);
      setCachedLogo(logo);
    } else if (!auth.isLoading) {
      // If auth is resolved and there's no orgId, it means user is logged out.
      setCachedLogo(null);
    }
  }, [auth.organizationId, auth.isLoading]);

  const handleBookClass = useCallback(
    (participantId: string, scheduleId: string, classDate: string) => {
      if (!auth.organizationId) return;

      // 1. Check for an ACTIVE booking. If one exists, do nothing.
      const activeBooking = participantBookings.find(
        (b) =>
          b.participantId === participantId &&
          b.scheduleId === scheduleId &&
          b.classDate === classDate &&
          (b.status === 'BOOKED' || b.status === 'WAITLISTED')
      );

      if (activeBooking) {
        console.warn('Participant is already actively booked or on the waitlist for this class.');
        return;
      }

      const schedule = groupClassSchedules.find((s) => s.id === scheduleId);
      if (!schedule) {
        console.error('Schedule not found');
        return;
      }
      const classDef = definitions.find((d) => d.id === schedule.groupClassId);

      // Helper function for clip card logic to avoid duplication
      const deductClipCard = () => {
        setParticipantDirectoryData((prevParticipants) => {
          const participant = prevParticipants.find((p) => p.id === participantId);
          if (!participant || !participant.membershipId) return prevParticipants;

          const membership = memberships.find((m) => m.id === participant.membershipId);
          if (membership?.type === 'clip_card' && participant.clipCardStatus && participant.clipCardStatus.remainingClips > 0) {
            return prevParticipants.map((p) =>
              p.id === participantId
                ? { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                : p
            );
          }
          return prevParticipants;
        });
      };

      // Determine capacity and new status
      const bookedCount = participantBookings.filter(
        (b) => b.scheduleId === scheduleId && b.classDate === classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
      ).length;

      const newStatus = bookedCount >= schedule.maxParticipants ? 'WAITLISTED' : 'BOOKED';

      // 2. Check for a PREVIOUSLY CANCELLED booking for the same class.
      const cancelledBooking = participantBookings.find(
        (b) => b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === classDate && b.status === 'CANCELLED'
      );

      // 3. If a cancelled booking exists, REACTIVATE it.
      if (cancelledBooking) {
        const reactivatedBooking: typeof participantBookings[0] = {
          ...cancelledBooking,
          status: newStatus,
          bookingDate: new Date().toISOString(),
        };

        setParticipantBookingsData((prev) => prev.map((b) => (b.id === cancelledBooking.id ? reactivatedBooking : b)));
      } else {
        // 4. If no previous booking exists, CREATE a new one.
        const newBooking: typeof participantBookings[0] = {
          id: crypto.randomUUID(),
          participantId,
          scheduleId,
          classDate,
          bookingDate: new Date().toISOString(),
          status: newStatus,
        };

        setParticipantBookingsData((prev) => [...prev, newBooking]);
      }

      // 5. Analytics logging
      if (schedule && classDef) {
        logAnalyticsEvent("BOOKING_CREATED", {
          participantId,
          scheduleId: schedule.id,
          classId: schedule.groupClassId,
          classDate,
          coachId: schedule.coachId,
          locationId: schedule.locationId,
          classType: classDef.name,
          wasWaitlisted: newStatus === 'WAITLISTED',
        }, auth.organizationId);
      }

      // 6. Fire notification and deduct clip card if booked
      if (newStatus === 'BOOKED') {
          addNotification({
              type: 'SUCCESS',
              title: 'Bokning Lyckades!',
              message: `Du är nu bokad på ${classDef?.name} den ${new Date(classDate).toLocaleDateString('sv-SE')}.`
          });
          deductClipCard();
      } else { // WAITLISTED
          addNotification({
              type: 'INFO',
              title: 'Du är på kölistan',
              message: `Passet är fullt. Du har placerats på kölistan för ${classDef?.name}.`
          });
      }
    },
    [groupClassSchedules, participantBookings, memberships, setParticipantBookingsData, setParticipantDirectoryData, definitions, addNotification, auth.organizationId]
  );

  const handleCancelBooking = useCallback(
    (bookingId: string) => {
      if (!auth.organizationId) return;
      const bookingToCancel = participantBookings.find(b => b.id === bookingId);
      if (!bookingToCancel) return;
      
      const schedule = groupClassSchedules.find(s => s.id === bookingToCancel.scheduleId);
      const classDef = definitions.find(d => d.id === schedule?.groupClassId);

      // Analytics logging
      if (schedule && classDef) {
        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const startDateTime = new Date(bookingToCancel.classDate);
        startDateTime.setHours(hour, minute);
        const cancelledWithinHours = (startDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);

        logAnalyticsEvent("BOOKING_CANCELLED", {
          participantId: bookingToCancel.participantId,
          scheduleId: schedule.id,
          classId: schedule.groupClassId,
          classDate: bookingToCancel.classDate,
          coachId: schedule.coachId,
          locationId: schedule.locationId,
          classType: classDef.name,
          cancelledWithinHours: Math.max(0, cancelledWithinHours),
        }, auth.organizationId);
      }

      setParticipantBookingsData((prevBookings) => {
        let promotedParticipant: ParticipantProfile | null = null;
        let cancelledClassDef: typeof definitions[0] | null = null;
        const bookingToCancel = prevBookings.find((b) => b.id === bookingId);

        if (!bookingToCancel) return prevBookings;

        const wasBooked = bookingToCancel.status === 'BOOKED' || bookingToCancel.status === 'CHECKED-IN';

        let promotedBooking: typeof participantBookings[0] | undefined;
        let participantToPromoteId: string | undefined;

        if (wasBooked) {
          const waitlisters = prevBookings
            .filter((b) => b.scheduleId === bookingToCancel.scheduleId && b.classDate === bookingToCancel.classDate && b.status === 'WAITLISTED')
            .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());

          if (waitlisters.length > 0) {
            for (const potentialPromotion of waitlisters) {
              const participantProfile = participantDirectory.find((p) => p.id === potentialPromotion.participantId);
              const membership = participantProfile ? memberships.find((m) => m.id === participantProfile.membershipId) : undefined;

              let canBePromoted = true;
              if (membership?.type === 'clip_card') {
                if (!participantProfile?.clipCardStatus || participantProfile.clipCardStatus.remainingClips <= 0) {
                  canBePromoted = false;
                }
              }
              if (canBePromoted) {
                promotedBooking = potentialPromotion;
                participantToPromoteId = potentialPromotion.participantId;
                promotedParticipant = participantProfile || null;
                const promotedSchedule = groupClassSchedules.find(s => s.id === promotedBooking!.scheduleId);
                cancelledClassDef = definitions.find(d => d.id === promotedSchedule?.groupClassId) || null;
                break;
              }
            }
          }
        }

        if (wasBooked) {
          setParticipantDirectoryData((prevParticipants) => {
            let nextParticipants = [...prevParticipants];
            const participantToRefund = nextParticipants.find((p) => p.id === bookingToCancel.participantId);
            const membershipToRefund = participantToRefund ? memberships.find((m) => m.id === participantToRefund.membershipId) : undefined;
            if (membershipToRefund?.type === 'clip_card' && participantToRefund?.clipCardStatus) {
              nextParticipants = nextParticipants.map((p) =>
                p.id === participantToRefund.id
                  ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips + 1 }, lastUpdated: new Date().toISOString() }
                  : p
              );
            }
            if (participantToPromoteId) {
              const participantToPromote = nextParticipants.find((p) => p.id === participantToPromoteId);
              const membershipToPromote = participantToPromote ? memberships.find((m) => m.id === participantToPromote.membershipId) : undefined;
              if (membershipToPromote?.type === 'clip_card' && participantToPromote?.clipCardStatus) {
                nextParticipants = nextParticipants.map((p) =>
                  p.id === participantToPromote.id
                    ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                    : p
                );
              }
            }
            return nextParticipants;
          });
        }
        
        // **NEW: Participant Notification Logic**
        if (promotedParticipant && cancelledClassDef && schedule && auth.currentParticipantId !== promotedParticipant.id) {
          // This notification is intended for another user, but the current system can only show it to the active user.
          // For the purpose of this demo, we'll show a notification to the coach/admin who performed the action.
          // A real implementation would require push notifications or a realtime listener on the promoted user's client.
          const classDate = new Date(bookingToCancel.classDate);
          const dateString = classDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
          const timeString = schedule.startTime;
          
          addNotification({
              type: 'SUCCESS',
              title: `Plats tilldelad: ${promotedParticipant.name}`,
              message: `${promotedParticipant.name} har fått en plats på ${cancelledClassDef.name} ${dateString} kl ${timeString}.`
          });
        }

        return prevBookings.map((b) => {
          if (b.id === bookingId) {
            return { ...b, status: 'CANCELLED' as 'CANCELLED' };
          }
          if (promotedBooking && b.id === promotedBooking.id) {
            return { ...b, status: 'BOOKED' as 'BOOKED' };
          }
          return b;
        });
      });
      
      addNotification({
          type: 'SUCCESS',
          title: 'Avbokning bekräftad',
          message: `Du har avbokat dig från ${classDef?.name || 'passet'}.`
      });
    },
    [participantDirectory, memberships, setParticipantBookingsData, definitions, participantBookings, groupClassSchedules, addNotification, auth.currentRole, auth.organizationId, setParticipantDirectoryData, auth.currentParticipantId]
  );
  
  const handlePromoteFromWaitlist = useCallback(
    (bookingId: string) => {
      if (!auth.organizationId) return;
      setParticipantBookingsData((prevBookings) => {
        const bookingToPromote = prevBookings.find((b) => b.id === bookingId);
        if (!bookingToPromote || bookingToPromote.status !== 'WAITLISTED') {
          return prevBookings;
        }

        const schedule = groupClassSchedules.find((s) => s.id === bookingToPromote.scheduleId);
        if (!schedule) return prevBookings;

        const bookedCount = prevBookings.filter(
          (b) => b.scheduleId === bookingToPromote.scheduleId && b.classDate === bookingToPromote.classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
        ).length;
        if (bookedCount >= schedule.maxParticipants) {
          addNotification({ type: 'WARNING', title: 'Kan inte flytta upp', message: 'Passet är redan fullt.' });
          return prevBookings;
        }
        
        const participant = participantDirectory.find((p) => p.id === bookingToPromote.participantId);
        const classDef = definitions.find(d => d.id === schedule.groupClassId);
        if (participant && classDef) {
            const classDate = new Date(bookingToPromote.classDate);
            const dateString = classDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
            const timeString = schedule.startTime;

            addNotification({
                type: 'SUCCESS',
                title: 'Deltagare Uppflyttad!',
                message: `${participant.name} har nu en bokad plats på ${classDef.name} ${dateString} kl ${timeString}.`
            });

            // Analytics logging
            logAnalyticsEvent("WAITLIST_PROMOTION", {
                participantId: participant.id,
                scheduleId: schedule.id,
                classId: schedule.groupClassId,
                classDate: bookingToPromote.classDate,
                coachId: schedule.coachId,
                locationId: schedule.locationId,
                classType: classDef.name,
            }, auth.organizationId);
        }

        const membership = participant ? memberships.find((m) => m.id === participant.membershipId) : undefined;
        if (membership?.type === 'clip_card' && participant?.clipCardStatus && participant.clipCardStatus.remainingClips > 0) {
          setParticipantDirectoryData((prevParts) =>
            prevParts.map((p) =>
              p.id === participant.id
                ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
                : p
            )
          );
        }

        return prevBookings.map((b) => (b.id === bookingId ? { ...b, status: 'BOOKED' as 'BOOKED' } : b));
      });
    },
    [groupClassSchedules, participantDirectory, memberships, setParticipantBookingsData, definitions, addNotification, auth.organizationId, setParticipantDirectoryData]
  );
  
  const handleCheckInParticipant = useCallback(
    (bookingId: string) => {
      if (!auth.organizationId) return;
      setParticipantBookingsData(prev => {
          const booking = prev.find(b => b.id === bookingId);
          if (booking) {
              const participant = participantDirectory.find(p => p.id === booking.participantId);
              const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
              const classDef = definitions.find(d => d.id === schedule?.groupClassId);

              if (participant && schedule && classDef) {
                  // Analytics logging
                  logAnalyticsEvent("CHECKIN", {
                      participantId: participant.id,
                      scheduleId: schedule.id,
                      classId: schedule.groupClassId,
                      classDate: booking.classDate,
                      coachId: schedule.coachId,
                      locationId: schedule.locationId,
                      classType: classDef.name,
                      checkinType: 'coach',
                  }, auth.organizationId);

                  addNotification({
                      type: 'SUCCESS',
                      title: 'Incheckad!',
                      message: `${participant.name} är nu incheckad på ${classDef.name}.`
                  });
              }
          }
          return prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' as 'CHECKED-IN' } : b));
      });
    },
    [setParticipantBookingsData, participantDirectory, groupClassSchedules, definitions, addNotification, auth.organizationId]
  );

  const handleUnCheckInParticipant = useCallback(
    (bookingId: string) => {
      setParticipantBookingsData((prev) => prev.map((b) => (b.id === bookingId && b.status === 'CHECKED-IN' ? { ...b, status: 'BOOKED' as 'BOOKED' } : b)));
    },
    [setParticipantBookingsData]
  );

  const handleSelfCheckIn = useCallback((participantId: string, classInstanceId: string, checkinType: 'self_qr' | 'location_qr'): boolean => {
    if (!auth.organizationId) return false;
    const parts = classInstanceId.split('-');
    if (parts.length < 4) {
        console.error("Invalid classInstanceId format for self-check-in:", classInstanceId);
        addNotification({
            type: 'ERROR',
            title: 'Incheckning Misslyckades',
            message: 'QR-koden är ogiltig eller har fel format.'
        });
        return false;
    }

    const date = parts.slice(-3).join('-');
    const scheduleId = parts.slice(0, -3).join('-');

    const schedule = groupClassSchedules.find(s => s.id === scheduleId);
    if (!schedule) {
        addNotification({ type: 'ERROR', title: 'Incheckning Misslyckades', message: 'Kunde inte hitta det schemalagda passet.' });
        return false;
    }

    const now = new Date();
    const [hour, minute] = schedule.startTime.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day, hour, minute);

    const fifteenMinutesBefore = new Date(startDateTime.getTime() - 15 * 60 * 1000);

    if (now < fifteenMinutesBefore) {
        addNotification({
            type: 'WARNING',
            title: 'För tidigt för incheckning',
            message: 'Du kan checka in tidigast 15 min före passet.'
        });
        return false;
    }

    if (now > startDateTime) {
        addNotification({
            type: 'WARNING',
            title: 'För sent för incheckning',
            message: 'Passet har redan startat.'
        });
        return false;
    }

    const bookingToUpdate = participantBookings.find(b =>
        b.participantId === participantId &&
        b.scheduleId === scheduleId &&
        b.classDate === date &&
        (b.status === 'BOOKED' || b.status === 'WAITLISTED')
    );

    if (!bookingToUpdate) {
        addNotification({
            type: 'WARNING',
            title: 'Incheckning Misslyckades',
            message: 'Kunde inte hitta en aktiv bokning för detta pass.'
        });
        return false;
    }

    if (bookingToUpdate.status === 'WAITLISTED') {
        const bookedCount = participantBookings.filter(b =>
            b.scheduleId === scheduleId &&
            b.classDate === date &&
            (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
        ).length;
        
        if (bookedCount >= schedule.maxParticipants) {
             addNotification({
                type: 'WARNING',
                title: 'Incheckning Misslyckades',
                message: 'Passet är fullt. Du kan inte checka in från kölistan just nu.'
            });
            return false;
        }
    }

    setParticipantBookingsData(prev => prev.map(b =>
        b.id === bookingToUpdate.id ? { ...b, status: 'CHECKED-IN' as const } : b
    ));

    const classDef = definitions.find(d => d.id === schedule?.groupClassId);

    // Analytics Logging
    if (schedule && classDef) {
        logAnalyticsEvent("CHECKIN", {
            participantId: participantId,
            scheduleId: schedule.id,
            classId: schedule.groupClassId,
            classDate: date,
            coachId: schedule.coachId,
            locationId: schedule.locationId,
            classType: classDef.name,
            checkinType: checkinType,
        }, auth.organizationId);
    }

    const attendanceRecord: GeneralActivityLog = {
        type: 'general',
        id: crypto.randomUUID(),
        participantId: participantId,
        activityName: `Incheckning: ${classDef?.name || 'Gruppass'}`,
        durationMinutes: 0,
        completedDate: new Date().toISOString(),
        comment: `Självincheckning via QR-kod för pass den ${date}.`
    };

    setGeneralActivityLogsData(prev => [...prev, attendanceRecord]);

    addNotification({
        type: 'SUCCESS',
        title: 'Incheckad!',
        message: `Du är nu incheckad på ${classDef?.name || 'passet'}.`
    });
    return true;
}, [participantBookings, groupClassSchedules, definitions, setParticipantBookingsData, setGeneralActivityLogsData, addNotification, auth.organizationId]);

const handleLocationCheckIn = useCallback((participantId: string, locationId: string): boolean => {
    if (!auth.organizationId) return false;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();

    const todaysSchedules = groupClassSchedules.filter(schedule => {
        if (schedule.locationId !== locationId) return false;
        if (!schedule.daysOfWeek.includes(dayOfWeek)) return false;

        const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        
        const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        endDate.setHours(23, 59, 59, 999);

        return now >= startDate && now <= endDate;
    });

    if (todaysSchedules.length === 0) {
        addNotification({
            type: 'WARNING',
            title: 'Incheckning Misslyckades',
            message: 'Ingen schemalagd klass hittades på denna plats idag.'
        });
        return false;
    }

    let closestValidSchedule: GroupClassSchedule | null = null;
    let closestUpcomingSchedule: GroupClassSchedule | null = null;
    let minValidDiff = Infinity;
    let minUpcomingDiff = Infinity;

    for (const schedule of todaysSchedules) {
        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const scheduleTimeInMinutes = hour * 60 + minute;
        const diff = scheduleTimeInMinutes - nowInMinutes;

        if (nowInMinutes >= (scheduleTimeInMinutes - 15) && nowInMinutes <= scheduleTimeInMinutes) {
            if (diff < minValidDiff) {
                minValidDiff = diff;
                closestValidSchedule = schedule;
            }
        }
        
        if (diff > 0 && diff < minUpcomingDiff) {
            minUpcomingDiff = diff;
            closestUpcomingSchedule = schedule;
        }
    }

    if (closestValidSchedule) {
        const classInstanceId = `${closestValidSchedule.id}-${todayStr}`;
        return handleSelfCheckIn(participantId, classInstanceId, 'location_qr');
    }
    
    if (closestUpcomingSchedule) {
        addNotification({
            type: 'WARNING',
            title: 'För tidigt för incheckning',
            message: 'Du kan checka in tidigast 15 min före passet.'
        });
        return false;
    } else {
        addNotification({
            type: 'WARNING',
            title: 'För sent för incheckning',
            message: 'Passet har redan startat, eller så finns inga fler pass idag.'
        });
        return false;
    }
}, [groupClassSchedules, handleSelfCheckIn, addNotification, auth.organizationId]);

  const handleToggleReaction = useCallback(
    (logId: string, logType: FlowItemLogType, emoji: string) => {
      if (!auth.currentParticipantId) return;

      const updater = (logs: any[]) => {
        return logs.map((log) => {
          if (log.id === logId) {
            const myReactions = (log.reactions || []).filter((r: { participantId: string }) => r.participantId === auth.currentParticipantId);
            let updatedReactions = [...(log.reactions || [])];

            if (myReactions.length > 0) {
              const myExistingReaction = myReactions.find((r: { emoji: string }) => r.emoji === emoji);
              updatedReactions = updatedReactions.filter((r) => r.participantId !== auth.currentParticipantId);
              if (!myExistingReaction) {
                updatedReactions.push({ participantId: auth.currentParticipantId, emoji, createdDate: new Date().toISOString() });
              }
            } else {
              updatedReactions.push({ participantId: auth.currentParticipantId, emoji, createdDate: new Date().toISOString() });
            }
            return { ...log, reactions: updatedReactions };
          }
          return log;
        });
      };

      switch (logType) {
        case 'workout':
          setWorkoutLogsData(updater);
          break;
        case 'general':
          setGeneralActivityLogsData(updater);
          break;
        case 'coach_event':
          setCoachEventsData(updater);
          break;
        case 'goal_completion':
          setGoalCompletionLogsData(updater);
          break;
        case 'participant_club_membership':
          setClubMembershipsData(updater);
          break;
        case 'user_strength_stat':
          setUserStrengthStatsData(updater);
          break;
        case 'participant_physique_stat':
          setParticipantPhysiqueHistoryData(updater);
          break;
        case 'participant_goal_data':
          setParticipantGoalsData(updater);
          break;
        case 'participant_conditioning_stat':
          setUserConditioningStatsHistoryData(updater);
          break;
        default:
          console.warn(`Unsupported logType for reaction: ${logType}`);
      }
    },
    [
      auth.currentParticipantId,
      setWorkoutLogsData,
      setGeneralActivityLogsData,
      setCoachEventsData,
      setGoalCompletionLogsData,
      setClubMembershipsData,
      setUserStrengthStatsData,
      setParticipantPhysiqueHistoryData,
      setParticipantGoalsData,
      setUserConditioningStatsHistoryData,
    ]
  );

  const handleAddComment = useCallback(
    (logId: string, logType: FlowItemLogType, text: string) => {
      const authorId = auth.user?.id;
      if (!authorId) return;

      let authorName = auth.user.name;
      if (auth.isStaffViewingAsParticipant && auth.currentParticipantId) {
        const pProfile = participantDirectory.find((p) => p.id === auth.currentParticipantId);
        if (pProfile) authorName = pProfile.name || auth.user.name;
      }

      const newComment = {
        id: crypto.randomUUID(),
        authorId,
        authorName,
        text,
        createdDate: new Date().toISOString(),
      };

      const updater = (logs: any[]) => {
        return logs.map((log) => {
          if (log.id === logId) {
            const updatedComments = [...(log.comments || []), newComment];
            return { ...log, comments: updatedComments };
          }
          return log;
        });
      };

      switch (logType) {
        case 'workout':
          setWorkoutLogsData(updater);
          break;
        case 'general':
          setGeneralActivityLogsData(updater);
          break;
        case 'coach_event':
          setCoachEventsData(updater);
          break;
        case 'one_on_one_session':
          setOneOnOneSessionsData(updater);
          break;
        case 'goal_completion':
          setGoalCompletionLogsData(updater);
          break;
        case 'participant_club_membership':
          setClubMembershipsData(updater);
          break;
        case 'user_strength_stat':
          setUserStrengthStatsData(updater);
          break;
        case 'participant_physique_stat':
          setParticipantPhysiqueHistoryData(updater);
          break;
        case 'participant_goal_data':
          setParticipantGoalsData(updater);
          break;
        case 'participant_conditioning_stat':
          setUserConditioningStatsHistoryData(updater);
          break;
        default:
          console.warn(`Unsupported logType for add comment: ${logType}`);
      }
    },
    [
      auth.user,
      auth.isStaffViewingAsParticipant,
      auth.currentParticipantId,
      participantDirectory,
      setWorkoutLogsData,
      setGeneralActivityLogsData,
      setCoachEventsData,
      setOneOnOneSessionsData,
      setGoalCompletionLogsData,
      setClubMembershipsData,
      setUserStrengthStatsData,
      setParticipantPhysiqueHistoryData,
      setParticipantGoalsData,
      setUserConditioningStatsHistoryData,
    ]
  );

  const handleDeleteComment = useCallback(
    (logId: string, logType: FlowItemLogType, commentId: string) => {
      const updater = (logs: any[]) => {
        return logs.map((log) => {
          if (log.id === logId) {
            const updatedComments = (log.comments || []).filter((c: { id: string }) => c.id !== commentId);
            return { ...log, comments: updatedComments };
          }
          return log;
        });
      };

      switch (logType) {
        case 'workout':
          setWorkoutLogsData(updater);
          break;
        case 'general':
          setGeneralActivityLogsData(updater);
          break;
        case 'coach_event':
          setCoachEventsData(updater);
          break;
        case 'one_on_one_session':
          setOneOnOneSessionsData(updater);
          break;
        case 'goal_completion':
          setGoalCompletionLogsData(updater);
          break;
        case 'participant_club_membership':
          setClubMembershipsData(updater);
          break;
        case 'user_strength_stat':
          setUserStrengthStatsData(updater);
          break;
        case 'participant_physique_stat':
          setParticipantPhysiqueHistoryData(updater);
          break;
        case 'participant_goal_data':
          setParticipantGoalsData(updater);
          break;
        case 'participant_conditioning_stat':
          setUserConditioningStatsHistoryData(updater);
          break;
        default:
          console.warn(`Unsupported logType for delete comment: ${logType}`);
      }
    },
    [
      setWorkoutLogsData,
      setGeneralActivityLogsData,
      setCoachEventsData,
      setOneOnOneSessionsData,
      setGoalCompletionLogsData,
      setClubMembershipsData,
      setUserStrengthStatsData,
      setParticipantPhysiqueHistoryData,
      setParticipantGoalsData,
      setUserConditioningStatsHistoryData,
    ]
  );

  const handleToggleCommentReaction = useCallback(
    (logId: string, logType: FlowItemLogType, commentId: string) => {
      if (!auth.currentParticipantId) return;
      const participantId = auth.currentParticipantId;

      const updater = (prevLogs: any[]) => {
        return prevLogs.map((log) => {
          if (log.id === logId) {
            const updatedComments = (log.comments || []).map((comment: any) => {
              if (comment.id === commentId) {
                const existingReactions = comment.reactions || [];
                const myReactionIndex = existingReactions.findIndex((r: { participantId: string }) => r.participantId === participantId);

                if (myReactionIndex > -1) {
                  return { ...comment, reactions: existingReactions.filter((_: any, index: number) => index !== myReactionIndex) };
                } else {
                  return { ...comment, reactions: [...existingReactions, { participantId, emoji: '❤️', createdDate: new Date().toISOString() }] };
                }
              }
              return comment;
            });
            return { ...log, comments: updatedComments };
          }
          return log;
        });
      };

      switch (logType) {
        case 'workout':
          setWorkoutLogsData(updater);
          break;
        case 'general':
          setGeneralActivityLogsData(updater);
          break;
        case 'coach_event':
          setCoachEventsData(updater);
          break;
        case 'one_on_one_session':
          setOneOnOneSessionsData(updater);
          break;
        case 'goal_completion':
          setGoalCompletionLogsData(updater);
          break;
        case 'participant_club_membership':
          setClubMembershipsData(updater);
          break;
        case 'user_strength_stat':
          setUserStrengthStatsData(updater);
          break;
        case 'participant_physique_stat':
          setParticipantPhysiqueHistoryData(updater);
          break;
        case 'participant_goal_data':
          setParticipantGoalsData(updater);
          break;
        case 'participant_conditioning_stat':
          setUserConditioningStatsHistoryData(updater);
          break;
        default:
          console.warn(`Unsupported logType for comment reaction: ${logType}`);
      }
    },
    [
      auth.currentParticipantId,
      setWorkoutLogsData,
      setGeneralActivityLogsData,
      setCoachEventsData,
      setOneOnOneSessionsData,
      setGoalCompletionLogsData,
      setClubMembershipsData,
      setUserStrengthStatsData,
      setParticipantPhysiqueHistoryData,
      setParticipantGoalsData,
      setUserConditioningStatsHistoryData,
    ]
  );

  const prospectModalShownKey = auth.currentParticipantId ? `flexibel_prospectProfileModalShown_${auth.currentParticipantId}` : null;

  useEffect(() => {
    if (auth.currentRole === 'participant' && auth.currentParticipantId && participantDirectory.length > 0) {
      // Welcome modal logic
      if (!welcomeModalShown) {
        setIsWelcomeModalOpen(true);
      }

      // New logic for initial profile modal for prospects
      const participantProfile = participantDirectory.find((p) => p.id === auth.currentParticipantId);
      const membership = participantProfile ? memberships.find((m) => m.id === participantProfile.membershipId) : null;
      if (membership?.name.toLowerCase() === 'startprogram') {
        const isProfileComplete = !!(participantProfile?.age && participantProfile?.gender && participantProfile?.gender !== '-');
        if (!isProfileComplete) {
          const hasBeenShown = prospectModalShownKey ? localStorage.getItem(prospectModalShownKey) === 'true' : false;
          if (!hasBeenShown) {
            setOpenProfileModalOnInit(true);
          }
        }
      }
    }
  }, [auth.currentRole, auth.currentParticipantId, welcomeModalShown, participantDirectory, prospectModalShownKey, memberships]);
  
  const handleCancelClassInstance = useCallback(async (scheduleId: string, classDate: string) => {
    const bookingsToCancel = participantBookings.filter(
        (b) => b.scheduleId === scheduleId && b.classDate === classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN' || b.status === 'WAITLISTED')
    );

    if (bookingsToCancel.length === 0) {
        addNotification({
            type: 'INFO',
            title: 'Inga bokningar',
            message: 'Det fanns inga aktiva bokningar att avboka för detta pass.',
        });
        return;
    }

    const participantIdsToRefund = new Set<string>();
    const updatedBookings = participantBookings.map(booking => {
        if (bookingsToCancel.some(b => b.id === booking.id)) {
            if (booking.status !== 'WAITLISTED') {
                const participant = participantDirectory.find(p => p.id === booking.participantId);
                const membership = memberships.find(m => m.id === participant?.membershipId);
                if (membership?.type === 'clip_card') {
                    participantIdsToRefund.add(booking.participantId);
                }
            }
            return { ...booking, status: 'CANCELLED' as const };
        }
        return booking;
    });

    const updatedParticipants = participantDirectory.map(p => {
        if (participantIdsToRefund.has(p.id) && p.clipCardStatus) {
            return {
                ...p,
                clipCardStatus: {
                    ...p.clipCardStatus,
                    remainingClips: (p.clipCardStatus.remainingClips || 0) + 1,
                },
            };
        }
        return p;
    });
    
    setParticipantBookingsData(updatedBookings);
    setParticipantDirectoryData(updatedParticipants);

    const affectedParticipantIds = new Set(bookingsToCancel.map(b => b.participantId));
    
    const schedule = groupClassSchedules.find(s => s.id === scheduleId);
    const classDef = definitions.find(d => d.id === schedule?.groupClassId);
    
    // TODO: Send push notifications in a real backend scenario.
    console.log(`[Placeholder] Would send 'Class Cancelled' notifications to ${affectedParticipantIds.size} participants.`);
    
    addNotification({
        type: 'SUCCESS',
        title: 'Pass Inställt',
        message: `Passet ${classDef?.name || ''} har ställts in. ${affectedParticipantIds.size} deltagare har meddelats och eventuella klipp har återbetalats.`,
    });
    
}, [participantBookings, setParticipantBookingsData, participantDirectory, setParticipantDirectoryData, memberships, addNotification, groupClassSchedules, definitions]);


  const handleProfileModalOpened = useCallback(() => {
    const participantProfile = participantDirectory.find((p) => p.id === auth.currentParticipantId);
    const membership = participantProfile ? memberships.find((m) => m.id === participantProfile.membershipId) : null;
    if (membership?.name.toLowerCase() === 'startprogram' && prospectModalShownKey) {
      localStorage.setItem(prospectModalShownKey, 'true');
    }
    setOpenProfileModalOnInit(false);
  }, [auth.currentParticipantId, participantDirectory, memberships, prospectModalShownKey]);

  const handleOpenProfile = useCallback(() => {
    // If we are in participant view (either as a real participant or a staff member)
    if (auth.currentRole === 'participant' && profileOpener) {
      profileOpener.open();
    }
    // If we are a staff member in coach view or system owner, switch to participant view and open it
    else if (auth.currentRole === 'coach' || (auth.user?.roles.systemOwner && !auth.isImpersonating)) {
      auth.viewAsParticipant();
      setOpenProfileModalOnInit(true);
    }
  }, [auth, profileOpener]);

  const renderMainView = useCallback(() => {
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
      );
    }

    if (registrationPendingMessage) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
          <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-semibold text-green-700">Tack för din registrering!</h2>
            <p className="text-lg text-gray-600">
              Ditt konto väntar på godkännande av en coach. Godkännande sker vanligtvis inom 2 timmar. Du kommer inte kunna logga in förrän det är godkänt.
            </p>
            <Button
              onClick={() => {
                setRegistrationPendingMessage(false);
                setView('login');
              }}
              fullWidth
              size="lg"
            >
              Tillbaka till inloggning
            </Button>
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

    if (auth.user?.roles.systemOwner && !auth.isImpersonating) {
      return <SystemOwnerArea />;
    }

    if (auth.currentRole === 'coach') {
      return (
        <div className="container mx-auto px-2 sm:px-6 py-6">
          <CoachArea
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onToggleCommentReaction={handleToggleCommentReaction}
            onCheckInParticipant={handleCheckInParticipant}
            onUnCheckInParticipant={handleUnCheckInParticipant}
            onBookClass={handleBookClass}
            onCancelBooking={handleCancelBooking}
            onPromoteFromWaitlist={handlePromoteFromWaitlist}
            onCancelClassInstance={handleCancelClassInstance}
          />
        </div>
      );
    }

    if (auth.currentRole === 'participant' && auth.currentParticipantId) {
      return (
        <>
          <ParticipantArea
            currentParticipantId={auth.currentParticipantId}
            onToggleReaction={handleToggleReaction}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onToggleCommentReaction={handleToggleCommentReaction}
            openProfileModalOnInit={openProfileModalOnInit}
            onProfileModalOpened={handleProfileModalOpened}
            isStaffViewingSelf={auth.isStaffViewingAsParticipant}
            onSwitchToStaffView={auth.stopViewingAsParticipant}
            onSelfCheckIn={handleSelfCheckIn}
            onLocationCheckIn={handleLocationCheckIn}
            onBookClass={handleBookClass}
            onCancelBooking={handleCancelBooking}
            setProfileOpener={setProfileOpener}
            setParticipantModalOpeners={setParticipantModalOpeners}
            newFlowItemsCount={newFlowItemsCount}
          />
          <WelcomeModal
            isOpen={isWelcomeModalOpen}
            onClose={() => {
              setIsWelcomeModalOpen(false);
              localStorage.setItem(LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT, 'true');
              setWelcomeModalShown(true);
            }}
          />
        </>
      );
    }

    // Fallback for unexpected states, e.g., a user without roles.
    return <Login onSwitchToRegister={() => setView('register')} />;
  }, [
    auth.isLoading,
    auth.user,
    auth.currentRole,
    auth.currentParticipantId,
    auth.isStaffViewingAsParticipant,
    auth.isImpersonating,
    auth.viewAsParticipant,
    auth.stopViewingAsParticipant,
    auth.logout,
    isGlobalDataLoading,
    isOrgDataLoading,
    cachedLogo,
    branding,
    registrationPendingMessage,
    view,
    handleAddComment,
    handleDeleteComment,
    handleToggleCommentReaction,
    handleCheckInParticipant,
    handleUnCheckInParticipant,
    handleBookClass,
    handleCancelBooking,
    handlePromoteFromWaitlist,
    handleCancelClassInstance,
    handleSelfCheckIn,
    handleLocationCheckIn,
    openProfileModalOnInit,
    handleProfileModalOpened,
    setProfileOpener,
    setParticipantModalOpeners,
    newFlowItemsCount,
    isWelcomeModalOpen,
    welcomeModalShown,
    setWelcomeModalShown,
  ]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar
        onOpenProfile={handleOpenProfile}
        onOpenLatestUpdate={handleOpenLatestUpdateView}
        onOpenGoalModal={participantModalOpeners.openGoalModal}
        onOpenCommunity={participantModalOpeners.openCommunityModal}
        onOpenFlowModal={participantModalOpeners.openFlowModal}
        onOpenAiRecept={participantModalOpeners.openAiReceptModal}
        aiRecept={aiRecept}
        pendingRequestsCount={pendingRequestsCount}
        newFlowItemsCount={newFlowItemsCount}
        hasUnreadUpdate={hasUnreadUpdate}
      />
      <OfflineBanner />
      <main>
        <Suspense fallback={<LoadingSpinner />}>{renderMainView()}</Suspense>
      </main>
      <DevToolbar />

      {showLatestUpdateView && <UpdateNoticeModal show={showLatestUpdateView} onClose={() => setShowLatestUpdateView(false)} />}

      {showTermsModal && <TermsModal isOpen={showTermsModal} onClose={() => {}} onAccept={handleAcceptTerms} isBlocking={true} />}
    </div>
  );
};

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