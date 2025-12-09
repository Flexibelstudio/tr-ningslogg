
import React, { useState, useCallback, useMemo } from 'react';
import { ParticipantProfile, WorkoutLog, OneOnOneSession } from '../../types';
import { Button } from '../Button';
import { callGeminiApiFn } from '../../firebaseClient';
import { useCoachOperations } from '../../features/coach/hooks/useCoachOperations';
import { Input } from '../Input';

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
  const { handleContractAction } = useCoachOperations();
  const [activeAnalysis, setActiveAnalysis] = useState<'heroes' | 'churn' | null>(null);
  const [silentHeroes, setSilentHeroes] = useState<AIEngagementResult[]>([]);
  const [churnRisks, setChurnRisks] = useState<AIEngagementResult[]>([]);
  const [isLoadingHeroes, setIsLoadingHeroes] = useState(false);
  const [isLoadingChurn, setIsLoadingChurn] = useState(false);
  const [errorHeroes, setErrorHeroes] = useState<string | null>(null);
  const [errorChurn, setErrorChurn] = useState<string | null>(null);
  
  // State for Custom Date in Contract Renewal
  const [customDateIds, setCustomDateIds] = useState<Set<string>>(new Set());
  const [customDates, setCustomDates] = useState<Record<string, string>>({});

  const expiringContracts = useMemo(() => {
    const today = new Date();
    const thresholdDate = new Date(today);
    thresholdDate.setDate(today.getDate() + 35); // 35 days window

    return participants.filter(p => {
        if (!p.isActive || !p.bindingEndDate) return false;
        
        // Exclude those with a set termination date (endDate) unless it's very far in future (which shouldn't happen if properly terminated)
        if (p.endDate && new Date(p.endDate) < thresholdDate) return false; 

        const bindingEnd = new Date(p.bindingEndDate);
        return bindingEnd >= today && bindingEnd <= thresholdDate;
    }).sort((a, b) => new Date(a.bindingEndDate!).getTime() - new Date(b.bindingEndDate!).getTime());
  }, [participants]);

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

  const toggleCustomDate = (id: string) => {
    setCustomDateIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  };

  const handleCustomDateChange = (id: string, value: string) => {
      setCustomDates(prev => ({...prev, [id]: value}));
  };

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
    <div className="grid grid-cols-1 gap-6 h-full">
        {/* CONTRACT EXPIRATION SECTION (Always visible if data exists) */}
        {expiringContracts.length > 0 && (
            <div className="p-4 sm:p-6 bg-orange-50 rounded-lg shadow-xl border border-orange-200">
                <summary className="text-xl font-bold tracking-tight text-orange-900 flex items-center gap-2 mb-4">
                    <span>⏳ Utgående avtal ({expiringContracts.length})</span>
                </summary>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {expiringContracts.map(p => {
                        const daysLeft = Math.ceil((new Date(p.bindingEndDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isCustomDateOpen = customDateIds.has(p.id);

                        return (
                            <div key={p.id} className="p-4 bg-white rounded-lg border shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-gray-900">{p.name}</p>
                                        <p className="text-sm text-gray-600">Går ut: {new Date(p.bindingEndDate!).toLocaleDateString('sv-SE')}</p>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${daysLeft < 14 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {daysLeft} dagar kvar
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {!isCustomDateOpen ? (
                                        <>
                                            <Button size="sm" variant="primary" onClick={() => handleContractAction('renew', p.id)}>
                                                ✅ Bind om (12 mån)
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => toggleCustomDate(p.id)}>
                                                📅 Välj datum
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleContractAction('rolling', p.id)}>
                                                🔄 Låt löpa
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => handleContractAction('terminate', p.id)}>
                                                ❌ Säg upp
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 w-full animate-fade-in-down">
                                            <Input 
                                                type="date" 
                                                value={customDates[p.id] || ''} 
                                                onChange={e => handleCustomDateChange(p.id, e.target.value)} 
                                                inputSize="sm"
                                                containerClassName="flex-grow"
                                            />
                                            <Button size="sm" variant="primary" onClick={() => { handleContractAction('custom', p.id, customDates[p.id]); toggleCustomDate(p.id); }} disabled={!customDates[p.id]}>
                                                Spara
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => toggleCustomDate(p.id)}>
                                                Avbryt
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        <details className="p-4 sm:p-6 bg-gray-50 rounded-lg shadow-xl border" open>
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
    </div>
  );
};
