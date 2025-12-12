
import { Reaction, Comment } from './shared';
import { ParticipantProfile, StaffMember, Lead, ProspectIntroCall, Connection, UserPushSubscription, UserNotification } from './user';
import { Workout, WorkoutLog, GeneralActivityLog, GoalCompletionLog, CoachNote, UserStrengthStat, ParticipantConditioningStat, ParticipantPhysiqueStat, ParticipantMentalWellbeing, WorkoutCategoryDefinition } from './workout';
import { ParticipantGamificationStats, ParticipantClubMembership, LeaderboardSettings, ParticipantGoalData } from './gamification';
import { Location, Membership, WeeklyHighlightSettings, StaffAvailability, IntegrationSettings, BrandingSettings } from './settings';
import { GroupClassDefinition, GroupClassSchedule, GroupClassScheduleException, ParticipantBooking, OneOnOneSession } from './booking';

export type FlowItemLogType = 'workout' | 'general' | 'coach_event' | 'one_on_one_session' | 'goal_completion' | 'participant_club_membership' | 'user_strength_stat' | 'participant_physique_stat' | 'participant_goal_data' | 'participant_conditioning_stat' | 'user_notification';

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
  userNotifications: UserNotification[]; // Collection of all notifications for all users in the org
}

export type AppData = OrganizationData;

// Represents the entire database stored in localStorage
export interface MockDB {
    users: import('./user').User[];
    organizations: import('./user').Organization[];
    organizationData: Record<string, OrganizationData>; // Keyed by organization ID
}
