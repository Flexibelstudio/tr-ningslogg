

import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Workout, WorkoutBlock, WorkoutCategory } from '../../types'; // Added WorkoutBlock, WorkoutCategory
import { INTENSITY_LEVELS } from '../../constants'; // Import INTENSITY_LEVELS

interface SelectWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workouts: Workout[]; // Published workouts
  onStartWorkout: (workout: Workout) => void;
  categoryFilter?: WorkoutCategory;
}

export const SelectWorkoutModal: React.FC<SelectWorkoutModalProps> = ({
  isOpen,
  onClose,
  workouts,
  onStartWorkout,
  categoryFilter,
}) => {
  if (!isOpen) return null;

  const filteredWorkouts = categoryFilter
    ? workouts.filter(w => w.category === categoryFilter)
    : workouts;

  let modalTitleText = "Välj Pass att Starta";
  if (categoryFilter === 'PT-bas') {
    modalTitleText = "Välj PT-bas Pass";
  } else if (categoryFilter === 'PT-grupp') {
    modalTitleText = "Välj PT-grupp Pass";
  }


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitleText} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-10">
            <svg className="mx-auto h-12 w-12 text-flexibel/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-xl font-semibold text-gray-700">Inga pass</h3>
            <p className="mt-1 text-base text-gray-500">
                Inga {categoryFilter ? `${categoryFilter.toLowerCase()} ` : ''}pass är tillgängliga för loggning just nu.
            </p>
          </div>
        ) : (
          filteredWorkouts.map((workout) => {
            const intensityDetail = workout.category === 'PT-bas' && workout.intensityLevel
                                    ? INTENSITY_LEVELS.find(l => l.value === workout.intensityLevel)
                                    : null;
            return (
              <div key={workout.id} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-out border border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-flexibel">{workout.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <p className="text-sm text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                      {intensityDetail && (
                        <span className={`inline-block ${intensityDetail.twBadgeClass} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                          Fokus: {intensityDetail.label}
                        </span>
                      )}
                    </div>
                    {workout.isModifiable && workout.exerciseSelectionOptions && (
                      <p className="text-sm text-blue-600 italic mt-1">
                        Detta pass är modifierbart. Du kommer att få välja {workout.exerciseSelectionOptions.maxSelect} övningar.
                      </p>
                    )}
                  </div>
                  <Button 
                    onClick={() => onStartWorkout(workout)} 
                    size="md" 
                    className="w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0"
                    aria-label={`Starta passet ${workout.title}`}
                  >
                    Starta Pass
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Button>
                </div>
                {!workout.isModifiable && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-flexibel hover:underline font-medium">
                      Visa övningar ({workout.blocks?.reduce((sum, block) => sum + block.exercises.length, 0) || 0})
                    </summary>
                    {workout.blocks?.map((block: WorkoutBlock, blockIndex: number) => (
                        <div key={block.id || `modal-block-${blockIndex}`} className="mt-1.5 pl-2 border-l-2 border-flexibel/20">
                            {block.name && <h4 className="text-xs font-semibold text-gray-600">{block.name}</h4>}
                            <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-gray-600">
                            {block.exercises.map((ex) => (
                                <li key={ex.id} className="text-sm">
                                <span className="font-semibold">{ex.name}:</span> {ex.notes}
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
          })
        )}
         <div className="flex justify-end pt-4 mt-2">
            <Button onClick={onClose} variant="secondary">Stäng</Button>
        </div>
      </div>
    </Modal>
  );
};