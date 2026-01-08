
import React from 'react';
import { Button } from '../../../components/Button';
import { Avatar } from '../../../components/Avatar';
import { ParticipantBooking, GroupClassSchedule, GroupClassDefinition, StaffMember } from '../../../types';

// Define the shape of the 'nextBooking' prop
interface EnrichedBooking {
    booking: ParticipantBooking;
    schedule: GroupClassSchedule;
    classDef: GroupClassDefinition;
    coach: StaffMember;
    startDateTime: Date;
}

interface NextBookingCardProps {
  nextBooking: EnrichedBooking | null;
}

export const NextBookingCard: React.FC<NextBookingCardProps> = ({ nextBooking }) => {
    const CalendarIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );

    if (nextBooking) {
        const { classDef, coach, startDateTime, booking, schedule } = nextBooking;
        // In a real scenario, we might want to check for an exception here too, 
        // but nextBooking already contains an 'enriched' version or we can assume 
        // the schedule.specialLabel is a good fallback.
        const displayClassName = classDef.name + (schedule.specialLabel ? ` - ${schedule.specialLabel}` : '');

        return (
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 flex items-center h-full">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-flexibel/10 text-flexibel mr-3 sm:mr-4">
                    <CalendarIcon />
                </div>
                <div className="flex-grow flex justify-between items-center">
                    <div>
                        <p className="text-sm sm:text-base font-medium text-gray-500">Nästa pass</p>
                        <p className="text-base sm:text-xl font-bold text-gray-800">{displayClassName}</p>
                        {booking.status === 'WAITLISTED' && (
                            <p className="text-sm font-semibold text-amber-600 mt-1">Du är på kölistan.</p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-sm sm:text-base text-gray-600">
                            <strong className="font-semibold text-gray-700">Tid:</strong> Kl. {startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-sm sm:text-base text-gray-600">
                            <strong className="font-semibold text-gray-700">Datum:</strong> {startDateTime.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-lg border border-gray-200 flex items-center h-full">
             <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-flexibel/10 text-flexibel mr-3 sm:mr-4">
                    <CalendarIcon />
                </div>
                <div>
                    <p className="text-sm sm:text-base font-medium text-gray-500">Inget pass bokat</p>
                    <p className="text-base sm:text-xl font-bold text-gray-800">Dags att planera!</p>
                </div>
            </div>
        </div>
    );
};
