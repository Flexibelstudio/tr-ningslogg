import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ActivityLog, Workout, WorkoutLog, GeneralActivityLog, Exercise, GoalCompletionLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, CoachEvent, ParticipantPhysiqueStat, OneOnOneSession, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, Location, IntegrationSettings } from '../../types';
import { ConfirmationModal } from '../ConfirmationModal';
import { MOOD_OPTIONS, CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants'; 
import * as dateUtils from '../../utils/dateUtils';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { useAppContext } from '../../context/AppContext';

interface DayActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  activitiesForDay: ActivityLog[];
  workouts: Workout[]; 
  onViewLogSummary: (log: ActivityLog) => void; 
  onDeleteActivity: (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => void;
  activeGoal?: ParticipantGoalData | null;
  strengthStatsHistory: UserStrengthStat[];
  conditioningStatsHistory: ParticipantConditioningStat[];
  physiqueHistory: ParticipantPhysiqueStat[];
  clubMemberships: ParticipantClubMembership[];
  participantProfile: ParticipantProfile | null;
  allParticipantGoals: ParticipantGoalData[];
  coachEvents: CoachEvent[];
  oneOnOneSessions: OneOnOneSession[];
  staffMembers: StaffMember[];
  groupClassSchedules: GroupClassSchedule[];
  groupClassDefinitions: GroupClassDefinition[];
  allParticipantBookings: ParticipantBooking[];
  locations: Location[];
  onCancelBooking: (bookingId: string) => void;
  integrationSettings: IntegrationSettings;
  loggedInCoachId?: string | null;
  onManageClassClick?: (instance: { scheduleId: string; date: string }) => void;
}

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 inline" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const getGeneralActivityIcon = (activityName: string) => {
    const lowerName = activityName.toLowerCase();
    if (lowerName.includes('löp') || lowerName.includes('spring')) return '🏃';
    if (lowerName.includes('promenad') || lowerName.includes('gå')) return '🚶';
    if (lowerName.includes('cykel') || lowerName.includes('cykl')) return '🚴';
    if (lowerName.includes('simning') || lowerName.includes('simma')) return '🏊';
    if (lowerName.includes('yoga')) return '🧘';
    if (lowerName.includes('styrke') || lowerName.includes('gym')) return '🏋️';
    if (lowerName.includes('dans')) return '💃';
    if (lowerName.includes('fotboll')) return '⚽';
    if (lowerName.includes('basket')) return '🏀';
    if (lowerName.includes('vandring') || lowerName.includes('hike')) return '⛰️';
    return '🤸';
};

const getMoodEmoji = (moodRating?: number): string => {
  if (moodRating === undefined || moodRating === null) return '';
  const mood = MOOD_OPTIONS.find(m => m.rating === moodRating);
  return mood ? mood.emoji : '';
};

const getStudioLabel = (target: 'all' | 'salem' | 'karra'): string => {
    const option = STUDIO_TARGET_OPTIONS.find(opt => opt.value === target);
    return option ? option.label : 'Okänd studio';
};

type FullBookingInfo = ParticipantBooking & {
    className: string;
    startTime: string;
    coachName: string;
    coachId: string;
    startDateTime: Date;
    isWaitlistedByMe: boolean;
    myWaitlistPosition: number;
    color: string;
};

