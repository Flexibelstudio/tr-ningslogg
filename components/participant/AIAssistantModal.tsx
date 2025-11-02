import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Workout, WorkoutLog, ParticipantProfile, Exercise } from '../../types';
// FIX: Aliased the 'Type' enum to 'GenAIType' to resolve a name collision with other 'type' properties in the application.
import { GoogleGenAI, GenerateContentResponse, Type as GenAIType } from "@google/genai";
import { callGeminiApiFn } from '../../firebaseClient';

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
  workout: Workout;
  previousLog: WorkoutLog;
  participant: ParticipantProfile;
}

// FIX: Replaced JSX syntax with React.createElement to fix "Cannot find namespace 'JSX'" error.
const renderTipsContent = (tips: AiWorkoutTips | null): React.ReactElement | null => {
    if (!tips) return null;
    return (
        React.createElement('div', { className: "space-y-4" },
            React.createElement('div', { className: "p-4 bg-gray-50 rounded-lg border" },
                React.createElement('h3', { className: "text-lg font-semibold text-gray-800 flex items-center mb-2" },
                    React.createElement('span', { className: "text-2xl mr-2", role: "img", 'aria-label': "Robot" }, '🤖'),
                    "Sammanfattning & Fokus"
                ),
                React.createElement('p', { className: "text-base text-gray-700 whitespace-pre-wrap" }, tips.generalTips)
            ),
            tips.exerciseTips.length > 0 && React.createElement('div', { className: "space-y-2" },
                React.createElement('h3', { className: "text-lg font-semibold text-gray-800 flex items-center" },
                    React.createElement('span', { className: "text-2xl mr-2", role: "img", 'aria-label': "Måltavla" }, '🎯'),
                    "Tips för dagens pass"
                ),
                ...tips.exerciseTips.map((tip, index) =>
                    React.createElement('div', { key: index, className: "p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg" },
                        React.createElement('p', { className: "font-semibold text-blue-800" }, tip.exerciseName),
                        React.createElement('p', { className: "text-blue-700 mt-1" }, tip.tip)
                    )
                )
            )
        )
    );
};


export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  workout,
  previousLog,
  participant,
}) => {
    const [tips, setTips] = useState<AiWorkoutTips | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const generateTips = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTips(null);
        
        const summaryOfPreviousLog = {
            workoutTitle: workout.title, // Use the current, correct workout title
            completedDate: previousLog.completedDate,
            mood: previousLog.moodRating,
            comment: previousLog.postWorkoutComment,
            exercises: previousLog.entries.map(entry => {
                // Find the exercise detail from the *current* workout template, not a potentially non-existent old one.
                const exerciseDetail = (workout.blocks || []).flatMap(b => b.exercises).find(ex => ex.id === entry.exerciseId);
                return {
                    name: exerciseDetail?.name || 'Okänd övning',
                    sets: entry.loggedSets.map(s => ({ reps: s.reps, weight: s.weight, distanceMeters: s.distanceMeters, durationSeconds: s.durationSeconds, caloriesKcal: s.caloriesKcal }))
                };
            })
        };
        
        const hasCoachInstruction = workout.aiInstruction && workout.aiInstruction.trim() !== '';

        const prompt = hasCoachInstruction
          ? `Du är "Flexibot", en stöttande och kunnig AI-träningspartner. Ditt svar MÅSTE vara på svenska.
En medlem, ${participant.name}, ska köra passet "${workout.title}".

**VIKTIG INSTRUKTION FRÅN COACHEN:** Coachen har gett en specifik instruktion för detta pass. Din feedback MÅSTE baseras på och förstärka denna instruktion.
Instruktion: "${workout.aiInstruction}"

Här är datan från medlemmens senaste logg av samma pass som du kan använda för att anpassa tipsen (t.ex. vikter och reps):
${JSON.stringify(summaryOfPreviousLog)}

Din uppgift är att generera motiverande och hjälpsamma tips för den kommande sessionen, med coachens instruktion som högsta prioritet. Svara ALLTID med en JSON-struktur.

Fokusera på:
1.  En kort, uppmuntrande sammanfattning i 'generalTips' som väver in coachens instruktion.
2.  Ge 2-3 konkreta, action-orienterade tips för specifika övningar i 'exerciseTips' som reflekterar coachens instruktion och använder data från förra passet för att föreslå progression.

Exempel på JSON-svar:
{
  "generalTips": "Grymt jobbat sist! Din coach vill att du idag fokuserar extra på tekniken i marklyften. Tänk 'stolt bröst' och filma gärna ett set för feedback!",
  "exerciseTips": [
    { "exerciseName": "Marklyft", "tip": "Förra gången lyfte du 80kg. Håll kvar vid den vikten idag och fokusera 100% på att hålla ryggen rak, precis som coachen vill." },
    { "exerciseName": "Knäböj", "tip": "Här kan du fortsätta öka lite om det känns bra. Du klarade 8 reps på 80kg, prova 82.5kg idag." }
  ]
}`
          : `Du är "Flexibot", en stöttande och kunnig AI-träningspartner. Ditt svar MÅSTE vara på svenska.
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
            type: GenAIType.OBJECT,
            properties: {
                generalTips: { type: GenAIType.STRING },
                exerciseTips: {
                    type: GenAIType.ARRAY,
                    items: {
                        type: GenAIType.OBJECT,
                        properties: {
                            exerciseName: { type: GenAIType.STRING },
                            tip: { type: GenAIType.STRING },
                        },
                        required: ["exerciseName", "tip"]
                    }
                }
            },
            required: ["generalTips", "exerciseTips"]
        };

        try {
            const result = await callGeminiApiFn({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
              },
            });
      
            const { text, error } = result.data as { text?: string; error?: string };
            if (error) {
              throw new Error(`Cloud Function error: ${error}`);
            }
      
            // FIX: Add check for empty text to prevent JSON.parse from crashing
            if (!text) {
                throw new Error("Received empty response from AI.");
            }
            const parsedTips = JSON.parse(text);
            setTips(parsedTips);
          } catch (err) {
            console.error("Error generating AI workout tips:", err);
            setError("Kunde inte generera AI-tips. Du kan starta passet ändå.");
          } finally {
            setIsLoading(false);
          }
    }, [workout, previousLog, participant]);

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
