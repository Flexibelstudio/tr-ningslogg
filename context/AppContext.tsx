import React, { useState, useCallback, createContext, useContext, ReactNode, useEffect, useMemo, useRef } from 'react';
import { 
    Organization, User,
    OrganizationData, ParticipantProfile, Workout, WorkoutLog, ParticipantGoalData, 
    GeneralActivityLog, GoalCompletionLog, CoachNote, UserStrengthStat, 
    ParticipantConditioningStat, ParticipantPhysiqueStat, ParticipantMentalWellbeing, 
    ParticipantGamificationStats, ParticipantClubMembership, LeaderboardSettings, 
    CoachEvent, Connection, Location, StaffMember, Membership, 
    WeeklyHighlightSettings, OneOnOneSession, WorkoutCategoryDefinition, 
    StaffAvailability, IntegrationSettings, GroupClassDefinition, 
    GroupClassSchedule, ParticipantBooking, AppData, BrandingSettings, ProspectIntroCall, Lead, UserPushSubscription, GroupClassScheduleException, NotificationLog
} from '../types';
import firebaseService from '../services/firebaseService'; // Use the new service
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import dataService from '../services/dataService';
import { COLOR_PALETTE } from '../constants';
import { sanitizeDataForFirebase } from '../utils/firestoreUtils';


const sortWorkoutsByCategoryThenTitle = (workouts: Workout[]): Workout[] => {
    return [...workouts].sort((a, b) => {
        const categoryComparison = a.category.localeCompare(b.category);
        if (categoryComparison !== 0) return categoryComparison;
        return a.title.localeCompare(b.title);
    });
};

// 1. Define the shape of the context value
interface AppContextType extends OrganizationData {
  allOrganizations: Organization[];
  allUsers: User[];
  workouts: Workout[]; // This overrides the property from OrganizationData to ensure it's always sorted
  branding: BrandingSettings | undefined; // This overrides the optional property from OrganizationData
  isOrgDataLoading: boolean;
  isGlobalDataLoading: boolean;
  isOrgDataFromFallback: boolean;
  orgDataError: string | null;
  // New function for dynamic colors
  getColorForCategory: (categoryName: string | undefined) => string;
  // Updater for a single participant document
  addParticipant: (participant: ParticipantProfile) => Promise<void>;
  updateParticipantProfile: (participantId: string, data: Partial<ParticipantProfile>) => Promise<void>;
  updateUser: (userId: string, data: Partial<Omit<User, 'id'>>) => Promise<void>;
  
