// services/workoutService.ts
import { WorkoutLog, Workout, UserStrengthStat, PostWorkoutSummaryData, NewPB, NewBaseline, Exercise, LiftType } from '../types';
import { WEIGHT_COMPARISONS } from '../constants';
import { calculateEstimated1RM } from '../utils/workoutUtils';

/**
 * Calculates the "Effective" strength stats.
 */
export const calculateEffectiveStrengthStats = (history: UserStrengthStat[]): UserStrengthStat | null => {
    if (!history || history.length === 0) return null;

    const sortedHistory = [...history].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    const effectiveStats: UserStrengthStat = { ...sortedHistory[0] };

    const lifts: Array<{ valKey: keyof UserStrengthStat, statusKey: keyof UserStrengthStat }> = [
        { valKey: 'squat1RMaxKg', statusKey: 'squatVerificationStatus' },
        { valKey: 'benchPress1RMaxKg', statusKey: 'benchPressVerificationStatus' },
        { valKey: 'deadlift1RMaxKg', statusKey: 'deadliftVerificationStatus' },
        { valKey: 'overheadPress1RMaxKg', statusKey: 'overheadPressVerificationStatus' },
    ];

    for (const lift of lifts) {
        const validEntry = sortedHistory.find(stat => {
            const val = stat[lift.valKey];
            const status = stat[lift.statusKey] as string | undefined;
            if (val === undefined || val === null) return false;
            // Valid if: Legacy (no status), Verified OR Unverified (used for score but not marked with checkmark)
            if (!status || status === 'verified' || status === 'unverified') return true;
            return false;
        });

        if (validEntry) {
            (effectiveStats as any)[lift.valKey] = validEntry[lift.valKey];
            (effectiveStats as any)[lift.statusKey] = validEntry[lift.statusKey];
            
            if (lift.valKey === 'squat1RMaxKg') {
                effectiveStats.squatVerifiedBy = validEntry.squatVerifiedBy;
                effectiveStats.squatVerifiedDate = validEntry.squatVerifiedDate;
            }
            if (lift.valKey === 'benchPress1RMaxKg') {
                effectiveStats.benchPressVerifiedBy = validEntry.benchPressVerifiedBy;
                effectiveStats.benchPressVerifiedDate = validEntry.benchPressVerifiedDate;
            }
            if (lift.valKey === 'deadlift1RMaxKg') {
                effectiveStats.deadliftVerifiedBy = validEntry.deadliftVerifiedBy;
                effectiveStats.deadliftVerifiedDate = validEntry.deadliftVerifiedDate;
            }
            if (lift.valKey === 'overheadPress1RMaxKg') {
                effectiveStats.overheadPressVerifiedBy = validEntry.overheadPressVerifiedBy;
                effectiveStats.overheadPressVerifiedDate = validEntry.overheadPressVerifiedDate;
            }
        } else {
            (effectiveStats as any)[lift.valKey] = undefined;
            (effectiveStats as any)[lift.statusKey] = undefined;
        }
    }

    return effectiveStats;
};

