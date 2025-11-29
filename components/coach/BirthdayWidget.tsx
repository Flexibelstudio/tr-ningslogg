
import React, { useMemo } from 'react';
import { ParticipantProfile } from '../../types';
import { calculateAge } from '../../utils/dateUtils';

interface BirthdayWidgetProps {
  participants: ParticipantProfile[];
}

interface BirthdayInfo {
  participant: ParticipantProfile;
  isToday: boolean;
  turningAge: number;
  dateString: string; // "25 dec"
  daysUntil: number;
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
      const [y, m, d] = p.birthDate.split('-').map(Number);
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
    <details className="p-4 sm:p-6 bg-white rounded-lg shadow-xl border h-full" open>
      <summary className="text-xl font-bold tracking-tight text-gray-800 cursor-pointer select-none flex items-center gap-2">
        <span>🎂 Födelsedagar</span>
      </summary>
      
      <div className="mt-4 pt-4 border-t space-y-4">
        {birthdayData.length === 0 && (
          <p className="text-gray-500 italic text-sm">Inga födelsedagar de kommande 7 dagarna.</p>
        )}

        {/* TODAYS BIRTHDAYS */}
        {todaysBirthdays.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-flexibel tracking-wider">Idag! 🎉</h4>
            <ul className="space-y-2">
              {todaysBirthdays.map((b) => (
                <li key={b.participant.id} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md flex justify-between items-center animate-pulse-cta">
                  <div>
                    <span className="font-bold text-gray-900 text-lg">{b.participant.name}</span>
                    <span className="text-sm text-gray-600 ml-2">fyller {b.turningAge} år</span>
                  </div>
                  <span className="text-2xl">🎂</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* UPCOMING BIRTHDAYS */}
        {upcomingBirthdays.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Kommande veckan</h4>
            <ul className="space-y-2">
              {upcomingBirthdays.map((b) => (
                <li key={b.participant.id} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{b.participant.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {b.turningAge} år
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <span>{b.dateString}</span>
                    {b.daysUntil === 1 && <span className="text-xs text-flexibel font-semibold">(Imorgon)</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
};
