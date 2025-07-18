import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote } from '../../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as dateUtils from '../../utils/dateUtils';

interface MemberNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ai: GoogleGenAI;
  participant: ParticipantProfile;
  notes: CoachNote[];
  allParticipantGoals: ParticipantGoalData[];
  allActivityLogs: ActivityLog[];
  onAddNote: (noteText: string) => void;
}

const getIconForHeader = (headerText: string): JSX.Element | null => {
    const lowerHeaderText = headerText.toLowerCase();
    if (lowerHeaderText.includes("aktivitet") || lowerHeaderText.includes("konsistens")) return <span className="mr-2 text-xl" role="img" aria-label="Aktivitet">📊</span>;
    if (lowerHeaderText.includes("målsättning") || lowerHeaderText.includes("progress")) return <span className="mr-2 text-xl" role="img" aria-label="Målsättning">🎯</span>;
    if (lowerHeaderText.includes("mående") || lowerHeaderText.includes("engagemang")) return <span className="mr-2 text-xl" role="img" aria-label="Mående">😊</span>;
    if (lowerHeaderText.includes("rekommendationer")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommendationer">💡</span>;
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>;
};

const renderMarkdownContent = (markdownText: string | null): JSX.Element[] | null => {
    if (!markdownText) return null;
    const lines = markdownText.split('\n');
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
          <h4 key={`h4-${i}`} className="text-lg font-bold text-gray-800 flex items-center mb-2 mt-3">
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

export const MemberNotesModal: React.FC<MemberNotesModalProps> = ({ 
    isOpen, onClose, ai, participant, notes, allParticipantGoals, allActivityLogs, onAddNote 
}) => {
    const [newNoteText, setNewNoteText] = useState('');
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isLoadingAi, setIsLoadingAi] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiSectionVisible, setIsAiSectionVisible] = useState(false);

    const latestGoal = useMemo(() => {
        return allParticipantGoals.filter(g => !g.isCompleted).sort((a, b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    }, [allParticipantGoals]);

    const handleSaveNote = () => {
        if (newNoteText.trim()) {
            onAddNote(newNoteText.trim());
            setNewNoteText('');
        }
    };

    const handleGenerateInsight = async () => {
        setIsAiSectionVisible(true);
        if (aiInsight) return; // Don't regenerate if already generated

        setIsLoadingAi(true);
        setAiError(null);

        const fourWeeksAgo = dateUtils.addDays(new Date(), -28);
        const logsLast4Weeks = allActivityLogs.filter(l => new Date(l.completedDate) >= fourWeeksAgo);
        const avgWeeklyActivities = (logsLast4Weeks.length / 4).toFixed(1);

        const moodRatings = allActivityLogs.map(l => l.moodRating).filter((r): r is number => r !== undefined);
        const avgMoodRating = moodRatings.length > 0 ? (moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length).toFixed(1) : null;
        
        const recentComments = allActivityLogs
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
        - Antal totalt loggade aktiviteter: ${allActivityLogs.length}
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
            setAiInsight(response.text);
        } catch (err) {
            console.error("Error generating member insight:", err);
            setAiError("Kunde inte generera AI-insikt. Försök igen senare.");
        } finally {
            setIsLoadingAi(false);
        }
    };

    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    }, [notes]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Avstämning & Anteckningar för ${participant.name}`} size="2xl">
            <div className="space-y-6">
                
                <details className="p-2 bg-gray-50 rounded-lg border" open={isAiSectionVisible} onToggle={(e) => setIsAiSectionVisible((e.target as HTMLDetailsElement).open)}>
                    <summary className="text-base font-semibold text-flexibel cursor-pointer select-none" onClick={(e) => { e.preventDefault(); handleGenerateInsight(); }}>
                        {isAiSectionVisible ? 'Dölj AI-Insikt' : 'Visa AI-Insikt för Avstämning'}
                    </summary>
                    <div className="mt-2 pt-2 border-t">
                        {isLoadingAi && <p className="text-gray-600">Laddar AI-insikt...</p>}
                        {aiError && <p className="text-red-600">{aiError}</p>}
                        {aiInsight && !isLoadingAi && !aiError && (
                            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                                {renderMarkdownContent(aiInsight)}
                            </div>
                        )}
                    </div>
                </details>

                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-700">Ny Anteckning</h3>
                    <Textarea 
                        label="Skriv din anteckning från avstämningen här..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        rows={5}
                        className="text-base"
                    />
                    <div className="flex justify-end">
                        <Button onClick={handleSaveNote} disabled={!newNoteText.trim()}>
                            Spara Anteckning
                        </Button>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                    <h3 className="text-lg font-semibold text-gray-700">Historik</h3>
                    {sortedNotes.length === 0 ? (
                        <p className="text-gray-500 italic">Inga tidigare anteckningar för denna medlem.</p>
                    ) : (
                        <div className="max-h-60 overflow-y-auto space-y-3 pr-2 -mr-2">
                            {sortedNotes.map(note => (
                                <div key={note.id} className="p-3 bg-white border border-gray-200 rounded-md shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500">
                                        {new Date(note.createdDate).toLocaleString('sv-SE', {
                                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                    <p className="mt-1 text-base text-gray-800 whitespace-pre-wrap">{note.noteText}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Klar</Button>
                </div>
            </div>
        </Modal>
    );
};
