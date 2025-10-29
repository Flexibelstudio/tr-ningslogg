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
  // Target: Monday. dayOfWeekISO (1=Mon, 7=Sun). Target is 1.
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

export const isPast = (date: Date): boolean => {
  return date.getTime() < new Date().getTime();
};

// FIX: Modified function to return an object with both absolute and relative time strings to satisfy usage in multiple components. Also handle null input.
export const formatRelativeTime = (dateInput: string | Date | null): { absolute: string, relative: string } => {
  if (!dateInput) return { absolute: '', relative: 'Aldrig' };
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

  const absolute = date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  let relative = '';

  if (diffSeconds < 60) {
    relative = 'just nu';
  } else if (diffSeconds < 3600) {
    relative = `för ${Math.round(diffSeconds / 60)} min sedan`;
  } else if (diffSeconds < 86400) {
    relative = `för ${Math.round(diffSeconds / 3600)} tim sedan`;
  } else {
    const diffDays = Math.round(diffSeconds / 86400);
    if (diffDays === 1) {
      relative = 'igår';
    } else if (diffDays < 7) {
      const weekdays = ['söndags', 'måndags', 'tisdags', 'onsdags', 'torsdags', 'fredags', 'lördags'];
      relative = `i ${weekdays[date.getDay()]}`;
    } else {
      relative = date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    }
  }
  
  return { absolute, relative };
};

export interface Holiday {
  date: Date;
  name: string;
  type: 'holiday' | 'special';
  icon?: string;
}

// Computus algorithm to find Easter Sunday for a given year
const getEasterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
};

export const getSwedishHolidays = (year: number): Holiday[] => {
    const holidays: Holiday[] = [];

    // Fixed holidays
    holidays.push({ date: new Date(year, 0, 1), name: 'Nyårsdagen', type: 'holiday', icon: '🎆' });
    holidays.push({ date: new Date(year, 0, 6), name: 'Trettondedag jul', type: 'holiday', icon: '✨' });
    holidays.push({ date: new Date(year, 4, 1), name: 'Första maj', type: 'holiday', icon: '✊' });
    holidays.push({ date: new Date(year, 5, 6), name: 'Nationaldagen', type: 'holiday', icon: '🇸🇪' });
    holidays.push({ date: new Date(year, 11, 24), name: 'Julafton', type: 'special', icon: '🎄' });
    holidays.push({ date: new Date(year, 11, 25), name: 'Juldagen', type: 'holiday', icon: '🎅' });
    holidays.push({ date: new Date(year, 11, 26), name: 'Annandag jul', type: 'holiday', icon: '🎁' });
    holidays.push({ date: new Date(year, 11, 31), name: 'Nyårsafton', type: 'special', icon: '🍾' });

    // Movable holidays based on Easter
    const easterSunday = getEasterSunday(year);
    holidays.push({ date: addDays(easterSunday, -2), name: 'Långfredagen', type: 'holiday', icon: '✝️' });
    holidays.push({ date: easterSunday, name: 'Påskdagen', type: 'holiday', icon: '🕊️' });
    holidays.push({ date: addDays(easterSunday, 1), name: 'Annandag påsk', type: 'holiday', icon: '🌿' });
    holidays.push({ date: addDays(easterSunday, 39), name: 'Kristi himmelsfärdsdag', type: 'holiday', icon: '☁️' });
    holidays.push({ date: addDays(easterSunday, 49), name: 'Pingstdagen', type: 'holiday', icon: '🔥' });

    // Midsommardagen: The Saturday between June 20th and 26th.
    // Midsommarafton is the Friday between June 19th and 25th.
    for (let day = 19; day <= 25; day++) {
        const date = new Date(year, 5, day);
        if (date.getDay() === 5) { // 5 = Friday
            holidays.push({ date, name: 'Midsommarafton', type: 'special', icon: '🌸' });
            holidays.push({ date: addDays(date, 1), name: 'Midsommardagen', type: 'holiday', icon: '🌞' });
            break;
        }
    }

    // Alla helgons dag: The Saturday between Oct 31st and Nov 6th.
    const allaHelgonsStart = new Date(year, 9, 31); // Oct 31
    for (let i = 0; i < 7; i++) {
        const date = addDays(allaHelgonsStart, i);
        if (date.getDay() === 6) { // Saturday
            holidays.push({ date, name: 'Alla helgons dag', type: 'holiday', icon: '🕯️' });
            break;
        }
    }
    
    return holidays.sort((a,b) => a.date.getTime() - b.date.getTime());
};

/**
 * Formats a Date object into a 'YYYY-MM-DD' string, respecting the local timezone.
 */
export const toYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
