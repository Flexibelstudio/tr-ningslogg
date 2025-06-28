


import { WeightComparisonItem, GenderOption, StrengthStandard, StrengthLevel, LiftType, AllUserProvidedStrengthMultipliers, StrengthStandardDetail, UserProvidedLiftMultipliers, WorkoutCategory, IntensityLevel } from './types'; // Updated import type from AnimalWeight

export const FLEXIBEL_PRIMARY_COLOR = '#51A1A1'; // Updated color
export const APP_NAME = 'Träningslogg';

export const LOCAL_STORAGE_KEYS = {
  USER_ROLE: 'flexibel_userRole',
  WORKOUTS: 'flexibel_workouts',
  WORKOUT_LOGS: 'flexibel_workoutLogs',
  GENERAL_ACTIVITY_LOGS: 'flexibel_generalActivityLogs',
  PARTICIPANT_WORKOUT_NOTES: 'flexibel_participantWorkoutNotes',
  PARTICIPANT_GOALS: 'flexibel_participantGoals',
  PARTICIPANT_PROFILE: 'flexibel_participantProfile',
  PARTICIPANT_STRENGTH_STATS: 'flexibel_participantStrengthStats',
  PARTICIPANT_CONDITIONING_STATS: 'flexibel_participantConditioningStats',
  PARTICIPANT_MENTAL_WELLBEING: 'flexibel_participantMentalWellbeing', 
  PARTICIPANT_GAMIFICATION_STATS: 'flexibel_participantGamificationStats',
  WELCOME_MESSAGE_SHOWN_PARTICIPANT: 'flexibel_welcomeMessageShown_participant',
  LAST_FEEDBACK_PROMPT_TIME: 'flexibel_lastFeedbackPromptTime', 
};

export const GENDER_OPTIONS: { value: GenderOption, label: string }[] = [
    { value: 'Man', label: 'Man' },
    { value: 'Kvinna', label: 'Kvinna' },
    { value: 'Annat', label: 'Annat' },
    { value: 'Vill ej ange', label: 'Vill ej ange' },
];

export const WORKOUT_CATEGORY_OPTIONS: { value: WorkoutCategory, label: string }[] = [
    { value: 'PT-bas', label: 'PT-bas' },
    { value: 'PT-grupp', label: 'PT-grupp' },
    { value: 'Annat', label: 'Annat' },
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


export const WEIGHT_COMPARISONS: WeightComparisonItem[] = [ // Renamed from ANIMAL_WEIGHTS and type updated
  // Original Animals
  { name: 'Kolibri', pluralName: 'Kolibrier', weightKg: 0.005, emoji: '🐦' },
  { name: 'Mus', pluralName: 'Möss', weightKg: 0.02, emoji: '🐭' },
  
  // New Fun Items - Lighter
  { name: 'Påse Chips (stor)', pluralName: 'Stora Chipspåsar', weightKg: 0.2, emoji: '🍟' },
  { name: 'Liter Mjölk', pluralName: 'Liter Mjölk', weightKg: 1, emoji: '🥛' },
  { name: 'Ananas', pluralName: 'Ananaser', weightKg: 1.5, emoji: '🍍' },
  { name: 'Tegelsten', pluralName: 'Tegelstenar', weightKg: 2.5, emoji: '🧱' },

  // Original Animals
  { name: 'Katt', pluralName: 'Katter', weightKg: 4.5, emoji: '🐱' },
  { name: 'Räv', pluralName: 'Rävar', weightKg: 7, emoji: '🦊' },

  // New Fun Items - Medium
  { name: 'Bildäck', pluralName: 'Bildäck', weightKg: 10, emoji: '⚫' },
  { name: 'Jaffa Apelsinlåda', pluralName: 'Jaffa Apelsinlådor', weightKg: 15, emoji: '🍊' },
  { name: 'Mellanstor Hund', pluralName: 'Mellanstora Hundar', weightKg: 20, emoji: '🐶' }, // Original Animal
  { name: 'Stor Resväska (packad)', pluralName: 'Stora Resväskor', weightKg: 23, emoji: '🧳' },
  { name: 'Säck Potatis', pluralName: 'Säckar Potatis', weightKg: 25, emoji: '🥔' },
  
  // Original Animals
  { name: 'Varg', pluralName: 'Vargar', weightKg: 40, emoji: '🐺' },
  
  // New Fun Items - Medium-Heavy
  { name: 'Cementblandare (liten)', pluralName: 'Små Cementblandare', weightKg: 50, emoji: '🛠️' },
  { name: 'Full Öl-keg', pluralName: 'Fulla Öl-keggar', weightKg: 60, emoji: '🍺' },
  
  // Original Animals
  { name: 'Människa (genomsnitt)', pluralName: 'Människor', weightKg: 70, emoji: '🧑' },
  { name: 'Lejon', pluralName: 'Lejon', weightKg: 190, emoji: '🦁' },

  // New Fun Items - Heavy
  { name: 'Piano (litet upprätt)', pluralName: 'Små Pianon', weightKg: 150, emoji: '🎹' },
  { name: 'Motorcykel (lätt)', pluralName: 'Lätta Motorcyklar', weightKg: 200, emoji: '🏍️' },
  
  // Original Animals
  { name: 'Grizzlybjörn', pluralName: 'Grizzlybjörnar', weightKg: 300, emoji: '🐻' },
  { name: 'Häst', pluralName: 'Hästar', weightKg: 500, emoji: '🐴' },
  { name: 'Ko', pluralName: 'Kor', weightKg: 750, emoji: '🐮' },
  
  // New Fun Items - Very Heavy
  { name: 'Smartbil', pluralName: 'Smartbilar', weightKg: 700, emoji: '🚗' },
  
  // Original Animals
  { name: 'Späckhuggare (kalv)', pluralName: 'Späckhuggarkalvar', weightKg: 1000, emoji: '🐳' },
  { name: 'Noshörning', pluralName: 'Noshörningar', weightKg: 2300, emoji: '🦏' },
  { name: 'Elefant (Afrikansk)', pluralName: 'Elefanter', weightKg: 5000, emoji: '🐘' },
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
      standards: standardsDetails,
    };
  });
};

