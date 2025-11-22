
import { WeightComparisonItem, GenderOption, StrengthStandard, StrengthLevel, LiftType, AllUserProvidedStrengthMultipliers, StrengthStandardDetail, UserProvidedLiftMultipliers, WorkoutCategory, ClubDefinition, UserStrengthStat, StaffRole, Membership, OneOnOneSessionType, WorkoutCategoryDefinition, GroupClassDefinition, ConditioningMetric, WorkoutFocusTag, ContactAttemptMethod, ContactAttemptOutcome } from './types'; // Updated import type from AnimalWeight

export const FLEXIBEL_PRIMARY_COLOR = '#3bab5a'; // Updated color
export const APP_NAME = 'Träningslogg';

// A palette of distinct, accessible colors that harmonize with the primary Flexibel teal.
export const COLOR_PALETTE: string[] = [
  "#3bab5a", // flexibel teal (primary)
  "#1e88e5", // blue
  "#22c55e", // green - Fixed duplicate (was #3bab5a)
  "#8e24aa", // purple
  "#ffb300", // amber
  "#f4511e", // deep orange
  "#d81b60", // pink
  "#6d4c41", // brown
  "#3949ab", // indigo
  "#00897b", // teal darken-1
];

// FIX: Add missing ZAPIER_WEBHOOK_SECRET export for the client-side webhook handler used in the preview environment.
export const ZAPIER_WEBHOOK_SECRET = 'your-zapier-webhook-secret-here';

// This key is required to subscribe to web push notifications.
// In a real application, this would be generated on the server (VAPID keys)
// and securely provided to the client.
export const VAPID_PUBLIC_KEY = 'BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE';


export const LOCAL_STORAGE_KEYS = {
  // USER_ROLE is now managed by AuthContext with a different key
  MOCK_DB: 'flexibel_mockDB_v3', // Single key for the entire multi-tenant DB
  WELCOME_MESSAGE_SHOWN_PARTICIPANT: 'flexibel_welcomeMessageShown_participant',
  LAST_FEEDBACK_PROMPT_TIME: 'flexibel_lastFeedbackPromptTime', 
  AUTH_STATE: 'flexibel_authState_v3', // Persist auth state
  LAST_USED_ORG_ID: 'flexibel_lastOrgId_v1',
  IN_PROGRESS_WORKOUT: 'flexibel_inProgressWorkout_v1',
  INSTALL_PROMPT_DISMISSED_UNTIL: 'flexibel_installPromptDismissedUntil_v1',
};

// PREDEFINED data is now part of the seed data in dataService.ts
// to ensure it exists within each organization's data.
// Constants that are truly constant can remain.
export const PREDEFINED_WORKOUT_CATEGORIES: WorkoutCategoryDefinition[] = [
    { id: 'cat-pt-bas', name: 'PT-bas' },
    { id: 'cat-pt-grupp', name: 'PT-grupp' },
    { id: 'cat-workout', name: 'Workout' },
    { id: 'cat-personal', name: 'Personligt program' },
    { id: 'cat-annat', name: 'Annat' },
];

export const WORKOUT_FOCUS_TAGS: { id: WorkoutFocusTag, label: string }[] = [
    { id: 'Styrka', label: 'Styrka (maxstyrka, 1RM)' },
    { id: 'Hypertrofi', label: 'Hypertrofi (muskeltillväxt)' },
    { id: 'Kondition', label: 'Kondition (puls, uthållighet)' },
    { id: 'HIIT', label: 'HIIT (högintensivt)' },
    { id: 'Rörlighet', label: 'Rörlighet' },
    { id: 'Återhämtning', label: 'Återhämtning' },
    { id: 'Teknik', label: 'Teknikfokus' },
];

export const PREDEFINED_MEMBERSHIPS: Membership[] = [
    { id: 'membership-standard-seed', name: 'Medlemskap', type: 'subscription' },
    { id: 'membership-mini-seed', name: 'Mini' , type: 'subscription', restrictedCategories: { 'PT-bas': 'show_lock', 'PT-grupp': 'show_lock' } },
    { id: 'membership-clip10-seed', name: 'Klippkort 10', type: 'clip_card', clipCardClips: 10, clipCardValidityDays: 90 },
];

