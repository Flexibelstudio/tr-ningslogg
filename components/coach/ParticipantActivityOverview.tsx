<<<<<<< HEAD
=======

>>>>>>> origin/staging
import React, { useState, useMemo, useCallback } from 'react';
import { WorkoutLog, Workout, Exercise, SetDetail, WorkoutExerciseLog, LiftType } from '../../types';
import { Button } from '../Button';
import { AICoachActivitySummaryModal } from './AICoachActivitySummaryModal';
import * as dateUtils from '../../utils/dateUtils';
import { MOOD_OPTIONS } from '../../constants';
import { useAppContext } from '../../context/AppContext';
import { callGeminiApiFn } from '../../firebaseClient';

interface ParticipantActivityOverviewProps {
  workoutLogs: WorkoutLog[];
  workouts: Workout[];
  isOnline: boolean;
}

interface EnrichedSetDetailView {
  reps?: number | string;
  weight?: number | string;
  distanceMeters?: number | string;
  durationSeconds?: number | string;
  caloriesKcal?: number | string;
}
interface EnrichedExerciseLogView {
  exerciseName: string;
  exerciseNotes?: string;
  loggedSets: EnrichedSetDetailView[];
}
interface EnrichedWorkoutSessionView {
  workoutTitle: string;
  completedDate: string; 
  exercises: EnrichedExerciseLogView[];
  postWorkoutComment?: string;
  moodRating?: number;
}

