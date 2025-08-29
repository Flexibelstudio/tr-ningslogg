import React, { useState, useEffect } from 'react';
import { Workout, Exercise, LiftType, WorkoutBlock, WorkoutCategoryDefinition, ParticipantProfile } from '../../types';
import { Button } from '../Button';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { AICoachAssistantModal } from './AICoachAssistantModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { GoogleGenAI } from '@google/genai';
import { INTENSITY_LEVELS } from '../../constants';
import { useAppContext } from '../../context/AppContext';
import { Modal } from '../Modal';
import { Select } from '../Input';

const formatPlan = (exercise: Exercise): string | null => {
    const parts: string[] = [];
    if (exercise.targetSets) parts.push(`${exercise.targetSets} set`);
    if (exercise.targetReps) parts.push(`x ${exercise.targetReps} reps`);
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

const renderMarkdownBold = (text: string) => {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 inline" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline ml-2 text-gray-500 group-hover:text-gray-700 transition-colors" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
  
const ChevronUpIcon = () => (
<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline ml-2 text-gray-500 group-hover:text-gray-700 transition-colors" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
</svg>
);

interface AssignWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (participantId: string) => void;
    workoutToAssign: Workout | null;
    participants: ParticipantProfile[];
}

const AssignWorkoutModal: React.FC<AssignWorkoutModalProps> = ({ isOpen, onClose, onAssign, workoutToAssign, participants }) => {
    const [selectedParticipant, setSelectedParticipant] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            setSelectedParticipant('');
        }
    }, [isOpen]);
    
    const participantOptions = [
        { value: '', label: 'Välj en medlem...' },
        ...participants
            .filter(p => p.isActive)
            .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
            .sort((a, b) => a.label.localeCompare(b.label))
    ];

    const handleAssignClick = () => {
        if (selectedParticipant) {
            onAssign(selectedParticipant);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Tilldela "${workoutToAssign?.title}"`}>
            <div className="space-y-4">
                <p>Välj vilken medlem du vill tilldela en kopia av detta pass till.</p>
                <Select
                    label="Medlem"
                    value={selectedParticipant}
                    onChange={e => setSelectedParticipant(e.target.value)}
                    options={participantOptions}
                />
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                    <Button onClick={handleAssignClick} disabled={!selectedParticipant}>Tilldela</Button>
                </div>
            </div>
        </Modal>
    );
};

interface WorkoutManagementProps {
    ai: GoogleGenAI | null;
    participants: ParticipantProfile[];
    isOnline: boolean;
}

export const WorkoutManagement: React.FC<WorkoutManagementProps> = ({ ai, participants, isOnline }) => {
    const { workouts, addWorkout, updateWorkout, deleteWorkout } = useAppContext();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
    const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState(false);
    const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Set<string>>(new Set());
    const [expandedBlockStates, setExpandedBlockStates] = useState<Record<string, Set<string>>>({});
  
    const [showConfirmDeleteWorkoutModal, setShowConfirmDeleteWorkoutModal] = useState(false);
    const [workoutToConfirmDelete, setWorkoutToConfirmDelete] = useState<Workout | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [workoutToAssign, setWorkoutToAssign] = useState<Workout | null>(null);
    const [assignSuccessMessage, setAssignSuccessMessage] = useState('');


    const templateWorkouts = workouts.filter(w => !w.assignedToParticipantId);

    const handleSaveWorkout = (newWorkout: Workout) => {
        addWorkout(newWorkout);
        setIsCreateModalOpen(false); 
      };
      
    const handleUpdateWorkout = (updatedWorkout: Workout) => {
        updateWorkout(updatedWorkout);
        setEditingWorkout(null);
        setIsCreateModalOpen(false);
    };

    const handleOpenCreateModal = () => {
        setEditingWorkout(null);
        setIsCreateModalOpen(true);
      };
    
    const handleOpenEditModal = (workout: Workout) => {
    const workoutWithBlocks: Workout = {
        ...workout,
        blocks: workout.blocks || (workout.hasOwnProperty('exercises') ? [{ id: crypto.randomUUID(), name: '', exercises: (workout as any).exercises }] : [{id: crypto.randomUUID(), name: '', exercises: []}]),
    };
    if (workout.hasOwnProperty('exercises')) {
        delete (workoutWithBlocks as any).exercises;
    }
    setEditingWorkout(workoutWithBlocks);
    setIsCreateModalOpen(true);
    };
    
    const handleTogglePublishState = (workoutId: string) => {
        const workoutToToggle = workouts.find(w => w.id === workoutId);
        if (workoutToToggle) {
            updateWorkout({ ...workoutToToggle, isPublished: !workoutToToggle.isPublished });
        }
    };

    const handleDeleteWorkoutInitiated = (workout: Workout) => {
        setWorkoutToConfirmDelete(workout);
        setShowConfirmDeleteWorkoutModal(true);
    };
    
    const handleConfirmDeleteWorkout = () => {
        if (workoutToConfirmDelete) {
            deleteWorkout(workoutToConfirmDelete.id);
        }
        setShowConfirmDeleteWorkoutModal(false);
        setWorkoutToConfirmDelete(null);
    };

    const handleAssignWorkout = (participantId: string) => {
        if (!workoutToAssign || !participantId) return;
    
        const assignedWorkout: Workout = {
            ...workoutToAssign, // This is a copy of the template
            id: crypto.randomUUID(), // New ID for the copy
            isPublished: false, // It's an assignment, not a public template
            assignedToParticipantId: participantId,
        };
        addWorkout(assignedWorkout);
        setIsAssignModalOpen(false);
        
        const participantName = participants.find(p => p.id === participantId)?.name;
        setAssignSuccessMessage(`'${workoutToAssign.title}' har tilldelats till ${participantName || 'medlemmen'}.`);
        setTimeout(() => setAssignSuccessMessage(''), 3000); // Message disappears after 3s
    };

    const handleToggleExpandWorkout = (workoutId: string) => {
        setExpandedWorkoutIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(workoutId)) {
            newSet.delete(workoutId);
          } else {
            newSet.add(workoutId);
          }
          return newSet;
        });
        if (!expandedWorkoutIds.has(workoutId)) {
          setExpandedBlockStates(prev => ({ ...prev, [workoutId]: new Set() }));
        }
      };
      
    const handleToggleBlockExpand = (workoutId: string, blockId: string) => {
    setExpandedBlockStates(prev => {
        const currentWorkoutBlocks = new Set(prev[workoutId] || []);
        if (currentWorkoutBlocks.has(blockId)) {
        currentWorkoutBlocks.delete(blockId);
        } else {
        currentWorkoutBlocks.add(blockId);
        }
        return { ...prev, [workoutId]: currentWorkoutBlocks };
    });
    };

    const handleAcceptAiSuggestion = (suggestion: { title: string; coachNote?: string; blocksData: WorkoutBlock[] }) => {
        const newWorkoutDraft: Workout = {
          id: crypto.randomUUID(),
          title: suggestion.title,
          category: 'Annat', 
          coachNote: suggestion.coachNote,
          blocks: suggestion.blocksData,
          isPublished: false, 
        };
        addWorkout(newWorkoutDraft);
        setIsAiAssistantModalOpen(false); 
      };

      const sortedWorkouts = templateWorkouts;

      return (
        <>
            <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {ai && (
                <Button 
                    onClick={() => setIsAiAssistantModalOpen(true)} 
                    variant="outline" 
                    className="w-full sm:w-auto"
                    title={!process.env.API_KEY && !ai ? "API-nyckel saknas för AI-funktioner" : "AI Programassistent"}
                    disabled={!process.env.API_KEY && !ai || !isOnline}
                >
                    {isOnline ? 'AI Programassistent' : 'AI Offline'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v1.999l4.879 4.879a1 1 0 01-.318 1.682l-5.25 1.625a1 1 0 01-1.24-.226l-3.328-4.16a1 1 0 01.226-1.24l1.625-5.25a1 1 0 011.682-.318L11 3.05V2a1 1 0 01.3-.954zM9 12v6a1 1 0 001 1h.01a1 1 0 00.993-.993L11 12H9z" clipRule="evenodd" />
                        <path d="M5 2.5a.5.5 0 01.5-.5H6a.5.5 0 010 1H5.5a.5.5 0 01-.5-.5zM3 5.5a.5.5 0 01.5-.5H4a.5.5 0 010 1H3.5a.5.5 0 01-.5-.5zM2 8.5a.5.5 0 01.5-.5H3a.5.5 0 010 1H2.5a.5.5 0 01-.5-.5zM2 11.5a.5.5 0 01.5-.5H3a.5.5 0 010 1H2.5a.5.5 0 01-.5-.5zM3.5 14a.5.5 0 000 1H4a.5.5 0 000-1h-.5zM5.5 16a.5.5 0 000 1H6a.5.5 0 000-1h-.5z" />
                    </svg>
                </Button>
                )}
                <Button onClick={handleOpenCreateModal} className="w-full sm:w-auto">Nytt Pass</Button>
            </div>
            </div>

            {assignSuccessMessage && (
                <div className="p-3 bg-green-100 text-green-800 rounded-md mb-4 animate-fade-in">{assignSuccessMessage}</div>
            )}

            {sortedWorkouts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg shadow-md">
                <svg className="mx-auto h-12 w-12 text-flexibel/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2-2H5a2 2 0 01-2-2z" />
                </svg>
                <h3 className="mt-2 text-2xl font-semibold text-gray-700">Inga pass skapade</h3>
                <p className="mt-1 text-lg text-gray-500">Klicka 'Nytt Pass' för att börja.</p>
            </div>
            ) : (
            <div className="space-y-4">
                {sortedWorkouts.map((workout, index) => {
                const intensityDetail = workout.category === 'PT-bas' && workout.intensityLevel 
                                        ? INTENSITY_LEVELS.find(l => l.value === workout.intensityLevel) 
                                        : null;
                const isWorkoutExpanded = expandedWorkoutIds.has(workout.id);
                const numberOfBlocks = workout.blocks?.length || 0;
                const totalNumberOfExercises = workout.blocks?.reduce((sum, block) => sum + (block.exercises?.length || 0), 0) || 0;
                
                return (
                    <div key={workout.id} className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-out" style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards` }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-semibold text-flexibel">{workout.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <p className="text-base text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                                {intensityDetail && (
                                    <span className={`inline-block ${intensityDetail.twBadgeClass} text-sm font-semibold px-2 py-0.5 rounded-full`}>
                                        Fokus: {intensityDetail.label}
                                    </span>
                                )}
                            </div>
                            <p className={`text-base font-semibold mt-1 ${workout.isPublished ? 'text-green-600' : 'text-yellow-600'}`}>
                                {workout.isPublished ? 'Publicerat' : 'Utkast'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="mt-4 border-t pt-4">
                        <button
                        onClick={() => handleToggleExpandWorkout(workout.id)}
                        className="w-full text-left text-lg font-semibold text-gray-700 mb-2 flex justify-between items-center group py-1 hover:text-flexibel transition-colors"
                        aria-expanded={isWorkoutExpanded}
                        aria-controls={`workout-details-and-structure-${workout.id}`}
                        >
                        <span>Detaljer & Struktur ({numberOfBlocks} block, {totalNumberOfExercises} övningar)</span>
                        {isWorkoutExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </button>
                        
                        {isWorkoutExpanded && (
                        <div id={`workout-details-and-structure-${workout.id}`}>
                            {workout.coachNote && (
                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                                <p className="text-base font-semibold text-yellow-700">Anteckning till medlem:</p>
                                <p className="text-base text-yellow-600 italic whitespace-pre-wrap">{workout.coachNote}</p>
                            </div>
                            )}
                            {workout.category === 'PT-bas' && workout.intensityInstructions && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-300 rounded-md">
                                <p className="text-base font-semibold text-blue-700">Instruktion för intensitet ({intensityDetail?.label}):</p>
                                <p className="text-base text-blue-600 italic whitespace-pre-wrap">{workout.intensityInstructions}</p>
                            </div>
                            )}
                            
                            <div className={`
                            ${(workout.coachNote || (workout.category === 'PT-bas' && workout.intensityInstructions)) ? 'mt-4 pt-4 border-t' : 'mt-0'} 
                            `}>
                            {(!workout.blocks || workout.blocks.length === 0) && <p className="text-base text-gray-500">Inga övningar eller block definierade.</p>}
                            {workout.blocks?.map((block, blockIndex) => {
                                const isBlockExpanded = expandedBlockStates[workout.id]?.has(block.id) || false;
                                return (
                                <div key={block.id} className="mb-3 pl-2 border-l-2 border-flexibel/30">
                                    <button
                                        onClick={() => handleToggleBlockExpand(workout.id, block.id)}
                                        className="w-full text-left text-lg font-semibold text-gray-600 mb-1 flex justify-between items-center group py-1 hover:text-flexibel/80 transition-colors"
                                        aria-expanded={isBlockExpanded}
                                        aria-controls={`block-content-${block.id}`}
                                    >
                                        <span className="truncate">
                                        {block.name ? block.name : `Block ${blockIndex + 1}`}
                                        {block.exercises.length === 0 && <span className="text-sm font-normal text-gray-400"> (Tomt block)</span>}
                                        {!isBlockExpanded && block.exercises.length > 0 && <span className="text-sm font-normal text-gray-500 ml-1">({block.exercises.length} övn.)</span>}
                                        </span>
                                        {isBlockExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                    </button>
                                    {isBlockExpanded && (
                                        <div id={`block-content-${block.id}`}>
                                            {block.exercises.length > 0 ? (
                                                <ul className="list-none space-y-1.5 pl-1 mt-1">
                                                {block.exercises.map((ex) => {
                                                    const planText = formatPlan(ex);
                                                    return (
                                                        <li key={ex.id} className="text-base text-gray-600">
                                                            <span className="font-medium block">
                                                                {ex.name}
                                                                {ex.baseLiftType && <span className="text-sm text-flexibel/80 font-normal ml-1"> (Baslyft: {ex.baseLiftType})</span>}
                                                                {ex.isBodyweight && <span className="text-sm text-green-600 ml-1">(KV)</span>}
                                                            </span>
                                                            {planText && <p className="text-sm font-semibold text-gray-700 pl-2">{planText}</p>}
                                                            {ex.notes && (
                                                                <div 
                                                                className="mt-0.5 pl-2 text-sm text-gray-500 whitespace-pre-wrap prose prose-base max-w-none" 
                                                                dangerouslySetInnerHTML={{ __html: renderMarkdownBold(ex.notes) }}
                                                                />
                                                            )}
                                                        </li>
                                                    )
                                                })}
                                                </ul>
                                            ) : (
                                            <p className="text-sm text-gray-500 italic pl-1 mt-1">Inga övningar i detta block.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            </div>
                        </div>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 items-center">
                        <Button onClick={() => handleOpenEditModal(workout)} variant="outline" size="sm">
                            {workout.isPublished ? 'Redigera Pass' : 'Redigera Utkast'}
                        </Button>
                        <Button onClick={() => { setWorkoutToAssign(workout); setIsAssignModalOpen(true); }} variant="outline" size="sm">
                            Tilldela...
                        </Button>
                        
                        {workout.isPublished ? (
                            <Button onClick={() => handleTogglePublishState(workout.id)} variant="secondary" size="sm">Avpublicera</Button>
                        ) : (
                            <Button onClick={() => handleTogglePublishState(workout.id)} variant="primary" size="sm">Publicera</Button>
                        )}

                        <Button 
                            onClick={() => handleDeleteWorkoutInitiated(workout)} 
                            variant="danger" 
                            size="sm" 
                            className="ml-auto"
                            aria-label={`Ta bort passet ${workout.title}`}
                        >
                            <TrashIcon /> Ta bort
                        </Button>
                    </div>
                    </div>
                )
                })}
            </div>
            )}
            <CreateWorkoutModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingWorkout(null);
                }}
                onSaveWorkout={handleSaveWorkout}
                workoutToEdit={editingWorkout}
                onUpdateWorkout={handleUpdateWorkout}
                ai={ai}
                isOnline={isOnline}
            />
            {ai && (
            <AICoachAssistantModal
                isOpen={isAiAssistantModalOpen}
                onClose={() => setIsAiAssistantModalOpen(false)}
                ai={ai}
                onAcceptSuggestion={handleAcceptAiSuggestion}
            />
            )}

            <AssignWorkoutModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                onAssign={handleAssignWorkout}
                workoutToAssign={workoutToAssign}
                participants={participants}
            />

            {workoutToConfirmDelete && (
                <ConfirmationModal
                isOpen={showConfirmDeleteWorkoutModal}
                onClose={() => {
                    setShowConfirmDeleteWorkoutModal(false);
                    setWorkoutToConfirmDelete(null);
                }}
                onConfirm={handleConfirmDeleteWorkout}
                title="Bekräfta Borttagning av Pass"
                message={`Är du säker på att du vill ta bort passet '${workoutToConfirmDelete.title}'? Eventuella loggar kopplade till detta pass kommer fortfarande finnas kvar men kan visas som 'Okänt pass'. Detta kan inte ångras.`}
                confirmButtonText="Ta bort Pass"
                cancelButtonText="Avbryt"
                />
            )}
        </>
      )
}
