/// <reference lib="dom" />
/// <reference lib="es2015" />

// Fix for `import.meta.env` TypeScript errors.
// Replaced `/// <reference types="vite/client" />` with manual declaration
// because the type definition file could not be found by the compiler.
// FIX: Wrap ambient type declarations in `declare global` to make them available globally.
declare global {
  interface ImportMetaEnv {
      readonly VITE_FB_API_KEY: string | undefined;
      readonly VITE_FB_AUTH_DOMAIN: string | undefined;
      readonly VITE_FB_PROJECT_ID: string | undefined;
      readonly VITE_FB_STORAGE_BUCKET: string | undefined;
      readonly VITE_FB_MESSAGING_SENDER_ID: string | undefined;
      readonly VITE_FB_APP_ID: string | undefined;
      readonly VITE_FB_MEASUREMENT_ID?: string;
      readonly DEV: boolean;
      readonly PROD: boolean;
    }
    
    interface ImportMeta {
      readonly env: ImportMetaEnv;
    }

    // FIX: Add minimal EventTarget definition to resolve issues where DOM libs are not available.
    interface EventTarget {
      addEventListener(type: string, listener: any): void;
      removeEventListener(type: string, listener: any): void;
      dispatchEvent(event: any): boolean;
    }

    // FIX: Added WakeLockSentinel interface definition to global scope.
    interface WakeLockSentinel extends EventTarget {
      release(): Promise<void>;
      // FIX: Added readonly modifier to fix "All declarations of 'type' must have identical modifiers" error.
      readonly released: boolean;
      readonly type: "screen";
    }
}
  
// --- New: Notification System Types ---
export interface Notification {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  createdAt: Date;
  autoDismiss?: boolean;
}

export interface AnalyticsEvent {
    id: string;
    type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "CHECKIN" | "WAITLIST_PROMOTION";
    timestamp: any; // Firestore Timestamp
    orgId: string;
    [key: string]: any;
}

// --- Core Multi-Tenant Types ---
export interface User {
  id: string;
  name: string;
  email: string;
  roles: {
    systemOwner?: boolean;
    orgAdmin?: string[]; // Array of organization IDs
    participant?: string; // Participant is only in one org
  };
  linkedParticipantProfileId?: string;
  termsAcceptedTimestamp?: string;
}

export interface Organization {
  id: string;
  name: string;
}

// Represents the entire database stored in localStorage
export interface MockDB {
    users: User[];
    organizations: Organization[];
    organizationData: Record<string, OrganizationData>; // Keyed by organization ID
}


// --- Organization-Specific Data Types (Previously AppData) ---

export type BookingStatus = 'BOOKED' | 'WAITLISTED' | 'CANCELLED' | 'CHECKED-IN';

export interface GroupClassDefinition {
  id: string;
  name: string;
  description?: string;
  defaultDurationMinutes?: number;
  hasWaitlist?: boolean;
  color?: string;
}

export interface GroupClassSchedule {
  id: string;
  locationId: string;
  groupClassId: string;
  coachId: string;
  daysOfWeek: number[]; // 1 (Mon) - 7 (Sun)
  startTime: string; // "HH:MM"
  durationMinutes: number;
  maxParticipants: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  hasWaitlist?: boolean;
}

export interface GroupClassScheduleException {
  id: string;
  scheduleId: string; // FK to GroupClassSchedule.id
  date: string; // YYYY-MM-DD of the cancelled instance
  createdBy?: { uid: string; name: string };
  createdAt: string; // ISO string
}

export interface ParticipantBooking {
  id: string;
  participantId: string;
  scheduleId: string; // GroupClassSchedule.id
  classDate: string; // YYYY-MM-DD
  bookingDate: string; // ISO string
  status: BookingStatus;
  reminderTaskId?: string;
  cancelReason?: 'coach_cancelled' | 'participant_cancelled';
}

export interface OneOnOneSessionType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export interface OneOnOneSession {
  id: string;
  participantId: string;
  coachId: string; // StaffMember.id
  title: string;
  purpose: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  status: 'scheduled' | 'completed' | 'cancelled';
  coachNotes?: string;
  comments?: Comment[];
}

