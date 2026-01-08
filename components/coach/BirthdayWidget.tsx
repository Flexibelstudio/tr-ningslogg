import React, { useMemo } from 'react';
import { ParticipantProfile } from '../../types';

interface BirthdayInfo {
  participant: ParticipantProfile;
  isToday: boolean;
  turningAge: number;
  dateString: string; // "25 dec"
  daysUntil: number;
}

interface BirthdayWidgetProps {
  participants: ParticipantProfile[];
}

export const BirthdayWidget: React.FC<BirthdayWidgetProps> = ({ participants }) => {
  const birthdayData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const results: BirthdayInfo[] = [];

    participants.forEach((p) => {
      if (!p.birthDate || !p.isActive) return;

      // Parse YYYY-MM-DD
      const parts = p.birthDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      
      if (!y || !m || !d) return;

      // Create date for this year's birthday
      const birthdayThisYear = new Date(currentYear, m - 1, d);
      birthdayThisYear.setHours(0, 0, 0, 0);

      let targetBirthday = birthdayThisYear;
      let turningAge = currentYear - y;

      // If birthday passed this year, check next year
      if (birthdayThisYear < today) {
        targetBirthday = new Date(currentYear + 1, m - 1, d);
        turningAge++;
      }

      // Check if within range (Today <= Birthday <= Today + 7 days)
      if (targetBirthday >= today && targetBirthday <= nextWeek) {
        const diffTime = targetBirthday.getTime() - today.getTime();
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        results.push({
          participant: p,
          isToday: daysUntil === 0,
          daysUntil,
          turningAge,
          dateString: targetBirthday.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
        });
      }
    });

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [participants]);

  const todaysBirthdays = birthdayData.filter((b) => b.isToday);
  const upcomingBirthdays = birthdayData.filter((b) => !b.isToday);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
        Födelsedagar 🎂
      </h3>
      
      <div className="flex-grow space-y-4">
        {birthdayData.length === 0 && (
          <p className="text-sm text-gray-400 italic">Inga födelsedagar den närmsta veckan.</p>
        )}

        {/* TODAYS BIRTHDAYS */}
        {todaysBirthdays.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase text-pink-600 tracking-wider">IDAG! 🥳</h4>
            <ul className="space-y-2">
              {todaysBirthdays.map((b) => (
                <li key={b.participant.id} className="p-3 bg-pink-50 border border-pink-100 rounded-xl flex justify-between items-center animate-pulse-cta">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{b.participant.name}</span>
                    <span className="text-xs text-pink-700 ml-2">fyller {b.turningAge} år</span>
                  </div>
                  <span className="text-xl">🎈</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* UPCOMING BIRTHDAYS */}
        {upcomingBirthdays.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Kommande veckan</h4>
            <ul className="space-y-1.5">
              {upcomingBirthdays.map((b) => (
                <li key={b.participant.id} className="flex justify-between items-center p-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-800 text-sm truncate">{b.participant.name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      {b.turningAge} år
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                    <span>{b.dateString}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};