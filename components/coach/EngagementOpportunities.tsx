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
        
        // Exclude those with a set termination date (endDate) unless it's very far in future
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
      setErrorHeroes("Inga kandidater hittades (minst 4 pass och max 2 reaktioner senaste 3 veckorna).");
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
      setErrorHeroes("Kunde inte analysera data med AI.");
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
        setErrorChurn("Ingen relevant data att analysera.");
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
        setErrorChurn("Kunde inte analysera data med AI.");
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
    const color = activeAnalysis === 'heroes' ? 'bg-green-50' : 'bg-orange-50';

    return (
        <div className={`mt-4 p-4 rounded-xl border ${color} border-opacity-50 animate-fade-in-down`}>
            <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>{icon}</span> {title}
            </h4>
            {isLoading && (
                 <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                    <div className="animate-spin h-4 w-4 border-2 border-flexibel border-t-transparent rounded-full"></div>
                    Analyserar medlemmar...
                </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            {results.length > 0 && (
                <ul className="space-y-2">
                    {results.map(item => (
                        <li key={item.participantId} className="p-2.5 bg-white rounded-lg shadow-sm border border-gray-100">
                            <p className="font-bold text-sm text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-600 italic mt-0.5">{item.reason}</p>
                        </li>
                    ))}
                </ul>
            )}
            {!isLoading && !error && results.length === 0 && (
                <p className="text-sm text-gray-500 italic">Hittade inga medlemmar i denna kategori just nu.</p>
            )}
        </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
        {/* CONTRACT EXPIRATION SECTION */}
        {expiringContracts.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-6 bg-orange-500 rounded-full"></span>
                    Utgående avtal ({expiringContracts.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {expiringContracts.map(p => {
                        const daysLeft = Math.ceil((new Date(p.bindingEndDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isCustomDateOpen = customDateIds.has(p.id);

                        return (
                            <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                                        <p className="text-xs text-gray-500">Slutdatum: {new Date(p.bindingEndDate!).toLocaleDateString('sv-SE')}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${daysLeft < 14 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {daysLeft} dgr kvar
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {!isCustomDateOpen ? (
                                        <>
                                            <Button size="sm" variant="primary" className="!text-[10px] !py-1" onClick={() => handleContractAction('renew', p.id)}>
                                                Bind om
                                            </Button>
                                            <Button size="sm" variant="outline" className="!text-[10px] !py-1" onClick={() => toggleCustomDate(p.id)}>
                                                Välj datum
                                            </Button>
                                            <Button size="sm" variant="ghost" className="!text-[10px] !py-1 !text-orange-600" onClick={() => handleContractAction('rolling', p.id)}>
                                                Låt löpa
                                            </Button>
                                            <Button size="sm" variant="ghost" className="!text-[10px] !py-1 !text-red-600" onClick={() => handleContractAction('terminate', p.id)}>
                                                Säg upp
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-1.5 w-full animate-fade-in-down">
                                            <Input 
                                                type="date" 
                                                value={customDates[p.id] || ''} 
                                                onChange={e => handleCustomDateChange(p.id, e.target.value)} 
                                                inputSize="sm"
                                                containerClassName="flex-grow"
                                            />
                                            <Button size="sm" variant="primary" className="!py-1" onClick={() => { handleContractAction('custom', p.id, customDates[p.id]); toggleCustomDate(p.id); }} disabled={!customDates[p.id]}>
                                                Spara
                                            </Button>
                                            <Button size="sm" variant="ghost" className="!py-1" onClick={() => toggleCustomDate(p.id)}>
                                                X
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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-flexibel rounded-full"></span>
                AI Engagemangsmöjligheter
            </h3>
            
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                Använd AI för att analysera träningsmönster och proaktivt nå ut till medlemmar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                    onClick={findSilentHeroes} 
                    disabled={isLoadingHeroes || !isOnline} 
                    variant="outline"
                    className="w-full !text-xs !py-2.5"
                >
                    <span className="mr-1.5">🦸</span> {isLoadingHeroes ? 'Söker...' : 'Hitta Tysta Hjältar'}
                </Button>
                <Button 
                    onClick={findChurnRisks} 
                    disabled={isLoadingChurn || !isOnline} 
                    variant="secondary"
                    className="w-full !text-xs !py-2.5"
                >
                    <span className="mr-1.5">⚠️</span> {isLoadingChurn ? 'Analyserar...' : 'Identifiera Churn-risk'}
                </Button>
            </div>

            {renderAIResults()}
        </div>
    </div>
  );
};