export interface WeeklyHighlightSettings {
  isEnabled: boolean;
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  time: string; // "HH:MM"
  studioTarget: 'all' | 'salem' | 'karra' | 'separate';
  lastGeneratedTimestamp?: string; // ISO string
}

export type WorkoutCategory = string;
export interface WorkoutCategoryDefinition {
  id: string;
  name: string;
}
export type LoggableMetric = 'reps' | 'weight' | 'distance' | 'duration' | 'calories';

export interface Exercise {
  id: string;
  name: string;
  notes: string; // General instructions, e.g. "Focus on technique"
  
  // New target fields for workout programming
  targetSets?: number | string;
  targetReps?: string; // e.g. "8-12", "AMRAP"
  targetWeight?: string; // e.g. "80kg", "7 RPE", "Bodyweight"
  targetDistanceMeters?: number | string;
  targetDurationSeconds?: number | string;
  targetCaloriesKcal?: number | string;
  targetRestSeconds?: string; // e.g. "60-90s"

  baseLiftType?: LiftType; 
  supersetIdentifier?: string; 
  isBodyweight?: boolean; 
  loggableMetrics?: LoggableMetric[];
}

export interface WorkoutBlock {
  id: string;
  name?: string; // Optional name for the block, e.g., "Block A", "Warm-up"
  exercises: Exercise[];
  isQuickLogEnabled?: boolean; // New: To enable quick round logging for finishers/AMRAPs
}

export type WorkoutFocusTag = 
  'Styrka' | 
  'Hypertrofi' | 
  'Kondition' | 
  'HIIT' | 
  'Rörlighet' | 
  'Återhämtning' | 
  'Teknik';

export interface Workout {
  id: string;
  title: string;
  blocks: WorkoutBlock[];
  isPublished: boolean;
  category: WorkoutCategory;
  coachNote?: string;
  aiInstruction?: string; // Instruction for AI on how to give feedback. Invisible to participant.
  focusTags?: WorkoutFocusTag[]; // Tags for better AI recommendations.
  isModifiable?: boolean;
  exerciseSelectionOptions?: {
    list: LiftType[];
    maxSelect: number;
    instructions?: string;
  };
  assignedToParticipantId?: string;
  intensityLevel?: number;
  intensityInstructions?: string;
}

export interface SetDetail {
  id: string; // For React key and removal
  reps?: number | string; // Now optional
  weight?: number | string;
  distanceMeters?: number | string; // New
  durationSeconds?: number | string; // New
  caloriesKcal?: number | string; // New
  isCompleted?: boolean; // New field to mark set as completed
}

export interface WorkoutExerciseLog {
 exerciseId: string;
 loggedSets: SetDetail[];
 // Optional old fields for migration purposes. New logs should only use loggedSets.
 sets?: number | string;
 reps?: number | string;
 weight?: number | string;
}

export interface NewPB {
  exerciseName: string;
  achievement: string; // e.g., "Nytt PB i vikt!", "Flest reps på X kg"
  value: string; // e.g., "100 kg", "12 reps @ 50 kg"
  previousBest?: string; // e.g. " (tidigare 95 kg)"
  baseLiftType?: LiftType;
}

export interface NewBaseline {
  exerciseName: string;
  value: string; // e.g. "100 kg x 8 reps"
}

export interface WeightComparisonItem { // Renamed from AnimalWeight
  name: string;
  pluralName?: string; 
  weightKg: number;
  emoji?: string;
  imageUrl?: string; 
  article?: 'en' | 'ett';
}

export interface PostWorkoutSummaryData {
  totalWeightLifted: number; 
  totalDistanceMeters?: number; // New
  totalDurationSeconds?: number; // New
  totalCaloriesKcal?: number; // New
  animalEquivalent?: { 
    name: string;
    count: number;
    unitName: string; 
    emoji?: string;
    article?: 'en' | 'ett';
  };
  newPBs: NewPB[];
  newBaselines?: NewBaseline[];
  bodyweightRepsSummary?: {
    exerciseName: string;
    totalReps: number;
  }[];
  weightOnlyAchievements?: {
    exerciseName: string;
    weight: number;
  }[];
  volumeDifferenceVsPrevious?: number;
  isFirstTimeLoggingWorkout?: boolean;
}

