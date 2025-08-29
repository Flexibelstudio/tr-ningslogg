// services/workoutService.ts
import { WorkoutLog, Workout, UserStrengthStat, PostWorkoutSummaryData, NewPB, NewBaseline, Exercise, LiftType } from '../types';
import { WEIGHT_COMPARISONS } from '../constants';
import { calculateEstimated1RM } from '../utils/workoutUtils';

export const calculatePostWorkoutSummary = (
    log: WorkoutLog,
    allWorkouts: Workout[],
    myWorkoutLogs: WorkoutLog[],
    latestStrengthStats: UserStrengthStat | null
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
        : workoutTemplate?.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];


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
      // Determine if this exercise should be treated as "weight-only" for the summary
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

            // PBs for weight/reps
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

            // PBs for new metrics
            if (distance > maxDistance) maxDistance = distance;
            if (calories > maxCalories) maxCalories = calories;
            
             // E1RM calculation for main lifts
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
        weightOnlyAchievements.push({
            exerciseName: exerciseDetail.name,
            weight: maxWeightForWeightOnly,
        });
      }

      if (isBodyweightExercise && totalRepsForThisBodyweightExercise > 0) {
        bodyweightRepsSummary.push({
            exerciseName: exerciseDetail.name,
            totalReps: totalRepsForThisBodyweightExercise,
        });
      }

      // Find historic 1RM from Strength page
      let historic1RMFromStrengthPage = 0;
      if (latestStrengthStats && exerciseDetail.name) {
          const liftName = exerciseDetail.name as LiftType;
          switch (liftName) {
              case 'Knäböj': historic1RMFromStrengthPage = latestStrengthStats.squat1RMaxKg || 0; break;
              case 'Bänkpress': historic1RMFromStrengthPage = latestStrengthStats.benchPress1RMaxKg || 0; break;
              case 'Marklyft': historic1RMFromStrengthPage = latestStrengthStats.deadlift1RMaxKg || 0; break;
              case 'Axelpress': historic1RMFromStrengthPage = latestStrengthStats.overheadPress1RMaxKg || 0; break;
          }
      }

      // Find historic max from previous workout LOGS
      const previousLogsForThisExercise = myWorkoutLogs
        .filter(prevLog => prevLog.id !== log.id && new Date(prevLog.completedDate) < new Date(log.completedDate))
        .flatMap(prevLog => {
            const prevWorkoutTemplate = allWorkouts.find(w => w.id === prevLog.workoutId);
            const exercisesInPrevLogSession = 
                (prevLog.selectedExercisesForModifiable && prevLog.selectedExercisesForModifiable.length > 0)
                ? prevLog.selectedExercisesForModifiable
                : prevWorkoutTemplate?.blocks.reduce((acc, block) => acc.concat(block.exercises), [] as Exercise[]) || [];
            
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
        if (maxWeightForExercise > 0) {
            baselineValue = `${maxWeightForExercise} kg x ${maxRepsAtMaxWeight} reps`;
        } else if (maxRepsOverall > 0) {
            baselineValue = `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`;
        } else if (maxDistance > 0) {
            baselineValue = `${maxDistance} m`;
        } else if (maxCalories > 0) {
            baselineValue = `${maxCalories} kcal`;
        }

        if (baselineValue) {
          newBaselines.push({
            exerciseName: exerciseDetail.name,
            value: baselineValue
          });
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
              !newPBs.some(pb => pb.exerciseName === exerciseDetail.name)) { // Avoid duplicate PBs for the same exercise
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i reps!", 
              value: `${maxRepsOverall} reps @ ${weightAtMaxRepsOverall > 0 ? `${weightAtMaxRepsOverall} kg` : 'kroppsvikt'}`,
              previousBest: historicMaxRepsOverall > 0 ? `(tidigare ${historicMaxRepsOverall} reps)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }

          if (maxDistance > 0 && maxDistance > historicMaxDistance) {
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i distans!", 
              value: `${maxDistance} m`,
              previousBest: historicMaxDistance > 0 ? `(tidigare ${historicMaxDistance} m)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }
          if (maxCalories > 0 && maxCalories > historicMaxCalories) {
            newPBs.push({ 
              exerciseName: exerciseDetail.name, 
              achievement: "Nytt PB i kalorier!", 
              value: `${maxCalories} kcal`,
              previousBest: historicMaxCalories > 0 ? `(tidigare ${historicMaxCalories} kcal)` : undefined,
              baseLiftType: exerciseDetail.baseLiftType
            });
          }
      }
    });

    let animalEquivalent;
    const maxCount = 150;
    const minWeightKgForItem = totalWeightLifted > 0 ? totalWeightLifted / maxCount : 0;

    const candidateComparisons = WEIGHT_COMPARISONS.filter(item =>
        item.weightKg > 0 &&
        totalWeightLifted >= item.weightKg &&
        item.weightKg >= minWeightKgForItem
    );

    if (candidateComparisons.length > 0) {
        const randomItem = candidateComparisons[Math.floor(Math.random() * candidateComparisons.length)];
        const count = Math.floor(totalWeightLifted / randomItem.weightKg);

        if (count > 0) {
          animalEquivalent = {
              name: randomItem.name,
              count: count,
              unitName: count === 1 ? randomItem.name : (randomItem.pluralName || randomItem.name),
              emoji: randomItem.emoji,
              article: randomItem.article,
          };
        }
    } else if (totalWeightLifted > 0) {
        const sortedWeightComparisons = [...WEIGHT_COMPARISONS].sort((a, b) => a.weightKg - b.weightKg);
        for (let i = sortedWeightComparisons.length - 1; i >= 0; i--) {
            const item = sortedWeightComparisons[i];
            if (totalWeightLifted >= item.weightKg && item.weightKg > 0) {
                const count = Math.floor(totalWeightLifted / item.weightKg);
                 if (count > 0) {
                    animalEquivalent = {
                        name: item.name,
                        count: count,
                        unitName: count === 1 ? item.name : (item.pluralName || item.name),
                        emoji: item.emoji,
                        article: item.article,
                    };
                    break;
                 }
            }
        }
    }

    return { totalWeightLifted, newPBs, newBaselines, animalEquivalent, bodyweightRepsSummary, totalDistanceMeters, totalDurationSeconds, totalCaloriesKcal, weightOnlyAchievements };
};

