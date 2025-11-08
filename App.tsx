// App.tsx
import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';

import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { Button } from './components/Button';
import { DevToolbar } from './components/DevToolbar';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { Register } from './components/Register';
import { TermsModal } from './components/TermsModal';
import { WelcomeModal } from './components/participant/WelcomeModal';
import { UpdateNoticeModal } from './components/participant/UpdateNoticeModal';
import { LOCAL_STORAGE_KEYS } from './constants';
import {
  FlowItemLogType,
  GeneralActivityLog,
  GroupClassSchedule,
  GroupClassScheduleException,
  ParticipantProfile,
} from './types';
import { useNotifications } from './context/NotificationsContext';
import { logAnalyticsEvent } from './utils/analyticsLogger';
import firebaseService from './services/firebaseService';
import { cancelClassInstanceFn, notifyFriendsOnBookingFn } from './firebaseClient';

// ✅ Ny import – ersätter inline push helpers
import { ensureWebPushSubscription } from './utils/push';

// Firestore v9
import {
  collection, query, where, getDocs, updateDoc,
  getFirestore, setDoc, doc as fsDoc, doc,
} from 'firebase/firestore';

const CoachArea = lazy(() => import('./components/coach/CoachArea').then(m => ({ default: m.CoachArea })));
const ParticipantArea = lazy(() => import('./components/participant/ParticipantArea').then(m => ({ default: m.ParticipantArea })));
const SystemOwnerArea = lazy(() => import('./components/SystemOwnerArea').then(m => ({ default: m.SystemOwnerArea })));
const PublicLeadForm = lazy(() => import('./components/public/PublicLeadForm').then(m => ({ default: m.PublicLeadForm })));
const ZapierWebhookHandler = lazy(() => import('./components/api/ZapierWebhookHandler').then(m => ({ default: m.ZapierWebhookHandler })));

const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-flexibel" />
  </div>
);

