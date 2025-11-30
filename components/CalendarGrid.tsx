
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
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/staging
        {calendarDays.map((day) => {
          const { hasContent } = getDayProps(day);
          const holiday = getHolidayForDay ? getHolidayForDay(day) : null;
          const isToday = dateUtils.isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const dayOfWeek = day.getDay(); // Sunday=0, Saturday=6
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // --- Button Classes ---
          const buttonClasses = [
<<<<<<< HEAD
            'p-1 sm:p-1.5',
            'min-h-[5rem] sm:min-h-[6rem] lg:min-h-[7.5rem]', // Reduced height for more compact view
            'text-left align-top relative flex flex-col',
            'rounded-md',
            'transition-colors duration-150',
            'border border-slate-200/60',
=======
            'p-1',
            'min-h-[4.5rem] sm:min-h-[6rem]', 
            'text-left align-top relative flex flex-col',
            'rounded-xl',
            'transition-all duration-200',
            'border border-transparent', // Start transparent
>>>>>>> origin/staging
          ];

          if (hasContent) {
            buttonClasses.push(
              'cursor-pointer',
<<<<<<< HEAD
              'hover:bg-slate-100',
              'focus:outline-none focus:z-10 focus:ring-2 focus:ring-flexibel'
=======
              'hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-flexibel/50'
>>>>>>> origin/staging
            );
          } else {
            buttonClasses.push('cursor-default');
          }

<<<<<<< HEAD
          if (holiday) {
              if (holiday.type === 'holiday') {
                  buttonClasses.push('bg-red-50/50');
              } else if (holiday.type === 'special') {
                  buttonClasses.push('bg-yellow-50/50');
              }
          } else if (!isToday && (!isCurrentMonth || isWeekend)) {
              buttonClasses.push('bg-slate-50');
=======
          if (!isCurrentMonth) {
               buttonClasses.push('bg-gray-50/30 text-gray-300');
          } else if (holiday) {
              if (holiday.type === 'holiday') {
                  buttonClasses.push('bg-red-50/30');
              } else {
                  buttonClasses.push('bg-yellow-50/30');
              }
>>>>>>> origin/staging
          } else {
              buttonClasses.push('bg-white');
          }
          
          // --- Time Element Classes ---
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/staging
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
<<<<<<< HEAD
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
=======
              
              <div className="mt-0 flex-grow w-full flex flex-col gap-0.5">
                {holiday && (
                    <div className="flex justify-center mb-0.5">
                        <span title={holiday.name} className="text-xs" role="img" aria-label={holiday.name}>
                            {holiday.icon || '🔴'}
                        </span>
                    </div>
                )}
>>>>>>> origin/staging
                {renderDayContent(day)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

<<<<<<< HEAD
export const CalendarGrid = React.memo(CalendarGridFC);
=======
export const CalendarGrid = React.memo(CalendarGridFC);
>>>>>>> origin/staging
