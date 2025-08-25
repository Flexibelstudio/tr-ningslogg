import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { User, UserRole, ParticipantProfile } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../constants';
import firebaseService from '../services/firebaseService';
import { auth, db } from '../firebaseConfig';
import dataService from '../services/dataService';
import firebase from 'firebase/compat/app';


interface AuthState {
    // userId is no longer the source of truth, but we keep the structure for impersonation state
    impersonatingOrgId: string | null;
    isStaffViewingAsParticipant: boolean;
}

interface AuthContextType {
  user: User | null; // Our app's user object from Firestore
  isLoading: boolean;
  organizationId: string | null;
  currentRole: UserRole | null;
  currentParticipantId: string | null;
  isImpersonating: boolean;
  isStaffViewingAsParticipant: boolean; 
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgId: string, locationId: string) => Promise<void>;
  logout: () => void;
  impersonate: (orgId: string) => void;
  stopImpersonating: () => void;
  
  viewAsParticipant: () => void;
  stopViewingAsParticipant: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [localState, setLocalState] = useLocalStorage<Omit<AuthState, 'userId'>>(LOCAL_STORAGE_KEYS.AUTH_STATE, { 
      impersonatingOrgId: null,
      isStaffViewingAsParticipant: false,
  });

  useEffect(() => {
    if (firebaseService.isOffline()) {
        // In offline mode, use mock data for a default user for previewing.
        // We'll log in as the admin by default.
        const defaultUser = dataService.get('users').find(u => u.id === 'user-id-admin1');
        setUser(defaultUser || null);
        setIsLoading(false);
        return;
    }
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
        if (firebaseUser) {
            // Check if this is a new user who just registered.
            // New users have identical creation and last sign-in times upon creation.
            const isNewUser = firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime;
            
            const userDocRef = db.collection('users').doc(firebaseUser.uid);
            let userDocSnap = await userDocRef.get();

            // If the user doc doesn't exist, and it's a brand new user account,
            // it's likely a registration in progress. Wait a moment to allow the
            // Firestore write to complete.
            if (!userDocSnap.exists && isNewUser) {
                console.log("User doc not found for new user, waiting to retry for registration write...");
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                userDocSnap = await userDocRef.get();
            }

            if (userDocSnap.exists) {
                const userData = userDocSnap.data();
                setUser({
                    id: firebaseUser.uid,
                    name: userData.name,
                    email: userData.email,
                    roles: userData.roles,
                    linkedParticipantProfileId: userData.linkedParticipantProfileId,
                });
            } else {
                // User authenticated but no profile in Firestore, treat as logged out.
                console.error(`User ${firebaseUser.uid} not found in Firestore. Signing out.`);
                setUser(null);
                await auth.signOut(); // Sign them out of Firebase Auth as well
            }
        } else {
            setUser(null);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const organizationId = useMemo(() => {
    if (localState.impersonatingOrgId) return localState.impersonatingOrgId;
    if (!user) return null;
    if (user.roles.orgAdmin && user.roles.orgAdmin.length > 0) return user.roles.orgAdmin[0];
    if (user.roles.participant) return user.roles.participant;
    return null;
  }, [user, localState.impersonatingOrgId]);
  
  useEffect(() => {
    if (organizationId) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID, organizationId);
    }
  }, [organizationId]);

  const currentRole = useMemo((): UserRole | null => {
      if (!user) return null;

      if (localState.isStaffViewingAsParticipant && user.linkedParticipantProfileId) {
        return UserRole.PARTICIPANT;
      }
      if (user.roles.systemOwner) {
          return localState.impersonatingOrgId ? UserRole.COACH : UserRole.SYSTEM_OWNER;
      }
      if (user.roles.orgAdmin && user.roles.orgAdmin.length > 0) return UserRole.COACH;
      if (user.roles.participant) return UserRole.PARTICIPANT;
      return null;
  }, [user, localState.impersonatingOrgId, localState.isStaffViewingAsParticipant]);
  
  const currentParticipantId = useMemo(() => {
    if (!user || !currentRole) return null;
    if (localState.isStaffViewingAsParticipant && user.linkedParticipantProfileId) {
        return user.linkedParticipantProfileId;
    }
    if (currentRole === UserRole.PARTICIPANT && user.linkedParticipantProfileId) {
        return user.linkedParticipantProfileId;
    }
    return null;
  }, [user, currentRole, localState.isStaffViewingAsParticipant]);

  const login = useCallback(async (email: string, password: string) => {
    if (firebaseService.isOffline()) {
        console.error("Attempted to log in while in offline mode. This is not supported.");
        throw new Error('OFFLINE_LOGIN_ATTEMPT');
    }
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;

    if (!firebaseUser) {
        await auth.signOut();
        throw new Error('AUTH_NO_USER_PROFILE');
    }

    // Check for approval status
    const userDocRef = db.collection('users').doc(firebaseUser.uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        await auth.signOut();
        throw new Error('AUTH_NO_USER_PROFILE');
    }
    
    const userData = userDocSnap.data();
    const { roles, linkedParticipantProfileId } = userData;

    // Only perform this check for participants
    if (roles?.participant && linkedParticipantProfileId) {
        const orgId = roles.participant;
        const participantDocRef = db.collection('organizations').doc(orgId).collection('participantDirectory').doc(linkedParticipantProfileId);
        const participantDocSnap = await participantDocRef.get();

        if (participantDocSnap.exists && participantDocSnap.data().approvalStatus === 'pending') {
            await auth.signOut();
            throw new Error('AUTH_APPROVAL_PENDING');
        }
    }
    // If approved or not a standard participant (e.g., coach), the onAuthStateChanged listener will handle the rest.
  }, []);

  const register = useCallback(async (email: string, password: string, orgId: string, locationId: string) => {
    const name = "Ny användare"; // Default name, admin can edit later
    if (firebaseService.isOffline()) {
      // Mock registration logic
      const newUserId = `user-id-${Math.random()}`;
      const newParticipantId = `participant-${Math.random()}`;
      
      const newUser: User = {
        id: newUserId,
        name: name,
        email: email,
        roles: { participant: orgId },
        linkedParticipantProfileId: newParticipantId,
      };
      dataService.set('users', prev => [...prev, newUser]);
      
      const newParticipant: ParticipantProfile = {
        id: newParticipantId,
        name: name,
        email: email,
        isActive: false,
        isProspect: false,
        approvalStatus: 'pending',
        isSearchable: true,
        locationId: locationId,
        creationDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      dataService.setOrgData(orgId, prev => ({
        ...prev,
        participantDirectory: [...prev.participantDirectory, newParticipant]
      }));

      // In mock mode, we don't handle auth state change. User just sees success message.
      return;
    }
    // Online registration logic
    await firebaseService.registerUserAndCreateProfiles({
        name, email, password, orgId, locationId
    });
    // Immediately sign the new user out so they have to wait for approval.
    await auth.signOut();
  }, []);

  const stopImpersonating = useCallback(() => {
    setLocalState(prev => ({ ...prev, impersonatingOrgId: null, isStaffViewingAsParticipant: false }));
  }, [setLocalState]);

  const logout = useCallback(async () => {
    stopImpersonating();
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID);
    if (!firebaseService.isOffline()) {
        await auth.signOut();
    } else {
        setUser(null);
    }
  }, [stopImpersonating]);
  
  const impersonate = useCallback((orgId: string) => {
    if (user?.roles.systemOwner) {
        setLocalState(prev => ({ ...prev, impersonatingOrgId: orgId, isStaffViewingAsParticipant: false }));
    }
  }, [user, setLocalState]);
  
  const viewAsParticipant = useCallback(() => {
    if (user?.linkedParticipantProfileId) {
        setLocalState(prev => ({ ...prev, isStaffViewingAsParticipant: true }));
    }
  }, [user, setLocalState]);

  const stopViewingAsParticipant = useCallback(() => {
    if (user?.roles.systemOwner) {
      // A system owner should always return to the system overview, not an impersonated org view.
      stopImpersonating(); 
    } else {
      setLocalState(prev => ({ ...prev, isStaffViewingAsParticipant: false }));
    }
  }, [user, setLocalState, stopImpersonating]);

  const value = {
    user,
    isLoading,
    organizationId,
    currentRole,
    currentParticipantId,
    isImpersonating: !!localState.impersonatingOrgId,
    isStaffViewingAsParticipant: localState.isStaffViewingAsParticipant,
    login,
    register,
    logout,
    impersonate,
    stopImpersonating,
    viewAsParticipant,
    stopViewingAsParticipant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
