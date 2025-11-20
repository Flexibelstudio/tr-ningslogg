
import { useMemo, useState } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { StaffMember, ParticipantProfile, OneOnOneSession, GroupClassSchedule, GroupClassDefinition, ParticipantBooking } from '../../../types';

export const useCoachData = () => {
  const {
    participantDirectory,
    staffMembers,
    workouts,
    workoutLogs,
    participantGoals,
    generalActivityLogs,
    goalCompletionLogs,
    userStrengthStats,
    userConditioningStatsHistory,
    clubMemberships,
    leaderboardSettings,
    coachEvents,
    locations,
    coachNotes,
    weeklyHighlightSettings,
    oneOnOneSessions,
    staffAvailability,
    integrationSettings,
    groupClassDefinitions,
    groupClassSchedules,
    groupClassScheduleExceptions,
    participantBookings,
    orgDataError,
    getColorForCategory,
  } = useAppContext();

  const { user, isImpersonating } = useAuth();

  // Determine the effective staff profile based on auth state
  const loggedInStaff = useMemo(() => {
    if (!user) return null;
    const actualStaffProfile = staffMembers.find((s) => s.email === user.email);

    // If system owner is impersonating, give them temporary Admin rights
    if (user.roles.systemOwner && isImpersonating) {
      if (actualStaffProfile) {
        return { ...actualStaffProfile, role: 'Admin' as const };
      }
      return {
        id: 'system-owner-impersonating',
        name: user.name,
        email: user.email,
        role: 'Admin' as const,
        locationId: locations[0]?.id || 'all',
        isActive: true,
      } as StaffMember;
    }

    return actualStaffProfile || null;
  }, [user, staffMembers, isImpersonating, locations]);

  // Filter participants based on staff role/location
  const participantsForView = useMemo(() => {
    if (loggedInStaff?.role === 'Admin') {
      return participantDirectory;
    }
    if (loggedInStaff?.role === 'Coach') {
      return participantDirectory.filter((p) => p.locationId === loggedInStaff.locationId);
    }
    return [];
  }, [participantDirectory, loggedInStaff]);

  const visibleParticipantIds = useMemo(() => new Set(participantsForView.map((p) => p.id)), [participantsForView]);

  // Filter all related data based on visible participants
  const workoutLogsForView = useMemo(() => workoutLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [workoutLogs, visibleParticipantIds]);
  const generalActivityLogsForView = useMemo(() => generalActivityLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [generalActivityLogs, visibleParticipantIds]);
  const goalCompletionLogsForView = useMemo(() => goalCompletionLogs.filter((log) => visibleParticipantIds.has(log.participantId)), [goalCompletionLogs, visibleParticipantIds]);
  const participantGoalsForView = useMemo(() => participantGoals.filter((goal) => visibleParticipantIds.has(goal.participantId)), [participantGoals, visibleParticipantIds]);
  const userStrengthStatsForView = useMemo(() => userStrengthStats.filter((stat) => visibleParticipantIds.has(stat.participantId)), [userStrengthStats, visibleParticipantIds]);
  const userConditioningStatsForView = useMemo(() => userConditioningStatsHistory.filter((stat) => visibleParticipantIds.has(stat.participantId)), [userConditioningStatsHistory, visibleParticipantIds]);
  const clubMembershipsForView = useMemo(() => clubMemberships.filter((membership) => visibleParticipantIds.has(membership.participantId)), [clubMemberships, visibleParticipantIds]);
  const coachNotesForView = useMemo(() => coachNotes.filter((note) => visibleParticipantIds.has(note.participantId)), [coachNotes, visibleParticipantIds]);

  const oneOnOneSessionsForView = useMemo(() => {
    if (!loggedInStaff) return [];
    if (loggedInStaff.role === 'Admin') {
      return oneOnOneSessions;
    }
    if (loggedInStaff.role === 'Coach') {
      const coachSessionIds = new Set(oneOnOneSessions.filter((s) => s.coachId === loggedInStaff.id).map((s) => s.id));
      const memberSessionIds = new Set(oneOnOneSessions.filter((s) => visibleParticipantIds.has(s.participantId)).map((s) => s.id));
      const allVisibleSessionIds = new Set([...coachSessionIds, ...memberSessionIds]);
      return oneOnOneSessions.filter((s) => allVisibleSessionIds.has(s.id));
    }
    return [];
  }, [oneOnOneSessions, loggedInStaff, visibleParticipantIds]);

  const allActivityLogsForView = useMemo(
    () => [...workoutLogsForView, ...generalActivityLogsForView, ...goalCompletionLogsForView],
    [workoutLogsForView, generalActivityLogsForView, goalCompletionLogsForView]
  );

  // Helper to prepare class instance data for management modal
  const getClassInstanceDetails = (scheduleId: string, date: string) => {
    const schedule = groupClassSchedules.find((s) => s.id === scheduleId);
    if (!schedule) return null;
  
    const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === scheduleId && ex.date === date);
  
    if (exception && (exception.status === 'DELETED' || !exception.status)) {
        return null;
    }

    const overriddenSchedule = {
      ...schedule,
      startTime: exception?.newStartTime || schedule.startTime,
      durationMinutes: exception?.newDurationMinutes || schedule.durationMinutes,
      coachId: exception?.newCoachId || schedule.coachId,
      maxParticipants: exception?.newMaxParticipants || schedule.maxParticipants,
    };

    const classDef = groupClassDefinitions.find((d) => d.id === overriddenSchedule.groupClassId);
    const coach = staffMembers.find((c) => c.id === overriddenSchedule.coachId);
    if (!classDef || !coach) return null;

    const [year, month, day] = date.split('-').map(Number);
    const classDate = new Date(year, month - 1, day);

    const [hour, minute] = overriddenSchedule.startTime.split(':').map(Number);
    const startDateTime = new Date(classDate);
    startDateTime.setHours(hour, minute, 0, 0);

    const allBookingsForInstance = participantBookings.filter((b) => b.scheduleId === schedule.id && b.classDate === date && b.status !== 'CANCELLED');
    const bookedUsers = allBookingsForInstance.filter((b) => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
    const waitlistedUsers = allBookingsForInstance.filter((b) => b.status === 'WAITLISTED');

    return {
      instanceId: `${schedule.id}-${date}`,
      date,
      startDateTime,
      scheduleId,
      className: classDef.name,
      duration: overriddenSchedule.durationMinutes,
      coachName: coach.name,
      coachId: coach.id,
      locationId: overriddenSchedule.locationId,
      maxParticipants: overriddenSchedule.maxParticipants,
      bookedCount: bookedUsers.length,
      waitlistCount: waitlistedUsers.length,
      isFull: bookedUsers.length >= overriddenSchedule.maxParticipants,
      allBookingsForInstance,
      color: classDef.color || getColorForCategory(classDef.name),
    };
  };

  return {
    loggedInStaff,
    participantsForView,
    workoutLogsForView,
    generalActivityLogsForView,
    goalCompletionLogsForView,
    participantGoalsForView,
    userStrengthStatsForView,
    userConditioningStatsForView,
    clubMembershipsForView,
    oneOnOneSessionsForView,
    coachNotesForView,
    allActivityLogsForView,
    
    // Raw data access needed for sub-components
    workouts,
    leaderboardSettings,
    coachEvents,
    locations,
    staffMembers,
    weeklyHighlightSettings,
    staffAvailability,
    integrationSettings,
    groupClassDefinitions,
    groupClassSchedules,
    groupClassScheduleExceptions,
    participantBookings,
    orgDataError,
    
    // Helpers
    getClassInstanceDetails,
    getColorForCategory,
  };
};