export const PREDEFINED_GROUP_CLASSES: GroupClassDefinition[] = [
    { id: 'class-pt-bas-seed', name: 'PT-bas', description: 'Styrketräning med fokus på basövningar.', defaultDurationMinutes: 40, hasWaitlist: true, color: COLOR_PALETTE[1] },
    { id: 'class-pt-grupp-seed', name: 'PT-grupp', description: 'Personlig träning i grupp.', defaultDurationMinutes: 60, hasWaitlist: true, color: COLOR_PALETTE[2] },
    { id: 'class-workout-seed', name: 'Workout', description: 'Funktionell styrka och uthållighet.', defaultDurationMinutes: 50, hasWaitlist: true, color: COLOR_PALETTE[3] },
];

export const DEFAULT_GENERAL_ACTIVITIES: string[] = [
    "HIIT", 
    "Workout", 
    "Yoga", 
    "Pilates",
    "Promenad",
    "Löpning", 
    "Funktionell Träning",
    "Annan aktivitet"
];

export const REACTION_EMOJIS: string[] = ['👍', '💪', '🔥', '🎉', '❤️'];

export const DEFAULT_COACH_EVENT_ICON = '📣';
export const STUDIO_TARGET_OPTIONS: { value: 'all' | 'salem' | 'karra', label: string }[] = [
  { value: 'all', label: 'Båda studiorna' },
  { value: 'salem', label: 'Endast Salem centrum' },
  { value: 'karra', label: 'Endast Kärra centrum' },
];

export const GENDER_OPTIONS: { value: GenderOption, label: string }[] = [
    { value: 'Man', label: 'Man' },
    { value: 'Kvinna', label: 'Kvinna' },
    { value: '-', label: '-' },
];

export const STAFF_ROLE_OPTIONS: { value: StaffRole, label: string }[] = [
    { value: 'Coach', label: 'Coach' },
    { value: 'Admin', label: 'Admin' },
];


export const ONE_ON_ONE_SESSION_TYPES: OneOnOneSessionType[] = [
  { id: 'session-pt', title: 'PT-pass', description: 'Personlig träning med specifik coach.', durationMinutes: 55 },
  { id: 'session-checkin', title: 'Avstämningssamtal', description: 'Uppföljning av mål och progress.', durationMinutes: 25 },
  { id: 'session-inbody', title: 'InBody-mätning', description: 'Mätning av kroppssammansättning.', durationMinutes: 15 },
  { id: 'session-custom', title: 'Anpassat Möte', description: 'Annan typ av 1-on-1 session.', durationMinutes: 30 },
];

export const COMMON_FITNESS_GOALS_OPTIONS: { id: string; label: string }[] = [
  { id: 'goal_strength', label: 'Bli starkare' },
  { id: 'goal_muscle', label: 'Bygga muskler' },
  { id: 'goal_condition', label: 'Förbättra konditionen' },
  { id: 'goal_weightloss', label: 'Gå ner i vikt' },
  { id: 'goal_stress', label: 'Minska stress / Må bättre mentalt' },
  { id: 'goal_mobility', label: 'Öka rörlighet / Minska stelhet' },
  { id: 'goal_general_wellbeing', label: 'Allmän hälsa' },
];

export const REFERRAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Sociala medier', label: 'Sociala medier (Facebook, Instagram)' },
  { value: 'Googlesökning', label: 'Googlesökning' },
  { value: 'Rekommendation', label: 'Rekommendation från vän/familj' },
  { value: 'Gick förbi studion', label: 'Gick förbi studion' },
  { value: 'Lokal annonsering', label: 'Lokal annonsering (tidning, event etc.)' },
  { value: 'Annat', label: 'Annat...' },
];

export const INTRO_CALL_OUTCOME_OPTIONS: { value: 'bought_starter' | 'bought_other' | 'thinking' | 'not_interested', label: string }[] = [
  { value: 'bought_starter', label: 'Köpte Startprogram' },
  { value: 'bought_other', label: 'Köpte annat medlemskap' },
  { value: 'thinking', label: 'Tänker på saken / Återkommer' },
  { value: 'not_interested', label: 'Ej intresserad' },
];

export const CONTACT_ATTEMPT_METHOD_OPTIONS: { value: ContactAttemptMethod; label: string }[] = [
    { value: 'phone', label: 'Telefon' },
    { value: 'email', label: 'E-post' },
    { value: 'sms', label: 'SMS' },
];

