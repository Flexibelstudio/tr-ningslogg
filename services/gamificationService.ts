// services/gamificationService.ts
import { ParticipantGoalData, ParticipantGamificationStats, ActivityLog, ParticipantProfile, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, Workout, WorkoutLog, LiftType } from '../types';
import * as dateUtils from '../utils/dateUtils';
import { CLUB_DEFINITIONS } from '../constants';
import { calculateEstimated1RM } from '../utils/workoutUtils';


export const calculateUpdatedStreakAndGamification = (
    currentGoals: ParticipantGoalData[],
    gamificationStats: ParticipantGamificationStats | null,
    participantId: string | undefined,
    currentAllActivityLogs: ActivityLog[]
  ): { updatedGoals: ParticipantGoalData[], updatedGamificationStats: ParticipantGamificationStats | null } => {
    if (currentGoals.length === 0 || !participantId) {
      return { updatedGoals: currentGoals, updatedGamificationStats: gamificationStats };
    }
  
    let goalsArray = [...currentGoals];
    const latestSetGoal = goalsArray.sort((a, b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    let goalToUpdate = { ...latestSetGoal };
  
    let newGamificationStats = gamificationStats 
      ? { ...gamificationStats } 
      : { id: participantId, longestStreakWeeks: 0, lastUpdated: new Date().toISOString() };
  
    if (goalToUpdate && goalToUpdate.workoutsPerWeekTarget > 0 && !goalToUpdate.isCompleted) {
      const today = new Date();
      const currentEpochWeekId = dateUtils.getEpochWeekId(today);
  
      if (!goalToUpdate.lastStreakUpdateEpochWeekId || !goalToUpdate.lastStreakUpdateEpochWeekId.includes('-W')) {
        goalToUpdate.lastStreakUpdateEpochWeekId = dateUtils.getEpochWeekId(new Date(goalToUpdate.setDate));
        goalToUpdate.currentWeeklyStreak = 0;
      }
  
      if (goalToUpdate.lastStreakUpdateEpochWeekId !== currentEpochWeekId) {
        const previousEpochWeekId = dateUtils.getPreviousEpochWeekId(currentEpochWeekId);
        const logsLastEpochWeek = currentAllActivityLogs.filter(log => dateUtils.getEpochWeekId(new Date(log.completedDate)) === previousEpochWeekId).length;
        
        if (logsLastEpochWeek >= goalToUpdate.workoutsPerWeekTarget) {
          goalToUpdate.currentWeeklyStreak += 1;
        } else {
          const logsThisEpochWeek = currentAllActivityLogs.filter(log => dateUtils.getEpochWeekId(new Date(log.completedDate)) === currentEpochWeekId).length;
          goalToUpdate.currentWeeklyStreak = logsThisEpochWeek > 0 ? 1 : 0;
        }
  
        goalToUpdate.lastStreakUpdateEpochWeekId = currentEpochWeekId;
        
        if (goalToUpdate.currentWeeklyStreak > (newGamificationStats.longestStreakWeeks || 0)) {
          newGamificationStats.longestStreakWeeks = goalToUpdate.currentWeeklyStreak;
          newGamificationStats.lastUpdated = new Date().toISOString();
        }
      }
    }
  
    const finalGoals = goalsArray.map(g => g.id === goalToUpdate.id ? goalToUpdate : g);
  
    return { updatedGoals: finalGoals, updatedGamificationStats: newGamificationStats };
};

export const checkAndAwardClubMemberships = (
    participant: ParticipantProfile,
    allLogs: ActivityLog[],
    allStrengthStats: UserStrengthStat[],
    allConditioningStats: ParticipantConditioningStat[],
    existingMemberships: ParticipantClubMembership[],
    allWorkouts: Workout[]
): ParticipantClubMembership[] => {
    const newAchievements: ParticipantClubMembership[] = [];
    if (!participant) return newAchievements;

    const existingClubIds = new Set(existingMemberships.map(m => m.clubId));
    const nowISO = new Date().toISOString();
    
    // Create a map of exerciseId -> {name, baseLiftType}
    const exerciseMap = new Map<string, { name: string, baseLiftType?: LiftType }>();
    // 1. Get from templates
    allWorkouts.forEach(workout => {
        (workout.blocks || []).forEach(block => {
            block.exercises.forEach(ex => {
                exerciseMap.set(ex.id, { name: ex.name, baseLiftType: ex.baseLiftType });
            });
        });
    });
    // 2. Get from logs for modifiable workouts, which contain the full exercise definition
    allLogs.forEach(log => {
        if (log.type === 'workout' && (log as WorkoutLog).selectedExercisesForModifiable) {
            (log as WorkoutLog).selectedExercisesForModifiable!.forEach(ex => {
                exerciseMap.set(ex.id, { name: ex.name, baseLiftType: ex.baseLiftType });
            });
        }
    });

    CLUB_DEFINITIONS.forEach(club => {
        if (existingClubIds.has(club.id)) return;

        let isAchieved = false;

        switch (club.type) {
            case 'SESSION_COUNT':
                if (club.threshold && allLogs.length >= club.threshold) {
                    isAchieved = true;
                }
                break;
            
            case 'LIFT':
            case 'BODYWEIGHT_LIFT':
                const liftType = club.liftType;
                if (!liftType) break;

                const targetWeight = club.type === 'BODYWEIGHT_LIFT'
                    ? (participant.bodyweightKg || 0) * (club.multiplier || 1)
                    : (club.threshold || Infinity);

                if (targetWeight <= 0) break;
                
                let maxAchievedWeight = 0;

                // 1. Check dedicated 1RM stats
                const latestStat = allStrengthStats.sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
                if (latestStat) {
                    if (liftType === 'Bänkpress') maxAchievedWeight = Math.max(maxAchievedWeight, latestStat.benchPress1RMaxKg || 0);
                    if (liftType === 'Knäböj') maxAchievedWeight = Math.max(maxAchievedWeight, latestStat.squat1RMaxKg || 0);
                    if (liftType === 'Marklyft') maxAchievedWeight = Math.max(maxAchievedWeight, latestStat.deadlift1RMaxKg || 0);
                    if (liftType === 'Axelpress') maxAchievedWeight = Math.max(maxAchievedWeight, latestStat.overheadPress1RMaxKg || 0);
                }

                // 2. Check all workout logs for this lift
                for (const log of allLogs) {
                    if (log.type === 'workout') {
                        for (const entry of (log as WorkoutLog).entries) {
                            const exerciseDetail = exerciseMap.get(entry.exerciseId);
                            if (exerciseDetail && (exerciseDetail.name === liftType || exerciseDetail.baseLiftType === liftType)) {
                                for (const set of entry.loggedSets) {
                                    if (set.isCompleted) {
                                        const weight = Number(set.weight || 0);
                                        maxAchievedWeight = Math.max(maxAchievedWeight, weight);

                                        const e1RM = calculateEstimated1RM(set.weight, set.reps);
                                        if (e1RM) {
                                            maxAchievedWeight = Math.max(maxAchievedWeight, e1RM);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (maxAchievedWeight >= targetWeight) {
                    isAchieved = true;
                }
                break;

            case 'TOTAL_VOLUME':
                if (club.threshold === undefined) break;
                // Check if any workout log has a total volume that meets the threshold
                for (const log of allLogs) {
                    if (log.type === 'workout') {
                        const workoutLog = log as WorkoutLog;
                        if (workoutLog.postWorkoutSummary && workoutLog.postWorkoutSummary.totalWeightLifted >= club.threshold) {
                            isAchieved = true;
                            break; // Found a matching log, no need to check further for this club
                        }
                    }
                }
                break;

            case 'CONDITIONING':
                const metric = club.conditioningMetric;
                const comparison = club.comparison;
                if (!metric || club.threshold === undefined) break;
                
                for (const stat of allConditioningStats) {
                    const value = stat[metric];
                    if (value !== undefined && value !== null) {
                        if (comparison === 'GREATER_OR_EQUAL' && value >= club.threshold) {
                            isAchieved = true;
                            break;
                        }
                        if (comparison === 'LESS_OR_EQUAL' && value <= club.threshold) {
                            isAchieved = true;
                            break;
                        }
                    }
                }
                break;
        }

        if (isAchieved) {
            newAchievements.push({
                id: crypto.randomUUID(),
                clubId: club.id,
                participantId: participant.id,
                achievedDate: nowISO,
            });
        }
    });

    return newAchievements;
};

export const getHighestClubAchievements = (memberships: ParticipantClubMembership[]): ParticipantClubMembership[] => {
  if (!memberships || memberships.length === 0) {
    return [];
  }

  const clubDefMap = new Map(CLUB_DEFINITIONS.map(def => [def.id, def]));

  const groupedByFamily = new Map<string, ParticipantClubMembership[]>();

  for (const membership of memberships) {
    const def = clubDefMap.get(membership.clubId);
    if (!def) continue;

    let familyKey = '';
    switch (def.type) {
      case 'SESSION_COUNT':
        familyKey = 'SESSION_COUNT';
        break;
      case 'LIFT':
      case 'BODYWEIGHT_LIFT':
        familyKey = `LIFT-${def.liftType}`;
        break;
      case 'CONDITIONING':
        familyKey = `CONDITIONING-${def.conditioningMetric}`;
        break;
      case 'TOTAL_VOLUME':
        familyKey = 'TOTAL_VOLUME';
        break;
      default:
        continue;
    }

    if (!groupedByFamily.has(familyKey)) {
      groupedByFamily.set(familyKey, []);
    }
    groupedByFamily.get(familyKey)!.push(membership);
  }

  const highestAchievements: ParticipantClubMembership[] = [];

  for (const [, familyMemberships] of groupedByFamily.entries()) {
    if (familyMemberships.length === 0) continue;

    let bestMembership = familyMemberships[0];
    
    for (let i = 1; i < familyMemberships.length; i++) {
      const currentMembership = familyMemberships[i];
      const currentDef = clubDefMap.get(currentMembership.clubId);
      const bestCurrentDef = clubDefMap.get(bestMembership.clubId);

      if (!currentDef || currentDef.threshold === undefined || !bestCurrentDef || bestCurrentDef.threshold === undefined) continue;
      
      if (currentDef.comparison === 'GREATER_OR_EQUAL' || currentDef.comparison === undefined) {
        if (currentDef.threshold > bestCurrentDef.threshold) {
          bestMembership = currentMembership;
        }
      } 
      else if (currentDef.comparison === 'LESS_OR_EQUAL') {
        if (currentDef.threshold < bestCurrentDef.threshold) {
          bestMembership = currentMembership;
        }
      }
    }
    highestAchievements.push(bestMembership);
  }

  return highestAchievements;
};
