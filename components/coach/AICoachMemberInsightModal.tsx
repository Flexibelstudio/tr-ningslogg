
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

        try {
          const result = await callGeminiApiFn({
            action: 'analyze_member_insights',
            context: {
                participantName: participant.name,
                goal: latestGoal?.fitnessGoals,
                goalTarget: latestGoal?.workoutsPerWeekTarget,
                totalLogs: logs.length,
                avgWeeklyActivities,
                avgMoodRating,
                recentComments
            }
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