// Helper Icon component
const StatsIconSvg = ({ path, className }: { path: string; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-flexibel ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// StatCard component for displaying individual statistics
interface StatCardProps {
  title: string;
  value: string | number;
  iconPath: string;
  unit?: string;
  isText?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, iconPath, unit, isText }) => (
  <div className="bg-gray-100 p-4 rounded-lg shadow flex items-start">
    <StatsIconSvg path={iconPath} className="mr-3 mt-1 flex-shrink-0" />
    <div>
      <h4 className="text-sm font-medium text-gray-500">{title}</h4>
      {isText ? (
         <p className="text-base font-semibold text-gray-800 break-words">{value} {unit && <span className="text-sm font-normal text-gray-600">{unit}</span>}</p>
      ) : (
         <p className="text-lg sm:text-xl font-semibold text-gray-800">{value} {unit && <span className="text-sm font-normal text-gray-600">{unit}</span>}</p>
      )}
    </div>
  </div>
);


export const ParticipantActivityOverview: React.FC<ParticipantActivityOverviewProps> = ({ workoutLogs, workouts, isOnline }) => {
  const [isAiSummaryModalOpen, setIsAiSummaryModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  const quantitativeStats = useMemo(() => {
    if (workoutLogs.length === 0) {
      return null;
    }

    const totalLoggedPass = workoutLogs.length;

    const workoutFrequency: { [templateId: string]: { title: string, count: number } } = {};
    workoutLogs.forEach(log => {
      const workoutTemplate = workouts.find(w => w.id === log.workoutId);
      if (workoutTemplate && workoutTemplate.isPublished) { // Only count published workouts
        if (!workoutFrequency[workoutTemplate.id]) {
          workoutFrequency[workoutTemplate.id] = { title: workoutTemplate.title, count: 0 };
        }
        workoutFrequency[workoutTemplate.id].count++;
      }
    });
    
    let mostFrequentPassTitle = "Inga publicerade pass loggade";
    if (Object.keys(workoutFrequency).length > 0) {
      mostFrequentPassTitle = Object.values(workoutFrequency).sort((a, b) => b.count - a.count)[0].title;
    }

    const sevenDaysAgo = dateUtils.addDays(new Date(), -7);
    const activityLast7Days = workoutLogs.filter(log => new Date(log.completedDate) >= sevenDaysAgo).length;

    let totalMoodSum = 0;
    let moodCount = 0;
    workoutLogs.forEach(log => {
      if (typeof log.moodRating === 'number') {
        totalMoodSum += log.moodRating;
        moodCount++;
      }
    });
    const averageMoodRating = moodCount > 0 ? (totalMoodSum / moodCount).toFixed(1) : "N/A";

    const baseLiftLoggedSetsCount: Record<LiftType, number> = {} as Record<LiftType, number>;
    workoutLogs.forEach(log => {
      const workoutTemplate = workouts.find(w => w.id === log.workoutId);
      if (workoutTemplate) {
        log.entries.forEach(entry => {
          let exerciseDetail: Exercise | undefined;
          for (const block of (workoutTemplate.blocks || [])) {
            const foundEx = block.exercises.find(ex => ex.id === entry.exerciseId);
            if (foundEx) {
              exerciseDetail = foundEx;
              break;
            }
          }
          if (exerciseDetail?.baseLiftType) {
            // Count based on the number of logged (assumed completed) sets for that exercise
            baseLiftLoggedSetsCount[exerciseDetail.baseLiftType] = 
              (baseLiftLoggedSetsCount[exerciseDetail.baseLiftType] || 0) + entry.loggedSets.length;
          }
        });
      }
    });

    const top3BaseLifts = Object.entries(baseLiftLoggedSetsCount)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 3)
      .map(([lift, count]) => ({ lift: lift as LiftType, count }));

    const recentComments = workoutLogs
      .filter(log => log.postWorkoutComment && log.postWorkoutComment.trim() !== '')
      .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
      .slice(0, 5)
      .map(log => {
        const moodEmoji = log.moodRating ? MOOD_OPTIONS.find(m => m.rating === log.moodRating)?.emoji : '';
        return {
          comment: log.postWorkoutComment!,
          date: new Date(log.completedDate).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric'}),
          moodEmoji: moodEmoji || '',
        };
      });

    return {
      totalLoggedPass,
      mostFrequentPassTitle,
      activityLast7Days,
      averageMoodRating,
      top3BaseLifts,
      recentComments,
    };
  }, [workoutLogs, workouts]);

  const generateAiSummary = useCallback(async () => {
    if (workoutLogs.length === 0) {
      setAiSummaryError("Inga loggar finns att analysera.");
      setIsAiSummaryModalOpen(true);
      return;
    }

    setIsLoadingAiSummary(true);
    setAiSummary(null);
    setAiSummaryError(null);

    const enrichedSessions: EnrichedWorkoutSessionView[] = workoutLogs.map(log => {
        const workoutTemplate = workouts.find(w => w.id === log.workoutId);
        const loggedExercises: EnrichedExerciseLogView[] = log.entries.map(entry => {
            let exerciseDetail: Exercise | undefined;
            if (workoutTemplate?.blocks) {
                for (const block of workoutTemplate.blocks) {
                    const foundEx = block.exercises.find(ex => ex.id === entry.exerciseId);
                    if (foundEx) {
                        exerciseDetail = foundEx;
                        break;
                    }
                }
            }
            let setsData: EnrichedSetDetailView[] = [];
            if (entry.loggedSets && entry.loggedSets.length > 0) {
                setsData = entry.loggedSets.map(s => ({ 
                    reps: s.reps, 
                    weight: s.weight,
                    distanceMeters: s.distanceMeters,
                    durationSeconds: s.durationSeconds,
                    caloriesKcal: s.caloriesKcal,
                }));
            }
            return {
            exerciseName: exerciseDetail?.name || "Okänd övning",
            exerciseNotes: exerciseDetail?.notes,
            loggedSets: setsData,
            };
        }).filter(e => e.loggedSets.length > 0);
        
        return {
            workoutTitle: workoutTemplate?.title || "Okänt pass",
            completedDate: log.completedDate,
            exercises: loggedExercises,
            postWorkoutComment: log.postWorkoutComment,
            moodRating: log.moodRating,
        };
    }).filter(s => s.exercises.length > 0);

    const summaryOfLogs = JSON.stringify(enrichedSessions.slice(0, 20)); // Limit to last 20 logs for prompt length

<<<<<<< HEAD
    const prompt = `Du är en AI-assistent för en träningscoach. Ge en sammanfattning och identifiera trender från medlemmarnas senaste träningsloggar. Svara på svenska.
Fokusera på:
1.  **Aktivitetsfrekvens:** Har aktiviteten ökat eller minskat?
2.  **Passpreferenser:** Vilka pass loggas mest?
3.  **Mående (Mood):** Finns det någon trend i hur medlemmarna mår efter passen (skala 1-5)?
4.  **Kommentarer:** Finns det återkommande teman i kommentarerna (t.ex. "tungt", "bra energi", "ont någonstans")?
5.  **Potentiella framsteg/problem:** Lyft fram om någon verkar göra stora framsteg, eller om någon verkar kämpa.

Data:
${summaryOfLogs}

Ge en koncis rapport till coachen.`;

    try {
        const result = await callGeminiApiFn({
            model: 'gemini-2.5-flash',
            contents: prompt,
=======
    try {
        const result = await callGeminiApiFn({
            action: 'analyze_activity_trends',
            context: { summaryOfLogs }
>>>>>>> origin/staging
        });

        const { text, error } = result.data as { text?: string; error?: string };
        if (error) {
            throw new Error(`Cloud Function error: ${error}`);
        }
        setAiSummary(text);
    } catch (error) {
      console.error("Error generating AI summary:", error);
      setAiSummaryError("Kunde inte generera AI-sammanfattning.");
    } finally {
      setIsLoadingAiSummary(false);
      setIsAiSummaryModalOpen(true);
    }
  }, [workoutLogs, workouts]);

  return (
    <div className="mt-10 mb-8 p-4 sm:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center mb-6 pb-4 border-b">
            {workoutLogs.length > 0 && (
                <Button onClick={generateAiSummary} disabled={isLoadingAiSummary || !isOnline} className="mt-3 sm:mt-0">
                    {isLoadingAiSummary ? 'Analyserar...' : (isOnline ? 'AI Sammanfattning' : 'AI Offline')}
                </Button>
            )}
        </div>

        {quantitativeStats ? (
            <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Totalt Loggade Pass" value={quantitativeStats.totalLoggedPass} iconPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    <StatCard title="Aktivitet Senaste 7 Dagar" value={quantitativeStats.activityLast7Days} unit="pass" iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    <StatCard title="Genomsnittligt Mående" value={quantitativeStats.averageMoodRating} iconPath="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <StatCard title="Populäraste Pass" value={quantitativeStats.mostFrequentPassTitle} isText={true} iconPath="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.846 5.671a1 1 0 00.95.69h5.969c.969 0 1.371 1.24.588 1.81l-4.836 3.522a1 1 0 00-.364 1.118l1.846 5.671c.3.921-.755 1.688-1.54 1.118l-4.836-3.522a1 1 0 00-1.176 0l-4.836 3.522c-.784.57-1.838-.197-1.539-1.118l1.846-5.671a1 1 0 00-.364-1.118L2.98 11.11c-.783-.57-.38-1.81.588-1.81h5.969a1 1 0 00.95-.69L11.049 2.927z" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Mest Loggade Baslyft</h3>
                        {quantitativeStats.top3BaseLifts.length > 0 ? (
                            <ul className="space-y-2">
                                {quantitativeStats.top3BaseLifts.map(lift => (
                                    <li key={lift.lift} className="text-base text-gray-600">{lift.lift}: {lift.count} set</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">Inga baslyft loggade än.</p>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Senaste Kommentarer</h3>
                        {quantitativeStats.recentComments.length > 0 ? (
                            <ul className="space-y-2">
                                {quantitativeStats.recentComments.map((c, i) => (
                                    <li key={i} className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded">
                                        "{c.comment}" <span className="text-xs not-italic text-gray-400 ml-1">({c.date}{c.moodEmoji && ` ${c.moodEmoji}`})</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500">Inga kommentarer än.</p>
                        )}
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">Inga pass loggade än.</p>
            </div>
        )}

        <AICoachActivitySummaryModal 
            isOpen={isAiSummaryModalOpen}
            onClose={() => setIsAiSummaryModalOpen(false)}
            isLoading={isLoadingAiSummary}
            aiSummary={aiSummary}
            error={aiSummaryError}
        />
    </div>
  );
};
