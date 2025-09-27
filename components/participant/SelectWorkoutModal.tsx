import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Workout, WorkoutBlock, WorkoutCategory, Membership, Exercise } from '../../types';
import { INTENSITY_LEVELS } from '../../constants';

const formatPlan = (exercise: Exercise): string => {
    const parts: string[] = [];
    if (exercise.targetSets) parts.push(`${exercise.targetSets} set`);
    if (exercise.targetReps) parts.push(`x ${exercise.targetReps}`);
    if (exercise.targetWeight) parts.push(`@ ${exercise.targetWeight}`);
    if (exercise.targetDistanceMeters) parts.push(`${exercise.targetDistanceMeters}m`);
    if (exercise.targetDurationSeconds) parts.push(`${exercise.targetDurationSeconds}s`);
    if (exercise.targetCaloriesKcal) parts.push(`${exercise.targetCaloriesKcal}kcal`);
    if (exercise.targetRestSeconds) parts.push(`${exercise.targetRestSeconds} vila`);

    if (parts.length === 0 && exercise.notes) return exercise.notes;
    if (parts.length === 0) return '';
    
    let planString = parts[0];
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('x ') || parts[i].startsWith('@ ')) {
            planString += ` ${parts[i]}`;
        } else {
            planString += `, ${parts[i]}`;
        }
    }
    
    // Append general instructions if they exist
    if(exercise.notes) {
        planString += ` (${exercise.notes})`
    }
    
    return planString;
};

interface SelectWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workouts: Workout[];
  onStartWorkout: (workout: Workout) => void;
  categoryFilter?: WorkoutCategory;
  membership?: Membership | null;
  onOpenUpgradeModal: () => void;
  currentParticipantId: string;
  isProspect?: boolean;
}

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5 inline" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a2 2 0 00-2 2v2H7a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V8a2 2 0 00-2-2h-1V4a2 2 0 00-2-2zm-1 4V4a1 1 0 112 0v2H9z" clipRule="evenodd" />
    </svg>
);

