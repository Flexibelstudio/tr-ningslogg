
import React, { useState, useMemo, useCallback } from 'react';
import { OneOnOneSession, ParticipantProfile, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, GroupClassScheduleException } from '../../../types';
import { CalendarGrid } from '../../../components/CalendarGrid';
import * as dateUtils from '../../../utils/dateUtils';
import { useAppContext } from '../../../context/AppContext';

interface EnrichedClassInstance {
    instanceId: string;
    date: string;
    startDateTime: Date;
    scheduleId: string;
    className: string;
    coachId: string;
    locationId: string;
    duration: number;
    coachName: string;
    maxParticipants: number;
    bookedCount: number;
    waitlistCount: number;
    isFull: boolean;
    allBookingsForInstance: ParticipantBooking[];
    color: string;
    isCancelled: boolean;
}

interface CalendarViewProps {
  sessions: OneOnOneSession[];
  participants: ParticipantProfile[];
  coaches: StaffMember[];
  onSessionClick: (session: OneOnOneSession) => void;
  onDayClick: (date: Date) => void;
  onSessionEdit: (session: OneOnOneSession) => void;
  onSessionDelete: (session: OneOnOneSession) => void;
  groupClassSchedules: GroupClassSchedule[];
  groupClassDefinitions: GroupClassDefinition[];
  groupClassScheduleExceptions: GroupClassScheduleException[];
  bookings: ParticipantBooking[];
  onGroupClassClick: (instance: EnrichedClassInstance) => void;
  loggedInCoachId?: string;
}

const SESSION_TYPE_STYLES: Record<string, { bg: string; border: string; text: string; }> = {
  'PT-pass': { bg: 'bg-flexibel/10', border: 'border-flexibel', text: 'text-flexibel' },
  'Avstämningssamtal': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800' },
  'InBody-mätning': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-800' },
  'Anpassat Möte': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-800' },
};

