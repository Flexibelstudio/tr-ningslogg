import React, { useMemo } from 'react';
import { OneOnOneSession, StaffMember } from '../../types';
import { Button } from '../Button';

interface UpcomingMeetingCardProps {
  sessions: OneOnOneSession[];
  staff: StaffMember[];
  onOpenModal: (session: OneOnOneSession) => void;
}

const formatMeetingTime = (startTime: string): { relative: string, isSoon: boolean } => {
    const now = new Date();
    const meetingDate = new Date(startTime);
    const diffHours = (meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isSoon = diffHours <= 24;

    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    const timeString = meetingDate.toLocaleTimeString('sv-SE', timeOptions);

    if (diffHours < 24 && meetingDate.getDate() === now.getDate()) {
        return { relative: `Idag kl ${timeString}`, isSoon: true };
    }
    if (diffHours < 48 && meetingDate.getDate() === now.getDate() + 1) {
        return { relative: `Imorgon kl ${timeString}`, isSoon: true };
    }
    
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = meetingDate.toLocaleDateString('sv-SE', dateOptions);
    return { relative: `På ${dateString} kl ${timeString}`, isSoon: false };
};


export const UpcomingMeetingCard: React.FC<UpcomingMeetingCardProps> = ({ sessions, staff, onOpenModal }) => {
    const nextMeeting = useMemo(() => {
        const upcoming = sessions
            .filter(s => s.status === 'scheduled' && new Date(s.startTime) > new Date())
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        return upcoming[0] || null;
    }, [sessions]);

    if (!nextMeeting) {
        return null;
    }

    const coach = staff.find(s => s.id === nextMeeting.coachId);
    const { relative, isSoon } = formatMeetingTime(nextMeeting.startTime);

    return (
        <div className={`p-4 rounded-xl shadow-xl border-2 animate-fade-in-down mb-6 ${isSoon ? 'bg-amber-50 border-flexibel-orange' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-base font-semibold uppercase tracking-wider text-gray-500">Ditt nästa möte</h3>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{nextMeeting.title} med {coach?.name || 'Coach'}</p>
                    <p className={`text-xl font-semibold ${isSoon ? 'text-flexibel-orange' : 'text-flexibel'}`}>{relative}</p>
                </div>
                <span className="text-5xl" role="img" aria-label="Meeting icon">🗓️</span>
            </div>
            <div className="mt-4 pt-3 border-t flex justify-end">
                <Button onClick={() => onOpenModal(nextMeeting)} variant="outline" size="sm">
                    Visa detaljer & Kommentera
                </Button>
            </div>
        </div>
    );
};