export const calculatePostWorkoutSummary = (
    log: WorkoutLog,
    allWorkouts: Workout[],
    myWorkoutLogs: WorkoutLog[],
    strengthStatsHistory: UserStrengthStat[] | null
): PostWorkoutSummaryData => {
    let totalWeightLifted = 0;
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    let totalCaloriesKcal = 0;
    const bodyweightRepsSummary: { exerciseName: string; totalReps: number }[] = [];
    const newPBs: NewPB[] = [];
    const newBaselines: NewBaseline[] = [];
    const weightOnlyAchievements: { exerciseName: string; weight: number }[] = [];

    const workoutTemplate = allWorkouts.find(w => w.id === log.workoutId);
    
    const exercisesInThisLogSession = 
        (log.selectedExercisesForModifiable && log.selectedExercisesForModifiable.length > 0)
        ? log.selectedExercisesForModifiable
        : (workoutTemplate?.blocks || []).reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];

    const allTimePBs: Partial<UserStrengthStat> = {};
    if (strengthStatsHistory && strengthStatsHistory.length > 0) {
        strengthStatsHistory.forEach(stat => {
            if (stat.squat1RMaxKg && stat.squat1RMaxKg > (allTimePBs.squat1RMaxKg || 0)) allTimePBs.squat1RMaxKg = stat.squat1RMaxKg;
            if (stat.benchPress1RMaxKg && stat.benchPress1RMaxKg > (allTimePBs.benchPress1RMaxKg || 0)) allTimePBs.benchPress1RMaxKg = stat.benchPress1RMaxKg;
            if (stat.deadlift1RMaxKg && stat.deadlift1RMaxKg > (allTimePBs.deadlift1RMaxKg || 0)) allTimePBs.deadlift1RMaxKg = stat.deadlift1RMaxKg;
            if (stat.overheadPress1RMaxKg && stat.overheadPress1RMaxKg > (allTimePBs.overheadPress1RMaxKg || 0)) allTimePBs.overheadPress1RMaxKg = stat.overheadPress1RMaxKg;
        });
    }

    log.entries.forEach(entry => {
      const exerciseDetail = exercisesInThisLogSession.find(ex => ex.id === entry.exerciseId);
      if (!exerciseDetail) return;

      let maxWeightForExercise = 0;
      let maxRepsAtMaxWeight = 0;
      let maxRepsOverall = 0;
      let weightAtMaxRepsOverall = 0;
      let maxDistance = 0;
      let maxCalories = 0;
      let totalRepsForThisBodyweightExercise = 0;

      let bestSetForE1RM = { weight: 0, reps: 0 };
      let bestE1RMForExercise = 0;
      
      const isBodyweightExercise = exerciseDetail.isBodyweight;
      const isWeightOnlyExercise = entry.loggedSets.some(set => set.isCompleted && (Number(set.weight || 0)) > 0 && (Number(set.reps || 0) === 0));
      let maxWeightForWeightOnly = 0;

      entry.loggedSets.forEach(set => {
        const reps = Number(String(set.reps || '').replace(',', '.')) || 0;
        const weight = Number(String(set.weight || '').replace(',', '.')) || 0;
        const distance = Number(String(set.distanceMeters || '').replace(',', '.')) || 0;
        const duration = Number(String(set.durationSeconds || '').replace(',', '.')) || 0;
        const calories = Number(String(set.caloriesKcal || '').replace(',', '.')) || 0;

        if (set.isCompleted) {
            if (isBodyweightExercise) {
                totalRepsForThisBodyweightExercise += reps;
            } else if (!isWeightOnlyExercise && reps > 0 && weight > 0) {
              totalWeightLifted += weight * reps;
            } else if (isWeightOnlyExercise && weight > maxWeightForWeightOnly) {
                maxWeightForWeightOnly = weight;
            }
            
            totalDistanceMeters += distance;
            totalDurationSeconds += duration;
            totalCaloriesKcal += calories;

            if (weight > maxWeightForExercise) {
                maxWeightForExercise = weight;
                maxRepsAtMaxWeight = reps;
            } else if (weight === maxWeightForExercise && reps > maxRepsAtMaxWeight) {
                maxRepsAtMaxWeight = reps;
            }
            if (reps > maxRepsOverall) {
                maxRepsOverall = reps;
                weightAtMaxRepsOverall = weight;
            } else if (reps === maxRepsOverall && weight > weightAtMaxRepsOverall) {
                weightAtMaxRepsOverall = weight;
            }

            if (distance > maxDistance) maxDistance = distance;
            if (calories > maxCalories) maxCalories = calories;
            
            if (['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'].includes(exerciseDetail.name)) {
                const e1RM = calculateEstimated1RM(set.weight, set.reps);
                if (e1RM && e1RM > bestE1RMForExercise) {
                    bestE1RMForExercise = e1RM;
                    bestSetForE1RM = { weight, reps };
                }
            }
        }
      });

      if (isWeightOnlyExercise && maxWeightForWeightOnly > 0) {
        weightOnlyAchievements.push({ exerciseName: exerciseDetail.name, weight: maxWeightForWeightOnly });
      }

      if (isBodyweightExercise && totalRepsForThisBodyweightExercise > 0) {
        bodyweightRepsSummary.push({ exerciseName: exerciseDetail.name, totalReps: totalRepsForThisBodyweightExercise });
      }

      let historic1RMFromStrengthPage = 0;
      if (allTimePBs && exerciseDetail.name) {
          const liftName = exerciseDetail.name as LiftType;
          switch (liftName) {
              case 'Knäböj': historic1RMFromStrengthPage = allTimePBs.squat1RMaxKg || 0; break;
              case 'Bänkpress': historic1RMFromStrengthPage = allTimePBs.benchPress1RMaxKg || 0; break;
              case 'Marklyft': historic1RMFromStrengthPage = allTimePBs.deadlift1RMaxKg || 0; break;
              case 'Axelpress': historic1RMFromStrengthPage = allTimePBs.overheadPress1RMaxKg || 0; break;
          }
      }

      const previousLogsForThisExercise = myWorkoutLogs
        .filter(prevLog => prevLog.id !== log.id && new Date(prevLog.completedDate) < new Date(log.completedDate))
        .flatMap(prevLog => {
            const prevWorkoutTemplate = allWorkouts.find(w => w.id === prevLog.workoutId);
            const exercisesInPrevLogSession = 
                (prevLog.selectedExercisesForModifiable && prevLog.selectedExercisesForModifiable.length > 0)
                ? prevLog.selectedExercisesForModifiable
                : (prevWorkoutTemplate?.blocks || []).reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];
            
            const matchingPrevExercise = exercisesInPrevLogSession.find(ex => ex.name === exerciseDetail.name || (ex.baseLiftType && ex.baseLiftType === exerciseDetail.baseLiftType));
            if (matchingPrevExercise) {
                return prevLog.entries.filter(e => e.exerciseId === matchingPrevExercise.id);
            }
            return [];
        });

      let historicMaxWeightFromLogs = 0;
      let historicMaxRepsAtThatWeight = 0;
      let historicMaxRepsOverall = 0;
      let historicMaxDistance = 0;
      let historicMaxCalories = 0;
      let historicE1RMFromLogs = 0;

      previousLogsForThisExercise.forEach(prevEntry => {
        prevEntry.loggedSets.forEach(prevSet => {
          const prevWeight = Number(String(prevSet.weight || '').replace(',', '.')) || 0;
          const prevReps = Number(String(prevSet.reps || '').replace(',', '.')) || 0;
          const prevDistance = Number(String(prevSet.distanceMeters || '').replace(',', '.')) || 0;
          const prevCalories = Number(String(prevSet.caloriesKcal || '').replace(',', '.')) || 0;

          if (prevSet.isCompleted) {
            if (prevWeight > historicMaxWeightFromLogs) {
              historicMaxWeightFromLogs = prevWeight;
              historicMaxRepsAtThatWeight = prevReps;
            } else if (prevWeight === historicMaxWeightFromLogs && prevReps > historicMaxRepsAtThatWeight) {
              historicMaxRepsAtThatWeight = prevReps;
            }
            if (prevReps > historicMaxRepsOverall) {
              historicMaxRepsOverall = prevReps;
            }
            if (prevDistance > historicMaxDistance) historicMaxDistance = prevDistance;
            if (prevCalories > historicMaxCalories) historicMaxCalories = prevCalories;
            
            const historicE1RM = calculateEstimated1RM(prevSet.weight, prevSet.reps);
            if (historicE1RM && historicE1RM > historicE1RMFromLogs) {
                historicE1RMFromLogs = historicE1RM;
            }
          }
        });
      });
      
      const hasHistory = previousLogsForThisExercise.length > 0 || historic1RMFromStrengthPage > 0;

      if (!hasHistory) {
        let baselineValue = '';
        if (maxWeightForExercise > 0) baselineValue = `${maxWeightForExercise} kg x ${maxRepsAtMaxWeight} reps`;
        else if (maxRepsOverall > 0) baselineValue = `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`;
        else if (maxDistance > 0) baselineValue = `${maxDistance} m`;
        else if (maxCalories > 0) baselineValue = `${maxCalories} kcal`;

        if (baselineValue) {
          newBaselines.push({ exerciseName: exerciseDetail.name, value: baselineValue });
        }
      } else {
          const trueHistoricBestE1RM = Math.max(historicE1RMFromLogs, historic1RMFromStrengthPage);
          if (bestE1RMForExercise > trueHistoricBestE1RM) {
              newPBs.push({ 
                exerciseName: exerciseDetail.name, 
                achievement: "Nytt PB i vikt!", 
                value: `${bestSetForE1RM.weight} kg x ${bestSetForE1RM.reps} reps`,
                previousBest: trueHistoricBestE1RM > 0 ? `(tidigare ${trueHistoricBestE1RM.toFixed(1)} kg)` : undefined,
                baseLiftType: exerciseDetail.baseLiftType
              });
          }
          
          if (maxRepsOverall > 0 && maxRepsOverall > historicMaxRepsOverall && 
              !newPBs.some(pb => pb.exerciseName === exerciseDetail.name)) {
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i reps!", 
              value: `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`,
              previousBest: historicMaxRepsOverall > 0 ? `(tidigare ${historicMaxRepsOverall} reps)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }

          if (maxDistance > 0 && maxDistance > historicMaxDistance) {
            newPBs.push({ exerciseName: exerciseDetail.name, achievement: "Nytt PB i distans!", value: `${maxDistance} m`, previousBest: historicMaxDistance > 0 ? `(tidigare ${historicMaxDistance} m)` : undefined, baseLiftType: exerciseDetail.baseLiftType });
          }
          if (maxCalories > 0 && maxCalories > historicMaxCalories) {
            newPBs.push({ exerciseName: exerciseDetail.name, achievement: "Nytt PB i kalorier!", value: `${maxCalories} kcal`, previousBest: historicMaxCalories > 0 ? `(tidigare ${historicMaxCalories} kcal)` : undefined, baseLiftType: exerciseDetail.baseLiftType });
          }
      }
    });

    let animalEquivalent;
    const candidateComparisons = WEIGHT_COMPARISONS.filter(item => item.weightKg > 0 && totalWeightLifted >= item.weightKg && item.weightKg >= (totalWeightLifted / 150));

    if (candidateComparisons.length > 0) {
        const randomItem = candidateComparisons[Math.floor(Math.random() * candidateComparisons.length)];
        const count = Math.floor(totalWeightLifted / randomItem.weightKg);
        if (count > 0) {
          animalEquivalent = { name: randomItem.name, count: count, unitName: count === 1 ? randomItem.name : (randomItem.pluralName || randomItem.name), emoji: randomItem.emoji, article: randomItem.article };
        }
    }

    const previousLog = myWorkoutLogs.filter(prevLog => prevLog.workoutId === log.workoutId && prevLog.id !== log.id && new Date(prevLog.completedDate) < new Date(log.completedDate)).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
    let volumeDifferenceVsPrevious: number | undefined = undefined;
    const isFirstTimeLoggingWorkout = !previousLog || !previousLog.postWorkoutSummary;

    if (previousLog && previousLog.postWorkoutSummary) {
        volumeDifferenceVsPrevious = totalWeightLifted - previousLog.postWorkoutSummary.totalWeightLifted;
    }

    return { totalWeightLifted, newPBs, newBaselines, animalEquivalent, bodyweightRepsSummary, totalDistanceMeters, totalDurationSeconds, totalCaloriesKcal, weightOnlyAchievements, volumeDifferenceVsPrevious, isFirstTimeLoggingWorkout };
};

export const findAndUpdateStrengthStats = (
    log: WorkoutLog,
    workouts: Workout[],
    strengthStatsHistory: UserStrengthStat[]
): { needsUpdate: boolean, updatedStats: Partial<UserStrengthStat> } => {
    
    const latestStat = strengthStatsHistory.length > 0 
        ? [...strengthStatsHistory].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0]
        : null;

    const currentPBs: Partial<UserStrengthStat> = {
        squat1RMaxKg: latestStat?.squat1RMaxKg || 0,
        squatVerificationStatus: latestStat?.squatVerificationStatus,
        squatVerifiedBy: latestStat?.squatVerifiedBy,
        squatVerifiedDate: latestStat?.squatVerifiedDate,
        benchPress1RMaxKg: latestStat?.benchPress1RMaxKg || 0,
        benchPressVerificationStatus: latestStat?.benchPressVerificationStatus,
        benchPressVerifiedBy: latestStat?.benchPressVerifiedBy,
        benchPressVerifiedDate: latestStat?.benchPressVerifiedDate,
        deadlift1RMaxKg: latestStat?.deadlift1RMaxKg || 0,
        deadliftVerificationStatus: latestStat?.deadliftVerificationStatus,
        deadliftVerifiedBy: latestStat?.deadliftVerifiedBy,
        deadliftVerifiedDate: latestStat?.deadliftVerifiedDate,
        overheadPress1RMaxKg: latestStat?.overheadPress1RMaxKg || 0,
        overheadPressVerificationStatus: latestStat?.overheadPressVerificationStatus,
        overheadPressVerifiedBy: latestStat?.overheadPressVerifiedBy,
        overheadPressVerifiedDate: latestStat?.overheadPressVerifiedDate,
    };
    
    const newPBsFromLog: Partial<UserStrengthStat> = {};
    let needsUpdate = false;

    const workoutTemplate = workouts.find(w => w.id === log.workoutId);
    const allExercisesInTemplate = 
        (log.selectedExercisesForModifiable && log.selectedExercisesForModifiable.length > 0)
        ? log.selectedExercisesForModifiable
        : (workoutTemplate?.blocks || []).flatMap(b => b.exercises);

    log.entries.forEach(entry => {
        const exerciseDetail = allExercisesInTemplate.find(ex => ex.id === entry.exerciseId);
        if (!exerciseDetail) return;
        
        const liftType = exerciseDetail.name as LiftType;
        const mainLifts: LiftType[] = ['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'];

        if (mainLifts.includes(liftType)) {
            let bestE1RMInLog = 0;
            entry.loggedSets.forEach(set => {
                if (set.isCompleted) {
                    const e1RM = calculateEstimated1RM(set.weight, set.reps);
                    if (e1RM && e1RM > bestE1RMInLog) {
                        bestE1RMInLog = e1RM;
                    }
                }
            });

            const checkAndSetPB = (
                key: 'squat1RMaxKg' | 'benchPress1RMaxKg' | 'deadlift1RMaxKg' | 'overheadPress1RMaxKg',
                verificationKey: 'squatVerificationStatus' | 'benchPressVerificationStatus' | 'deadliftVerificationStatus' | 'overheadPressVerificationStatus'
            ) => {
                if (bestE1RMInLog > (currentPBs[key] || 0)) {
                    newPBsFromLog[key] = bestE1RMInLog;
                    // Standardstatus för nya rekord är nu 'unverified'
                    newPBsFromLog[verificationKey] = 'unverified';
                    needsUpdate = true;
                }
            };

            if (liftType === 'Knäböj') checkAndSetPB('squat1RMaxKg', 'squatVerificationStatus');
            if (liftType === 'Bänkpress') checkAndSetPB('benchPress1RMaxKg', 'benchPressVerificationStatus');
            if (liftType === 'Marklyft') checkAndSetPB('deadlift1RMaxKg', 'deadliftVerificationStatus');
            if (liftType === 'Axelpress') checkAndSetPB('overheadPress1RMaxKg', 'overheadPressVerificationStatus');
        }
    });
    
    const updatedStats = { ...currentPBs, ...newPBsFromLog };

    return { needsUpdate, updatedStats };
};