const AppContent: React.FC = () => {
  // Publika routes
  if (window.location.pathname.startsWith('/public/lead-form')) {
    return <Suspense fallback={<LoadingSpinner />}><PublicLeadForm /></Suspense>;
  }
  if (window.location.pathname.startsWith('/api/zapier-lead-webhook')) {
    return <Suspense fallback={<div>Processing...</div>}><ZapierWebhookHandler /></Suspense>;
  }

  const {
    participantDirectory, setParticipantDirectoryData, memberships, workoutLogs, generalActivityLogs,
    coachEvents, oneOnOneSessions, participantBookings, setParticipantBookingsData, groupClassSchedules,
    groupClassDefinitions: definitions, isOrgDataLoading, isGlobalDataLoading, branding, goalCompletionLogs,
    clubMemberships, userStrengthStats, participantPhysiqueHistory, participantGoals, setParticipantGoalsData,
    userConditioningStatsHistory, connections, lastFlowViewTimestamp, updateUser, setWorkoutLogsData,
    setGeneralActivityLogsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData,
    setParticipantPhysiqueHistoryData, setUserConditioningStatsHistoryData, setCoachEventsData,
    setOneOnOneSessionsData, groupClassScheduleExceptions, setGroupClassScheduleExceptionsData,
  } = useAppContext();

  const auth = useAuth();
  const { addNotification } = useNotifications();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [registrationPendingMessage, setRegistrationPendingMessage] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState<string[]>([]);

  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeModalShown, setWelcomeModalShown] = useState(
    () => localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT) === 'true'
  );
  const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);
  const [profileOpener, setProfileOpener] = useState<{ open: () => void } | null>(null);
  const [cachedLogo, setCachedLogo] = useState<string | null>(() => {
    const lastOrgId = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID);
    return lastOrgId ? localStorage.getItem(`flexibel_logo_${lastOrgId}`) : null;
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
    if (!auth.user) return;
    try {
      await updateUser(auth.user.id, { termsAcceptedTimestamp: new Date().toISOString() });
      setShowTermsModal(false);
    } catch (e) {
      console.error('Failed to accept terms:', e);
      alert('Kunde inte spara ditt godkännande. Vänligen försök igen.');
    }
  }, [auth.user, updateUser]);

  // Update notice
  const UPDATE_NOTICE_KEY = 'updateNotice_v3_AICoach';
  const LAST_SEEN_UPDATE_KEY = 'flexibel_lastSeenUpdateNotice';
  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnreadUpdate, setHasUnreadUpdate] = useState(false);
  useEffect(() => {
    if (auth.user && auth.currentRole === 'participant') {
      if (localStorage.getItem(LAST_SEEN_UPDATE_KEY) !== UPDATE_NOTICE_KEY) setHasUnreadUpdate(true);
    }
  }, [auth.user, auth.currentRole]);
  const handleOpenLatestUpdateView = useCallback(() => {
    setShowLatestUpdateView(true);
    localStorage.setItem(LAST_SEEN_UPDATE_KEY, UPDATE_NOTICE_KEY);
    setHasUnreadUpdate(false);
  }, []);

  // Modal openers (Navbar ↔ ParticipantArea)
  const [participantModalOpeners, setParticipantModalOpeners] = useState({
    openGoalModal: () => {}, openCommunityModal: () => {}, openFlowModal: () => {}, openAiReceptModal: () => {},
  });

  // Derived till Navbar
  const { aiRecept, pendingRequestsCount, newFlowItemsCount } = useMemo(() => {
    if (auth.currentRole !== 'participant' || !auth.currentParticipantId) {
      return { aiRecept: null, pendingRequestsCount: 0, newFlowItemsCount: 0 };
    }
    const myGoals = participantGoals.filter(g => g.participantId === auth.currentParticipantId);
    const sortedGoals = [...myGoals].sort((a, b) => +new Date(b.setDate) - +new Date(a.setDate));
    const latestActiveGoal = sortedGoals.find(g => !g.isCompleted) || sortedGoals[0] || null;
    const recept = latestActiveGoal?.aiPrognosis;
    const requests = connections.filter(c => c.receiverId === auth.currentParticipantId && c.status === 'pending').length;

    let count = 0;
    if (lastFlowViewTimestamp) {
      const lastView = +new Date(lastFlowViewTimestamp);
      const myId = auth.currentParticipantId;
      const friends = new Set<string>();
      connections.forEach(c => {
        if (c.status === 'accepted') {
          if (c.requesterId === myId) friends.add(c.receiverId);
          if (c.receiverId === myId) friends.add(c.requesterId);
        }
      });
      const newItems = new Set<string>();
      coachEvents.forEach(e => { if (+new Date(e.createdDate) > lastView) newItems.add(`event-${e.id}`); });
      const all: any[] = [
        ...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs, ...clubMemberships,
        ...userStrengthStats, ...participantPhysiqueHistory, ...participantGoals, ...userConditioningStatsHistory,
      ];
      all.forEach(item => {
        const t = +new Date((item.completedDate ?? item.achievedDate ?? item.setDate ?? item.lastUpdated));
        if (friends.has(item.participantId) && t > lastView) newItems.add(`item-${item.id}`);
        if (item.participantId === myId) {
          item.comments?.forEach((c: any) => { if (c.authorId !== myId && +new Date(c.createdDate) > lastView) newItems.add(`comment-${c.id}`); });
          item.reactions?.forEach((r: any) => { if (r.participantId !== myId && +new Date(r.createdDate) > lastView) newItems.add(`reaction-${item.id}-${r.participantId}-${r.emoji}`); });
        }
      });
      count = newItems.size;
    }
    return { aiRecept: recept, pendingRequestsCount: requests, newFlowItemsCount: count };
  }, [
    auth.currentRole, auth.currentParticipantId, participantGoals, connections, lastFlowViewTimestamp,
    coachEvents, workoutLogs, generalActivityLogs, goalCompletionLogs, clubMemberships,
    userStrengthStats, participantPhysiqueHistory, userConditioningStatsHistory,
  ]);

  useEffect(() => {
    if (auth.organizationId) {
      setCachedLogo(localStorage.getItem(`flexibel_logo_${auth.organizationId}`));
    } else if (!auth.isLoading) {
      setCachedLogo(null);
    }
  }, [auth.organizationId, auth.isLoading]);

  // ✅ Web push subscription när vi är deltagare (använder utils/push)
  useEffect(() => {
    if (auth.currentRole === 'participant' && auth.organizationId && auth.currentParticipantId) {
      const profile = participantDirectory.find(p => p.id === auth.currentParticipantId);
      const pushEnabled = profile?.notificationSettings?.pushEnabled ?? true;
      if (pushEnabled) {
        ensureWebPushSubscription(auth.organizationId, auth.currentParticipantId);
      }
    }
  }, [auth.currentRole, auth.organizationId, auth.currentParticipantId, participantDirectory]);

  /* -------------- Bokningar/avbokningar/checkin (oförändrat API) -------------- */
  const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string) => {
    if (!auth.organizationId) return;
    const instanceId = `${scheduleId}-${classDate}`;
    setOperationInProgress(prev => [...prev, instanceId]);

    const active = participantBookings.find(b =>
      b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === classDate &&
      (b.status === 'BOOKED' || b.status === 'WAITLISTED')
    );
    if (active) {
      setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
      return;
    }

    const schedule = groupClassSchedules.find(s => s.id === scheduleId);
    if (!schedule) {
      setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
      return;
    }
    const classDef = definitions.find(d => d.id === schedule.groupClassId);

    const bookedCount = participantBookings.filter(
      b => b.scheduleId === scheduleId && b.classDate === classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
    ).length;
    const newStatus = bookedCount >= schedule.maxParticipants ? 'WAITLISTED' : 'BOOKED';

    const cancelled = participantBookings.find(
      b => b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === classDate && b.status === 'CANCELLED'
    );
    if (cancelled) {
      const reactivated = { ...cancelled, status: newStatus, bookingDate: new Date().toISOString() };
      setParticipantBookingsData(prev => prev.map(b => (b.id === cancelled.id ? reactivated : b)));
    } else {
      setParticipantBookingsData(prev => [...prev, {
        id: crypto.randomUUID(), participantId, scheduleId, classDate, bookingDate: new Date().toISOString(), status: newStatus,
      }]);
    }

    if (schedule && classDef) {
      setTimeout(() => logAnalyticsEvent('BOOKING_CREATED', {
        participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate,
        coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name,
        wasWaitlisted: newStatus === 'WAITLISTED',
      }, auth.organizationId!), 0);
    }

    if (newStatus === 'BOOKED') {
      addNotification({ type: 'SUCCESS', title: 'Bokning Lyckades!', message: `Du är nu bokad på ${classDef?.name} den ${new Date(classDate).toLocaleDateString('sv-SE')}.` });
      // klippkort – lokalt avdrag
      setParticipantDirectoryData(prev => prev.map(p => {
        if (p.id !== participantId) return p;
        const m = memberships.find(m => m.id === p.membershipId);
        if (m?.type === 'clip_card' && p.clipCardStatus?.remainingClips > 0) {
          return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() };
        }
        return p;
      }));
      if (auth.currentParticipantId === participantId && !firebaseService.isOffline()) {
        const me = participantDirectory.find(p => p.id === participantId);
        if (me?.shareMyBookings) {
          notifyFriendsOnBookingFn({ orgId: auth.organizationId, participantId, scheduleId, classDate }).catch(() => {});
        }
      }
    } else {
      addNotification({ type: 'INFO', title: 'Du är på kölistan', message: `Passet är fullt. Du har placerats på kölistan.` });
    }
    setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
  }, [
    groupClassSchedules, participantBookings, memberships, setParticipantBookingsData, setParticipantDirectoryData,
    definitions, addNotification, auth.organizationId, auth.currentParticipantId, participantDirectory,
  ]);

  const handleCancelBooking = useCallback((bookingId: string) => {
    if (!auth.organizationId) return;
    const booking = participantBookings.find(b => b.id === bookingId);
    if (!booking) return;
    const instanceId = `${booking.scheduleId}-${booking.classDate}`;
    setOperationInProgress(prev => [...prev, instanceId]);

    const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
    const classDef = definitions.find(d => d.id === schedule?.groupClassId);
    if (schedule && classDef) {
      const [hour, minute] = schedule.startTime.split(':').map(Number);
      const start = new Date(booking.classDate); start.setHours(hour, minute);
      const within = (start.getTime() - Date.now()) / 36e5;
      logAnalyticsEvent('BOOKING_CANCELLED', {
        participantId: booking.participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate: booking.classDate,
        coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name, cancelledWithinHours: Math.max(0, within),
      }, auth.organizationId);
    }

    setParticipantBookingsData(prev => {
      let promoted: ParticipantProfile | null = null;
      let promotedBooking: typeof prev[number] | undefined;

      const wasBooked = booking.status === 'BOOKED' || booking.status === 'CHECKED-IN';
      if (wasBooked) {
        const waitlisters = prev
          .filter(b => b.scheduleId === booking.scheduleId && b.classDate === booking.classDate && b.status === 'WAITLISTED')
          .sort((a, b) => +new Date(a.bookingDate) - +new Date(b.bookingDate));
        for (const cand of waitlisters) {
          const p = participantDirectory.find(pp => pp.id === cand.participantId);
          const m = p ? memberships.find(mm => mm.id === p.membershipId) : undefined;
          if (!m || m.type !== 'clip_card' || (p?.clipCardStatus?.remainingClips ?? 0) > 0) {
            promoted = p || null;
            promotedBooking = cand;
            break;
          }
        }
      }

      // klipp åter / dra klipp för promoted
      if (wasBooked) {
        setParticipantDirectoryData(old => old.map(p => {
          if (p.id === booking.participantId) {
            const m = memberships.find(mm => mm.id === p.membershipId);
            if (m?.type === 'clip_card' && p.clipCardStatus) {
              return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips + 1 }, lastUpdated: new Date().toISOString() };
            }
          }
          if (promoted && promotedBooking && p.id === promoted.id) {
            const m = memberships.find(mm => mm.id === p.membershipId);
            if (m?.type === 'clip_card' && p.clipCardStatus) {
              return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() };
            }
          }
          return p;
        }));
      }

      if (promoted && classDef && schedule && auth.currentParticipantId !== promoted.id) {
        const d = new Date(booking.classDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
        addNotification({ type: 'SUCCESS', title: `Plats tilldelad: ${promoted.name}`, message: `${promoted.name} har fått en plats på ${classDef?.name} ${d} kl ${schedule.startTime}.` });
      }

      return prev.map(b => {
        if (b.id === bookingId) return { ...b, status: 'CANCELLED' as const, cancelReason: 'participant_cancelled' as const };
        if (promotedBooking && b.id === promotedBooking.id) return { ...b, status: 'BOOKED' as const };
        return b;
      });
    });

    addNotification({ type: 'SUCCESS', title: 'Avbokning bekräftad', message: `Du har avbokat dig från ${classDef?.name || 'passet'}.` });
    setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
  }, [
    participantDirectory, memberships, setParticipantBookingsData, definitions, participantBookings,
    groupClassSchedules, addNotification, auth.organizationId, auth.currentParticipantId, setParticipantDirectoryData,
  ]);

  const handlePromoteFromWaitlist = useCallback((bookingId: string) => {
    if (!auth.organizationId) return;
    setParticipantBookingsData(prev => {
      const booking = prev.find(b => b.id === bookingId);
      if (booking || true) {} // no-op to satisfy TS narrow below
      if (!booking || booking.status !== 'WAITLISTED') return prev;
      const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
      if (!schedule) return prev;

      const bookedCount = prev.filter(b =>
        b.scheduleId === booking.scheduleId && b.classDate === booking.classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
      ).length;
      if (bookedCount >= schedule.maxParticipants) {
        addNotification({ type: 'WARNING', title: 'Kan inte flytta upp', message: 'Passet är redan fullt.' });
        return prev;
      }

      const participant = participantDirectory.find(p => p.id === booking.participantId);
      const classDef = definitions.find(d => d.id === schedule.groupClassId);
      if (participant && classDef) {
        const d = new Date(booking.classDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
        addNotification({ type: 'SUCCESS', title: 'Deltagare Uppflyttad!', message: `${participant.name} har nu en bokad plats på ${classDef.name} ${d} kl ${schedule.startTime}.` });
        logAnalyticsEvent('WAITLIST_PROMOTION', {
          participantId: participant.id, scheduleId: schedule.id, classId: schedule.groupClassId,
          classDate: booking.classDate, coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name,
        }, auth.organizationId);
      }

      const m = participant ? memberships.find(mm => mm.id === participant.membershipId) : undefined;
      if (m?.type === 'clip_card' && participant?.clipCardStatus?.remainingClips! > 0) {
        setParticipantDirectoryData(old => old.map(p =>
          p.id === participant.id
            ? { ...p, clipCardStatus: { ...p.clipCardStatus!, remainingClips: p.clipCardStatus!.remainingClips - 1 }, lastUpdated: new Date().toISOString() }
            : p
        ));
      }

      return prev.map(b => (b.id === bookingId ? { ...b, status: 'BOOKED' as const } : b));
    });
  }, [groupClassSchedules, participantDirectory, memberships, setParticipantBookingsData, definitions, addNotification, auth.organizationId, setParticipantDirectoryData]);

  const handleCheckInParticipant = useCallback((bookingId: string) => {
    if (!auth.organizationId) return;
    setParticipantBookingsData(prev => {
      const booking = prev.find(b => b.id === bookingId);
      if (booking) {
        const participant = participantDirectory.find(p => p.id === booking.participantId);
        const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
        const classDef = definitions.find(d => d.id === schedule?.groupClassId);
        if (participant && schedule && classDef) {
          logAnalyticsEvent('CHECKIN', {
            participantId: participant.id, scheduleId: schedule.id, classId: schedule.groupClassId, classDate: booking.classDate,
            coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name, checkinType: 'coach',
          }, auth.organizationId);
          addNotification({ type: 'SUCCESS', title: 'Incheckad!', message: `${participant.name} är nu incheckad på ${classDef.name}.` });
        }
      }
      return prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' as const } : b));
    });
  }, [setParticipantBookingsData, participantDirectory, groupClassSchedules, definitions, addNotification, auth.organizationId]);

  const handleUnCheckInParticipant = useCallback((bookingId: string) => {
    setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId && b.status === 'CHECKED-IN' ? { ...b, status: 'BOOKED' as const } : b)));
  }, [setParticipantBookingsData]);

  const handleSelfCheckIn = useCallback((participantId: string, classInstanceId: string, checkinType: 'self_qr' | 'location_qr'): boolean => {
    if (!auth.organizationId) return false;
    const parts = classInstanceId.split('-');
    if (parts.length < 4) {
      addNotification({ type: 'ERROR', title: 'Incheckning Misslyckades', message: 'QR-koden är ogiltig eller har fel format.' });
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
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, hour, minute);
    const earliest = new Date(start.getTime() - 15 * 60 * 1000);

    if (now < earliest) { addNotification({ type: 'WARNING', title: 'För tidigt', message: 'Du kan checka in tidigast 15 min före passet.' }); return false; }
    if (now > start)   { addNotification({ type: 'WARNING', title: 'För sent',   message: 'Passet har redan startat.' }); return false; }

    const booking = participantBookings.find(b => b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === date && (b.status === 'BOOKED' || b.status === 'WAITLISTED'));
    if (!booking) {
      addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Kunde inte hitta en aktiv bokning för detta pass.' });
      return false;
    }

    if (booking.status === 'WAITLISTED') {
      const bookedCount = participantBookings.filter(b => b.scheduleId === scheduleId && b.classDate === date && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')).length;
      if (bookedCount >= schedule.maxParticipants) {
        addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Passet är fullt. Du kan inte checka in från kölistan just nu.' });
        return false;
      }
    }

    setParticipantBookingsData(prev => prev.map(b => (b.id === booking.id ? { ...b, status: 'CHECKED-IN' as const } : b)));
    const classDef = definitions.find(d => d.id === schedule?.groupClassId);
    if (schedule && classDef) {
      logAnalyticsEvent('CHECKIN', {
        participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate: date,
        coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name, checkinType,
      }, auth.organizationId);
    }
    const attendanceRecord: GeneralActivityLog = {
      type: 'general', id: crypto.randomUUID(), participantId, activityName: `Incheckning: ${classDef?.name || 'Gruppass'}`,
      durationMinutes: 0, completedDate: new Date().toISOString(), comment: `Självincheckning via QR-kod för pass den ${date}.`,
    };
    setGeneralActivityLogsData(prev => [...prev, attendanceRecord]);
    addNotification({ type: 'SUCCESS', title: 'Incheckad!', message: `Du är nu incheckad på ${classDef?.name || 'passet'}.` });
    return true;
  }, [participantBookings, groupClassSchedules, definitions, setParticipantBookingsData, setGeneralActivityLogsData, addNotification, auth.organizationId]);

  const handleLocationCheckIn = useCallback((participantId: string, locationId: string): boolean => {
    if (!auth.organizationId) return false;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todays = groupClassSchedules.filter(s => {
      if (s.locationId !== locationId) return false;
      if (!s.daysOfWeek.includes(day)) return false;
      const [sy, sm, sd] = s.startDate.split('-').map(Number);
      const [ey, em, ed] = s.endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed); end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    });
    if (!todays.length) {
      addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Ingen schemalagd klass hittades på denna plats idag.' });
      return false;
    }

    let valid: GroupClassSchedule | null = null;
    let upcoming: GroupClassSchedule | null = null;
    let minValid = Infinity, minUp = Infinity;

    for (const s of todays) {
      const [h, m] = s.startTime.split(':').map(Number);
      const t = h * 60 + m;
      const diff = t - nowMin;
      if (nowMin >= t - 15 && nowMin <= t) { if (diff < minValid) { minValid = diff; valid = s; } }
      if (diff > 0 && diff < minUp)       { minUp = diff; upcoming = s; }
    }

    if (valid) {
      const classInstanceId = `${valid.id}-${todayStr}`;
      return handleSelfCheckIn(participantId, classInstanceId, 'location_qr');
    }
    if (upcoming) { addNotification({ type: 'WARNING', title: 'För tidigt för incheckning', message: 'Du kan checka in tidigast 15 min före passet.' }); return false; }
    addNotification({ type: 'WARNING', title: 'För sent för incheckning', message: 'Passet har redan startat, eller så finns inga fler pass idag.' });
    return false;
  }, [groupClassSchedules, handleSelfCheckIn, addNotification, auth.organizationId]);

  // Reactions / comments (oförändrat)
  const handleToggleReaction = useCallback((logId: string, logType: FlowItemLogType, emoji: string) => {
    if (!auth.currentParticipantId) return;
    const updater = (logs: any[]) => logs.map(log => {
      if (log.id !== logId) return log;
      const myReactions = (log.reactions || []).filter((r: { participantId: string }) => r.participantId === auth.currentParticipantId);
      let updated = [...(log.reactions || [])];
      if (myReactions.length) {
        const had = myReactions.find((r: { emoji: string }) => r.emoji === emoji);
        updated = updated.filter((r: any) => r.participantId !== auth.currentParticipantId);
        if (!had) updated.push({ participantId: auth.currentParticipantId, emoji, createdDate: new Date().toISOString() });
      } else {
        updated.push({ participantId: auth.currentParticipantId, emoji, createdDate: new Date().toISOString() });
      }
      return { ...log, reactions: updated };
    });
    ({
      workout: setWorkoutLogsData,
      general: setGeneralActivityLogsData,
      coach_event: setCoachEventsData,
      goal_completion: setGoalCompletionLogsData,
      participant_club_membership: setClubMembershipsData,
      user_strength_stat: setUserStrengthStatsData,
      participant_physique_stat: setParticipantPhysiqueHistoryData,
      participant_goal_data: setParticipantGoalsData,
      participant_conditioning_stat: setUserConditioningStatsHistoryData,
    } as any)[logType]?.(updater);
  }, [auth.currentParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleAddComment = useCallback((logId: string, logType: FlowItemLogType, text: string) => {
    const authorId = auth.user?.id; if (!authorId) return;
    let authorName = auth.user.name;
    if (auth.isStaffViewingAsParticipant && auth.currentParticipantId) {
      const p = participantDirectory.find(pp => pp.id === auth.currentParticipantId);
      if (p) authorName = p.name || authorName;
    }
    const newComment = { id: crypto.randomUUID(), authorId, authorName, text, createdDate: new Date().toISOString() };
    const updater = (logs: any[]) => logs.map(log => log.id === logId ? { ...log, comments: [...(log.comments || []), newComment] } : log);
    ({
      workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
      one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
      participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
      participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
      participant_conditioning_stat: setUserConditioningStatsHistoryData,
    } as any)[logType]?.(updater);
  }, [auth.user, auth.isStaffViewingAsParticipant, auth.currentParticipantId, participantDirectory, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleDeleteComment = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
    const updater = (logs: any[]) => logs.map(log =>
      log.id === logId ? { ...log, comments: (log.comments || []).filter((c: { id: string }) => c.id !== commentId) } : log
    );
    ({
      workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
      one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
      participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
      participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
      participant_conditioning_stat: setUserConditioningStatsHistoryData,
    } as any)[logType]?.(updater);
  }, [setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleToggleCommentReaction = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
    if (!auth.currentParticipantId) return;
    const pid = auth.currentParticipantId;
    const updater = (logs: any[]) => logs.map(log => {
      if (log.id !== logId) return log;
      const comments = (log.comments || []).map((c: any) => {
        if (c.id !== commentId) return c;
        const reactions = c.reactions || [];
        const mine = reactions.findIndex((r: { participantId: string }) => r.participantId === pid);
        return (mine > -1)
          ? { ...c, reactions: reactions.filter((_: any, i: number) => i !== mine) }
          : { ...c, reactions: [...reactions, { participantId: pid, emoji: '❤️', createdDate: new Date().toISOString() }] };
      });
      return { ...log, comments };
    });
    ({
      workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
      one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
      participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
      participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
      participant_conditioning_stat: setUserConditioningStatsHistoryData,
    } as any)[logType]?.(updater);
  }, [auth.currentParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const prospectModalShownKey = auth.currentParticipantId ? `flexibel_prospectProfileModalShown_${auth.currentParticipantId}` : null;
  useEffect(() => {
    if (auth.currentRole === 'participant' && auth.currentParticipantId && participantDirectory.length > 0) {
      if (!welcomeModalShown) setIsWelcomeModalOpen(true);
      const p = participantDirectory.find(pp => pp.id === auth.currentParticipantId);
      const m = p ? memberships.find(mm => mm.id === p.membershipId) : null;
      if (m?.name.toLowerCase() === 'startprogram') {
        const ok = !!(p?.birthDate && p?.gender && p?.gender !== '-');
        if (!ok) {
          const shown = prospectModalShownKey ? localStorage.getItem(prospectModalShownKey) === 'true' : false;
          if (!shown) setOpenProfileModalOnInit(true);
        }
      }
    }
  }, [auth.currentRole, auth.currentParticipantId, welcomeModalShown, participantDirectory, prospectModalShownKey, memberships]);

  // EN enda async callback – ingen lös "await" någon annanstans
  const handleCancelClassInstance = useCallback(async (scheduleId: string, classDate: string) => {
    const already = groupClassScheduleExceptions.some(ex => ex.scheduleId === scheduleId && ex.date === classDate);
    if (already) { addNotification({ type: 'INFO', title: 'Redan inställt', message: 'Detta pass är redan markerat som inställt.' }); return; }

    const toCancel = participantBookings.filter(b =>
      b.scheduleId === scheduleId && b.classDate === classDate &&
      (b.status === 'BOOKED' || b.status === 'CHECKED-IN' || b.status === 'WAITLISTED')
    );
    const affected = new Set(toCancel.map(b => b.participantId));

    if (auth.organizationId && !firebaseService.isOffline()) {
      try {
        await cancelClassInstanceFn({ orgId: auth.organizationId, scheduleId, classDate, recipients: Array.from(affected) });
      } catch (e) {
        console.error("cancelClassInstance failed:", e);
        addNotification({ type: 'ERROR', title: 'Notifieringsfel', message: 'Ett fel uppstod vid utskick av notiser. Försök igen.' });
        return;
      }
    }

    const ex: GroupClassScheduleException = {
      id: crypto.randomUUID(), scheduleId, date: classDate,
      createdBy: { uid: auth.user!.id, name: auth.user!.name }, createdAt: new Date().toISOString(),
    };
    setGroupClassScheduleExceptionsData(prev => [...prev, ex]);

    if (affected.size) {
      const refundIds = new Set<string>();
      const updated = participantBookings.map(b => {
        if (toCancel.some(x => x.id === b.id)) {
          if (b.status !== 'WAITLISTED') {
            const p = participantDirectory.find(pp => pp.id === b.participantId);
            const m = memberships.find(mm => mm.id === p?.membershipId);
            if (m?.type === 'clip_card') refundIds.add(b.participantId);
          }
          return { ...b, status: 'CANCELLED' as const, cancelReason: 'coach_cancelled' as const };
        }
        return b;
      });
      setParticipantBookingsData(updated);
      if (refundIds.size) {
        setParticipantDirectoryData(prev => prev.map(p =>
          refundIds.has(p.id) && p.clipCardStatus
            ? { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: (p.clipCardStatus.remainingClips || 0) + 1 } }
            : p
        ));
      }
    }

    const classDef = definitions.find(d => d.id === groupClassSchedules.find(s => s.id === scheduleId)?.groupClassId);
    addNotification({ type: 'SUCCESS', title: 'Pass Inställt', message: `Passet ${classDef?.name || ''} har ställts in. ${affected.size} deltagare har meddelats.` });
  }, [auth.user, auth.organizationId, groupClassScheduleExceptions, participantBookings, participantDirectory, memberships, definitions, groupClassSchedules, setGroupClassScheduleExceptionsData, setParticipantBookingsData, setParticipantDirectoryData, addNotification]);

  const handleProfileModalOpened = useCallback(() => {
    const p = participantDirectory.find(pp => pp.id === auth.currentParticipantId);
    const m = p ? memberships.find(mm => mm.id === p.membershipId) : null;
    if (m?.name.toLowerCase() === 'startprogram' && prospectModalShownKey) localStorage.setItem(prospectModalShownKey, 'true');
    setOpenProfileModalOnInit(false);
  }, [auth.currentParticipantId, participantDirectory, memberships, prospectModalShownKey]);

  const handleOpenProfile = useCallback(() => {
    if (auth.currentRole === 'participant' && profileOpener) profileOpener.open();
    else if (auth.currentRole === 'coach' || (auth.user?.roles.systemOwner && !auth.isImpersonating)) {
      auth.viewAsParticipant(); setOpenProfileModalOnInit(true);
    }
  }, [auth, profileOpener]);

  const renderMainView = useCallback(() => {
    if (auth.isLoading || (!auth.user && isGlobalDataLoading)) {
      const logo = cachedLogo;
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-dotted-pattern bg-dotted-size z-50">
          <div>{logo ? <img src={logo} alt="Logotyp" className="h-24 w-auto object-contain" /> : <img src="/icon-512x512.png" alt="Logotyp" className="h-24 w-auto object-contain" />}</div>
        </div>
      );
    }

    if (registrationPendingMessage) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
          <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-semibold text-green-700">Tack för din registrering!</h2>
            <p className="text-lg text-gray-600">Ditt konto väntar på godkännande av en coach. Godkännande sker vanligtvis inom 2 timmar. Du kommer inte kunna logga in förrän det är godkänt.</p>
            <Button onClick={() => { setRegistrationPendingMessage(false); setView('login'); }} fullWidth size="lg">Tillbaka till inloggning</Button>
          </div>
        </div>
      );
    }

    if (!auth.user) {
      return view === 'login'
        ? <Login onSwitchToRegister={() => setView('register')} />
        : <Register onSwitchToLogin={() => setView('login')} onRegistrationSuccess={() => setRegistrationPendingMessage(true)} />;
    }

    if (auth.user && isOrgDataLoading) {
      const logo = cachedLogo || branding?.logoBase64;
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-dotted-pattern bg-dotted-size z-50">
          <div>{logo ? <img src={logo} alt="Logotyp" className="h-24 w-auto object-contain" /> : <img src="/icon-512x512.png" alt="Logotyp" className="h-24 w-auto object-contain" />}</div>
        </div>
      );
    }

    if (auth.user?.roles.systemOwner && !auth.isImpersonating) return <SystemOwnerArea />;

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
            operationInProgress={operationInProgress}
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

    return <Login onSwitchToRegister={() => setView('register')} />;
  }, [
    auth.isLoading, auth.user, auth.currentRole, auth.currentParticipantId, auth.isStaffViewingAsParticipant,
    auth.isImpersonating, auth.viewAsParticipant, auth.stopViewingAsParticipant, isGlobalDataLoading, isOrgDataLoading,
    cachedLogo, branding, registrationPendingMessage, view, handleAddComment, handleDeleteComment, handleToggleCommentReaction,
    handleCheckInParticipant, handleUnCheckInParticipant, handleBookClass, handleCancelBooking, handlePromoteFromWaitlist,
    handleCancelClassInstance, handleSelfCheckIn, handleLocationCheckIn, openProfileModalOnInit, handleProfileModalOpened,
    setProfileOpener, setParticipantModalOpeners, newFlowItemsCount, isWelcomeModalOpen, welcomeModalShown, setWelcomeModalShown,
    operationInProgress,
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

      {showTermsModal && <TermsModal isOpen={showTermsModal} onClose={() => {}} onAccept={handleAcceptTerms} isBlocking />}
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppProvider>
      <NetworkStatusProvider>
        <AppContent />
      </NetworkStatusProvider>
    </AppProvider>
  </AuthProvider>
);
