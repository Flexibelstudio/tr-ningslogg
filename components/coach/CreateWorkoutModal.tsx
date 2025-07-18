

import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { Workout, Exercise, LiftType, WorkoutCategory, WorkoutBlock, IntensityLevel, LoggableMetric } from '../../types';
import { WORKOUT_CATEGORY_OPTIONS, INTENSITY_LEVELS, ALL_LIFT_TYPES } from '../../constants';

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveWorkout: (workout: Workout) => void;
  workoutToEdit?: Workout | null;
  onUpdateWorkout?: (workout: Workout) => void;
}

const LOGGABLE_METRICS_OPTIONS: { id: LoggableMetric, label: string }[] = [
    { id: 'reps', label: 'Reps' },
    { id: 'weight', label: 'Vikt (kg)' },
    { id: 'distance', label: 'Distans (m)' },
    { id: 'duration', label: 'Tid (sek)' },
    { id: 'calories', label: 'Kalorier (kcal)' },
];


interface NewExerciseFormState {
  primaryLiftSelection: LiftType | '';
  name: string;
  notes: string;
  isBodyweight: boolean;
  loggableMetrics: LoggableMetric[];
}

const PRIMARY_EXERCISE_SELECTION_OPTIONS = [
  { value: '', label: 'Skriv egen övning...' },
  ...ALL_LIFT_TYPES.map(lift => ({ value: lift, label: lift })),
];

