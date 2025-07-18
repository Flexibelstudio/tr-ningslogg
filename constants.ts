

import { WeightComparisonItem, GenderOption, StrengthStandard, StrengthLevel, LiftType, AllUserProvidedStrengthMultipliers, StrengthStandardDetail, UserProvidedLiftMultipliers, WorkoutCategory, IntensityLevel, ClubDefinition, UserStrengthStat } from './types'; // Updated import type from AnimalWeight

export const FLEXIBEL_PRIMARY_COLOR = '#51A1A1'; // Updated color
export const APP_NAME = 'Träningslogg';

export const LOCAL_STORAGE_KEYS = {
  USER_ROLE: 'flexibel_userRole',
  PARTICIPANT_DIRECTORY: 'flexibel_participantDirectory',
  WORKOUTS: 'flexibel_workouts',
  WORKOUT_LOGS: 'flexibel_workoutLogs',
  GENERAL_ACTIVITY_LOGS: 'flexibel_generalActivityLogs',
  GOAL_COMPLETION_LOGS: 'flexibel_goalCompletionLogs',
  COACH_MEMBER_NOTES: 'flexibel_coachMemberNotes',
  PARTICIPANT_WORKOUT_NOTES: 'flexibel_participantWorkoutNotes',
  PARTICIPANT_GOALS: 'flexibel_participantGoals',
  PARTICIPANT_PROFILE: 'flexibel_participantProfile', // Note: This will be phased out for participantDirectory
  PARTICIPANT_STRENGTH_STATS: 'flexibel_participantStrengthStats',
  PARTICIPANT_CONDITIONING_STATS: 'flexibel_participantConditioningStats',
  PARTICIPANT_MENTAL_WELLBEING: 'flexibel_participantMentalWellbeing', 
  PARTICIPANT_GAMIFICATION_STATS: 'flexibel_participantGamificationStats',
  WELCOME_MESSAGE_SHOWN_PARTICIPANT: 'flexibel_welcomeMessageShown_participant',
  LAST_FEEDBACK_PROMPT_TIME: 'flexibel_lastFeedbackPromptTime', 
  PARTICIPANT_CLUB_MEMBERSHIPS: 'flexibel_participantClubMemberships',
  LEADERBOARD_SETTINGS: 'flexibel_leaderboardSettings',
  COACH_EVENTS: 'flexibel_coachEvents',
};

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

export const WORKOUT_CATEGORY_OPTIONS: { value: WorkoutCategory, label: string }[] = [
    { value: 'PT-bas', label: 'PT-bas' },
    { value: 'PT-grupp', label: 'PT-grupp' },
    { value: 'Workout', label: 'Workout' },
    { value: 'Annat', label: 'Annat' },
];

export const INTENSITY_LEVELS: { value: IntensityLevel; label: string; focus: string; defaultInstructions: string; pbSuggestion?: string; color: string; twClass: string; twBadgeClass: string; }[] = [
    { 
        value: 'Lätt', 
        label: 'Lätt (ca 12-15 reps)', 
        focus: 'Teknik & Volym', 
        defaultInstructions: 'Fokusera på perfekt teknik. Vikten ska vara lätt nog att du känner full kontroll i varje repetition. Vila kort mellan seten.',
        pbSuggestion: 'Utmana dig själv genom att öka antalet repetitioner!',
        color: '#22c55e', // green-500
        twClass: 'bg-green-100 text-green-800 border-green-400',
        twBadgeClass: 'bg-green-100 text-green-800'
    },
    { 
        value: 'Medel', 
        label: 'Medel (ca 8-10 reps)', 
        focus: 'Hypertrofi & Styrka', 
        defaultInstructions: 'Välj en vikt där du klarar 8-10 repetitioner med god form. Pressa dig själv, men inte till total failure på varje set. Det ska vara utmanande!',
        pbSuggestion: 'Perfekt tillfälle att sätta PB i antal reps på en viss vikt!',
        color: '#f59e0b', // amber-500
        twClass: 'bg-yellow-100 text-yellow-800 border-yellow-400',
        twBadgeClass: 'bg-yellow-100 text-yellow-800'
    },
    { 
        value: 'Tungt', 
        label: 'Tungt (ca 3-5 reps)', 
        focus: 'Maximal Styrka', 
        defaultInstructions: 'Välj en vikt som är tung nog att du bara klarar ca 3-5 repetitioner med god form. Längre vila mellan seten (2-3 min). Varje repetition ska vara explosiv men kontrollerad.',
        pbSuggestion: 'Om det känns bra, testa ett nytt 1RM (1 Rep Max) på sista setet!',
        color: '#ef4444', // red-500
        twClass: 'bg-red-100 text-red-800 border-red-400',
        twBadgeClass: 'bg-red-100 text-red-800'
    }
];

