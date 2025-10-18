import React, { useState, useCallback } from 'react';
import { Location, ParticipantProfile, ActivityLog, Workout, WorkoutLog, GeneralActivityLog, OneOnOneSession, StaffMember } from '../../types';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { callGeminiApiFn } from '../../firebaseClient';
import { renderMarkdown } from '../../utils/textUtils';

interface AIBusinessInsightsProps {
  locations: Location[];
  participants: ParticipantProfile[];
  allActivityLogs: ActivityLog[];
  workouts: Workout[];
  oneOnOneSessions: OneOnOneSession[];
  staffMembers: StaffMember[];
  isOnline: boolean;
}

const exampleQuestions = [
    "Vilka är de fem mest loggade passen den senaste månaden?",
    "Vilken coach har flest 1-on-1 sessioner totalt sett?",
    "Vilken tid på dagen är mest populär för loggningar i Salem?",
    "Sammanfatta de vanligaste teman i medlemmarnas kommentarer från deras träningsloggar."
];

export const AIBusinessInsights: React.FC<AIBusinessInsightsProps> = ({
    locations, participants, allActivityLogs, workouts, oneOnOneSessions, staffMembers, isOnline
}) => {
    const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
    const [question, setQuestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!question.trim()) {
            setError("Du har inte ställt en fråga.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAiResponse(null);

        const locationName = locations.find(l => l.id === selectedLocationId)?.name || 'Alla';
        const filteredParticipants = selectedLocationId === 'all'
            ? participants
            : participants.filter(p => p.locationId === selectedLocationId);
        const filteredParticipantIds = new Set(filteredParticipants.map(p => p.id));

        const filteredLogs = allActivityLogs.filter(log => filteredParticipantIds.has(log.participantId));
        const workoutLogs = filteredLogs.filter(l => l.type === 'workout') as WorkoutLog[];
        const filteredSessions = oneOnOneSessions.filter(s => filteredParticipantIds.has(s.participantId));
        
        const passFrequency: { [key: string]: number } = {};
        workoutLogs.forEach(log => {
            const workout = workouts.find(w => w.id === log.workoutId);
            if (workout) passFrequency[workout.title] = (passFrequency[workout.title] || 0) + 1;
        });

        const coachSessionCounts: { [key: string]: number } = {};
        filteredSessions.forEach(session => {
            const coachName = staffMembers.find(s => s.id === session.coachId)?.name || 'Okänd Coach';
            coachSessionCounts[coachName] = (coachSessionCounts[coachName] || 0) + 1;
        });

        const recentComments = filteredLogs
            .map(log => (log.type === 'workout' ? (log as WorkoutLog).postWorkoutComment : (log as GeneralActivityLog).comment))
            .filter(Boolean)
            .slice(0, 100);

        const simplifiedLogs = filteredLogs.slice(0, 200).map(log => ({
            date: new Date(log.completedDate).toISOString(),
            type: log.type === 'workout' ? 'gym_pass' : 'general_activity',
        }));

        const dataSnapshot = JSON.stringify({
            analysisContext: { studio: locationName, totalMembers: filteredParticipants.length, totalLogs: filteredLogs.length, date: new Date().toISOString().split('T')[0] },
            passSummary: passFrequency,
            coachOneOnOneSummary: coachSessionCounts,
            latestComments: recentComments,
            recentActivityStream: simplifiedLogs,
        });

        const prompt = `System: Du är en expert på träningsdataanalys för Flexibel Hälsostudio. Ditt svar MÅSTE vara på svenska. Var koncis, datadriven och formatera ditt svar med Markdown (## rubriker, * punktlistor, **fet text**). Svara ENDAST på frågan baserat på den data du får. Spekulera inte. Om datan inte kan besvara frågan, säg det. Ignorera begreppet 'bokningar' och tolka det som 'loggade pass'.

Här är en ögonblicksbild av relevant data:
${dataSnapshot}

Baserat på denna data, vänligen besvara följande fråga:
Användarens Fråga: "${question}"`;

        try {
            const result = await callGeminiApiFn({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

            const { text, error } = result.data as { text?: string; error?: string };

            if (error) {
                throw new Error(`Cloud Function error: ${error}`);
            }
            
            setAiResponse(text);
        } catch (err) {
            console.error("Error generating business insight:", err);
            setError("Kunde inte generera svar från AI. Försök igen.");
        } finally {
            setIsLoading(false);
        }

    }, [question, selectedLocationId, locations, participants, allActivityLogs, workouts, oneOnOneSessions, staffMembers]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-xl space-y-6">
            <div>
                <p className="text-base text-gray-600">
                    Ställ frågor om din verksamhet och få datadrivna svar från AI:n. Analysen baseras på de valda studiorna.
                </p>
            </div>

            <div className="space-y-2">
                <label className="text-lg font-semibold text-gray-700">Filtrera Ort för Analys</label>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedLocationId('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${selectedLocationId === 'all' ? 'bg-flexibel text-white border-flexibel' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                    >
                        Alla
                    </button>
                    {locations.map(loc => (
                        <button
                            key={loc.id}
                            onClick={() => setSelectedLocationId(loc.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${selectedLocationId === loc.id ? 'bg-flexibel text-white border-flexibel' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                        >
                            {loc.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="ai-question" className="text-lg font-semibold text-gray-700">Din fråga</label>
                <Textarea
                    id="ai-question"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ställ en fråga om medlemmar, pass, loggningar..."
                    rows={4}
                />
            </div>
            
            <div className="space-y-2">
                <p className="text-sm text-gray-500">Eller välj en exempelfråga:</p>
                <div className="flex flex-wrap gap-2">
                    {exampleQuestions.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => setQuestion(q)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </div>

            <Button onClick={handleGenerate} fullWidth size="md" disabled={isLoading || !isOnline} className="!bg-[#82c0c0] hover:!bg-[#6db5b5] !text-white">
                {isLoading ? 'Analyserar...' : (isOnline ? 'Fråga AI' : 'AI Offline')}
            </Button>
            
            {(isLoading || error || aiResponse) && (
                <div className="mt-6 pt-6 border-t">
                    {isLoading && (
                        <div className="flex items-center justify-center text-gray-600">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-flexibel mr-3"></div>
                            <span>AI:n tänker...</span>
                        </div>
                    )}
                    {error && <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div>}
                    {aiResponse && (
                        <div className="bg-gray-50 p-4 rounded-lg prose prose-base max-w-none">
                            {renderMarkdown(aiResponse)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
