import React from 'react';
import { OneOnOneSession, StaffMember } from '../../types';

interface UpcomingMeetingCardProps {
  session: OneOnOneSession;
  staffMember: StaffMember | undefined;
  onOpenModal: (session: OneOnOneSession) => void;
}

const formatMeetingDateTime = (startTime: string): { text: string, isSoon: boolean } => {
    const now = new Date();
    const meetingDate = new Date(startTime);
    const diffHours = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isSoon = diffHours <= 24;

    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    const timeString = meetingDate.toLocaleTimeString('sv-SE', timeOptions);

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    let dateString = meetingDate.toLocaleDateString('sv-SE', dateOptions);
    
    // Capitalize first letter of the weekday
    dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);

    return {
        text: `På ${dateString} kl ${timeString}`,
        isSoon
    };
};

export const UpcomingMeetingCard: React.FC<UpcomingMeetingCardProps> = ({ session, staffMember, onOpenModal }) => {
    const { text: dateTimeText, isSoon } = formatMeetingDateTime(session.startTime);

    return (
        <button 
            onClick={() => onOpenModal(session)}
            className={`w-full text-left p-3 rounded-xl shadow-lg border animate-fade-in-down transition-all duration-200 active:shadow-xl active:border-flexibel ${isSoon ? 'bg-amber-50 border-amber-400' : 'bg-white border-gray-200'}`}
            aria-label={`Visa detaljer för mötet: ${session.title} med ${staffMember?.name || 'Coach'}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex-grow">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Ditt nästa möte</h3>
                    <p className="text-lg font-bold text-gray-800 mt-0.5">{session.title} med {staffMember?.name || 'Coach'}</p>
                    <p className={`text-base font-semibold ${isSoon ? 'text-flexibel-orange' : 'text-flexibel'}`}>{dateTimeText}</p>
                </div>
                <div className="flex-shrink-0">
                    <span className="text-4xl" role="img" aria-label="Kalender">🗓️</span>
                </div>
            </div>
        </button>
    );
};