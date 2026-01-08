
import { Comment } from './shared';

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
  specialLabel?: string; // New: optional label like "Julspecial"
}

export interface GroupClassScheduleException {
  id: string;
  scheduleId: string; // FK to GroupClassSchedule.id
  date: string; // YYYY-MM-DD of the instance
  status?: 'CANCELLED' | 'DELETED' | 'MODIFIED';

  // Overrides for 'MODIFIED' status
  newStartTime?: string; // "HH:MM"
  newDurationMinutes?: number;
  newCoachId?: string;
  newMaxParticipants?: number;
  specialLabel?: string; // New: optional override label

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
