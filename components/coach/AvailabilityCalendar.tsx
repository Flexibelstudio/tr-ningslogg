import React, { useState, useMemo } from 'react';
import { StaffMember, StaffAvailability } from '../../types';
import { Button } from '../Button';
import { AvailabilityModal } from './AvailabilityModal';
import * as dateUtils from '../../utils/dateUtils';

interface AvailabilityCalendarProps {
  staffMember: StaffMember;
  availability: StaffAvailability[];
  setAvailability: (updater: StaffAvailability[] | ((prev: StaffAvailability[]) => StaffAvailability[])) => void;
}

// A virtual event instance used for rendering
interface CalendarEventInstance {
    originalData: StaffAvailability;
    instanceId: string; // Unique ID for this specific occurrence (for React keys)
    startTime: string; // Full ISO string (UTC)
    endTime: string; // Full ISO string (UTC)
}

const isTimeSlotAvailable = (day: Date, hour: number, weekEvents: CalendarEventInstance[]): boolean => {
    const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
    const slotStartTimestamp = slotStart.getTime();

    for (const event of weekEvents) {
        if (event.originalData.type !== 'available') {
            continue;
        }

        const eventStartTimestamp = new Date(event.startTime).getTime();
        const eventEndTimestamp = new Date(event.endTime).getTime();

        if (slotStartTimestamp >= eventStartTimestamp && slotStartTimestamp < eventEndTimestamp) {
            return true;
        }
    }
    return false;
};

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({ staffMember, availability, setAvailability }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<StaffAvailability | null>(null);
  const [initialTime, setInitialTime] = useState<{ date: Date, hour: number } | null>(null);

  const startOfWeek = useMemo(() => dateUtils.getStartOfWeek(currentDate), [currentDate]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        days.push(day);
    }
    return days;
  }, [startOfWeek]);

  const timeSlots = Array.from({ length: 15 }, (_, i) => 7 + i); // 7 AM to 9 PM

  const eventsForWeek = useMemo(() => {
    const expandedEvents: CalendarEventInstance[] = [];
    const weekStart = new Date(weekDays[0]);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekDays[6]);
    weekEnd.setHours(23, 59, 59, 999);

    for (const avail of availability) {
        if (avail.isRecurring && avail.recurringDetails) {
            // For recurring events, we need to respect the local time it was created with.
            const availStart = new Date(avail.startTime);
            const availEnd = new Date(avail.endTime);
            
            // Get the LOCAL hours and minutes from the original saved time.
            const startH = availStart.getHours();
            const startM = availStart.getMinutes();
            const endH = availEnd.getHours();
            const endM = availEnd.getMinutes();
            
            const recurrenceStartDate = new Date(avail.startTime);
            recurrenceStartDate.setHours(0, 0, 0, 0);

            const recurrenceEndDate = avail.recurringDetails.recurringEndDate
                ? new Date(avail.recurringDetails.recurringEndDate)
                : null;
            if (recurrenceEndDate) {
                recurrenceEndDate.setHours(23, 59, 59, 999);
            }
            
            for (const day of weekDays) {
                const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay();
                if (!avail.recurringDetails.daysOfWeek.includes(dayOfWeek)) {
                    continue;
                }
                
                const dayAtMidnight = new Date(day);
                dayAtMidnight.setHours(0,0,0,0);

                if (dayAtMidnight >= recurrenceStartDate && (!recurrenceEndDate || dayAtMidnight <= recurrenceEndDate)) {
                    // Create new LOCAL date objects for this specific day using the original LOCAL hours/minutes.
                    const newStartLocal = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startH, startM);
                    const newEndLocal = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endH, endM);
                    
                    expandedEvents.push({
                        originalData: avail,
                        instanceId: `${avail.id}-${day.toISOString().split('T')[0]}`,
                        startTime: newStartLocal.toISOString(), // Convert to UTC for consistent rendering
                        endTime: newEndLocal.toISOString(),
                    });
                }
            }
        } else {
            const eventDate = new Date(avail.startTime);
            if (eventDate >= weekStart && eventDate <= weekEnd) {
                expandedEvents.push({
                    originalData: avail,
                    instanceId: avail.id,
                    startTime: avail.startTime,
                    endTime: avail.endTime,
                });
            }
        }
    }
    return expandedEvents;
  }, [availability, weekDays]);

  const handleNavigate = (offset: number) => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(newDate.getDate() + offset * 7);
        return newDate;
    });
  };

  const handleCellClick = (date: Date, hour: number) => {
    setEditingAvailability(null);
    setInitialTime({ date, hour });
    setIsModalOpen(true);
  };
  
  const handleBlockClick = (e: React.MouseEvent, originalAvail: StaffAvailability) => {
      e.stopPropagation();
      setEditingAvailability(originalAvail);
      setInitialTime(null);
      setIsModalOpen(true);
  };

  const handleSaveAvailability = (data: StaffAvailability) => {
      if (editingAvailability) {
          setAvailability(prev => prev.map(a => a.id === data.id ? data : a));
      } else {
          setAvailability(prev => [...prev, data]);
      }
      setIsModalOpen(false);
  };

  const handleDeleteAvailability = (id: string) => {
      setAvailability(prev => prev.filter(a => a.id !== id));
      setIsModalOpen(false);
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
            Veckoschema för {staffMember.name}
        </h2>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <Button onClick={() => handleNavigate(-1)} variant="outline" size="sm">Föregående Vecka</Button>
            <Button onClick={() => setCurrentDate(new Date())} variant="outline" size="sm">Denna Vecka</Button>
            <Button onClick={() => handleNavigate(1)} variant="outline" size="sm">Nästa Vecka</Button>
        </div>
      </div>

      <div className="grid grid-cols-[auto,1fr,1fr,1fr,1fr,1fr,1fr,1fr] -mr-4">
        {/* Time column */}
        <div className="text-right text-xs text-gray-500 pr-2">
            {timeSlots.map(hour => (
                <div key={hour} className="h-12 flex items-center justify-end">{hour}:00</div>
            ))}
        </div>

        {/* Day columns */}
        {weekDays.map(day => (
            <div key={day.toISOString()} className="relative border-l border-gray-200">
                <div className="text-center py-2 border-b">
                    <p className="font-semibold text-sm">{day.toLocaleDateString('sv-SE', { weekday: 'short' })}</p>
                    <p className="text-xs text-gray-500">{day.getDate()}</p>
                </div>
                <div className="relative">
                    {timeSlots.map(hour => {
                        const isAvailable = isTimeSlotAvailable(day, hour, eventsForWeek);
                        return (
                            <div
                                key={hour}
                                className={`h-12 border-t border-gray-100 cursor-pointer ${isAvailable ? 'hover:bg-flexibel/10' : 'bg-gray-100'}`}
                                onClick={() => handleCellClick(day, hour)}
                            ></div>
                        );
                    })}
                    {eventsForWeek.filter(event => new Date(event.startTime).toDateString() === day.toDateString()).map(eventInstance => {
                        const start = new Date(eventInstance.startTime);
                        const end = new Date(eventInstance.endTime);
                        
                        const startHour = start.getHours();
                        const startMinutes = start.getMinutes();
                        
                        const top = ((startHour + startMinutes/60) - 7) * 48; // 48px per hour
                        const height = ((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 48;
                        const isAvailable = eventInstance.originalData.type === 'available';

                        const startTimeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                        const endTimeStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

                        return (
                            <div
                                key={eventInstance.instanceId}
                                style={{ top: `${top}px`, height: `${height}px` }}
                                className={`absolute left-1 right-1 p-2 rounded-lg text-white text-xs z-10 cursor-pointer overflow-hidden ${isAvailable ? 'bg-flexibel hover:bg-flexibel/90' : 'bg-gray-400 hover:bg-gray-500'}`}
                                onClick={(e) => handleBlockClick(e, eventInstance.originalData)}
                            >
                                <p className="font-bold">{startTimeStr} - {endTimeStr}</p>
                                <p>{isAvailable ? 'Arbetstid' : 'Blockerad'}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        ))}
      </div>
      
      {isModalOpen && (
        <AvailabilityModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveAvailability}
            onDelete={handleDeleteAvailability}
            staffMember={staffMember}
            availabilityToEdit={editingAvailability}
            initialTime={initialTime}
        />
      )}
    </div>
  );
};