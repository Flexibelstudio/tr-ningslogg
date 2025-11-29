
import { Comment, Reaction } from './shared';

export type WorkoutCategory = string;
export interface WorkoutCategoryDefinition {
  id: string;
  name: string;
}
export type LoggableMetric = 'reps' | 'weight' | 'distance' | 'duration' | 'calories';

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
  rpe?: number; // Rate of Perceived Exertion (1-10)
  tags?: string[]; // Quick selection tags e.g. "Roligt", "Tungt", "Bra musik"
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
  rpe?: number; // Rate of Perceived Exertion (1-10)
  tags?: string[]; // Quick selection tags
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

export type StrengthLevel = 'Startklar' | 'På gång' | 'Stark' | 'Stabil' | 'Imponerande' | 'Toppform';

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

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface UserStrengthStat {
  id: string;
  participantId: string;
  bodyweightKg?: number;
  
  squat1RMaxKg?: number;
  squatVerificationStatus?: VerificationStatus;
  squatVerifiedBy?: string;
  squatVerifiedDate?: string;

  benchPress1RMaxKg?: number;
  benchPressVerificationStatus?: VerificationStatus;
  benchPressVerifiedBy?: string;
  benchPressVerifiedDate?: string;

  deadlift1RMaxKg?: number;
  deadliftVerificationStatus?: VerificationStatus;
  deadliftVerifiedBy?: string;
  deadliftVerifiedDate?: string;

  overheadPress1RMaxKg?: number; 
  overheadPressVerificationStatus?: VerificationStatus;
  overheadPressVerifiedBy?: string;
  overheadPressVerifiedDate?: string;

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

export interface ParticipantMentalWellbeing {
  id: string; 
  participantId: string;
  stressLevel?: number;    
  energyLevel?: number;    
  sleepQuality?: number;   
  overallMood?: number;    
  lastUpdated: string;     
}

export interface CoachNote {
  id: string;
  participantId: string;
  noteText: string;
  createdDate: string; // ISO string
  noteType: 'check-in' | 'intro-session'; 
}
