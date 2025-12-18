import { useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { CoachNote, OneOnOneSession, GroupClassSchedule, CoachEvent, WeeklyHighlightSettings, StaffMember, StaffAvailability, ParticipantProfile, GoalCompletionLog, ParticipantGoalData, Workout, FlowItemLogType, LiftType, UserStrengthStat, UserNotification } from '../../../types';
import { useNotifications } from '../../../context/NotificationsContext';
import { addMonths, addDays } from '../../../utils/dateUtils';

export const useCoachOperations = () => {
  const {
    setCoachNotesData,
    setOneOnOneSessionsData,
    setGroupClassSchedulesData,
    setCoachEventsData,
    setWeeklyHighlightSettingsData,
    setStaffMembersData,
    setStaffAvailabilityData,
    setParticipantBookingsData,
    setParticipantDirectoryData,
    setGroupClassScheduleExceptionsData,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    setParticipantGoalsData,
    setGoalCompletionLogsData,
    setClubMembershipsData,
    setLeaderboardSettingsData,
    setIntegrationSettingsData,
    setWorkoutLogsData,
    setGeneralActivityLogsData,
    setUserStrengthStatsData,
    setParticipantPhysiqueHistoryData,
    setUserConditioningStatsHistoryData,
    setUserNotificationsData,
    updateParticipantProfile,
    participantBookings,
    groupClassSchedules,
    groupClassDefinitions
  } = useAppContext();
  
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  const handleAddNote = useCallback((participantId: string, noteText: string, noteType: 'check-in' | 'intro-session') => {
    const newNote: CoachNote = {
      id: crypto.randomUUID(),
      participantId,
      noteText,
      createdDate: new Date().toISOString(),
      noteType,
    };
    setCoachNotesData((prev) => [...prev, newNote]);
  }, [setCoachNotesData]);

  const handleUpdateNote = useCallback((noteId: string, newText: string) => {
    setCoachNotesData((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, noteText: newText, createdDate: new Date().toISOString() } : note))
    );
  }, [setCoachNotesData]);

  const handleDeleteNote = useCallback((noteId: string) => {
    setCoachNotesData((prev) => prev.filter((note) => note.id !== noteId));
  }, [setCoachNotesData]);

  const handleSaveOrUpdateSession = useCallback((session: OneOnOneSession) => {
    setOneOnOneSessionsData((prev) => {
      const index = prev.findIndex((s) => s.id === session.id);
      if (index > -1) {
        const newSessions = [...prev];
        newSessions[index] = session;
        return newSessions;
      } else {
        return [...prev, session];
      }
    });
  }, [setOneOnOneSessionsData]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    setOneOnOneSessionsData((prev) => prev.filter((s) => s.id !== sessionId));
  }, [setOneOnOneSessionsData]);

  const handleSaveSchedule = useCallback((schedule: GroupClassSchedule) => {
    setGroupClassSchedulesData(prev => {
        const exists = prev.some(s => s.id === schedule.id);
        if (exists) {
            return prev.map(s => s.id === schedule.id ? schedule : s);
        }
        return [...prev, schedule];
    });
  }, [setGroupClassSchedulesData]);

  const handleDeleteSchedule = useCallback((scheduleId: string) => {
      setGroupClassSchedulesData(prev => prev.filter(s => s.id !== scheduleId));
  }, [setGroupClassSchedulesData]);

  const handleCheckInParticipant = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' as const } : b)));
  }, [setParticipantBookingsData]);

  const handleUnCheckInParticipant = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId && b.status === 'CHECKED-IN' ? { ...b, status: 'BOOKED' as const } : b)));
  }, [setParticipantBookingsData]);
  
  const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string) => {
      setParticipantBookingsData(prev => [...prev, {
          id: crypto.randomUUID(), participantId, scheduleId, classDate, bookingDate: new Date().toISOString(), status: 'BOOKED'
      }]);
      addNotification({ type: 'SUCCESS', title: 'Bokning skapad', message: 'Medlemmen har bokats in på passet.' });
  }, [setParticipantBookingsData, addNotification]);

  const handleCancelBooking = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => {
          if (b.id === bookingId) return { ...b, status: 'CANCELLED' as const, cancelReason: 'coach_cancelled' as const };
          return b;
      }));
      addNotification({ type: 'SUCCESS', title: 'Bokning avbruten', message: 'Bokningen har avbokats.' });
  }, [setParticipantBookingsData, addNotification]);

  const handlePromoteFromWaitlist = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId ? { ...b, status: 'BOOKED' as const } : b)));
      addNotification({ type: 'SUCCESS', title: 'Uppflyttad', message: 'Medlemmen har flyttats från kön till bokad.' });
  }, [setParticipantBookingsData, addNotification]);

  const handleCancelClassInstance = useCallback((scheduleId: string, classDate: string, status: 'CANCELLED' | 'DELETED') => {
    setGroupClassScheduleExceptionsData(prev => [...prev, {
        id: crypto.randomUUID(),
        scheduleId,
        date: classDate,
        status,
        createdBy: { uid: user?.id || '', name: user?.name || 'Coach' },
        createdAt: new Date().toISOString(),
    }]);

    if (status === 'CANCELLED') {
        const schedule = groupClassSchedules.find(s => s.id === scheduleId);
        const classDef = groupClassDefinitions.find(d => d.id === schedule?.groupClassId);
        const className = classDef?.name || 'Passet';
        const time = schedule?.startTime || '';
        
        const affectedBookings = participantBookings.filter(b => 
            b.scheduleId === scheduleId && 
            b.classDate === classDate && 
            ['BOOKED', 'CHECKED-IN', 'WAITLISTED'].includes(b.status)
        );
        
        const dateObj = new Date(classDate);
        const niceDate = dateObj.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });

        const newNotifications: UserNotification[] = affectedBookings.map(booking => ({
            id: crypto.randomUUID(),
            recipientId: booking.participantId,
            type: 'CLASS_CANCELLED',
            title: `Pass inställt: ${className}`,
            body: `Tyvärr har passet ${className} ${niceDate} kl ${time} ställts in.`,
            relatedScheduleId: scheduleId,
            relatedClassDate: classDate,
            createdAt: new Date().toISOString(),
            read: false
        }));

        if (newNotifications.length > 0) {
            setUserNotificationsData(prev => [...prev, ...newNotifications]);
        }
    }
    
    addNotification({ type: 'SUCCESS', title: 'Pass hanterat', message: `Passet har markerats som ${status === 'CANCELLED' ? 'inställt' : 'borttaget'}.` });
  }, [setGroupClassScheduleExceptionsData, user, addNotification, participantBookings, groupClassSchedules, groupClassDefinitions, setUserNotificationsData]);

  const handleUpdateClassInstance = useCallback((scheduleId: string, classDate: string, updates: any, notify: boolean) => {
    const { date: newDate, ...otherUpdates } = updates;
    
    if (newDate && newDate !== classDate) {
         setGroupClassScheduleExceptionsData(prev => {
            const newExceptions = [...prev];
            const oldExcIndex = prev.findIndex(ex => ex.scheduleId === scheduleId && ex.date === classDate);
            if (oldExcIndex > -1) newExceptions[oldExcIndex] = { ...newExceptions[oldExcIndex], status: 'DELETED' };
            else newExceptions.push({ id: crypto.randomUUID(), scheduleId, date: classDate, status: 'DELETED', createdAt: new Date().toISOString() });
            
            newExceptions.push({ id: crypto.randomUUID(), scheduleId, date: newDate, status: 'MODIFIED', ...otherUpdates, createdAt: new Date().toISOString() });
            return newExceptions;
         });
         setParticipantBookingsData(prev => prev.map(b => (b.scheduleId === scheduleId && b.classDate === classDate && b.status !== 'CANCELLED') ? { ...b, classDate: newDate } : b));
    } else {
        setGroupClassScheduleExceptionsData(prev => {
            const idx = prev.findIndex(ex => ex.scheduleId === scheduleId && ex.date === classDate);
            if (idx > -1) {
                const newExceptions = [...prev];
                newExceptions[idx] = { ...newExceptions[idx], status: 'MODIFIED', ...otherUpdates };
                return newExceptions;
            }
            return [...prev, { id: crypto.randomUUID(), scheduleId, date: classDate, status: 'MODIFIED', ...otherUpdates, createdAt: new Date().toISOString() }];
        });
    }
    addNotification({ type: 'SUCCESS', title: 'Pass uppdaterat', message: notify ? 'Ändringar sparade och deltagare meddelas.' : 'Ändringar sparade.' });
  }, [setGroupClassScheduleExceptionsData, setParticipantBookingsData, addNotification]);

  const handleAddComment = useCallback((logId: string, logType: FlowItemLogType, text: string) => {
    const authorId = user?.id;
    const authorName = user?.name || 'Coach';
    if (!authorId) return;

    const newComment = { id: crypto.randomUUID(), authorId, authorName, text, createdDate: new Date().toISOString() };
    const updaters: any = {
        workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
        one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
        participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
        participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
        participant_conditioning_stat: setUserConditioningStatsHistoryData,
    };
    const setter = updaters[logType];
    if (!setter) return;
    
    setter((logs: any[]) => logs.map(log => log.id === logId ? { ...log, comments: [...(log.comments || []), newComment] } : log));
  }, [user, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleDeleteComment = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
    const updaters: any = {
        workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
        one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
        participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
        participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
        participant_conditioning_stat: setUserConditioningStatsHistoryData,
    };
    const setter = updaters[logType];
    if (!setter) return;
    setter((logs: any[]) => logs.map(log =>
        log.id === logId ? { ...log, comments: (log.comments || []).filter((c: { id: string }) => c.id !== commentId) } : log
    ));
  }, [setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleToggleCommentReaction = useCallback((logId: string, logType: FlowItemLogType, commentId: string) => {
    if (!user?.id) return;
    const pid = user.id;
    const updaters: any = {
        workout: setWorkoutLogsData, general: setGeneralActivityLogsData, coach_event: setCoachEventsData,
        one_on_one_session: setOneOnOneSessionsData, goal_completion: setGoalCompletionLogsData,
        participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
        participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
        participant_conditioning_stat: setUserConditioningStatsHistoryData,
    };
    const setter = updaters[logType];
    if (!setter) return;
    
    setter((logs: any[]) => logs.map(log => {
        if (log.id !== logId) return log;
        const comments = (log.comments || []).map((c: any) => {
            if (c.id !== commentId) return c;
            const reactions = c.reactions || [];
            const mine = reactions.findIndex((r: { participantId: string }) => r.participantId === pid);
            return (mine > -1)
                ? { ...c, reactions: reactions.filter((_: any, i: number) => i !== mine) }
                : { ...c, reactions: [...reactions, { participantId: pid, emoji: '❤️', createdDate: new Date().toISOString() }] };
        });
        return { ...log, comments };
    }));
  }, [user, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

  const handleVerifyStat = useCallback((statId: string, lift: LiftType, status: 'verified' | 'rejected' | 'unverified', coachName: string) => {
    let participantId = '';
    setUserStrengthStatsData(prev => prev.map(stat => {
        if (stat.id !== statId) return stat;
        participantId = stat.participantId;
        const updates: Partial<UserStrengthStat> = {};
        const dateStr = new Date().toISOString();
        
        const updateFields = (prefix: 'squat' | 'benchPress' | 'deadlift' | 'overheadPress') => {
            updates[`${prefix}VerificationStatus`] = status;
            if (status === 'verified') {
                updates[`${prefix}VerifiedBy`] = coachName;
                updates[`${prefix}VerifiedDate`] = dateStr;
            }
        };

        if (lift === 'Knäböj') updateFields('squat');
        if (lift === 'Bänkpress') updateFields('benchPress');
        if (lift === 'Marklyft') updateFields('deadlift');
        if (lift === 'Axelpress') updateFields('overheadPress');

        return { ...stat, ...updates };
    }));
    
    if (participantId) {
         const notificationType = status === 'verified' ? 'VERIFICATION_APPROVED' : (status === 'rejected' ? 'VERIFICATION_REJECTED' : null);
         
         if (notificationType) {
             const title = status === 'verified' ? 'PB Verifierat! 🎉' : 'PB Avfärdat';
             const body = status === 'verified' 
                ? `Coach ${coachName} har verifierat ditt lyft i ${lift}! Din FSS är nu verifierad.`
                : `Ditt registrerade PB i ${lift} kunde inte verifieras. Prata med din coach för detaljer.`;

             const notification: UserNotification = {
                id: crypto.randomUUID(),
                recipientId: participantId,
                type: notificationType,
                title,
                body,
                createdAt: new Date().toISOString(),
                read: false
             };
             setUserNotificationsData(prev => [...prev, notification]);
         }
    }

    const actionText = status === 'verified' ? 'verifierat' : status === 'rejected' ? 'avfärdat' : 'uppdaterat';
    addNotification({ type: 'SUCCESS', title: 'Statistik uppdaterad', message: `Lyftet har markerats som ${actionText}.` });
  }, [setUserStrengthStatsData, addNotification, setUserNotificationsData]);
  
  const handleContractAction = useCallback(async (action: 'renew' | 'terminate' | 'rolling' | 'custom', participantId: string, customDate?: string) => {
      let update: Partial<ParticipantProfile> = {};
      let noteText = '';
      
      const today = new Date();
      
      switch (action) {
          case 'renew':
              const nextYear = addMonths(today, 12);
              const renewDate = nextYear.toISOString().split('T')[0];
              update = { bindingEndDate: renewDate };
              noteText = `System: Bindningstid förlängd 12 månader t.o.m. ${renewDate}.`;
              break;
          case 'terminate':
              const terminationDate = customDate || addMonths(today, 3).toISOString().split('T')[0];
              update = { endDate: terminationDate };
              noteText = `System: Medlemskap uppsagt. Sista giltighetsdag satt till ${terminationDate}.`;
              break;
          case 'rolling':
              update = { bindingEndDate: '' }; 
              noteText = `System: Övergick till löpande avtal (bindningstid borttagen).`;
              break;
          case 'custom':
              if (customDate) {
                  update = { bindingEndDate: customDate };
                  noteText = `System: Bindningstid manuellt satt t.o.m. ${customDate}.`;
              }
              break;
      }
      
      if (Object.keys(update).length > 0) {
          await updateParticipantProfile(participantId, update);
          
          const newNote: CoachNote = {
              id: crypto.randomUUID(),
              participantId,
              noteText,
              createdDate: new Date().toISOString(),
              noteType: 'check-in' 
          };
          setCoachNotesData(prev => [...prev, newNote]);
          
          addNotification({ type: 'SUCCESS', title: 'Avtal uppdaterat', message: 'Medlemmens avtalsstatus har uppdaterats.' });
      }
  }, [updateParticipantProfile, setCoachNotesData, addNotification]);

  return {
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote,
    handleSaveOrUpdateSession,
    handleDeleteSession,
    handleSaveSchedule,
    handleDeleteSchedule,
    handleCheckInParticipant,
    handleUnCheckInParticipant,
    handleBookClass,
    handleCancelBooking,
    handlePromoteFromWaitlist,
    handleCancelClassInstance,
    handleUpdateClassInstance,
    handleVerifyStat,
    handleContractAction,
    
    handleAddComment,
    handleDeleteComment,
    handleToggleCommentReaction,
    
    setEvents: setCoachEventsData,
    setWeeklyHighlightSettings: setWeeklyHighlightSettingsData,
    setStaff: setStaffMembersData,
    setAvailability: setStaffAvailabilityData,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    setParticipantGoals: setParticipantGoalsData,
    setGoalCompletionLogs: setGoalCompletionLogsData,
    setClubMemberships: setClubMembershipsData,
    setLeaderboardSettings: setLeaderboardSettingsData,
  };
};