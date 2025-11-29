
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Workout, WorkoutLog, ParticipantProfile, Exercise } from '../../../types';
import { callGeminiApiFn } from '../../../firebaseClient';

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
  previousLog?: WorkoutLog;
  participant: ParticipantProfile;
}

const renderTipsContent = (tips: AiWorkoutTips | null): React.ReactElement | null => {
    if (!tips) return null;
    return (
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-2">
                    <span className="text-2xl mr-2" role="img" aria-label="Robot">🤖</span>
                    Sammanfattning & Fokus
                </h3>
                <p className="text-base text-gray-700 whitespace-pre-wrap">{tips.generalTips}</p>
            </div>
            {tips.exerciseTips.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                        <span className="text-2xl mr-2" role="img" aria-label="Måltavla">🎯</span>
                        Tips för dagens pass
                    </h3>
                    {tips.exerciseTips.map((tip, index) => (
                        <div key={index} className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                            <p className="font-semibold text-blue-800">{tip.exerciseName}</p>
                            <p className="text-blue-700 mt-1">{tip.tip}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
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
        
        const summaryOfPreviousLog = previousLog ? {
            workoutTitle: workout.title, 
            completedDate: previousLog.completedDate,
            mood: previousLog.moodRating,
            comment: previousLog.postWorkoutComment,
            exercises: previousLog.entries.map(entry => {
                const exerciseDetail = (workout.blocks || []).flatMap(b => b.exercises).find(ex => ex.id === entry.exerciseId);
                return {
                    name: exerciseDetail?.name || 'Okänd övning',
                    sets: entry.loggedSets.map(s => ({ reps: s.reps, weight: s.weight, distanceMeters: s.distanceMeters, durationSeconds: s.durationSeconds, caloriesKcal: s.caloriesKcal }))
                };
            })
        } : null;
        
        const exercisesList = (workout.blocks || []).flatMap(b => b.exercises.map(e => e.name)).slice(0, 5).join(', ');

        try {
            const result = await callGeminiApiFn({
              action: 'generate_workout_tips',
              context: {
                  workoutTitle: workout.title,
                  aiInstruction: workout.aiInstruction,
                  participantName: participant.name,
                  previousLog: summaryOfPreviousLog,
                  exercisesList: exercisesList
              }
            });
      
            const { text, error } = result.data as { text?: string; error?: string };
            if (error) {
              throw new Error(`Cloud Function error: ${error}`);
            }
      
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
