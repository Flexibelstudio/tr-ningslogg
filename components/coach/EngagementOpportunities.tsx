import React, { useState, useCallback } from 'react';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ParticipantProfile, WorkoutLog, OneOnOneSession } from '../../types';
import { Button } from '../Button';

interface AIEngagementResult {
  participantId: string;
  name: string;
  reason: string;
}

interface EngagementOpportunitiesProps {
  ai: GoogleGenAI | null;
  participants: ParticipantProfile[];
  workoutLogs: WorkoutLog[];
  oneOnOneSessions: OneOnOneSession[];
  isOnline: boolean;
}

export const EngagementOpportunities: React.FC<EngagementOpportunitiesProps> = ({ ai, participants, workoutLogs, oneOnOneSessions, isOnline }) => {
  const [activeAnalysis, setActiveAnalysis] = useState<'heroes' | 'churn' | null>(null);
  const [silentHeroes, setSilentHeroes] = useState<AIEngagementResult[]>([]);
  const [churnRisks, setChurnRisks] = useState<AIEngagementResult[]>([]);
  const [isLoadingHeroes, setIsLoadingHeroes] = useState(false);
  const [isLoadingChurn, setIsLoadingChurn] = useState(false);
  const [errorHeroes, setErrorHeroes] = useState<string | null>(null);
  const [errorChurn, setErrorChurn] = useState<string | null>(null);
  
  const findSilentHeroes = useCallback(async () => {
    if (!ai) {
      setErrorHeroes("AI-tjänsten är inte tillgänglig.");
      return;
    }

    setActiveAnalysis('heroes');
    setIsLoadingHeroes(true);
    setErrorHeroes(null);
    setSilentHeroes([]);

    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

    const memberStats = participants.filter(p => p.isActive).map(p => {
      const recentLogs = workoutLogs.filter(log =>
        log.participantId === p.id && new Date(log.completedDate) > threeWeeksAgo
      );
      const totalReactions = recentLogs.reduce((sum, log) => sum + (log.reactions?.length || 0), 0);
      
      return {
        id: p.id,
        name: p.name || 'Okänd',
        logCount: recentLogs.length,
        reactionCount: totalReactions,
      };
    });

    const candidates = memberStats.filter(m => m.logCount >= 4 && m.reactionCount <= 2);

    if (candidates.length === 0) {
      setErrorHeroes("Hittade inga medlemmar som matchade kriterierna (minst 4 pass och max 2 reaktioner senaste 3 veckorna).");
      setIsLoadingHeroes(false);
      return;
    }
    
    const prompt = `
      Du är en AI-assistent för en gymcoach. Ditt mål är att identifiera "Tysta Hjältar": medlemmar som tränar konsekvent men får lite engagemang (reaktioner) från communityt. 
      Analysera följande data och returnera en JSON-lista över de 3-5 mest relevanta medlemmarna som passar denna beskrivning. För varje medlem, ge en kort, positiv och action-orienterad anledning för coachen att nå ut.
      
      Data (medlemmar med hög träningsfrekvens och lågt engagemang senaste 3 veckorna):
      ${JSON.stringify(candidates)}

      Exempel på anledning: "Har varit väldigt konsekvent med 5 pass de senaste veckorna, men nästan inga reaktioner. Ett peppande ord kan betyda mycket!"
    `;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            participantId: { type: Type.STRING },
            name: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["participantId", "name", "reason"]
        }
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
        const parsedHeroes = JSON.parse(response.text);
        setSilentHeroes(parsedHeroes);
    } catch (err) {
      console.error("Error finding silent heroes:", err);
      setErrorHeroes("Kunde inte analysera data med AI. Försök igen.");
    } finally {
      setIsLoadingHeroes(false);
    }
  }, [ai, participants, workoutLogs]);

  const findChurnRisks = useCallback(async () => {
    if (!ai) {
        setErrorChurn("AI-tjänsten är inte tillgänglig.");
        return;
    }

    setActiveAnalysis('churn');
    setIsLoadingChurn(true);
    setErrorChurn(null);
    setChurnRisks([]);

    const fiftySixDaysAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

    const memberDataForAI = participants
      .filter(p => p.isActive)
      .map(p => {
        const allActivityForMember = workoutLogs.filter(log => log.participantId === p.id);
        const logsLast3Weeks = allActivityForMember.filter(log => new Date(log.completedDate) > twentyOneDaysAgo).length;
        const logsWeeks4to8 = allActivityForMember.filter(log => {
            const logDate = new Date(log.completedDate);
            return logDate <= twentyOneDaysAgo && logDate > fiftySixDaysAgo;
        }).length;

        const allSessionsForMember = oneOnOneSessions.filter(s => s.participantId === p.id);
        const sessionsLast3Weeks = allSessionsForMember.filter(s => new Date(s.startTime) > twentyOneDaysAgo).length;
        const sessionsWeeks4to8 = allSessionsForMember.filter(s => {
            const sessionDate = new Date(s.startTime);
            return sessionDate <= twentyOneDaysAgo && sessionDate > fiftySixDaysAgo;
        }).length;
        
        const recentMoodRatings = allActivityForMember
            .filter(log => new Date(log.completedDate) > fiftySixDaysAgo && log.moodRating)
            .map(log => log.moodRating);

        return {
          id: p.id,
          name: p.name || 'Okänd',
          membershipEndDate: p.endDate || null,
          activityLast3Weeks: { logs: logsLast3Weeks, sessions: sessionsLast3Weeks },
          activityWeeks4to8: { logs: logsWeeks4to8, sessions: sessionsWeeks4to8 },
          recentMoodRatings: recentMoodRatings,
        };
      });

    const candidates = memberDataForAI.filter(m => 
        (m.activityLast3Weeks.logs + m.activityLast3Weeks.sessions + m.activityWeeks4to8.logs + m.activityWeeks4to8.sessions) > 0 || m.membershipEndDate
    );
    
    if (candidates.length === 0) {
        setErrorChurn("Ingen relevant medlemsdata hittades att analysera.");
        setIsLoadingChurn(false);
        return;
    }

    const prompt = `
        Du är en AI-assistent som specialiserar sig på att identifiera medlemmar på ett gym som riskerar att avsluta sitt medlemskap ("churn"). Ditt svar MÅSTE vara på svenska.
        Analysera följande JSON-data över medlemmars aktivitet. Fokusera på att identifiera beteendeförändringar.

        Regler för din analys:
        1.  **Jämför aktivitet:** Jämför 'activityLast3Weeks' mot 'activityWeeks4to8'. En signifikant minskning i 'logs' (träningspass) eller 'sessions' (1-on-1) är en stark varningssignal.
        2.  **Viktade faktorer:** Minskad frekvens av 'sessions' är den allvarligaste indikatorn, följt av minskad frekvens av 'logs'.
        3.  **Medlemskapets slutdatum:** Ett 'membershipEndDate' som är nära i tiden (inom 30-60 dagar) ökar risken avsevärt, särskilt i kombination med minskad aktivitet.
        4.  **Humör:** En genomgående låg eller sjunkande trend i 'recentMoodRatings' är en negativ faktor.
        5.  **Hög risk:** En medlem anses ha hög risk om de visar en kombination av dessa faktorer.

        Din uppgift är att returnera en JSON-lista över de 3-5 medlemmar som löper HÖGST risk. För varje medlem, ge en kort, konkret och action-orienterad anledning (reason) till varför de är i riskzonen.

        Här är medlemsdatan:
        ${JSON.stringify(candidates)}
    `;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            participantId: { type: Type.STRING },
            name: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["participantId", "name", "reason"]
        }
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
        const parsedRisks = JSON.parse(response.text);
        setChurnRisks(parsedRisks);
    } catch (err) {
        console.error("Error finding churn risks:", err);
        setErrorChurn("Kunde inte analysera data med AI. Försök igen.");
    } finally {
        setIsLoadingChurn(false);
    }
  }, [ai, participants, workoutLogs, oneOnOneSessions]);

  const renderAIResults = () => {
    if (!activeAnalysis) return null;

    const isLoading = activeAnalysis === 'heroes' ? isLoadingHeroes : isLoadingChurn;
    const error = activeAnalysis === 'heroes' ? errorHeroes : errorChurn;
    const results = activeAnalysis === 'heroes' ? silentHeroes : churnRisks;
    const title = activeAnalysis === 'heroes' ? 'Tysta Hjältar' : 'Risk för Churn';
    const icon = activeAnalysis === 'heroes' ? '🦸' : '⚠️';

    return (
        <div className="mt-4 animate-fade-in-down">
            <h4 className="text-lg font-bold text-gray-800 mb-2">{icon} {title}</h4>
            {isLoading && <p className="text-gray-600">Analyserar data...</p>}
            {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded">{error}</p>}
            {results.length > 0 && (
                <ul className="space-y-2">
                    {results.map(item => (
                        <li key={item.participantId} className="p-3 bg-white rounded-md shadow-sm border">
                            <p className="font-bold text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-700 italic">💡 {item.reason}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
  };

  return (
    <details className="mt-10 mb-8 p-4 sm:p-6 bg-gray-50 rounded-lg shadow-xl border" open>
      <summary className="text-xl font-bold tracking-tight text-gray-800 cursor-pointer select-none">
        AI Engagemangsmöjligheter
      </summary>
      <div className="mt-4 pt-4 border-t">
        <p className="text-base text-gray-600 mb-4">
          Använd AI för att proaktivt identifiera medlemmar som behöver extra uppmärksamhet.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button 
            onClick={findSilentHeroes} 
            disabled={isLoadingHeroes || !ai || !isOnline} 
            variant="outline"
          >
            {isLoadingHeroes ? 'Söker...' : (isOnline ? 'Hitta Tysta Hjältar' : 'AI Offline')}
          </Button>
          <Button 
            onClick={findChurnRisks} 
            disabled={isLoadingChurn || !ai || !isOnline} 
            variant="secondary"
          >
            {isLoadingChurn ? 'Analyserar...' : (isOnline ? 'Identifiera Risk för Churn' : 'AI Offline')}
          </Button>
        </div>
        {renderAIResults()}
      </div>
    </details>
  );
};