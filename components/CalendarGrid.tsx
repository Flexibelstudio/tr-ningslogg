
import React, { useMemo, useCallback } from 'react';
import { Button } from './Button';
import * as dateUtils from '../utils/dateUtils';
import { Holiday } from '../utils/dateUtils';

interface CalendarGridProps {
  currentDate: Date;
  setCurrentDate: (date: Date | ((prevDate: Date) => Date)) => void;
  onDayClick: (date: Date) => void;
  renderDayContent: (day: Date) => React.ReactNode;
  getDayProps: (day: Date) => { hasContent: boolean };
  getHolidayForDay?: (date: Date) => Holiday | null;
  className?: string; // New prop
}

const CalendarGridFC: React.FC<CalendarGridProps> = ({
  currentDate,
  setCurrentDate,
  onDayClick,
  renderDayContent,
  getDayProps,
  getHolidayForDay,
  className,
}) => {
  const handleNavigate = useCallback((offset: number) => {
    setCurrentDate(date => dateUtils.addMonths(date, offset));
  }, [setCurrentDate]);
  
  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  const calendarDays = useMemo(() => {
    const monthStart = dateUtils.getStartOfMonth(currentDate);
    let currentDay = dateUtils.getStartOfWeek(monthStart); // Starts on a Monday
    const days = [];
    // Ensure 6 weeks are always rendered for a consistent grid height
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay = dateUtils.addDays(currentDay, 1);
    }
    return days;
  }, [currentDate]);
  
  const daysOfWeek = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
  const today = useMemo(() => new Date(), []);

  return (
    <div className={`bg-white p-2 sm:p-4 rounded-2xl shadow-lg ${className || ''}`}>
      <header className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 capitalize">
          {currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button onClick={() => handleNavigate(-1)} variant="outline" size="sm" aria-label="Föregående månad" className="!px-3">&lt;</Button>
          <Button onClick={goToToday} variant="primary" size="sm">Idag</Button>
          <Button onClick={() => handleNavigate(1)} variant="outline" size="sm" aria-label="Nästa månad" className="!px-3">&gt;</Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1">
        {daysOfWeek.map(day => <div key={day} className="py-2 text-center text-sm font-semibold text-gray-500 tracking-wider">{day}</div>)}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 gap-1 sm:gap-1.5 mt-1.5">
        {calendarDays.map((day) => {
          const { hasContent } = getDayProps(day);
          const holiday = getHolidayForDay ? getHolidayForDay(day) : null;
          const isToday = dateUtils.isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayOfWeek = day.getDay(); // Sunday=0, Saturday=6
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // --- Button Classes ---
          const buttonClasses = [
            'p-1 sm:p-1.5',
            'min-h-[5rem] sm:min-h-[6rem] lg:min-h-[7.5rem]', // Reduced height for more compact view
            'text-left align-top relative flex flex-col',
            'rounded-md',
            'transition-colors duration-150',
            'border border-slate-200/60',
          ];

          if (hasContent) {
            buttonClasses.push(
              'cursor-pointer',
              'hover:bg-slate-100',
              'focus:outline-none focus:z-10 focus:ring-2 focus:ring-flexibel'
            );
          } else {
            buttonClasses.push('cursor-default');
          }

          if (holiday) {
              if (holiday.type === 'holiday') {
                  buttonClasses.push('bg-red-50/50');
              } else if (holiday.type === 'special') {
                  buttonClasses.push('bg-yellow-50/50');
              }
          } else if (!isToday && (!isCurrentMonth || isWeekend)) {
              buttonClasses.push('bg-slate-50');
          } else {
              buttonClasses.push('bg-white');
          }
          
          // --- Time Element Classes ---
          // FIX: Changed timeClasses from a string to an array for correct conditional class application.
          const timeClasses: string[] = [
            'flex items-center justify-center',
            'h-6 w-6 sm:h-7 sm:w-7',
            'text-sm',
            'rounded-full',
          ];

          if (isToday) {
            timeClasses.push('bg-flexibel text-white font-semibold shadow-sm');
          } else {
            timeClasses.push('font-semibold');
            if (holiday) {
                if (holiday.type === 'holiday') {
                    timeClasses.push('text-red-700');
                } else if (holiday.type === 'special') {
                    timeClasses.push('text-yellow-800');
                }
            } else if (!isCurrentMonth) {
              timeClasses.push('text-slate-400');
            } else {
              timeClasses.push('text-gray-700');
            }
          }
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              disabled={!hasContent}
              className={buttonClasses.join(' ')}
            >
              <time
                dateTime={day.toISOString()}
                className={timeClasses.join(' ')}
              >
                {day.getDate()}
              </time>
              {holiday && (
                <div
                  title={holiday.name}
                  className={`text-[10px] text-center mt-0.5 rounded px-1 truncate block ${
                    holiday.type === 'holiday'
                      ? 'text-red-600 bg-red-50'
                      : 'text-yellow-700 bg-yellow-50'
                  }`}
                >
                  {holiday.icon && <span className="mr-0.5">{holiday.icon}</span>}
                  {holiday.name}
                </div>
              )}
              <div className="mt-0.5 space-y-0.5 overflow-hidden flex-grow w-full">
                {renderDayContent(day)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const CalendarGrid = React.memo(CalendarGridFC);
