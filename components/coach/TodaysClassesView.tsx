import React, { useMemo } from 'react';
import { GroupClassSchedule, GroupClassDefinition, ParticipantBooking, StaffMember } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../Button';

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
}

interface TodaysClassesViewProps {
  schedules: GroupClassSchedule[];
  definitions: GroupClassDefinition[];
  bookings: ParticipantBooking[];
  coaches: StaffMember[];
  onManageClick: (instance: EnrichedClassInstance) => void;
  loggedInStaff: StaffMember | null;
}

export const TodaysClassesView: React.FC<TodaysClassesViewProps> = ({ schedules, definitions, bookings, coaches, onManageClick, loggedInStaff }) => {
  const { getColorForCategory } = useAppContext();
  
  const todaysInstances = useMemo(() => {
    if (!loggedInStaff) return [];
    
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    const dateStr = today.toISOString().split('T')[0];

    return schedules
      .filter((schedule) => {
        if (schedule.coachId !== loggedInStaff.id) return false;

        const startDate = new Date(schedule.startDate);
        const endDate = new Date(schedule.endDate);
        endDate.setHours(23, 59, 59, 999);
        return schedule.daysOfWeek.includes(dayOfWeek) && today >= startDate && today <= endDate;
      })
      .map((schedule) => {
        const classDef = definitions.find((d) => d.id === schedule.groupClassId);
        // We already know the coach is the loggedInStaff, so we can simplify.
        if (!classDef) return null;

        const [hour, minute] = schedule.startTime.split(':').map(Number);
        const startDateTime = new Date(today);
        startDateTime.setHours(hour, minute, 0, 0);

        const allBookingsForInstance = bookings.filter((b) => b.scheduleId === schedule.id && b.classDate === dateStr && b.status !== 'CANCELLED');
        const bookedUsers = allBookingsForInstance.filter((b) => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
        const waitlistedUsers = allBookingsForInstance.filter((b) => b.status === 'WAITLISTED');

        return {
          instanceId: `${schedule.id}-${dateStr}`,
          date: dateStr,
          startDateTime,
          scheduleId: schedule.id,
          className: classDef.name,
          duration: schedule.durationMinutes,
          coachName: loggedInStaff.name,
          coachId: loggedInStaff.id,
          locationId: schedule.locationId,
          maxParticipants: schedule.maxParticipants,
          bookedCount: bookedUsers.length,
          waitlistCount: waitlistedUsers.length,
          isFull: bookedUsers.length >= schedule.maxParticipants,
          allBookingsForInstance,
          color: classDef.color || getColorForCategory(classDef.name),
        };
      })
      .filter((i): i is EnrichedClassInstance => i !== null)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
  }, [schedules, definitions, bookings, getColorForCategory, loggedInStaff]);

  if (todaysInstances.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-800">Dina Pass Idag</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {todaysInstances.map((instance) => (
          <div key={instance.instanceId} className="bg-white p-4 rounded-lg shadow-md border flex flex-col">
            <p className="font-bold text-xl text-gray-800">
              {instance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - {instance.className}
            </p>
            <p className="text-sm text-gray-500">
              {instance.bookedCount}/{instance.maxParticipants} bokade {instance.waitlistCount > 0 ? `(${instance.waitlistCount} i kö)` : ''}
            </p>
            <Button onClick={() => onManageClick(instance)} className="mt-auto pt-3 w-full">
              Hantera Pass
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};