export const CONTACT_ATTEMPT_OUTCOME_OPTIONS: { value: ContactAttemptOutcome; label: string }[] = [
    { value: 'booked_intro', label: 'Bokade Intro' },
    { value: 'follow_up', label: 'Behöver uppföljning' },
    { value: 'no_answer', label: 'Svarade ej' },
    { value: 'left_voicemail', label: 'Lämnade röstmeddelande' },
    { value: 'not_interested', label: 'Ej intresserad' },
];

export const ALL_LIFT_TYPES: LiftType[] = [
  'Knäböj', 
  'Bänkpress', 
  'Marklyft', 
  'Axelpress',
  'Chins / Pullups',
  'Frontböj',
  'Clean',
  'Bulgarian Split Squat',
  'RDL',
  'Farmer’s Walk',
  'Snatch Grip Deadlift',
  'Clean & Press',
  'Push Press',
  'Hantelrodd',
  'Goblet Squat',
  'Thrusters',
  'Stående Rodd'
];

export const MOOD_OPTIONS: { rating: number; label: string; emoji: string; }[] = [
  { rating: 1, label: 'Mycket dåligt', emoji: '😩' },
  { rating: 2, label: 'Dåligt', emoji: '😟' },
  { rating: 3, label: 'OK', emoji: '😐' },
  { rating: 4, label: 'Bra', emoji: '😊' },
  { rating: 5, label: 'Mycket bra', emoji: '😄' },
];

export const STRESS_LEVEL_OPTIONS: { value: number, label: string, emoji: string, color: string }[] = [
  { value: 1, label: 'Mycket låg', emoji: '😌', color: '#4CAF50' },
  { value: 2, label: 'Låg', emoji: '😊', color: '#8BC34A' },
  { value: 3, label: 'Måttlig', emoji: '😐', color: '#FFC107' },
  { value: 4, label: 'Hög', emoji: '😟', color: '#FF9800' },
  { value: 5, label: 'Mycket hög', emoji: '😩', color: '#F44336' },
];

export const ENERGY_LEVEL_OPTIONS: { value: number, label: string, emoji: string, color: string }[] = [
  { value: 1, label: 'Mycket låg', emoji: '😴', color: '#F44336' },
  { value: 2, label: 'Låg', emoji: '😟', color: '#FF9800' },
  { value: 3, label: 'Måttlig', emoji: '😐', color: '#FFC107' },
  { value: 4, label: 'Hög', emoji: '😊', color: '#8BC34A' },
  { value: 5, label: 'Mycket hög', emoji: '🤩', color: '#4CAF50' },
];

export const SLEEP_QUALITY_OPTIONS: { value: number, label: string, emoji: string, color: string }[] = [
  { value: 1, label: 'Mycket dålig', emoji: '😵', color: '#F44336' },
  { value: 2, label: 'Dålig', emoji: '😫', color: '#FF9800' },
  { value: 3, label: 'OK', emoji: '😐', color: '#FFC107' },
  { value: 4, label: 'Bra', emoji: '😴', color: '#8BC34A' },
  { value: 5, label: 'Mycket bra', emoji: '😌', color: '#4CAF50' },
];

export const OVERALL_MOOD_OPTIONS: { value: number, label: string, emoji: string, color: string }[] = [
  { value: 1, label: 'Mycket dåligt', emoji: '😩', color: '#F44336' },
  { value: 2, label: 'Dåligt', emoji: '😟', color: '#FF9800' },
  { value: 3, label: 'OK', emoji: '😐', color: '#FFC107' },
  { value: 4, label: 'Bra', emoji: '😊', color: '#8BC34A' },
  { value: 5, label: 'Mycket bra', emoji: '😄', color: '#4CAF50' },
];

