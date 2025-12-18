// utils/workoutUtils.ts
export const calculateEstimated1RM = (weightStr?: number | string, repsStr?: number | string): number | null => {
    const weight = parseFloat(String(weightStr || '').replace(',', '.'));
    const reps = parseInt(String(repsStr || ''), 10);

    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return null;
    }
    
    // Uppdaterat från 12 till 5 reps enligt nya regler för säkerhet/precision
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