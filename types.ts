

export type WorkoutCategory = 'PT-bas' | 'PT-grupp' | 'Annat';

export interface Exercise {
  id: string;
  name: string;
  notes: string; // e.g., "3 set x 8 reps"
  baseLiftType?: LiftType; // New field to link to a base lift
}

export interface Workout {
  id: string;
  title: string;
  date: string; // ISO string
  exercises: Exercise[];
  isPublished: boolean;
  category: WorkoutCategory; // Added category field
  coachNote?: string; // New field for coach's note to participant
}

export interface SetDetail {
  id: string; // For React key and removal
  reps: number | string;
  weight?: number | string;
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
  animalEquivalent?: { // Field name kept for simplicity, but sourced from WeightComparisonItem
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
  workoutId: string;
  userId?: string; // For future use, MVP is anonymous
  entries: WorkoutExerciseLog[];
  completedDate: string; // ISO string
  postWorkoutComment?: string;
  postWorkoutSummary?: PostWorkoutSummaryData; // Gamification data
  moodRating?: number; // Optional: 1-5 scale
}

export interface GeneralActivityLog {
  type: 'general'; // Discriminating property
  id: string;
  userId?: string;
  activityName: string;
  durationMinutes: number;
  caloriesBurned?: number;
  distanceKm?: number;
  comment?: string;
  completedDate: string; // ISO string
  moodRating?: number; // Optional: 1-5 scale
}

export type ActivityLog = WorkoutLog | GeneralActivityLog;


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
  age?: string; // Store as string for flexibility in input, can be parsed to number if needed
  gender?: GenderOption;
  muscleMassKg?: number; // New field for InBody muscle mass
  fatMassKg?: number;    // New field for InBody fat mass
  inbodyScore?: number;  // New field for InBody score
  lastUpdated: string; // ISO string
}

export interface ParticipantGoalData {
  id: string; // Unique ID for this goal entry
  fitnessGoals: string;
  workoutsPerWeekTarget: number; // How many workouts they aim for each week
  currentWeeklyStreak: number; // Number of consecutive weeks target has been met FOR THIS GOAL'S TARGET
  lastStreakUpdateEpochWeekId: string; // Corresponding week ID for the streak FOR THIS GOAL'S TARGET
  preferences?: string; // User preferences, e.g., "trains alone", "has specific challenges"
  setDate: string; // ISO string for when this goal was set/updated
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

export interface UserStrengthStats {
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
  axelpress: UserProvidedLiftMultipliers; // Changed from optional
  // Note: New LiftTypes are not added here as they don't have separate primary strength standard calculations
}

export interface ParticipantConditioningStats {
  id: string; // Should match participantProfile.id or be unique for the stats entry
  airbike4MinTest?: string; // e.g., "65 kcal" or "1200 m"
  skierg4MinMeters?: string; // Stored as string to allow empty, parse to number on save
  rower4MinMeters?: string;
  treadmill4MinMeters?: string;
  lastUpdated: string; // ISO string
}

export interface ParticipantMentalWellbeing {
  id: string; // Should match participantProfile.id or be unique for the stats entry
  stressLevel?: number;    // 1 (Mycket låg) - 5 (Mycket hög)
  energyLevel?: number;    // 1 (Mycket låg) - 5 (Mycket hög)
  sleepQuality?: number;   // 1 (Mycket dålig) - 5 (Mycket bra)
  overallMood?: number;    // 1 (Mycket dåligt) - 5 (Mycket bra)
  lastUpdated: string;     // ISO string
}