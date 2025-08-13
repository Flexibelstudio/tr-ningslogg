// services/gamificationService.ts
import { ParticipantGoalData, ParticipantGamificationStats, ActivityLog } from '../types';
import * as dateUtils from '../utils/dateUtils';

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
