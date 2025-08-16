import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { User, UserRole } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../constants';
import firebaseService from '../services/firebaseService';
import { auth, db } from '../firebaseConfig';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
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
                console.error(`User ${firebaseUser.uid} not found in Firestore.`);
                setUser(null);
                await signOut(auth); // Sign them out of Firebase Auth as well
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
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const stopImpersonating = useCallback(() => {
    setLocalState(prev => ({ ...prev, impersonatingOrgId: null, isStaffViewingAsParticipant: false }));
  }, [setLocalState]);

  const logout = useCallback(async () => {
    stopImpersonating();
    if (!firebaseService.isOffline()) {
        await signOut(auth);
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
