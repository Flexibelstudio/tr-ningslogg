import React, { useState, useCallback, createContext, useContext, ReactNode, useEffect, useMemo } from 'react';
import { 
    Organization,
    OrganizationData, ParticipantProfile, Workout, WorkoutLog, ParticipantGoalData, 
    GeneralActivityLog, GoalCompletionLog, CoachNote, UserStrengthStat, 
    ParticipantConditioningStat, ParticipantPhysiqueStat, ParticipantMentalWellbeing, 
    ParticipantGamificationStats, ParticipantClubMembership, LeaderboardSettings, 
    CoachEvent, Connection, Location, StaffMember, Membership, 
    WeeklyHighlightSettings, OneOnOneSession, WorkoutCategoryDefinition, 
    StaffAvailability, IntegrationSettings, GroupClassDefinition, 
    GroupClassSchedule, ParticipantBooking, AppData
} from '../types';
import firebaseService from '../services/firebaseService'; // Use the new service
import { useAuth } from './AuthContext';

// 1. Define the shape of the context value
interface AppContextType extends OrganizationData {
  allOrganizations: Organization[];
  // Updater for a single participant document
  updateParticipantProfile: (participantId: string, data: Partial<ParticipantProfile>) => Promise<void>;
  // All updater functions
  setParticipantDirectoryData: (updater: React.SetStateAction<AppData['participantDirectory']>) => void;
  setWorkoutsData: (updater: React.SetStateAction<AppData['workouts']>) => void;
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
  setParticipantBookingsData: (updater: React.SetStateAction<AppData['participantBookings']>) => void;
}

// 2. Create the context with a default value (or undefined and check for it)
const AppContext = createContext<AppContextType | undefined>(undefined);

