

export enum UserRole {
  COACH = 'coach',
  PARTICIPANT = 'participant',
  SYSTEM_OWNER = 'system_owner'
}

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

export type GenderOption = 'Man' | 'Kvinna' | '-';

export interface ParticipantProfile {
  id: string; 
  name?: string;
  email?: string;
  photoURL?: string;
  isActive?: boolean;
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
  bindingEndDate?: string; // ISO date string YYYY-MM-DD. Date when the binding period expires.
  clipCardStatus?: {
    remainingClips: number;
    expiryDate?: string; // ISO date string YYYY-MM-DD. If not present, it doesn't expire.
  };
  approvalStatus?: 'pending' | 'approved' | 'declined';
}

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
  source: 'Hemsida' | 'Meta' | 'Manuell' | 'Rekommendation' | 'Påbörjad bokning';
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
  status: 'unlinked' | 'linked' | 'archived';
  linkedParticipantId?: string; // Filled when the link is made

  // New: For call outcome
  outcome?: 'bought_starter' | 'bought_other' | 'thinking' | 'not_interested';
  tshirtHandedOut?: boolean;
}

export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdDate: string; // ISO string
}

// New: For Push Notifications
export interface UserPushSubscription {
    id: string; // doc id
    participantId: string;
    subscription: PushSubscriptionJSON; // Store the JSON representation
}

export interface UserNotification {
  id: string;
  recipientId: string; // The user who should see this
  type: 'FRIEND_BOOKING' | 'CLASS_CANCELLED' | 'CLASS_CHANGED' | 'WAITLIST_PROMOTION' | 'VERIFICATION_REJECTED' | 'VERIFICATION_APPROVED';
  title: string;
  body: string;
  relatedScheduleId?: string;
  relatedClassDate?: string;
  createdAt: string; // ISO timestamp
  read: boolean;
  metadata?: any; // Flexible data (e.g. friend's avatar url, emoji)
}