export const COMMON_FITNESS_GOALS_OPTIONS: { id: string; label: string }[] = [
  { id: 'goal_strength', label: 'Bli starkare' },
  { id: 'goal_muscle', label: 'Bygga muskler' },
  { id: 'goal_condition', label: 'Förbättra konditionen' },
  { id: 'goal_weightloss', label: 'Gå ner i vikt' },
  { id: 'goal_stress', label: 'Minska stress / Må bättre mentalt' },
  { id: 'goal_mobility', label: 'Öka rörlighet / Minska stelhet' },
  { id: 'goal_general_wellbeing', label: 'Allmän hälsa och välmående' },
];


export const WEIGHT_COMPARISONS: WeightComparisonItem[] = [
  // Very Light
  { name: 'Kolibri', pluralName: 'Kolibrier', weightKg: 0.005, emoji: '🐦' },
  { name: 'Mus', pluralName: 'Möss', weightKg: 0.02, emoji: '🐭' },
  { name: 'Hamster', pluralName: 'Hamstrar', weightKg: 0.1, emoji: '🐹' },
  { name: 'Påse Chips (stor)', pluralName: 'Stora Chipspåsar', weightKg: 0.2, emoji: '🍟' },
  { name: 'Ekorre', pluralName: 'Ekorrar', weightKg: 0.3, emoji: '🐿️' },
  { name: 'Burk läsk', pluralName: 'Burkar läsk', weightKg: 0.35, emoji: '🥤' },
  { name: 'Fotboll', pluralName: 'Fotbollar', weightKg: 0.45, emoji: '⚽' },

  // Light
  { name: 'Liter Mjölk', pluralName: 'Liter Mjölk', weightKg: 1, emoji: '🥛' },
  { name: 'Ananas', pluralName: 'Ananaser', weightKg: 1.5, emoji: '🍍' },
  { name: 'Chihuahua', pluralName: 'Chihuahuor', weightKg: 2, emoji: '🐕' },
  { name: 'Tegelsten', pluralName: 'Tegelstenar', weightKg: 2.5, emoji: '🧱' },
  { name: 'Laptop', pluralName: 'Laptops', weightKg: 3, emoji: '💻' },
  { name: 'Katt', pluralName: 'Katter', weightKg: 4.5, emoji: '🐱' },
  { name: 'Bowlingklot (lätt)', pluralName: 'Lätta bowlingklot', weightKg: 5, emoji: '🎳' },
  
  // Medium
  { name: 'Räv', pluralName: 'Rävar', weightKg: 7, emoji: '🦊' },
  { name: 'Stor vattenmelon', pluralName: 'Stora vattenmeloner', weightKg: 9, emoji: '🍉' },
  { name: 'Bildäck', pluralName: 'Bildäck', weightKg: 10, emoji: '⚫' },
  { name: 'Beagle', pluralName: 'Beaglar', weightKg: 12, emoji: '🐶' },
  { name: 'Jaffa Apelsinlåda', pluralName: 'Jaffa Apelsinlådor', weightKg: 15, emoji: '🍊' },
  { name: 'Mikrovågsugn', pluralName: 'Mikrovågsugnar', weightKg: 18, emoji: '⚡️' },
  { name: 'Mellanstor Hund', pluralName: 'Mellanstora Hundar', weightKg: 20, emoji: '🐶' },
  { name: 'Stor Resväska (packad)', pluralName: 'Stora Resväskor', weightKg: 23, emoji: '🧳' },
  { name: 'Säck Potatis', pluralName: 'Säckar Potatis', weightKg: 25, emoji: '🥔' },
  
  // Medium-Heavy
  { name: 'Golden Retriever', pluralName: 'Golden Retrievers', weightKg: 30, emoji: '🐕‍🦺' },
  { name: 'Varg', pluralName: 'Vargar', weightKg: 40, emoji: '🐺' },
  { name: 'Säck cement', pluralName: 'Säckar cement', weightKg: 45, emoji: '🧱' },
  { name: 'Cementblandare (liten)', pluralName: 'Små Cementblandare', weightKg: 50, emoji: '🛠️' },
  { name: 'Get', pluralName: 'Getter', weightKg: 55, emoji: '🐐' },
  { name: 'Full Öl-keg', pluralName: 'Fulla Öl-keggar', weightKg: 60, emoji: '🍺' },
  
  // Heavy
  { name: 'Människa (genomsnitt)', pluralName: 'Människor', weightKg: 70, emoji: '🧑' },
  { name: 'Känguru', pluralName: 'Kängurur', weightKg: 85, emoji: '🦘' },
  { name: 'Stor TV', pluralName: 'Stora TV-apparater', weightKg: 90, emoji: '📺' },
  { name: 'Gris', pluralName: 'Grisar', weightKg: 110, emoji: '🐷' },
  { name: 'Jättepanda', pluralName: 'Jättepandor', weightKg: 125, emoji: '🐼' },
  { name: 'Piano (litet upprätt)', pluralName: 'Små Pianon', weightKg: 150, emoji: '🎹' },
  { name: 'Gorilla', pluralName: 'Gorillor', weightKg: 170, emoji: '🦍' },
  { name: 'Lejon', pluralName: 'Lejon', weightKg: 190, emoji: '🦁' },
  { name: 'Motorcykel (lätt)', pluralName: 'Lätta Motorcyklar', weightKg: 200, emoji: '🏍️' },
  { name: 'Kylskåp', pluralName: 'Kylskåp', weightKg: 250, emoji: '🧊' },

  // Very Heavy
  { name: 'Grizzlybjörn', pluralName: 'Grizzlybjörnar', weightKg: 300, emoji: '🐻' },
  { name: 'Isbjörn', pluralName: 'Isbjörnar', weightKg: 450, emoji: '🐻‍❄️' },
  { name: 'Häst', pluralName: 'Hästar', weightKg: 500, emoji: '🐴' },
  { name: 'Giraff', pluralName: 'Giraffer', weightKg: 650, emoji: '🦒' },
  { name: 'Smartbil', pluralName: 'Smartbilar', weightKg: 700, emoji: '🚗' },
  { name: 'Ko', pluralName: 'Kor', weightKg: 750, emoji: '🐮' },
  { name: 'Späckhuggare (kalv)', pluralName: 'Späckhuggarkalvar', weightKg: 1000, emoji: '🐳' },
  { name: 'Noshörning', pluralName: 'Noshörningar', weightKg: 2300, emoji: '🦏' },

  // Super Heavy
  { name: 'Elefant (Afrikansk)', pluralName: 'Elefanter', weightKg: 5000, emoji: '🐘' },
  { name: 'Tyrannosaurus Rex (skalle)', pluralName: 'T-Rex-skallar', weightKg: 6000, emoji: '🦖' },
  { name: 'Rymdkapsel (Mercury)', pluralName: 'Mercury-rymdkapslar', weightKg: 13000, emoji: '🚀' },
  { name: 'Blåval (liten)', pluralName: 'Små Blåvalar', weightKg: 50000, emoji: '🐋' },
];


