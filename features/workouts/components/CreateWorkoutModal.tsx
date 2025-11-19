
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/Modal';
import { Input, Select } from '../../../components/Input';
import { Textarea } from '../../../components/Textarea';
import { Button } from '../../../components/Button';
import { Workout, Exercise, LiftType, WorkoutCategory, WorkoutBlock, LoggableMetric, WorkoutCategoryDefinition, ParticipantProfile, ParticipantGoalData, WorkoutFocusTag } from '../../../types';
import { ALL_LIFT_TYPES, WORKOUT_FOCUS_TAGS } from '../../../constants';
import { AICoachAssistantModal } from './AICoachAssistantModal';
import { WorkoutStructurePanel } from './WorkoutStructurePanel';
import { useAppContext } from '../../../context/AppContext';

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveWorkout: (workout: Workout) => void;
  workoutToEdit?: Workout | null;
  onUpdateWorkout?: (workout: Workout) => void;
  participantToAssign?: ParticipantProfile;
  participantGoal?: ParticipantGoalData | null;
  isOnline: boolean;
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
  notes: string; // Will now be for general instructions
  isBodyweight: boolean;
  loggableMetrics: LoggableMetric[];
  // New target fields
  targetSets: string;
  targetReps: string;
  targetWeight: string;
  targetDistance: string;
  targetDuration: string;
  targetCalories: string;
  targetRest: string;
}

const PRIMARY_EXERCISE_SELECTION_OPTIONS = [
  { value: '', label: 'Skriv egen övning...' },
  ...ALL_LIFT_TYPES.map(lift => ({ value: lift, label: lift })),
];

const DEFAULT_LOGGABLE_METRICS: LoggableMetric[] = ['reps', 'weight'];

