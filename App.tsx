
// App.tsx
import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkStatusProvider } from './context/NetworkStatusContext';
import { DevToolbar } from './components/DevToolbar';
import { Login } from './features/auth/components/Login';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { Register } from './features/auth/components/Register';
import { TermsModal } from './components/TermsModal';
import { WelcomeModal } from './components/participant/WelcomeModal';
import { UpdateNoticeModal } from './components/participant/UpdateNoticeModal';
import { LOCAL_STORAGE_KEYS } from './constants';
import { useNotifications } from './context/NotificationsContext';
import { ensureWebPushSubscription } from './utils/push';
import { Button } from './components/Button'; // Keep Button import as it might be used in fallback UI

// --- Lazy Loaded Components ---
const CoachArea = lazy(() => import('./components/coach/CoachArea').then(m => ({ default: m.CoachArea })));
const ParticipantArea = lazy(() => import('./components/participant/ParticipantArea').then(m => ({ default: m.ParticipantArea })));
const SystemOwnerArea = lazy(() => import('./components/SystemOwnerArea').then(m => ({ default: m.SystemOwnerArea })));
const PublicLeadForm = lazy(() => import('./components/public/PublicLeadForm').then(m => ({ default: m.PublicLeadForm })));
const ZapierWebhookHandler = lazy(() => import('./components/api/ZapierWebhookHandler').then(m => ({ default: m.ZapierWebhookHandler })));

// --- Helper Components ---
const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-50">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-flexibel" />
  </div>
);

