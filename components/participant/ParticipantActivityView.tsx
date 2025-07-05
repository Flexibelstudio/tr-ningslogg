

import React, { useState, useMemo, useEffect } from 'react';
import { WorkoutLog, Workout, GeneralActivityLog, ActivityLog, GoalCompletionLog } from '../../types';
import { Button } from '../Button';
import * as dateUtils from '../../utils/dateUtils';
import { DayActivitiesModal } from './DayActivitiesModal'; 
import { MOOD_OPTIONS } from './MoodSelectorInput'; // Import MOOD_OPTIONS

interface ParticipantActivityViewProps {
  allActivityLogs: ActivityLog[]; 
  workouts: Workout[]; 
  onViewLogSummary: (log: ActivityLog) => void; 
  onDeleteActivity: (activityId: string, activityType: 'workout' | 'general' | 'goal_completion') => void;
}

type PeriodType = 'week' | 'month' | 'year';

const WORKOUT_ACTIVITY_COLOR = '#0aa5a1'; // Flexibel primary color
const GENERAL_ACTIVITY_COLOR = '#06b6d4'; // Cyan-500 for distinction

const MAX_CHART_BAR_AREA_HEIGHT_PX = 130; 
const MIN_BAR_HEIGHT_PX_ACTIVE = 15;    
const MIN_BAR_HEIGHT_PX_INACTIVE = 3;   

interface ChartDataItem {
  label: string; 
  totalValue: number; 
  activityCounts: { 
    workout: number;
    general: number;
  };
  barHeightPx: number; 
  date?: Date;         
  hasActivities?: boolean;
  hasPBs?: boolean; 
  hasGoalCompletions?: boolean; // New field
}

interface CalendarDayItem {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  activities: ActivityLog[];
  hasPBs?: boolean; 
  hasGoalCompletions?: boolean; // New field
}

const getMoodEmojiDisplay = (moodRating?: number): string => {
  if (moodRating === undefined || moodRating === null) return '';
  const mood = MOOD_OPTIONS.find(m => m.rating === moodRating);
  return mood ? mood.emoji : '';
};

// New Icons for Redesigned Stats
const TotalLoggedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-flexibel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const ActiveDaysIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-flexibel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const MostFrequentActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-flexibel" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.846 5.671a1 1 0 00.95.69h5.969c.969 0 1.371 1.24.588 1.81l-4.836 3.522a1 1 0 00-.364 1.118l1.846 5.671c.3.921-.755 1.688-1.54 1.118l-4.836-3.522a1 1 0 00-1.176 0l-4.836 3.522c-.784.57-1.838-.197-1.539-1.118l1.846-5.671a1 1 0 00-.364-1.118L2.98 11.11c-.783-.57-.38-1.81.588-1.81h5.969a1 1 0 00.95-.69L11.049 2.927z" />
  </svg>
);


