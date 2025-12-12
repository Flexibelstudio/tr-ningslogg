
import React, { useCallback } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationsContext';
import { logAnalyticsEvent } from '../../../utils/analyticsLogger';
import firebaseService from '../../../services/firebaseService';
import { notifyFriendsOnBookingFn } from '../../../firebaseClient';
import { BookingStatus, FlowItemLogType, GeneralActivityLog, UserNotification } from '../../../types';

export const useParticipantOperations = (currentParticipantId: string) => {
    const {
        setParticipantBookingsData,
        setParticipantDirectoryData,
        groupClassSchedules,
        groupClassDefinitions,
        participantBookings,
        memberships,
        participantDirectory,
        setGeneralActivityLogsData,
        setWorkoutLogsData,
        setCoachEventsData,
        setGoalCompletionLogsData,
        setClubMembershipsData,
        setUserStrengthStatsData,
        setParticipantPhysiqueHistoryData,
        setParticipantGoalsData,
        setUserConditioningStatsHistoryData,
        setOneOnOneSessionsData,
        connections,
        setUserNotificationsData
    } = useAppContext();
    
    const { organizationId, currentParticipantId: authParticipantId } = useAuth();
    const { addNotification } = useNotifications();

    // --- Booking Operations ---

    const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string, setOperationInProgress?: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (!organizationId) return;
        
        const instanceId = `${scheduleId}-${classDate}`;
        if (setOperationInProgress) setOperationInProgress(prev => [...prev, instanceId]);
    
        const active = participantBookings.find(b =>
          b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === classDate &&
          (b.status === 'BOOKED' || b.status === 'WAITLISTED')
        );
        
        if (active) {
          if (setOperationInProgress) setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
          return;
        }
    
        const schedule = groupClassSchedules.find(s => s.id === scheduleId);
        if (!schedule) {
          if (setOperationInProgress) setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
          return;
        }
        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
    
        const bookedCount = participantBookings.filter(
          b => b.scheduleId === scheduleId && b.classDate === classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')
        ).length;
        
        const newStatus: BookingStatus = bookedCount >= schedule.maxParticipants ? 'WAITLISTED' : 'BOOKED';
    
        const cancelled = participantBookings.find(
          b => b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === classDate && b.status === 'CANCELLED'
        );
        
        if (cancelled) {
          const reactivated = { ...cancelled, status: newStatus, bookingDate: new Date().toISOString() };
          setParticipantBookingsData(prev => prev.map(b => (b.id === cancelled.id ? reactivated : b)));
        } else {
          setParticipantBookingsData(prev => [...prev, {
            id: crypto.randomUUID(), participantId, scheduleId, classDate, bookingDate: new Date().toISOString(), status: newStatus,
          }]);
        }
    
        if (schedule && classDef) {
          setTimeout(() => logAnalyticsEvent('BOOKING_CREATED', {
            participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate,
            coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name,
            wasWaitlisted: newStatus === 'WAITLISTED',
          }, organizationId), 0);
        }
    
        if (newStatus === 'BOOKED') {
          const dateObj = new Date(classDate);
          const niceDate = dateObj.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
          const time = schedule.startTime;

          addNotification({ type: 'SUCCESS', title: 'Bokning Lyckades!', message: `Du är nu bokad på ${classDef?.name} ${niceDate} kl ${time}.` });
          setParticipantDirectoryData(prev => prev.map(p => {
            if (p.id !== participantId) return p;
            const m = memberships.find(m => m.id === p.membershipId);
            if (m?.type === 'clip_card' && p.clipCardStatus && p.clipCardStatus.remainingClips > 0) {
              return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() };
            }
            return p;
          }));
          
          // --- FRIEND NOTIFICATION LOGIC (Fan-out) ---
          const bookerProfile = participantDirectory.find(p => p.id === participantId);
          if (bookerProfile?.shareMyBookings) {
             // 1. Push Notification via Cloud Function (for real mobile push)
             if (authParticipantId === participantId && !firebaseService.isOffline()) {
                notifyFriendsOnBookingFn({ orgId: organizationId, participantId, scheduleId, classDate }).catch(() => {});
             }

             // 2. In-App Feed Notification (Synthetic/Mock DB approach for immediate UI update)
             // Filter out friends who are ALREADY booked on this specific class instance
             const alreadyBookedParticipantIds = new Set(
                 participantBookings
                    .filter(b => b.scheduleId === scheduleId && b.classDate === classDate && (b.status === 'BOOKED' || b.status === 'CHECKED-IN'))
                    .map(b => b.participantId)
             );

             const acceptedFriends = connections.filter(conn => 
                 conn.status === 'accepted' && 
                 (conn.requesterId === participantId || conn.receiverId === participantId)
             );
             
             const friendIdsToNotify = acceptedFriends
                 .map(conn => conn.requesterId === participantId ? conn.receiverId : conn.requesterId)
                 .filter(friendId => !alreadyBookedParticipantIds.has(friendId)); // Exclude if already booked

             const newNotifications: UserNotification[] = friendIdsToNotify.map(friendId => ({
                 id: crypto.randomUUID(),
                 recipientId: friendId,
                 type: 'FRIEND_BOOKING',
                 title: `${bookerProfile.name?.split(' ')[0]} ska träna!`,
                 body: `${bookerProfile.name?.split(' ')[0]} har bokat ${classDef?.name} ${niceDate} kl ${time}. Haka på!`,
                 relatedScheduleId: scheduleId,
                 relatedClassDate: classDate,
                 createdAt: new Date().toISOString(),
                 read: false
             }));
             
             if (newNotifications.length > 0) {
                 setUserNotificationsData(prev => [...prev, ...newNotifications]);
             }
          }
        } else {
          addNotification({ type: 'INFO', title: 'Du är på kölistan', message: `Passet är fullt. Du har placerats på kölistan.` });
        }
        
        if (setOperationInProgress) setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
      }, [organizationId, authParticipantId, participantBookings, groupClassSchedules, groupClassDefinitions, memberships, participantDirectory, connections, addNotification, setParticipantBookingsData, setParticipantDirectoryData, setUserNotificationsData]);
    
      const handleCancelBooking = useCallback((bookingId: string, setOperationInProgress?: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (!organizationId) return;
        
        const booking = participantBookings.find(b => b.id === bookingId);
        if (!booking) return;
        
        const instanceId = `${booking.scheduleId}-${booking.classDate}`;
        if (setOperationInProgress) setOperationInProgress(prev => [...prev, instanceId]);
    
        const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
        const classDef = groupClassDefinitions.find(d => d.id === schedule?.groupClassId);
        
        if (schedule && classDef) {
          const [hour, minute] = schedule.startTime.split(':').map(Number);
          const start = new Date(booking.classDate); start.setHours(hour, minute);
          const within = (start.getTime() - Date.now()) / 36e5;
          logAnalyticsEvent('BOOKING_CANCELLED', {
            participantId: booking.participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate: booking.classDate,
            coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name, cancelledWithinHours: Math.max(0, within),
          }, organizationId);
        }
    
        setParticipantBookingsData(prev => {
          let promoted: typeof participantDirectory[number] | null = null;
          let promotedBooking: typeof prev[number] | undefined;
          const wasBooked = booking.status === 'BOOKED' || booking.status === 'CHECKED-IN';
          
          if (wasBooked) {
            const waitlisters = prev
              .filter(b => b.scheduleId === booking.scheduleId && b.classDate === booking.classDate && b.status === 'WAITLISTED')
              .sort((a, b) => +new Date(a.bookingDate) - +new Date(b.bookingDate));
              
            for (const cand of waitlisters) {
              const p = participantDirectory.find(pp => pp.id === cand.participantId);
              const m = p ? memberships.find(mm => mm.id === p.membershipId) : undefined;
              if (!m || m.type !== 'clip_card' || (p?.clipCardStatus?.remainingClips ?? 0) > 0) {
                promoted = p || null;
                promotedBooking = cand;
                break;
              }
            }
          }
    
          if (wasBooked) {
            setParticipantDirectoryData(old => old.map(p => {
              // Refund clip to canceller
              if (p.id === booking.participantId) {
                const m = memberships.find(mm => mm.id === p.membershipId);
                if (m?.type === 'clip_card' && p.clipCardStatus) {
                  return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips + 1 }, lastUpdated: new Date().toISOString() };
                }
              }
              // Deduct clip from promoted
              if (promoted && promotedBooking && p.id === promoted.id) {
                const m = memberships.find(mm => mm.id === p.membershipId);
                if (m?.type === 'clip_card' && p.clipCardStatus) {
                  return { ...p, clipCardStatus: { ...p.clipCardStatus, remainingClips: p.clipCardStatus.remainingClips - 1 }, lastUpdated: new Date().toISOString() };
                }
              }
              return p;
            }));
          }
    
          if (promoted && classDef && schedule && authParticipantId !== promoted.id) {
             // Logic for notifying promoted user handled by backend/trigger usually, but simulated here
             // Add a notification for the promoted user
             const dateObj = new Date(booking.classDate);
             const niceDate = dateObj.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
             const time = schedule.startTime;

             const promotionNotification: UserNotification = {
                id: crypto.randomUUID(),
                recipientId: promoted.id,
                type: 'WAITLISTED_PROMOTION' as any, // Casting as any to avoid strict type error if type def not fully updated everywhere yet, but added to types/user.ts
                title: 'Du har fått en plats!',
                body: `Du har flyttats från kön och har nu en plats på ${classDef.name} ${niceDate} kl ${time}.`,
                relatedScheduleId: schedule.id,
                relatedClassDate: booking.classDate,
                createdAt: new Date().toISOString(),
                read: false
             };
             setUserNotificationsData(prev => [...prev, promotionNotification]);
          }
    
          return prev.map(b => {
            if (b.id === bookingId) return { ...b, status: 'CANCELLED' as const, cancelReason: 'participant_cancelled' as const };
            if (promotedBooking && b.id === promotedBooking.id) return { ...b, status: 'BOOKED' as const };
            return b;
          });
        });
    
        addNotification({ type: 'SUCCESS', title: 'Avbokning bekräftad', message: `Du har avbokat dig från ${classDef?.name || 'passet'}.` });
        if (setOperationInProgress) setTimeout(() => setOperationInProgress(prev => prev.filter(id => id !== instanceId)), 1000);
      }, [organizationId, authParticipantId, participantBookings, groupClassSchedules, groupClassDefinitions, memberships, participantDirectory, addNotification, setParticipantBookingsData, setParticipantDirectoryData, setUserNotificationsData]);

    const handleSelfCheckIn = useCallback((participantId: string, classInstanceId: string, checkinType: 'self_qr' | 'location_qr'): boolean => {
        if (!organizationId) return false;
        
        const parts = classInstanceId.split('-');
        if (parts.length < 4) {
            addNotification({ type: 'ERROR', title: 'Incheckning Misslyckades', message: 'QR-koden är ogiltig eller har fel format.' });
            return false;
        }
        const date = parts.slice(-3).join('-');
        const scheduleId = parts.slice(0, -3).join('-');
        const schedule = groupClassSchedules.find(s => s.id === scheduleId);
        
        if (!schedule) {
            addNotification({ type: 'ERROR', title: 'Incheckning Misslyckades', message: 'Kunde inte hitta det schemalagda passet.' });
            return false;
        }

        const now = new Date();
        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const [y, m, d] = date.split('-').map(Number);
        const start = new Date(y, m - 1, d, hour, minute);
        const earliest = new Date(start.getTime() - 15 * 60 * 1000); // 15 min before

        if (now < earliest) { addNotification({ type: 'WARNING', title: 'För tidigt', message: 'Du kan checka in tidigast 15 min före passet.' }); return false; }
        if (now > start)   { addNotification({ type: 'WARNING', title: 'För sent',   message: 'Passet har redan startat.' }); return false; }

        const booking = participantBookings.find(b => b.participantId === participantId && b.scheduleId === scheduleId && b.classDate === date && (b.status === 'BOOKED' || b.status === 'WAITLISTED'));
        if (!booking) {
            addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Kunde inte hitta en aktiv bokning för detta pass.' });
            return false;
        }

        if (booking.status === 'WAITLISTED') {
            const bookedCount = participantBookings.filter(b => b.scheduleId === scheduleId && b.classDate === date && (b.status === 'BOOKED' || b.status === 'CHECKED-IN')).length;
            if (bookedCount >= schedule.maxParticipants) {
                addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Passet är fullt. Du kan inte checka in från kölistan just nu.' });
                return false;
            }
        }

        setParticipantBookingsData(prev => prev.map(b => (b.id === booking.id ? { ...b, status: 'CHECKED-IN' as const } : b)));
        const classDef = groupClassDefinitions.find(d => d.id === schedule?.groupClassId);
        
        if (schedule && classDef) {
            logAnalyticsEvent('CHECKIN', {
                participantId, scheduleId: schedule.id, classId: schedule.groupClassId, classDate: date,
                coachId: schedule.coachId, locationId: schedule.locationId, classType: classDef.name, checkinType,
            }, organizationId);
        }
        
        const attendanceRecord: GeneralActivityLog = {
            type: 'general', id: crypto.randomUUID(), participantId, activityName: `Incheckning: ${classDef?.name || 'Gruppass'}`,
            durationMinutes: 0, completedDate: new Date().toISOString(), comment: `Självincheckning via QR-kod för pass den ${date}.`,
        };
        setGeneralActivityLogsData(prev => [...prev, attendanceRecord]);
        addNotification({ type: 'SUCCESS', title: 'Incheckad!', message: `Du är nu incheckad på ${classDef?.name || 'passet'}.` });
        return true;
    }, [organizationId, participantBookings, groupClassSchedules, groupClassDefinitions, addNotification, setParticipantBookingsData, setGeneralActivityLogsData]);

    const handleLocationCheckIn = useCallback((participantId: string, locationId: string): boolean => {
        if (!organizationId) return false;
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const day = now.getDay() === 0 ? 7 : now.getDay();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        const todays = groupClassSchedules.filter(s => {
            if (s.locationId !== locationId) return false;
            if (!s.daysOfWeek.includes(day)) return false;
            const [sy, sm, sd] = s.startDate.split('-').map(Number);
            const [ey, em, ed] = s.endDate.split('-').map(Number);
            const start = new Date(sy, sm - 1, sd);
            const end = new Date(ey, em - 1, ed); end.setHours(23, 59, 59, 999);
            return now >= start && now <= end;
        });
        
        if (!todays.length) {
            addNotification({ type: 'WARNING', title: 'Incheckning Misslyckades', message: 'Ingen schemalagd klass hittades på denna plats idag.' });
            return false;
        }

        let valid: typeof groupClassSchedules[0] | null = null;
        let upcoming: typeof groupClassSchedules[0] | null = null;
        let minValid = Infinity, minUp = Infinity;

        for (const s of todays) {
            const [h, m] = s.startTime.split(':').map(Number);
            const t = h * 60 + m;
            const diff = t - nowMin;
            if (nowMin >= t - 15 && nowMin <= t) { if (diff < minValid) { minValid = diff; valid = s; } }
            if (diff > 0 && diff < minUp)       { minUp = diff; upcoming = s; }
        }

        if (valid) {
            const classInstanceId = `${valid.id}-${todayStr}`;
            return handleSelfCheckIn(participantId, classInstanceId, 'location_qr');
        }
        if (upcoming) { addNotification({ type: 'WARNING', title: 'För tidigt för incheckning', message: 'Du kan checka in tidigast 15 min före passet.' }); return false; }
        
        addNotification({ type: 'WARNING', title: 'För sent för incheckning', message: 'Passet har redan startat, eller så finns inga fler pass idag.' });
        return false;
    }, [organizationId, groupClassSchedules, handleSelfCheckIn, addNotification]);

    // --- Social Operations ---

    const handleToggleReaction = useCallback((logId: string, logType: FlowItemLogType, emoji: string) => {
        if (!authParticipantId) return;
        const updaters: any = {
            workout: setWorkoutLogsData, general: setGeneralActivityLogsData,
            coach_event: setCoachEventsData, goal_completion: setGoalCompletionLogsData,
            participant_club_membership: setClubMembershipsData, user_strength_stat: setUserStrengthStatsData,
            participant_physique_stat: setParticipantPhysiqueHistoryData, participant_goal_data: setParticipantGoalsData,
            participant_conditioning_stat: setUserConditioningStatsHistoryData,
        };
        const setter = updaters[logType];
        if (!setter) return;
        
        setter((logs: any[]) => logs.map(log => {
            if (log.id !== logId) return log;
            const myReactions = (log.reactions || []).filter((r: { participantId: string }) => r.participantId === authParticipantId);
            let updated = [...(log.reactions || [])];
            if (myReactions.length) {
                const had = myReactions.find((r: { emoji: string }) => r.emoji === emoji);
                updated = updated.filter((r: any) => r.participantId !== authParticipantId);
                if (!had) updated.push({ participantId: authParticipantId, emoji, createdDate: new Date().toISOString() });
            } else {
                updated.push({ participantId: authParticipantId, emoji, createdDate: new Date().toISOString() });
            }
            return { ...log, reactions: updated };
        }));
    }, [authParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

    const handleAddComment = useCallback((logId: string, logType: FlowItemLogType, text: string) => {
        const authorId = authParticipantId; 
        if (!authorId) return;
        
        const p = participantDirectory.find(pp => pp.id === authParticipantId);
        const authorName = p ? p.name || 'Användare' : 'Användare';

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
    }, [authParticipantId, participantDirectory, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

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
        if (!authParticipantId) return;
        const pid = authParticipantId;
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
    }, [authParticipantId, setWorkoutLogsData, setGeneralActivityLogsData, setCoachEventsData, setOneOnOneSessionsData, setGoalCompletionLogsData, setClubMembershipsData, setUserStrengthStatsData, setParticipantPhysiqueHistoryData, setParticipantGoalsData, setUserConditioningStatsHistoryData]);

    return {
        handleBookClass,
        handleCancelBooking,
        handleSelfCheckIn,
        handleLocationCheckIn,
        handleToggleReaction,
        handleAddComment,
        handleDeleteComment,
        handleToggleCommentReaction
    };
};