  // Granular updaters for workouts
  addWorkout: (workout: Workout) => Promise<void>;
  updateWorkout: (workout: Workout) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  
  // All other updater functions
  setParticipantDirectoryData: (updater: React.SetStateAction<AppData['participantDirectory']>) => void;
  setWorkoutLogsData: (updater: React.SetStateAction<AppData['workoutLogs']>) => void;
  setParticipantGoalsData: (updater: React.SetStateAction<AppData['participantGoals']>) => void;
  setGeneralActivityLogsData: (updater: React.SetStateAction<AppData['generalActivityLogs']>) => void;
  setGoalCompletionLogsData: (updater: React.SetStateAction<AppData['goalCompletionLogs']>) => void;
  setCoachNotesData: (updater: React.SetStateAction<AppData['coachNotes']>) => void;
  setUserStrengthStatsData: (updater: React.SetStateAction<AppData['userStrengthStats']>) => void;
  setUserConditioningStatsHistoryData: (updater: React.SetStateAction<AppData['userConditioningStatsHistory']>) => void;
  setParticipantPhysiqueHistoryData: (updater: React.SetStateAction<AppData['participantPhysiqueHistory']>) => void;
  setParticipantMentalWellbeingData: (updater: React.SetStateAction<AppData['participantMentalWellbeing']>) => void;
  setParticipantGamificationStatsData: (updater: React.SetStateAction<AppData['participantGamificationStats']>) => void;
  setClubMembershipsData: (updater: React.SetStateAction<AppData['clubMemberships']>) => void;
  setLeaderboardSettingsData: (updater: React.SetStateAction<AppData['leaderboardSettings']>) => void;
  setCoachEventsData: (updater: React.SetStateAction<AppData['coachEvents']>) => void;
  setConnectionsData: (updater: React.SetStateAction<AppData['connections']>) => void;
  setLastFlowViewTimestampData: (updater: React.SetStateAction<AppData['lastFlowViewTimestamp']>) => void;
  setLocationsData: (updater: React.SetStateAction<AppData['locations']>) => void;
  setStaffMembersData: (updater: React.SetStateAction<AppData['staffMembers']>) => void;
  setMembershipsData: (updater: React.SetStateAction<AppData['memberships']>) => void;
  setWeeklyHighlightSettingsData: (updater: React.SetStateAction<AppData['weeklyHighlightSettings']>) => void;
  setOneOnOneSessionsData: (updater: React.SetStateAction<AppData['oneOnOneSessions']>) => void;
  setWorkoutCategoriesData: (updater: React.SetStateAction<AppData['workoutCategories']>) => void;
  setStaffAvailabilityData: (updater: React.SetStateAction<AppData['staffAvailability']>) => void;
  setIntegrationSettingsData: (updater: React.SetStateAction<AppData['integrationSettings']>) => void;
  setGroupClassDefinitionsData: (updater: React.SetStateAction<AppData['groupClassDefinitions']>) => void;
  setGroupClassSchedulesData: (updater: React.SetStateAction<AppData['groupClassSchedules']>) => void;
  setGroupClassScheduleExceptionsData: (updater: React.SetStateAction<AppData['groupClassScheduleExceptions']>) => void;
  setParticipantBookingsData: (updater: React.SetStateAction<AppData['participantBookings']>) => void;
  setLeadsData: (updater: React.SetStateAction<AppData['leads']>) => void;
  setProspectIntroCallsData: (updater: React.SetStateAction<AppData['prospectIntroCalls']>) => void;
  setUserPushSubscriptionsData: (updater: React.SetStateAction<AppData['userPushSubscriptions']>) => void;
  setNotificationLogsData: (updater: React.SetStateAction<AppData['notificationLogs']>) => void;
  setBrandingData: (updater: React.SetStateAction<AppData['branding']>) => void;
}

// 2. Create the context with a default value (or undefined and check for it)
const AppContext = createContext<AppContextType | undefined>(undefined);