const WorkoutCard: React.FC<{
  workout: Workout & { isRestricted?: boolean };
  onStart: (workout: Workout) => void;
  onUpgrade?: () => void;
}> = ({ workout, onStart, onUpgrade }) => {
    const intensityDetail = workout.category === 'PT-bas' && workout.intensityLevel
        ? INTENSITY_LEVELS.find(l => l.value === workout.intensityLevel)
        : null;
    const isRestricted = workout.isRestricted;

    return (
        <div key={workout.id} className={`relative p-4 rounded-lg shadow-md transition-all duration-200 ease-out border ${isRestricted ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-200 hover:shadow-lg'}`}>
        {isRestricted && <div className="absolute inset-0 bg-gray-200/50 rounded-lg z-0"></div>}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 relative z-10">
            <div>
            <h3 className={`text-xl font-semibold ${isRestricted ? 'text-gray-500' : 'text-flexibel'}`}>{workout.title}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <p className="text-sm text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                {intensityDetail && (
                <span className={`inline-block ${intensityDetail.twBadgeClass} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                    Fokus: {intensityDetail.label}
                </span>
                )}
                {isRestricted && <span className="inline-block bg-orange-200 text-orange-800 text-xs font-bold px-2 py-0.5 rounded-full">Uppgradera</span>}
            </div>
            {workout.isModifiable && workout.exerciseSelectionOptions && (
                <p className="text-sm text-blue-600 italic mt-1">
                Detta pass är modifierbart. Du kommer att få välja {workout.exerciseSelectionOptions.maxSelect} övningar.
                </p>
            )}
            </div>
            {isRestricted ? (
                <Button 
                    onClick={onUpgrade}
                    size="md"
                    variant="secondary"
                    className="w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0"
                    aria-label={`Lås upp passet ${workout.title}`}
                >
                    <LockIcon /> Lås Upp
                </Button>
            ) : (
                <Button 
                    onClick={() => onStart(workout)} 
                    size="md" 
                    className="w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0"
                    aria-label={`Starta passet ${workout.title}`}
                >
                    Starta Pass
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </Button>
            )}
        </div>
        {!workout.isModifiable && (
            <details className="mt-3 text-sm relative z-10">
            <summary className={`cursor-pointer ${isRestricted ? 'text-gray-500' : 'text-flexibel hover:underline'} font-medium`}>
                Visa övningar ({workout.blocks?.reduce((sum, block) => sum + block.exercises.length, 0) || 0})
            </summary>
            {workout.blocks?.map((block: WorkoutBlock, blockIndex: number) => (
                <div key={block.id || `modal-block-${blockIndex}`} className="mt-1.5 pl-2 border-l-2 border-flexibel/20">
                    {block.name && <h4 className="text-xs font-semibold text-gray-600">{block.name}</h4>}
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-gray-600">
                    {block.exercises.map((ex) => (
                        <li key={ex.id} className="text-sm">
                        <span className="font-semibold">{ex.name}:</span> {formatPlan(ex)}
                        {ex.baseLiftType && <span className="text-xs text-flexibel/80 font-normal ml-1">({ex.baseLiftType})</span>}
                        </li>
                    ))}
                    {block.exercises.length === 0 && <li className="text-xs text-gray-400 italic">Inga övningar i detta block.</li>}
                    </ul>
                </div>
            ))}
            {(!workout.blocks || workout.blocks.length === 0) && <p className="text-xs text-gray-400 italic mt-1 pl-2">Inga block eller övningar.</p>}
            </details>
        )}
        </div>
    );
};

export const SelectWorkoutModal: React.FC<SelectWorkoutModalProps> = ({
  isOpen,
  onClose,
  workouts,
  onStartWorkout,
  categoryFilter,
  membership,
  onOpenUpgradeModal,
  currentParticipantId,
  isProspect,
}) => {
  if (!isOpen) return null;

  let personalWorkouts: Workout[] = [];
  let generalWorkouts: Workout[] = [];

  if (categoryFilter === 'Personligt program') {
    personalWorkouts = workouts.filter(w => w.assignedToParticipantId === currentParticipantId);
  } else if (categoryFilter === 'PT-bas') {
    // FIX: This explicit check ensures 'PT-bas' is always handled correctly for all users,
    // resolving the issue where a faulty conditional was preventing regular members from seeing these workouts.
    generalWorkouts = workouts.filter(w => w.isPublished && !w.assignedToParticipantId && w.category === 'PT-bas');
  } else if (categoryFilter) {
    // Logic for other categories remains the same.
    generalWorkouts = workouts.filter(w => w.isPublished && !w.assignedToParticipantId && w.category === categoryFilter);
  }

  const workoutsWithRestriction = generalWorkouts.map(w => {
      if (isProspect) {
        return { ...w, isRestricted: false };
      }
      const isSubscriptionRestricted = membership?.type === 'subscription' && w.category !== 'Personligt program' && (membership?.restrictedCategories?.includes(w.category) || false);
      const isClipCardRestricted = membership?.type === 'clip_card' && (membership?.clipCardCategories?.includes(w.category) || false);
      return {
          ...w,
          isRestricted: isSubscriptionRestricted || isClipCardRestricted
      };
  });

  let modalTitleText = "Välj Pass att Starta";
  if (categoryFilter) {
    modalTitleText = `Välj ${categoryFilter} Pass`;
  }
  
  const hasGeneralWorkouts = workoutsWithRestriction.length > 0;
  const hasPersonalWorkouts = personalWorkouts.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitleText} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 -mr-2">
        {hasPersonalWorkouts && (
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-2">Mitt Personliga Program</h2>
            {personalWorkouts.map(w => (
              <WorkoutCard key={w.id} workout={w} onStart={onStartWorkout} />
            ))}
          </div>
        )}
        
        {hasGeneralWorkouts && (
          <div className="space-y-3">
            {workoutsWithRestriction.map(w => (
                <WorkoutCard key={w.id} workout={w} onStart={onStartWorkout} onUpgrade={onOpenUpgradeModal} />
            ))}
          </div>
        )}

        {!hasPersonalWorkouts && !hasGeneralWorkouts && (
          <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-flexibel/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-xl font-semibold text-gray-700">Inga pass</h3>
            <p className="mt-1 text-base text-gray-500">
                Inga {categoryFilter ? `${categoryFilter.toLowerCase()} ` : ''}pass är tillgängliga för loggning just nu.
            </p>
          </div>
        )}
         <div className="flex justify-end pt-4 mt-2">
            <Button onClick={onClose} variant="secondary">Stäng</Button>
        </div>
      </div>
    </Modal>
  );
};
