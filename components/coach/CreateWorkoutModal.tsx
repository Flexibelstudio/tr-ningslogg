import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { Workout, Exercise, LiftType, WorkoutCategory, WorkoutBlock, IntensityLevel } from '../../types';
import { WORKOUT_CATEGORY_OPTIONS, INTENSITY_LEVEL_OPTIONS_FOR_SELECT, INTENSITY_LEVELS, ALL_LIFT_TYPES } from '../../constants';

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveWorkout: (workout: Workout) => void;
  workoutToEdit?: Workout | null;
  onUpdateWorkout?: (workout: Workout) => void;
}

interface NewExerciseFormState {
  primaryLiftSelection: LiftType | '';
  name: string;
  notes: string;
  isBodyweight: boolean; // Added for bodyweight flag
}

const PRIMARY_EXERCISE_SELECTION_OPTIONS = [
  { value: '', label: 'Skriv egen övning...' },
  ...ALL_LIFT_TYPES.map(lift => ({ value: lift, label: lift })),
];

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-1.5-1.5a2 2 0 112.828-2.828l1.5 1.5a.5.5 0 00.707-.707l-1.5-1.5a3.5 3.5 0 00-4.95 4.95l-3 3a3.5 3.5 0 004.95 4.95l1.5-1.5a.5.5 0 00-.707-.707l-1.5 1.5a2 2 0 01-2.828-2.828l3-3a2 2 0 012.828 0z" clipRule="evenodd" />
  </svg>
);


