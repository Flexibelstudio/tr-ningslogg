import { 
    MockDB, OrganizationData, ParticipantProfile, WorkoutLog, GeneralActivityLog, Connection, Location, 
    StaffMember, GroupClassSchedule, Membership, WorkoutCategoryDefinition, GroupClassDefinition, User
} from '../types';
// FIX: COLOR_PALETTE was missing from this import
import { LOCAL_STORAGE_KEYS, PREDEFINED_GROUP_CLASSES, PREDEFINED_MEMBERSHIPS, PREDEFINED_WORKOUT_CATEGORIES, COLOR_PALETTE } from '../constants';

export const createInitialOrgData = (orgId: string): OrganizationData => {
    const loc1Id = 'loc-1-salem';
    const loc2Id = 'loc-2-karra';
    
    const orgData: OrganizationData = {
        participantDirectory: [],
        workouts: [],
        workoutLogs: [],
        participantGoals: [],
        generalActivityLogs: [],
        goalCompletionLogs: [],
        coachNotes: [],
        userStrengthStats: [],
        userConditioningStatsHistory: [],
        participantPhysiqueHistory: [],
        participantMentalWellbeing: [],
        participantGamificationStats: [],
        clubMemberships: [],
        leaderboardSettings: { leaderboardsEnabled: true, weeklyPBChallengeEnabled: true, weeklySessionChallengeEnabled: true },
        coachEvents: [],
        connections: [],
        lastFlowViewTimestamp: null,
        locations: [
            { id: loc1Id, name: 'Salem' },
            { id: loc2Id, name: 'Kärra' },
        ],
        staffMembers: [],
        memberships: PREDEFINED_MEMBERSHIPS,
        weeklyHighlightSettings: { isEnabled: false, dayOfWeek: 1, time: '09:00', studioTarget: 'separate' },
        oneOnOneSessions: [],
        workoutCategories: PREDEFINED_WORKOUT_CATEGORIES,
        staffAvailability: [],
        integrationSettings: { 
            enableQRCodeScanning: false, 
            isBookingEnabled: true, 
            bookingLeadTimeWeeks: 2, 
            cancellationCutoffHours: 2, 
            isClientJourneyEnabled: true, 
            isScheduleEnabled: true,
            startProgramCategoryId: 'cat-pt-bas',
            startProgramSessionsRequired: 4,
            enableSessionReminders: false,
            sessionReminderHoursBefore: 2,
        },
        groupClassDefinitions: PREDEFINED_GROUP_CLASSES,
        groupClassSchedules: [],
        participantBookings: [],
        leads: [],
        prospectIntroCalls: [],
        userPushSubscriptions: [],
        branding: { categoryColorMap: {} },
    };

    // Add specific seeded data
    const p1: ParticipantProfile = {
        id: 'user-id-participant1-profile', name: 'Erik Svensson', email: 'erik@test.com', isActive: true,
        creationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), birthDate: '1989-05-15',
        gender: 'Man', bodyweightKg: 85, lastUpdated: new Date().toISOString(),
        enableLeaderboardParticipation: true, isSearchable: true, locationId: loc1Id, // Salem
        membershipId: 'membership-standard-seed',
        startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const p2: ParticipantProfile = {
        id: 'user-id-participant2-profile', name: 'Anna Andersson', email: 'anna@test.com', isActive: true,
        creationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), birthDate: '1992-08-20',
        gender: 'Kvinna', bodyweightKg: 65, lastUpdated: new Date().toISOString(),
        enableLeaderboardParticipation: true, isSearchable: true, locationId: loc2Id, // Kärra
        membershipId: 'membership-mini-seed',
        startDate: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString()
    };

    const p_sanna: ParticipantProfile = {
        id: 'user-id-admin1-profile', name: 'Sanna Admin (Medlem)', email: 'sanna.admin@flexibel.se', isActive: true,
        creationDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), birthDate: '1995-03-10',
        gender: 'Kvinna', bodyweightKg: 62, lastUpdated: new Date().toISOString(),
        enableLeaderboardParticipation: true, isSearchable: true, locationId: loc1Id, // Salem
        membershipId: 'membership-standard-seed',
        startDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
    };
    orgData.participantDirectory.push(p1, p2, p_sanna);

    // Staff
    const s1: StaffMember = { id: 'staff-1-kalle', name: 'Kalle Coach', email: 'kalle.coach@flexibel.se', role: 'Coach', locationId: loc2Id, isActive: true }; // Kärra
    const s2: StaffMember = { id: 'staff-2-sanna', name: 'Sanna Admin', email: 'sanna.admin@flexibel.se', role: 'Admin', locationId: loc1Id, isActive: true, linkedParticipantProfileId: 'user-id-admin1-profile' }; // Salem
    const s3_erik: StaffMember = { id: 'staff-3-erik', name: 'Erik Svensson (Personal)', email: 'erik@test.com', role: 'Coach', locationId: loc1Id, isActive: true, linkedParticipantProfileId: 'user-id-participant1-profile' }; // Salem
    
    orgData.staffMembers.push(s1, s2, s3_erik);

    return orgData;
};