const DEFAULT_LOGGABLE_METRICS: LoggableMetric[] = ['reps', 'weight'];

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
    isBodyweight: false,
    loggableMetrics: DEFAULT_LOGGABLE_METRICS,
  };
  const [newExerciseForm, setNewExerciseForm] = useState<NewExerciseFormState>({ ...initialNewExerciseFormState });
  const [addingExerciseToBlock, setAddingExerciseToBlock] = useState<string | null>(null);

  const [intensityLevel, setIntensityLevel] = useState<IntensityLevel | ''>('');
  const [intensityInstructions, setIntensityInstructions] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  // State for selecting exercises for superset
  const [selectedExercises, setSelectedExercises] = useState<Record<string, string[]>>({});


  const resetForm = () => {
    setTitle('');
    setCategory('PT-bas');
    setCoachNote('');
    setBlocks([{ id: crypto.randomUUID(), name: '', exercises: [] }]);
    setNewExerciseForm({ ...initialNewExerciseFormState });
    setIntensityLevel('');
    setIntensityInstructions('');
    setAddingExerciseToBlock(null);
    setIsSaving(false);
    setHasSaved(false);
    setSelectedExercises({});
  };

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
      setAddingExerciseToBlock(null);
      setSelectedExercises({});

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
        
        const blocksFromTemplate = workoutToEdit.blocks && workoutToEdit.blocks.length > 0 
          ? workoutToEdit.blocks 
          : [{ id: crypto.randomUUID(), name: '', exercises: [] }];

        const sanitizedBlocks = blocksFromTemplate.map(block => ({
            ...block,
            id: block.id || crypto.randomUUID(),
            isQuickLogEnabled: block.isQuickLogEnabled || false,
            exercises: (block.exercises || []).map(ex => ({ 
              ...ex, 
              id: ex.id || crypto.randomUUID(),
              supersetIdentifier: ex.supersetIdentifier || undefined,
              isBodyweight: ex.isBodyweight || false,
              loggableMetrics: ex.loggableMetrics?.length ? ex.loggableMetrics : DEFAULT_LOGGABLE_METRICS,
            }))
        }));
        setBlocks(sanitizedBlocks);

      } else {
        resetForm();
      }
    }
  }, [isOpen, workoutToEdit]);

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
    setBlocks([...blocks, { id: crypto.randomUUID(), name: '', exercises: [], isQuickLogEnabled: false }]);
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    if (addingExerciseToBlock === blockId) {
        setAddingExerciseToBlock(null);
    }
  };

  const handleBlockNameChange = (blockId: string, name: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, name } : b));
  };

  const handleBlockQuickLogToggle = (blockId: string, isEnabled: boolean) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, isQuickLogEnabled: isEnabled } : b));
  };
  
  const handleNewExerciseInputChange = (field: keyof Omit<NewExerciseFormState, 'loggableMetrics'>, value: string | LiftType | boolean) => {
    let updatedFormState = { ...newExerciseForm, [field]: value };
    if (field === 'primaryLiftSelection') {
      const selectedLift = value as LiftType | '';
      if (selectedLift) updatedFormState.name = selectedLift;
    } else if (field === 'name' && typeof value === 'string' && newExerciseForm.primaryLiftSelection && value !== newExerciseForm.primaryLiftSelection) {
      updatedFormState.primaryLiftSelection = '';
    }
    setNewExerciseForm(updatedFormState);
  };

  const handleMetricToggle = (metric: LoggableMetric) => {
    const currentMetrics = newExerciseForm.loggableMetrics || [];
    let newMetrics: LoggableMetric[];
    if (currentMetrics.includes(metric)) {
        newMetrics = currentMetrics.filter(m => m !== metric);
    } else {
        newMetrics = [...currentMetrics, metric];
    }
    setNewExerciseForm(prev => ({ ...prev, loggableMetrics: newMetrics }));
  };
  
  const handleOpenAddExerciseForm = (blockId: string) => {
    setAddingExerciseToBlock(blockId);
    setNewExerciseForm({ ...initialNewExerciseFormState });
  }

  const handleAddExerciseToBlock = () => {
    if (!addingExerciseToBlock || newExerciseForm.name.trim() === '') return;
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name: newExerciseForm.name.trim(),
      notes: newExerciseForm.notes.trim(),
      baseLiftType: newExerciseForm.primaryLiftSelection || undefined,
      isBodyweight: newExerciseForm.isBodyweight,
      loggableMetrics: newExerciseForm.loggableMetrics.length > 0 ? newExerciseForm.loggableMetrics : DEFAULT_LOGGABLE_METRICS,
    };
    setBlocks(prevBlocks => prevBlocks.map(b => b.id === addingExerciseToBlock ? { ...b, exercises: [...b.exercises, newExercise] } : b));
    setAddingExerciseToBlock(null);
  };

  const handleRemoveExerciseFromBlock = (blockId: string, exerciseId: string) => {
    setBlocks(prevBlocks => prevBlocks.map(b =>
      b.id === blockId ? { ...b, exercises: b.exercises.filter(ex => ex.id !== exerciseId) } : b
    ));
  };

  // Superset Handlers
  const handleExerciseSelectionToggle = (blockId: string, exerciseId: string) => {
    setSelectedExercises(prev => {
        const blockSelections = prev[blockId] ? [...prev[blockId]] : [];
        const index = blockSelections.indexOf(exerciseId);
        if (index > -1) {
            blockSelections.splice(index, 1);
        } else {
            blockSelections.push(exerciseId);
        }
        return { ...prev, [blockId]: blockSelections };
    });
  };

  const handleSupersetAction = (blockId: string) => {
    const selectedIds = selectedExercises[blockId] || [];
    if (selectedIds.length < 2) return;

    setBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        const blockIndex = newBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) return prevBlocks;

        const block = { ...newBlocks[blockIndex] };
        let newExercises = [...block.exercises];

        const selectedExs = newExercises.filter(ex => selectedIds.includes(ex.id));
        const firstSupersetId = selectedExs[0]?.supersetIdentifier;
        const allInSameSuperset = selectedExs.every(ex => ex.supersetIdentifier && ex.supersetIdentifier === firstSupersetId);

        if (allInSameSuperset) {
            // UNGROUP ACTION
            newExercises = newExercises.map(ex => 
                selectedIds.includes(ex.id) ? { ...ex, supersetIdentifier: undefined } : ex
            );
        } else {
            // GROUP ACTION
            const newSupersetId = crypto.randomUUID();
            const oldSupersetIds = new Set<string>(
                selectedExs.map(ex => ex.supersetIdentifier).filter((id): id is string => !!id)
            );

            newExercises = newExercises.map(ex => 
                selectedIds.includes(ex.id) ? { ...ex, supersetIdentifier: newSupersetId } : ex
            );
            
            oldSupersetIds.forEach(oldId => {
                const remainingInOldSuperset = newExercises.filter(ex => ex.supersetIdentifier === oldId);
                if (remainingInOldSuperset.length === 1) {
                    newExercises = newExercises.map(ex => 
                        ex.id === remainingInOldSuperset[0].id ? { ...ex, supersetIdentifier: undefined } : ex
                    );
                }
            });
        }
        
        block.exercises = newExercises;
        newBlocks[blockIndex] = block;
        return newBlocks;
    });

    setSelectedExercises(prev => ({ ...prev, [blockId]: [] }));
  };


  const handleSubmit = () => {
    setIsSaving(true);
    setHasSaved(false);
    if (title.trim() === '' || !category) { alert('Titel och kategori för passet måste anges.'); setIsSaving(false); return; }
    if (category === 'PT-bas' && !intensityLevel) { alert('För PT-bas pass måste en intensitetsnivå väljas.'); setIsSaving(false); return; }
    if (!(workoutToEdit && workoutToEdit.isModifiable)) {
      const activeBlocks = blocks.filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));
      if (activeBlocks.length === 0 || activeBlocks.every(b => b.exercises.length === 0)) { alert('Minst en övning måste läggas till i passet, inom ett block.'); setIsSaving(false); return; }
    }
    const finalBlocks = blocks.map(b => ({
        ...b,
        id: b.id || crypto.randomUUID(), name: b.name || "", isQuickLogEnabled: b.isQuickLogEnabled || false,
        exercises: (b.exercises || []).map(ex => ({ ...ex, supersetIdentifier: ex.supersetIdentifier || undefined, isBodyweight: ex.isBodyweight || false, loggableMetrics: ex.loggableMetrics?.length ? ex.loggableMetrics : DEFAULT_LOGGABLE_METRICS,}))
    })).filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));
    if (workoutToEdit && onUpdateWorkout) {
      onUpdateWorkout({ ...workoutToEdit, title, category, coachNote: coachNote.trim() || undefined, blocks: finalBlocks, intensityLevel: category === 'PT-bas' && intensityLevel ? intensityLevel : undefined, intensityInstructions: category === 'PT-bas' && intensityLevel ? intensityInstructions.trim() || undefined : undefined });
    } else {
      onSaveWorkout({ id: crypto.randomUUID(), title, category, coachNote: coachNote.trim() || undefined, blocks: finalBlocks, isPublished: false, intensityLevel: category === 'PT-bas' && intensityLevel ? intensityLevel : undefined, intensityInstructions: category === 'PT-bas' && intensityLevel ? intensityInstructions.trim() || undefined : undefined });
    }
    setHasSaved(true);
    setTimeout(() => { onClose(); }, 1500);
  };
  
  const modalTitle = workoutToEdit ? "Redigera Pass" : "Nytt Pass";
  let saveButtonTextContent = workoutToEdit ? "Spara Ändringar" : "Spara Pass";
  if (isSaving && !hasSaved) saveButtonTextContent = "Sparar...";
  if (hasSaved) saveButtonTextContent = "Sparat! ✓";

  const renderExerciseCard = (ex: Exercise, block: WorkoutBlock) => {
    const isSelected = selectedExercises[block.id]?.includes(ex.id) || false;
    return (
      <div
        key={ex.id}
        className={`p-2.5 bg-white rounded-md border flex items-start transition-all ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
      >
        <label htmlFor={`select-ex-${ex.id}`} className="flex-grow flex items-start cursor-pointer">
            <input
                id={`select-ex-${ex.id}`}
                type="checkbox"
                checked={isSelected}
                onChange={() => handleExerciseSelectionToggle(block.id, ex.id)}
                className="h-5 w-5 text-flexibel rounded border-gray-300 focus:ring-flexibel mr-3 mt-1 shrink-0"
            />
            <div className="flex-grow">
              <p className="text-base font-medium text-gray-800">{ex.name} {ex.isBodyweight && <span className="text-xs text-green-600">(KV)</span>}</p>
              {ex.notes && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap">Anteckning: {ex.notes}</p>}
              {ex.baseLiftType && <p className="text-sm text-flexibel mt-0.5">Baslyft: {ex.baseLiftType}</p>}
              {(ex.loggableMetrics && ex.loggableMetrics.length > 0) && <p className="text-xs text-gray-400 mt-0.5">Loggas med: {ex.loggableMetrics.join(', ')}</p>}
            </div>
        </label>
        <Button onClick={() => handleRemoveExerciseFromBlock(block.id, ex.id)} variant="danger" size="sm" className="ml-2 flex-shrink-0 !py-1 !px-1.5 text-xs">Ta bort</Button>
      </div>
    );
  };

  const isNameReadOnly = !!newExerciseForm.primaryLiftSelection;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="3xl">
      <div className="flex flex-col md:flex-row gap-6">
        {/* LEFT PANEL: FORMS */}
        <div className="md:w-2/5 flex-shrink-0 space-y-4">
          <Input label="Passtitel *" name="workoutTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. Vecka 1 – Styrka" required />
          <Select label="Kategori *" name="workoutCategory" value={category} onChange={(e) => setCategory(e.target.value as WorkoutCategory)} options={WORKOUT_CATEGORY_OPTIONS} required />
          {category === 'PT-bas' && (
            <div className="space-y-3 p-3 border rounded-md bg-gray-50">
              <h4 className="text-lg font-semibold text-gray-700">Intensitet för PT-Bas</h4>
              <div className="space-y-1">
                <label id="intensity-label" className="block text-base font-medium text-gray-700 mb-1">Välj Intensitet *</label>
                <div role="radiogroup" aria-labelledby="intensity-label" className="grid grid-cols-1 gap-2">
                  {INTENSITY_LEVELS.map(level => {
                    const isSelected = intensityLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleIntensityLevelChange(intensityLevel === level.value ? '' : level.value as IntensityLevel)}
                        className={`w-full text-left p-3 rounded-lg border-2 text-base font-semibold transition-all duration-150 flex items-center justify-between ${
                          isSelected
                            ? level.twClass
                            : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center">
                            <span
                              className="inline-block h-4 w-4 rounded-full mr-3 flex-shrink-0"
                              style={{ backgroundColor: level.color }}
                            ></span>
                            <span>{level.label}</span>
                        </div>
                        {isSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-current flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {intensityLevel && <Textarea label="Instruktioner för Intensitet" name="intensityInstructions" value={intensityInstructions} onChange={(e) => setIntensityInstructions(e.target.value)} placeholder="Beskriv fokus..." rows={3} />}
            </div>
          )}
          <Textarea label="Coachanteckning till Medlem (valfri)" name="coachNote" value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="T.ex. Fokusera på tekniken..." rows={2} />
          
          {addingExerciseToBlock && (
            <div className="space-y-3 p-3 border-t-2 border-dashed rounded-md bg-white mt-4 animate-fade-in-down">
              <h6 className="text-lg font-semibold text-gray-600">Ny Övning för Block {blocks.findIndex(b => b.id === addingExerciseToBlock) + 1}</h6>
              <Select label="Välj övning från lista (valfritt)" name={`newExPrimarySelection`} value={newExerciseForm.primaryLiftSelection} onChange={(e) => handleNewExerciseInputChange('primaryLiftSelection', e.target.value as LiftType | '')} options={PRIMARY_EXERCISE_SELECTION_OPTIONS} inputSize="sm" />
              <Input label="Namn på övning" name={`newExName`} value={newExerciseForm.name} onChange={(e) => handleNewExerciseInputChange('name', e.target.value)} placeholder={isNameReadOnly ? "" : "T.ex. Special Knäböj"} inputSize="sm" readOnly={isNameReadOnly} required />
              <Textarea label="Anteckning (valfri)" name={`newExNotes`} value={newExerciseForm.notes} onChange={(e) => handleNewExerciseInputChange('notes', e.target.value)} placeholder="T.ex. 3 set x 8-10 reps" rows={2} className="text-base" />
              <div className="flex items-center pt-2">
                  <input type="checkbox" id={`newExIsBodyweight`} name={`newExIsBodyweight`} checked={newExerciseForm.isBodyweight} onChange={(e) => handleNewExerciseInputChange('isBodyweight', e.target.checked)} className="h-4 w-4 text-flexibel" />
                  <label htmlFor={`newExIsBodyweight`} className="ml-2 text-base text-gray-700">Kroppsviktsövning</label>
              </div>
              <div className="pt-2 space-y-1">
                  <label className="text-base font-medium text-gray-700">Loggningsbara fält:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{LOGGABLE_METRICS_OPTIONS.map(metricOpt => (<label key={metricOpt.id} className="flex items-center space-x-2 p-1"><input type="checkbox" checked={newExerciseForm.loggableMetrics.includes(metricOpt.id)} onChange={() => handleMetricToggle(metricOpt.id)} className="h-4 w-4 text-flexibel" /><span className="text-sm text-gray-700">{metricOpt.label}</span></label>))}</div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t mt-2">
                   <Button onClick={() => setAddingExerciseToBlock(null)} variant="ghost" size="sm">Avbryt</Button>
                  <Button onClick={handleAddExerciseToBlock} variant="secondary" size="sm" disabled={!newExerciseForm.name.trim()}>Lägg till övning</Button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: PREVIEW */}
        <div className="md:w-3/5 flex-1 space-y-4 max-h-[75vh] min-h-[50vh] overflow-y-auto bg-gray-100 p-4 rounded-lg">
          <h4 className="text-xl font-semibold text-gray-700">Struktur & Förhandsgranskning</h4>
          <p className="text-sm text-gray-500 -mt-3">Markera övningar och klicka på knappen för att skapa ett superset.</p>
          {blocks.map((block, blockIndex) => {
            const groupedExercises = [];
            const processedIds = new Set();
            if(block.exercises) {
                block.exercises.forEach(ex => {
                    if (processedIds.has(ex.id)) return;
                    if (ex.supersetIdentifier) {
                        const supersetGroup = block.exercises.filter(e => e.supersetIdentifier === ex.supersetIdentifier);
                        groupedExercises.push({ type: 'superset', exercises: supersetGroup, id: ex.supersetIdentifier });
                        supersetGroup.forEach(e => processedIds.add(e.id));
                    } else {
                        groupedExercises.push({ type: 'single', exercise: ex, id: ex.id });
                        processedIds.add(ex.id);
                    }
                });
            }
            const numSelectedInBlock = selectedExercises[block.id]?.length || 0;
            return (
              <div key={block.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 mt-4 first:mt-0">
                <div className="flex justify-between items-center gap-4">
                  <Input label={`Block ${blockIndex + 1}`} name={`blockName-${block.id}`} value={block.name || ''} onChange={(e) => handleBlockNameChange(block.id, e.target.value)} placeholder={`Namn (valfritt)`} inputSize="sm" />
                  {blocks.length > 1 && <Button onClick={() => handleRemoveBlock(block.id)} variant="danger" size="sm" className="ml-2 mt-5 self-start shrink-0">Ta bort</Button>}
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id={`quick-log-${block.id}`} checked={block.isQuickLogEnabled || false} onChange={(e) => handleBlockQuickLogToggle(block.id, e.target.checked)} className="h-4 w-4 text-flexibel" />
                  <label htmlFor={`quick-log-${block.id}`} className="ml-2 text-base text-gray-700">Snabbloggning (för AMRAPs)</label>
                </div>
                
                {groupedExercises.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {groupedExercises.map((group) => {
                      if (group.type === 'superset') {
                        return (
                          <div key={group.id} className="relative p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                            <span className="absolute top-2 right-2 text-xs font-bold text-blue-600 bg-blue-200 px-2 py-0.5 rounded-full">SUPERSET</span>
                            <div className="space-y-2">{group.exercises.map(ex => renderExerciseCard(ex, block))}</div>
                          </div>
                        )
                      } else {
                        return renderExerciseCard(group.exercise, block);
                      }
                    })}
                  </div>
                )}
                {block.exercises.length === 0 && <p className="text-base text-gray-500 text-center py-2">Inga övningar i detta block än.</p>}
                
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => handleOpenAddExerciseForm(block.id)} variant="outline" size="sm" className="w-full">Lägg till övning</Button>
                  <Button 
                      onClick={() => handleSupersetAction(block.id)} 
                      variant="primary" 
                      size="sm" 
                      className="w-full"
                      disabled={numSelectedInBlock < 2}
                      title={numSelectedInBlock < 2 ? "Välj minst 2 övningar för att skapa ett superset" : "Skapa eller dela upp superset"}
                  >
                      Skapa/Dela Superset ({numSelectedInBlock})
                  </Button>
                </div>
              </div>
            )
          })}
          <Button onClick={handleAddBlock} variant="outline" fullWidth>Lägg till nytt block</Button>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
        <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
        <Button onClick={handleSubmit} variant="primary" disabled={isSaving}>{saveButtonTextContent}</Button>
      </div>
    </Modal>
  );
};