// Nivåer: Otränad, Nybörjare, Medelgod, Avancerad, Elit
// Adjusted multipliers to make levels more attainable based on user feedback.
export const USER_PROVIDED_STRENGTH_MULTIPLIERS: AllUserProvidedStrengthMultipliers = {
  "knäböj": {
    "män": {
      "bas": [0.35, 0.55, 0.85, 1.15, 1.5], // Original: [0.4, 0.65, 1.0, 1.35, 1.7]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    },
    "kvinnor": {
      "bas": [0.25, 0.4, 0.65, 0.9, 1.15], // Original: [0.3, 0.5, 0.8, 1.05, 1.3]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    }
  },
  "marklyft": {
    "män": {
      "bas": [0.5, 0.75, 1.1, 1.5, 1.9], // Original: [0.6, 0.9, 1.3, 1.75, 2.2]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    },
    "kvinnor": {
      "bas": [0.4, 0.6, 0.85, 1.1, 1.4], // Original: [0.5, 0.7, 1.0, 1.25, 1.6]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    }
  },
  "bänkpress": {
    "män": {
      "bas": [0.30, 0.45, 0.65, 0.90, 1.15], // Original: [0.35, 0.55, 0.8, 1.1, 1.4]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    },
    "kvinnor": {
      "bas": [0.20, 0.30, 0.45, 0.65, 0.90], // Original: [0.25, 0.4, 0.6, 0.8, 1.0]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    }
  },
  "axelpress": {
    "män": {
      "bas": [0.20, 0.30, 0.45, 0.65, 0.85], // Original: [0.25, 0.4, 0.6, 0.8, 1.0]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    },
    "kvinnor": {
      "bas": [0.12, 0.18, 0.30, 0.45, 0.60], // Original: [0.15, 0.25, 0.4, 0.55, 0.7]
      "justering": {"30-39":1.00,"40-49":0.95,"50-59":0.90,"60-70":0.85}
    }
  }
};

interface ScaleOption { value: number; label: string; emoji: string; color: string; }
export const STRESS_LEVEL_OPTIONS: ScaleOption[] = [
    { value: 1, label: 'Mycket låg', emoji: '😌', color: '#10b981' }, // emerald-500
    { value: 2, label: 'Låg', emoji: '😊', color: '#84cc16' }, // lime-500
    { value: 3, label: 'Måttlig', emoji: '😐', color: '#eab308' }, // yellow-500
    { value: 4, label: 'Hög', emoji: '😟', color: '#f97316' }, // orange-500
    { value: 5, label: 'Mycket hög', emoji: '😩', color: '#ef4444' }, // red-500
];
export const ENERGY_LEVEL_OPTIONS: ScaleOption[] = [
    { value: 1, label: 'Ingen alls', emoji: '😴', color: '#ef4444' },
    { value: 2, label: 'Låg', emoji: '🥱', color: '#f97316' },
    { value: 3, label: 'Måttlig', emoji: '😐', color: '#eab308' },
    { value: 4, label: 'Hög', emoji: '😊', color: '#84cc16' },
    { value: 5, label: 'Mycket hög', emoji: '🤩', color: '#10b981' },
];
export const SLEEP_QUALITY_OPTIONS: ScaleOption[] = [
    { value: 1, label: 'Mycket dålig', emoji: '😫', color: '#ef4444' },
    { value: 2, label: 'Dålig', emoji: '😔', color: '#f97316' },
    { value: 3, label: 'Okej', emoji: '😐', color: '#eab308' },
    { value: 4, label: 'Bra', emoji: '😴', color: '#84cc16' },
    { value: 5, label: 'Mycket bra', emoji: '😌', color: '#10b981' },
];
export const OVERALL_MOOD_OPTIONS: ScaleOption[] = [
    { value: 1, label: 'Mycket dåligt', emoji: '😭', color: '#ef4444' },
    { value: 2, label: 'Dåligt', emoji: '😟', color: '#f97316' },
    { value: 3, label: 'Neutralt', emoji: '😐', color: '#eab308' },
    { value: 4, label: 'Bra', emoji: '😊', color: '#84cc16' },
    { value: 5, label: 'Mycket bra', emoji: '😄', color: '#10b981' },
];
export const MOOD_OPTIONS: { rating: number; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😩', label: 'Mycket dåligt / Helt slut' },
  { rating: 2, emoji: '😟', label: 'Ganska dåligt / Trött' },
  { rating: 3, emoji: '😐', label: 'Neutralt / Okej' },
  { rating: 4, emoji: '😊', label: 'Ganska bra / Pigg' },
  { rating: 5, emoji: '😄', label: 'Mycket bra / Toppenform' },
];


export const STRENGTH_LEVEL_ORDER: StrengthLevel[] = ['Otränad', 'Nybörjare', 'Medelgod', 'Avancerad', 'Elit'];
export const ALL_LIFT_TYPES: LiftType[] = ([
  'Knäböj',
  'Bänkpress',
  'Marklyft',
  'Axelpress',
  'Chins / Pullups',
  'Frontböj',
  'Clean', // Frivändning
  'Bulgarian Split Squat',
  'RDL', // Rumänska marklyft
  'Farmer’s Walk',
  'Snatch Grip Deadlift', // Ryckmarklyft
  'Clean & Press', // Frivändning med Press/Stöt
  'Push Press',
  'Hantelrodd',
  'Goblet Squat',
  'Thrusters',
  'Stående Rodd'
] as LiftType[]).sort((a, b) => a.localeCompare(b, 'sv'));

export const BASE_LIFT_TYPE_OPTIONS: { value: LiftType | ''; label: string }[] = [
  { value: '', label: 'Ingen specifik / Annan' },
  ...ALL_LIFT_TYPES.map(lift => ({ value: lift, label: lift })),
];


const BODYWEIGHT_CATEGORIES_KG = [
  { min: 40, max: 50 }, { min: 51, max: 60 }, { min: 61, max: 70 },
  { min: 71, max: 80 }, { min: 81, max: 90 }, { min: 91, max: 100 },
  { min: 101, max: 110 }, { min: 111, max: 120 }, { min: 121, max: 150 },
];

const generateStandards = (
  lift: LiftType,
  gender: 'Man' | 'Kvinna',
  multipliersForLift: UserProvidedLiftMultipliers
): StrengthStandard[] => {
  const genderKey = gender === 'Man' ? 'män' : 'kvinnor';
  const genderData = multipliersForLift[genderKey];

  if (!genderData || !genderData.bas || genderData.bas.length !== STRENGTH_LEVEL_ORDER.length) {
    // console.warn(`Multipliers for ${gender} in ${lift} are missing or incomplete. Check USER_PROVIDED_STRENGTH_MULTIPLIERS.`); // Removed for cleaner console
    return [];
  }

  return BODYWEIGHT_CATEGORIES_KG.map(bwCat => {
    const standardsDetails: StrengthStandardDetail[] = STRENGTH_LEVEL_ORDER.map((level, index) => {
      const bodyweightForCalc = bwCat.min;
      const baseMultiplier = genderData.bas[index];
      const weightKg = parseFloat((bodyweightForCalc * baseMultiplier).toFixed(1));
      return { level, weightKg };
    });
    return {
      lift,
      gender,
      bodyweightCategoryKg: { min: bwCat.min, max: bwCat.max },
      standards: standardsDetails
    };
  });
};

export const STRENGTH_STANDARDS_DATA: StrengthStandard[] = (['Knäböj', 'Marklyft', 'Bänkpress', 'Axelpress'] as const).flatMap(lift => {
  const multipliers = USER_PROVIDED_STRENGTH_MULTIPLIERS[lift.toLowerCase() as keyof typeof USER_PROVIDED_STRENGTH_MULTIPLIERS];
  const menStandards = generateStandards(lift, 'Man', multipliers);
  const womenStandards = generateStandards(lift, 'Kvinna', multipliers);
  return [...menStandards, ...womenStandards];
});

export const CLUB_DEFINITIONS: ClubDefinition[] = [
    // Session Clubs
    { id: 'sessions-10', name: '10-passklubben', description: 'Välkommen! Du har loggat dina första 10 pass.', icon: '🎉', type: 'SESSION_COUNT', threshold: 10 },
    { id: 'sessions-50', name: '50-passklubben', description: 'Stammis! Du har loggat 50 pass.', icon: '💪', type: 'SESSION_COUNT', threshold: 50 },
    { id: 'sessions-100', name: '100-passklubben', description: 'Medlemmar som har loggat 100 eller fler pass.', icon: '💯', type: 'SESSION_COUNT', threshold: 100 },
    { id: 'sessions-250', name: '250-passklubben', description: 'Lojala medlemmar som har loggat 250 eller fler pass.', icon: '🌟', type: 'SESSION_COUNT', threshold: 250 },
    { id: 'sessions-500', name: '500-passklubben', description: 'Legendstatus! 500 loggade pass.', icon: '👑', type: 'SESSION_COUNT', threshold: 500 },

    // Bodyweight Lifts
    { id: 'bw-bench-0.75', name: '75% Kroppsvikt Bänkpress', description: 'Pressat 75% av din kroppsvikt i bänkpress.', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Bänkpress', multiplier: 0.75 },
    { id: 'bw-bench-1.0', name: 'Kroppsvikten i Bänkpress', description: 'Pressat din egen kroppsvikt i bänkpress!', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Bänkpress', multiplier: 1.0 },
    { id: 'bw-bench-1.25', name: '125% Kroppsvikt Bänkpress', description: 'Pressat 1.25x din kroppsvikt i bänkpress.', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Bänkpress', multiplier: 1.25 },
    { id: 'bw-squat-1.0', name: 'Kroppsvikten i Knäböj', description: 'Böjt din egen kroppsvikt!', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Knäböj', multiplier: 1.0 },
    { id: 'bw-squat-1.5', name: '150% Kroppsvikt Knäböj', description: 'Böjt 1.5x din kroppsvikt.', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Knäböj', multiplier: 1.5 },
    { id: 'bw-deadlift-1.5', name: '150% Kroppsvikt Marklyft', description: 'Dragit 1.5x din kroppsvikt.', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Marklyft', multiplier: 1.5 },
    { id: 'bw-deadlift-2.0', name: 'Dubbla Kroppsvikten i Marklyft', description: 'Dragit 2x din kroppsvikt!', icon: '⚖️', type: 'BODYWEIGHT_LIFT', liftType: 'Marklyft', multiplier: 2.0 },

    // Bench Press Clubs (Absolute)
    { id: 'bench-40', name: '40kg Bänkpress', description: 'Medlemmar som pressat 40kg i bänkpress.', icon: '🏋️‍♀️', type: 'LIFT', liftType: 'Bänkpress', threshold: 40 },
    { id: 'bench-60', name: '60kg Bänkpress', description: 'Medlemmar som pressat 60kg i bänkpress.', icon: '🏋️‍♀️', type: 'LIFT', liftType: 'Bänkpress', threshold: 60 },
    { id: 'bench-80', name: '80kg Bänkpress', description: 'Starkt! Du har pressat 80kg i bänkpress.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Bänkpress', threshold: 80 },
    { id: 'bench-100', name: '100kg Bänkpress', description: 'Klassisk milstolpe! Medlemmar som har pressat 100kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Bänkpress', threshold: 100 },
    { id: 'bench-125', name: '125kg Bänkpress', description: 'Imponerande! Du har pressat 125kg eller mer.', icon: '🏆', type: 'LIFT', liftType: 'Bänkpress', threshold: 125 },
    { id: 'bench-150', name: '150kg Bänkpress', description: 'Elitnivå! Du har pressat 150kg eller mer.', icon: '👑', type: 'LIFT', liftType: 'Bänkpress', threshold: 150 },

    // Squat Clubs (Absolute)
    { id: 'squat-60', name: '60kg Knäböj', description: 'Medlemmar som böjt 60kg.', icon: '🏋️‍♀️', type: 'LIFT', liftType: 'Knäböj', threshold: 60 },
    { id: 'squat-80', name: '80kg Knäböj', description: 'Starkt jobbat! Du har böjt 80kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Knäböj', threshold: 80 },
    { id: 'squat-100', name: '100kg Knäböj', description: 'Tresiffrigt! Du har böjt 100kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Knäböj', threshold: 100 },
    { id: 'squat-140', name: '140kg Knäböj', description: 'Väldigt starkt! Du har böjt 140kg.', icon: '🏆', type: 'LIFT', liftType: 'Knäböj', threshold: 140 },
    { id: 'squat-180', name: '180kg Knäböj', description: 'Elitnivå! Du har böjt 180kg eller mer.', icon: '👑', type: 'LIFT', liftType: 'Knäböj', threshold: 180 },

    // Deadlift Clubs (Absolute)
    { id: 'deadlift-80', name: '80kg Marklyft', description: 'Medlemmar som dragit 80kg i marklyft.', icon: '🏋️‍♀️', type: 'LIFT', liftType: 'Marklyft', threshold: 80 },
    { id: 'deadlift-100', name: '100kg Marklyft', description: 'Tresiffrigt! Du har dragit 100kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Marklyft', threshold: 100 },
    { id: 'deadlift-140', name: '140kg Marklyft', description: 'Starkt! Du har dragit 140kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Marklyft', threshold: 140 },
    { id: 'deadlift-180', name: '180kg Marklyft', description: 'Väldigt starkt! Du har dragit 180kg.', icon: '🏆', type: 'LIFT', liftType: 'Marklyft', threshold: 180 },
    { id: 'deadlift-220', name: '220kg Marklyft', description: 'Elitnivå! Du har dragit 220kg eller mer.', icon: '👑', type: 'LIFT', liftType: 'Marklyft', threshold: 220 },

    // Overhead Press Clubs (Absolute)
    { id: 'axelpress-30', name: '30kg Axelpress', description: 'Snygg start! Du har pressat 30kg.', icon: '🏋️‍♀️', type: 'LIFT', liftType: 'Axelpress', threshold: 30 },
    { id: 'axelpress-40', name: '40kg Axelpress', description: 'Starkt! Du har pressat 40kg.', icon: '🏋️‍♂️', type: 'LIFT', liftType: 'Axelpress', threshold: 40 },
    { id: 'axelpress-50', name: '50kg Axelpress', description: 'Imponerande axelstyrka! Du har pressat 50kg.', icon: '🏆', type: 'LIFT', liftType: 'Axelpress', threshold: 50 },
    { id: 'axelpress-60', name: '60kg Axelpress', description: 'Elitnivå! Du har pressat 60kg eller mer.', icon: '👑', type: 'LIFT', liftType: 'Axelpress', threshold: 60 },

    // Conditioning Clubs
    { id: 'row-2000m-sub8', name: 'Sub 8:00 2000m Rodd', description: 'Rott 2000 meter under 8 minuter.', icon: '🚣', type: 'CONDITIONING', conditioningMetric: 'rower2000mTimeSeconds', threshold: 480, comparison: 'LESS_OR_EQUAL' },
    { id: 'row-2000m-sub730', name: 'Sub 7:30 2000m Rodd', description: 'Mycket starkt! Rott 2000 meter under 7:30.', icon: '🚣‍♀️', type: 'CONDITIONING', conditioningMetric: 'rower2000mTimeSeconds', threshold: 450, comparison: 'LESS_OR_EQUAL' },
    { id: 'airbike-4min-50kcal', name: '50 kcal på 4 min Airbike', description: 'Klarat 50 kcal på 4-minuterstestet.', icon: '💨', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
    { id: 'airbike-4min-60kcal', name: '60 kcal på 4 min Airbike', description: 'Stark motor! Klarat 60 kcal på 4-minuterstestet.', icon: '💨', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
    { id: 'airbike-4min-70kcal', name: '70 kcal på 4 min Airbike', description: 'Elit-flås! Klarat 70 kcal på 4-minuterstestet.', icon: '🌪️', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 70, comparison: 'GREATER_OR_EQUAL' },
    { id: 'skierg-4min-1000m', name: '1000m på 4 min SkiErg', description: 'Stark uthållighet! 1000 meter på 4 minuter.', icon: '⛷️', type: 'CONDITIONING', conditioningMetric: 'skierg4MinMeters', threshold: 1000, comparison: 'GREATER_OR_EQUAL' },
];

export const LEVEL_COLORS_HEADER: { [key in StrengthLevel]: string } = {
  'Otränad': '#ef4444',
  'Nybörjare': '#f97316',
  'Medelgod': '#eab308',
  'Avancerad': '#84cc16',
  'Elit': '#14b8a6',
};

export const MAIN_LIFTS_CONFIG_HEADER: { lift: LiftType, statKey: keyof UserStrengthStat, label: string }[] = [
    { lift: 'Knäböj', statKey: 'squat1RMaxKg', label: 'Knäböj (1RM)'},
    { lift: 'Bänkpress', statKey: 'benchPress1RMaxKg', label: 'Bänkpress (1RM)'},
    { lift: 'Marklyft', statKey: 'deadlift1RMaxKg', label: 'Marklyft (1RM)'},
    { lift: 'Axelpress', statKey: 'overheadPress1RMaxKg', label: 'Axelpress (1RM)'},
];