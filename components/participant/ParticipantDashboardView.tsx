<<<<<<< HEAD
=======

>>>>>>> origin/staging
import React, { useMemo } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog } from '../../types';
import * as dateUtils from '../../utils/dateUtils';

<<<<<<< HEAD
// --- ICONS (Modernized SVG versions) ---
const TotalPassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
);
const StreakIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
=======
// --- ICONS ---
const TotalPassIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);
const StreakIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
>>>>>>> origin/staging
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7.014A8.003 8.003 0 0122 12c0 3.771-2.5 7-6.5 7a8.003 8.003 0 01-2.843-.543z" />
    </svg>
);
const StrengthIcon = () => (
<<<<<<< HEAD
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);
const ConditioningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
=======
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
);
const ConditioningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
>>>>>>> origin/staging
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
    </svg>
);
const BodyIcon = () => (
<<<<<<< HEAD
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
=======
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
>>>>>>> origin/staging
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);
// --- END ICONS ---

// --- REUSABLE CARD COMPONENTS ---
<<<<<<< HEAD
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
=======
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
>>>>>>> origin/staging
        </div>
    </button>
);

const ProgressCircle: React.FC<{
  label: string;
  displayText: string;
  displayUnit: string;
  percentage: number;
  colorClass: string;
<<<<<<< HEAD
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
=======
  bgColorClass: string;
  size?: 'normal' | 'large';
}> = ({ label, displayText, displayUnit, percentage, colorClass, bgColorClass, size = 'normal' }) => {
  const radius = 45; 
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const sizeClasses = size === 'large' ? 'w-56 h-56' : 'w-40 h-40';
  const textClasses = size === 'large' ? 'text-5xl' : 'text-3xl';
  const labelClasses = size === 'large' ? 'text-lg mt-4' : 'text-base mt-3';

  return (
    <div className="flex flex-col items-center text-center p-2 flex-1">
      <div className={`relative ${sizeClasses}`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle className="text-gray-100" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx="60" cy="60" />
>>>>>>> origin/staging
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
<<<<<<< HEAD
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
=======
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${textClasses} font-bold text-gray-800`}>{displayText}</span>
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">{displayUnit}</span>
        </div>
      </div>
      <p className={`${labelClasses} font-semibold text-gray-600`}>{label}</p>
>>>>>>> origin/staging
    </div>
  );
};

const GoalProgressCard: React.FC<{ goal: ParticipantGoalData | null, logs: ActivityLog[] }> = ({ goal, logs }) => {
<<<<<<< HEAD
    // FIX: Moved useMemo to the top level of the component to fix conditional hook call (React error #310).
=======
>>>>>>> origin/staging
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
<<<<<<< HEAD
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="flex justify-center sm:justify-around items-start gap-4">
                    {weeklyTarget > 0 && (
                        <ProgressCircle
                            label="Veckans Pass"
                            displayText={`${logsThisWeek} / ${weeklyTarget}`}
                            displayUnit="pass"
                            percentage={weeklyPercentage}
                            colorClass="text-flexibel-orange"
                        />
                    )}
                    {targetWorkouts > 0 && (
                        <ProgressCircle
                            label="Totalt för Målperioden"
                            displayText={`${completedWorkouts} / ${targetWorkouts}`}
                            displayUnit="pass"
                            percentage={workoutPercentage}
                            colorClass="text-flexibel"
                        />
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
=======
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
                <div className="p-6 pb-0">
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
                
                <div className="p-6 pt-4">
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
>>>>>>> origin/staging
                    </div>
                </div>
            </div>
        );
    }
    
    // Fallback if no target date is set
    return (
<<<<<<< HEAD
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
             <div className="flex justify-center sm:justify-around items-start mt-4 gap-4">
                {progress && (
                    <ProgressCircle
                        label="Veckans Pass"
                        displayText={`${progress.completed} / ${progress.target}`}
                        displayUnit="pass"
                        percentage={Math.min(100, (progress.completed / progress.target) * 100)}
                        colorClass="text-flexibel-orange"
                    />
                )}
                {!progress && <p className="text-gray-500 p-8">Sätt ett veckomål för att se din progress här!</p>}
=======
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <div className="flex justify-center sm:justify-around items-start mt-2 gap-4">
                {progress ? (
                    <ProgressCircle
                        label="Veckans Pass"
                        displayText={`${progress.completed}/${progress.target}`}
                        displayUnit="pass"
                        percentage={Math.min(100, (progress.completed / progress.target) * 100)}
                        colorClass="text-flexibel-orange"
                        bgColorClass="bg-orange-50"
                        size="large"
                    />
                ) : (
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-2">Inget veckomål satt.</p>
                        <p className="text-sm text-gray-400">Gå till din profil för att sätta ett mål!</p>
                    </div>
                )}
>>>>>>> origin/staging
            </div>
        </div>
    );
};
<<<<<<< HEAD
// --- END CARD COMPONENTS ---
=======

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
>>>>>>> origin/staging

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
<<<<<<< HEAD
        <div className="space-y-6">
            <GoalProgressCard goal={latestGoal} logs={allActivityLogs} />

            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                    {/* Total Sessions Stat */}
                    <div className="flex items-center justify-center sm:justify-start px-2 sm:px-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg bg-green-100 text-green-700 mr-3 sm:mr-4">
                            <TotalPassIcon />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-500 leading-tight">Totalt Antal Pass</p>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{allActivityLogs.length}</p>
                        </div>
                    </div>
                    {/* Current Streak Stat */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
=======
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
>>>>>>> origin/staging
            </div>
        </div>
    );
};