export interface Reaction {
  participantId: string;
  emoji: string;
  createdDate: string; // ISO string
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdDate: string; // ISO string
  reactions?: Reaction[]; // New for likes feature
}

export interface WorkoutLog {
  // FIX: Make 'type' property readonly to prevent accidental modification.
  readonly type: 'workout'; // Discriminating property
  id: string; // Unique ID for the log itself
  workoutId: string; // Pekar på Workout-mallens ID
  participantId: string; // For future use, MVP is anonymous
  entries: WorkoutExerciseLog[];
  completedDate: string; // ISO string
  postWorkoutComment?: string;
  postWorkoutSummary?: PostWorkoutSummaryData; 
  moodRating?: number; // Optional: 1-5 scale
  selectedExercisesForModifiable?: Exercise[]; 
  reactions?: Reaction[];
  comments?: Comment[]; // New for comments feature
}

export interface GeneralActivityLog {
  // FIX: Make 'type' property readonly to prevent accidental modification.
  readonly type: 'general'; // Discriminating property
  id: string;
  participantId: string;
  activityName: string;
  durationMinutes: number;
  caloriesBurned?: number;
  distanceKm?: number;
  comment?: string;
  completedDate: string; // ISO string
  moodRating?: number; // Optional: 1-5 scale
  reactions?: Reaction[];
  comments?: Comment[]; // New for comments feature
}

export interface GoalCompletionLog {
  // FIX: Make 'type' property readonly to prevent accidental modification.
  readonly type: 'goal_completion'; // Discriminating property
  id: string;
  participantId: string;
  goalId: string;
  goalDescription: string;
  completedDate: string; // ISO string
  moodRating?: undefined; // To make it compatible with ActivityLog but not used
  reactions?: Reaction[];
  comments?: Comment[];
}

export type ActivityLog = WorkoutLog | GeneralActivityLog | GoalCompletionLog;

export type FlowItemLogType = 'workout' | 'general' | 'coach_event' | 'one_on_one_session' | 'goal_completion' | 'participant_club_membership' | 'user_strength_stat' | 'participant_physique_stat' | 'participant_goal_data' | 'participant_conditioning_stat';

export interface InProgressWorkout {
  participantId: string;
  workoutId: string;
  workoutTitle: string;
  startedAt: string; // ISO string
  // FIX: Ensure 'logEntries' is correctly typed as an array of tuples.
  logEntries: [string, SetDetail[]][]; // Serialized Map
  postWorkoutComment?: string;
  moodRating?: number | null;
  selectedExercisesForModifiable?: Exercise[];
}

export interface ParticipantWorkoutNote {
  workoutId: string;
  note: string;
  lastUpdated: string; // ISO string
}

export enum UserRole {
  COACH = 'coach',
  PARTICIPANT = 'participant',
  SYSTEM_OWNER = 'system_owner' // New role for multi-tenant
}

export type GenderOption = 'Man' | 'Kvinna' | '-';

export interface ParticipantProfile {
  id: string; 
  name?: string;
  email?: string;
  photoURL?: string;
  isActive?: boolean;
  // FIX: Add missing 'isProspect' property to track new/potential members.
  isProspect?: boolean;
  creationDate?: string;
  birthDate?: string; // New: YYYY-MM-DD
  age?: string; // Legacy: For fallback only
  gender?: GenderOption;
  bodyweightKg?: number;
  muscleMassKg?: number; 
  fatMassKg?: number;    
  inbodyScore?: number;  
  lastUpdated: string; // ISO string
  enableLeaderboardParticipation?: boolean;
  enableInBodySharing?: boolean;
  enableFssSharing?: boolean;
  isSearchable?: boolean; // New: For friend feature
  shareMyBookings?: boolean; // New: For sharing bookings with friends
  receiveFriendBookingNotifications?: boolean; // New: For receiving notifications about friends' bookings
  notificationSettings?: {
    pushEnabled: boolean;
    waitlistPromotion: boolean;
    sessionReminder: boolean;
    classCancellation: boolean;
  };
  locationId?: string; // FK to Location.id
  membershipId?: string; // FK to Membership.id
  startDate?: string; // ISO date string YYYY-MM-DD
  endDate?: string; // ISO date string YYYY-MM-DD
  clipCardStatus?: {
    remainingClips: number;
    expiryDate?: string; // ISO date string YYYY-MM-DD. If not present, it doesn't expire.
  };
  approvalStatus?: 'pending' | 'approved' | 'declined';
}

