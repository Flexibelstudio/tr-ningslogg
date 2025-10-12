// functions/src/constants.ts
import { ClubDefinition } from "./types";

export const CLUB_DEFINITIONS: ClubDefinition[] = [
    // --- SESSION COUNT CLUBS ---
    { id: 'sessions-10', name: '10 Pass-klubben', description: 'Du har loggat 10 pass!', icon: '👏', type: 'SESSION_COUNT', threshold: 10, comparison: 'GREATER_OR_EQUAL' },
    { id: 'sessions-25', name: '25 Pass-klubben', description: 'Du har loggat 25 pass!', icon: '🙌', type: 'SESSION_COUNT', threshold: 25, comparison: 'GREATER_OR_EQUAL' },
    { id: 'sessions-50', name: '50 Pass-klubben', description: 'Du har loggat 50 pass! Bra jobbat!', icon: '🎉', type: 'SESSION_COUNT', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
    { id: 'sessions-100', name: '100 Pass-klubben', description: 'Du har loggat 100 pass! Imponerande!', icon: '💯', type: 'SESSION_COUNT', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
    { id: 'sessions-250', name: '250 Pass-klubben', description: 'Du har loggat 250 pass! Vilken dedikation!', icon: '🌟', type: 'SESSION_COUNT', threshold: 250, comparison: 'GREATER_OR_EQUAL' },
    { id: 'sessions-500', name: '500 Pass-klubben', description: 'Du har loggat 500 pass! Du är en legend!', icon: '🏆', type: 'SESSION_COUNT', threshold: 500, comparison: 'GREATER_OR_EQUAL' },
  
    // --- TOTAL VOLUME CLUBS ---
    { id: 'volume-5000kg', name: '5 Ton-klubben', description: 'Starkt! Du har lyft 5000 kg under ett pass!', icon: '🚚', type: 'TOTAL_VOLUME', threshold: 5000, comparison: 'GREATER_OR_EQUAL' },
    { id: 'volume-10000kg', name: '10 Ton-klubben', description: 'Vilken volym! 10 000 kg under ett pass är otroligt!', icon: '🚀', type: 'TOTAL_VOLUME', threshold: 10000, comparison: 'GREATER_OR_EQUAL' },
  
    // --- BENCH PRESS (Bänkpress) CLUBS ---
    { id: 'bench-50kg', name: '50kg Bänkpressklubben', description: 'Du har lyft 50 kg i bänkpress!', icon: '💪', type: 'LIFT', liftType: 'Bänkpress', threshold: 50, comparison: 'GREATER_OR_EQUAL' },
    { id: 'bench-75kg', name: '75kg Bänkpressklubben', description: 'Du har lyft 75 kg i bänkpress!', icon: '🎯', type: 'LIFT', liftType: 'Bänkpress', threshold: 75, comparison: 'GREATER_OR_EQUAL' },
    { id: 'bench-100kg', name: '100kg Bänkpressklubben', description: 'Du har lyft 100 kg i bänkpress!', icon: '🔥', type: 'LIFT', liftType: 'Bänkpress', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
    
    // --- SQUAT (Knäböj) CLUBS ---
    { id: 'squat-60kg', name: '60kg Knäböjklubben', description: 'Du har lyft 60 kg i knäböj!', icon: '🦵', type: 'LIFT', liftType: 'Knäböj', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
    { id: 'squat-100kg', name: '100kg Knäböjklubben', description: 'Du har lyft 100 kg i knäböj!', icon: '🎯', type: 'LIFT', liftType: 'Knäböj', threshold: 100, comparison: 'GREATER_OR_EQUAL' },
    { id: 'squat-140kg', name: '140kg Knäböjklubben', description: 'Du har lyft 140 kg i knäböj!', icon: '🚀', type: 'LIFT', liftType: 'Knäböj', threshold: 140, comparison: 'GREATER_OR_EQUAL' },
  
    // --- DEADLIFT (Marklyft) CLUBS ---
    { id: 'deadlift-80kg', name: '80kg Marklyftklubben', description: 'Du har lyft 80 kg i marklyft!', icon: '🏋️', type: 'LIFT', liftType: 'Marklyft', threshold: 80, comparison: 'GREATER_OR_EQUAL' },
    { id: 'deadlift-120kg', name: '120kg Marklyftklubben', description: 'Du har lyft 120 kg i marklyft!', icon: '🔥', type: 'LIFT', liftType: 'Marklyft', threshold: 120, comparison: 'GREATER_OR_EQUAL' },
    { id: 'deadlift-160kg', name: '160kg Marklyftklubben', description: 'Du har lyft 160 kg i marklyft!', icon: '🏆', type: 'LIFT', liftType: 'Marklyft', threshold: 160, comparison: 'GREATER_OR_EQUAL' },
  
    // --- BODYWEIGHT LIFT CLUBS ---
    { id: 'bw-bench-1x', name: '1.0x Kroppsvikt Bänkpress', description: 'Du har bänkpressat din egen kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Bänkpress', multiplier: 1, comparison: 'GREATER_OR_EQUAL' },
    { id: 'bw-squat-1.5x', name: '1.5x Kroppsvikt Knäböj', description: 'Du har knäböjt 1.5 gånger din kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Knäböj', multiplier: 1.5, comparison: 'GREATER_OR_EQUAL' },
    { id: 'bw-deadlift-2x', name: '2.0x Kroppsvikt Marklyft', description: 'Du har marklyft dubbla din kroppsvikt!', icon: '🌟', type: 'BODYWEIGHT_LIFT', liftType: 'Marklyft', multiplier: 2, comparison: 'GREATER_OR_EQUAL' },
    
    // --- CONDITIONING CLUBS ---
    { id: 'airbike-60kcal', name: '60 kcal Airbike 4 min', description: 'Du har nått 60 kcal på 4 minuter på Airbike!', icon: '🔥', type: 'CONDITIONING', conditioningMetric: 'airbike4MinKcal', threshold: 60, comparison: 'GREATER_OR_EQUAL' },
    { id: 'rower-2k-sub8', name: 'Sub 8:00 2000m Rodd', description: 'Du har rott 2000m under 8 minuter!', icon: '🚣', type: 'CONDITIONING', conditioningMetric: 'rower2000mTimeSeconds', threshold: 480, comparison: 'LESS_OR_EQUAL' },
];
