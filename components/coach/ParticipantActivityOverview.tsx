
import React, { useState, useMemo, useCallback } from 'react';
import { WorkoutLog, Workout, Exercise, SetDetail, WorkoutExerciseLog, LiftType } from '../../types';
import { Button } from '../Button';
import { AICoachActivitySummaryModal } from './AICoachActivitySummaryModal';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as dateUtils from '../../utils/dateUtils';
import { MOOD_OPTIONS } from '../participant/MoodSelectorInput';

const API_KEY = process.env.API_KEY;

interface ParticipantActivityOverviewProps {
  workoutLogs: WorkoutLog[];
  workouts: Workout[];
  ai: GoogleGenAI | null;
}

interface EnrichedSetDetailView {
  reps: number | string;
  weight?: number | string;
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
         <p className="text-base sm:text-lg font-semibold text-gray-800 break-words">{value} {unit && <span className="text-sm font-normal text-gray-600">{unit}</span>}</p>
      ) : (
         <p className="text-xl sm:text-2xl font-semibold text-gray-800">{value} {unit && <span className="text-sm font-normal text-gray-600">{unit}</span>}</p>
      )}
    </div>
  </div>
);


export const ParticipantActivityOverview: React.FC<ParticipantActivityOverviewProps> = ({ workoutLogs, workouts, ai }) => {
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
          for (const block of workoutTemplate.blocks) {
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
    if (!ai || workoutLogs.length === 0) {
      setAiSummaryError("AI-tjänsten är inte tillgänglig eller inga loggar finns att analysera.");
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
                setsData = entry.loggedSets.map(s => ({ reps: s.reps, weight: s.weight }));
            }
            return {
            exerciseName: exerciseDetail?.name || "Okänd övning",
            exerciseNotes: exerciseDetail?.notes,
            loggedSets: setsData,
            };
        }).filter(e => e.loggedSets.length > 0 && e.loggedSets.some(s => s.reps !== '' || (s.weight !== '' && s.weight !== undefined)));
        
        return {
            workoutTitle: workoutTemplate?.title || "Okänt pass",
            completedDate: log.completedDate,
            exercises: loggedExercises,
            postWorkoutComment: log.postWorkoutComment,
            moodRating: log.moodRating 
        };
    }).filter(session => session.exercises.length > 0)
      .sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
      .slice(0, 30); 

    const prompt = `Du är en AI-assistent för en träningscoach på Flexibel Hälsostudio. Din uppgift är att analysera den samlade träningsdatan från alla deltagare (anonymiserad) och ge coachen en övergripande bild av aktivitet och engagemang. Fokusera på trender, inte individuella detaljer. Använd Markdown för att formatera ditt svar (## Rubriker, **fet text**, * punktlistor).

Här är en sammanställning av upp till 30 av de senaste loggade passen från deltagarna (inklusive deras valfria humörskattning 1-5 för passet, där 5 är bäst):
${JSON.stringify(enrichedSessions, null, 2)}

Baserat på denna data, ge en sammanfattning som inkluderar:

1.  **## Övergripande Aktivitet:**
    *   Hur ser den generella aktivitetsnivån ut baserat på den data du fått? (t.ex. regelbunden loggning, sporadisk, nyligen ökad/minskad aktivitet).
    *   Vilka dagar i veckan verkar vara mest populära för träning, om det går att utläsa? (Valfritt, om data stödjer det).

2.  **## Populära Pass och Övningar:**
    *   Vilka typer av träningspass (baserat på workoutTitle) loggas oftast enligt datan?
    *   Finns det några specifika övningar (eller typer av baslyft om info finns) som förekommer frekvent i loggarna?

3.  **## Engagemang och Feedback (från postWorkoutComment och moodRating):**
    *   Finns det några genomgående teman i deltagarnas "postWorkoutComment"?
    *   Hur ser den generella humörskattningen (moodRating) ut för passen? Finns det några trender där?
    *   Hur ofta lämnas kommentarer och humörskattningar generellt sett i den givna datan?

4.  **## Potentiella Observationer för Coachen (Var försiktig och generell):**
    *   Finns det några generella mönster som kan vara intressanta för coachen? (t.ex. "Många verkar uppskatta styrkepassen", "Det kan finnas ett intresse för fler pass med fokus på X", "Humöret verkar generellt högt efter Y-pass"). Formulera detta som observationer, inte absoluta sanningar.

5.  **## Avslutande Uppmuntring/Summering:**
    *   Ge en kort, positiv summering av engagemanget som syns i datan och uppmuntra coachen.

**Viktigt:**
*   Identifiera INTE enskilda deltagare. Fokusera på den samlade bilden från den data du fått.
*   Var koncis och ge insikter som coachen kan använda för att anpassa sitt erbjudande eller sin kommunikation.
*   Om datan är begränsad, nämn det och anpassa sammanfattningen därefter (t.ex. "Med den nuvarande mängden data ser vi tendenser till...").
`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: prompt,
      });
      setAiSummary(response.text);
      setIsAiSummaryModalOpen(true);
    } catch (error) {
      console.error("Error fetching AI activity summary:", error);
      const typedError = error as Error;
      let errorMessage = "Kunde inte generera AI-sammanfattning. Försök igen senare.";
      if (typedError.message && typedError.message.includes("API key not valid")) {
        errorMessage = "API-nyckeln är ogiltig. Kontrollera att den är korrekt konfigurerad.";
      }
      setAiSummaryError(errorMessage);
      setIsAiSummaryModalOpen(true); 
    } finally {
      setIsLoadingAiSummary(false);
    }
  }, [ai, workoutLogs, workouts]);


  return (
    <div className="mt-10 mb-8 p-4 sm:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">Statistik & Insikter (Gruppnivå)</h2>
        {ai && (
            <Button
                onClick={generateAiSummary}
                disabled={isLoadingAiSummary || !API_KEY || workoutLogs.length === 0}
                title={!API_KEY ? "API-nyckel saknas för AI-funktioner" : (workoutLogs.length === 0 ? "Inga loggar att analysera" : "Generera Kvalitativ AI Sammanfattning")}
                variant="outline"
                className="mt-3 sm:mt-0"
            >
                {isLoadingAiSummary ? (
                <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-flexibel mr-2"></div>
                    Analyserar...
                </div>
                ) : "Kvalitativ AI Analys"}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3.5a1.5 1.5 0 011.5 1.5V5a1 1 0 001 1h1.5a1.5 1.5 0 010 3H12a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1-1H6.5a1.5 1.5 0 010-3H8a1 1 0 001-1V5a1.5 1.5 0 011.5-1.5zM3 10a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM6.5 10a.5.5 0 000 1h7a.5.5 0 000-1h-7z" />
                    <path fillRule="evenodd" d="M9.013 15.138A5.002 5.002 0 0010 15a5 5 0 001.2-.156C10.74 16.205 9.42 17 8 17c-2.761 0-5-2.239-5-5s2.239-5 5-5c1.42 0 2.74.795 3.548 2H9.522a.5.5 0 00-.51.684l.274.965A3.504 3.504 0 016.5 10c0 .341.048.67.137.986l-.274.965A.5.5 0 006.536 12H7a1 1 0 001-1V8.5a.5.5 0 00-1 0V10a1 1 0 00-1-1H3.5a.5.5 0 000 1H5V9.5a.5.5 0 00-1 0V11a1 1 0 001 1h.027a4.98 4.98 0 001.986 3.138zM12 11.5a.5.5 0 00.51-.684l-.274-.965A3.504 3.504 0 0113.5 10c0-.341-.048-.67-.137-.986l.274-.965A.5.5 0 0013.464 8H13a1 1 0 00-1 1v2.5a.5.5 0 001 0V10a1 1 0 001-1h1.5a.5.5 0 000-1H15v1.5a.5.5 0 001 0V9a1 1 0 00-1-1h-.027a4.98 4.98 0 00-1.986-3.138C13.26 3.795 14.58 3 16 3c2.761 0 5 2.239 5 5s-2.239 5-5 5c-1.42 0-2.74-.795-3.548-2h.026z" clipRule="evenodd" />
                </svg>
            </Button>
        )}
      </div>
      {!quantitativeStats ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-flexibel/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-xl font-semibold text-gray-700">Ingen deltagaraktivitet</h3>
          <p className="mt-1 text-base text-gray-500">Inga pass loggade av medlemmar ännu för att visa statistik.</p>
        </div>
      ) : (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Kvantitativ Överblick</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Totalt Loggade Pass" value={quantitativeStats.totalLoggedPass} unit="pass" iconPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                <StatCard title="Pass Senaste 7 Dagar" value={quantitativeStats.activityLast7Days} unit="pass" iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                <StatCard title="Mest Loggade Passet (Publicerade)" value={quantitativeStats.mostFrequentPassTitle} iconPath="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" isText={true}/>
                {quantitativeStats.averageMoodRating !== "N/A" && (
                    <StatCard title="Snittkänsla (Pass)" value={`${quantitativeStats.averageMoodRating}`} unit="/ 5" iconPath="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
            </div>

            {quantitativeStats.top3BaseLifts.length > 0 && (
                <div className="bg-gray-100 p-4 rounded-lg shadow">
                    <div className="flex items-center">
                        <StatsIconSvg path="M13 10V3L4 14h7v7l9-11h-7z" className="mr-3 mt-0 flex-shrink-0"/>
                        <h4 className="text-base sm:text-lg font-semibold text-gray-800">Topp 3 Baslyft (Loggade Set)</h4>
                    </div>
                    <ul className="mt-2 space-y-1 text-base text-gray-700 list-inside">
                        {quantitativeStats.top3BaseLifts.map(item => (
                            <li key={item.lift} className="flex justify-between">
                                <span>{item.lift}</span>
                                <span className="font-semibold">{item.count} set</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {quantitativeStats.recentComments.length > 0 && (
                <div className="bg-gray-100 p-4 rounded-lg shadow">
                     <div className="flex items-center">
                        <StatsIconSvg path="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" className="mr-3 mt-0 flex-shrink-0"/>
                        <h4 className="text-base sm:text-lg font-semibold text-gray-800">Senaste Kommentarer</h4>
                    </div>
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {quantitativeStats.recentComments.map((item, index) => (
                            <div key={index} className="p-2 bg-white rounded shadow-sm text-sm">
                                <p className="text-gray-700 italic">"{item.comment}"</p>
                                <p className="text-xs text-gray-500 mt-1 text-right">
                                    {item.moodEmoji && <span className="mr-1">{item.moodEmoji}</span>}
                                    {item.date}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