export const STRENGTH_STANDARDS_DATA: StrengthStandard[] = [];

ALL_LIFT_TYPES.forEach(liftType => {
  let liftKeyLookup = liftType.toLowerCase() as keyof AllUserProvidedStrengthMultipliers;

  const validMultiplierKeys = Object.keys(USER_PROVIDED_STRENGTH_MULTIPLIERS) as Array<keyof AllUserProvidedStrengthMultipliers>;
  
  if (validMultiplierKeys.includes(liftKeyLookup)) {
    const multipliersForThisLift = USER_PROVIDED_STRENGTH_MULTIPLIERS[liftKeyLookup];
    if (multipliersForThisLift) {
        const maleStandards = generateStandards(liftType, 'Man', multipliersForThisLift);
        const femaleStandards = generateStandards(liftType, 'Kvinna', multipliersForThisLift);
        
        STRENGTH_STANDARDS_DATA.push(...maleStandards);
        STRENGTH_STANDARDS_DATA.push(...femaleStandards);
    } else {
        // console.warn(`No multipliers found for lift: ${liftType} (using key: ${liftKeyLookup}) in USER_PROVIDED_STRENGTH_MULTIPLIERS. Skipping standard generation for this lift.`); // Removed
    }
  } else {
    // console.log(`LiftType "${liftType}" does not have defined multipliers for strength standards calculation. Skipping standard generation.`); // Removed
  }
});


if (STRENGTH_STANDARDS_DATA.length === 0 &&
    (ALL_LIFT_TYPES.includes('Knäböj') || ALL_LIFT_TYPES.includes('Marklyft') || ALL_LIFT_TYPES.includes('Bänkpress') || ALL_LIFT_TYPES.includes('Axelpress'))) {
    // console.warn("STRENGTH_STANDARDS_DATA is empty after generation for base lifts. Check USER_PROVIDED_STRENGTH_MULTIPLIERS and generateStandards function."); // Removed
}


// Constants for Mental Wellbeing Scales
export const LEVEL_COLORS_INDICATOR: { [key in StrengthLevel]: string } = {
  'Otränad': '#ef4444',
  'Nybörjare': '#f97316',
  'Medelgod': '#eab308',
  'Avancerad': '#84cc16',
  'Elit': '#14b8a6',
};

export const STRESS_LEVEL_OPTIONS: { value: number; label: string; emoji: string; color: string }[] = [
  { value: 1, label: 'Mycket låg', emoji: '😌', color: LEVEL_COLORS_INDICATOR['Elit'] },
  { value: 2, label: 'Låg', emoji: '😊', color: LEVEL_COLORS_INDICATOR['Avancerad'] },
  { value: 3, label: 'Måttlig', emoji: '😐', color: LEVEL_COLORS_INDICATOR['Medelgod'] },
  { value: 4, label: 'Hög', emoji: '😟', color: LEVEL_COLORS_INDICATOR['Nybörjare'] },
  { value: 5, label: 'Mycket hög', emoji: '😩', color: LEVEL_COLORS_INDICATOR['Otränad'] },
];