// 3. Create the Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { organizationId } = useAuth();
    
    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
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
    const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({ enableQRCodeScanning: false, isBookingEnabled: false });
    const [groupClassDefinitions, setGroupClassDefinitions] = useState<GroupClassDefinition[]>([]);
    const [groupClassSchedules, setGroupClassSchedules] = useState<GroupClassSchedule[]>([]);
    const [participantBookings, setParticipantBookings] = useState<ParticipantBooking[]>([]);

    useEffect(() => {
        const fetchOrgs = async () => {
            const orgs = await firebaseService.get('organizations');
            setAllOrganizations(orgs);
        };
        fetchOrgs();
    }, []);

    // Effect to load all data when organizationId changes
    useEffect(() => {
        if (organizationId) {
            const loadAllData = async () => {
                const [
                    pDir, wrkts, wLogs, pGoals, gaLogs, gcLogs, cNotes, usStats, ucsHist, ppHist,
                    pmWellbeing, pgStats, cMemberships, lSettings, cEvents, conns, lfvt, locs,
                    sMembers, membs, whs, oooSessions, wc, sa, iSettings, gcd, gcs, pBookings
                ] = await Promise.all([
                    firebaseService.getCollection(organizationId, 'participantDirectory'),
                    firebaseService.getCollection(organizationId, 'workouts'),
                    firebaseService.getCollection(organizationId, 'workoutLogs'),
                    firebaseService.getCollection(organizationId, 'participantGoals'),
                    firebaseService.getCollection(organizationId, 'generalActivityLogs'),
                    firebaseService.getCollection(organizationId, 'goalCompletionLogs'),
                    firebaseService.getCollection(organizationId, 'coachNotes'),
                    firebaseService.getCollection(organizationId, 'userStrengthStats'),
                    firebaseService.getCollection(organizationId, 'userConditioningStatsHistory'),
                    firebaseService.getCollection(organizationId, 'participantPhysiqueHistory'),
                    firebaseService.getCollection(organizationId, 'participantMentalWellbeing'),
                    firebaseService.getCollection(organizationId, 'participantGamificationStats'),
                    firebaseService.getCollection(organizationId, 'clubMemberships'),
                    firebaseService.getCollection(organizationId, 'leaderboardSettings'),
                    firebaseService.getCollection(organizationId, 'coachEvents'),
                    firebaseService.getCollection(organizationId, 'connections'),
                    firebaseService.getCollection(organizationId, 'lastFlowViewTimestamp'),
                    firebaseService.getCollection(organizationId, 'locations'),
                    firebaseService.getCollection(organizationId, 'staffMembers'),
                    firebaseService.getCollection(organizationId, 'memberships'),
                    firebaseService.getCollection(organizationId, 'weeklyHighlightSettings'),
                    firebaseService.getCollection(organizationId, 'oneOnOneSessions'),
                    firebaseService.getCollection(organizationId, 'workoutCategories'),
                    firebaseService.getCollection(organizationId, 'staffAvailability'),
                    firebaseService.getCollection(organizationId, 'integrationSettings'),
                    firebaseService.getCollection(organizationId, 'groupClassDefinitions'),
                    firebaseService.getCollection(organizationId, 'groupClassSchedules'),
                    firebaseService.getCollection(organizationId, 'participantBookings'),
                ]);

                setParticipantDirectory(pDir); setWorkouts(wrkts); setWorkoutLogs(wLogs);
                setParticipantGoals(pGoals); setGeneralActivityLogs(gaLogs); setGoalCompletionLogs(gcLogs);
                setCoachNotes(cNotes); setUserStrengthStats(usStats); setUserConditioningStatsHistory(ucsHist);
                setParticipantPhysiqueHistory(ppHist); setParticipantMentalWellbeing(pmWellbeing);
                setParticipantGamificationStats(pgStats); setClubMemberships(cMemberships);
                setLeaderboardSettings(lSettings as LeaderboardSettings); setCoachEvents(cEvents);
                setConnections(conns); setLastFlowViewTimestamp(lfvt as string | null); setLocations(locs);
                setStaffMembers(sMembers); setMemberships(membs); setWeeklyHighlightSettings(whs as WeeklyHighlightSettings);
                setOneOnOneSessions(oooSessions); setWorkoutCategories(wc); setStaffAvailability(sa);
                setIntegrationSettings(iSettings as IntegrationSettings); setGroupClassDefinitions(gcd);
                setGroupClassSchedules(gcs); setParticipantBookings(pBookings);
            };
            loadAllData();
        } else {
            // Clear all data if no organizationId
            setParticipantDirectory([]); setWorkouts([]); setWorkoutLogs([]); setParticipantGoals([]);
            setGeneralActivityLogs([]); setGoalCompletionLogs([]); setCoachNotes([]); setUserStrengthStats([]);
            setUserConditioningStatsHistory([]); setParticipantPhysiqueHistory([]); setParticipantMentalWellbeing([]);
            setParticipantGamificationStats([]); setClubMemberships([]);
            setLeaderboardSettings({ leaderboardsEnabled: false, weeklyPBChallengeEnabled: false, weeklySessionChallengeEnabled: false });
            setCoachEvents([]); setConnections([]); setLastFlowViewTimestamp(null); setLocations([]);
            setStaffMembers([]); setMemberships([]);
            setWeeklyHighlightSettings({ isEnabled: false, dayOfWeek: 1, time: '09:00', studioTarget: 'separate' });
            setOneOnOneSessions([]); setWorkoutCategories([]); setStaffAvailability([]);
            setIntegrationSettings({ enableQRCodeScanning: false, isBookingEnabled: false });
            setGroupClassDefinitions([]); setGroupClassSchedules([]); setParticipantBookings([]);
        }
    }, [organizationId]);

    // This factory creates updater functions that update both local state and persist to the service.
    const createAndPersistUpdater = useCallback(<T,>(
        stateSetter: React.Dispatch<React.SetStateAction<T>>,
        collectionKey: keyof OrganizationData
    ) => {
        return (updater: React.SetStateAction<T>) => {
            if (!organizationId) return;

            stateSetter(prevState => {
                const newState = typeof updater === 'function' ? (updater as (prev: T) => T)(prevState) : updater;
                firebaseService.setCollection(organizationId, collectionKey, newState as any);
                return newState;
            });
        };
    }, [organizationId]);

    const updateParticipantProfile = useCallback(async (participantId: string, data: Partial<ParticipantProfile>) => {
        if (!organizationId) return;
    
        // Prepare data for persistence. Empty strings mean "delete".
        const updatePayload: { [key: string]: any } = { ...data };
        for (const key in updatePayload) {
            if (updatePayload[key as keyof typeof updatePayload] === '') {
                // Use null as a sentinel value that the service layer understands means "delete".
                updatePayload[key] = null; 
            }
        }
        
        const dataWithTimestamp = { ...updatePayload, lastUpdated: new Date().toISOString() };
    
        // Optimistically update local state.
        setParticipantDirectory(prev =>
            prev.map(p => {
                if (p.id === participantId) {
                    const updatedProfile = { ...p, ...dataWithTimestamp };
                    // After spreading, properties that were set to null should be deleted
                    // to truly remove them from the object for local state consistency.
                    for (const key in updatedProfile) {
                        if (updatedProfile[key as keyof typeof updatedProfile] === null) {
                            delete updatedProfile[key as keyof typeof updatedProfile];
                        }
                    }
                    return updatedProfile;
                }
                return p;
            })
        );
    
        try {
            await firebaseService.updateDocInOrg(organizationId, 'participantDirectory', participantId, updatePayload);
        } catch (error) {
            console.error("Failed to update profile, attempting to revert state.", error);
            // Revert on failure by refetching the single source of truth
            const originalData = await firebaseService.getCollection(organizationId, 'participantDirectory');
            setParticipantDirectory(originalData);
            throw error;
        }
    }, [organizationId]);


    const contextValue = useMemo(() => ({
        participantDirectory, workouts, workoutLogs, participantGoals, generalActivityLogs, goalCompletionLogs,
        coachNotes, userStrengthStats, userConditioningStatsHistory, participantPhysiqueHistory,
        participantMentalWellbeing, participantGamificationStats, clubMemberships, leaderboardSettings,
        coachEvents, connections, lastFlowViewTimestamp, locations, staffMembers, memberships,
        weeklyHighlightSettings, oneOnOneSessions, workoutCategories, staffAvailability, integrationSettings,
        groupClassDefinitions, groupClassSchedules, participantBookings,
        allOrganizations,
        updateParticipantProfile,
        setParticipantDirectoryData: createAndPersistUpdater(setParticipantDirectory, 'participantDirectory'),
        setWorkoutsData: createAndPersistUpdater(setWorkouts, 'workouts'),
        setWorkoutLogsData: createAndPersistUpdater(setWorkoutLogs, 'workoutLogs'),
        setParticipantGoalsData: createAndPersistUpdater(setParticipantGoals, 'participantGoals'),
        setGeneralActivityLogsData: createAndPersistUpdater(setGeneralActivityLogs, 'generalActivityLogs'),
        setGoalCompletionLogsData: createAndPersistUpdater(setGoalCompletionLogs, 'goalCompletionLogs'),
        setCoachNotesData: createAndPersistUpdater(setCoachNotes, 'coachNotes'),
        setUserStrengthStatsData: createAndPersistUpdater(setUserStrengthStats, 'userStrengthStats'),
        setUserConditioningStatsHistoryData: createAndPersistUpdater(setUserConditioningStatsHistory, 'userConditioningStatsHistory'),
        setParticipantPhysiqueHistoryData: createAndPersistUpdater(setParticipantPhysiqueHistory, 'participantPhysiqueHistory'),
        setParticipantMentalWellbeingData: createAndPersistUpdater(setParticipantMentalWellbeing, 'participantMentalWellbeing'),
        setParticipantGamificationStatsData: createAndPersistUpdater(setParticipantGamificationStats, 'participantGamificationStats'),
        setClubMembershipsData: createAndPersistUpdater(setClubMemberships, 'clubMemberships'),
        setLeaderboardSettingsData: createAndPersistUpdater(setLeaderboardSettings, 'leaderboardSettings'),
        setCoachEventsData: createAndPersistUpdater(setCoachEvents, 'coachEvents'),
        setConnectionsData: createAndPersistUpdater(setConnections, 'connections'),
        setLastFlowViewTimestampData: createAndPersistUpdater(setLastFlowViewTimestamp, 'lastFlowViewTimestamp'),
        setLocationsData: createAndPersistUpdater(setLocations, 'locations'),
        setStaffMembersData: createAndPersistUpdater(setStaffMembers, 'staffMembers'),
        setMembershipsData: createAndPersistUpdater(setMemberships, 'memberships'),
        setWeeklyHighlightSettingsData: createAndPersistUpdater(setWeeklyHighlightSettings, 'weeklyHighlightSettings'),
        setOneOnOneSessionsData: createAndPersistUpdater(setOneOnOneSessions, 'oneOnOneSessions'),
        setWorkoutCategoriesData: createAndPersistUpdater(setWorkoutCategories, 'workoutCategories'),
        setStaffAvailabilityData: createAndPersistUpdater(setStaffAvailability, 'staffAvailability'),
        setIntegrationSettingsData: createAndPersistUpdater(setIntegrationSettings, 'integrationSettings'),
        setGroupClassDefinitionsData: createAndPersistUpdater(setGroupClassDefinitions, 'groupClassDefinitions'),
        setGroupClassSchedulesData: createAndPersistUpdater(setGroupClassSchedules, 'groupClassSchedules'),
        setParticipantBookingsData: createAndPersistUpdater(setParticipantBookings, 'participantBookings'),
    }), [
        participantDirectory, workouts, workoutLogs, participantGoals, generalActivityLogs, goalCompletionLogs,
        coachNotes, userStrengthStats, userConditioningStatsHistory, participantPhysiqueHistory,
        participantMentalWellbeing, participantGamificationStats, clubMemberships, leaderboardSettings,
        coachEvents, connections, lastFlowViewTimestamp, locations, staffMembers, memberships,
        weeklyHighlightSettings, oneOnOneSessions, workoutCategories, staffAvailability, integrationSettings,
        groupClassDefinitions, groupClassSchedules, participantBookings, createAndPersistUpdater,
        allOrganizations, updateParticipantProfile
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

// 4. Create the custom hook for easy consumption
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};