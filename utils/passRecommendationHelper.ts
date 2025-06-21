
import { PASS_BESKRIVNINGAR } from '../components/participant/passDescriptions';

interface Recommendation {
  name: string;
  motivation: string;
}

// Helper function to check for keywords in text
const containsKeywords = (text: string | undefined, keywords: string[]): boolean => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
};

export const getPassRecommendations = (
  score: number | undefined, // Flexibel Strength Score, can be used for fallbacks
  fitnessGoal: string | undefined,
  preferences: string | undefined
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const addedRecommendations = new Set<string>(); // To avoid duplicates

  const addRecommendation = (name: string, motivation: string) => {
    if (!addedRecommendations.has(name)) {
      recommendations.push({ name, motivation });
      addedRecommendations.add(name);
    }
  };

  // --- Analyze Preferences for PT-Enskild ---
  const ptEnskildKeywords = ["ensam", "enskild", "individuellt", "specifik skada", "rehab", "personlig hjälp", "stora utmaningar", "svårt", "komma över tröskel"];
  if (containsKeywords(preferences, ptEnskildKeywords) || containsKeywords(fitnessGoal, ptEnskildKeywords)) {
    addRecommendation("PT-Enskild", "För skräddarsydd vägledning och stöd anpassat exakt efter dina unika behov och förutsättningar.");
  }

  // --- Analyze Fitness Goals ---
  const styrkaKeywords = ["styrka", "starkare", "råstyrka", "maxstyrka", "lyfta tungt", "bli stark"];
  const hypertrofiKeywords = ["muskelmassa", "bygga muskler", "hypertrofi", "större muskler", "muskeltillväxt"];
  const konditionKeywords = ["kondition", "uthållighet", "flås", "springa", "cykla", "cardio", "löpn", "intervaller"];
  const aterhamtningRorlighetKeywords = ["återhämtning", "rörlighet", "flexibilitet", "stel", "avslappning", "stress", "lugn", "balans", "mjuka upp"];
  const viktnedgangKeywords = ["gå ner i vikt", "viktnedgång", "bränna fett", "fettförbränning", "forma kroppen"];
  const enkeltUpplaggKeywords = ["enkelt", "grundläggande", "nybörjare", "komma igång", "teknikfokus"];
  const variationKeywords = ["variation", "varierat", "olika övningar"];
  const yogaKeywords = ["yoga"];
  const mindfulnessKeywords = ["mindfulness", "meditation", "närvaro"];


  // Rule: Styrka och råstyrka, enkelt upplägg = PT-bas
  if (containsKeywords(fitnessGoal, styrkaKeywords) && (containsKeywords(fitnessGoal, enkeltUpplaggKeywords) || containsKeywords(preferences, enkeltUpplaggKeywords))) {
    addRecommendation("PT-bas", "För att bygga en solid grundstyrka med fokus på teknik och individuell anpassning.");
  }

  // Rule: Hypertrofi, styrka och variation = PT-grupp
  if (containsKeywords(fitnessGoal, hypertrofiKeywords) || (containsKeywords(fitnessGoal, styrkaKeywords) && containsKeywords(fitnessGoal, variationKeywords))) {
    addRecommendation("PT-grupp", "För effektiv muskeluppbyggnad och styrka med varierad träning i en motiverande grupp.");
  }
  
  // Rule: Kondition = HIIT
  if (containsKeywords(fitnessGoal, konditionKeywords) || containsKeywords(fitnessGoal, viktnedgangKeywords)) {
    addRecommendation("HIIT", "För maximal puls, effektiv fettförbränning och förbättrad kondition på kort tid.");
  }

  // Rule: Styrka, kondition = Workout
  if (containsKeywords(fitnessGoal, styrkaKeywords) && (containsKeywords(fitnessGoal, konditionKeywords) || containsKeywords(fitnessGoal, viktnedgangKeywords))) {
    addRecommendation("Workout", "För en allsidig träning som kombinerar funktionell styrka och kondition.");
  } else if (containsKeywords(fitnessGoal, styrkaKeywords) && recommendations.length < 2) { 
      // If only strength is mentioned and few recs yet, Workout can be a good addition
      addRecommendation("Workout", "För funktionell styrka och uthållighet, ett bra komplement till din styrketräning.");
  }


  // Rule: Återhämtning, rörlighet etc våra olika yogor och mindfulness
  if (containsKeywords(fitnessGoal, aterhamtningRorlighetKeywords)) {
    if (containsKeywords(fitnessGoal, yogaKeywords) || containsKeywords(fitnessGoal, ["stel", "flexibilitet"])) {
      addRecommendation("Yin Yoga", "För djup stretch, ökad rörlighet och skön avslappning.");
      addRecommendation("Postural Yoga", "För bättre hållning, kroppsmedvetenhet och lindring av spänningar.");
    }
    if (containsKeywords(fitnessGoal, mindfulnessKeywords) || containsKeywords(fitnessGoal, ["stress", "lugn", "fokus", "närvaro"])) {
      addRecommendation("Mindfulness", "För mental återhämtning, stressreduktion och ökat lugn i vardagen.");
    }
    // Generic if only general recovery/mobility terms
    if (!addedRecommendations.has("Yin Yoga") && !addedRecommendations.has("Postural Yoga") && !addedRecommendations.has("Mindfulness")) {
         addRecommendation("Yin Yoga", "Ett utmärkt pass för återhämtning och ökad rörlighet.");
    }
  }

  // --- Fallback Recommendations based on score or if no specific recommendations were added ---
  if (recommendations.length === 0 && score !== undefined) {
    if (score < 75) {
      addRecommendation("PT-bas", "Ett bra ställe att börja bygga styrka och teknik säkert.");
      addRecommendation("Workout", "För att bygga allsidig funktionell styrka och kondition.");
    } else if (score <= 90) {
      addRecommendation("PT-grupp", "Utveckla din styrka vidare med personlig guidning i en motiverande grupp.");
      addRecommendation("Workout", "Fortsätt bygga på din allsidiga styrka och kondition.");
    } else { // score > 90
      addRecommendation("PT-grupp", "För att utmana dig själv och bibehålla din höga nivå i en inspirerande miljö.");
      if(!addedRecommendations.has("HIIT")) addRecommendation("HIIT", "För högintensiv konditionsträning och explosivitet.");
    }
  }
  
  // If still no recommendations, add some general ones
  if (recommendations.length === 0) {
    addRecommendation("Workout", "Ett allsidigt pass som tränar både styrka och kondition.");
    addRecommendation("PT-bas", "Perfekt för att finslipa tekniken och bygga en stark grund.");
  }

  // Ensure max 3 recommendations
  return recommendations.slice(0, 3);
};
