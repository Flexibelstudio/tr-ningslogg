


export type WorkoutCategory = 'PT-bas' | 'PT-grupp' | 'Annat';
export type IntensityLevel = 'Lätt' | 'Medel' | 'Tungt'; // New Type
export type LoggableMetric = 'reps' | 'weight' | 'distance' | 'duration' | 'calories';

export interface Exercise {
  id: string;
  name: string;
  notes: string; // e.g., "3 set x 8 reps"
  baseLiftType?: LiftType; // New field to link to a base lift
  supersetIdentifier?: string; // New: To group exercises into a superset
  isBodyweight?: boolean; // New: Indicates if it's primarily a bodyweight exercise
  loggableMetrics?: LoggableMetric[]; // New: To guide logging UI, e.g., ['reps', 'weight']
}

export interface WorkoutBlock {
  id: string;
  name?: string; // Optional name for the block, e.g., "Block A", "Warm-up"
  exercises: Exercise[];
  isQuickLogEnabled?: boolean; // New: To enable quick round logging for finishers/AMRAPs
}

export interface Workout {
  id: string;
  title: string;
  blocks: WorkoutBlock[]; 
  isPublished: boolean;
  category: WorkoutCategory;
  coachNote?: string;
  isModifiable?: boolean; 
  exerciseSelectionOptions?: { 
    list: LiftType[];
    maxSelect: number;
    instructions?: string;
  };
  intensityLevel?: IntensityLevel; // New: For PT-bas workouts
  intensityInstructions?: string; // New: Instructions for the intensity level
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
}

export interface WeightComparisonItem { // Renamed from AnimalWeight
  name: string;
  pluralName?: string; 
  weightKg: number;
  emoji?: string;
  imageUrl?: string; 
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
  };
  newPBs: NewPB[];
}

export interface WorkoutLog {
  type: 'workout'; // Discriminating property
  id: string; // Unique ID for the log itself
  workoutId: string; // Pekar på Workout-mallens ID
  participantId: string; // For future use, MVP is anonymous
  entries: WorkoutExerciseLog[];
  completedDate: string; // ISO string
  postWorkoutComment?: string;
  postWorkoutSummary?: PostWorkoutSummaryData; 
  moodRating?: number; // Optional: 1-5 scale
  selectedExercisesForModifiable?: Exercise[]; 
}

export interface GeneralActivityLog {
  type: 'general'; // Discriminating property
  id: string;
  participantId: string;
  activityName: string;
  durationMinutes: number;
  caloriesBurned?: number;
  distanceKm?: number;
  comment?: string;
  completedDate: string; // ISO string
  moodRating?: number; // Optional: 1-5 scale
}

export interface GoalCompletionLog {
  type: 'goal_completion'; // Discriminating property
  id: string;
  participantId: string;
  goalId: string;
  goalDescription: string;
  completedDate: string; // ISO string
  moodRating?: undefined; // To make it compatible with ActivityLog but not used
}

export type ActivityLog = WorkoutLog | GeneralActivityLog | GoalCompletionLog;


export interface ParticipantWorkoutNote {
  workoutId: string;
  note: string;
  lastUpdated: string; // ISO string
}

export enum UserRole {
  COACH = 'coach',
  PARTICIPANT = 'participant',
}

export type GenderOption = 'Man' | 'Kvinna' | 'Annat' | 'Vill ej ange';

export interface ParticipantProfile {
  id: string; 
  name?: string;
  email?: string;
  isActive?: boolean;
  creationDate?: string;
  age?: string; 
  gender?: GenderOption;
  muscleMassKg?: number; 
  fatMassKg?: number;    
  inbodyScore?: number;  
  lastUpdated: string; // ISO string
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
}

export interface ParticipantGamificationStats {
  id: string; // Corresponds to participantId
  longestStreakWeeks: number;
  migratedWorkoutCount?: number; // Number of workouts imported from another system
  lastUpdated: string; // ISO string
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
}

// Types for Strength Standards Feature
export type StrengthLevel = 'Otränad' | 'Nybörjare' | 'Medelgod' | 'Avancerad' | 'Elit';
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
  bodyweightKg?: number;
  squat1RMaxKg?: number;
  benchPress1RMaxKg?: number;
  deadlift1RMaxKg?: number;
  overheadPress1RMaxKg?: number; // Added Axelpress
  lastUpdated: string; // ISO string
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

export interface ParticipantConditioningStats {
  id: string; 
  airbike4MinTest?: string; 
  skierg4MinMeters?: string; 
  rower4MinMeters?: string;
  treadmill4MinMeters?: string;
  lastUpdated: string; // ISO string
}

export interface ParticipantMentalWellbeing {
  id: string; 
  stressLevel?: number;    
  energyLevel?: number;    
  sleepQuality?: number;   
  overallMood?: number;    
  lastUpdated: string;     
}