import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { User, UserRole, ParticipantProfile } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../constants';
import firebaseService from '../services/firebaseService';
import { auth, db } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import dataService from '../services/dataService';


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
  // FIX: Added 'name' parameter to the register function signature to match the call in Register.tsx.
  register: (email: string, password: string, orgId: string, locationId: string, name: string) => Promise<void>;
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
        const defaultUser = dataService.get('users').find(u => u.id === 'user-id-admin1');
        setUser(defaultUser || null);
        setIsLoading(false);
        return;
    }
    
    // Guard against using auth or db before they are initialized.
    if (!auth || !db) {
        console.warn("AuthContext: Firebase not initialized. Auth state cannot be monitored.");
        setIsLoading(false);
        return;
    }
    
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
        if (firebaseUser) {
            const isNewUser = firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime;
            const userDocRef = db.collection('users').doc(firebaseUser.uid);
            const userDocSnap = await userDocRef.get();

            if (userDocSnap.exists) {
                const userData = userDocSnap.data() as Omit<User, 'id'>;
                const { roles, linkedParticipantProfileId } = userData;
                
                if (roles?.participant && linkedParticipantProfileId) {
                    const orgId = roles.participant;
                    const participantDocRef = db.collection('organizations').doc(orgId).collection('participantDirectory').doc(linkedParticipantProfileId);
                    const participantDocSnap = await participantDocRef.get();

                    if (participantDocSnap.exists && participantDocSnap.data()!.approvalStatus === 'pending') {
                        await auth.signOut();
                        return;
                    }
                }
                
                setUser({
                    id: firebaseUser.uid,
                    name: userData.name,
                    email: userData.email,
                    roles: userData.roles,
                    linkedParticipantProfileId: userData.linkedParticipantProfileId,
                    termsAcceptedTimestamp: userData.termsAcceptedTimestamp,
                });
            } else {
                if (isNewUser) {
                    console.log("New user detected, Firestore doc not yet available. Waiting for registration process to complete.");
                    return;
                } else {
                    console.error(`User doc for existing user ${firebaseUser.uid} not found in Firestore. Signing out.`);
                    await auth.signOut();
                }
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
        const userToLogin = dataService.get('users').find(u => u.email.toLowerCase() === email.toLowerCase());
        if (userToLogin) {
            setUser(userToLogin);
            return;
        } else {
            throw new Error("User not found in mock data.");
        }
    }
    
    if (!auth || !db) throw new Error("Firebase Auth is not initialized.");
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;

    if (!firebaseUser) {
        await auth.signOut();
        throw new Error('AUTH_NO_USER_PROFILE');
    }
    
    const userDocRef = db.collection('users').doc(firebaseUser.uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        await auth.signOut();
        throw new Error('AUTH_NO_USER_PROFILE');
    }
    
    const userData = userDocSnap.data() as Omit<User, 'id'>;
    const { roles, linkedParticipantProfileId } = userData;

    if (roles?.participant && linkedParticipantProfileId) {
        const orgId = roles.participant;
        const participantDocRef = db.collection('organizations').doc(orgId).collection('participantDirectory').doc(linkedParticipantProfileId);
        const participantDocSnap = await participantDocRef.get();

        if (participantDocSnap.exists && participantDocSnap.data()!.approvalStatus === 'pending') {
            await auth.signOut();
            throw new Error('AUTH_APPROVAL_PENDING');
        }
    }
  }, []);

  const register = useCallback(async (email: string, password: string, orgId: string, locationId: string, name: string) => {
    if (firebaseService.isOffline()) {
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
      return;
    }
    await firebaseService.registerUserAndCreateProfiles({
        name, email, password, orgId, locationId
    });
  }, []);

  const stopImpersonating = useCallback(() => {
    setLocalState(prev => ({ ...prev, impersonatingOrgId: null, isStaffViewingAsParticipant: false }));
  }, [setLocalState]);

  const logout = useCallback(async () => {
    stopImpersonating();
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_USED_ORG_ID);
    if (!firebaseService.isOffline()) {
        if (auth) await auth.signOut();
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
      stopImpersonating(); 
    } else {
      setLocalState(prev => ({ ...prev, isStaffViewingAsParticipant: false }));
    }
  }, [user, setLocalState, stopImpersonating]);

  const value = useMemo(() => ({
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
  }), [
    user,
    isLoading,
    organizationId,
    currentRole,
    currentParticipantId,
    localState.impersonatingOrgId,
    localState.isStaffViewingAsParticipant,
    login,
    register,
    logout,
    impersonate,
    stopImpersonating,
    viewAsParticipant,
    stopViewingAsParticipant
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