const CalendarViewFC: React.FC<CalendarViewProps> = ({ 
    sessions, participants, coaches, onSessionClick, onDayClick,
    groupClassSchedules, groupClassDefinitions, groupClassScheduleExceptions, bookings, onGroupClassClick, loggedInCoachId
}) => {
  const { getColorForCategory } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());

  const getEnrichedGroupClassesForDay = useCallback((day: Date): EnrichedClassInstance[] => {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const dateStr = dateUtils.toYYYYMMDD(day);

    return groupClassSchedules
      .filter(schedule => {
        const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === schedule.id && ex.date === dateStr);
        if (exception && (exception.status === 'DELETED' || !exception.status)) {
            return false;
        }

        const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        
        const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        endDate.setHours(23, 59, 59, 999);

        return schedule.daysOfWeek.includes(dayOfWeek) && day >= startDate && day <= endDate;
      })
      .map(schedule => {
        const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === schedule.id && ex.date === dateStr);
        const isCancelled = !!(exception && exception.status === 'CANCELLED');

        const overriddenSchedule = {
            ...schedule,
            startTime: exception?.newStartTime || schedule.startTime,
            durationMinutes: exception?.newDurationMinutes || schedule.durationMinutes,
            coachId: exception?.newCoachId || schedule.coachId,
            maxParticipants: exception?.newMaxParticipants || schedule.maxParticipants,
        };

        const classDef = groupClassDefinitions.find(d => d.id === overriddenSchedule.groupClassId);
        const coach = coaches.find(c => c.id === overriddenSchedule.coachId);
        if (!classDef || !coach) return null;

        const [hour, minute] = overriddenSchedule.startTime.split(':').map(Number);
        const startDateTime = new Date(day);
        startDateTime.setHours(hour, minute, 0, 0);

        const allBookingsForInstance = bookings.filter(b => b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
        const bookedUsers = allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
        const waitlistedUsers = allBookingsForInstance.filter(b => b.status === 'WAITLISTED');

        return {
          instanceId: `${schedule.id}-${dateStr}`,
          date: dateStr,
          startDateTime,
          scheduleId: schedule.id,
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
          isCancelled,
        };
      })
      .filter((i): i is EnrichedClassInstance => i !== null)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  }, [groupClassSchedules, groupClassDefinitions, coaches, bookings, getColorForCategory, groupClassScheduleExceptions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, OneOnOneSession[]>();
    sessions.forEach(session => {
        const dayStr = new Date(session.startTime).toDateString();
        if (!map.has(dayStr)) map.set(dayStr, []);
        map.get(dayStr)!.push(session);
    });
    map.forEach(daySessions => daySessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    return map;
  }, [sessions]);

  const groupClassesByDay = useMemo(() => {
    const map = new Map<string, EnrichedClassInstance[]>();
    const gridStartDate = dateUtils.getStartOfWeek(dateUtils.getStartOfMonth(currentDate));

    for (let i = 0; i < 42; i++) { // 42 days for 6 weeks
        const day = dateUtils.addDays(gridStartDate, i);
        const dayStr = day.toDateString();
        const classes = getEnrichedGroupClassesForDay(new Date(day));
        if (classes.length > 0) {
            map.set(dayStr, classes);
        }
    }
    return map;
  }, [getEnrichedGroupClassesForDay, currentDate]);

  const holidaysMap = useMemo(() => {
    const year = currentDate.getFullYear();
    const allHolidays = [
        ...dateUtils.getSwedishHolidays(year - 1),
        ...dateUtils.getSwedishHolidays(year),
        ...dateUtils.getSwedishHolidays(year + 1),
    ];
    const map = new Map<string, dateUtils.Holiday>();
    allHolidays.forEach(h => map.set(h.date.toDateString(), h));
    return map;
  }, [currentDate]);

  const getHolidayForDay = useCallback((date: Date): dateUtils.Holiday | null => {
      return holidaysMap.get(date.toDateString()) || null;
  }, [holidaysMap]);

  const renderDayContent = useCallback((day: Date) => {
    const dayStr = day.toDateString();
    const sessionsForDay = sessionsByDay.get(dayStr) || [];
    const groupClassesForDay = groupClassesByDay.get(dayStr) || [];
    
    const allEvents = [
        ...sessionsForDay.map(s => ({ type: 'session', data: s, time: new Date(s.startTime) })),
        ...groupClassesForDay.map(gc => ({ type: 'group', data: gc, time: gc.startDateTime }))
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    return (
      <>
        {allEvents.slice(0, 3).map(event => {
            if (event.type === 'session') {
                const session = event.data as OneOnOneSession;
                const participant = participants.find(p => p.id === session.participantId);
                const style = SESSION_TYPE_STYLES[session.title] || SESSION_TYPE_STYLES['Anpassat Möte'];
                const startTime = event.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                return (
                    <button
                        key={session.id}
                        onClick={(e) => { e.stopPropagation(); onSessionClick(session); }}
                        className={`w-full p-1 sm:p-1.5 text-left rounded-md ${style.bg} ${style.border} ${style.text} border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-in-out`}
                    >
                        <p className="font-bold text-xs sm:text-sm truncate">{startTime} - {session.title}</p>
                        <p className="text-xs truncate">{participant?.name || 'Okänd'}</p>
                    </button>
                );
            }
            if (event.type === 'group') {
                const instance = event.data as EnrichedClassInstance;
                const categoryColor = instance.color;
                const categoryBgColor = categoryColor + '1A'; // ~10% opacity
                const startTime = event.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                const isCancelled = instance.isCancelled;
                return (
                     <button
                        key={instance.instanceId}
                        onClick={(e) => { e.stopPropagation(); onGroupClassClick(instance); }}
                        className={`w-full p-1 sm:p-1.5 text-left rounded-md border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-in-out text-gray-800 ${isCancelled ? 'opacity-60' : ''}`}
                        style={{ borderColor: isCancelled ? '#9ca3af' : categoryColor, backgroundColor: isCancelled ? '#f3f4f6' : categoryBgColor }}
                        title={instance.className}
                    >
                        <p className={`font-bold text-xs sm:text-sm truncate ${isCancelled ? 'line-through' : ''}`} style={{ color: isCancelled ? '#6b7280' : categoryColor }}>
                            {instance.coachId === loggedInCoachId && '⭐ '}
                            {startTime} - {instance.className}
                        </p>
                        <p className={`text-xs truncate ${isCancelled ? 'line-through' : ''}`}>{isCancelled ? 'INSTÄLLT' : `${instance.bookedCount}/${instance.maxParticipants} bokade`}</p>
                    </button>
                );
            }
            return null;
        })}
        {allEvents.length > 3 && (
            <p className="text-xs sm:text-sm font-semibold text-gray-500 mt-1 pl-1 sm:pl-1.5">+ {allEvents.length - 3} till</p>
        )}
      </>
    );
  }, [sessionsByDay, groupClassesByDay, participants, onSessionClick, onGroupClassClick, loggedInCoachId]);
  
  const getDayProps = useCallback((day: Date) => {
    const dayStr = day.toDateString();
    const hasContent = (sessionsByDay.get(dayStr)?.length || 0) > 0 || (groupClassesByDay.get(dayStr)?.length || 0) > 0;
    return { hasContent };
  }, [sessionsByDay, groupClassesByDay]);

  return (
    <div>
        <CalendarGrid 
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            onDayClick={onDayClick}
            renderDayContent={renderDayContent}
            getDayProps={getDayProps}
            getHolidayForDay={getHolidayForDay}
        />
        <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Teckenförklaring</h4>
            <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                {/* Dynamic Group Classes */}
                {groupClassDefinitions.map(def => {
                    const color = def.color || getColorForCategory(def.name);
                    const bgColor = color + '1A'; // ~10% opacity
                    return (
                        <span key={def.id} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm border-l-4" style={{ backgroundColor: bgColor, borderColor: color }}></div> {def.name}
                        </span>
                    );
                })}
                {/* Static 1-on-1 Sessions */}
                <span className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${SESSION_TYPE_STYLES['PT-pass'].bg} border-l-4 ${SESSION_TYPE_STYLES['PT-pass'].border}`}></div> PT-pass</span>
                <span className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${SESSION_TYPE_STYLES['Avstämningssamtal'].bg} border-l-4 ${SESSION_TYPE_STYLES['Avstämningssamtal'].border}`}></div> Avstämning</span>
                <span className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-sm ${SESSION_TYPE_STYLES['InBody-mätning'].bg} border-l-4 ${SESSION_TYPE_STYLES['InBody-mätning'].border}`}></div> InBody</span>
            </div>
        </div>
    </div>
  );
};

export const CalendarView = React.memo(CalendarViewFC);
