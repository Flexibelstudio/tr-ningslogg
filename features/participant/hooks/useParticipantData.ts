
import { useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import * as dateUtils from '../../../utils/dateUtils';
import { calculateFlexibelStrengthScoreInternal, getFssScoreInterpretation } from '../../../components/participant/StrengthComparisonTool';
import { ParticipantConditioningStat, ActivityLog } from '../../../types';

export const useParticipantData = (currentParticipantId: string) => {
    const {
        participantDirectory,
        workouts,
        workoutLogs,
        participantGoals,
        generalActivityLogs,
        goalCompletionLogs,
        userStrengthStats,
        userConditioningStatsHistory,
        participantPhysiqueHistory,
        participantMentalWellbeing,
        participantGamificationStats,
        clubMemberships,
        participantBookings: allParticipantBookings,
        groupClassSchedules,
        groupClassDefinitions,
        staffMembers,
        oneOnOneSessions,
        connections,
        coachEvents,
    } = useAppContext();

    const participantProfile = useMemo(() => 
        participantDirectory.find(p => p.id === currentParticipantId), 
        [participantDirectory, currentParticipantId]
    );

    const myWorkoutLogs = useMemo(() => 
        workoutLogs
            .filter(l => l.participantId === currentParticipantId)
            .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()), 
        [workoutLogs, currentParticipantId]
    );

    const myGeneralActivityLogs = useMemo(() => 
        generalActivityLogs.filter(l => l.participantId === currentParticipantId), 
        [generalActivityLogs, currentParticipantId]
    );

    const myGoalCompletionLogs = useMemo(() => 
        goalCompletionLogs.filter(g => g.participantId === currentParticipantId), 
        [goalCompletionLogs, currentParticipantId]
    );

    const allActivityLogs = useMemo<ActivityLog[]>(() => {
        return [...myWorkoutLogs, ...myGeneralActivityLogs, ...myGoalCompletionLogs]
            .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
    }, [myWorkoutLogs, myGeneralActivityLogs, myGoalCompletionLogs]);

    const allActivityLogsForLeaderboard = useMemo<ActivityLog[]>(() => {
        return [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];
    }, [workoutLogs, generalActivityLogs, goalCompletionLogs]);

    const myStrengthStats = useMemo(() => 
        userStrengthStats.filter(s => s.participantId === currentParticipantId), 
        [userStrengthStats, currentParticipantId]
    );

    const latestStrengthStats = useMemo(() => {
        if (!myStrengthStats || myStrengthStats.length === 0) return null;
        return myStrengthStats.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
    }, [myStrengthStats]);

    const myConditioningStats = useMemo(() => 
        userConditioningStatsHistory.filter(s => s.participantId === currentParticipantId), 
        [userConditioningStatsHistory, currentParticipantId]
    );

    const latestConditioningValues = useMemo(() => {
        if (!myConditioningStats || myConditioningStats.length === 0) return { airbike4MinKcal: null, skierg4MinMeters: null, rower4MinMeters: null, rower2000mTimeSeconds: null, treadmill4MinMeters: null };

        const findLastValue = (key: keyof Omit<ParticipantConditioningStat, 'id'|'lastUpdated'|'participantId'|'reactions'|'comments'>): {value: string, date: string} | null => {
            const sorted = [...myConditioningStats].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
            for(const stat of sorted) {
                const statValue = stat[key];
                if (statValue !== undefined && statValue !== null) {
                    return { value: String(statValue), date: stat.lastUpdated };
                }
            }
            return null;
        };

        return {
            airbike4MinKcal: findLastValue('airbike4MinKcal'),
            skierg4MinMeters: findLastValue('skierg4MinMeters'),
            rower4MinMeters: findLastValue('rower4MinMeters'),
            rower2000mTimeSeconds: findLastValue('rower2000mTimeSeconds'),
            treadmill4MinMeters: findLastValue('treadmill4MinMeters'),
        };
    }, [myConditioningStats]);

    const myPhysiqueHistory = useMemo(() => 
        participantPhysiqueHistory.filter(s => s.participantId === currentParticipantId), 
        [participantPhysiqueHistory, currentParticipantId]
    );

    const latestPhysique = useMemo(() => {
        if (myPhysiqueHistory.length === 0) return null;
        return [...myPhysiqueHistory].sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
    }, [myPhysiqueHistory]);

    const myMentalWellbeing = useMemo(() => 
        participantMentalWellbeing.find(w => w.id === currentParticipantId), 
        [participantMentalWellbeing, currentParticipantId]
    );

    const myGamificationStats = useMemo(() => 
        participantGamificationStats.find(s => s.id === currentParticipantId), 
        [participantGamificationStats, currentParticipantId]
    );

    const myClubMemberships = useMemo(() => 
        clubMemberships.filter(c => c.participantId === currentParticipantId), 
        [clubMemberships, currentParticipantId]
    );

    const myParticipantGoals = useMemo(() => 
        participantGoals.filter(g => g.participantId === currentParticipantId), 
        [participantGoals, currentParticipantId]
    );

    const latestGoal = useMemo(() => {
        if (myParticipantGoals.length === 0) return null;
        return [...myParticipantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    }, [myParticipantGoals]);
  
    const latestActiveGoal = useMemo(() => {
         const sortedGoals = [...myParticipantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
         return sortedGoals.find(g => !g.isCompleted) || null;
    }, [myParticipantGoals]);

    const myOneOnOneSessions = useMemo(() => 
        oneOnOneSessions.filter(s => s.participantId === currentParticipantId), 
        [oneOnOneSessions, currentParticipantId]
    );

    const myUpcomingSessions = useMemo(() => {
        return myOneOnOneSessions
          .filter(s => s.status === 'scheduled' && new Date(s.startTime) > new Date())
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [myOneOnOneSessions]);

    const nextMeetingForCard = useMemo(() => {
        if (myUpcomingSessions.length === 0) return null;
        const nextSession = myUpcomingSessions[0];
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        sevenDaysFromNow.setHours(23, 59, 59, 999);

        if (new Date(nextSession.startTime) <= sevenDaysFromNow) {
          return nextSession;
        }
        return null;
    }, [myUpcomingSessions]);

    const nextBooking = useMemo(() => {
        const now = new Date();
        const myBookings = allParticipantBookings
            .filter(b => b.participantId === currentParticipantId && (b.status === 'BOOKED' || b.status === 'WAITLISTED'))
            .map(booking => {
                const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
                if (!schedule) return null;

                const [hour, minute] = schedule.startTime.split(':').map(Number);
                const [year, month, day] = booking.classDate.split('-').map(Number);
                const startDateTime = new Date(year, month - 1, day, hour, minute);

                if (startDateTime < now) return null;

                const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
                const coach = staffMembers.find(s => s.id === schedule.coachId);

                if (!classDef || !coach) return null;

                return { booking, schedule, classDef, coach, startDateTime };
            })
            .filter((b): b is NonNullable<typeof b> => b !== null)
            .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    
        return myBookings[0] || null;
    }, [allParticipantBookings, currentParticipantId, groupClassSchedules, groupClassDefinitions, staffMembers]);

    const flexibelStrengthScore = useMemo(() => {
        if (latestStrengthStats && participantProfile) {
            return calculateFlexibelStrengthScoreInternal(latestStrengthStats, participantProfile)?.totalScore;
        }
        return null;
    }, [latestStrengthStats, participantProfile]);

    const fssScoreInterpretation = useMemo(() => 
        getFssScoreInterpretation(flexibelStrengthScore),
    [flexibelStrengthScore]);

    const isNewUser = useMemo(() => {
        return allActivityLogs.length === 0 && myParticipantGoals.length === 0;
    }, [allActivityLogs, myParticipantGoals]);

    return {
        participantProfile,
        myWorkoutLogs,
        myGeneralActivityLogs,
        myGoalCompletionLogs,
        allActivityLogs,
        allActivityLogsForLeaderboard,
        myStrengthStats,
        latestStrengthStats,
        myConditioningStats,
        latestConditioningValues,
        myPhysiqueHistory,
        latestPhysique,
        myMentalWellbeing,
        myGamificationStats,
        myClubMemberships,
        myParticipantGoals,
        latestGoal,
        latestActiveGoal,
        myOneOnOneSessions,
        myUpcomingSessions,
        nextMeetingForCard,
        nextBooking,
        flexibelStrengthScore,
        fssScoreInterpretation,
        isNewUser,
        allParticipantBookings, // Passed through for views that need raw data
        groupClassSchedules,
        groupClassDefinitions,
        staffMembers,
        connections,
        coachEvents
    };
};
