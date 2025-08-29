import React, { useMemo } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, UserStrengthStat, ParticipantClubMembership } from '../../types';
import * as dateUtils from '../../utils/dateUtils';

// --- ICONS (Copied from ParticipantArea for encapsulation) ---
const TotalPassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h12M4 17h8" />
    </svg>
);
const StreakIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
);
const StrengthIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);
const ConditioningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);
const BodyIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
// --- END ICONS ---

// --- CARD COMPONENTS (Copied from ParticipantArea for encapsulation) ---
const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, description, icon, onClick }) => (
    <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 text-left w-full hover:shadow-xl hover:border-flexibel transition-all duration-200 group">
        <div className="flex items-center justify-between">
            <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-gray-100 text-flexibel mr-4 group-hover:bg-flexibel/10 transition-colors">
                    {icon}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                    <p className="text-base text-gray-500">{description}</p>
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-flexibel transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
    </button>
);

const ProgressCircle: React.FC<{
  label: string;
  displayText: string;
  displayUnit: string;
  percentage: number;
  colorClass: string;
}> = ({ label, displayText, displayUnit, percentage, colorClass }) => {
  const radius = 52; 
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center p-2 flex-1">
      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle className="text-gray-200" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
          <circle
            className={colorClass}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-bold text-gray-800">{displayText}</span>
          <span className="text-base font-medium text-gray-500">{displayUnit}</span>
        </div>
      </div>
      <p className="mt-3 text-base sm:text-lg font-semibold text-gray-600">{label}</p>
    </div>
  );
};

const GoalProgressCard: React.FC<{ goal: ParticipantGoalData | null, logs: ActivityLog[] }> = ({ goal, logs }) => {
    if (goal && goal.targetDate) {
        const startDate = new Date(goal.setDate);
        const targetDate = new Date(goal.targetDate);
        const today = new Date();

        const totalDays = Math.max(1, (targetDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        const daysPassed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        const daysRemaining = Math.max(0, totalDays - daysPassed);
        const timePercentage = Math.min(100, (daysPassed / totalDays) * 100);
        
        const weeklyTarget = goal.workoutsPerWeekTarget > 0 ? goal.workoutsPerWeekTarget : 0;
        
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
        const weeklyPercentage = weeklyTarget > 0 ? Math.min(100, (logsThisWeek / weeklyTarget) * 100) : 0;

        const totalWeeks = Math.max(1, totalDays / 7);
        const targetWorkouts = weeklyTarget > 0 ? Math.round(totalWeeks * weeklyTarget) : 0;
        const completedWorkouts = logs.filter(log => new Date(log.completedDate) >= startDate && new Date(log.completedDate) <= targetDate).length;
        const workoutPercentage = targetWorkouts > 0 ? Math.min(100, (completedWorkouts / targetWorkouts) * 100) : 0;

        return (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="flex justify-center sm:justify-around items-start gap-4">
                    {weeklyTarget > 0 && (
                        <ProgressCircle label="Veckans Pass" displayText={`${logsThisWeek} / ${weeklyTarget}`} displayUnit="pass" percentage={weeklyPercentage} colorClass="text-flexibel-orange" />
                    )}
                    {targetWorkouts > 0 && (
                        <ProgressCircle label="Totalt för Målperioden" displayText={`${completedWorkouts} / ${targetWorkouts}`} displayUnit="pass" percentage={workoutPercentage} colorClass="text-flexibel" />
                    )}
                </div>
                
                <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-2 text-base">
                        <span className="font-semibold text-gray-700">Tidslinje</span>
                        <span className="font-bold text-gray-800">{Math.round(daysRemaining)} dagar kvar</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${timePercentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>Start: {startDate.toLocaleDateString('sv-SE')}</span>
                        <span>Mål: {targetDate.toLocaleDateString('sv-SE')}</span>
                    </div>
                </div>
            </div>
        );
    }
    
    const progress = useMemo(() => {
        if (!goal || !goal.workoutsPerWeekTarget || goal.workoutsPerWeekTarget <= 0) return null;
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
        return { completed: logsThisWeek, target: goal.workoutsPerWeekTarget };
    }, [goal, logs]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
             <div className="flex justify-center sm:justify-around items-start mt-4 gap-4">
                {progress && (
                    <ProgressCircle label="Veckans Pass" displayText={`${progress.completed} / ${progress.target}`} displayUnit="pass" percentage={Math.min(100, (progress.completed / progress.target) * 100)} colorClass="text-flexibel-orange" />
                )}
                {!progress && <p className="text-gray-500 p-8">Sätt ett veckomål för att se din progress här!</p>}
            </div>
        </div>
    );
};
// --- END CARD COMPONENTS ---

interface ParticipantDashboardViewProps {
    participant: ParticipantProfile;
    latestGoal: ParticipantGoalData | null;
    allActivityLogs: ActivityLog[];
    onToolCardClick: (tool: 'strength' | 'conditioning' | 'physique') => void;
}

export const ParticipantDashboardView: React.FC<ParticipantDashboardViewProps> = ({
    participant,
    latestGoal,
    allActivityLogs,
    onToolCardClick,
}) => {
    return (
        <div className="space-y-6">
            <GoalProgressCard goal={latestGoal} logs={allActivityLogs} />

            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="flex items-center justify-center sm:justify-start px-2 sm:px-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-green-100 text-green-700 mr-3 sm:mr-4">
                            <TotalPassIcon />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Totalt Antal Pass</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{allActivityLogs.length}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start px-2 sm:px-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-green-100 text-green-700 mr-3 sm:mr-4">
                            <StreakIcon />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Nuvarande Streak</p>
                            <div className="flex items-baseline gap-x-1 sm:gap-x-2 flex-wrap">
                                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{latestGoal?.currentWeeklyStreak || 0}</p>
                                <p className="text-sm sm:text-lg font-bold text-gray-500">veckor</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <ToolCard 
                    title="Min Styrka"
                    description="Se dina 1RM, styrkenivåer och historik."
                    icon={<StrengthIcon />}
                    onClick={() => onToolCardClick('strength')}
                />
                <ToolCard 
                    title="Min Kondition"
                    description="Se och uppdatera dina konditionstester."
                    icon={<ConditioningIcon />}
                    onClick={() => onToolCardClick('conditioning')}
                />
                <ToolCard 
                    title="Min Kropp"
                    description="Se och uppdatera dina InBody-resultat."
                    icon={<BodyIcon />}
                    onClick={() => onToolCardClick('physique')}
                />
            </div>
        </div>
    );
};