const ProtectedRoute: React.FC<React.PropsWithChildren<{ allowedRoles?: string[] }>> = ({ children, allowedRoles }) => {
  const { user, currentRole, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && currentRole && !allowedRoles.includes(currentRole)) {
     // Redirect based on actual role if trying to access unauthorized area
     if (currentRole === 'participant') return <Navigate to="/participant" replace />;
     if (currentRole === 'coach') return <Navigate to="/coach" replace />;
     if (currentRole === 'system_owner') return <Navigate to="/system-owner" replace />;
     return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};


// --- Main App Content ---
const AppContent: React.FC = () => {
  const appContext = useAppContext();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // --- State ---
  const [registrationPendingMessage, setRegistrationPendingMessage] = useState(false);
  const [operationInProgress] = useState<string[]>([]); // Kept for now if needed by context, but usage reduced
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
  const [showLatestUpdateView, setShowLatestUpdateView] = useState(false);
  const [hasUnreadUpdate, setHasUnreadUpdate] = useState(false);
  const [participantModalOpeners, setParticipantModalOpeners] = useState({
    openGoalModal: () => {}, openCommunityModal: () => {}, openFlowModal: () => {},
  });

  // --- Memos & Derived State ---
  const { pendingRequestsCount, newFlowItemsCount } = useMemo(() => {
    if (auth.currentRole !== 'participant' || !auth.currentParticipantId) {
      return { pendingRequestsCount: 0, newFlowItemsCount: 0 };
    }
    const { connections, lastFlowViewTimestamp, coachEvents, workoutLogs, generalActivityLogs, goalCompletionLogs, clubMemberships, userStrengthStats, participantPhysiqueHistory, participantGoals, userConditioningStatsHistory, userNotifications } = appContext;
    
    const requests = connections.filter(c => c.receiverId === auth.currentParticipantId && c.status === 'pending').length;

    let count = 0;
    
    // 1. Unread notifications count
    const unreadNotifications = userNotifications.filter(n => n.recipientId === auth.currentParticipantId && !n.read).length;
    count += unreadNotifications;

    // 2. New timeline items count
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
      count += newItems.size;
    }
    return { pendingRequestsCount: requests, newFlowItemsCount: count };
  }, [
    auth.currentRole, auth.currentParticipantId, appContext.connections, appContext.lastFlowViewTimestamp, 
    appContext.coachEvents, appContext.workoutLogs, appContext.generalActivityLogs, appContext.goalCompletionLogs, 
    appContext.clubMemberships, appContext.userStrengthStats, appContext.participantPhysiqueHistory, 
    appContext.participantGoals, appContext.userConditioningStatsHistory, appContext.userNotifications
  ]);

  // --- Effects ---
  useEffect(() => {
    if (auth.user && !auth.user.termsAcceptedTimestamp && !hasCheckedTerms) {
      setShowTermsModal(true);
      setHasCheckedTerms(true);
    }
  }, [auth.user, hasCheckedTerms]);

  const UPDATE_NOTICE_KEY = 'updateNotice_v5_Verification_Live';
  const LAST_SEEN_UPDATE_KEY = 'flexibel_lastSeenUpdateNotice';
  useEffect(() => {
    if (auth.user && auth.currentRole === 'participant') {
      if (localStorage.getItem(LAST_SEEN_UPDATE_KEY) !== UPDATE_NOTICE_KEY) setHasUnreadUpdate(true);
    }
  }, [auth.user, auth.currentRole]);

  useEffect(() => {
    if (auth.organizationId) {
      setCachedLogo(localStorage.getItem(`flexibel_logo_${auth.organizationId}`));
    } else if (!auth.isLoading) {
      setCachedLogo(null);
    }
  }, [auth.organizationId, auth.isLoading]);

  useEffect(() => {
    if (auth.currentRole === 'participant' && auth.organizationId && auth.currentParticipantId) {
      const profile = appContext.participantDirectory.find(p => p.id === auth.currentParticipantId);
      const pushEnabled = profile?.notificationSettings?.pushEnabled ?? true;
      if (pushEnabled) {
        ensureWebPushSubscription(auth.organizationId, auth.currentParticipantId);
      }
    }
  }, [auth.currentRole, auth.organizationId, auth.currentParticipantId, appContext.participantDirectory]);
  
  const prospectModalShownKey = auth.currentParticipantId ? `flexibel_prospectProfileModalShown_${auth.currentParticipantId}` : null;
  useEffect(() => {
    if (auth.currentRole === 'participant' && auth.currentParticipantId && appContext.participantDirectory.length > 0) {
      if (!welcomeModalShown) setIsWelcomeModalOpen(true);
      const p = appContext.participantDirectory.find(pp => pp.id === auth.currentParticipantId);
      const m = p ? appContext.memberships.find(mm => mm.id === p.membershipId) : null;
      if (m?.name.toLowerCase() === 'startprogram') {
        const ok = !!(p?.birthDate && p?.gender && p?.gender !== '-');
        if (!ok) {
          const shown = prospectModalShownKey ? localStorage.getItem(prospectModalShownKey) === 'true' : false;
          if (!shown) setOpenProfileModalOnInit(true);
        }
      }
    }
  }, [auth.currentRole, auth.currentParticipantId, welcomeModalShown, appContext.participantDirectory, prospectModalShownKey, appContext.memberships]);

  // --- Callbacks ---
  const handleAcceptTerms = useCallback(async () => {
    if (!auth.user) return;
    try {
      await appContext.updateUser(auth.user.id, { termsAcceptedTimestamp: new Date().toISOString() });
      setShowTermsModal(false);
    } catch (e) {
      console.error('Failed to accept terms:', e);
      alert('Kunde inte spara ditt godkännande. Vänligen försök igen.');
    }
  }, [auth.user, appContext.updateUser]);

  const handleOpenLatestUpdateView = useCallback(() => {
    setShowLatestUpdateView(true);
    localStorage.setItem(LAST_SEEN_UPDATE_KEY, UPDATE_NOTICE_KEY);
    setHasUnreadUpdate(false);
  }, []);

  const handleProfileModalOpened = useCallback(() => {
    const { participantDirectory, memberships } = appContext;
    const p = participantDirectory.find(pp => pp.id === auth.currentParticipantId);
    const m = p ? memberships.find(mm => mm.id === p.membershipId) : null;
    if (m?.name.toLowerCase() === 'startprogram' && prospectModalShownKey) localStorage.setItem(prospectModalShownKey, 'true');
    setOpenProfileModalOnInit(false);
  }, [auth.currentParticipantId, appContext.participantDirectory, appContext.memberships, prospectModalShownKey]);

  const handleOpenProfile = useCallback(() => {
    if (auth.currentRole === 'participant' && profileOpener) profileOpener.open();
    else if (auth.currentRole === 'coach' || (auth.user?.roles.systemOwner && !auth.isImpersonating)) {
      auth.viewAsParticipant(); setOpenProfileModalOnInit(true);
    }
  }, [auth, profileOpener]);
  
  // Redirection Logic based on role
  useEffect(() => {
      if (!auth.isLoading && auth.user) {
          if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
              if (auth.currentRole === 'coach') navigate('/coach/overview', { replace: true });
              else if (auth.currentRole === 'participant') navigate('/participant', { replace: true });
              else if (auth.currentRole === 'system_owner') navigate('/system-owner', { replace: true });
          }
      }
  }, [auth.user, auth.isLoading, auth.currentRole, navigate, location.pathname]);

  if (auth.isLoading || (!auth.user && appContext.isGlobalDataLoading)) {
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
            <Button onClick={() => { setRegistrationPendingMessage(false); navigate('/login'); }} fullWidth size="lg">Tillbaka till inloggning</Button>
          </div>
        </div>
      );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
       {auth.user && (
          <Navbar
            onOpenProfile={handleOpenProfile}
            onOpenLatestUpdate={handleOpenLatestUpdateView}
            onOpenGoalModal={participantModalOpeners.openGoalModal}
            onOpenCommunity={participantModalOpeners.openCommunityModal}
            onOpenFlowModal={participantModalOpeners.openFlowModal}
            pendingRequestsCount={pendingRequestsCount}
            newFlowItemsCount={newFlowItemsCount}
            hasUnreadUpdate={hasUnreadUpdate}
          />
       )}
      <OfflineBanner />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route path="/public/lead-form" element={<PublicLeadForm />} />
                <Route path="/api/zapier-lead-webhook" element={<ZapierWebhookHandler />} />
                
                <Route path="/login" element={!auth.user ? <Login /> : <Navigate to="/" replace />} />
                <Route path="/register" element={!auth.user ? <Register onRegistrationSuccess={() => setRegistrationPendingMessage(true)} /> : <Navigate to="/" replace />} />
                
                {/* Coach Routes */}
                <Route path="/coach/*" element={
                    <ProtectedRoute allowedRoles={['coach']}>
                        <div className="container mx-auto px-2 sm:px-6 py-6">
                            <CoachArea />
                        </div>
                    </ProtectedRoute>
                } />

                {/* Participant Route */}
                <Route path="/participant" element={
                    <ProtectedRoute allowedRoles={['participant']}>
                         {auth.currentParticipantId ? (
                            <>
                                <ParticipantArea
                                    currentParticipantId={auth.currentParticipantId}
                                    openProfileModalOnInit={openProfileModalOnInit}
                                    onProfileModalOpened={handleProfileModalOpened}
                                    isStaffViewingSelf={auth.isStaffViewingAsParticipant}
                                    onSwitchToStaffView={auth.stopViewingAsParticipant}
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
                         ) : <LoadingSpinner />}
                    </ProtectedRoute>
                } />

                 {/* System Owner Route */}
                 <Route path="/system-owner" element={
                    <ProtectedRoute allowedRoles={['system_owner']}>
                        <SystemOwnerArea />
                    </ProtectedRoute>
                } />

                {/* Fallback */}
                <Route path="*" element={<Navigate to={auth.user ? (auth.currentRole === 'coach' ? '/coach/overview' : '/participant') : '/login'} replace />} />
            </Routes>
        </Suspense>
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