export const WEIGHT_COMPARISONS: WeightComparisonItem[] = [
    { name: 'Katt', pluralName: 'Katter', weightKg: 5, emoji: '🐈', article: 'en' },
    { name: 'Vattenmelon', pluralName: 'Vattenmeloner', weightKg: 10, emoji: '🍉', article: 'en' },
    { name: 'Kalkon', pluralName: 'Kalkoner', weightKg: 12, emoji: '🦃', article: 'en' },
    { name: 'Golden Retriever', pluralName: 'Golden Retrievers', weightKg: 30, emoji: '🐕', article: 'en' },
    { name: 'Babian', pluralName: 'Babianer', weightKg: 40, emoji: '🐒', article: 'en' },
    { name: 'Jättesäck potatis', pluralName: 'Jättesäckar potatis', weightKg: 50, emoji: '🥔', article: 'en' },
    { name: 'Full öl-kagge', pluralName: 'Fulla öl-kaggar', weightKg: 60, emoji: '🍺', article: 'ett' },
    { name: 'Varg', pluralName: 'Vargar', weightKg: 70, emoji: '🐺', article: 'en' },
    { name: 'Genomsnittlig man', pluralName: 'Genomsnittliga män', weightKg: 85, emoji: '👨', article: 'en' },
    { name: 'Panda', pluralName: 'Pandor', weightKg: 115, emoji: '🐼', article: 'en' },
    { name: 'Gris', pluralName: 'Grisar', weightKg: 120, emoji: '🐖', article: 'en' },
    { name: 'Gorilla', pluralName: 'Gorillor', weightKg: 160, emoji: '🦍', article: 'en' },
    { name: 'Lejon', pluralName: 'Lejon', weightKg: 190, emoji: '🦁', article: 'ett' },
    { name: 'Grizzlybjörn', pluralName: 'Grizzlybjörnar', weightKg: 270, emoji: '🐻', article: 'en' },
    { name: 'Flygel', pluralName: 'Flyglar', weightKg: 350, emoji: '🎹', article: 'en' },
    { name: 'Häst', pluralName: 'Hästar', weightKg: 400, emoji: '🐎', article: 'en' },
    { name: 'Isbjörn', pluralName: 'Isbjörnar', weightKg: 600, emoji: '🐻‍❄️', article: 'en' },
    { name: 'Ko', pluralName: 'Kor', weightKg: 750, emoji: '🐄', article: 'en' },
    { name: 'Noshörning', pluralName: 'Noshörningar', weightKg: 1000, emoji: '🦏', article: 'en' },
    { name: 'Personbil', pluralName: 'Personbilar', weightKg: 1500, emoji: '🚗', article: 'en' },
    { name: 'Flakbil', pluralName: 'Flakbilar', weightKg: 2000, emoji: '🛻', article: 'en' },
    { name: 'Elefant', pluralName: 'Elefanter', weightKg: 5000, emoji: '🐘', article: 'en' },
    { name: 'T-Rex', pluralName: 'T-Rexar', weightKg: 8000, emoji: '🦖', article: 'en' },
];

export const FSS_CONFIG = {
  ageRange: "18-120",
  scoreConversionPerLift: {
    male: {
      squat: {
        weights: [80, 100, 120, 130],
        points: [60, 75, 90, 100]
      },
      bench_press: {
        weights: [50, 65, 80, 90],
        points: [60, 75, 90, 100]
      },
      deadlift: {
        weights: [110, 140, 170, 190],
        points: [60, 75, 90, 100]
      },
      overhead_press: {
        weights: [35, 50, 60, 70],
        points: [60, 75, 90, 100]
      }
    },
    female: {
      squat: {
        weights: [40, 60, 80, 100],
        points: [60, 75, 90, 100]
      },
      bench_press: {
        weights: [20, 30, 45, 60],
        points: [60, 75, 90, 100]
      },
      deadlift: {
        weights: [60, 90, 120, 140],
        points: [60, 75, 90, 100]
      },
      overhead_press: {
        weights: [15, 25, 40, 50],
        points: [60, 75, 90, 100]
      }
    }
  },
  bodyweightAdjustment: {
    apply: true,
    multipliers: [
      { maxWeight: 59, multiplier: 1.05 },
      { maxWeight: 69, multiplier: 1.03 },
      { maxWeight: 79, multiplier: 1.01 },
      { maxWeight: 89, multiplier: 1.00 },
      { maxWeight: 99, multiplier: 0.99 },
      { maxWeight: 109, multiplier: 0.97 },
      { maxWeight: 200, multiplier: 0.95 }
    ]
  },
  ageAdjustment: {
    apply: true,
    modifiers: [
      { minAge: 18, maxAge: 39, multiplier: 1.00 },
      { minAge: 40, maxAge: 49, multiplier: 1.01 },
      { minAge: 50, maxAge: 59, multiplier: 1.03 },
      { minAge: 60, maxAge: 120, multiplier: 1.05 }
    ]
  },
  fssLevels: [
    { min: 0, max: 59, label: "Startklar" as StrengthLevel },
    { min: 60, max: 74, label: "På gång" as StrengthLevel },
    { min: 75, max: 89, label: "Stark" as StrengthLevel },
    { min: 90, max: 109, label: "Stabil" as StrengthLevel },
    { min: 110, max: 129, label: "Imponerande" as StrengthLevel },
    { min: 130, max: 1000, label: "Toppform" as StrengthLevel }
  ],
  description: "Flexibel Strength Score (FSS) visar en medlems styrkenivå baserat på 1RM i fyra baslyft.Poäng per lyft justeras efter kroppsvikt, och slutpoängen justeras efter ålder för att skapa rättvisa och motiverande nivåer för alla – oavsett förutsättningar. Resultatet visas med nivånamn som stärker självkänsla och progressionsvilja."
};

