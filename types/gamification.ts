
import { Reaction, Comment } from './shared';
import { LiftType, ConditioningMetric } from './workout';

export interface ParticipantGamificationStats {
  id: string; // Corresponds to participantId
  longestStreakWeeks: number;
  lastUpdated: string; // ISO string
}

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

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
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