export const DayActivitiesModal: React.FC<DayActivitiesModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  activitiesForDay,
  workouts,
  onViewLogSummary,
  onDeleteActivity,
  activeGoal,
  strengthStatsHistory,
  conditioningStatsHistory,
  physiqueHistory,
  clubMemberships,
  participantProfile,
  allParticipantGoals,
  coachEvents,
  oneOnOneSessions,
  staffMembers,
  groupClassSchedules,
  groupClassDefinitions,
  allParticipantBookings,
  locations,
  onCancelBooking,
  integrationSettings,
  loggedInCoachId,
  onManageClassClick,
}) => {
  const { getColorForCategory } = useAppContext();
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [activityToConfirmDelete, setActivityToConfirmDelete] = useState<ActivityLog | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<FullBookingInfo | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedActivityId(null); 
      setActivityToConfirmDelete(null);
      setBookingToCancel(null);
    }
  }, [isOpen]);

  const coachEventsForDay = useMemo(() => {
    if (!selectedDate) return [];
    return coachEvents.filter(e => {
        if (e.studioTarget && e.studioTarget !== 'all') {
            const participantLocation = locations.find(l => l.id === participantProfile?.locationId);
            if (!participantLocation || !participantLocation.name.toLowerCase().includes(e.studioTarget)) {
                return false;
            }
        }
        // For events with a specific date, match that date.
        if (e.type === 'event' && e.eventDate) {
            const [year, month, day] = e.eventDate.split('-').map(Number);
            const eventDate = new Date(year, month - 1, day);
            return dateUtils.isSameDay(eventDate, selectedDate);
        }
        // For news, match the creation date.
        if (e.type === 'news') {
            return dateUtils.isSameDay(new Date(e.createdDate), selectedDate);
        }
        // Fallback for older data that might just be type 'event' without a date.
        if (e.type === 'event' && !e.eventDate) {
            return dateUtils.isSameDay(new Date(e.createdDate), selectedDate);
        }
        return false;
    }).sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [selectedDate, coachEvents, locations, participantProfile]);

  const oneOnOneSessionsForDay = useMemo(() => {
    if (!selectedDate || !participantProfile) return [];
    return oneOnOneSessions
        .filter(s => s.participantId === participantProfile.id && s.status === 'scheduled' && dateUtils.isSameDay(new Date(s.startTime), selectedDate) && !dateUtils.isPast(new Date(s.endTime)))
        .sort((a,b) => new Date(a.startTime).getTime() - new Date(a.startTime).getTime());
  }, [selectedDate, oneOnOneSessions, participantProfile]);

  const groupClassesForDay = useMemo((): FullBookingInfo[] => {
    if (!selectedDate || !participantProfile) return [];
    
    const dateStr = dateUtils.toYYYYMMDD(selectedDate);
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const now = new Date();

    const schedulesToday = groupClassSchedules.filter(schedule => {
        const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        endDate.setHours(23, 59, 59, 999);
        return schedule.daysOfWeek.includes(dayOfWeek) && selectedDate >= startDate && selectedDate <= endDate;
    });

    return schedulesToday.map(schedule => {
        const myBooking = allParticipantBookings.find(b => b.participantId === participantProfile.id && b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
        const isMyClassAsCoach = loggedInCoachId === schedule.coachId;

        if (!myBooking && !isMyClassAsCoach) return null;

        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
        const coach = staffMembers.find(s => s.id === schedule.coachId);
        if (!classDef || !coach) return null;

        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const classStartDateTime = new Date(selectedDate);
        classStartDateTime.setHours(hour, minute, 0, 0);
        
        const classEndDateTime = new Date(classStartDateTime.getTime() + schedule.durationMinutes * 60000);
        if (classEndDateTime < now) {
            return null; // Don't show past classes
        }

        const waitlistedUsers = allParticipantBookings.filter(b => b.scheduleId === schedule.id && b.classDate === dateStr && b.status === 'WAITLISTED').sort((a,b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
        let myPosition = 0;
        if (myBooking?.status === 'WAITLISTED') {
            myPosition = waitlistedUsers.findIndex(b => b.id === myBooking.id) + 1;
        }

        return {
            ...(myBooking || {
                id: `coach-view-${schedule.id}`,
                participantId: participantProfile.id,
                bookingDate: '',
                status: 'BOOKED' as const,
            }),
            scheduleId: schedule.id,
            classDate: dateStr,
            className: classDef.name,
            startTime: schedule.startTime,
            coachName: coach.name,
            coachId: coach.id,
            startDateTime: classStartDateTime,
            isWaitlistedByMe: myBooking?.status === 'WAITLISTED',
            myWaitlistPosition: myPosition,
            color: classDef.color || getColorForCategory(classDef.name),
        };
    }).filter((b): b is FullBookingInfo => b !== null).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDate, participantProfile, allParticipantBookings, groupClassSchedules, groupClassDefinitions, staffMembers, loggedInCoachId, getColorForCategory]);


  const specialEventsForDay = useMemo(() => {
    if (!selectedDate) return [];
    
    const events: { icon: string, text: string, details?: string }[] = [];
    
    const goalsSetToday = allParticipantGoals.filter(g => dateUtils.isSameDay(new Date(g.setDate), selectedDate));
    if (goalsSetToday.length > 0) {
        events.push({ icon: '🏁', text: 'Nytt Mål Satt', details: goalsSetToday.map(g => g.fitnessGoals).join(', ') });
    }

    const allAchievementsToday = clubMemberships.filter(c => dateUtils.isSameDay(new Date(c.achievedDate), selectedDate));
    const highestAchievementsToday = getHighestClubAchievements(allAchievementsToday);
    if (highestAchievementsToday.length > 0) {
        const clubNames = highestAchievementsToday.map(c => CLUB_DEFINITIONS.find(cd => cd.id === c.clubId)?.name || 'Okänd klubb').join(', ');
        events.push({ icon: '🏅', text: 'Nytt Klubbmedlemskap', details: clubNames });
    }

    if (physiqueHistory.some(h => dateUtils.isSameDay(new Date(h.lastUpdated), selectedDate) && (h.inbodyScore || h.muscleMassKg))) {
        events.push({ icon: '🧬', text: `InBody-mätning / Profil uppdaterad` });
    }
    if (strengthStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), selectedDate))) {
        events.push({ icon: '🏋️', text: 'Styrketest loggat' });
    }
    if (conditioningStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), selectedDate))) {
        events.push({ icon: '💨', text: 'Konditionstest loggat' });
    }
    
    return events;
  }, [selectedDate, allParticipantGoals, clubMemberships, physiqueHistory, strengthStatsHistory, conditioningStatsHistory]);

  const hasGoalTargetForDay = useMemo(() => {
    if (!selectedDate) return false;
    return activeGoal?.targetDate ? dateUtils.isSameDay(new Date(activeGoal.targetDate), selectedDate) : false;
  }, [selectedDate, activeGoal]);


  if (!isOpen || !selectedDate) return null;

  const sortedActivities = [...activitiesForDay].sort((a,b) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());

  const handleSelectActivity = (logId: string) => {
    setSelectedActivityId(prevId => prevId === logId ? null : logId); 
  };
  
  const handleDeleteInitiated = (activity: ActivityLog) => {
    setActivityToConfirmDelete(activity);
    setShowConfirmDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (activityToConfirmDelete) {
      onDeleteActivity(activityToConfirmDelete.id, activityToConfirmDelete.type);
      if (selectedActivityId === activityToConfirmDelete.id) {
        setSelectedActivityId(null);
      }
    }
    setShowConfirmDeleteModal(false);
    setActivityToConfirmDelete(null);
  };

  const getConfirmationMessage = () => {
    if (!activityToConfirmDelete) return "";
    const dateStr = new Date(activityToConfirmDelete.completedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
    let activityName = "Aktivitet";
    if (activityToConfirmDelete.type === 'workout') {
        const workoutLog = activityToConfirmDelete as WorkoutLog;
        const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
        activityName = workoutTemplate?.title || "Okänt Gympass";
         if (workoutTemplate?.isModifiable && workoutLog.selectedExercisesForModifiable && workoutLog.selectedExercisesForModifiable.length > 0) {
            activityName += ` (${workoutLog.selectedExercisesForModifiable.map(e => e.name).join(' & ')})`;
        }
    } else if (activityToConfirmDelete.type === 'general') {
        activityName = (activityToConfirmDelete as GeneralActivityLog).activityName;
    } else if (activityToConfirmDelete.type === 'goal_completion') {
      const goalLog = activityToConfirmDelete as GoalCompletionLog;
      activityName = `Mål: "${goalLog.goalDescription}"`;
      return `Är du säker på att du vill ta bort diplomet för '${activityName}' från ${dateStr}? Detta kan inte ångras.`;
    }

    return activityToConfirmDelete.type === 'workout' 
      ? `Är du säker på att du vill ta bort denna logg för '${activityName}' från ${dateStr}? Detta kan inte ångras.`
      : `Är du säker på att du vill ta bort aktiviteten '${activityName}' från ${dateStr}? Detta kan inte ångras.`;
  };

  const handleConfirmCancel = () => {
    if (bookingToCancel) {
        onCancelBooking(bookingToCancel.id);
    }
    setBookingToCancel(null);
    onClose(); // Stänger aktivitetsvyn efter avbokning
  };

  const modalTitle = `Aktiviteter ${selectedDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        size="lg"
      >
        <div className="space-y-4">
          {coachEventsForDay.length > 0 && (
            <div className="p-3 bg-gray-100 rounded-lg space-y-2 border">
              <h4 className="text-base font-semibold text-gray-600 uppercase">Händelser & Nyheter</h4>
              <ul className="space-y-3">
                {coachEventsForDay.map(event => (
                  <li key={event.id} className="text-lg">
                    <div className="flex items-start">
                      <span className="text-2xl mr-2">{DEFAULT_COACH_EVENT_ICON}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{event.title}</p>
                        {event.description && <p className="text-base text-gray-600 whitespace-pre-wrap">{event.description}</p>}
                        {event.linkUrl && (
                            <div className="mt-2">
                                <a href={event.linkUrl.startsWith('http') ? event.linkUrl : `https://${event.linkUrl}`} target="_blank" rel="noopener noreferrer" className="inline-block">
                                    <Button size="sm">
                                        {event.linkButtonText || 'Läs mer här'}
                                    </Button>
                                </a>
                            </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {groupClassesForDay.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-lg space-y-2 border">
                  <h4 className="text-base font-semibold text-gray-600 uppercase">Bokade Gruppass</h4>
                  <ul className="space-y-2">
                      {groupClassesForDay.map((booking) => {
                          const now = new Date();
                          const cutoffHours = integrationSettings.cancellationCutoffHours ?? 2;
                          const canCancel = booking.startDateTime.getTime() - now.getTime() > cutoffHours * 3600 * 1000;
                          const isMyClassAsCoach = loggedInCoachId === booking.coachId;
                          
                          return (
                            <li key={booking.id} 
                                className="flex items-center text-lg p-2 bg-white rounded-md border-l-4"
                                style={{ borderColor: booking.color }}
                            >
                                <span className="text-2xl mr-2">🎟️</span>
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-800">{booking.startTime} - {booking.className}</span>
                                      {booking.status === 'CHECKED-IN' && <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Incheckad</span>}
                                    </div>
                                    <p className="text-base text-gray-500">med {booking.coachName}</p>
                                    {booking.isWaitlistedByMe && <p className="text-sm font-semibold text-amber-600 mt-1">Köplats #{booking.myWaitlistPosition}</p>}
                                </div>
                                {isMyClassAsCoach ? (
                                    <Button size="sm" onClick={() => onManageClassClick?.({ scheduleId: booking.scheduleId, date: booking.classDate })}>Hantera</Button>
                                ) : (
                                    booking.status !== 'CHECKED-IN' && (
                                        <Button 
                                        size="sm" 
                                        variant="danger" 
                                        className="!text-xs self-center"
                                        onClick={() => setBookingToCancel(booking)}
                                        disabled={!canCancel}
                                        title={!canCancel ? `Avbokning måste ske senast ${cutoffHours} timmar innan.` : 'Avboka passet'}
                                        >
                                        {canCancel ? 'Avboka' : 'För sent'}
                                        </Button>
                                    )
                                )}
                            </li>
                          );
                      })}
                  </ul>
              </div>
          )}
          {oneOnOneSessionsForDay.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-lg space-y-2 border">
                  <h4 className="text-base font-semibold text-gray-600 uppercase">Bokade Möten</h4>
                  <ul className="space-y-1">
                      {oneOnOneSessionsForDay.map((session) => {
                          const coach = staffMembers.find(st => st.id === session.coachId);
                          return (
                              <li key={session.id} className="flex items-start text-lg">
                                  <span className="text-2xl mr-2">🗣️</span>
                                  <div>
                                      <span className="font-semibold text-gray-800">{new Date(session.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - {session.title}</span>
                                      <p className="text-base text-gray-500">med {coach?.name || 'Coach'}</p>
                                  </div>
                              </li>
                          );
                      })}
                  </ul>
              </div>
          )}
          {specialEventsForDay.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-lg space-y-2 border">
                  <h4 className="text-base font-semibold text-gray-600 uppercase">Andra Händelser</h4>
                  <ul className="space-y-1">
                      {specialEventsForDay.map((event, index) => (
                          <li key={index} className="flex items-start text-lg">
                              <span className="text-2xl mr-2">{event.icon}</span>
                              <div className="flex-1">
                                  <span className="font-semibold text-gray-800">{event.text}</span>
                                  {event.details && <p className="text-base text-gray-500 italic">{event.details}</p>}
                              </div>
                          </li>
                      ))}
                  </ul>
              </div>
          )}
          {hasGoalTargetForDay && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center text-blue-800">
                  <span className="text-2xl mr-3">🎯</span>
                  <span className="font-semibold text-lg">Detta är ett måldatum!</span>
              </div>
          )}
          {sortedActivities.length === 0 && specialEventsForDay.length === 0 && !hasGoalTargetForDay && oneOnOneSessionsForDay.length === 0 && groupClassesForDay.length === 0 && coachEventsForDay.length === 0 ? (
            <div className="text-center py-4">
                <p className="text-gray-600 text-xl">Inga aktiviteter loggade denna dag.</p>
                <p className="text-gray-500 text-base italic">Inga kommande pass eller möten.</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {sortedActivities.map((log, index) => {
                const isSelected = log.id === selectedActivityId;
                const baseItemStyle = "p-2.5 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out border-l-4";
                const selectedStyle = isSelected ? "ring-2 ring-flexibel ring-offset-1 shadow-md" : "hover:shadow-md";
                const moodEmoji = getMoodEmoji(log.moodRating);
                
                if (log.type === 'workout') {
                  const workoutLog = log as WorkoutLog;
                  const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
                  let displayTitle = workoutTemplate?.title || "Okänt Gympass";
                  const categoryColor = getColorForCategory(workoutTemplate?.category);
                  let exerciseSummary: string | null = null;

                  if (workoutTemplate?.isModifiable && workoutLog.selectedExercisesForModifiable && workoutLog.selectedExercisesForModifiable.length > 0) {
                      exerciseSummary = workoutLog.selectedExercisesForModifiable.map(e => e.name).join(', ');
                  } else if (workoutTemplate && !workoutTemplate.isModifiable && workoutTemplate.blocks && workoutTemplate.blocks.length > 0) {
                      const allExercises = workoutTemplate.blocks.flatMap(b => b.exercises);
                      const firstFewExercises = allExercises.slice(0, 2).map(e => e.name);
                      if (firstFewExercises.length > 0) {
                          exerciseSummary = firstFewExercises.join(', ') + (allExercises.length > 2 ? '...' : '');
                      }
                  }

                  return (
                    <li 
                      key={log.id} 
                      className={`${baseItemStyle} ${isSelected ? `bg-flexibel/10 ${selectedStyle}` : `bg-gray-100 ${selectedStyle}`}`}
                      style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards`, borderColor: categoryColor }}
                      onClick={() => handleSelectActivity(log.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`Välj logg för ${displayTitle}`}
                      title={workoutTemplate?.category}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-grow min-w-0">
                            <p className={`text-base font-semibold ${isSelected ? 'text-flexibel' : 'text-gray-800'}`}>
                              <span className="text-xl">🏋️</span> {displayTitle} {moodEmoji && <span className="ml-1 text-xl">{moodEmoji}</span>}
                            </p>
                            {exerciseSummary && <p className="text-sm text-gray-500 italic truncate">{exerciseSummary}</p>}
                            <p className="text-sm text-gray-500">
                              Loggat: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                         {isSelected && (
                              <div className="flex gap-2 animate-fade-in self-end">
                                  <Button size="sm" variant="danger" className="!text-xs" onClick={(e) => { e.stopPropagation(); handleDeleteInitiated(workoutLog); }}>
                                      Ta bort
                                  </Button>
                                  <Button size="sm" variant="outline" className="!text-xs" onClick={(e) => { e.stopPropagation(); onViewLogSummary(workoutLog); }}>
                                      Visa/Redigera
                                  </Button>
                              </div>
                          )}
                      </div>
                      {log.postWorkoutComment && (
                          <p className="text-sm text-gray-600 mt-2 italic bg-white p-1.5 rounded">Kommentar: "{log.postWorkoutComment}"</p>
                      )}
                    </li>
                  );
                } else if (log.type === 'general') {
                  const generalLog = log as GeneralActivityLog;
                  return (
                    <li 
                      key={log.id} 
                      className={`${baseItemStyle} ${isSelected ? `bg-flexibel/10 ${selectedStyle}` : `bg-blue-50 border-blue-200 ${selectedStyle}`}`}
                      style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards`, borderColor: '#9e9e9e' }}
                      onClick={() => handleSelectActivity(log.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`Välj aktivitet ${generalLog.activityName}`}
                      title={generalLog.activityName}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                          <div className="flex-grow">
                            <p className={`text-base font-semibold ${isSelected ? 'text-flexibel' : 'text-blue-700'}`}>
                                <span className="text-xl">{getGeneralActivityIcon(generalLog.activityName)}</span> {generalLog.activityName} {moodEmoji && <span className="ml-1 text-xl">{moodEmoji}</span>}
                            </p>
                            <p className="text-sm text-gray-500">
                                Loggat: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                             <div className="mt-1.5 text-sm text-gray-700 space-y-0.5">
                                <p><strong>Varaktighet:</strong> {generalLog.durationMinutes} min</p>
                                {generalLog.distanceKm !== undefined && <p><strong>Distans:</strong> {generalLog.distanceKm} km</p>}
                                {generalLog.caloriesBurned !== undefined && <p><strong>Kalorier:</strong> {generalLog.caloriesBurned} kcal</p>}
                                {generalLog.comment && <p className="mt-1"><em>"{generalLog.comment}"</em></p>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 self-center sm:self-start">
                             {isSelected && (
                                <Button size="sm" variant="danger" className="!text-xs animate-fade-in" onClick={(e) => { e.stopPropagation(); handleDeleteInitiated(generalLog); }}>
                                    Ta bort
                                </Button>
                            )}
                          </div>
                      </div>
                    </li>
                  );
                } else if (log.type === 'goal_completion') {
                    const goalLog = log as GoalCompletionLog;
                    return (
                      <li 
                        key={log.id} 
                        className={`${baseItemStyle} ${isSelected ? `bg-yellow-200 ${selectedStyle}` : `bg-yellow-50 border-yellow-200 ${selectedStyle}`}`}
                        style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards`, borderColor: '#facc15' }}
                        onClick={() => handleSelectActivity(log.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        aria-label={`Välj slutfört mål`}
                        title="Mål slutfört"
                      >
                         <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                            <div className="flex-grow">
                            <p className={`text-base font-semibold ${isSelected ? 'text-yellow-800' : 'text-yellow-700'}`}>
                                🏆 Mål Uppnått!
                            </p>
                            <p className="text-sm text-gray-600 italic mt-1">
                                Starkt jobbat!
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                Firades: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            </div>
                            <div className="flex-shrink-0 self-center sm:self-start">
                                {isSelected && (
                                    <Button size="sm" variant="danger" className="!text-xs animate-fade-in" onClick={(e) => { e.stopPropagation(); handleDeleteInitiated(goalLog); }}>
                                        Ta bort
                                    </Button>
                                )}
                            </div>
                        </div>
                      </li>
                    );
                }
                return null;
              })}
            </ul>
          )}
          <div className="flex justify-end items-center pt-4 border-t">
            <Button onClick={onClose} variant="secondary">
              Stäng
            </Button>
          </div>
        </div>
      </Modal>

      {activityToConfirmDelete && (
        <ConfirmationModal
          isOpen={showConfirmDeleteModal}
          onClose={() => {
            setShowConfirmDeleteModal(false);
            setActivityToConfirmDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Bekräfta Borttagning"
          message={getConfirmationMessage()}
          confirmButtonText="Ta bort"
          cancelButtonText="Avbryt"
        />
      )}
      
      <ConfirmationModal
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={handleConfirmCancel}
        title={
            bookingToCancel?.isWaitlistedByMe
                ? `Lämna kön för ${bookingToCancel?.className}?`
                : `Avboka ${bookingToCancel?.className}?`
        }
        message={
            bookingToCancel?.isWaitlistedByMe
                ? `Är du säker på att du vill lämna kön för ${bookingToCancel?.className} den ${bookingToCancel?.startDateTime.toLocaleDateString('sv-SE')}?`
                : `Är du säker på att du vill avboka din plats på ${bookingToCancel?.className} den ${bookingToCancel?.startDateTime.toLocaleDateString('sv-SE')}?`
        }
        confirmButtonText={bookingToCancel?.isWaitlistedByMe ? 'Ja, lämna kön' : 'Ja, avboka'}
        confirmButtonVariant="danger"
      />
    </>
  );
};