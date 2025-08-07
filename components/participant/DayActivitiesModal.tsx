import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ActivityLog, Workout, WorkoutLog, GeneralActivityLog, Exercise, GoalCompletionLog, ParticipantGoalData, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, ParticipantProfile, CoachEvent, ParticipantPhysiqueStat, OneOnOneSession, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking } from '../../types';
import { ConfirmationModal } from '../ConfirmationModal';
import { MOOD_OPTIONS, CLUB_DEFINITIONS, DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants'; 
import * as dateUtils from '../../utils/dateUtils';

interface DayActivitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  activitiesForDay: ActivityLog[];
  workouts: Workout[]; 
  onViewLogSummary: (log: ActivityLog) => void; 
  onDeleteActivity: (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => void;
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

export const DayActivitiesModal: React.FC<DayActivitiesModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  activitiesForDay,
  workouts,
  onViewLogSummary,
  onDeleteActivity,
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
  allParticipantBookings
}) => {
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [activityToConfirmDelete, setActivityToConfirmDelete] = useState<ActivityLog | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedActivityId(null); 
      setActivityToConfirmDelete(null);
    }
  }, [isOpen]);

  const oneOnOneSessionsForDay = useMemo(() => {
    if (!selectedDate || !participantProfile) return [];
    return oneOnOneSessions
        .filter(s => s.participantId === participantProfile.id && dateUtils.isSameDay(new Date(s.startTime), selectedDate))
        .sort((a,b) => new Date(a.startTime).getTime() - new Date(a.startTime).getTime());
  }, [selectedDate, oneOnOneSessions, participantProfile]);

  const groupClassesForDay = useMemo(() => {
    if (!selectedDate || !participantProfile) return [];
    const myBookingsToday = allParticipantBookings.filter(b => b.participantId === participantProfile.id && b.classDate === selectedDate.toISOString().split('T')[0]);
    
    return myBookingsToday.map(booking => {
        const schedule = groupClassSchedules.find(s => s.id === booking.scheduleId);
        if (!schedule) return null;
        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
        const coach = staffMembers.find(s => s.id === schedule.coachId);
        if (!classDef || !coach) return null;

        return {
            ...booking,
            className: classDef.name,
            startTime: schedule.startTime,
            coachName: coach.name,
        };
    }).filter((b): b is NonNullable<typeof b> => b !== null).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [selectedDate, participantProfile, allParticipantBookings, groupClassSchedules, groupClassDefinitions, staffMembers]);


  const specialEventsForDay = useMemo(() => {
    if (!selectedDate) return [];
    
    const events: { icon: string, text: string, details?: string }[] = [];

    const coachEventsToday = coachEvents.filter(e => e.type === 'event' && e.eventDate && dateUtils.isSameDay(new Date(e.eventDate), selectedDate));
    coachEventsToday.forEach(event => { 
        const details = [event.description, `Gäller för: ${getStudioLabel(event.studioTarget)}`].filter(Boolean).join(' - ');
        events.push({ icon: DEFAULT_COACH_EVENT_ICON, text: event.title, details: details });
    });

    const goalsSetToday = allParticipantGoals.filter(g => dateUtils.isSameDay(new Date(g.setDate), selectedDate));
    if (goalsSetToday.length > 0) {
        events.push({ icon: '🏁', text: 'Nytt Mål Satt', details: goalsSetToday.map(g => g.fitnessGoals).join(', ') });
    }

    const achievementsToday = clubMemberships.filter(c => dateUtils.isSameDay(new Date(c.achievedDate), selectedDate));
    if (achievementsToday.length > 0) {
        const clubNames = achievementsToday.map(c => CLUB_DEFINITIONS.find(cd => cd.id === c.clubId)?.name || 'Okänd klubb').join(', ');
        events.push({ icon: '🏅', text: 'Nytt Klubbmedlemskap', details: clubNames });
    }

    if (physiqueHistory.some(h => dateUtils.isSameDay(new Date(h.lastUpdated), selectedDate) && (h.inbodyScore || h.muscleMassKg))) {
        events.push({ icon: '🧬', text: 'InBody-mätning / Profil uppdaterad' });
    }

    if (strengthStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), selectedDate))) {
        events.push({ icon: '🏋️', text: 'Styrketest loggat' });
    }

    if (conditioningStatsHistory.some(s => dateUtils.isSameDay(new Date(s.lastUpdated), selectedDate))) {
        events.push({ icon: '💨', text: 'Konditionstest loggat' });
    }
    
    return events;
  }, [selectedDate, allParticipantGoals, clubMemberships, physiqueHistory, strengthStatsHistory, conditioningStatsHistory, coachEvents]);

  const hasGoalTargetForDay = useMemo(() => {
    if (!selectedDate) return false;
    return allParticipantGoals.some(g => g.targetDate && dateUtils.isSameDay(new Date(g.targetDate), selectedDate));
  }, [selectedDate, allParticipantGoals]);


  if (!isOpen || !selectedDate) return null;

  const sortedActivities = [...activitiesForDay].sort((a,b) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());

  const handleSelectActivity = (logId: string) => {
    setSelectedActivityId(prevId => prevId === logId ? null : logId); 
  };
  
  const handleDeleteInitiated = () => {
    if (selectedActivityId) {
      const activity = sortedActivities.find(act => act.id === selectedActivityId);
      if (activity) {
        setActivityToConfirmDelete(activity);
        setShowConfirmDeleteModal(true);
      }
    }
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
          {groupClassesForDay.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-lg space-y-2 border">
                  <h4 className="text-base font-semibold text-gray-600 uppercase">Bokade Gruppass</h4>
                  <ul className="space-y-1">
                      {groupClassesForDay.map((booking) => (
                          <li key={booking.id} className="flex items-start text-lg">
                              <span className="text-2xl mr-2">🎟️</span>
                              <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-800">{booking.startTime} - {booking.className}</span>
                                    {booking.status === 'CHECKED-IN' && <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Incheckad</span>}
                                  </div>
                                  <p className="text-base text-gray-500">med {booking.coachName}</p>
                              </div>
                          </li>
                      ))}
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
                  <h4 className="text-base font-semibold text-gray-600 uppercase">Händelser denna dag</h4>
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
          {sortedActivities.length === 0 && specialEventsForDay.length === 0 && !hasGoalTargetForDay && oneOnOneSessionsForDay.length === 0 && groupClassesForDay.length === 0 ? (
            <p className="text-gray-600 text-center py-4 text-xl">Inga aktiviteter loggade denna dag.</p>
          ) : (
            <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
              {sortedActivities.map((log) => {
                const isSelected = log.id === selectedActivityId;
                const baseItemStyle = "p-3 rounded-lg shadow-sm cursor-pointer transition-all duration-150 ease-in-out";
                const selectedStyle = isSelected ? "ring-2 ring-flexibel ring-offset-1 shadow-md" : "hover:shadow-md";
                const moodEmoji = getMoodEmoji(log.moodRating);
                
                if (log.type === 'workout') {
                  const workoutLog = log as WorkoutLog;
                  const workoutTemplate = workouts.find(w => w.id === workoutLog.workoutId);
                  let displayTitle = workoutTemplate?.title || "Okänt Gympass";
                  let exerciseSummary: string | null = null;

                  if (workoutTemplate?.isModifiable && workoutLog.selectedExercisesForModifiable && workoutLog.selectedExercisesForModifiable.length > 0) {
                      exerciseSummary = workoutLog.selectedExercisesForModifiable.map(e => e.name).join(', ');
                  } else if (workoutTemplate && !workoutTemplate.isModifiable && workoutTemplate.blocks.length > 0) {
                      const firstFewExercises = workoutTemplate.blocks.flatMap(b => b.exercises).slice(0, 2).map(e => e.name);
                      if (firstFewExercises.length > 0) {
                          exerciseSummary = firstFewExercises.join(', ') + (workoutTemplate.blocks.flatMap(b => b.exercises).length > 2 ? '...' : '');
                      }
                  }

                  return (
                    <li 
                      key={log.id} 
                      className={`${baseItemStyle} ${isSelected ? `bg-flexibel/10 ${selectedStyle}` : `bg-gray-100 ${selectedStyle}`}`}
                      onClick={() => handleSelectActivity(log.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`Välj logg för ${displayTitle}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div className="flex-grow">
                          <p className={`text-xl font-semibold ${isSelected ? 'text-flexibel' : 'text-gray-800'}`}>
                            🏋️ {displayTitle} {moodEmoji && <span className="ml-1 text-2xl">{moodEmoji}</span>}
                          </p>
                          {exerciseSummary && <p className="text-sm text-gray-500 italic">{exerciseSummary}</p>}
                          <p className="text-base text-gray-500">
                            Loggat: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Button
                            onClick={(e) => { e.stopPropagation(); onViewLogSummary(workoutLog);}}
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0"
                            aria-label={`Visa detaljer för ${displayTitle}`}
                        >
                            Visa/Redigera
                        </Button>
                      </div>
                      {log.postWorkoutComment && (
                          <p className="text-base text-gray-600 mt-2 italic bg-white p-1.5 rounded">Kommentar: "{log.postWorkoutComment}"</p>
                      )}
                    </li>
                  );
                } else if (log.type === 'general') {
                  const generalLog = log as GeneralActivityLog;
                  return (
                    <li 
                      key={log.id} 
                      className={`${baseItemStyle} ${isSelected ? `bg-flexibel/10 ${selectedStyle}` : `bg-blue-50 border border-blue-200 ${selectedStyle}`}`}
                      onClick={() => handleSelectActivity(log.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      aria-label={`Välj aktivitet ${generalLog.activityName}`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div className="flex-grow">
                            <p className={`text-xl font-semibold ${isSelected ? 'text-flexibel' : 'text-blue-700'}`}>
                                {getGeneralActivityIcon(generalLog.activityName)} {generalLog.activityName} {moodEmoji && <span className="ml-1 text-2xl">{moodEmoji}</span>}
                            </p>
                            <p className="text-base text-gray-500">
                                Loggat: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                      </div>
                      <div className="mt-1.5 text-base text-gray-700 space-y-0.5">
                        <p><strong>Varaktighet:</strong> {generalLog.durationMinutes} min</p>
                        {generalLog.distanceKm !== undefined && <p><strong>Distans:</strong> {generalLog.distanceKm} km</p>}
                        {generalLog.caloriesBurned !== undefined && <p><strong>Kalorier:</strong> {generalLog.caloriesBurned} kcal</p>}
                        {generalLog.comment && <p className="mt-1"><em>"{generalLog.comment}"</em></p>}
                      </div>
                    </li>
                  );
                } else if (log.type === 'goal_completion') {
                    const goalLog = log as GoalCompletionLog;
                    return (
                      <li 
                        key={log.id} 
                        className={`${baseItemStyle} ${isSelected ? `bg-yellow-200 ${selectedStyle}` : `bg-yellow-50 border border-yellow-200 ${selectedStyle}`}`}
                        onClick={() => handleSelectActivity(log.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectActivity(log.id)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        aria-label={`Välj slutfört mål`}
                      >
                        <div className="flex-grow">
                          <p className={`text-xl font-semibold ${isSelected ? 'text-yellow-800' : 'text-yellow-700'}`}>
                              🏆 Mål Uppnått!
                          </p>
                           <p className="text-base text-gray-600 italic mt-1">
                              "{goalLog.goalDescription}"
                           </p>
                          <p className="text-base text-gray-500 mt-2">
                              Firades: {new Date(log.completedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </li>
                    );
                }
                return null;
              })}
            </ul>
          )}
          <div className="flex justify-end items-center space-x-3 pt-4 border-t">
            <Button 
                onClick={handleDeleteInitiated} 
                variant="danger" 
                disabled={!selectedActivityId || sortedActivities.length === 0}
                aria-label="Ta bort markerad aktivitet"
            >
              <TrashIcon /> Ta bort markerad
            </Button>
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
    </>
  );
};