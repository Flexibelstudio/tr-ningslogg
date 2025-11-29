
// passDescriptions.ts

export interface DetailedPassInformation {
  id: string; // e.g., 'pt-bas'
  name: string; // Display name e.g., "PT-BAS"
  focusArea: string[]; // Array of focus points
  loggingEnabled: boolean;
  coachRole: string;
  variation: 'Låg' | 'Medel' | 'Hög' | 'N/A'; // N/A if not specified
  equipment: string[]; // Array of equipment
  duration: string; // e.g., "40 min", "45-50 min"
  typeDescription: string; // General characteristic
  keywords: string[]; // For matching user input
  notes?: string[]; // Additional notes or clarifications
  suitedForGoals?: string[]; // Explicitly good for these goals.
}

export const ALL_PASS_INFO: DetailedPassInformation[] = [
  {
    id: 'pt-bas',
    name: "PT-BAS",
    focusArea: ["Maximal styrka", "baslyft", "teknik", "kroppskontroll"],
    loggingEnabled: true,
    coachRole: "Coach går runt, ger individuell feedback, korrigerar teknik.",
    variation: 'Låg', // (fasta lyft, varierande intensitet)
    equipment: ["Skivstänger", "vikter"],
    duration: "40 min",
    typeDescription: "Lugn, individanpassad träning med tydlig progression och coachning.",
    keywords: ["styrka", "baslyft", "teknik", "grundläggande", "nybörjare", "progression", "resultat", "trygghet", "komma igång", "undvika skador", "pt bas"],
    notes: [
      "Formar kroppen funktionellt och estetiskt, stärker inifrån och ut, förbättrar hållning.",
      "Ett pass för dig som vill ha lugnare träning, massor av resultat på kort tid och en riktigt bra start.",
      "Kan med fördel kombineras med 30 minuters HIIT direkt efter."
    ],
    suitedForGoals: ["Bli starkare", "Bygga muskler", "Förbättra teknik", "Komma igång med träning", "Bygga trygghet i gymmet", "Forma kroppen"]
  },
  {
    id: 'pt-grupp',
    name: "PT-GRUPP",
    focusArea: ["Styrka", "hypertrofi", "flås", "gemenskap"],
    loggingEnabled: true,
    coachRole: "Coach instruerar, ger individuell feedback, korrigerar teknik.",
    variation: 'Hög', // (nytt program varje månad)
    equipment: ["Kettlebells", "hantlar", "redskap"],
    duration: "60 min",
    typeDescription: "Personlig träning i grupp med fokus på styrka och kondition.",
    keywords: ["styrka", "muskeltillväxt", "hypertrofi", "kondition", "flås", "gemenskap", "variation", "rutin", "motivation", "pt grupp"],
    notes: [
      "Formar kroppen funktionellt och estetiskt, stärker inifrån och ut, förbättrar hållning."
    ],
    suitedForGoals: ["Bli starkare", "Bygga muskler", "Förbättra kondition", "Få träningsrutin", "Träna i grupp", "Forma kroppen"]
  },
  {
    id: 'workout',
    name: "WORKOUT",
    focusArea: ["Funktionell styrka", "kondition", "uthållighet"],
    loggingEnabled: false,
    coachRole: "Coach leder och deltar ofta i passet.",
    variation: 'Medel', // (månatligt upplägg)
    equipment: ["Kettlebells", "hantlar", "kroppsvikt"],
    duration: "45-50 min",
    typeDescription: "Helkroppspass med både styrka och flås.",
    keywords: ["funktionell styrka", "kondition", "uthållighet", "helkropp", "allsidig träning", "tålighet", "workout"],
    notes: [
      "Formar kroppen funktionellt och estetiskt, stärker inifrån och ut, förbättrar hållning."
    ],
    suitedForGoals: ["Bli starkare", "Förbättra kondition", "Allsidig träning", "Bli tåligare", "Forma kroppen"]
  },
  {
    id: 'hiit',
    name: "HIIT",
    focusArea: ["Kondition", "tempo", "puls", "explosivitet", "fettförbränning"],
    loggingEnabled: false,
    coachRole: "Coach leder och deltar.",
    variation: 'Medel',
    equipment: ["Kroppsvikt", "lätt utrustning"],
    duration: "30 min",
    typeDescription: "Intensivt, svettigt, kort och effektivt.",
    keywords: ["kondition", "puls", "explosivitet", "fettförbränning", "tempo", "högintensivt", "energi", "viktnedgång", "hiit", "högintensiv intervallträning"],
    suitedForGoals: ["Gå ner i vikt", "Förbättra kondition", "Öka energi", "Kort och effektiv träning"]
  },
  {
    id: 'funktionell-traning',
    name: "FUNKTIONELL TRÄNING",
    focusArea: ["Mjukare rörelse", "cirkelträning"],
    loggingEnabled: false,
    coachRole: "Coach leder och deltar.",
    variation: 'N/A', 
    equipment: ["Kroppsvikt", "lättare redskap", "gummiband"],
    duration: "N/A", 
    typeDescription: "Mjukare och varierad cirkelträning.",
    keywords: ["mjuk rörelse", "cirkelträning", "funktionell", "lågintensiv", "variation", "funktionell träning"],
    suitedForGoals: ["Varierad träning", "Lågintensiv träning", "Rörlighet", "Grundläggande styrka"]
  },
  {
    id: 'yin-yoga',
    name: "Yin Yoga",
    focusArea: ["djup rörlighet", "flexibilitet", "vila", "stillhet", "bindväv", "leder", "ligament", "stressreducering", "återhämtning", "inre balans"],
    loggingEnabled: false,
    coachRole: "Coach leder.",
    variation: 'Låg',
    equipment: ["Yogamatta", "bolster", "block", "filtar"],
    duration: "N/A",
    typeDescription: "Lugn, meditativ yogaform där positioner hålls 3-5 minuter för att nå djupare vävnader.",
    keywords: [
      "yin yoga", "yoga", "rörlighet", "flexibilitet", "vila", "stillhet", "bindväv", "leder", "ligament",
      "höfter", "ländrygg", "ben", "meridianer", "inre balans", "återhämtning", "stressreducering",
      "muskelspänningar", "landa i kroppen", "meditativ", "nybörjare", "van yogautövare", "stillasittande liv",
      "stressigt liv"
    ],
    notes: [
      "Förbättrar rörlighet och flexibilitet, särskilt i höfter, ländrygg och ben.",
      "Stimulerar kroppens energibanor (meridianer) och kan bidra till inre balans.",
      "Främjar återhämtning och stressreducering.",
      "Passar både nybörjare och vana yogautövare."
    ],
    suitedForGoals: ["Öka rörlighet / Minska stelhet", "Minska stress / Må bättre mentalt", "Förbättra återhämtning"]
  },
  {
    id: 'postural-yoga',
    name: "Postural Yoga",
    focusArea: ["hållning", "funktionella rörelsemönster", "muskelbalans", "stabilitet", "kroppskännedom", "andning"],
    loggingEnabled: false,
    coachRole: "Coach leder.",
    variation: 'Medel',
    equipment: ["Yogamatta", "block", "band"],
    duration: "N/A",
    typeDescription: "Långsam, medveten rörelseträning för bättre hållning, funktion och muskelbalans, ofta i samspel med andning.",
    keywords: [
      "postural yoga", "yoga", "hållning", "funktionell träning", "balans", "stabilitet", "rygg", "nacke", "axlar",
      "smärta", "spänningar", "kroppskännedom", "närvaro", "grundläggande styrka", "hållningsmuskler",
      "naturliga rörelsemönster", "stillasittande jobb", "stress", "inifrån"
    ],
    notes: [
      "Stärker kroppens hållningsmuskler.",
      "Minskar spänningar och smärta, särskilt i rygg, nacke och axlar.",
      "Återkopplar kroppen till ett naturligt och funktionellt rörelsemönster.",
      "Ökar kroppskännedom och närvaro."
    ],
    suitedForGoals: ["Förbättra hållning", "Minska smärta (rygg/nacke/axlar)", "Öka kroppsmedvetenhet", "Grundläggande funktionell styrka", "Minska spänningar"]
  },
  {
    id: 'mindfulness',
    name: "Mindfulness",
    focusArea: ["medveten närvaro", "mentalt lugn", "stressreducering", "fokus", "acceptans", "uppmärksamhet", "känslomässig balans", "sömn", "återhämtning"],
    loggingEnabled: false,
    coachRole: "Coach leder.",
    variation: 'Låg',
    equipment: ["Ingen specifik", "yogamatta", "filt", "sittkudde"],
    duration: "N/A",
    typeDescription: "Träning i medveten närvaro genom enkla övningar i stillhet eller rörelse, för att träna uppmärksamhet, lugn och acceptans.",
    keywords: [
      "mindfulness", "meditation", "närvaro", "lugn", "stress", "oro", "inre spänningar", "fokus", "acceptans",
      "känslomässig balans", "sömn", "återhämtning", "tankar", "känslor", "högt tempo", "kropp", "sinne"
    ],
    notes: [
      "Minskar stress, oro och inre spänningar.",
      "Ökar fokus, lugn och känslomässig balans.",
      "Förbättrar sömn och återhämtning.",
      "Ger verktyg för att hantera livets upp- och nedgångar."
    ],
    suitedForGoals: ["Minska stress / Må bättre mentalt", "Förbättra sömnkvalitet", "Öka fokus", "Hantera tankar och känslor", "Hitta återhämtning"]
  }
];
