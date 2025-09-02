import React from 'react';
import { Exercise, WorkoutLog, SetDetail, LoggableMetric } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { calculateEstimated1RM } from '../../utils/workoutUtils';

const CheckmarkButton: React.FC<{ isCompleted: boolean; onClick: () => void; }> = ({ isCompleted, onClick }) => {
  const baseClasses = 'w-10 h-10 flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200';
  
  const stateClasses = isCompleted
    ? 'bg-flexibel text-white focus:ring-flexibel'
    : 'bg-gray-200 text-gray-500 hover:bg-gray-300 focus:ring-gray-400';
  
  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${stateClasses}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
};

const DeleteSetButton: React.FC<{ onClick: () => void; }> = ({ onClick }) => (
    <button type="button" onClick={onClick} className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    </button>
);


const AiCoachIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);

const METRIC_CONFIG: Record<LoggableMetric, { placeholder: string; key: keyof SetDetail; inputMode: 'numeric' | 'decimal'; unit: string }> = {
    reps: { placeholder: 'Reps', key: 'reps', inputMode: 'numeric', unit: 'reps' },
    weight: { placeholder: 'Vikt', key: 'weight', inputMode: 'decimal', unit: 'kg' },
    distance: { placeholder: 'Distans', key: 'distanceMeters', inputMode: 'numeric', unit: 'm' },
    duration: { placeholder: 'Tid', key: 'durationSeconds', inputMode: 'numeric', unit: 'sek' },
    calories: { placeholder: 'Kcal', key: 'caloriesKcal', inputMode: 'numeric', unit: 'kcal' },
};


const getPreviousSetText = (previousSet: SetDetail | undefined, metrics: LoggableMetric[], isBodyweight: boolean): string => {
    if (!previousSet) return '';
    
    const parts = metrics.map(metric => {
        if (metric === 'weight' && isBodyweight) return null;
        const config = METRIC_CONFIG[metric];
        if (!config) return null;

        const value = previousSet[config.key as keyof SetDetail];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return `${value} ${config.unit}`;
        }
        return null;
    }).filter(Boolean);

    return parts.join(' / ') || '';
};

const formatPlan = (exercise: Exercise): string | null => {
    const parts: string[] = [];
    if (exercise.targetSets) parts.push(`${exercise.targetSets} set`);
    if (exercise.targetReps) parts.push(`x ${exercise.targetReps}`);
    if (exercise.targetWeight) parts.push(`@ ${exercise.targetWeight}`);
    if (exercise.targetDistanceMeters) parts.push(`${exercise.targetDistanceMeters}m`);
    if (exercise.targetDurationSeconds) parts.push(`${exercise.targetDurationSeconds}s`);
    if (exercise.targetCaloriesKcal) parts.push(`${exercise.targetCaloriesKcal}kcal`);
    if (exercise.targetRestSeconds) parts.push(`${exercise.targetRestSeconds} vila`);

    if (parts.length === 0) return null;

    let planString = parts[0];
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('x ') || parts[i].startsWith('@ ')) {
            planString += ` ${parts[i]}`;
        } else {
            planString += `, ${parts[i]}`;
        }
    }
    return planString;
};

interface ExerciseLogCardProps {
  exercise: Exercise;
  logEntries: Map<string, SetDetail[]>;
  handleUpdateSet: (exerciseId: string, setId: string, field: keyof SetDetail, value: any) => void;
  setSetToRemove: (data: { exerciseId: string; setId: string } | null) => void;
  logForReference?: WorkoutLog;
  aiExerciseTip?: string;
}

export const ExerciseLogCard: React.FC<ExerciseLogCardProps> = ({ exercise, logEntries, handleUpdateSet, setSetToRemove, logForReference, aiExerciseTip }) => {
  const sets = logEntries.get(exercise.id) || [];
  const previousSetsForExercise = logForReference?.entries.find(e => e.exerciseId === exercise.id)?.loggedSets;
  const metricsToLog: LoggableMetric[] = exercise.loggableMetrics && exercise.loggableMetrics.length > 0 
    ? exercise.loggableMetrics 
    : (exercise.isBodyweight ? ['reps'] : ['reps', 'weight']);
  const planText = formatPlan(exercise);

  return (
      <div className="space-y-4">
          <h2 className="text-3xl font-bold text-gray-800">{exercise.name}</h2>

          {(planText || exercise.notes) && (
            <div className="p-3 bg-gray-100 rounded-lg border">
                {planText && (
                    <div>
                        <p className="text-sm font-semibold text-gray-500 uppercase">Plan</p>
                        <p className="text-lg font-bold text-gray-800">{planText}</p>
                    </div>
                )}
                {exercise.notes && (
                    <div className={planText ? 'mt-2 pt-2 border-t' : ''}>
                         <p className="text-sm font-semibold text-gray-500 uppercase">Instruktioner</p>
                        <p className="text-base text-gray-700 whitespace-pre-wrap">{exercise.notes}</p>
                    </div>
                )}
            </div>
          )}

          {aiExerciseTip && (
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg my-4 animate-fade-in">
                <p className="font-semibold text-blue-800 flex items-center"><AiCoachIcon /> Coachens Tips</p>
                <p className="text-blue-700 mt-1 whitespace-pre-wrap">{aiExerciseTip}</p>
            </div>
          )}
          {sets.map((set, setIndex) => {
               const e1rm = calculateEstimated1RM(set.weight, set.reps);
               const previousSet = previousSetsForExercise?.[setIndex];
               const previousSetText = getPreviousSetText(previousSet, metricsToLog, exercise.isBodyweight || false);
              return (
                  <div key={set.id} className="bg-white p-4 rounded-2xl shadow-sm border relative">
                      <div className="flex justify-between items-center mb-3">
                          <h3 className="text-xl font-bold text-gray-700">Set {setIndex + 1}</h3>
                          {e1rm && <p className="text-base font-bold text-green-700">e1RM: {e1rm.toFixed(1)} kg</p>}
                      </div>
                      {previousSetText && (
                        <div className="text-base text-gray-600 mb-2 p-2 bg-gray-100 rounded-md">
                          <strong>Förra gången:</strong> {previousSetText}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                          <div className="flex-grow flex flex-wrap gap-3">
                            {metricsToLog.map(metric => {
                                const config = METRIC_CONFIG[metric];
                                if (!config) return null;
                                
                                const valueKey = config.key as keyof Omit<SetDetail, 'id' | 'isCompleted'>;
                                const value = set[valueKey] ?? '';

                                return (
                                    <div key={metric} className="flex-1 min-w-[90px]">
                                        <Input
                                            type="text"
                                            inputMode={config.inputMode}
                                            placeholder={config.placeholder}
                                            value={String(value)}
                                            onChange={e => handleUpdateSet(exercise.id, set.id, valueKey, e.target.value)}
                                            className="text-center"
                                            inputSize="md"
                                        />
                                    </div>
                                );
                            })}
                          </div>
                          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                              <DeleteSetButton onClick={() => setSetToRemove({ exerciseId: exercise.id, setId: set.id })} />
                              <CheckmarkButton isCompleted={!!set.isCompleted} onClick={() => handleUpdateSet(exercise.id, set.id, 'isCompleted', !set.isCompleted)} />
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>
  );
};