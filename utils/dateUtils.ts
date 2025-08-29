// utils/dateUtils.ts

export const getStartOfWeek = (date: Date, weekStartsOn: number = 1): Date => { // 0 = Sunday, 1 = Monday
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfWeek = (date: Date, weekStartsOn: number = 1): Date => {
  const d = getStartOfWeek(date, weekStartsOn);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isSameWeek = (date1: Date, date2: Date, weekStartsOn: number = 1): boolean => {
  const startOfWeek1 = getStartOfWeek(date1, weekStartsOn);
  const startOfWeek2 = getStartOfWeek(date2, weekStartsOn);
  return startOfWeek1.getTime() === startOfWeek2.getTime();
};

export const getStartOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const getStartOfYear = (date: Date): Date => {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfYear = (date: Date): Date => {
  const d = new Date(date.getFullYear(), 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  // Handle cases where day of month might change (e.g. Jan 31 + 1 month = Feb 28/29)
  if (d.getDate() < date.getDate() && date.getMonth() !== (d.getMonth() - months + 12) % 12 ) {
      d.setDate(0); // Go to last day of previous month
  }
  return d;
};

export const addYears = (date: Date, years: number): Date => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

export const getISOWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};


export const formatPeriodLabel = (startDate: Date, endDate: Date, periodType: 'week' | 'month' | 'year'): string => {
  const locale = 'sv-SE';
  switch (periodType) {
    case 'week':
      const epochWeekId = getEpochWeekId(startDate);
      const weekIdParts = getWeekIdParts(epochWeekId);
      if (weekIdParts) {
        // Removed year from here
        return `Vecka ${weekIdParts.week}`;
      }
      // Fallback, though unlikely to be hit if getEpochWeekId and getWeekIdParts are robust
      console.warn(`Could not parse epochWeekId for date: ${startDate.toISOString()}`);
      const weekNumberFallback = getISOWeek(startDate);
      return `Vecka ${weekNumberFallback}`; // Removed year from fallback as well
    case 'month':
      return startDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'year':
      return startDate.toLocaleDateString(locale, { year: 'numeric' });
    default:
      return '';
  }
};

export const getShortDayName = (dayIndex: number, locale: string = 'sv-SE'): string => { // 0 for Monday
  const days = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
  return days[dayIndex % 7] || '';
};

export const getMonthName = (monthIndex: number, locale: string = 'sv-SE'): string => { // 0 for January
  const date = new Date(2000, monthIndex, 1); // Use a fixed year and day
  return date.toLocaleDateString(locale, { month: 'short' });
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

export const isFuturePeriod = (endDate: Date): boolean => {
    return endDate.getTime() > new Date().getTime();
};

/**
 * Returns a string identifier for the ISO week and year.
 * Format: "YYYY-Www", e.g., "2024-W01", "2024-W28".
 */
export const getEpochWeekId = (date: Date): string => {
  const year = date.getUTCFullYear(); // Use UTC year for consistency with ISO week
  const week = getISOWeek(date);
  // If the week is 52 or 53, it might belong to the previous year for Jan 1-3.
  // If the week is 1, it might belong to the next year for Dec 29-31.
  // getISOWeek should handle this, but we need to ensure the year is correct.
  // Example: Dec 31, 2023 could be Week 52 of 2023. Jan 1, 2024 could be Week 52 of 2023.
  // Jan 3, 2026 is Sat, Week 1 of 2026. Dec 29, 2025 is Mon, Week 1 of 2026.
  // The year of the week is the year of the Thursday of that week.
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - (date.getDay() || 7) + 4); // Get to Thursday of current week
  const weekYear = thursday.getUTCFullYear();

  return `${weekYear}-W${String(week).padStart(2, '0')}`;
};

/**
 * Parses an epochWeekId string ("YYYY-Www") into its year and week components.
 */
export const getWeekIdParts = (weekId: string): { year: number; week: number } | null => {
  const match = weekId.match(/(\d{4})-W(\d{1,2})/);
  if (match) {
    return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
  }
  return null;
};

/**
 * Given an epochWeekId, returns a Date object representing the Monday of that week.
 */
export const getDateFromEpochWeekId = (epochWeekId: string): Date => {
  const parts = getWeekIdParts(epochWeekId);
  if (!parts) throw new Error(`Invalid epochWeekId format: ${epochWeekId}`);

  // Create a date for Jan 1st of the target year.
  const janFirst = new Date(Date.UTC(parts.year, 0, 1));
  const firstDayOfYear = janFirst.getUTCDay() || 7; // 1 (Mon) to 7 (Sun)

  // Calculate days to the Thursday of the first week.
  // If Jan 1st is Fri, Sat, Sun (5,6,7), then week 1 starts in the previous year (or rather, those days are part of week 52/53 of prev year).
  // ISO 8601: Week 1 is the week with the first Thursday of the year.
  // Or, the week with Jan 4th.
  
  // Days to add to Jan 1st to get to Monday of week 'parts.week'
  // (parts.week - 1) * 7 brings us to the start of the week if Jan 1st was Monday.
  // Then adjust based on what day Jan 1st actually was.
  let daysToAdd = (parts.week - 1) * 7;
  // If Jan 1st is Mon, dayOffset = 0. If Tue, dayOffset = -1. If Sun, dayOffset = 1.
  // Target: Monday. dayOfWeek (1=Mon, 7=Sun). Target is 1.
  // (1 - dayOfWeekISO)
  const dayOffset = 1 - firstDayOfYear; 
  daysToAdd += dayOffset;

  // Correction for first week: if Jan 1st is Fri, Sat, Sun (day > 4), it means week 1's Thursday is in Jan.
  // The first Monday could be in Dec.
  const resultDate = new Date(Date.UTC(parts.year, 0, 1 + daysToAdd));
  
  // Verify by re-calculating getEpochWeekId. If it doesn't match, adjust.
  // This is because ISO week definition is complex. A simpler way for getDateFromEpochWeekId:
  const tempDate = new Date(Date.UTC(parts.year, 0, 4 + (parts.week - 1) * 7)); // Jan 4th is always in week 1. Go to approx Thursday of target week.
  tempDate.setUTCDate(tempDate.getUTCDate() - (tempDate.getUTCDay() || 7) + 1); // Set to Monday of that week.
  return tempDate;
};


/**
 * Returns the epochWeekId for the week immediately preceding the given epochWeekId.
 */
export const getPreviousEpochWeekId = (epochWeekId: string): string => {
  const dateInCurrentWeek = getDateFromEpochWeekId(epochWeekId);
  const dateInPreviousWeek = addDays(dateInCurrentWeek, -7);
  return getEpochWeekId(dateInPreviousWeek);
};

export const formatRelativeTime = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) {
    return 'just nu';
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `för ${diffMinutes} min sedan`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `för ${diffHours} tim sedan`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return 'igår';
  }
  if (diffDays < 7) {
    const weekdays = ['söndags', 'måndags', 'tisdags', 'onsdags', 'torsdags', 'fredags', 'lördags'];
    return `i ${weekdays[date.getDay()]}`;
  }
  
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
};