import React, { useState, useMemo } from 'react';
import { OneOnOneSession, ParticipantProfile, StaffMember, GroupClassSchedule, GroupClassDefinition, ParticipantBooking } from '../../types';
import { Button } from '../Button';
import { ONE_ON_ONE_SESSION_TYPES } from '../../constants';

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
  bookings: ParticipantBooking[];
  onGroupClassClick: (instance: EnrichedClassInstance) => void;
}

const SESSION_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; }> = {
  'PT-pass': { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  'Avstämningssamtal': { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  'InBody-mätning': { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
  'Anpassat Möte': { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
  'GROUP_CLASS': { bg: 'bg-sky-100', border: 'border-sky-400', text: 'text-sky-800' },
};

export const CalendarView: React.FC<CalendarViewProps> = ({ 
    sessions, participants, coaches, onSessionClick, onDayClick, onSessionEdit, onSessionDelete, 
    groupClassSchedules, groupClassDefinitions, bookings, onGroupClassClick 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysOfWeek = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  const calendarDays = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    let startDate = new Date(monthStart);
    const dayOfWeek = startDate.getDay();
    const diff = (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Monday is 0
    startDate.setDate(startDate.getDate() - diff);

    const days = [];
    for (let i = 0; i < 42; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
    }
    return days;
  }, [currentDate]);
  
  const handleNavigate = (offset: number) => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() + offset);
        return newDate;
    });
  };

  const getEnrichedGroupClassesForDay = (day: Date): EnrichedClassInstance[] => {
    const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
    const dateStr = day.toISOString().split('T')[0];

    return groupClassSchedules
      .filter(schedule => {
        // FIX: Parse date strings as local time to avoid timezone issues.
        // new Date('YYYY-MM-DD') parses as UTC midnight, which can cause off-by-one day errors.
        const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);
        
        const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        // Set end date to the very end of the day for inclusive check
        endDate.setHours(23, 59, 59, 999);

        return schedule.daysOfWeek.includes(dayOfWeek) && day >= startDate && day <= endDate;
      })
      .map(schedule => {
        const classDef = groupClassDefinitions.find(d => d.id === schedule.groupClassId);
        const coach = coaches.find(c => c.id === schedule.coachId);
        if (!classDef || !coach) return null;

        const [hour, minute] = schedule.startTime.split(':').map(Number);
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
          duration: schedule.durationMinutes,
          coachName: coach.name,
          coachId: coach.id,
          locationId: schedule.locationId,
          maxParticipants: schedule.maxParticipants,
          bookedCount: bookedUsers.length,
          waitlistCount: waitlistedUsers.length,
          isFull: bookedUsers.length >= schedule.maxParticipants,
          allBookingsForInstance,
        };
      })
      .filter((i): i is EnrichedClassInstance => i !== null)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 capitalize">
            {currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <Button onClick={() => handleNavigate(-1)} variant="outline" size="sm">Föregående</Button>
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" size="sm">Idag</Button>
            <Button onClick={() => handleNavigate(1)} variant="outline" size="sm">Nästa</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold text-gray-500 border-b mb-1 pb-1">
        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day, index) => {
            const sessionsForDay = sessions.filter(s => new Date(s.startTime).toDateString() === day.toDateString())
                .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            
            const groupClassesForDay = getEnrichedGroupClassesForDay(day);
            
            const isToday = day.toDateString() === new Date().toDateString();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();

            return (
                <div 
                    key={index}
                    onClick={() => onDayClick(day)}
                    className={`p-1 sm:p-2 min-h-[120px] border transition-colors duration-150 ease-in-out relative cursor-pointer
                        ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                >
                    <time dateTime={day.toISOString()} className={`font-semibold ${isToday ? 'bg-flexibel text-white rounded-full h-6 w-6 flex items-center justify-center' : ''}`}>
                        {day.getDate()}
                    </time>
                    <div className="mt-1 space-y-1">
                        {sessionsForDay.map(session => {
                            const participant = participants.find(p => p.id === session.participantId);
                            const coach = coaches.find(c => c.id === session.coachId);
                            const colorConfig = SESSION_TYPE_COLORS[session.title] || SESSION_TYPE_COLORS['Anpassat Möte'];
                            const startTime = new Date(session.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div
                                    key={session.id}
                                    onClick={(e) => { e.stopPropagation(); onSessionClick(session); }}
                                    className={`p-1.5 rounded text-xs ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text} border-l-4 cursor-pointer hover:shadow-md transition-shadow`}
                                >
                                    <p className="font-bold truncate">{startTime} - {session.title}</p>
                                    <p className="truncate">{participant?.name || 'Okänd'}</p>
                                    <p className="truncate text-gray-500 text-[10px] hidden sm:block">Coach: {coach?.name || 'Okänd'}</p>
                                </div>
                            );
                        })}
                         {groupClassesForDay.map(instance => {
                            const colorConfig = SESSION_TYPE_COLORS['GROUP_CLASS'];
                            const startTime = instance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div
                                    key={instance.instanceId}
                                    onClick={(e) => { e.stopPropagation(); onGroupClassClick(instance); }}
                                    className={`p-1.5 rounded text-xs ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text} border-l-4 cursor-pointer hover:shadow-md transition-shadow`}
                                >
                                    <p className="font-bold truncate">{startTime} - {instance.className}</p>
                                    <p className="truncate">{instance.bookedCount}/{instance.maxParticipants} bokade</p>
                                    <p className="truncate text-gray-500 text-[10px] hidden sm:block">Coach: {instance.coachName}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )
        })}
      </div>
       <div className="mt-4 pt-4 border-t text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-sky-100 border border-sky-400"></div> Gruppass</span>
        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-100 border border-green-400"></div> PT-pass</span>
        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-400"></div> Avstämning</span>
        <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-400"></div> InBody</span>
      </div>
    </div>
  );
};