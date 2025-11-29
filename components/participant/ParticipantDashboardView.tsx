
import React, { useMemo } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog } from '../../types';
import * as dateUtils from '../../utils/dateUtils';

// --- ICONS ---
const TotalPassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);
const StreakIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7.014A8.003 8.003 0 0122 12c0 3.771-2.5 7-6.5 7a8.003 8.003 0 01-2.843-.543z" />
    </svg>
);
const StrengthIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
);
const ConditioningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);
const BodyIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
// --- END ICONS ---

// --- REUSABLE CARD COMPONENTS ---
const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; colorClass: string; className?: string }> = ({ title, description, icon, onClick, colorClass, className }) => (
    <button onClick={onClick} className={`bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-gray-100 text-left w-full hover:shadow-md hover:scale-[1.02] transition-all duration-200 group flex flex-col h-full relative overflow-hidden ${className || ''}`}>
        <div className={`absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 rounded-full opacity-5 -mr-8 -mt-8 sm:-mr-10 sm:-mt-10 ${colorClass}`}></div>
        <div className={`w-12 h-12 flex items-center justify-center rounded-xl mb-2 sm:mb-3 ${colorClass} bg-opacity-10 text-gray-700 group-hover:bg-opacity-20 transition-colors`}>
            <div className="text-current scale-100">
                {icon}
            </div>
        </div>
        <div>
            <h3 className="text-sm sm:text-lg font-bold text-gray-800 mb-0.5 sm:mb-1 truncate">{title}</h3>
            <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-2 leading-tight">{description}</p>
        </div>
    </button>
);

const ProgressCircle: React.FC<{
  label: string;
  displayText: string;
  displayUnit: string;
  percentage: number;
  colorClass: string;
  bgColorClass: string;
}> = ({ label, displayText, displayUnit, percentage, colorClass, bgColorClass }) => {
  const radius = 45; 
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center p-2 flex-1">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle className="text-gray-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
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
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">{displayText}</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{displayUnit}</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-600">{label}</p>
    </div>
  );
};

const GoalProgressCard: React.FC<{ goal: ParticipantGoalData | null, logs: ActivityLog[] }> = ({ goal, logs }) => {
    const progress = useMemo(() => {
        if (!goal || !goal.workoutsPerWeekTarget || goal.workoutsPerWeekTarget <= 0) return null;
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
        return { completed: logsThisWeek, target: goal.workoutsPerWeekTarget };
    }, [goal, logs]);

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
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <span className="w-2 h-6 bg-flexibel rounded-full mr-2"></span>
                        Aktuell Plan
                    </h2>
                    <div className="flex justify-center sm:justify-around items-start gap-6">
                        {weeklyTarget > 0 && (
                            <ProgressCircle
                                label="Veckans Mål"
                                displayText={`${logsThisWeek}/${weeklyTarget}`}
                                displayUnit="pass"
                                percentage={weeklyPercentage}
                                colorClass="text-flexibel-orange"
                                bgColorClass="bg-orange-50"
                            />
                        )}
                        {targetWorkouts > 0 && (
                            <ProgressCircle
                                label="Periodens Mål"
                                displayText={`${completedWorkouts}/${targetWorkouts}`}
                                displayUnit="totalt"
                                percentage={workoutPercentage}
                                colorClass="text-flexibel"
                                bgColorClass="bg-green-50"
                            />
                        )}
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="font-semibold text-gray-600">Tidslinje</span>
                        <span className="font-bold text-gray-800">{Math.round(daysRemaining)} dagar kvar</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="bg-blue-500 h-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${timePercentage}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                        <span>{startDate.toLocaleDateString('sv-SE', {month:'short', day:'numeric'})}</span>
                        <span>{targetDate.toLocaleDateString('sv-SE', {month:'short', day:'numeric'})}</span>
                    </div>
                </div>
            </div>
        );
    }
    
    // Fallback if no target date is set
    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="w-2 h-6 bg-gray-300 rounded-full mr-2"></span>
                Aktuell Status
            </h2>
             <div className="flex justify-center sm:justify-around items-start mt-4 gap-4">
                {progress ? (
                    <ProgressCircle
                        label="Veckans Pass"
                        displayText={`${progress.completed}/${progress.target}`}
                        displayUnit="pass"
                        percentage={Math.min(100, (progress.completed / progress.target) * 100)}
                        colorClass="text-flexibel-orange"
                        bgColorClass="bg-orange-50"
                    />
                ) : (
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-2">Inget veckomål satt.</p>
                        <p className="text-sm text-gray-400">Gå till din profil för att sätta ett mål!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string | number; subLabel?: string; icon: React.ReactNode; color: string }> = ({ label, value, subLabel, icon, color }) => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden group">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <div className="flex items-baseline gap-1">
                <p className="text-2xl font-extrabold text-gray-800">{value}</p>
                {subLabel && <p className="text-sm font-medium text-gray-500">{subLabel}</p>}
            </div>
        </div>
    </div>
);

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
        <div className="space-y-3">
            {/* Main Progress Section */}
            <GoalProgressCard goal={latestGoal} logs={allActivityLogs} />

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 gap-3">
                 <StatCard 
                    label="Totalt" 
                    value={allActivityLogs.length} 
                    subLabel="pass"
                    icon={<TotalPassIcon />} 
                    color="bg-gradient-to-br from-flexibel to-green-600"
                />
                 <StatCard 
                    label="Streak" 
                    value={latestGoal?.currentWeeklyStreak || 0} 
                    subLabel="veckor"
                    icon={<StreakIcon />} 
                    color="bg-gradient-to-br from-orange-400 to-orange-600"
                />
            </div>

            {/* Tools Grid - Bento style: 3 columns on desktop, 2 columns on mobile with spanning last item */}
            <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <ToolCard 
                        title="Styrka"
                        description="1RM & nivåer"
                        icon={<StrengthIcon />}
                        onClick={() => onToolCardClick('strength')}
                        colorClass="bg-blue-500 text-blue-600"
                    />
                    <ToolCard 
                        title="Kondition"
                        description="Tester & tider"
                        icon={<ConditioningIcon />}
                        onClick={() => onToolCardClick('conditioning')}
                        colorClass="bg-teal-500 text-teal-600"
                    />
                    <ToolCard 
                        title="Min Kropp"
                        description="InBody-resultat"
                        icon={<BodyIcon />}
                        onClick={() => onToolCardClick('physique')}
                        colorClass="bg-purple-500 text-purple-600"
                        className="col-span-2 md:col-span-1"
                    />
                </div>
            </div>
        </div>
    );
};
