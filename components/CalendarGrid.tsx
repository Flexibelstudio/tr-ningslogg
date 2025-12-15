
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
    <div className={`bg-white p-3 sm:p-5 rounded-3xl shadow-sm border border-gray-100 ${className || ''}`}>
      <header className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-xl font-bold text-gray-800 capitalize">
          {currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
          <button onClick={() => handleNavigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm transition-all text-gray-600" aria-label="Föregående månad">&lt;</button>
          <button onClick={goToToday} className="px-3 h-8 text-sm font-medium rounded-full hover:bg-white hover:shadow-sm transition-all text-gray-700">Idag</button>
          <button onClick={() => handleNavigate(1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm transition-all text-gray-600" aria-label="Nästa månad">&gt;</button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map(day => <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{day}</div>)}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 gap-1 sm:gap-2">
        {calendarDays.map((day) => {
          const { hasContent } = getDayProps(day);
          const holiday = getHolidayForDay ? getHolidayForDay(day) : null;
          const isToday = dateUtils.isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayOfWeek = day.getDay(); // Sunday=0, Saturday=6
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // --- Button Classes ---
          const buttonClasses = [
            'p-1',
            'min-h-[4.5rem] sm:min-h-[6rem]', 
            'text-left align-top relative flex flex-col',
            'rounded-xl',
            'transition-all duration-200',
            'border border-transparent', // Start transparent
          ];

          if (hasContent) {
            buttonClasses.push(
              'cursor-pointer',
              'hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-flexibel/50'
            );
          } else {
            buttonClasses.push('cursor-default');
          }

          if (!isCurrentMonth) {
               buttonClasses.push('bg-gray-50/30 text-gray-300');
          } else if (holiday) {
              if (holiday.type === 'holiday') {
                  buttonClasses.push('bg-red-50/30');
              } else {
                  buttonClasses.push('bg-yellow-50/30');
              }
          } else {
              buttonClasses.push('bg-white');
          }
          
          // --- Time Element Classes ---
          const timeClasses: string[] = [
            'flex items-center justify-center',
            'h-7 w-7',
            'text-sm',
            'rounded-full',
            'mb-1'
          ];

          if (isToday) {
            timeClasses.push('bg-flexibel text-white font-bold shadow-md shadow-flexibel/30');
          } else {
            timeClasses.push('font-medium');
            if (holiday?.type === 'holiday') {
                 timeClasses.push('text-red-500');
            } else if (!isCurrentMonth) {
                 timeClasses.push('text-gray-300');
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
              
              <div className="mt-0 flex-grow w-full flex flex-col gap-0.5">
                {holiday && (
                    <div className="flex justify-center mb-0.5">
                        <span title={holiday.name} className="text-xs" role="img" aria-label={holiday.name}>
                            {holiday.icon || '🔴'}
                        </span>
                    </div>
                )}
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