export interface ParticipantPhysiqueStat {
  id: string;
  participantId: string;
  bodyweightKg?: number;
  muscleMassKg?: number; 
  fatMassKg?: number;    
  inbodyScore?: number;  
  lastUpdated: string; // ISO string
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface CoachNote {
  id: string;
  participantId: string;
  noteText: string;
  createdDate: string; // ISO string
  noteType: 'check-in' | 'intro-session'; 
}

export type LeadStatus = 'new' | 'contacted' | 'intro_booked' | 'converted' | 'junk';
export type ContactAttemptMethod = 'phone' | 'email' | 'sms';
export type ContactAttemptOutcome = 'booked_intro' | 'not_interested' | 'no_answer' | 'left_voicemail' | 'follow_up';

export interface ContactAttempt {
  id: string;
  timestamp: string; // ISO-datum
  method: ContactAttemptMethod;
  outcome: ContactAttemptOutcome;
  notes?: string; // Fritext för coachen
  coachId: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  locationId: string;
  source: 'Hemsida' | 'Meta' | 'Manuell' | 'Rekommendation';
  createdDate: string; // ISO string
  status: LeadStatus;
  contactHistory?: ContactAttempt[];
  // New fields for recommendation feature
  referredBy?: {
    participantId: string;
    participantName: string;
  };
  consentGiven?: boolean;
}

export interface ProspectIntroCall {
  id: string;
  prospectName: string;
  prospectEmail?: string;
  prospectPhone?: string;
  createdDate: string; // ISO string
  coachId: string;
  linkedLeadId?: string; // To link back to the originating lead

  // New fields from the form
  studioId?: string;
  referralSource?: string;

  trainingGoals?: string; // Fråga 1
  timingNotes?: string; // Fråga 2
  engagementLevel?: number; // Fråga 3A (1-10)
  engagementReason?: string; // Fråga 3B
  
  sleepAndStress?: string; // Fråga 4a & 4b combined
  
  isSickListed?: boolean; // Fråga 5
  
  healthIssues?: string; // Fråga 6 & 7 combined
  
  whyNeedHelp?: string; // Fråga 8

  coachSummary?: string;
  
  // Status to handle linking later
  status: 'unlinked' | 'linked';
  linkedParticipantId?: string; // Filled when the link is made

