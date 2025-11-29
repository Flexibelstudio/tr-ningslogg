
import React, { useState, useCallback } from 'react';
import { ParticipantProfile, WorkoutLog, OneOnOneSession } from '../../types';
import { Button } from '../Button';
import { callGeminiApiFn } from '../../firebaseClient';

interface AIEngagementResult {
  participantId: string;
  name: string;
  reason: string;
}

interface EngagementOpportunitiesProps {
  participants: ParticipantProfile[];
  workoutLogs: WorkoutLog[];
  oneOnOneSessions: OneOnOneSession[];
  isOnline: boolean;
}

export const EngagementOpportunities: React.FC<EngagementOpportunitiesProps> = ({ participants, workoutLogs, oneOnOneSessions, isOnline }) => {
  const [activeAnalysis, setActiveAnalysis] = useState<'heroes' | 'churn' | null>(null);
  const [silentHeroes, setSilentHeroes] = useState<AIEngagementResult[]>([]);
  const [churnRisks, setChurnRisks] = useState<AIEngagementResult[]>([]);
  const [isLoadingHeroes, setIsLoadingHeroes] = useState(false);
  const [isLoadingChurn, setIsLoadingChurn] = useState(false);
  const [errorHeroes, setErrorHeroes] = useState<string | null>(null);
  const [errorChurn, setErrorChurn] = useState<string | null>(null);
  
  const findSilentHeroes = useCallback(async () => {
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
    
    try {
        const result = await callGeminiApiFn({
            action: 'identify_silent_heroes',
            context: { candidates }
        });

        const { text, error } = result.data as { text?: string; error?: string };
        if (error) {
            throw new Error(`Cloud Function error: ${error}`);
        }

        const parsedHeroes = JSON.parse(text);
        setSilentHeroes(parsedHeroes);
    } catch (err) {
      console.error("Error finding silent heroes:", err);
      setErrorHeroes("Kunde inte analysera data med AI. Försök igen.");
    } finally {
      setIsLoadingHeroes(false);
    }
  }, [participants, workoutLogs]);

  const findChurnRisks = useCallback(async () => {
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

    try {
        const result = await callGeminiApiFn({
            action: 'identify_churn_risks',
            context: { candidates }
        });

        const { text, error } = result.data as { text?: string; error?: string };
        if (error) {
            throw new Error(`Cloud Function error: ${error}`);
        }

        const parsedRisks = JSON.parse(text);
        setChurnRisks(parsedRisks);
    } catch (err) {
        console.error("Error finding churn risks:", err);
        setErrorChurn("Kunde inte analysera data med AI. Försök igen.");
    } finally {
        setIsLoadingChurn(false);
    }
  }, [participants, workoutLogs, oneOnOneSessions]);

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
    <details className="p-4 sm:p-6 bg-gray-50 rounded-lg shadow-xl border h-full" open>
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
            disabled={isLoadingHeroes || !isOnline} 
            variant="outline"
          >
            {isLoadingHeroes ? 'Söker...' : (isOnline ? 'Hitta Tysta Hjältar' : 'AI Offline')}
          </Button>
          <Button 
            onClick={findChurnRisks} 
            disabled={isLoadingChurn || !isOnline} 
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