export const STRENGTH_LEVEL_ORDER: StrengthLevel[] = ['Startklar', 'På gång', 'Stark', 'Stabil', 'Imponerande', 'Toppform'];

export const LEVEL_COLORS_HEADER: Record<StrengthLevel, string> = {
    'Startklar': '#ef4444',     // red-500
    'På gång': '#f97316',     // orange-500
    'Stark': '#22c55e',      // green-500
    'Stabil': '#3b82f6',       // blue-500
    'Imponerande': '#a855f7',   // purple-500
    'Toppform': '#0aa5a1',     // flexibel
};

export const MAIN_LIFTS_CONFIG_HEADER: { lift: LiftType, statKey: 'squat1RMaxKg' | 'benchPress1RMaxKg' | 'deadlift1RMaxKg' | 'overheadPress1RMaxKg', label: string }[] = [
    { lift: 'Knäböj', statKey: 'squat1RMaxKg', label: 'Knäböj 1RM (kg)' },
    { lift: 'Bänkpress', statKey: 'benchPress1RMaxKg', label: 'Bänkpress 1RM (kg)' },
    { lift: 'Marklyft', statKey: 'deadlift1RMaxKg', label: 'Marklyft 1RM (kg)' },
    { lift: 'Axelpress', statKey: 'overheadPress1RMaxKg', label: 'Axelpress 1RM (kg)' },
];

export const INTENSITY_LEVELS: { value: number; label: string; twBadgeClass: string; }[] = [
    { value: 1, label: 'Lätt', twBadgeClass: 'bg-blue-100 text-blue-800' },
    { value: 2, label: 'Medel', twBadgeClass: 'bg-green-100 text-green-800' },
    { value: 3, label: 'Tungt', twBadgeClass: 'bg-red-100 text-red-800' },
];

