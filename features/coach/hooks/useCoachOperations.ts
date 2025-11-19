
import { useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { CoachNote, OneOnOneSession, GroupClassSchedule, CoachEvent, WeeklyHighlightSettings, StaffMember, StaffAvailability, ParticipantProfile, GoalCompletionLog, ParticipantGoalData, Workout } from '../../../types';
import { useNotifications } from '../../../context/NotificationsContext';

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
  } = useAppContext();
  
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  // --- Notes Operations ---
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

  // --- 1-on-1 Session Operations ---
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

  // --- Schedule Operations ---
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

  // --- Booking Operations ---
  const handleCheckInParticipant = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' as const } : b)));
  }, [setParticipantBookingsData]);

  const handleUnCheckInParticipant = useCallback((bookingId: string) => {
      setParticipantBookingsData(prev => prev.map(b => (b.id === bookingId && b.status === 'CHECKED-IN' ? { ...b, status: 'BOOKED' as const } : b)));
  }, [setParticipantBookingsData]);
  
  const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string) => {
      // Simplified version for coach, assuming validation is done in UI or backend/hooks logic
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

  // --- Class Instance Management ---
  const handleCancelClassInstance = useCallback((scheduleId: string, classDate: string, status: 'CANCELLED' | 'DELETED') => {
    setGroupClassScheduleExceptionsData(prev => [...prev, {
        id: crypto.randomUUID(),
        scheduleId,
        date: classDate,
        status,
        createdBy: { uid: user?.id || '', name: user?.name || 'Coach' },
        createdAt: new Date().toISOString(),
    }]);
    addNotification({ type: 'SUCCESS', title: 'Pass hanterat', message: `Passet har markerats som ${status === 'CANCELLED' ? 'inställt' : 'borttaget'}.` });
  }, [setGroupClassScheduleExceptionsData, user, addNotification]);

  const handleUpdateClassInstance = useCallback((scheduleId: string, classDate: string, updates: any, notify: boolean) => {
    // Logic similar to App.tsx but encapsulated here
    const { date: newDate, ...otherUpdates } = updates;
    
    if (newDate && newDate !== classDate) {
         setGroupClassScheduleExceptionsData(prev => {
            const newExceptions = [...prev];
             // 1. Mark old deleted
            const oldExcIndex = prev.findIndex(ex => ex.scheduleId === scheduleId && ex.date === classDate);
            if (oldExcIndex > -1) newExceptions[oldExcIndex] = { ...newExceptions[oldExcIndex], status: 'DELETED' };
            else newExceptions.push({ id: crypto.randomUUID(), scheduleId, date: classDate, status: 'DELETED', createdAt: new Date().toISOString() });
            
            // 2. Create new modified
            newExceptions.push({ id: crypto.randomUUID(), scheduleId, date: newDate, status: 'MODIFIED', ...otherUpdates, createdAt: new Date().toISOString() });
            return newExceptions;
         });
         // 3. Move bookings
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
    
    // Pass through other updaters needed by sub-components
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