export const ENERGY_LEVEL_OPTIONS: { value: number; label: string; emoji: string; color: string }[] = [
  { value: 1, label: 'Mycket låg', emoji: '😩', color: LEVEL_COLORS_INDICATOR['Otränad'] },
  { value: 2, label: 'Låg', emoji: '😟', color: LEVEL_COLORS_INDICATOR['Nybörjare'] },
  { value: 3, label: 'Medel', emoji: '😐', color: LEVEL_COLORS_INDICATOR['Medelgod'] },
  { value: 4, label: 'Hög', emoji: '😊', color: LEVEL_COLORS_INDICATOR['Avancerad'] },
  { value: 5, label: 'Mycket hög', emoji: '😄', color: LEVEL_COLORS_INDICATOR['Elit'] },
];

export const SLEEP_QUALITY_OPTIONS: { value: number; label: string; emoji: string; color: string }[] = [
  { value: 1, label: 'Mycket dålig', emoji: '😴', color: LEVEL_COLORS_INDICATOR['Otränad'] }, // Using sleep emoji
  { value: 2, label: 'Dålig', emoji: '😟', color: LEVEL_COLORS_INDICATOR['Nybörjare'] },
  { value: 3, label: 'Okej', emoji: '😐', color: LEVEL_COLORS_INDICATOR['Medelgod'] },
  { value: 4, label: 'Bra', emoji: '😊', color: LEVEL_COLORS_INDICATOR['Avancerad'] },
  { value: 5, label: 'Mycket bra', emoji: '😌', color: LEVEL_COLORS_INDICATOR['Elit'] }, // Using relaxed emoji
];

export const OVERALL_MOOD_OPTIONS: { value: number; label: string; emoji: string; color: string }[] = [
  { value: 1, label: 'Mycket dåligt', emoji: '😩', color: LEVEL_COLORS_INDICATOR['Otränad'] },
  { value: 2, label: 'Dåligt', emoji: '😟', color: LEVEL_COLORS_INDICATOR['Nybörjare'] },
  { value: 3, label: 'Neutralt', emoji: '😐', color: LEVEL_COLORS_INDICATOR['Medelgod'] },
  { value: 4, label: 'Bra', emoji: '😊', color: LEVEL_COLORS_INDICATOR['Avancerad'] },
  { value: 5, label: 'Mycket bra', emoji: '😄', color: LEVEL_COLORS_INDICATOR['Elit'] },
];

// New constants for PT-bas Intensity Levels
export interface IntensityLevelDetail {
  value: IntensityLevel;
  label: string;
  defaultReps: string;
  focus: string;
  defaultInstructions: string;
  pbSuggestion?: string; 
}

export const INTENSITY_LEVELS: IntensityLevelDetail[] = [
  {
    value: 'Lätt',
    label: 'Lätt (ca 12-15 reps)',
    defaultReps: 'ca 12-15 reps',
    focus: 'Muskeluthållighet och Teknik',
    defaultInstructions: 'Fokusera på kontrollerade rörelser och god kontakt med musklerna. Målet är att orka många repetitioner med bibehållen teknik. Välj en vikt som tillåter detta.',
  },
  {
    value: 'Medel',
    label: 'Medel (ca 8-10 reps)',
    defaultReps: 'ca 8-10 reps',
    focus: 'Muskeltillväxt och Styrka',
    defaultInstructions: 'Välj en vikt där du klarar 8-10 repetitioner med god form. Pressa dig själv, men inte till total failure på varje set. Det ska vara utmanande!',
  },
  {
    value: 'Tungt',
    label: 'Tungt (ca 3-5 reps)',
    defaultReps: 'ca 3-5 reps',
    focus: 'Maximal Styrka och PB-försök',
    defaultInstructions: 'Värm upp ordentligt! Fokusera på tunga lyft med perfekt teknik. Vila ordentligt mellan seten (2-3 minuter). Detta är månaden för att utmana dina maxvikter.',
    pbSuggestion: 'Detta är en tung månad! Ett utmärkt tillfälle att testa ditt 1RM på baslyften och uppdatera din styrkestatistik under "Styrka" i menyn om du slår nytt rekord.',
  },
];

export const INTENSITY_LEVEL_OPTIONS_FOR_SELECT: { value: IntensityLevel | ''; label: string }[] = [
    { value: '', label: 'Ej specificerat (Standard)' },
    ...INTENSITY_LEVELS.map(level => ({ value: level.value, label: level.label })),
];