export const CLUB_DEFINITIONS: ClubDefinition[] = [
  // --- SESSION COUNT CLUBS ---
  { id: 'sessions-10', name: '10 Pass-klubben', description: 'Du har loggat 10 pass!', icon: '👏', type: 'SESSION_COUNT', threshold: 10, comparison: 'GREATER_OR_EQUAL' },
  { id: 'sessions-25', name: '25 Pass-klubben', description: 'Du har loggat 25 pass!', icon: '🙌', type: 'SESSION_COUNT', threshold: 25, comparison: 'GREATER_OR_EQUAL' },
  { id: 'sessions-50', name: '50 Pass-klubben', description: 'Du har loggat 50 pass! Bra jobbat!', icon: '🎉', type: 'SESSION_COUNT', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
  { id: 'sessions-100', name: '100 Pass-klubben', description: 'Du har loggat 100 pass! Imponerande!', icon: '💯', type: 'SESSION_COUNT', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
  { id: 'sessions-250', name: '250 Pass-klubben', description: 'Du har loggat 250 pass! Vilken dedikation!', icon: '🌟', type: 'SESSION_COUNT', threshold: 250, comparison: 'GREATER_OR_EQUAL' },
  { id: 'sessions-500', name: '500 Pass-klubben', description: 'Du har loggat 500 pass! Du är en legend!', icon: '🏆', type: 'SESSION_COUNT', threshold: 500, comparison: 'GREATER_OR_EQUAL' },

  // --- TOTAL VOLUME CLUBS ---
  { id: 'volume-1000kg', name: '1 Ton-klubben', description: 'Du har lyft totalt 1000 kg under ett pass!', icon: '🏋️', type: 'TOTAL_VOLUME', threshold: 1000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-2000kg', name: '2 Ton-klubben', description: 'Du har lyft totalt 2000 kg under ett pass!', icon: '🏋️', type: 'TOTAL_VOLUME', threshold: 2000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-3000kg', name: '3 Ton-klubben', description: 'Du har lyft totalt 3000 kg under ett pass!', icon: '🏋️', type: 'TOTAL_VOLUME', threshold: 3000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-4000kg', name: '4 Ton-klubben', description: 'Du har lyft totalt 4000 kg under ett pass!', icon: '🏋️', type: 'TOTAL_VOLUME', threshold: 4000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-5000kg', name: '5 Ton-klubben', description: 'Starkt! Du har lyft 5000 kg under ett pass!', icon: '🚚', type: 'TOTAL_VOLUME', threshold: 5000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-6000kg', name: '6 Ton-klubben', description: 'Wow! Det är vikten av en stor lastbil!', icon: '🚛', type: 'TOTAL_VOLUME', threshold: 6000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-7000kg', name: 'Elefant-klubben', description: 'Otroligt! Du har lyft en fullvuxen elefant!', icon: '🐘', type: 'TOTAL_VOLUME', threshold: 7000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-8000kg', name: 'Moai-klubben', description: 'Du är stark som en stenstod från Påskön!', icon: '🗿', type: 'TOTAL_VOLUME', threshold: 8000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-9000kg', name: 'T-Rex-klubben', description: 'Förhistorisk styrka! Detta är vikten av en T-Rex!', icon: '🦖', type: 'TOTAL_VOLUME', threshold: 9000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-10000kg', name: '10 Ton-klubben', description: 'Vilken volym! 10 000 kg under ett pass är otroligt!', icon: '🚀', type: 'TOTAL_VOLUME', threshold: 10000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-20000kg', name: '20 Ton-klubben', description: 'Elitnivå! 20 000 kg under ett pass!', icon: '👑', type: 'TOTAL_VOLUME', threshold: 20000, comparison: 'GREATER_OR_EQUAL' },
  { id: 'volume-marathon', name: 'Maraton-klubben', description: 'Du har lyft ett volym-maraton! 42 195 kg på ett pass!', icon: '🏃💨', type: 'TOTAL_VOLUME', threshold: 42195, comparison: 'GREATER_OR_EQUAL' },

  // --- BENCH PRESS (Bänkpress) CLUBS ---
  { id: 'bench-30kg', name: '30kg Bänkpressklubben', description: 'Du har lyft 30 kg i bänkpress!', icon: '💪', type: 'LIFT', liftType: 'Bänkpress', threshold: 30, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-40kg', name: '40kg Bänkpressklubben', description: 'Du har lyft 40 kg i bänkpress!', icon: '💪', type: 'LIFT', liftType: 'Bänkpress', threshold: 40, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-50kg', name: '50kg Bänkpressklubben', description: 'Du har lyft 50 kg i bänkpress!', icon: '💪', type: 'LIFT', liftType: 'Bänkpress', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-60kg', name: '60kg Bänkpressklubben', description: 'Du har lyft 60 kg i bänkpress!', icon: '💪', type: 'LIFT', liftType: 'Bänkpress', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-75kg', name: '75kg Bänkpressklubben', description: 'Du har lyft 75 kg i bänkpress!', icon: '🎯', type: 'LIFT', liftType: 'Bänkpress', threshold: 75, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-100kg', name: '100kg Bänkpressklubben', description: 'Du har lyft 100 kg i bänkpress!', icon: '🔥', type: 'LIFT', liftType: 'Bänkpress', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-110kg', name: '110kg Bänkpressklubben', description: 'Du har lyft 110 kg i bänkpress!', icon: '🚀', type: 'LIFT', liftType: 'Bänkpress', threshold: 110, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-120kg', name: '120kg Bänkpressklubben', description: 'Du har lyft 120 kg i bänkpress!', icon: '🏆', type: 'LIFT', liftType: 'Bänkpress', threshold: 120, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bench-140kg', name: '140kg Bänkpressklubben', description: 'Du har lyft 140 kg i bänkpress! Best-nivå!', icon: '👑', type: 'LIFT', liftType: 'Bänkpress', threshold: 140, comparison: 'GREATER_OR_EQUAL' },
  
  // --- SQUAT (Knäböj) CLUBS ---
  { id: 'squat-40kg', name: '40kg Knäböjklubben', description: 'Du har lyft 40 kg i knäböj!', icon: '🦵', type: 'LIFT', liftType: 'Knäböj', threshold: 40, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-60kg', name: '60kg Knäböjklubben', description: 'Du har lyft 60 kg i knäböj!', icon: '🦵', type: 'LIFT', liftType: 'Knäböj', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-80kg', name: '80kg Knäböjklubben', description: 'Du har lyft 80 kg i knäböj!', icon: '💪', type: 'LIFT', liftType: 'Knäböj', threshold: 80, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-100kg', name: '100kg Knäböjklubben', description: 'Du har lyft 100 kg i knäböj!', icon: '🎯', type: 'LIFT', liftType: 'Knäböj', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-120kg', name: '120kg Knäböjklubben', description: 'Du har lyft 120 kg i knäböj!', icon: '🔥', type: 'LIFT', liftType: 'Knäböj', threshold: 120, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-140kg', name: '140kg Knäböjklubben', description: 'Du har lyft 140 kg i knäböj!', icon: '🚀', type: 'LIFT', liftType: 'Knäböj', threshold: 140, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-160kg', name: '160kg Knäböjklubben', description: 'Du har lyft 160 kg i knäböj!', icon: '🏆', type: 'LIFT', liftType: 'Knäböj', threshold: 160, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-180kg', name: '180kg Knäböjklubben', description: 'Du har lyft 180 kg i knäböj!', icon: '👑', type: 'LIFT', liftType: 'Knäböj', threshold: 180, comparison: 'GREATER_OR_EQUAL' },
  { id: 'squat-200kg', name: '200kg Knäböjklubben', description: 'Du har lyft 200 kg i knäböj! Titan-nivå!', icon: '🔱', type: 'LIFT', liftType: 'Knäböj', threshold: 200, comparison: 'GREATER_OR_EQUAL' },

  // --- DEADLIFT (Marklyft) CLUBS ---
  { id: 'deadlift-60kg', name: '60kg Marklyftklubben', description: 'Du har lyft 60 kg i marklyft!', icon: '🏋️', type: 'LIFT', liftType: 'Marklyft', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-80kg', name: '80kg Marklyftklubben', description: 'Du har lyft 80 kg i marklyft!', icon: '🏋️', type: 'LIFT', liftType: 'Marklyft', threshold: 80, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-100kg', name: '100kg Marklyftklubben', description: 'Du har lyft 100 kg i marklyft!', icon: '🎯', type: 'LIFT', liftType: 'Marklyft', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-120kg', name: '120kg Marklyftklubben', description: 'Du har lyft 120 kg i marklyft!', icon: '🔥', type: 'LIFT', liftType: 'Marklyft', threshold: 120, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-140kg', name: '140kg Marklyftklubben', description: 'Du har lyft 140 kg i marklyft!', icon: '🚀', type: 'LIFT', liftType: 'Marklyft', threshold: 140, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-160kg', name: '160kg Marklyftklubben', description: 'Du har lyft 160 kg i marklyft!', icon: '🏆', type: 'LIFT', liftType: 'Marklyft', threshold: 160, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-180kg', name: '180kg Marklyftklubben', description: 'Du har lyft 180 kg i marklyft!', icon: '👑', type: 'LIFT', liftType: 'Marklyft', threshold: 180, comparison: 'GREATER_OR_EQUAL' },
  { id: 'deadlift-200kg', name: '200kg Marklyftklubben', description: 'Du har lyft 200 kg i marklyft! Titan-nivå!', icon: '🔱', type: 'LIFT', liftType: 'Marklyft', threshold: 200, comparison: 'GREATER_OR_EQUAL' },

  // --- OVERHEAD PRESS (Axelpress) CLUBS ---
  { id: 'ohp-25kg', name: '25kg Axelpressklubben', description: 'Du har lyft 25 kg i axelpress!', icon: '💪', type: 'LIFT', liftType: 'Axelpress', threshold: 25, comparison: 'GREATER_OR_EQUAL' },
  { id: 'ohp-30kg', name: '30kg Axelpressklubben', description: 'Du har lyft 30 kg i axelpress!', icon: '💪', type: 'LIFT', liftType: 'Axelpress', threshold: 30, comparison: 'GREATER_OR_EQUAL' },
  { id: 'ohp-40kg', name: '40kg Axelpressklubben', description: 'Du har lyft 40 kg i axelpress!', icon: '🎯', type: 'LIFT', liftType: 'Axelpress', threshold: 40, comparison: 'GREATER_OR_EQUAL' },
  { id: 'ohp-50kg', name: '50kg Axelpressklubben', description: 'Du har lyft 50 kg i axelpress!', icon: '🔥', type: 'LIFT', liftType: 'Axelpress', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
  { id: 'ohp-60kg', name: '60kg Axelpressklubben', description: 'Du har lyft 60 kg i axelpress!', icon: '🚀', type: 'LIFT', liftType: 'Axelpress', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
  
  // --- a LIFT CLUBS ---
  { id: 'bw-bench-1x', name: '1.0x Kroppsvikt Bänkpress', description: 'Du har bänkpressat din egen kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Bänkpress', multiplier: 1, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bw-squat-1.5x', name: '1.5x Kroppsvikt Knäböj', description: 'Du har knäböjt 1.5 gånger din kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Knäböj', multiplier: 1.5, comparison: 'GREATER_OR_EQUAL' },
  { id: 'bw-deadlift-2x', name: '2.0x Kroppsvikt Marklyft', description: 'Du har marklyft dubbla din kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Marklyft', multiplier: 2, comparison: 'GREATER_OR_EQUAL' },
  
  // --- CONDITIONING CLUBS ---
  // Airbike
  // FIX: Corrected typo in conditioningMetric from 'airbike4MinKcal'
  { id: 'airbike-30kcal', name: '30 kcal Airbike 4 min', description: 'Du har nått 30 kcal på 4 minuter på Airbike!', icon: '💨', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 30, comparison: 'GREATER_OR_EQUAL' },
  { id: 'airbike-40kcal', name: '40 kcal Airbike 4 min', description: 'Du har nått 40 kcal på 4 minuter på Airbike!', icon: '💨', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 40, comparison: 'GREATER_OR_EQUAL' },
  { id: 'airbike-50kcal', name: '50 kcal Airbike 4 min', description: 'Du har nått 50 kcal på 4 minuter på Airbike!', icon: '🔥', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
  // SkiErg
  { id: 'skierg-800m', name: '800m SkiErg 4 min', description: 'Du har nått 800m på 4 minuter på SkiErg!', icon: '⛷️', type: 'CONDITIONING', conditioningMetric: 'skierg4MinMeters', threshold: 800, comparison: 'GREATER_OR_EQUAL' },
  { id: 'skierg-900m', name: '900m SkiErg 4 min', description: 'Du har nått 900m på 4 minuter på SkiErg!', icon: '⛷️', type: 'CONDITIONING', conditioningMetric: 'skierg4MinMeters', threshold: 900, comparison: 'GREATER_OR_EQUAL' },
  { id: 'skierg-1000m', name: '1000m SkiErg 4 min', description: 'Du har nått 1000m på 4 minuter på SkiErg!', icon: '🔥', type: 'CONDITIONING', conditioningMetric: 'skierg4MinMeters', threshold: 1000, comparison: 'GREATER_OR_EQUAL' },
  // Rower
  { id: 'rower-2000m-sub8', name: 'Sub 8:00 Rodd 2000m', description: 'Du har rott 2000m under 8 minuter!', icon: '🚣', type: 'CONDITIONING', conditioningMetric: 'rower2000mTimeSeconds', threshold: 480, comparison: 'LESS_OR_EQUAL' },
  { id: 'rower-2000m-sub7', name: 'Sub 7:00 Rodd 2000m', description: 'Du har rott 2000m under 7 minuter!', icon: '🔥', type: 'CONDITIONING', conditioningMetric: 'rower2000mTimeSeconds', threshold: 420, comparison: 'LESS_OR_EQUAL' },
];
