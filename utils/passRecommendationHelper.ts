
import { ALL_PASS_INFO, DetailedPassInformation } from '../components/participant/passDescriptions';

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
  fssScore: number | undefined, // Flexibel Strength Score
  fitnessGoal: string | undefined,
  preferences: string | undefined
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const addedPassIds = new Set<string>();

  const addRecommendation = (pass: DetailedPassInformation, reason: string) => {
    if (!addedPassIds.has(pass.id) && recommendations.length < 3) {
      let motivation = `${pass.typeDescription} Fokus: ${pass.focusArea.join(', ').toLowerCase()}.`;
      if (reason) {
        motivation = `${reason}. ${motivation}`;
      }
      recommendations.push({ name: pass.name, motivation });
      addedPassIds.add(pass.id);
    }
  };

  const userGoalLower = fitnessGoal?.toLowerCase() || "";
  const userPrefsLower = preferences?.toLowerCase() || "";

  // Specific "PT-Enskild" logic based on keywords, as it's not a standard class in ALL_PASS_INFO
  const ptEnskildKeywords = ["ensam", "enskild", "individuellt", "specifik skada", "rehab", "personlig hjälp", "stora utmaningar", "svårt", "komma över tröskel", "skräddarsydd", "personlig tränare", "pt"];
  if (containsKeywords(fitnessGoal, ptEnskildKeywords) || containsKeywords(preferences, ptEnskildKeywords)) {
    if (!addedPassIds.has("PT-Enskild") && recommendations.length < 3) {
        recommendations.push({ name: "PT-Enskild", motivation: "För skräddarsydd vägledning och stöd anpassat exakt efter dina unika behov och förutsättningar." });
        addedPassIds.add("PT-Enskild");
    }
  }

  // NEW: Specific priority for strength goal
  const strengthGoalKeywords = ["styrka", "starkare", "maxlyft", "baslyft", "1rm"];
  if (containsKeywords(userGoalLower, strengthGoalKeywords)) {
      const priorityPasses = ['pt-bas', 'pt-grupp', 'workout'];
      for (const passId of priorityPasses) {
          if (recommendations.length >= 3) break;
          const pass = ALL_PASS_INFO.find(p => p.id === passId);
          if (pass && !addedPassIds.has(pass.id)) {
              addRecommendation(pass, `Rekommenderas för ditt mål att bli starkare`);
          }
      }
  }

  // NEW: Specific priority for cardio goal as requested
  const cardioGoalKeywords = ["kondition", "flås", "uthållighet", "cardio"];
  if (containsKeywords(userGoalLower, cardioGoalKeywords)) {
      const priorityPasses = ['hiit', 'workout', 'pt-grupp']; // User-specified correct order
      for (const passId of priorityPasses) {
          if (recommendations.length >= 3) break;
          const pass = ALL_PASS_INFO.find(p => p.id === passId);
          if (pass && !addedPassIds.has(pass.id)) {
              addRecommendation(pass, `Rekommenderas för ditt mål att förbättra konditionen`);
          }
      }
  }

  const scoredPasses: (DetailedPassInformation & { matchScore: number; matchReasons: string[] })[] = ALL_PASS_INFO.map(pass => {
    let score = 0;
    const reasons: string[] = [];

    const checkAndScore = (textToSearch: string, targets: string[], weight: number, reasonPrefix: string) => {
      targets.forEach(target => {
        if (textToSearch.includes(target.toLowerCase())) {
          score += weight;
          if (!reasons.includes(`${reasonPrefix} '${target}'`)) {
            reasons.push(`${reasonPrefix} '${target}'`);
          }
        }
      });
    };
    
    // Match goals against various pass attributes
    if (userGoalLower) {
      checkAndScore(userGoalLower, pass.keywords, 2, "Matchar nyckelord i mål");
      checkAndScore(userGoalLower, pass.focusArea.map(f => f.toLowerCase()), 3, "Matchar fokusområde");
      checkAndScore(userGoalLower, (pass.suitedForGoals || []).map(g => g.toLowerCase()), 4, "Passar utmärkt för mål");
      if (userGoalLower.includes(pass.name.toLowerCase())) { // Direct mention of pass name in goal
        score += 5;
        if (!reasons.includes(`Du nämnde ${pass.name} i dina mål`)) reasons.push(`Du nämnde ${pass.name} i dina mål`);
      }
    }

    // Match preferences
    if (userPrefsLower) {
      checkAndScore(userPrefsLower, pass.keywords, 2, "Matchar nyckelord i preferenser"); // Increased weight for preference keywords
      if (userPrefsLower.includes(pass.name.toLowerCase())) { // Direct mention of pass name in preferences
        score += 5;
        if (!reasons.includes(`Du nämnde ${pass.name} i dina preferenser`)) reasons.push(`Du nämnde ${pass.name} i dina preferenser`);
      }
      // Negative matching for preferences (e.g., "inte hopp" vs pass.keywords including "explosivitet")
      if (userPrefsLower.includes("inte") || userPrefsLower.includes("undvika")) {
        pass.keywords.forEach(kw => {
            if (userPrefsLower.includes(`inte ${kw.toLowerCase()}`) || userPrefsLower.includes(`undvika ${kw.toLowerCase()}`)) {
                score -= 3; // Penalize if preference explicitly avoids a keyword of the pass
            }
        });
      }
    }
    
    // Boost based on logging preference
    if (pass.loggingEnabled && (userPrefsLower.includes("logga") || userPrefsLower.includes("följa utveckling"))) {
        score += 2;
        if (!reasons.includes("Passar din önskan att logga och följa utveckling")) reasons.push("Passar din önskan att logga och följa utveckling");
    }

    return { ...pass, matchScore: score, matchReasons: reasons };
  })
  .filter(p => p.matchScore > 0) // Only consider passes with a positive match score
  .sort((a, b) => b.matchScore - a.matchScore);


  for (const scoredPass of scoredPasses) {
    if (recommendations.length >= 3) break;
    
    let primaryReason = "Rekommenderas";
    if (scoredPass.matchReasons.length > 0) {
      // Prioritize reasons related to "suitedForGoals" or direct mentions
      const suitedReason = scoredPass.matchReasons.find(r => r.includes("passar utmärkt för mål") || r.includes("Du nämnde"));
      primaryReason = suitedReason || scoredPass.matchReasons[0];
    }
    addRecommendation(scoredPass, primaryReason);
  }

  // Fallback Recommendations based on FSS score if few recommendations found
  if (recommendations.length < 2 && fssScore !== undefined) {
    let fallbackPassIds: string[] = [];
    if (fssScore < 75) fallbackPassIds = ['pt-bas', 'workout'];
    else if (fssScore <= 90) fallbackPassIds = ['pt-grupp', 'workout'];
    else fallbackPassIds = ['pt-grupp', 'hiit'];
    
    for (const id of fallbackPassIds) {
        if (recommendations.length >= 3) break;
        const pass = ALL_PASS_INFO.find(p => p.id === id);
        if (pass) {
            addRecommendation(pass, `Baserat på din FSS-poäng kan ${pass.name} vara ett bra val`);
        }
    }
  }
  
  // Absolute fallback if still not enough recommendations
  if (recommendations.length === 0) {
    const workoutPass = ALL_PASS_INFO.find(p => p.id === 'workout');
    if (workoutPass) addRecommendation(workoutPass, `${workoutPass.typeDescription}`);
    
    const ptBasPass = ALL_PASS_INFO.find(p => p.id === 'pt-bas');
    if (ptBasPass && recommendations.length < 2) addRecommendation(ptBasPass, `${ptBasPass.typeDescription}`);
    
    const ptGruppPass = ALL_PASS_INFO.find(p => p.id === 'pt-grupp');
    if (ptGruppPass && recommendations.length < 2) addRecommendation(ptGruppPass, `${ptGruppPass.typeDescription}`);
  }
  
  // Ensure unique final list based on pass name (in case PT-Enskild matches a class name, unlikely)
  const finalUniqueRecommendations: Recommendation[] = [];
  const finalAddedNames = new Set<string>();
  for (const rec of recommendations) {
      if (!finalAddedNames.has(rec.name) && finalUniqueRecommendations.length < 3) {
          finalUniqueRecommendations.push(rec);
          finalAddedNames.add(rec.name);
      }
  }

  return finalUniqueRecommendations;
};
