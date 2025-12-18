import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { OneOnOneSession, ParticipantProfile, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking, GroupClassScheduleException } from '../../../types';
import * as dateUtils from '../../../utils/dateUtils';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../components/Button';
import { Avatar } from '../../../components/Avatar';

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

const HOUR_HEIGHT = 80; // Pixels per hour
const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const SESSION_TYPE_STYLES: Record<string, { bg: string; border: string; text: string; }> = {
  'PT-pass': { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-800' },
  'Avstämningssamtal': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-800' },
  'InBody-mätning': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-800' },
  'Anpassat Möte': { bg: 'bg-slate-50', border: 'border-slate-500', text: 'text-slate-800' },
};

export const CalendarView: React.FC<CalendarViewProps> = ({ 
    sessions, participants, coaches, onSessionClick, onDayClick,
    groupClassSchedules, groupClassDefinitions, groupClassScheduleExceptions, bookings, onGroupClassClick, loggedInCoachId
}) => {
  const { getColorForCategory } = useAppContext();
  const [viewDate, setViewDate] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Uppdatera "nu"-klockan varje minut
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scrolla till 07:00 eller nuvarande tid vid start
  useEffect(() => {
    if (gridRef.current) {
        const currentHour = new Date().getHours();
        const scrollHour = currentHour >= START_HOUR && currentHour <= END_HOUR ? currentHour : START_HOUR;
        const scrollTop = (scrollHour - START_HOUR) * HOUR_HEIGHT;
        gridRef.current.scrollTop = scrollTop;
    }
  }, []);

  const startOfViewWeek = useMemo(() => dateUtils.getStartOfWeek(viewDate), [viewDate]);
  
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push(dateUtils.addDays(startOfViewWeek, i));
    }
    return days;
  }, [startOfViewWeek]);

  const handleNavigate = (amount: number, unit: 'day' | 'week') => {
    setViewDate(prev => {
        const d = new Date(prev);
        if (unit === 'day') d.setDate(d.getDate() + amount);
        else d.setDate(d.getDate() + amount * 7);
        return d;
    });
  };

  const getEnrichedClassesForDay = useCallback((day: Date): EnrichedClassInstance[] => {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const dateStr = dateUtils.toYYYYMMDD(day);

    return groupClassSchedules
      .filter(schedule => {
        const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === schedule.id && ex.date === dateStr);
        if (exception && exception.status === 'DELETED') return false;

        const startDate = new Date(schedule.startDate);
        const endDate = new Date(schedule.endDate);
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

        const allBookings = bookings.filter(b => b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
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
          bookedCount: allBookings.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN').length,
          waitlistCount: allBookings.filter(b => b.status === 'WAITLISTED').length,
          isFull: allBookings.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN').length >= overriddenSchedule.maxParticipants,
          allBookingsForInstance: allBookings,
          color: classDef.color || getColorForCategory(classDef.name),
          isCancelled,
        };
      })
      .filter((i): i is EnrichedClassInstance => i !== null);
  }, [groupClassSchedules, groupClassDefinitions, coaches, bookings, getColorForCategory, groupClassScheduleExceptions]);

  const renderEvent = (event: { type: 'session' | 'group', data: any, start: Date, duration: number }) => {
    const startHour = event.start.getHours();
    const startMin = event.start.getMinutes();
    const top = (startHour - START_HOUR + startMin / 60) * HOUR_HEIGHT;
    const height = (event.duration / 60) * HOUR_HEIGHT;

    if (event.type === 'session') {
        const s = event.data as OneOnOneSession;
        const p = participants.find(part => part.id === s.participantId);
        const style = SESSION_TYPE_STYLES[s.title] || SESSION_TYPE_STYLES['Anpassat Möte'];
        return (
            <div 
                key={s.id}
                onClick={(e) => { e.stopPropagation(); onSessionClick(s); }}
                className={`absolute left-0 right-0 m-0.5 p-1.5 rounded-lg border-l-4 shadow-sm cursor-pointer z-10 text-xs overflow-hidden hover:shadow-md transition-all ${style.bg} ${style.border} ${style.text}`}
                style={{ top: `${top}px`, height: `${height}px` }}
            >
                <p className="font-bold truncate">{event.start.toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'})} - {s.title}</p>
                <p className="truncate font-medium">{p?.name || 'Okänd'}</p>
            </div>
        );
    } else {
        const instance = event.data as EnrichedClassInstance;
        const isMyClass = instance.coachId === loggedInCoachId;
        return (
            <div 
                key={instance.instanceId}
                onClick={(e) => { e.stopPropagation(); onGroupClassClick(instance); }}
                className={`absolute left-0 right-0 m-0.5 p-1.5 rounded-lg border-l-4 shadow-sm cursor-pointer z-10 text-xs overflow-hidden hover:shadow-md transition-all ${instance.isCancelled ? 'bg-gray-100 border-gray-400 opacity-60' : 'text-white'}`}
                style={{ 
                    top: `${top}px`, 
                    height: `${height}px`, 
                    backgroundColor: instance.isCancelled ? undefined : instance.color,
                    borderColor: instance.isCancelled ? undefined : 'rgba(0,0,0,0.1)'
                }}
            >
                <p className={`font-bold truncate ${instance.isCancelled ? 'line-through text-gray-600' : ''}`}>
                    {isMyClass && '⭐ '}{event.start.toLocaleTimeString('sv-SE', {hour:'2-digit', minute:'2-digit'})} - {instance.className}
                </p>
                <p className={`truncate font-medium ${instance.isCancelled ? 'text-gray-500' : 'text-white/90'}`}>
                    {instance.isCancelled ? 'INSTÄLLT' : `${instance.bookedCount}/${instance.maxParticipants} bokade`}
                </p>
            </div>
        );
    }
  };

  const DayColumn = ({ date, isMobile }: { date: Date, isMobile?: boolean }) => {
    const dateStr = dateUtils.toYYYYMMDD(date);
    const daySessions = sessions.filter(s => dateUtils.isSameDay(new Date(s.startTime), date));
    const dayClasses = getEnrichedClassesForDay(date);
    const isToday = dateUtils.isSameDay(date, now);

    return (
        <div className={`relative flex-1 border-r border-gray-200 min-w-0 ${isToday ? 'bg-flexibel/5' : ''}`}>
            {/* Hour Grid Lines */}
            {HOURS.map((h, i) => (
                <React.Fragment key={h}>
                    <div className="absolute w-full border-t border-gray-100" style={{ top: `${i * HOUR_HEIGHT}px`, height: '1px' }} />
                    <div className="absolute w-full border-t border-gray-50 border-dashed" style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT/2}px`, height: '1px' }} />
                </React.Fragment>
            ))}

            {/* Clickable Area for creating new events */}
            <div 
                className="absolute inset-0 z-0 cursor-crosshair" 
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const clickedHour = START_HOUR + Math.floor(y / HOUR_HEIGHT);
                    const clickedDate = new Date(date);
                    clickedDate.setHours(clickedHour, 0, 0, 0);
                    onDayClick(clickedDate);
                }}
            />

            {/* Events */}
            {daySessions.map(s => renderEvent({ type: 'session', data: s, start: new Date(s.startTime), duration: (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000 }))}
            {dayClasses.map(c => renderEvent({ type: 'group', data: c, start: c.startDateTime, duration: c.duration }))}

            {/* Now Indicator Line */}
            {isToday && now.getHours() >= START_HOUR && now.getHours() <= END_HOUR && (
                <div 
                    className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                    style={{ top: `${(now.getHours() - START_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT}px` }}
                >
                    <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Navigation Header */}
        <header className="p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">
                    <span className="md:hidden flex items-center gap-3">
                        <button onClick={() => handleNavigate(-1, 'day')} className="p-1 hover:bg-gray-100 rounded-full">&lt;</button>
                        {viewDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })}
                        <button onClick={() => handleNavigate(1, 'day')} className="p-1 hover:bg-gray-100 rounded-full">&gt;</button>
                    </span>
                    <span className="hidden md:inline">
                        Vecka {dateUtils.getISOWeek(viewDate)}, {viewDate.getFullYear()}
                    </span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setViewDate(new Date())} className="text-flexibel">Idag</Button>
            </div>
            
            <div className="hidden md:flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <Button variant="ghost" size="sm" onClick={() => handleNavigate(-1, 'week')}>Föregående vecka</Button>
                <Button variant="ghost" size="sm" onClick={() => handleNavigate(1, 'week')}>Nästa vecka</Button>
            </div>
        </header>

        {/* Calendar Body */}
        <div className="flex flex-col flex-grow overflow-hidden">
            {/* Days Header */}
            <div className="flex border-b border-gray-200 bg-gray-50/50">
                <div className="w-16 flex-shrink-0" /> {/* Time axis padding */}
                <div className="flex flex-grow">
                    {/* Desktop Headers */}
                    <div className="hidden md:flex flex-grow">
                        {weekDays.map(day => (
                            <div key={day.toISOString()} className={`flex-1 py-3 text-center border-r border-gray-200 last:border-r-0 ${dateUtils.isSameDay(day, now) ? 'bg-flexibel/10' : ''}`}>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{day.toLocaleDateString('sv-SE', { weekday: 'short' })}</p>
                                <p className={`text-lg font-extrabold ${dateUtils.isSameDay(day, now) ? 'text-flexibel' : 'text-gray-700'}`}>{day.getDate()}</p>
                            </div>
                        ))}
                    </div>
                    {/* Mobile Header (single day) */}
                    <div className="md:hidden flex-grow py-3 text-center bg-flexibel/5">
                         <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{viewDate.toLocaleDateString('sv-SE', { weekday: 'short' })}</p>
                         <p className="text-lg font-extrabold text-flexibel">{viewDate.getDate()}</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Grid Area */}
            <div ref={gridRef} className="flex-grow overflow-y-auto relative bg-dotted-pattern bg-[length:20px_20px]">
                <div className="flex min-h-full" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                    {/* Time Axis */}
                    <div className="w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-30">
                        {HOURS.map((h, i) => (
                            <div key={h} className="relative h-20 text-right pr-2 text-xs font-bold text-gray-400" style={{ height: `${HOUR_HEIGHT}px` }}>
                                <span className="absolute -top-2 right-2">{String(h).padStart(2, '0')}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Content Columns */}
                    <div className="flex flex-grow relative">
                        {/* Desktop: 7 cols */}
                        <div className="hidden md:flex flex-grow">
                            {weekDays.map(day => (
                                <DayColumn key={day.toISOString()} date={day} />
                            ))}
                        </div>
                        {/* Mobile: 1 col */}
                        <div className="md:hidden flex flex-grow">
                            <DayColumn date={viewDate} isMobile />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer info */}
        <footer className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-4">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> PT-pass</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Avstämning</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" /> InBody</span>
            <span className="flex items-center gap-1">⭐ = Dina pass</span>
        </footer>
    </div>
  );
};