export const ParticipantActivityView: React.FC<ParticipantActivityViewProps> = ({ allActivityLogs, workouts, onViewLogSummary, onDeleteActivity }) => {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const [isDayActivitiesModalOpen, setIsDayActivitiesModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<Date | null>(null);
  const [activitiesForSelectedDay, setActivitiesForSelectedDay] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (isDayActivitiesModalOpen && selectedDateForModal) {
      const updatedLogsForClickedDay = allActivityLogs.filter(log => 
        dateUtils.isSameDay(new Date(log.completedDate), selectedDateForModal)
      );
      setActivitiesForSelectedDay(updatedLogsForClickedDay);
    }
  }, [allActivityLogs, isDayActivitiesModalOpen, selectedDateForModal]);

  const currentPeriod = useMemo(() => {
    let start: Date, end: Date;
    switch (periodType) {
      case 'week':
        start = dateUtils.getStartOfWeek(referenceDate);
        end = dateUtils.getEndOfWeek(referenceDate);
        break;
      case 'month':
        start = dateUtils.getStartOfMonth(referenceDate);
        end = dateUtils.getEndOfMonth(referenceDate);
        break;
      case 'year':
        start = dateUtils.getStartOfYear(referenceDate);
        end = dateUtils.getEndOfYear(referenceDate);
        break;
    }
    return { start, end, label: dateUtils.formatPeriodLabel(start, end, periodType) };
  }, [periodType, referenceDate]);

  const filteredActivityLogsForPeriod = useMemo(() => { 
    return allActivityLogs
      .filter(log => {
        const completedDate = new Date(log.completedDate);
        return completedDate >= currentPeriod.start && completedDate <= currentPeriod.end;
      })
      .sort((a,b) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());
  }, [allActivityLogs, currentPeriod]);

  const activityStats = useMemo(() => {
    if (filteredActivityLogsForPeriod.length === 0) {
      return { totalLogs: 0, mostFrequentType: 'Ingen aktivitet', activeDays: 0 };
    }

    const activityNameFrequency: { [name: string]: number } = {};
    const activeDaySet = new Set<string>();

    filteredActivityLogsForPeriod.forEach(log => {
      let name = "Okänd Aktivitet";
      if (log.type === 'workout') {
        const workoutTemplate = workouts.find(w => w.id === log.workoutId);
        name = workoutTemplate?.title || "Okänt Gympass";
      } else if (log.type === 'general') {
        name = log.activityName;
      }
      activityNameFrequency[name] = (activityNameFrequency[name] || 0) + 1;
      activeDaySet.add(new Date(log.completedDate).toDateString());
    });

    const mostFrequentType = Object.keys(activityNameFrequency).length > 0
      ? Object.entries(activityNameFrequency).sort((a, b) => b[1] - a[1])[0][0]
      : 'Ingen specifik typ';

    return {
      totalLogs: filteredActivityLogsForPeriod.length,
      mostFrequentType,
      activeDays: activeDaySet.size,
    };
  }, [filteredActivityLogsForPeriod, workouts]);

  const calendarDays: CalendarDayItem[] = useMemo(() => {
    if (periodType !== 'month') return [];

    const days: CalendarDayItem[] = [];
    const monthStart = dateUtils.getStartOfMonth(referenceDate);
    
    let currentDay = dateUtils.getStartOfWeek(monthStart);
    const today = new Date();

    for (let i = 0; i < 42; i++) { 
      const dayLogs = allActivityLogs.filter(log => dateUtils.isSameDay(new Date(log.completedDate), currentDay));
      const hasPBs = dayLogs.some(log => 
        log.type === 'workout' && 
        (log as WorkoutLog).postWorkoutSummary && 
        (log as WorkoutLog).postWorkoutSummary!.newPBs.length > 0
      );
      const hasGoalCompletions = dayLogs.some(log => log.type === 'goal_completion');
      days.push({
        date: new Date(currentDay),
        dayOfMonth: currentDay.getDate(),
        isCurrentMonth: currentDay.getMonth() === referenceDate.getMonth(),
        isToday: dateUtils.isSameDay(currentDay, today),
        activities: dayLogs,
        hasPBs,
        hasGoalCompletions,
      });
      currentDay = dateUtils.addDays(currentDay, 1);
      if (i >= 34 && currentDay.getMonth() !== referenceDate.getMonth() && currentDay.getDay() === 1) break; 
    }
    return days;
  }, [periodType, referenceDate, allActivityLogs]);


  const chartDataForWeekAndYear = useMemo<ChartDataItem[]>(() => {
    const data: ChartDataItem[] = [];
    if (periodType === 'month') return [];
    
    let rawData: Omit<ChartDataItem, 'barHeightPx'>[] = [];

    switch (periodType) {
      case 'week':
        for (let i = 0; i < 7; i++) {
          const dayDate = dateUtils.addDays(currentPeriod.start, i);
          const logsOnDay = filteredActivityLogsForPeriod.filter(log => dateUtils.isSameDay(new Date(log.completedDate), dayDate));
          const workoutCount = logsOnDay.filter(l => l.type === 'workout').length;
          const generalCount = logsOnDay.filter(l => l.type === 'general').length;
          const totalValue = workoutCount + generalCount;
          const hasPBs = logsOnDay.some(log => 
            log.type === 'workout' && 
            (log as WorkoutLog).postWorkoutSummary && 
            (log as WorkoutLog).postWorkoutSummary!.newPBs.length > 0
          );
          const hasGoalCompletions = logsOnDay.some(log => log.type === 'goal_completion');
          rawData.push({ 
            label: dateUtils.getShortDayName(i), 
            activityCounts: { workout: workoutCount, general: generalCount },
            totalValue: totalValue,
            date: dayDate,
            hasActivities: totalValue > 0,
            hasPBs,
            hasGoalCompletions, 
          });
        }
        break;
      case 'year':
        for (let i = 0; i < 12; i++) {
          const monthStartDate = new Date(currentPeriod.start.getFullYear(), i, 1);
          const monthEndDate = dateUtils.getEndOfMonth(monthStartDate);
          const logsInMonth = filteredActivityLogsForPeriod.filter(log => {
            const completedDate = new Date(log.completedDate);
            return completedDate >= monthStartDate && completedDate <= monthEndDate;
          });
          const workoutCount = logsInMonth.filter(l => l.type === 'workout').length;
          const generalCount = logsInMonth.filter(l => l.type === 'general').length;
          const totalValue = workoutCount + generalCount;
          const hasPBs = logsInMonth.some(log => 
            log.type === 'workout' && 
            (log as WorkoutLog).postWorkoutSummary && 
            (log as WorkoutLog).postWorkoutSummary!.newPBs.length > 0
          );
          const hasGoalCompletions = logsInMonth.some(log => log.type === 'goal_completion');
          rawData.push({ 
            label: dateUtils.getMonthName(i), 
            activityCounts: { workout: workoutCount, general: generalCount },
            totalValue: totalValue,
            hasActivities: totalValue > 0,
            hasPBs,
            hasGoalCompletions,
          });
        }
        break;
    }

    if (rawData.length === 0) return [];

    const maxValue = Math.max(1, ...rawData.map(item => item.totalValue));
    
    return rawData.map(item => {
      const percentageOfMax = (item.totalValue / maxValue) * 100;
      let calculatedBarHeightPx;
      if (item.totalValue > 0) {
        calculatedBarHeightPx = Math.max(MIN_BAR_HEIGHT_PX_ACTIVE, (percentageOfMax / 100) * MAX_CHART_BAR_AREA_HEIGHT_PX);
      } else {
        calculatedBarHeightPx = MIN_BAR_HEIGHT_PX_INACTIVE;
      }
      return { 
        ...item, 
        barHeightPx: calculatedBarHeightPx,
      };
    });
  }, [filteredActivityLogsForPeriod, periodType, currentPeriod.start]);


  const handleNavigate = (direction: 'prev' | 'next') => {
    setReferenceDate(prevDate => {
      switch (periodType) {
        case 'week': return dateUtils.addDays(prevDate, direction === 'prev' ? -7 : 7);
        case 'month': return dateUtils.addMonths(prevDate, direction === 'prev' ? -1 : 1);
        case 'year': return dateUtils.addYears(prevDate, direction === 'prev' ? -1 : 1);
      }
    });
  };

  const handleDayBarClick = (dayChartItem: ChartDataItem) => {
    if (periodType === 'week' && dayChartItem.hasActivities && dayChartItem.date) {
      const logsForClickedDay = allActivityLogs.filter(log => 
        dateUtils.isSameDay(new Date(log.completedDate), dayChartItem.date!)
      );
      setActivitiesForSelectedDay(logsForClickedDay);
      setSelectedDateForModal(dayChartItem.date);
      setIsDayActivitiesModalOpen(true);
    }
  };

  const handleCalendarDayClick = (calendarDay: CalendarDayItem) => {
    if (calendarDay.activities.length > 0) {
        setActivitiesForSelectedDay(calendarDay.activities);
        setSelectedDateForModal(calendarDay.date);
        setIsDayActivitiesModalOpen(true);
    }
  };

  const isNextDisabled = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0); 
    let nextPeriodStart: Date;
     switch (periodType) {
        case 'week': 
            nextPeriodStart = dateUtils.getStartOfWeek(dateUtils.addDays(referenceDate, 7));
            break;
        case 'month': 
            nextPeriodStart = dateUtils.getStartOfMonth(dateUtils.addMonths(referenceDate, 1));
            break;
        case 'year': 
            nextPeriodStart = dateUtils.getStartOfYear(dateUtils.addYears(referenceDate, 1));
            break;
        default: return true;
    }
    return nextPeriodStart > today;
  }, [periodType, referenceDate]);


  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Min Loggbok</h2>
      
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        {(['week', 'month', 'year'] as PeriodType[]).map(p => (
          <Button
            key={p}
            onClick={() => { setPeriodType(p); setReferenceDate(new Date());}}
            variant={periodType === p ? 'primary' : 'ghost'}
            size="sm"
            aria-pressed={periodType === p}
          >
            {p === 'week' ? 'Vecka' : p === 'month' ? 'Månad' : 'År'}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button onClick={() => handleNavigate('prev')} size="sm" variant="outline" aria-label="Föregående period">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Föregående
        </Button>
        <p className="text-center font-semibold text-flexibel text-lg">{currentPeriod.label}</p>
        <Button onClick={() => handleNavigate('next')} size="sm" variant="outline" disabled={isNextDisabled} aria-label="Nästa period">
          Nästa
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
        </Button>
      </div>

      {filteredActivityLogsForPeriod.length === 0 && periodType !== 'month' && chartDataForWeekAndYear.every(item => item.totalValue === 0) ? (
        <p className="text-gray-500 text-center py-8 text-lg">Inga aktiviteter loggade för denna period.</p>
      ) : filteredActivityLogsForPeriod.length === 0 && periodType === 'month' ? (
        <p className="text-gray-500 text-center py-8 text-lg">Inga aktiviteter loggade för denna period.</p>
      ) : (
        <>
        {/* Redesigned Stats Section - Now always horizontal with wrapping */}
        <div className="mb-6 flex flex-row flex-wrap justify-around items-center bg-gray-50 p-3 rounded-lg shadow-sm gap-x-3 gap-y-3">
          <div className="flex items-center">
            <TotalLoggedIcon />
            <div className="ml-2">
              <p className="text-sm text-gray-500">Totalt Loggat</p>
              <p className="text-lg font-semibold text-flexibel">{activityStats.totalLogs} {activityStats.totalLogs === 1 ? 'akt.' : 'akt.'}</p>
            </div>
          </div>
          
          {periodType !== 'year' && (
            <div className="flex items-center">
              <ActiveDaysIcon />
              <div className="ml-2">
                <p className="text-sm text-gray-500">Aktiva Dagar</p>
                <p className="text-lg font-semibold text-flexibel">{activityStats.activeDays} {activityStats.activeDays === 1 ? 'dag' : 'dgr'}</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center">
            <MostFrequentActivityIcon />
            <div className="ml-2 overflow-hidden">
              <p className="text-sm text-gray-500">Vanligast</p>
              <p className="text-lg font-semibold text-flexibel truncate" title={activityStats.mostFrequentType}>{activityStats.mostFrequentType}</p>
            </div>
          </div>
        </div>
        
        {(periodType === 'week' || periodType === 'year') && chartDataForWeekAndYear.length > 0 && (
          <div className={`grid ${periodType === 'week' ? 'grid-cols-7' : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-12'} gap-x-1 sm:gap-x-2 items-end min-h-[150px]`}>
            {chartDataForWeekAndYear.map((item) => {
                const chartWrapperTitle = periodType === 'week' ?
                  `${item.label}: ${item.totalValue} ${item.totalValue === 1 ? 'aktivitet' : 'aktivitet/er'}${item.hasActivities ? '. Visa detaljer.' : ''}${item.hasGoalCompletions ? ' Mål uppnått!' : ''}${item.hasPBs ? ' Innehåller PB!' : ''}` :
                  `${item.label}: ${item.totalValue} ${item.totalValue === 1 ? 'aktivitet' : 'aktivitet/er'}${item.hasGoalCompletions ? ' Mål uppnått!' : ''}${item.hasPBs ? ' Innehåller PB!' : ''}`;
                
                const itemKey = periodType === 'week' && item.date ? item.date.toISOString() : item.label;

              return (
                <div key={itemKey} className="flex flex-col items-center">
                  {item.hasGoalCompletions && <span className="text-sm text-yellow-500 mb-0.5" role="img" aria-label="Mål uppnått">🏆</span>}
                  {item.hasPBs && !item.hasGoalCompletions && <span className="text-sm text-yellow-500 mb-0.5" role="img" aria-label="Personligt rekord uppnått">⭐</span>}
                  <div
                    className={`w-full flex flex-col-reverse ${periodType === 'week' && item.hasActivities ? 'cursor-pointer group' : 'group'}`}
                    style={{ height: `${item.barHeightPx}px` }}
                    onClick={periodType === 'week' && item.hasActivities ? () => handleDayBarClick(item) : undefined}
                    role={periodType === 'week' && item.hasActivities ? "button" : undefined}
                    tabIndex={periodType === 'week' && item.hasActivities ? 0 : undefined}
                    aria-label={chartWrapperTitle}
                    title={chartWrapperTitle}
                  >
                    {item.totalValue === 0 ? (
                      <div className="w-full h-full bg-gray-200 rounded-t-sm group-hover:opacity-80"></div>
                    ) : (
                      <>
                        {item.activityCounts.workout > 0 && (
                          <div
                            style={{ height: `${(item.activityCounts.workout / item.totalValue) * 100}%`, backgroundColor: WORKOUT_ACTIVITY_COLOR }}
                            className="w-full rounded-t-sm group-hover:opacity-80"
                            aria-label={`${item.activityCounts.workout} träningspass`}
                          />
                        )}
                        {item.activityCounts.general > 0 && (
                          <div
                            style={{ height: `${(item.activityCounts.general / item.totalValue) * 100}%`, backgroundColor: GENERAL_ACTIVITY_COLOR }}
                            className={`w-full ${item.activityCounts.workout === 0 ? 'rounded-t-sm' : ''} group-hover:opacity-80`}
                            aria-label={`${item.activityCounts.general} annan aktivitet`}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <span className="mt-1 text-sm text-center text-gray-600">{item.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {periodType === 'month' && calendarDays.length > 0 && (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold text-gray-500 border-b mb-1 pb-1">
              {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(dayName => <div key={dayName}>{dayName}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day, index) => {
                const hasActivities = day.activities.length > 0;
                let dayClasses = "p-1.5 sm:p-2.5 h-16 sm:h-20 flex flex-col items-center justify-center text-base border transition-colors duration-150 ease-in-out ";
                if (!day.isCurrentMonth) {
                  dayClasses += "text-gray-400 bg-gray-50";
                } else if (day.isToday) {
                  dayClasses += "font-bold bg-flexibel/10 border-flexibel text-flexibel";
                } else {
                  dayClasses += "text-gray-700 bg-white hover:bg-gray-100";
                }
                if (hasActivities && day.isCurrentMonth) {
                  dayClasses += " bg-teal-100 border-teal-300 cursor-pointer hover:bg-teal-200";
                } else if (hasActivities && !day.isCurrentMonth) {
                   dayClasses += " bg-gray-200 border-gray-300 cursor-pointer hover:bg-gray-300";
                }
                
                const dayLabel = `${day.dayOfMonth} ${dateUtils.getMonthName(day.date.getMonth())}${hasActivities ? `, ${day.activities.length} aktivitet/er` : ''}${day.hasGoalCompletions ? '. Mål uppnått!' : ''}${day.hasPBs ? ' Innehåller PB!' : ''}`;

                return (
                  <div
                    key={index}
                    className={dayClasses}
                    onClick={() => handleCalendarDayClick(day)}
                    role={hasActivities ? "button" : "gridcell"}
                    tabIndex={hasActivities ? 0 : -1}
                    aria-label={dayLabel}
                  >
                    <span className="flex items-center">
                      {day.dayOfMonth}
                      {day.hasGoalCompletions && <span className="text-yellow-500 ml-0.5 text-sm" role="img" aria-label="Mål uppnått denna dag">🏆</span>}
                      {day.hasPBs && !day.hasGoalCompletions && <span className="text-yellow-500 ml-0.5 text-sm" role="img" aria-label="Personligt rekord uppnått denna dag">⭐</span>}
                    </span>
                    {hasActivities && !day.hasPBs && !day.hasGoalCompletions && ( // Show dot only if no other icon
                      <span 
                        className={`mt-1 w-2 h-2 rounded-full ${day.isCurrentMonth ? 'bg-flexibel' : 'bg-gray-500'}`}
                        aria-hidden="true"
                        title={`${day.activities.length} aktivitet/er`}
                       ></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {(periodType === 'month' || periodType === 'year') && filteredActivityLogsForPeriod.length > 0 && chartDataForWeekAndYear.length === 0 && calendarDays.length === 0 && (
           <div className="mt-4 border-t pt-4">
            <h4 className="text-lg font-semibold text-gray-700 mb-2">Aktiviteter denna period:</h4>
             <ul className="space-y-2 max-h-60 overflow-y-auto">
              {filteredActivityLogsForPeriod.map(log => {
                let logTitle = "Okänd aktivitet";
                const moodEmoji = getMoodEmojiDisplay(log.moodRating);
                const hasPBs = log.type === 'workout' && (log as WorkoutLog).postWorkoutSummary?.newPBs && (log as WorkoutLog).postWorkoutSummary!.newPBs.length > 0;

                if (log.type === 'goal_completion') {
                    const goalLog = log as GoalCompletionLog;
                    logTitle = `🏆 Mål Uppnått!`;
                     return (
                      <li key={log.id} className="text-base p-2 bg-yellow-100 border border-yellow-300 rounded flex justify-between items-center">
                          <div>
                              <p className="font-semibold">{logTitle} - {new Date(log.completedDate).toLocaleDateString('sv-SE', {day:'numeric', month:'short'})}</p>
                              <p className="text-sm text-gray-600 italic">"{goalLog.goalDescription}"</p>
                          </div>
                      </li>
                    );
                } else if (log.type === 'workout') {
                    const workoutTemplate = workouts.find(w => w.id === log.workoutId);
                    logTitle = `🏋️ ${workoutTemplate?.title || 'Okänt Gympass'}`;
                } else if (log.type === 'general') {
                    logTitle = `🤸 ${log.activityName}`;
                }
                return (
                  <li key={log.id} className="text-base p-2 bg-gray-50 rounded flex justify-between items-center">
                    <span>
                        {logTitle} {moodEmoji && <span className="ml-1 text-xl">{moodEmoji}</span>}
                        {hasPBs && <span className="ml-1 text-yellow-500" role="img" aria-label="Personligt rekord">⭐</span>}
                        {' '}- {new Date(log.completedDate).toLocaleDateString('sv-SE', {day:'numeric', month:'short'})}
                    </span>
                    {log.type === 'workout' && (
                        <Button onClick={() => onViewLogSummary(log)} variant="outline" size="sm">Visa</Button>
                    )}
                  </li>
                );
              })}
            </ul>
           </div>
        )}
        </>
      )}
       <DayActivitiesModal
        isOpen={isDayActivitiesModalOpen}
        onClose={() => setIsDayActivitiesModalOpen(false)}
        selectedDate={selectedDateForModal}
        activitiesForDay={activitiesForSelectedDay}
        workouts={workouts}
        onViewLogSummary={onViewLogSummary as (log: WorkoutLog) => void} 
        onDeleteActivity={onDeleteActivity}
      />
    </div>
  );
};