export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({ 
    isOpen, 
    onClose, 
    onSaveWorkout, 
    workoutToEdit, 
    onUpdateWorkout 
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WorkoutCategory>('PT-bas');
  const [coachNote, setCoachNote] = useState('');
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  
  const initialNewExerciseFormState: NewExerciseFormState = { 
    primaryLiftSelection: '', 
    name: '', 
    notes: '', 
    isBodyweight: false, // Default for new exercises
  };
  const [newExerciseForms, setNewExerciseForms] = useState<Record<string, NewExerciseFormState>>({});
  const [selectedExercisesForSuperset, setSelectedExercisesForSuperset] = useState<Record<string, string[]>>({});


  const [intensityLevel, setIntensityLevel] = useState<IntensityLevel | ''>('');
  const [intensityInstructions, setIntensityInstructions] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const resetForm = () => {
    setTitle('');
    setCategory('PT-bas');
    setCoachNote('');
    const initialBlockId = crypto.randomUUID();
    setBlocks([{ id: initialBlockId, name: '', exercises: [], isQuickLogEnabled: false }]);
    setNewExerciseForms({ [initialBlockId]: { ...initialNewExerciseFormState } });
    setSelectedExercisesForSuperset({ [initialBlockId]: [] });
    setIntensityLevel('');
    setIntensityInstructions('');
    setIsSaving(false);
    setHasSaved(false);
  };

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
      if (workoutToEdit) {
        setTitle(workoutToEdit.title);
        const currentCategory = workoutToEdit.category || 'PT-bas';
        setCategory(currentCategory);
        setCoachNote(workoutToEdit.coachNote || '');
        
        if (currentCategory === 'PT-bas') {
          setIntensityLevel(workoutToEdit.intensityLevel || '');
          setIntensityInstructions(workoutToEdit.intensityInstructions || 
            (workoutToEdit.intensityLevel ? INTENSITY_LEVELS.find(l => l.value === workoutToEdit.intensityLevel)?.defaultInstructions || '' : '')
          );
        } else {
          setIntensityLevel('');
          setIntensityInstructions('');
        }
        
        const initialForms: Record<string, NewExerciseFormState> = {};
        const initialSupersetSelections: Record<string, string[]> = {};
        const blocksFromTemplate = workoutToEdit.blocks && workoutToEdit.blocks.length > 0 
          ? workoutToEdit.blocks 
          : [{ id: crypto.randomUUID(), name: '', exercises: [] }];

        const sanitizedBlocks = blocksFromTemplate.map(block => {
          const blockId = block.id || crypto.randomUUID();
          initialForms[blockId] = { ...initialNewExerciseFormState }; 
          initialSupersetSelections[blockId] = [];
          return {
            ...block,
            id: blockId,
            isQuickLogEnabled: block.isQuickLogEnabled || false,
            exercises: (block.exercises || []).map(ex => ({ 
              ...ex, 
              id: ex.id || crypto.randomUUID(),
              supersetIdentifier: ex.supersetIdentifier || undefined,
              isBodyweight: ex.isBodyweight || false, // Load isBodyweight flag
            }))
          };
        });
        setBlocks(sanitizedBlocks);
        setNewExerciseForms(initialForms);
        setSelectedExercisesForSuperset(initialSupersetSelections);

      } else {
        resetForm();
      }
    }
  }, [isOpen, workoutToEdit]);
  
  useEffect(() => {
    if (isOpen) {
        const currentForms = { ...newExerciseForms };
        const currentSupersetSelections = { ...selectedExercisesForSuperset };
        let formsUpdated = false;
        blocks.forEach(block => {
            if (!currentForms[block.id]) {
                currentForms[block.id] = { ...initialNewExerciseFormState };
                formsUpdated = true;
            }
            if (!currentSupersetSelections[block.id]) {
                currentSupersetSelections[block.id] = [];
                formsUpdated = true;
            }
        });
        if (formsUpdated) {
            setNewExerciseForms(currentForms);
            setSelectedExercisesForSuperset(currentSupersetSelections);
        }
    }
  }, [blocks, isOpen]);

  useEffect(() => {
    if (category === 'PT-bas') {
      if (intensityLevel && !intensityInstructions) {
        const levelDetail = INTENSITY_LEVELS.find(l => l.value === intensityLevel);
        setIntensityInstructions(levelDetail?.defaultInstructions || '');
      }
    } else {
      setIntensityLevel('');
      setIntensityInstructions('');
    }
  }, [category, intensityLevel, intensityInstructions]);

  const handleIntensityLevelChange = (newLevel: IntensityLevel | '') => {
    setIntensityLevel(newLevel);
    if (newLevel) {
      const levelDetail = INTENSITY_LEVELS.find(l => l.value === newLevel);
      setIntensityInstructions(levelDetail?.defaultInstructions || '');
    } else {
      setIntensityInstructions('');
    }
  };

  const handleAddBlock = () => {
    const newBlockId = crypto.randomUUID();
    setBlocks([...blocks, { id: newBlockId, name: '', exercises: [], isQuickLogEnabled: false }]);
    setNewExerciseForms(prev => ({ ...prev, [newBlockId]: { ...initialNewExerciseFormState } }));
    setSelectedExercisesForSuperset(prev => ({ ...prev, [newBlockId]: [] }));
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    setNewExerciseForms(prev => {
      const updatedForms = { ...prev };
      delete updatedForms[blockId];
      return updatedForms;
    });
    setSelectedExercisesForSuperset(prev => {
        const updatedSelections = { ...prev };
        delete updatedSelections[blockId];
        return updatedSelections;
    });
  };

  const handleBlockNameChange = (blockId: string, name: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, name } : b));
  };

  const handleBlockQuickLogToggle = (blockId: string, isEnabled: boolean) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, isQuickLogEnabled: isEnabled } : b));
  };
  
  const handleNewExerciseInputChange = (blockId: string, field: keyof NewExerciseFormState, value: string | LiftType | boolean) => {
    setNewExerciseForms(prev => {
      const currentFormState = prev[blockId] || { ...initialNewExerciseFormState };
      let updatedFormState = { ...currentFormState, [field]: value };

      if (field === 'primaryLiftSelection') {
        const selectedLift = value as LiftType | '';
        if (selectedLift) {
          updatedFormState.name = selectedLift;
        }
      } else if (field === 'name' && typeof value === 'string' && currentFormState.primaryLiftSelection && value !== currentFormState.primaryLiftSelection) {
        updatedFormState.primaryLiftSelection = '';
      }
      
      return { ...prev, [blockId]: updatedFormState };
    });
  };

  const handleAddExerciseToBlock = (blockId: string) => {
    const formState = newExerciseForms[blockId];
    if (!formState || formState.name.trim() === '') return;

    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name: formState.name.trim(),
      notes: formState.notes.trim(),
      baseLiftType: formState.primaryLiftSelection ? formState.primaryLiftSelection : undefined,
      isBodyweight: formState.isBodyweight, // Save the isBodyweight flag
    };

    setBlocks(prevBlocks => prevBlocks.map(b =>
      b.id === blockId
        ? { ...b, exercises: [...b.exercises, newExercise] }
        : b
    ));
    setNewExerciseForms(prev => ({ ...prev, [blockId]: { ...initialNewExerciseFormState } }));
  };

  const handleRemoveExerciseFromBlock = (blockId: string, exerciseId: string) => {
    setBlocks(prevBlocks => prevBlocks.map(b =>
      b.id === blockId
        ? { ...b, exercises: b.exercises.filter(ex => ex.id !== exerciseId) }
        : b
    ));
    setSelectedExercisesForSuperset(prev => ({
        ...prev,
        [blockId]: (prev[blockId] || []).filter(id => id !== exerciseId),
    }));
  };

  const handleToggleExerciseForSuperset = (blockId: string, exerciseId: string) => {
    setSelectedExercisesForSuperset(prev => {
        const currentSelection = prev[blockId] || [];
        if (currentSelection.includes(exerciseId)) {
            return { ...prev, [blockId]: currentSelection.filter(id => id !== exerciseId) };
        } else {
            return { ...prev, [blockId]: [...currentSelection, exerciseId] };
        }
    });
  };

  const handleGroupOrUngroupSuperset = (blockId: string) => {
    const selectedIds = selectedExercisesForSuperset[blockId] || [];
    if (selectedIds.length < 2) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const selectedExercisesInBlock = block.exercises.filter(ex => selectedIds.includes(ex.id));
    
    // Determine if it's a group or ungroup action
    const firstSelectedSupersetId = selectedExercisesInBlock[0].supersetIdentifier;
    const allSelectedShareSameId = selectedExercisesInBlock.every(ex => ex.supersetIdentifier && ex.supersetIdentifier === firstSelectedSupersetId);
    
    let isUngroupAction = false;
    if (allSelectedShareSameId && firstSelectedSupersetId) {
        // Check if these selected exercises form the *entire* superset
        const countOfThisSupersetInBlock = block.exercises.filter(ex => ex.supersetIdentifier === firstSelectedSupersetId).length;
        if (countOfThisSupersetInBlock === selectedIds.length) {
            isUngroupAction = true;
        }
    }

    setBlocks(prevBlocks => prevBlocks.map(b => {
        if (b.id === blockId) {
            let newSupersetIdForGrouping: string | undefined = undefined;
            if (!isUngroupAction) {
                newSupersetIdForGrouping = crypto.randomUUID();
            }
            return {
                ...b,
                exercises: b.exercises.map(ex => {
                    if (selectedIds.includes(ex.id)) {
                        return { ...ex, supersetIdentifier: isUngroupAction ? undefined : newSupersetIdForGrouping };
                    }
                    return ex;
                })
            };
        }
        return b;
    }));
    setSelectedExercisesForSuperset(prev => ({ ...prev, [blockId]: [] })); // Clear selection
  };


  const handleSubmit = () => {
    setIsSaving(true);
    setHasSaved(false);

    if (title.trim() === '' || !category) {
      alert('Titel och kategori för passet måste anges.');
      setIsSaving(false);
      return;
    }
    if (category === 'PT-bas' && !intensityLevel) {
      alert('För PT-bas pass måste en intensitetsnivå väljas.');
      setIsSaving(false);
      return;
    }
    if (!(workoutToEdit && workoutToEdit.isModifiable)) {
      const activeBlocks = blocks.filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));
      if (activeBlocks.length === 0 || activeBlocks.every(b => b.exercises.length === 0)) {
        alert('Minst en övning måste läggas till i passet, inom ett block.');
        setIsSaving(false);
        return;
      }
    }

    const finalBlocks = blocks.map(b => ({
        ...b,
        id: b.id || crypto.randomUUID(),
        name: b.name || "", 
        isQuickLogEnabled: b.isQuickLogEnabled || false,
        exercises: (b.exercises || []).map(ex => ({
            ...ex,
            supersetIdentifier: ex.supersetIdentifier || undefined,
            isBodyweight: ex.isBodyweight || false, // Ensure isBodyweight is carried over
        }))
    })).filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));


    if (workoutToEdit && onUpdateWorkout) {
      const updatedWorkout: Workout = {
        ...workoutToEdit,
        title,
        category,
        coachNote: coachNote.trim() || undefined,
        blocks: finalBlocks,
        intensityLevel: category === 'PT-bas' && intensityLevel ? intensityLevel : undefined,
        intensityInstructions: category === 'PT-bas' && intensityLevel ? intensityInstructions.trim() || undefined : undefined,
      };
      onUpdateWorkout(updatedWorkout);
    } else {
      const newWorkout: Workout = {
        id: crypto.randomUUID(),
        title,
        category,
        coachNote: coachNote.trim() || undefined,
        blocks: finalBlocks,
        isPublished: false, 
        intensityLevel: category === 'PT-bas' && intensityLevel ? intensityLevel : undefined,
        intensityInstructions: category === 'PT-bas' && intensityLevel ? intensityInstructions.trim() || undefined : undefined,
      };
      onSaveWorkout(newWorkout);
    }
    
    setHasSaved(true);
    setTimeout(() => {
        onClose();
    }, 1500);
  };
  
  const modalTitle = workoutToEdit ? "Redigera Pass" : "Nytt Pass";
  let saveButtonTextContent = workoutToEdit ? "Spara Ändringar" : "Spara Pass";
  if (isSaving && !hasSaved) saveButtonTextContent = "Sparar...";
  if (hasSaved) saveButtonTextContent = "Sparat! ✓";


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-6">
        <Input
          label="Passtitel"
          name="workoutTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="T.ex. Vecka 1 – Styrka"
          required
        />
        <Select
          label="Kategori *"
          name="workoutCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value as WorkoutCategory)}
          options={WORKOUT_CATEGORY_OPTIONS}
          required
        />

        {category === 'PT-bas' && (
          <div className="space-y-3 p-3 border rounded-md bg-gray-50">
            <h4 className="text-lg font-semibold text-gray-700">Intensitet för PT-Bas (Månadsfokus)</h4>
            <Select
              label="Välj Intensitet *"
              name="intensityLevel"
              value={intensityLevel}
              onChange={(e) => handleIntensityLevelChange(e.target.value as IntensityLevel | '')}
              options={INTENSITY_LEVEL_OPTIONS_FOR_SELECT}
              required
            />
            {intensityLevel && (
              <Textarea
                label="Instruktioner för Intensitet"
                name="intensityInstructions"
                value={intensityInstructions}
                onChange={(e) => setIntensityInstructions(e.target.value)}
                placeholder="Beskriv fokus för denna intensitetsnivå..."
                rows={3}
              />
            )}
          </div>
        )}

        <Textarea
          label="Coachanteckning till Medlem (valfri)"
          name="coachNote"
          value={coachNote}
          onChange={(e) => setCoachNote(e.target.value)}
          placeholder="T.ex. Fokusera på tekniken i baslyften denna vecka! Ta det lugnt vid behov."
          rows={2}
        />

        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-xl font-semibold text-gray-700">Block</h4>
          {blocks.map((block, blockIndex) => {
            const currentNewExerciseForm = newExerciseForms[block.id] || { ...initialNewExerciseFormState };
            const isNameReadOnly = !!currentNewExerciseForm.primaryLiftSelection;
            const selectedIdsInBlock = selectedExercisesForSuperset[block.id] || [];
            let supersetButtonText = "Gruppera till Superset";
            let canGroupOrUngroup = selectedIdsInBlock.length >= 2;

            if (canGroupOrUngroup) {
                const selectedExercisesInBlock = block.exercises.filter(ex => selectedIdsInBlock.includes(ex.id));
                const firstSelectedSupersetId = selectedExercisesInBlock[0].supersetIdentifier;
                const allSelectedShareSameId = selectedExercisesInBlock.every(ex => ex.supersetIdentifier && ex.supersetIdentifier === firstSelectedSupersetId);
                if (allSelectedShareSameId && firstSelectedSupersetId) {
                    const countOfThisSupersetInBlock = block.exercises.filter(ex => ex.supersetIdentifier === firstSelectedSupersetId).length;
                    if (countOfThisSupersetInBlock === selectedIdsInBlock.length) {
                        supersetButtonText = "Dela upp Superset";
                    }
                }
            }


            return (
                <div key={block.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex justify-between items-center">
                        <Input
                            label={`Block ${blockIndex + 1} Namn (valfritt)`}
                            name={`blockName-${block.id}`}
                            value={block.name || ''}
                            onChange={(e) => handleBlockNameChange(block.id, e.target.value)}
                            placeholder={`T.ex. Block A, Uppvärmning`}
                            inputSize="sm"
                        />
                        {blocks.length > 1 && (
                            <Button onClick={() => handleRemoveBlock(block.id)} variant="danger" size="sm" className="ml-2 mt-5 self-start">Ta bort block</Button>
                        )}
                    </div>

                    <div className="flex items-center">
                      <input
                          type="checkbox"
                          id={`quick-log-toggle-${block.id}`}
                          checked={block.isQuickLogEnabled || false}
                          onChange={(e) => handleBlockQuickLogToggle(block.id, e.target.checked)}
                          className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                      />
                      <label htmlFor={`quick-log-toggle-${block.id}`} className="ml-2 text-base text-gray-700">
                          Aktivera snabbloggning för detta block (för AMRAPs/Finishers)
                      </label>
                    </div>

                    {block.exercises.length > 0 && (
                        <div className="space-y-1">
                            <h5 className="text-lg font-medium text-gray-600 mb-2">Övningar i blocket:</h5>
                            {block.exercises.map((ex, exIndex) => {
                                const currentSupersetId = ex.supersetIdentifier;
                                const nextExercise = block.exercises[exIndex + 1];
                                const isLinkedWithNext = currentSupersetId && nextExercise && nextExercise.supersetIdentifier === currentSupersetId;
                                const isFirstInSupersetChain = currentSupersetId && (!block.exercises[exIndex - 1] || block.exercises[exIndex - 1].supersetIdentifier !== currentSupersetId);
                                const isLastInSupersetChain = currentSupersetId && (!nextExercise || nextExercise.supersetIdentifier !== currentSupersetId);
                                
                                let supersetBorderStyle = "";
                                if (currentSupersetId) {
                                    supersetBorderStyle = "border-l-4 border-blue-400 pl-3";
                                    if (isFirstInSupersetChain) supersetBorderStyle += " rounded-l-md";
                                    // No specific end style needed if each card has its own border
                                }


                                return (
                                    <div key={ex.id} className={`py-1.5 ${supersetBorderStyle}`}>
                                        <div className={`p-2.5 bg-white rounded-md border flex justify-between items-start ${selectedIdsInBlock.includes(ex.id) ? 'ring-2 ring-blue-500' : ''}`}>
                                            <div className="flex items-start flex-grow">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIdsInBlock.includes(ex.id)}
                                                    onChange={() => handleToggleExerciseForSuperset(block.id, ex.id)}
                                                    className="mr-2 mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    aria-label={`Välj övning ${ex.name} för superset`}
                                                />
                                                <div className="flex-grow">
                                                    <p className="text-base font-medium text-gray-800">{exIndex + 1}. {ex.name} {ex.isBodyweight && <span className="text-xs text-green-600">(KV)</span>}</p>
                                                    {ex.notes && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap">Anteckning: {ex.notes}</p>}
                                                    {ex.baseLiftType && <p className="text-sm text-flexibel mt-0.5">Baslyft: {ex.baseLiftType}</p>}
                                                </div>
                                            </div>
                                            <Button onClick={() => handleRemoveExerciseFromBlock(block.id, ex.id)} variant="danger" size="sm" className="ml-2 flex-shrink-0 !py-1 !px-1.5 text-xs">Ta bort</Button>
                                        </div>
                                         {isLinkedWithNext && (
                                            <div className="flex justify-center items-center my-1" aria-hidden="true">
                                                <LinkIcon />
                                                <span className="text-xs text-blue-500 ml-1">Superset</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                             {selectedIdsInBlock.length >= 2 && (
                                <Button onClick={() => handleGroupOrUngroupSuperset(block.id)} variant="outline" size="sm" className="mt-2">
                                    {supersetButtonText} ({selectedIdsInBlock.length} valda)
                                </Button>
                            )}
                        </div>
                    )}
                    {block.exercises.length === 0 && <p className="text-base text-gray-500">Inga övningar i detta block än.</p>}

                    <div className="space-y-2 p-3 border rounded-md bg-white mt-3">
                        <h6 className="text-lg font-semibold text-gray-600">Lägg till övning i detta block</h6>
                        <Select
                            label="Välj övning från lista (valfritt)"
                            name={`newExPrimarySelection-${block.id}`}
                            value={currentNewExerciseForm.primaryLiftSelection}
                            onChange={(e) => handleNewExerciseInputChange(block.id, 'primaryLiftSelection', e.target.value as LiftType | '')}
                            options={PRIMARY_EXERCISE_SELECTION_OPTIONS}
                            inputSize="sm"
                        />
                        <Input
                            label="Namn på övning"
                            name={`newExName-${block.id}`}
                            value={currentNewExerciseForm.name}
                            onChange={(e) => handleNewExerciseInputChange(block.id, 'name', e.target.value)}
                            placeholder={isNameReadOnly ? "" : "T.ex. Special Knäböj (fritext)"}
                            inputSize="sm"
                            readOnly={isNameReadOnly}
                            required
                        />
                        <Textarea
                            label="Anteckning (valfri)"
                            name={`newExNotes-${block.id}`}
                            value={currentNewExerciseForm.notes}
                            onChange={(e) => handleNewExerciseInputChange(block.id, 'notes', e.target.value)}
                            placeholder="T.ex. 3 set x 8-10 reps, med fokus på explosivitet"
                            rows={2}
                            className="text-base"
                        />
                        <div className="flex items-center mt-2">
                            <input
                                type="checkbox"
                                id={`newExIsBodyweight-${block.id}`}
                                name={`newExIsBodyweight-${block.id}`}
                                checked={currentNewExerciseForm.isBodyweight}
                                onChange={(e) => handleNewExerciseInputChange(block.id, 'isBodyweight', e.target.checked)}
                                className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                            />
                            <label htmlFor={`newExIsBodyweight-${block.id}`} className="ml-2 text-base text-gray-700">
                                Kroppsviktsövning (vikt kan fortfarande loggas)
                            </label>
                        </div>
                        <Button 
                            onClick={() => handleAddExerciseToBlock(block.id)} 
                            variant="secondary" 
                            size="sm"
                            fullWidth 
                            className="mt-3"
                            disabled={!currentNewExerciseForm.name.trim()}
                        >
                            Lägg till övning i block
                        </Button>
                    </div>
                </div>
            )
          })}
          {blocks.length === 0 && <p className="text-base text-gray-500">Inga block tillagda än.</p>}
          <Button onClick={handleAddBlock} variant="outline" fullWidth>
            Lägg till nytt block
          </Button>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
          <Button onClick={handleSubmit} variant="primary" disabled={isSaving}>{saveButtonTextContent}</Button>
        </div>
      </div>
    </Modal>
  );
};