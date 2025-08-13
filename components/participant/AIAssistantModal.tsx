import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Workout, WorkoutLog, ParticipantProfile, Exercise } from '../../types';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export interface AiWorkoutTips {
  generalTips: string;
  exerciseTips: {
    exerciseName: string;
    tip: string;
  }[];
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (tips: AiWorkoutTips) => void;
  ai: GoogleGenAI;
  workout: Workout;
  previousLog: WorkoutLog;
  participant: ParticipantProfile;
  allWorkouts: Workout[];
}

const renderTipsContent = (tips: AiWorkoutTips | null): JSX.Element | null => {
    if (!tips) return null;
    return (
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-2">
                    <span className="text-2xl mr-2" role="img" aria-label="Robot">🤖</span>
                    Sammanfattning & Fokus
                </h3>
                <p className="text-base text-gray-700 whitespace-pre-wrap">{tips.generalTips}</p>
            </div>
            {tips.exerciseTips.length > 0 && (
                <div className="space-y-2">
                     <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <span className="text-2xl mr-2" role="img" aria-label="Måltavla">🎯</span>
                        Tips för dagens pass
                    </h3>
                    {tips.exerciseTips.map((tip, index) => (
                        <div key={index} className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                            <p className="font-semibold text-blue-800">{tip.exerciseName}</p>
                            <p className="text-blue-700 mt-1">{tip.tip}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  ai,
  workout,
  previousLog,
  participant,
  allWorkouts,
}) => {
    const [tips, setTips] = useState<AiWorkoutTips | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const generateTips = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTips(null);

        const previousWorkoutTemplate = allWorkouts.find(w => w.id === previousLog.workoutId);
        
        const summaryOfPreviousLog = {
            workoutTitle: previousWorkoutTemplate?.title || workout.title,
            completedDate: previousLog.completedDate,
            mood: previousLog.moodRating,
            comment: previousLog.postWorkoutComment,
            exercises: previousLog.entries.map(entry => {
                const exerciseDetail = previousWorkoutTemplate?.blocks.flatMap(b => b.exercises).find(ex => ex.id === entry.exerciseId);
                return {
                    name: exerciseDetail?.name || 'Okänd övning',
                    sets: entry.loggedSets.map(s => ({ reps: s.reps, weight: s.weight, distanceMeters: s.distanceMeters, durationSeconds: s.durationSeconds, caloriesKcal: s.caloriesKcal }))
                };
            })
        };

        const prompt = `Du är "Flexibot", en stöttande och kunnig AI-träningspartner. Ditt svar MÅSTE vara på svenska.
En medlem, ${participant.name}, ska köra passet "${workout.title}" igen. Här är datan från deras senaste logg av samma pass:
${JSON.stringify(summaryOfPreviousLog)}

Din uppgift är att generera motiverande och hjälpsamma tips för den kommande sessionen. Svara ALLTID med en JSON-struktur.

Fokusera på:
1.  En kort, uppmuntrande sammanfattning av förra passet i 'generalTips'.
2.  Ge 2-3 konkreta, action-orienterade tips för specifika övningar i 'exerciseTips'. 
    - **VIKTIGT:** Om en övning i datan har ett 'weight' men saknar 'reps' (eller reps är 0), betyder det att det var ett tidsbaserat set (t.ex. AMRAP). Använd då vikten som referens. Exempel: "Förra gången använde du 24kg i Goblet Squats. Känns det bra att sikta på 26kg idag?"
    - För vanliga set med både vikt och reps, ge tips om progressiv överbelastning. Exempel: "Försök öka vikten lite på Knäböj idag, du klarade 8 reps förra gången!"
    - Analysera även medlemmens kommentar för att ge relevanta tekniktips.

Exempel på JSON-svar:
{
  "generalTips": "Grymt jobbat med passet förra veckan! Du kände dig stark (4/5 i humör). Idag, fokusera på att hålla samma fina teknik, speciellt när det blir tungt.",
  "exerciseTips": [
    { "exerciseName": "Knäböj", "tip": "Du klarade 8 reps på 80kg. Prova att sikta på 82.5kg idag, eller gör 9-10 reps på 80kg om det känns bättre." },
    { "exerciseName": "Kettlebell Svingar", "tip": "Du använde 24kg förra gången. Försök hålla samma vikt men med ännu mer explosivitet från höften!" },
    { "exerciseName": "Hantelrodd", "tip": "Din kommentar nämnde att det kändes tungt i slutet. Fokusera på att dra med ryggen och undvik att gunga med kroppen för att spara energi." }
  ]
}`;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                generalTips: { type: Type.STRING },
                exerciseTips: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            exerciseName: { type: Type.STRING },
                            tip: { type: Type.STRING },
                        },
                        required: ["exerciseName", "tip"]
                    }
                }
            },
            required: ["generalTips", "exerciseTips"]
        };

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });
            const parsedTips = JSON.parse(response.text);
            setTips(parsedTips);
        } catch (err) {
            console.error("Error generating AI workout tips:", err);
            setError("Kunde inte generera AI-tips. Du kan starta passet ändå.");
        } finally {
            setIsLoading(false);
        }
    }, [ai, workout, previousLog, participant, allWorkouts]);

    useEffect(() => {
        if (isOpen) {
            generateTips();
        }
    }, [isOpen, generateTips]);

    const handleContinueWithTips = () => {
        onContinue(tips || { generalTips: '', exerciseTips: [] });
    };
      
    const handleSkipAndContinue = () => {
        onContinue({ generalTips: '', exerciseTips: [] });
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Tips för: ${workout.title}`} size="xl">
            <div className="space-y-4 min-h-[250px] max-h-[70vh] flex flex-col">
                {isLoading && (
                    <div className="text-center py-8 flex flex-col items-center justify-center flex-grow">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel mx-auto mb-3"></div>
                        <p className="text-lg text-gray-600">AI:n förbereder pepp & tips...</p>
                    </div>
                )}
                {error && !isLoading && (
                    <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg flex-grow flex flex-col justify-center items-center">
                        <p className="font-semibold text-xl">Något gick snett</p>
                        <p className="mt-1 text-base">{error}</p>
                    </div>
                )}
                {!isLoading && !error && tips && (
                    <div className="overflow-y-auto flex-grow p-1 pr-2">
                        {renderTipsContent(tips)}
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t mt-auto gap-3">
                    <Button onClick={handleSkipAndContinue} variant="secondary">Hoppa över</Button>
                    <Button onClick={handleContinueWithTips} variant="primary" disabled={isLoading}>
                        {isLoading ? 'Laddar...' : 'Starta Passet'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};