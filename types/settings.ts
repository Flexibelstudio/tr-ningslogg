
import { WorkoutCategory } from './workout';

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
  // Maps category name to behavior: 'show_lock' (visible but locked) or 'hide' (completely hidden)
  restrictedCategories?: Record<WorkoutCategory, 'show_lock' | 'hide'>;
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
  commonGeneralActivities?: string[];
}

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

export interface WeeklyHighlightSettings {
  isEnabled: boolean;
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  time: string; // "HH:MM"
  studioTarget: 'all' | 'salem' | 'karra' | 'separate';
  lastGeneratedTimestamp?: string; // ISO string
}
