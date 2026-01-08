// utils/workoutUtils.ts
export const calculateEstimated1RM = (weightStr?: number | string, repsStr?: number | string): number | null => {
    const weight = parseFloat(String(weightStr || '').replace(',', '.'));
    const reps = parseInt(String(repsStr || ''), 10);

    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return null;
    }
    
    // Begränsat till max 5 reps för att PB ska vara baserat på tung styrka
    if (reps > 5) {
        return null;
    }

    if (reps === 1) {
        return weight;
    }

    // Brzycki Formula
    const e1RM = weight / (1.0278 - (0.0278 * reps));

    if (e1RM < weight) {
        return null;
    }

    return (Math.round(e1RM * 2) / 2);
};