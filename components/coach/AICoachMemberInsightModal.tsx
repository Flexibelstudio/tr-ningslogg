
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantProfile, ParticipantGoalData, ActivityLog } from '../../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as dateUtils from '../../utils/dateUtils';

interface AICoachMemberInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  ai: GoogleGenAI;
  participant: ParticipantProfile;
  goals: ParticipantGoalData[];
  logs: ActivityLog[];
}

const getIconForHeader = (headerText: string): JSX.Element | null => {
    const lowerHeaderText = headerText.toLowerCase();
    if (lowerHeaderText.includes("aktivitet") || lowerHeaderText.includes("konsistens")) return <span className="mr-2 text-xl" role="img" aria-label="Aktivitet">📊</span>;
    if (lowerHeaderText.includes("målsättning") || lowerHeaderText.includes("progress")) return <span className="mr-2 text-xl" role="img" aria-label="Målsättning">🎯</span>;
    if (lowerHeaderText.includes("mående") || lowerHeaderText.includes("engagemang")) return <span className="mr-2 text-xl" role="img" aria-label="Mående">😊</span>;
    if (lowerHeaderText.includes("rekommendationer")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommendationer">💡</span>;
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>;
};

const renderSummaryContent = (summary: string | null): JSX.Element[] | null => {
    if (!summary) return null;
    const lines = summary.split('\n');
    const renderedElements: JSX.Element[] = [];
    let currentListItems: JSX.Element[] = [];
    let listKeySuffix = 0;
  
    const flushList = () => {
      if (currentListItems.length > 0) {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
        listKeySuffix++;
      }
    };
  
    for (let i = 0; i < lines.length; i++) {
      let lineContent = lines[i];
      lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
  
      if (lineContent.startsWith('## ')) {
        flushList();
        const headerText = lineContent.substring(3).trim();
        const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
        renderedElements.push(
          <h4 key={`h4-${i}`} className="text-xl font-bold text-gray-800 flex items-center mb-2 mt-4">
            {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
          </h4>
        );
      } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
        const listItemText = lineContent.substring(2).trim();
        currentListItems.push(
          <li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />
        );
      } else {
        flushList();
        if (lineContent.trim() !== '') {
            renderedElements.push(
              <p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />
            );
        }
      }
    }
    flushList();
    return renderedElements;
};


export const AICoachMemberInsightModal: React.FC<AICoachMemberInsightModalProps> = ({ isOpen, onClose, ai, participant, goals, logs }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const latestGoal = useMemo(() => {
        return goals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    }, [goals]);

    useEffect(() => {
        if (isOpen && participant) {
            const generateSummary = async () => {
                setIsLoading(true);
                setError(null);
                setSummary(null);

                const fourWeeksAgo = dateUtils.addDays(new Date(), -28);
                const logsLast4Weeks = logs.filter(l => new Date(l.completedDate) >= fourWeeksAgo);
                const avgWeeklyActivities = (logsLast4Weeks.length / 4).toFixed(1);

                const moodRatings = logs.map(l => l.moodRating).filter((r): r is number => r !== undefined);
                const avgMoodRating = moodRatings.length > 0 ? (moodRatings.reduce((a,b) => a+b, 0) / moodRatings.length).toFixed(1) : null;
                
                const recentComments = logs
                    .map(l => (l.type === 'workout' ? (l as any).postWorkoutComment : (l as any).comment))
                    .filter(Boolean)
                    .slice(0, 5)
                    .map(c => `* "${c}"`)
                    .join('\n');

                const prompt = `Du är en AI-assistent för en träningscoach på Flexibel Hälsostudio. Din uppgift är att ge en koncis och insiktsfull sammanfattning av en specifik medlems aktivitet och mående. Fokusera på att ge coachen snabba, användbara insikter. Använd Markdown för att formatera ditt svar (## Rubriker, **fet text**, * punktlistor).

                Medlemmens data:
                - Namn: ${participant.name}
                - Mål: "${latestGoal?.fitnessGoals || 'Inget aktivt mål satt.'}"
                - Mål (pass/vecka): ${latestGoal?.workoutsPerWeekTarget || 'N/A'}
                - Antal totalt loggade aktiviteter: ${logs.length}
                - Genomsnittligt antal pass/vecka (senaste 4 veckorna): ${avgWeeklyActivities}
                - Genomsnittligt mående (1-5): ${avgMoodRating || 'N/A'}
                - Senaste 5 kommentarerna: 
                ${recentComments || '* Inga kommentarer lämnade.'}

                Baserat på denna data, ge en sammanfattning som inkluderar:
                1.  **## Aktivitet & Konsistens:**
                    *   Hur många pass har medlemmen loggat totalt?
                    *   Hur ser den genomsnittliga träningsfrekvensen ut per vecka? Ligger den i linje med medlemmens mål?

                2.  **## Målsättning & Progress:**
                    *   Är medlemmen på väg att nå sitt mål för antal pass per vecka?
                    *   Baserat på målets text, vad bör du som coach hålla ett extra öga på? (t.ex. om målet är '100 kg bänkpress', uppmärksamma bänkpressloggar. Om målet är 'må bättre', kommentera på humörskattningarna).

                3.  **## Mående & Engagemang:**
                    *   Vad indikerar medlemmens genomsnittliga humörskattning?
                    *   Finns det några teman i kommentarerna (positiva, negativa, specifika utmaningar)?

                4.  **## Rekommendationer för Coachen:**
                    *   Ge 1-2 konkreta förslag på vad coachen kan ta upp med medlemmen vid nästa möte. (t.ex. "Fråga hur det känns i knäböjen eftersom de kommenterade att det var tungt", "Peppa dem för deras höga träningsfrekvens", "Diskutera om målet på 5 pass/vecka är realistiskt givet deras kommentarer om tidsbrist").`;
                
                try {
                    const response: GenerateContentResponse = await ai.models.generateContent({
                      model: "gemini-2.5-flash",
                      contents: prompt,
                    });
                    setSummary(response.text);
                } catch (err) {
                    console.error("Error generating member insight:", err);
                    setError("Kunde inte generera AI-insikt. Försök igen senare.");
                } finally {
                    setIsLoading(false);
                }
            };
            generateSummary();
        }
    }, [isOpen, participant, goals, logs, ai, latestGoal]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`AI Insikt för ${participant.name}`} size="xl">
            <div className="space-y-4 min-h-[250px] max-h-[70vh] flex flex-col">
                {isLoading && (
                    <div className="text-center py-8 flex flex-col items-center justify-center flex-grow">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel mx-auto mb-3"></div>
                        <p className="text-lg text-gray-600">AI analyserar data...</p>
                    </div>
                )}
                {error && !isLoading && (
                    <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex-grow flex flex-col justify-center items-center">
                        <p className="font-semibold text-xl">Ett fel uppstod</p>
                        <p className="mt-1 text-base">{error}</p>
                    </div>
                )}
                {summary && !isLoading && !error && (
                    <div className="overflow-y-auto flex-grow p-1 pr-2">
                        <div className="bg-gray-50 rounded-md text-gray-800 leading-relaxed">
                            {renderSummaryContent(summary)}
                        </div>
                    </div>
                )}
                <div className="flex justify-end pt-4 border-t mt-auto">
                    <Button onClick={onClose} variant="secondary">
                        Stäng
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