interface DragItem {
  type: 'block' | 'exercise';
  index: number;
  blockId?: string;
}

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({ 
    isOpen, 
    onClose, 
    onSaveWorkout, 
    workoutToEdit, 
    onUpdateWorkout,
    participantToAssign,
    participantGoal,
    isOnline,
}) => {
    const { workoutCategories, participantDirectory: participants } = useAppContext();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('');
  const [coachNote, setCoachNote] = useState('');
  const [aiInstruction, setAiInstruction] = useState('');
  const [focusTags, setFocusTags] = useState<WorkoutFocusTag[]>([]);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  
  const initialNewExerciseFormState: NewExerciseFormState = { 
    primaryLiftSelection: '', 
    name: '', 
    notes: '', 
    isBodyweight: false,
    loggableMetrics: DEFAULT_LOGGABLE_METRICS,
    targetSets: '',
    targetReps: '',
    targetWeight: '',
    targetDistance: '',
    targetDuration: '',
    targetCalories: '',
    targetRest: '',
  };
  const [newExerciseForm, setNewExerciseForm] = useState<NewExerciseFormState>({ ...initialNewExerciseFormState });
  
  const [editingState, setEditingState] = useState<{blockId: string, exerciseId?: string} | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  const [selectedExercises, setSelectedExercises] = useState<Record<string, string[]>>({});
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [participantForCopy, setParticipantForCopy] = useState<string>('');
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragItemRef = useRef<DragItem | null>(null);
  const dragOverItemRef = useRef<DragItem | null>(null);


  const isCreatingAssigned = !!participantToAssign;

  const workoutCategoryOptions = workoutCategories.map(c => ({ value: c.name, label: c.name }));

  const resetForm = () => {
    setTitle('');
    setCategory(isCreatingAssigned ? 'Personligt program' : (workoutCategories[0]?.name || 'Annat'));
    setCoachNote('');
    setAiInstruction('');
    setFocusTags([]);
    setBlocks([{ id: crypto.randomUUID(), name: '', exercises: [] }]);
    setNewExerciseForm({ ...initialNewExerciseFormState });
    setEditingState(null);
    setIsSaving(false);
    setHasSaved(false);
    setSelectedExercises({});
  };

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
      setEditingState(null);
      setSelectedExercises({});
      setIsAssignModalOpen(false);
      setParticipantForCopy('');
      setIsAiModalOpen(false);

      if (isCreatingAssigned) {
        resetForm();
      } else if (workoutToEdit) {
        setTitle(workoutToEdit.title);
        const currentCategory = workoutToEdit.category || (workoutCategories[0]?.name || 'Annat');
        setCategory(currentCategory);
        setCoachNote(workoutToEdit.coachNote || '');
        setAiInstruction(workoutToEdit.aiInstruction || '');
        setFocusTags(workoutToEdit.focusTags || []);
        
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
  }, [isOpen, workoutToEdit, workoutCategories, isCreatingAssigned]);

  const handleAddBlock = () => {
    const newBlock = { id: crypto.randomUUID(), name: '', exercises: [], isQuickLogEnabled: false };
    setBlocks([...blocks, newBlock]);
    setTimeout(() => {
        if (blockRefs.current[newBlock.id]) {
            blockRefs.current[newBlock.id]!.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
  };
  
  const handleRemoveBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
    if (editingState?.blockId === blockId) {
        setEditingState(null);
    }
  };

  const handleBlockNameChange = (blockId: string, name: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, name } : b));
  };
  
  const handleBlockQuickLogToggle = (blockId: string, isEnabled: boolean) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, isQuickLogEnabled: isEnabled } : b));
  };
  
  const handleNewExerciseInputChange = (field: keyof NewExerciseFormState, value: string | LiftType | boolean) => {
    let updatedFormState = { ...newExerciseForm, [field]: value };
    if (field === 'primaryLiftSelection') {
      const selectedLift = value as LiftType | '';
      if (selectedLift) updatedFormState.name = selectedLift;
    } else if (field === 'name' && typeof value === 'string' && newExerciseForm.primaryLiftSelection && value !== newExerciseForm.primaryLiftSelection) {
      updatedFormState.primaryLiftSelection = '';
    }
    
    if (field === 'isBodyweight') {
        if (value === true) {
            updatedFormState.loggableMetrics = ['reps'];
        } else {
            updatedFormState.loggableMetrics = DEFAULT_LOGGABLE_METRICS;
        }
    }
    setNewExerciseForm(updatedFormState);
  };

  const handleMetricToggle = (metric: LoggableMetric) => {
    if (newExerciseForm.isBodyweight) return; // Prevent changes if bodyweight is checked

    const currentMetrics = newExerciseForm.loggableMetrics || [];
    let newMetrics: LoggableMetric[];
    if (currentMetrics.includes(metric)) {
        newMetrics = currentMetrics.filter(m => m !== metric);
    } else {
        newMetrics = [...currentMetrics, metric];
    }
    setNewExerciseForm(prev => ({ ...prev, loggableMetrics: newMetrics }));
  };

  const handleStartAddNewExercise = (blockId: string) => {
    setEditingState({ blockId });
    setNewExerciseForm({ ...initialNewExerciseFormState });
  };
  
  const handleStartEditExercise = (blockId: string, exercise: Exercise) => {
    setEditingState({ blockId, exerciseId: exercise.id });
    setNewExerciseForm({
        name: exercise.name,
        notes: exercise.notes,
        primaryLiftSelection: exercise.baseLiftType || '',
        isBodyweight: exercise.isBodyweight || false,
        loggableMetrics: exercise.loggableMetrics || DEFAULT_LOGGABLE_METRICS,
        targetSets: String(exercise.targetSets || ''),
        targetReps: exercise.targetReps || '',
        targetWeight: exercise.targetWeight || '',
        targetDistance: String(exercise.targetDistanceMeters || ''),
        targetDuration: String(exercise.targetDurationSeconds || ''),
        targetCalories: String(exercise.targetCaloriesKcal || ''),
        targetRest: String(exercise.targetRestSeconds || ''),
    });
  };

  const handleSaveExercise = () => {
    if (!editingState || newExerciseForm.name.trim() === '') return;
    const { blockId, exerciseId } = editingState;

    const exerciseData: Omit<Exercise, 'id'> = {
        name: newExerciseForm.name.trim(),
        notes: newExerciseForm.notes.trim(),
        baseLiftType: newExerciseForm.primaryLiftSelection || undefined,
        isBodyweight: newExerciseForm.isBodyweight,
        loggableMetrics: newExerciseForm.loggableMetrics.length > 0 ? newExerciseForm.loggableMetrics : DEFAULT_LOGGABLE_METRICS,
        targetSets: newExerciseForm.targetSets.trim() || undefined,
        targetReps: newExerciseForm.targetReps.trim() || undefined,
        targetWeight: newExerciseForm.targetWeight.trim() || undefined,
        targetDistanceMeters: newExerciseForm.targetDistance.trim() || undefined,
        targetDurationSeconds: newExerciseForm.targetDuration.trim() || undefined,
        targetCaloriesKcal: newExerciseForm.targetCalories.trim() || undefined,
        targetRestSeconds: newExerciseForm.targetRest.trim() || undefined,
    };

    if (exerciseId) { // Update existing exercise
        const updatedExercise: Exercise = { id: exerciseId, ...exerciseData };
        setBlocks(prevBlocks => prevBlocks.map(b => 
            b.id === blockId 
            ? { ...b, exercises: b.exercises.map(ex => ex.id === exerciseId ? updatedExercise : ex) }
            : b
        ));
    } else { // Add new exercise
        const newExercise: Exercise = { id: crypto.randomUUID(), ...exerciseData };
        setBlocks(prevBlocks => prevBlocks.map(b => 
            b.id === blockId 
            ? { ...b, exercises: [...b.exercises, newExercise] } 
            : b
        ));
    }
    setEditingState(null);
  };
  
  const handleRemoveExerciseFromBlock = (blockId: string, exerciseId: string) => {
    setBlocks(prevBlocks => prevBlocks.map(b =>
      b.id === blockId ? { ...b, exercises: b.exercises.filter(ex => ex.id !== exerciseId) } : b
    ));
  };

  // Superset Handlers remain similar
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
            newExercises = newExercises.map(ex => 
                selectedIds.includes(ex.id) ? { ...ex, supersetIdentifier: undefined } : ex
            );
        } else {
            const newSupersetId = crypto.randomUUID();
            const oldSupersetIds = new Set<string>(
                selectedExs.map(ex => ex.supersetIdentifier).filter((id): id is string => !!id)
            );
            
            let updatedExercises = newExercises.map(ex => 
                selectedIds.includes(ex.id) ? { ...ex, supersetIdentifier: newSupersetId } : ex
            );
            
            oldSupersetIds.forEach(oldId => {
                const remainingInOldSuperset = updatedExercises.filter(ex => ex.supersetIdentifier === oldId);
                if (remainingInOldSuperset.length === 1) {
                    updatedExercises = updatedExercises.map(ex => 
                        ex.id === remainingInOldSuperset[0].id ? { ...ex, supersetIdentifier: undefined } : ex
                    );
                }
            });
            newExercises = updatedExercises;
        }
        
        block.exercises = newExercises;
        newBlocks[blockIndex] = block;
        return newBlocks;
    });

    setSelectedExercises(prev => ({ ...prev, [blockId]: [] }));
  };
  
  // Validation and Saving logic remains similar
  const validateForm = () => {
    if (title.trim() === '' || !category) { alert('Titel och kategori för passet måste anges.'); return false; }
    if (!(workoutToEdit && workoutToEdit.isModifiable)) {
      const activeBlocks = blocks.filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));
      if (activeBlocks.length === 0 || activeBlocks.every(b => b.exercises.length === 0)) { alert('Minst en övning måste läggas till i passet, inom ett block.'); return false; }
    }
    return true;
  }

  const buildWorkoutData = (): Omit<Workout, 'id' | 'isPublished'> | null => {
    if (!validateForm()) {
        return null;
    }

    const finalBlocks = blocks.map(b => {
        const blockExercises = (b.exercises || []).map(ex => {
            const newEx: Exercise = {
                id: ex.id || crypto.randomUUID(),
                name: ex.name,
                notes: ex.notes,
                isBodyweight: ex.isBodyweight || false,
                loggableMetrics: ex.loggableMetrics?.length ? ex.loggableMetrics : DEFAULT_LOGGABLE_METRICS,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                targetWeight: ex.targetWeight,
                targetDistanceMeters: ex.targetDistanceMeters,
                targetDurationSeconds: ex.targetDurationSeconds,
                targetCaloriesKcal: ex.targetCaloriesKcal,
                targetRestSeconds: ex.targetRestSeconds,
            };
            if (ex.baseLiftType) newEx.baseLiftType = ex.baseLiftType;
            if (ex.supersetIdentifier) newEx.supersetIdentifier = ex.supersetIdentifier;
            return newEx;
        });

        const newBlock: WorkoutBlock = {
            id: b.id || crypto.randomUUID(),
            name: b.name || "",
            isQuickLogEnabled: b.isQuickLogEnabled || false,
            exercises: blockExercises
        };
        return newBlock;

    }).filter(b => b.exercises.length > 0 || (b.name && b.name.trim() !== ''));
    
    const workoutData: Omit<Workout, 'id' | 'isPublished'> = {
        title,
        category,
        blocks: finalBlocks,
        focusTags: focusTags,
    };

    if (coachNote.trim()) {
        workoutData.coachNote = coachNote.trim();
    }
    if (aiInstruction.trim()) {
        workoutData.aiInstruction = aiInstruction.trim();
    }

    return workoutData;
  };

  const handleFocusTagChange = (tag: WorkoutFocusTag) => {
    setFocusTags(prev => 
        prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
};

  const handleSaveTemplate = () => {
    setIsSaving(true);
    setHasSaved(false);
    const workoutData = buildWorkoutData();
    if (!workoutData) {
        setIsSaving(false);
        return;
    }

    if (workoutToEdit && onUpdateWorkout) {
      onUpdateWorkout({ ...workoutToEdit, ...workoutData });
    } else {
      onSaveWorkout({ id: crypto.randomUUID(), ...workoutData, isPublished: false });
    }
    setHasSaved(true);
    setTimeout(() => { onClose(); }, 800);
  };
  
  const handleSaveAssignedCopy = () => {
    if (!participantForCopy) {
      alert('Välj en medlem att tilldela passet till.');
      return;
    }
    setIsSaving(true);
    setHasSaved(false);

    const workoutData = buildWorkoutData();
    if (!workoutData) {
        setIsSaving(false);
        return;
    }
    
    const assignedWorkout: Workout = {
        id: crypto.randomUUID(),
        ...workoutData,
        isPublished: false, // Assigned workouts are not "published" templates
        assignedToParticipantId: participantForCopy,
    };
    onSaveWorkout(assignedWorkout);
    setHasSaved(true);
    setTimeout(() => {
        setIsAssignModalOpen(false);
        onClose(); 
    }, 800);
  };
  
  const handleSaveDirectAssigned = () => {
    if (!participantToAssign) return;

    setIsSaving(true);
    setHasSaved(false);

    const workoutData = buildWorkoutData();
    if (!workoutData) {
        setIsSaving(false);
        return;
    }

    const assignedWorkout: Workout = {
        id: crypto.randomUUID(),
        ...workoutData,
        isPublished: false,
        assignedToParticipantId: participantToAssign.id,
    };
    onSaveWorkout(assignedWorkout);
    setHasSaved(true);
    setTimeout(() => { onClose(); }, 800);
  };
  
  const handleAcceptAiSuggestion = (suggestion: { title: string, coachNote?: string, blocksData: WorkoutBlock[] }) => {
    setTitle(suggestion.title);
    setCoachNote(suggestion.coachNote || '');
    setBlocks(suggestion.blocksData);
    setIsAiModalOpen(false);
  };

    const handleBlockClick = (blockId: string) => {
        if (blockRefs.current[blockId]) {
            blockRefs.current[blockId]!.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleExerciseClick = (exerciseId: string, blockId: string) => {
        handleBlockClick(blockId);
    };

    const handleSort = () => {
        if (!dragItemRef.current || !dragOverItemRef.current) return;
    
        const draggedItem = dragItemRef.current;
        const dropTarget = dragOverItemRef.current;
        
        // Prevent dropping on itself
        if (draggedItem.type === 'block' && dropTarget.type === 'block' && draggedItem.index === dropTarget.index) return;
        if (draggedItem.type === 'exercise' && dropTarget.type === 'exercise' && draggedItem.blockId === dropTarget.blockId && draggedItem.index === dropTarget.index) return;

        const newBlocks = JSON.parse(JSON.stringify(blocks));
    
        // Case 1: Moving a block
        if (draggedItem.type === 'block' && dropTarget.type === 'block') {
            const draggedBlock = newBlocks.splice(draggedItem.index, 1)[0];
            newBlocks.splice(dropTarget.index, 0, draggedBlock);
            setBlocks(newBlocks);
        }
        
        // Case 2: Moving an exercise
        if (draggedItem.type === 'exercise') {
            const sourceBlockIndex = newBlocks.findIndex((b: WorkoutBlock) => b.id === draggedItem.blockId);
            if (sourceBlockIndex === -1) return;
    
            // Remove exercise from source
            const [draggedExercise] = newBlocks[sourceBlockIndex].exercises.splice(draggedItem.index, 1);
            
            // Add exercise to destination
            if (dropTarget.type === 'exercise') {
                const destBlockIndex = newBlocks.findIndex((b: WorkoutBlock) => b.id === dropTarget.blockId);
                if (destBlockIndex === -1) return;
                newBlocks[destBlockIndex].exercises.splice(dropTarget.index, 0, draggedExercise);
            } else if (dropTarget.type === 'block') {
                const destBlockIndex = dropTarget.index;
                newBlocks[destBlockIndex].exercises.push(draggedExercise);
            }
            setBlocks(newBlocks);
        }
    
        dragItemRef.current = null;
        dragOverItemRef.current = null;
    };

  
  const modalTitle = isCreatingAssigned
    ? `Nytt Program för ${participantToAssign.name}`
    : workoutToEdit ? "Redigera Passmall" : "Ny Passmall";
    
  let saveButtonTextContent = isCreatingAssigned
    ? `Spara & Tilldela till ${participantToAssign.name}`
    : workoutToEdit ? "Spara Mall" : "Spara Mall";

  if (isSaving && !hasSaved) saveButtonTextContent = "Sparar...";
  if (hasSaved) saveButtonTextContent = "Sparat! ✓";

  const mainSaveHandler = isCreatingAssigned ? handleSaveDirectAssigned : handleSaveTemplate;

  // RENDER FUNCTIONS
  const isNameReadOnly = !!newExerciseForm.primaryLiftSelection;
  
  const participantOptions = [
    { value: '', label: 'Välj en medlem...' },
    ...participants
        .filter(p => p.isActive)
        .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
        .sort((a,b) => a.label.localeCompare(b.label))
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="6xl">
        <div className="flex flex-col md:flex-row gap-6 text-gray-800">
          {/* LEFT PANEL: EDITOR */}
          <div ref={editorPanelRef} className="md:w-3/5 flex-shrink-0 space-y-4 max-h-[75vh] overflow-y-auto pr-4 -mr-4">
              <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Pass-inställningar</h3>
                <div className="space-y-4">
                  {isCreatingAssigned && participantGoal && (
                      <div className="p-3 bg-violet-100 border-l-4 border-violet-500 rounded-r-lg space-y-2">
                          <h4 className="text-lg font-bold text-gray-800">Medlemsfokus</h4>
                          <p className="text-sm"><strong className="font-semibold text-gray-600">Mål:</strong> <span className="italic">{participantGoal.fitnessGoals}</span></p>
                          <p className="text-sm"><strong className="font-semibold text-gray-600">Pass/vecka:</strong> {participantGoal.workoutsPerWeekTarget}</p>
                          {participantGoal.coachPrescription && <p className="text-sm"><strong className="font-semibold text-gray-600">Coach Recept:</strong> <span className="italic">"{participantGoal.coachPrescription}"</span></p>}
                          <Button onClick={() => setIsAiModalOpen(true)} fullWidth size="sm" className="!mt-3" disabled={!isOnline}>
                              {isOnline ? 'Skapa med AI-assistent' : 'AI Offline'}
                          </Button>
                      </div>
                  )}
                  <Input label="Passtitel *" name="workoutTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. Vecka 1 – Styrka" required />
                  <Select label="Kategori *" name="workoutCategory" value={category} onChange={(e) => setCategory(e.target.value)} options={workoutCategoryOptions} required disabled={isCreatingAssigned} />
                  
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-1">Passets Huvudfokus</label>
                    <p className="text-sm text-gray-500 mb-2">Hjälper AI:n att rekommendera rätt pass till medlemmar baserat på deras mål.</p>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-100 rounded-md">
                        {WORKOUT_FOCUS_TAGS.map(tag => (
                            <label key={tag.id} className="flex items-center space-x-2 p-2 bg-white rounded-md cursor-pointer hover:bg-gray-50 border">
                                <input
                                    type="checkbox"
                                    checked={focusTags.includes(tag.id)}
                                    onChange={() => handleFocusTagChange(tag.id)}
                                    className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                                />
                                <span className="text-sm font-medium text-gray-700">{tag.label}</span>
                            </label>
                        ))}
                    </div>
                  </div>

                  <Textarea label="Coachanteckning till Medlem (valfri)" name="coachNote" value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="T.ex. Fokusera på tekniken..." rows={2} />
                  <Textarea 
                    label="Instruktion till AI-Coachen (osynlig för medlem)" 
                    name="aiInstruction" 
                    value={aiInstruction} 
                    onChange={(e) => setAiInstruction(e.target.value)} 
                    placeholder="T.ex. 'Påminn medlemmen om att filma ett set. Beröm teknik framför viktökning.'" 
                    rows={2} 
                  />

                </div>
              </div>
              
              {blocks.map((block, blockIndex) => {
                  const numSelectedInBlock = selectedExercises[block.id]?.length || 0;
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
                  
                  return (
                      <div key={block.id} ref={el => { if(el) blockRefs.current[block.id] = el; }} className="bg-gray-50 border border-gray-200 p-6 rounded-lg scroll-mt-4">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-800">Block {blockIndex + 1}</h3>
                            <Button variant="ghost" size="sm" className="!p-2" onClick={() => handleRemoveBlock(block.id)} title="Ta bort block">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            </Button>
                           </div>
                           <div className="space-y-4">
                              <Input label="Blocknamn (valfritt)" value={block.name || ''} onChange={e => handleBlockNameChange(block.id, e.target.value)} />
                               <div className="flex items-center">
                                <input type="checkbox" id={`quick-log-${block.id}`} checked={block.isQuickLogEnabled || false} onChange={(e) => handleBlockQuickLogToggle(block.id, e.target.checked)} className="h-4 w-4 text-flexibel" />
                                <label htmlFor={`quick-log-${block.id}`} className="ml-2 text-base text-gray-700">Aktivera Snabbloggning (för cirklar/AMRAPs)</label>
                              </div>

                              {groupedExercises.length > 0 && (
                                <div className="space-y-3 pt-2">
                                  <h4 className="text-lg font-semibold text-gray-800">Övningar</h4>
                                  {groupedExercises.map((group) => {
                                      const renderExerciseCard = (ex: Exercise, isSupersetChild: boolean) => {
                                          const isSelected = selectedExercises[block.id]?.includes(ex.id) || false;
                                          return (
                                            <div key={ex.id} className={`p-2.5 bg-white rounded-md border flex items-start transition-all ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                                <label htmlFor={`select-ex-${ex.id}`} className="flex-grow flex items-start cursor-pointer">
                                                    <input id={`select-ex-${ex.id}`} type="checkbox" checked={isSelected} onChange={() => handleExerciseSelectionToggle(block.id, ex.id)} className="h-5 w-5 text-flexibel rounded border-gray-400 focus:ring-flexibel mr-3 mt-1 shrink-0 bg-gray-100"/>
                                                    <div className="flex-grow">
                                                        <p className="text-base font-medium text-gray-800">{ex.name} {ex.isBodyweight && <span className="text-xs text-green-600">(KV)</span>}</p>
                                                        {ex.notes && <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">Anteckning: {ex.notes}</p>}
                                                        {ex.baseLiftType && <p className="text-sm text-flexibel mt-0.5">Baslyft: {ex.baseLiftType}</p>}
                                                    </div>
                                                </label>
                                                <div className="flex flex-col gap-1.5 ml-2 flex-shrink-0">
                                                    <Button onClick={() => handleStartEditExercise(block.id, ex)} variant="outline" size="sm" className="!py-2 !px-2 text-xs">Ändra</Button>
                                                    <Button onClick={() => handleRemoveExerciseFromBlock(block.id, ex.id)} variant="danger" size="sm" className="!py-2 !px-2 text-xs">Ta bort</Button>
                                                </div>
                                            </div>
                                          );
                                      };

                                    if (group.type === 'superset') {
                                      return (
                                        <div key={group.id} className="relative p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                                          <span className="absolute top-2 right-2 text-xs font-bold text-blue-800 bg-blue-200 px-2 py-0.5 rounded-full">SUPERSET</span>
                                          <div className="space-y-2">{group.exercises.map(ex => renderExerciseCard(ex, true))}</div>
                                        </div>
                                      )
                                    } else {
                                      return renderExerciseCard(group.exercise, false);
                                    }
                                  })}
                                </div>
                              )}

                              {editingState?.blockId === block.id && (
                                  <div className="space-y-3 p-3 border-t-2 border-dashed border-gray-300 rounded-md bg-white mt-4 animate-fade-in-down">
                                    <h6 className="text-lg font-semibold text-gray-800">{editingState.exerciseId ? 'Redigera Övning' : 'Ny Övning'}</h6>
                                    <Select label="Välj övning från lista (valfritt)" name={`newExPrimarySelection`} value={newExerciseForm.primaryLiftSelection} onChange={(e) => handleNewExerciseInputChange('primaryLiftSelection', e.target.value as LiftType | '')} options={PRIMARY_EXERCISE_SELECTION_OPTIONS} inputSize="sm" />
                                    <Input label="Namn på övning" name={`newExName`} value={newExerciseForm.name} onChange={(e) => handleNewExerciseInputChange('name', e.target.value)} placeholder={isNameReadOnly ? "" : "T.ex. Special Knäböj"} inputSize="sm" readOnly={isNameReadOnly} required />
                                    <div className="pt-2 space-y-1">
                                        <label className="text-base font-medium text-gray-700">Loggningsbara fält:</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{LOGGABLE_METRICS_OPTIONS.map(metricOpt => (<label key={metricOpt.id} className={`flex items-center space-x-2 p-1 ${newExerciseForm.isBodyweight ? 'opacity-50 cursor-not-allowed' : ''}`}><input type="checkbox" checked={newExerciseForm.loggableMetrics.includes(metricOpt.id)} onChange={() => handleMetricToggle(metricOpt.id)} className="h-4 w-4 text-flexibel" disabled={newExerciseForm.isBodyweight} /><span className="text-sm text-gray-700">{metricOpt.label}</span></label>))}</div>
                                    </div>
                                    <div className="pt-2 space-y-2 border-t mt-2">
                                        <h6 className="text-base font-semibold text-gray-800">Målsättning & Instruktioner</h6>
                                        <Input label="Antal Set" name="targetSets" value={newExerciseForm.targetSets} onChange={(e) => handleNewExerciseInputChange('targetSets', e.target.value)} placeholder="T.ex. 3" inputSize="sm" />
                                        <div className="grid grid-cols-2 gap-2">
                                            {newExerciseForm.loggableMetrics.includes('reps') && <Input label="Mål Reps" name="targetReps" value={newExerciseForm.targetReps} onChange={(e) => handleNewExerciseInputChange('targetReps', e.target.value)} placeholder="T.ex. 8-12, AMRAP" inputSize="sm" />}
                                            {newExerciseForm.loggableMetrics.includes('weight') && <Input label="Mål Vikt (kg)" name="targetWeight" value={newExerciseForm.targetWeight} onChange={(e) => handleNewExerciseInputChange('targetWeight', e.target.value)} placeholder="T.ex. 50kg, 7 RPE" inputSize="sm" />}
                                            {newExerciseForm.loggableMetrics.includes('distance') && <Input label="Mål Distans (m)" name="targetDistance" value={newExerciseForm.targetDistance} onChange={(e) => handleNewExerciseInputChange('targetDistance', e.target.value)} placeholder="T.ex. 1000" inputSize="sm" />}
                                            {newExerciseForm.loggableMetrics.includes('duration') && <Input label="Mål Tid (sek)" name="targetDuration" value={newExerciseForm.targetDuration} onChange={(e) => handleNewExerciseInputChange('targetDuration', e.target.value)} placeholder="T.ex. 60" inputSize="sm" />}
                                            {newExerciseForm.loggableMetrics.includes('calories') && <Input label="Mål Kalorier (kcal)" name="targetCalories" value={newExerciseForm.targetCalories} onChange={(e) => handleNewExerciseInputChange('targetCalories', e.target.value)} placeholder="T.ex. 20" inputSize="sm" />}
                                        </div>
                                        <Input label="Vila mellan set (valfri)" name="targetRest" value={newExerciseForm.targetRest} onChange={(e) => handleNewExerciseInputChange('targetRest', e.target.value)} placeholder="T.ex. 60s, 90-120s" inputSize="sm" />
                                        <Textarea label="Instruktioner (valfri)" name={`newExNotes`} value={newExerciseForm.notes} onChange={(e) => handleNewExerciseInputChange('notes', e.target.value)} placeholder="T.ex. Fokusera på tekniken, håll stolt bröst." rows={2} className="text-base" />
                                    </div>
                                    <div className="flex items-center pt-2">
                                        <input type="checkbox" id={`newExIsBodyweight`} name={`newExIsBodyweight`} checked={newExerciseForm.isBodyweight} onChange={(e) => handleNewExerciseInputChange('isBodyweight', e.target.checked)} className="h-4 w-4 text-flexibel" />
                                        <label htmlFor={`newExIsBodyweight`} className="ml-2 text-base text-gray-700">Kroppsviktsövning</label>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-300 mt-2">
                                        <Button onClick={() => setEditingState(null)} variant="ghost" size="sm">Avbryt</Button>
                                        <Button onClick={handleSaveExercise} variant="secondary" size="sm" disabled={!newExerciseForm.name.trim()}>{editingState.exerciseId ? 'Uppdatera' : 'Lägg till'}</Button>
                                    </div>
                                  </div>
                              )}

                              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-300">
                                <Button onClick={() => handleStartAddNewExercise(block.id)} variant="outline" size="sm" className="w-full">Lägg till övning</Button>
                                <Button onClick={() => handleSupersetAction(block.id)} variant="primary" size="sm" className="w-full" disabled={numSelectedInBlock < 2} title={numSelectedInBlock < 2 ? "Välj minst 2 övningar" : "Skapa/Dela Superset"}>
                                    Skapa/Dela Superset ({numSelectedInBlock})
                                </Button>
                              </div>
                           </div>
                      </div>
                  )
              })}
              <Button onClick={handleAddBlock} variant="outline" fullWidth>Lägg till nytt block</Button>
          </div>

          {/* RIGHT PANEL: STRUCTURE */}
          <div className="md:w-2/5 flex-1 space-y-4 h-fit sticky top-6">
            <WorkoutStructurePanel
                workout={{ blocks }}
                focusedBlockId={editingState?.blockId || null}
                onBlockClick={handleBlockClick}
                onExerciseClick={handleExerciseClick}
                dragItemRef={dragItemRef}
                dragOverItemRef={dragOverItemRef}
                onSort={handleSort}
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t mt-6 border-gray-200">
          <div>
            {!isCreatingAssigned && (
                <Button onClick={() => setIsAssignModalOpen(true)} variant="outline" disabled={isSaving}>
                    Spara en kopia till medlem...
                </Button>
            )}
          </div>
          <div className="flex space-x-3">
              <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
              <Button onClick={mainSaveHandler} variant="primary" disabled={isSaving}>{saveButtonTextContent}</Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isAssignModalOpen} 
        onClose={() => setIsAssignModalOpen(false)} 
        title="Tilldela anpassat program (som kopia)"
        size="md"
      >
        <div className="space-y-4">
            <p>Detta skapar en <strong>kopia</strong> av passet du just redigerade och tilldelar den till en specifik medlem. Originalmallen förblir ofändrad.</p>
            <Select
                label="Välj medlem *"
                value={participantForCopy}
                onChange={(e) => setParticipantForCopy(e.target.value)}
                options={participantOptions}
                required
            />
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button onClick={() => setIsAssignModalOpen(false)} variant="secondary" disabled={isSaving}>Avbryt</Button>
                <Button onClick={handleSaveAssignedCopy} variant="primary" disabled={isSaving || !participantForCopy}>
                    {isSaving ? (hasSaved ? "Tilldelat! ✓" : "Tilldelar...") : "Tilldela Program"}
                </Button>
            </div>
        </div>
      </Modal>

      {participantToAssign && (
        <AICoachAssistantModal
            isOpen={isAiModalOpen}
            onClose={() => setIsAiModalOpen(false)}
            participantToAssign={participantToAssign}
            participantGoal={participantGoal}
            onAcceptSuggestion={handleAcceptAiSuggestion}
        />
      )}
    </>
  );
};