const getInitialDB = (): MockDB => {
    const mainOrgId = 'org-flexibel';
    const mainOrgData = createInitialOrgData(mainOrgId);

    return {
        users: [
            { id: 'user-id-owner', name: 'System Owner', email: 'owner@system.com', roles: { systemOwner: true } },
            { id: 'user-id-admin1', name: 'Sanna Admin', email: 'sanna.admin@flexibel.se', roles: { orgAdmin: [mainOrgId], participant: mainOrgId }, linkedParticipantProfileId: 'user-id-admin1-profile' },
            // FIX: Erik was a staff member but lacked the orgAdmin role required for staff privileges. This aligns his user data with his staff record.
            { id: 'user-id-participant1', name: 'Erik Svensson', email: 'erik@test.com', roles: { orgAdmin: [mainOrgId], participant: mainOrgId }, linkedParticipantProfileId: 'user-id-participant1-profile' },
            { id: 'user-id-participant2', name: 'Anna Andersson', email: 'anna@test.com', roles: { participant: mainOrgId }, linkedParticipantProfileId: 'user-id-participant2-profile' },
        ],
        organizations: [
            { id: mainOrgId, name: 'Flexibel Hälsostudio' },
        ],
        organizationData: {
            [mainOrgId]: mainOrgData,
        }
    };
};


const dataService = {
    _data: null as MockDB | null,

    _loadData(): MockDB {
        if (this._data) {
            return this._data;
        }
        try {
            const rawData = localStorage.getItem(LOCAL_STORAGE_KEYS.MOCK_DB);
            if (rawData) {
                const parsedData = JSON.parse(rawData);
                // Basic check to ensure the loaded data has a structure we expect.
                if (parsedData && parsedData.users && parsedData.organizations) {
                    this._data = parsedData;
                    return this._data!;
                }
            }
        } catch (e) {
            console.error("Error loading data from localStorage, resetting to defaults.", e);
        }
        
        this._data = getInitialDB();
        this._saveData();
        return this._data;
    },
    
    _saveData() {
        if (this._data) {
            try {
                localStorage.setItem(LOCAL_STORAGE_KEYS.MOCK_DB, JSON.stringify(this._data));
            } catch (e) {
                console.error("Error saving data to localStorage", e);
            }
        }
    },
    
    get<K extends keyof MockDB>(key: K): MockDB[K] {
        return this._loadData()[key];
    },
    
    getOrgData(orgId: string): OrganizationData | undefined {
        return this._loadData().organizationData[orgId];
    },

    setOrgData(orgId: string, updater: OrganizationData | ((prev: OrganizationData) => OrganizationData)) {
        const db = this._loadData();
        const prevOrgData = db.organizationData[orgId];
        
        const newOrgData = typeof updater === 'function' 
            ? (updater as (prev: OrganizationData) => OrganizationData)(prevOrgData) 
            : updater;
        
        db.organizationData[orgId] = newOrgData;
        this._saveData();
    },

    set<K extends keyof MockDB>(key: K, updater: MockDB[K] | ((prev: MockDB[K]) => MockDB[K])) {
        const db = this._loadData();
        const prevSlice = db[key];
        
        const newSlice = typeof updater === 'function' 
            ? (updater as (prev: MockDB[K]) => MockDB[K])(prevSlice) 
            : updater;
        
        db[key] = newSlice;
        this._saveData();
    },
};

export default dataService;