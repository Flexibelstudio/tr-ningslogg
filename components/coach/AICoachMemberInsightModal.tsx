import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { ParticipantProfile, ParticipantGoalData, ActivityLog } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { renderMarkdown } from '../../utils/textUtils';
import { callGeminiApiFn } from '../../firebaseClient';

interface AICoachMemberInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: ParticipantProfile;
  goals: ParticipantGoalData[];
  logs: ActivityLog[];
}

const AICoachMemberInsightModalFC: React.FC<AICoachMemberInsightModalProps> = ({ isOpen, onClose, participant, goals, logs }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestGoal = goals.filter((g) => !g.isCompleted).sort((a, b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];

  useEffect(() => {
    if (isOpen && participant) {
      const generateSummary = async () => {
        setIsLoading(true);
        setError(null);
        setSummary(null);

        const fourWeeksAgo = dateUtils.addDays(new Date(), -28);
        const logsLast4Weeks = logs.filter((l) => new Date(l.completedDate) >= fourWeeksAgo);
        const avgWeeklyActivities = (logsLast4Weeks.length / 4).toFixed(1);

        const moodRatings = logs.map((l) => l.moodRating).filter((r): r is number => r !== undefined);
        const avgMoodRating = moodRatings.length > 0 ? (moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length).toFixed(1) : null;

        const recentComments = logs
          .map((l) => (l.type === 'workout' ? (l as any).postWorkoutComment : (l as any).comment))
          .filter(Boolean)
          .slice(0, 5)
          .map((c) => `* "${c}"`)
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
                    *   Ge 1-2 konkreta förslag på vad coachen kan ta upp med medlemmen vid nästa möte. (t.ex. "Fråga hur det känns i knäböjen eftersom de kommenterade att det var tungt", "Peppa dem för deras höga träningsfrekvens", "Diskutera om målet på 5 pass/vecka är realistiskt givet deras kommentarer om tidsbrist").
                    *   **Vardagsmotion:** Påminn medlemmen om vikten av daglig rörelse för att nå WHO:s rekommendationer (150-300 minuter medelintensiv aktivitet per vecka). Detta är en viktig del av helheten.`;

        try {
          const result = await callGeminiApiFn({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          const { text, error } = result.data as { text?: string; error?: string };
          if (error) {
            throw new Error(`Cloud Function error: ${error}`);
          }

          setSummary(text);
        } catch (err) {
          console.error('Error generating member insight:', err);
          setError('Kunde inte generera AI-insikt. Försök igen senare.');
        } finally {
          setIsLoading(false);
        }
      };
      generateSummary();
    }
  }, [isOpen, participant, goals, logs, latestGoal]);

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
            <div className="bg-gray-50 rounded-md text-gray-800 leading-relaxed prose prose-base max-w-none">{renderMarkdown(summary)}</div>
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

export const AICoachMemberInsightModal = React.memo(AICoachMemberInsightModalFC);