// 3. Create the Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { organizationId, user, isLoading: isAuthLoading } = useAuth();
    
    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    // State for each "collection" to simulate subcollection fetching
    const [participantDirectory, setParticipantDirectory] = useState<ParticipantProfile[]>([]);
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
    const [participantGoals, setParticipantGoals] = useState<ParticipantGoalData[]>([]);
    const [generalActivityLogs, setGeneralActivityLogs] = useState<GeneralActivityLog[]>([]);
    const [goalCompletionLogs, setGoalCompletionLogs] = useState<GoalCompletionLog[]>([]);
    const [coachNotes, setCoachNotes] = useState<CoachNote[]>([]);
    const [userStrengthStats, setUserStrengthStats] = useState<UserStrengthStat[]>([]);
    const [userConditioningStatsHistory, setUserConditioningStatsHistory] = useState<ParticipantConditioningStat[]>([]);
    const [participantPhysiqueHistory, setParticipantPhysiqueHistory] = useState<ParticipantPhysiqueStat[]>([]);
    const [participantMentalWellbeing, setParticipantMentalWellbeing] = useState<ParticipantMentalWellbeing[]>([]);
    const [participantGamificationStats, setParticipantGamificationStats] = useState<ParticipantGamificationStats[]>([]);
    const [clubMemberships, setClubMemberships] = useState<ParticipantClubMembership[]>([]);
    const [leaderboardSettings, setLeaderboardSettings] = useState<LeaderboardSettings>({ leaderboardsEnabled: false, weeklyPBChallengeEnabled: false, weeklySessionChallengeEnabled: false });
    const [coachEvents, setCoachEvents] = useState<CoachEvent[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [lastFlowViewTimestamp, setLastFlowViewTimestamp] = useState<string | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [weeklyHighlightSettings, setWeeklyHighlightSettings] = useState<WeeklyHighlightSettings>({ isEnabled: false, dayOfWeek: 1, time: '09:00', studioTarget: 'separate' });
    const [oneOnOneSessions, setOneOnOneSessions] = useState<OneOnOneSession[]>([]);
    const [workoutCategories, setWorkoutCategories] = useState<WorkoutCategoryDefinition[]>([]);
    const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
    const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({ enableQRCodeScanning: false, isBookingEnabled: false, isClientJourneyEnabled: true, isScheduleEnabled: true });
    const [groupClassDefinitions, setGroupClassDefinitions] = useState<GroupClassDefinition[]>([]);
    const [groupClassSchedules, setGroupClassSchedules] = useState<GroupClassSchedule[]>([]);
    const [groupClassScheduleExceptions, setGroupClassScheduleExceptions] = useState<GroupClassScheduleException[]>([]);
    const [participantBookings, setParticipantBookings] = useState<ParticipantBooking[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [prospectIntroCalls, setProspectIntroCalls] = useState<ProspectIntroCall[]>([]);
    const [userPushSubscriptions, setUserPushSubscriptions] = useState<UserPushSubscription[]>([]);
    const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
    const [branding, setBranding] = useState<BrandingSettings | undefined>(undefined);
    const [isGlobalDataLoading, setIsGlobalDataLoading] = useState(true);
    const [isOrgDataLoading, setIsOrgDataLoading] = useState(true);
    const [orgDataError, setOrgDataError] = useState<string | null>(null);
    const [isOrgDataFromFallback, setIsOrgDataFromFallback] = useState(false);

    const tempColorMapRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (isAuthLoading) {
            return;
        }

        const fetchGlobals = async () => {
            setIsGlobalDataLoading(true);
            setIsOrgDataFromFallback(false);
            try {
                const orgs = await firebaseService.get('organizations');
                if (orgs.length === 0 && !firebaseService.isOffline()) {
                    console.warn("Online fetch for organizations returned empty. Falling back to mock data for registration page.");
                    setAllOrganizations(dataService.get('organizations'));
                    setIsOrgDataFromFallback(true);
                } else {
                    setAllOrganizations(orgs);
                    setIsOrgDataFromFallback(false);
                }

                if (user) {
                    if (user.roles.systemOwner || (user.roles.orgAdmin && user.roles.orgAdmin.length > 0)) {
                        const users = await firebaseService.get('users');
                        setAllUsers(users);
                    } else {
                        setAllUsers([]);
                    }
                } else {
                    setAllUsers([]);
                }
            } catch (error) {
                console.error("Failed to fetch global data (organizations, users), falling back to mock data.", error);
                setAllOrganizations(dataService.get('organizations'));
                setAllUsers(dataService.get('users'));
                setIsOrgDataFromFallback(true);
            } finally {
                setIsGlobalDataLoading(false);
            }
        };

        fetchGlobals();
    }, [user, isAuthLoading]);

    useEffect(() => {
        if (organizationId) {
            setIsOrgDataLoading(true);
            setOrgDataError(null);
            tempColorMapRef.current = {};
            const loadAllDataFromFirestore = async () => {
                try {
                    const data = await firebaseService.getAllOrgData(organizationId);
                    setParticipantDirectory(data.participantDirectory);
                    setWorkouts(data.workouts);
                    setWorkoutLogs(data.workoutLogs);
                    setParticipantGoals(data.participantGoals);
                    setGeneralActivityLogs(data.generalActivityLogs);
                    setGoalCompletionLogs(data.goalCompletionLogs);
                    setCoachNotes(data.coachNotes);
                    setUserStrengthStats(data.userStrengthStats);
                    setUserConditioningStatsHistory(data.userConditioningStatsHistory);
                    setParticipantPhysiqueHistory(data.participantPhysiqueHistory);
                    setParticipantMentalWellbeing(data.participantMentalWellbeing);
                    setParticipantGamificationStats(data.participantGamificationStats);
                    setClubMemberships(data.clubMemberships);
                    setLeaderboardSettings(data.leaderboardSettings);
                    setCoachEvents(data.coachEvents);
                    setConnections(data.connections);
                    setLastFlowViewTimestamp(data.lastFlowViewTimestamp);
                    setLocations(data.locations);
                    setStaffMembers(data.staffMembers);
                    setMemberships(data.memberships);
                    setWeeklyHighlightSettings(data.weeklyHighlightSettings);
                    setOneOnOneSessions(data.oneOnOneSessions);
                    setWorkoutCategories(data.workoutCategories);
                    setStaffAvailability(data.staffAvailability);
                    setIntegrationSettings(data.integrationSettings);
                    setGroupClassDefinitions(data.groupClassDefinitions);
                    setGroupClassSchedules(data.groupClassSchedules);
                    setGroupClassScheduleExceptions(data.groupClassScheduleExceptions);
                    setParticipantBookings(data.participantBookings);
                    setLeads(data.leads);
                    setProspectIntroCalls(data.prospectIntroCalls);
                    setUserPushSubscriptions(data.userPushSubscriptions);
                    setNotificationLogs(data.notificationLogs);
                    setBranding(data.branding);

                    if (data.branding?.logoBase64) {
                        localStorage.setItem(`flexibel_logo_${organizationId}`, data.branding.logoBase64);
                    } else {
                        localStorage.removeItem(`flexibel_logo_${organizationId}`);
                    }
                
                } catch (error) {
                    console.error("Failed to load organization data from Firestore:", error);
                    if (error instanceof Error && (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED'))) {
                        setOrgDataError("Kunde inte ladda organisationsdata. Du verkar sakna behörighet för denna organisation. Om du är systemägare, se till att säkerhetsreglerna i Firebase är korrekt konfigurerade. Kontakta support om problemet kvarstår.");
                    } else {
                        setOrgDataError("Ett oväntat fel uppstod vid hämtning av organisationsdata. Kontrollera din anslutning och försök igen.");
                    }
                } finally {
                    setIsOrgDataLoading(false);
                }
            };
            
            loadAllDataFromFirestore();
        } else {
            setIsOrgDataLoading(false);
            setOrgDataError(null);
            setParticipantDirectory([]); setWorkouts([]); setWorkoutLogs([]); setParticipantGoals([]);
            setGeneralActivityLogs([]); setGoalCompletionLogs([]); setCoachNotes([]); setUserStrengthStats([]);
            setUserConditioningStatsHistory([]); setParticipantPhysiqueHistory([]); setParticipantMentalWellbeing([]);
            setParticipantGamificationStats([]); setClubMemberships([]);
            setLeaderboardSettings({ leaderboardsEnabled: false, weeklyPBChallengeEnabled: false, weeklySessionChallengeEnabled: false });
            setCoachEvents([]); setConnections([]); setLastFlowViewTimestamp(null); setLocations([]);
            setStaffMembers([]); setMemberships([]);
            setWeeklyHighlightSettings({ isEnabled: false, dayOfWeek: 1, time: '09:00', studioTarget: 'separate' });
            setOneOnOneSessions([]); setWorkoutCategories([]); setStaffAvailability([]);
            setIntegrationSettings({ enableQRCodeScanning: false, isBookingEnabled: false, isClientJourneyEnabled: true, isScheduleEnabled: true });
            setGroupClassDefinitions([]); setGroupClassSchedules([]); setGroupClassScheduleExceptions([]); setParticipantBookings([]);
            setLeads([]); setProspectIntroCalls([]); setUserPushSubscriptions([]); setNotificationLogs([]); setBranding(undefined);
        }
    }, [organizationId]);
  
  const createSmartCollectionUpdater = <T extends { id: string }>(
    collectionKey: keyof Omit<OrganizationData, 'leaderboardSettings' | 'lastFlowViewTimestamp' | 'weeklyHighlightSettings' | 'integrationSettings' | 'clubMemberships' | 'branding'>,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    return useCallback((updater: React.SetStateAction<T[]>) => {
      setter(prevState => {
        const newState = typeof updater === 'function'
          ? (updater as (prev: T[]) => T[])(prevState)
          : updater;
        
        // Guard against using db if it's not initialized
        if (organizationId && db && !firebaseService.isOffline()) {
            const prevMap = new Map(prevState.map(item => [item.id, item]));
            const newMap = new Map(newState.map(item => [item.id, item]));
      
            const batch = db.batch();
            let hasWrites = false;
      
            for (const [id, newItem] of newMap.entries()) {
              const prevItem = prevMap.get(id);
              const { id: docId, ...itemData } = newItem as { id: string; [key: string]: any };
              const docRef = db.collection('organizations').doc(organizationId).collection(collectionKey as string).doc(docId);
              
              const sanitizedItemData = sanitizeDataForFirebase(itemData);
              
              if (!prevItem) {
                batch.set(docRef, sanitizedItemData);
                hasWrites = true;
              } else if (JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
                batch.set(docRef, sanitizedItemData, { merge: true }); 
                hasWrites = true;
              }
            }
      
            for (const [id] of prevMap.entries()) {
              if (!newMap.has(id)) {
                const docRef = db.collection('organizations').doc(organizationId).collection(collectionKey as string).doc(id);
                batch.delete(docRef);
                hasWrites = true;
              }
            }
            
            if (hasWrites) {
              batch.commit().catch(err => {
                  console.error(`Failed to commit batch for ${collectionKey}:`, err);
              });
            }
        }
        return newState;
      });
    }, [organizationId]);
  };
  
  const createCollectionUpdater = <T,>(
    collectionKey: keyof OrganizationData,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    return useCallback((updater: React.SetStateAction<T[]>) => {
      setter(prevState => {
        const updatedValue = typeof updater === 'function'
          ? (updater as (prev: T[]) => T[])(prevState)
          : updater;
        if (organizationId && !firebaseService.isOffline()) {
          firebaseService.setCollection(organizationId, collectionKey as any, updatedValue as any);
        }
        return updatedValue;
      });
    }, [organizationId, collectionKey]);
  };
  
  const createSingleDocUpdater = <T,>(
    collectionKey: keyof OrganizationData,
    setter: React.Dispatch<React.SetStateAction<T>>
  ) => {
    return useCallback((updater: React.SetStateAction<T>) => {
      setter(prevState => {
        const updatedValue = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prevState)
          : updater;
        
        if (organizationId && !firebaseService.isOffline()) {
            firebaseService.setCollection(organizationId, collectionKey as any, updatedValue as any);
        }

        return updatedValue;
      });
    }, [organizationId, collectionKey]);
  };

    const smartSetParticipantDirectory = createSmartCollectionUpdater('participantDirectory', setParticipantDirectory);
    const smartSetWorkouts = createSmartCollectionUpdater('workouts', setWorkouts);
    const smartSetWorkoutLogs = createSmartCollectionUpdater('workoutLogs', setWorkoutLogs);
    const smartSetParticipantGoals = createSmartCollectionUpdater('participantGoals', setParticipantGoals);
    const smartSetGeneralActivityLogs = createSmartCollectionUpdater('generalActivityLogs', setGeneralActivityLogs);
    const smartSetGoalCompletionLogs = createSmartCollectionUpdater('goalCompletionLogs', setGoalCompletionLogs);
    const smartSetCoachNotes = createSmartCollectionUpdater('coachNotes', setCoachNotes);
    const smartSetUserStrengthStats = createSmartCollectionUpdater('userStrengthStats', setUserStrengthStats);
    const smartSetUserConditioningStatsHistory = createSmartCollectionUpdater('userConditioningStatsHistory', setUserConditioningStatsHistory);
    const smartSetParticipantPhysiqueHistory = createSmartCollectionUpdater('participantPhysiqueHistory', setParticipantPhysiqueHistory);
    const smartSetParticipantMentalWellbeing = createSmartCollectionUpdater('participantMentalWellbeing', setParticipantMentalWellbeing);
    const smartSetParticipantGamificationStats = createSmartCollectionUpdater('participantGamificationStats', setParticipantGamificationStats);
    const smartSetClubMemberships = createCollectionUpdater('clubMemberships', setClubMemberships);
    const smartSetLeaderboardSettings = createSingleDocUpdater('leaderboardSettings', setLeaderboardSettings);
    const smartSetCoachEvents = createSmartCollectionUpdater('coachEvents', setCoachEvents);
    const smartSetConnections = createSmartCollectionUpdater('connections', setConnections);
    const smartSetLastFlowViewTimestamp = createSingleDocUpdater('lastFlowViewTimestamp', setLastFlowViewTimestamp);
    const smartSetLocations = createSmartCollectionUpdater('locations', setLocations);
    const smartSetStaffMembers = createSmartCollectionUpdater('staffMembers', setStaffMembers);
    const smartSetMemberships = createSmartCollectionUpdater('memberships', setMemberships);
    const smartSetWeeklyHighlightSettings = createSingleDocUpdater('weeklyHighlightSettings', setWeeklyHighlightSettings);
    const smartSetOneOnOneSessions = createSmartCollectionUpdater('oneOnOneSessions', setOneOnOneSessions);
    const smartSetWorkoutCategories = createSmartCollectionUpdater('workoutCategories', setWorkoutCategories);
    const smartSetStaffAvailability = createSmartCollectionUpdater('staffAvailability', setStaffAvailability);
    const smartSetIntegrationSettings = createSingleDocUpdater('integrationSettings', setIntegrationSettings);
    const smartSetGroupClassDefinitions = createSmartCollectionUpdater('groupClassDefinitions', setGroupClassDefinitions);
    const smartSetGroupClassSchedules = createSmartCollectionUpdater('groupClassSchedules', setGroupClassSchedules);
    const smartSetGroupClassScheduleExceptions = createSmartCollectionUpdater('groupClassScheduleExceptions', setGroupClassScheduleExceptions);
    const smartSetParticipantBookings = createSmartCollectionUpdater('participantBookings', setParticipantBookings);
    const smartSetLeads = createSmartCollectionUpdater('leads', setLeads);
    const smartSetProspectIntroCalls = createSmartCollectionUpdater('prospectIntroCalls', setProspectIntroCalls);
    const smartSetUserPushSubscriptions = createSmartCollectionUpdater('userPushSubscriptions', setUserPushSubscriptions);
    const smartSetNotificationLogs = createSmartCollectionUpdater('notificationLogs', setNotificationLogs);
    const smartSetBranding = createSingleDocUpdater('branding', setBranding);

    const addParticipant = useCallback(async (participant: ParticipantProfile) => {
        smartSetParticipantDirectory(prev => [...prev, participant]);
    }, [smartSetParticipantDirectory]);
    
    const updateParticipantProfile = useCallback(async (participantId: string, data: Partial<ParticipantProfile>) => {
        smartSetParticipantDirectory(prev => prev.map(p => {
            if (p.id === participantId) {
                // Create a copy of the incoming data, explicitly removing any keys with an 'undefined' value.
                // This prevents the spread operator `{ ...p, ...cleanData }` from overwriting an existing
                // value (like a photoURL) with `undefined`.
                const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
                    if (value !== undefined) {
                        (acc as any)[key as keyof ParticipantProfile] = value;
                    }
                    return acc;
                }, {} as Partial<ParticipantProfile>);
    
                return { ...p, ...cleanData, lastUpdated: new Date().toISOString() };
            }
            return p;
        }));
    }, [smartSetParticipantDirectory]);

    const updateUser = useCallback(async (userId: string, data: Partial<Omit<User, 'id'>>) => {
        if (!firebaseService.isOffline()) {
            await firebaseService.updateUser(userId, data);
        }
        setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data, id: userId } : u));
    }, []);
    
    const addWorkout = useCallback(async (workout: Workout) => {
        smartSetWorkouts(prev => sortWorkoutsByCategoryThenTitle([...prev, workout]));
    }, [smartSetWorkouts]);

    const updateWorkout = useCallback(async (workout: Workout) => {
        const { id } = workout;
        smartSetWorkouts(prev => sortWorkoutsByCategoryThenTitle(prev.map(w => w.id === id ? workout : w)));
    }, [smartSetWorkouts]);

    const deleteWorkout = useCallback(async (workoutId: string) => {
        smartSetWorkouts(prev => prev.filter(w => w.id !== workoutId));
    }, [smartSetWorkouts]);

  const sortedWorkouts = useMemo(() => sortWorkoutsByCategoryThenTitle(workouts), [workouts]);
  
  const getColorForCategory = useCallback((categoryName: string | undefined): string => {
    if (!categoryName) return "#9e9e9e"; // default gray

    const persistedMap = branding?.categoryColorMap || {};
    if (persistedMap[categoryName]) {
        return persistedMap[categoryName];
    }
    
    if (tempColorMapRef.current[categoryName]) {
        return tempColorMapRef.current[categoryName];
    }

    const isAdmin = user?.roles.systemOwner || (user?.roles.orgAdmin && user?.roles.orgAdmin.length > 0);
    
    const combinedMap = { ...persistedMap, ...tempColorMapRef.current };
    const usedColors = new Set(Object.values(combinedMap));
    const availableColors = COLOR_PALETTE.filter(c => !usedColors.has(c));
    const newColor = availableColors.length > 0 
        ? availableColors[0] 
        : COLOR_PALETTE[Object.keys(combinedMap).length % COLOR_PALETTE.length];

    tempColorMapRef.current[categoryName] = newColor;
    
    if (isAdmin && organizationId && !firebaseService.isOffline()) {
        smartSetBranding(prevBranding => {
            const latestMap = prevBranding?.categoryColorMap || {};
            if (latestMap[categoryName]) {
                return prevBranding; 
            }
            const newMap = { ...latestMap, [categoryName]: newColor };
            return { ...(prevBranding || {}), categoryColorMap: newMap };
        });
    }

    return newColor;
}, [branding, user, organizationId, smartSetBranding]);

  const value: AppContextType = {
    allOrganizations, allUsers, participantDirectory, workouts: sortedWorkouts, workoutLogs,
    participantGoals, generalActivityLogs, goalCompletionLogs, coachNotes, userStrengthStats,
    userConditioningStatsHistory, participantPhysiqueHistory, participantMentalWellbeing,
    participantGamificationStats, clubMemberships, leaderboardSettings, coachEvents,
    connections, lastFlowViewTimestamp, locations, staffMembers, memberships,
    weeklyHighlightSettings, oneOnOneSessions, workoutCategories, staffAvailability,
    integrationSettings, groupClassDefinitions, groupClassSchedules, groupClassScheduleExceptions, participantBookings,
    leads, prospectIntroCalls, userPushSubscriptions, notificationLogs, branding, isOrgDataLoading, isGlobalDataLoading,
    isOrgDataFromFallback, orgDataError, getColorForCategory, addParticipant, updateParticipantProfile,
    updateUser, addWorkout, updateWorkout, deleteWorkout,
    setParticipantDirectoryData: smartSetParticipantDirectory,
    setWorkoutLogsData: smartSetWorkoutLogs,
    setParticipantGoalsData: smartSetParticipantGoals,
    setGeneralActivityLogsData: smartSetGeneralActivityLogs,
    setGoalCompletionLogsData: smartSetGoalCompletionLogs,
    setCoachNotesData: smartSetCoachNotes,
    setUserStrengthStatsData: smartSetUserStrengthStats,
    setUserConditioningStatsHistoryData: smartSetUserConditioningStatsHistory,
    setParticipantPhysiqueHistoryData: smartSetParticipantPhysiqueHistory,
    setParticipantMentalWellbeingData: smartSetParticipantMentalWellbeing,
    setParticipantGamificationStatsData: smartSetParticipantGamificationStats,
    setClubMembershipsData: smartSetClubMemberships,
    setLeaderboardSettingsData: smartSetLeaderboardSettings,
    setCoachEventsData: smartSetCoachEvents,
    setConnectionsData: smartSetConnections,
    setLastFlowViewTimestampData: smartSetLastFlowViewTimestamp,
    setLocationsData: smartSetLocations,
    setStaffMembersData: smartSetStaffMembers,
    setMembershipsData: smartSetMemberships,
    setWeeklyHighlightSettingsData: smartSetWeeklyHighlightSettings,
    setOneOnOneSessionsData: smartSetOneOnOneSessions,
    setWorkoutCategoriesData: smartSetWorkoutCategories,
    setStaffAvailabilityData: smartSetStaffAvailability,
    setIntegrationSettingsData: smartSetIntegrationSettings,
    setGroupClassDefinitionsData: smartSetGroupClassDefinitions,
    setGroupClassSchedulesData: smartSetGroupClassSchedules,
    setGroupClassScheduleExceptionsData: smartSetGroupClassScheduleExceptions,
    setParticipantBookingsData: smartSetParticipantBookings,
    setLeadsData: smartSetLeads,
    setProspectIntroCallsData: smartSetProspectIntroCalls,
    setUserPushSubscriptionsData: smartSetUserPushSubscriptions,
    setNotificationLogsData: smartSetNotificationLogs,
    setBrandingData: smartSetBranding,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// 4. Create a custom hook for easy access
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};