export const findAndUpdateStrengthStats = (
    log: WorkoutLog,
    workouts: Workout[],
    latestStrengthStats: UserStrengthStat | null
): { needsUpdate: boolean, updatedStats: Partial<UserStrengthStat> } => {
    let statsToUpdate: Partial<UserStrengthStat> = latestStrengthStats ? { ...latestStrengthStats } : {};
    let needsUpdate = false;
    
    const workoutTemplate = workouts.find(w => w.id === log.workoutId);
    if (!workoutTemplate || log.entries.length === 0) {
        return { needsUpdate: false, updatedStats: {} };
    }
    
    const allExercisesInTemplate = (log.selectedExercisesForModifiable && log.selectedExercisesForModifiable.length > 0)
        ? log.selectedExercisesForModifiable
        : workoutTemplate.blocks.flatMap(b => b.exercises);

    log.entries.forEach(entry => {
        const exerciseDetail = allExercisesInTemplate.find(ex => ex.id === entry.exerciseId);
        if (!exerciseDetail) return;
        const liftType = exerciseDetail.name as LiftType;

        if (['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'].includes(liftType)) {
            let bestE1RMInLog = 0;
            entry.loggedSets.forEach(set => {
                if (set.isCompleted && set.weight !== undefined && set.reps !== undefined) {
                    const e1RM = calculateEstimated1RM(set.weight, set.reps);
                    if (e1RM && e1RM > bestE1RMInLog) {
                        bestE1RMInLog = e1RM;
                    }
                }
            });

            if (bestE1RMInLog > 0) {
                if (liftType === 'Knäböj' && bestE1RMInLog > (statsToUpdate.squat1RMaxKg || 0)) {
                    statsToUpdate.squat1RMaxKg = bestE1RMInLog;
                    needsUpdate = true;
                } else if (liftType === 'Bänkpress' && bestE1RMInLog > (statsToUpdate.benchPress1RMaxKg || 0)) {
                    statsToUpdate.benchPress1RMaxKg = bestE1RMInLog;
                    needsUpdate = true;
                } else if (liftType === 'Marklyft' && bestE1RMInLog > (statsToUpdate.deadlift1RMaxKg || 0)) {
                    statsToUpdate.deadlift1RMaxKg = bestE1RMInLog;
                    needsUpdate = true;
                } else if (liftType === 'Axelpress' && bestE1RMInLog > (statsToUpdate.overheadPress1RMaxKg || 0)) {
                    statsToUpdate.overheadPress1RMaxKg = bestE1RMInLog;
                    needsUpdate = true;
                }
            }
        }
    });
    
    return { needsUpdate, updatedStats: statsToUpdate };
};