  // New: For call outcome
  outcome?: 'bought_starter' | 'bought_other' | 'thinking' | 'not_interested';
  tshirtHandedOut?: boolean;
}

export interface ParticipantGoalData {
  id: string; 
  participantId: string;
  fitnessGoals: string;
  workoutsPerWeekTarget: number; 
  currentWeeklyStreak: number; 
  lastStreakUpdateEpochWeekId: string; 
  preferences?: string; 
  setDate: string; // ISO string for when this goal was set/updated
  targetDate?: string; // ISO string for when the goal is targeted to be achieved
  isCompleted?: boolean; 
  completedDate?: string; 
  aiPrognosis?: string; // New: To store the AI-generated prognosis and recommendations
  coachPrescription?: string; // New: To store the coach's recommendation for the goal period
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface ParticipantGamificationStats {
  id: string; // Corresponds to participantId
  longestStreakWeeks: number;
  lastUpdated: string; // ISO string
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
}

// Types for Strength Standards Feature
export type StrengthLevel = 'Startklar' | 'På gång' | 'Stark' | 'Stabil' | 'Imponerande' | 'Toppform';
export type LiftType = 
  'Knäböj' | 
  'Bänkpress' | 
  'Marklyft' | 
  'Axelpress' |
  'Chins / Pullups' |
  'Frontböj' |
  'Clean' | // Frivändning
  'Bulgarian Split Squat' |
  'RDL' | // Rumänska marklyft
  'Farmer’s Walk' |
  'Snatch Grip Deadlift' | // Ryckmarklyft
  'Clean & Press' | // Frivändning med Press/Stöt
  'Push Press' |
  'Hantelrodd' |
  'Goblet Squat' |
  'Thrusters' |
  'Stående Rodd';

export interface StrengthStandardDetail {
  level: StrengthLevel;
  weightKg: number; // 1RM for this level
}

export interface StrengthStandard {
  lift: LiftType;
  gender: 'Man' | 'Kvinna'; 
  bodyweightCategoryKg: { min: number; max: number }; 
  standards: StrengthStandardDetail[]; 
}

export interface UserStrengthStat {
  id: string;
  participantId: string;
  bodyweightKg?: number;
  squat1RMaxKg?: number;
  benchPress1RMaxKg?: number;
  deadlift1RMaxKg?: number;
  overheadPress1RMaxKg?: number; // Added Axelpress
  lastUpdated: string; // ISO string
  reactions?: Reaction[];
  comments?: Comment[];
}

// Types for User-Provided Strength Multipliers
interface AgeAdjustment {
  [ageRange: string]: number; // e.g., "30-39": 0.95
}
interface GenderStrengthMultipliers {
  bas: number[]; // Array of 5 multipliers for the 5 strength levels
  justering: AgeAdjustment;
}
export interface UserProvidedLiftMultipliers {
  män: GenderStrengthMultipliers;
  kvinnor: GenderStrengthMultipliers;
}
export interface AllUserProvidedStrengthMultipliers {
  knäböj: UserProvidedLiftMultipliers;
  marklyft: UserProvidedLiftMultipliers;
  bänkpress: UserProvidedLiftMultipliers;
  axelpress: UserProvidedLiftMultipliers; 
  // Note: New LiftTypes are not added here as they don't have separate primary strength standard calculations
}

export type ConditioningMetric = 'airbike4MinKcal' | 'skierg4MinMeters' | 'rower2000mTimeSeconds' | 'rower4MinMeters' | 'treadmill4MinMeters';

export interface ParticipantConditioningStat {
    id: string; // unique id for this measurement entry
    participantId: string;
    airbike4MinKcal?: number;
    skierg4MinMeters?: number;
    rower4MinMeters?: number;
    rower2000mTimeSeconds?: number;
    treadmill4MinMeters?: number;
    lastUpdated: string; // ISO string
    reactions?: Reaction[];
    comments?: Comment[];
}

export interface ParticipantMentalWellbeing {
  id: string; 
  participantId: string;
  stressLevel?: number;    
  energyLevel?: number;    
  sleepQuality?: number;   
  overallMood?: number;    
  lastUpdated: string;     
}

// Leaderboard Types
export interface ClubDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  // FIX: Make 'type' property readonly.
  readonly type: 'LIFT' | 'SESSION_COUNT' | 'BODYWEIGHT_LIFT' | 'CONDITIONING' | 'TOTAL_VOLUME';
  liftType?: LiftType;
  threshold?: number;
  multiplier?: number;
  conditioningMetric?: ConditioningMetric;
  comparison?: 'GREATER_OR_EQUAL' | 'LESS_OR_EQUAL';
}

export interface ParticipantClubMembership {
  id: string;
  clubId: string;
  participantId: string;
  achievedDate: string;
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface LeaderboardSettings {
    leaderboardsEnabled: boolean;
    weeklyPBChallengeEnabled: boolean;
    weeklySessionChallengeEnabled: boolean;
}

export interface CoachEvent {
  id: string;
  title: string;
  description?: string;
  // FIX: Make 'type' property readonly.
  readonly type: 'event' | 'news';
  eventDate?: string; // ISO string for the date, optional for news
  createdDate: string; // ISO string for when the item was created
  studioTarget: 'all' | 'salem' | 'karra';
  targetParticipantIds?: string[];
  linkUrl?: string;
  linkButtonText?: string;
  reactions?: Reaction[];
  comments?: Comment[];
}

// New: For Friend feature
export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdDate: string; // ISO string
}

// New: For Settings
export interface Location {
  id: string;
  name: string;
}

export interface Membership {
  id: string;
  name: string;
  description?: string;

