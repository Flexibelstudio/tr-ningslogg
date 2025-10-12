// functions/src/types.ts

// --- Organization-Specific Data Types (Copied from client) ---

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
  reactions?: Reaction[];
}

export interface ParticipantProfile {
  id: string; 
  name?: string;
  email?: string;
  // ... other fields are not needed by the functions
}

export type LoggableMetric = 'reps' | 'weight' | 'distance' | 'duration' | 'calories';

export interface Exercise {
  id: string;
  name: string;
  notes: string; 
  baseLiftType?: LiftType; 
  isBodyweight?: boolean; 
  loggableMetrics?: LoggableMetric[];
}

export interface WorkoutBlock {
  id: string;
  name?: string;
  exercises: Exercise[];
}

export interface Workout {
  id: string;
  title: string;
  blocks: WorkoutBlock[];
  category: string;
}

export interface NewPB {
  exerciseName: string;
  achievement: string; 
  value: string; 
  previousBest?: string;
  baseLiftType?: LiftType;
}

export interface NewBaseline {
  exerciseName: string;
  value: string;
}

export interface PostWorkoutSummaryData {
  totalWeightLifted: number; 
  newPBs: NewPB[];
  newBaselines?: NewBaseline[];
}

export interface SetDetail {
    id: string;
    reps?: number | string;
    weight?: number | string;
    isCompleted?: boolean;
}
  
export interface WorkoutExerciseLog {
    exerciseId: string;
    loggedSets: SetDetail[];
}

export interface WorkoutLog {
  type: 'workout';
  id: string;
  workoutId: string;
  participantId: string;
  entries: WorkoutExerciseLog[];
  completedDate: string; // ISO string
  postWorkoutComment?: string;
  postWorkoutSummary?: PostWorkoutSummaryData; 
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface GeneralActivityLog {
  type: 'general';
  id: string;
  participantId: string;
  activityName: string;
  durationMinutes: number;
  comment?: string;
  completedDate: string; // ISO string
  reactions?: Reaction[];
  comments?: Comment[];
}

export interface GoalCompletionLog {
  type: 'goal_completion';
  id: string;
  participantId: string;
  goalId: string;
  goalDescription: string;
  completedDate: string; // ISO string
  reactions?: Reaction[];
  comments?: Comment[];
}

export type FlowItemLogType = 'workout' | 'general' | 'coach_event' | 'one_on_one_session' | 'goal_completion' | 'participant_club_membership' | 'user_strength_stat' | 'participant_physique_stat' | 'participant_goal_data' | 'participant_conditioning_stat' | 'flow_item';

export interface FlowItem {
    id: string;
    orgId: string;
    timestamp: string; // ISO string for sorting
    participantId: string;
    icon: string;
    title: string;
    description?: string;
    sourceLogId: string;
    sourceLogType: FlowItemLogType;
    visibility: 'friends' | 'public';
    praiseItems?: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[];
    reactions?: Reaction[];
    comments?: Comment[];
}

export type LiftType = 
  'Knäböj' | 
  'Bänkpress' | 
  'Marklyft' | 
  'Axelpress' |
  'Chins / Pullups' |
  'Frontböj' |
  'Clean' |
  'Bulgarian Split Squat' |
  'RDL' |
  'Farmer’s Walk' |
  'Snatch Grip Deadlift' |
  'Clean & Press' |
  'Push Press' |
  'Hantelrodd' |
  'Goblet Squat' |
  'Thrusters' |
  'Stående Rodd';

export type ConditioningMetric = 'airbike4MinKcal' | 'skierg4MinMeters' | 'rower2000mTimeSeconds' | 'rower4MinMeters' | 'treadmill4MinMeters';

export interface ClubDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'LIFT' | 'SESSION_COUNT' | 'BODYWEIGHT_LIFT' | 'CONDITIONING' | 'TOTAL_VOLUME';
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