  // New: Differentiator
  // FIX: Make 'type' property readonly.
  readonly type?: 'subscription' | 'clip_card';

  // Clip Card-specific
  clipCardClips?: number;
  clipCardValidityDays?: number; // e.g., 90. If null/undefined, it's unlimited.
  
  // Unified blacklist for all membership types
  restrictedCategories?: WorkoutCategory[];
}

export interface IntegrationSettings {
  enableQRCodeScanning: boolean;
  isBookingEnabled: boolean;
  bookingLeadTimeWeeks?: number;
  cancellationCutoffHours?: number;
  isClientJourneyEnabled?: boolean;
  isScheduleEnabled?: boolean;
  // FIX: Add missing properties to support the start program feature.
  startProgramCategoryId?: string;
  startProgramSessionsRequired?: number;
  enableSessionReminders?: boolean;
  sessionReminderHoursBefore?: number;
}

// New: For Staff Management
export type StaffRole = 'Coach' | 'Admin';

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role: StaffRole;
  locationId: string; // FK to Location.id
  isActive: boolean;
  startDate?: string; // ISO date string YYYY-MM-DD
  endDate?: string; // ISO date string YYYY-MM-DD
  linkedParticipantProfileId?: string;
}

// New: For Staff Availability
export interface StaffAvailability {
  id: string;
  staffId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  // FIX: Make 'type' property readonly.
  readonly type: 'available' | 'unavailable';
  isRecurring?: boolean;
  recurringDetails?: {
    daysOfWeek: number[]; // 1 (Mon) - 7 (Sun)
    recurringEndDate?: string; // ISO string
  };
}

export interface BrandingSettings {
  logoBase64?: string;
  categoryColorMap?: Record<string, string>;
}

// New: For Push Notifications
export interface UserPushSubscription {
    id: string; // doc id
    participantId: string;
    subscription: PushSubscriptionJSON; // Store the JSON representation
}

export interface OrganizationData {
  participantDirectory: ParticipantProfile[];
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  participantGoals: ParticipantGoalData[];
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  coachNotes: CoachNote[];
  userStrengthStats: UserStrengthStat[];
  userConditioningStatsHistory: ParticipantConditioningStat[];
  participantPhysiqueHistory: ParticipantPhysiqueStat[];
  participantMentalWellbeing: ParticipantMentalWellbeing[];
  participantGamificationStats: ParticipantGamificationStats[];
  clubMemberships: ParticipantClubMembership[];
  leaderboardSettings: LeaderboardSettings;
  coachEvents: CoachEvent[];
  connections: Connection[];
  lastFlowViewTimestamp: string | null;
  locations: Location[];
  staffMembers: StaffMember[];
  memberships: Membership[];
  weeklyHighlightSettings: WeeklyHighlightSettings;
  oneOnOneSessions: OneOnOneSession[];
  workoutCategories: WorkoutCategoryDefinition[];
  staffAvailability: StaffAvailability[];
  integrationSettings: IntegrationSettings;
  groupClassDefinitions: GroupClassDefinition[];
  groupClassSchedules: GroupClassSchedule[];
  groupClassScheduleExceptions: GroupClassScheduleException[];
  participantBookings: ParticipantBooking[];
  leads: Lead[];
  prospectIntroCalls: ProspectIntroCall[];
  userPushSubscriptions: UserPushSubscription[];
  branding?: BrandingSettings;
}

export type AppData = OrganizationData;