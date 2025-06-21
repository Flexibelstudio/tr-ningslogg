
import React, { useState } from 'react';
import { Workout, Exercise, WorkoutLog, LiftType } from '../../types'; // Added WorkoutLog, LiftType
import { Button } from '../Button';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { AICoachAssistantModal } from './AICoachAssistantModal';
import { ParticipantActivityOverview } from './ParticipantActivityOverview'; 
import { ConfirmationModal } from '../ConfirmationModal'; // Import ConfirmationModal
import { GoogleGenAI } from '@google/genai';

interface CoachAreaProps {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prev: Workout[]) => Workout[])) => void;
  workoutLogs: WorkoutLog[]; 
  ai: GoogleGenAI | null; 
}

// Simple Markdown to HTML for bold text
const renderMarkdownBold = (text: string) => {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 inline" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);


export const CoachArea: React.FC<CoachAreaProps> = ({ workouts, setWorkouts, workoutLogs, ai }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState(false);

  const [showConfirmDeleteWorkoutModal, setShowConfirmDeleteWorkoutModal] = useState(false);
  const [workoutToConfirmDelete, setWorkoutToConfirmDelete] = useState<Workout | null>(null);

  const handleSaveWorkout = (newWorkout: Workout) => {
    setWorkouts((prevWorkouts) => [...prevWorkouts, newWorkout].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setIsCreateModalOpen(false); 
  };
  
  const handleUpdateWorkout = (updatedWorkout: Workout) => {
    setWorkouts((prevWorkouts) => 
        prevWorkouts.map(w => w.id === updatedWorkout.id ? updatedWorkout : w)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    setEditingWorkout(null);
    setIsCreateModalOpen(false);
  };

  const handleOpenCreateModal = () => {
    setEditingWorkout(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (workout: Workout) => {
    setEditingWorkout(workout);
    setIsCreateModalOpen(true);
  };
  
  const handleTogglePublishState = (workoutId: string) => {
    setWorkouts(prev => 
      prev.map(w => w.id === workoutId ? { ...w, isPublished: !w.isPublished } : w)
    );
  };

  const handleDeleteWorkoutInitiated = (workout: Workout) => {
    setWorkoutToConfirmDelete(workout);
    setShowConfirmDeleteWorkoutModal(true);
  };

  const handleConfirmDeleteWorkout = () => {
    if (workoutToConfirmDelete) {
      setWorkouts(prev => prev.filter(w => w.id !== workoutToConfirmDelete.id));
    }
    setShowConfirmDeleteWorkoutModal(false);
    setWorkoutToConfirmDelete(null);
  };


  const handleSaveSuggestedWorkoutAsDraft = (draft: { title: string; exercisesData: Array<{ name: string; notes: string; baseLiftType?: LiftType }> }) => {
    const newExercises: Exercise[] = draft.exercisesData.map(exData => ({
      id: crypto.randomUUID(),
      name: exData.name,
      notes: exData.notes,
      baseLiftType: exData.baseLiftType, // Include baseLiftType if provided by AI parsing
    }));

    const newWorkoutDraft: Workout = {
      id: crypto.randomUUID(),
      title: draft.title,
      date: new Date().toISOString().split('T')[0],
      category: 'Annat', // Default category for AI drafts
      exercises: newExercises,
      isPublished: false, 
    };
    setWorkouts((prevWorkouts) => [...prevWorkouts, newWorkoutDraft].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setIsAiAssistantModalOpen(false);
  };

  const sortedWorkouts = [...workouts].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <div className="space-y-8">
        <div> 
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Mina Pass (Coach)</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {ai && (
                <Button 
                  onClick={() => setIsAiAssistantModalOpen(true)} 
                  variant="outline" 
                  className="w-full sm:w-auto"
                  title={!process.env.API_KEY && !ai ? "API-nyckel saknas för AI-funktioner" : "AI Programassistent"}
                  disabled={!process.env.API_KEY && !ai}
                >
                  AI Programassistent
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 inline" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3.5a1.5 1.5 0 011.5 1.5V5a1 1 0 001 1h1.5a1.5 1.5 0 010 3H12a1 1 0 00-1 1v1.5a1.5 1.5 0 01-3 0V10a1 1 0 00-1-1H6.5a1.5 1.5 0 010-3H8a1 1 0 001-1V5a1.5 1.5 0 011.5-1.5zM3 10a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM6.5 10a.5.5 0 000 1h7a.5.5 0 000-1h-7z" />
                    <path fillRule="evenodd" d="M9.013 15.138A5.002 5.002 0 0010 15a5 5 0 001.2-.156C10.74 16.205 9.42 17 8 17c-2.761 0-5-2.239-5-5s2.239-5 5-5c1.42 0 2.74.795 3.548 2H9.522a.5.5 0 00-.51.684l.274.965A3.504 3.504 0 016.5 10c0 .341.048.67.137.986l-.274.965A.5.5 0 006.536 12H7a1 1 0 001-1V8.5a.5.5 0 00-1 0V10a1 1 0 00-1-1H3.5a.5.5 0 000 1H5V9.5a.5.5 0 00-1 0V11a1 1 0 001 1h.027a4.98 4.98 0 001.986 3.138zM12 11.5a.5.5 0 00.51-.684l-.274-.965A3.504 3.504 0 0113.5 10c0-.341-.048-.67-.137-.986l.274-.965A.5.5 0 0013.464 8H13a1 1 0 00-1 1v2.5a.5.5 0 001 0V10a1 1 0 001-1h1.5a.5.5 0 000-1H15v1.5a.5.5 0 001 0V9a1 1 0 00-1-1h-.027a4.98 4.98 0 00-1.986-3.138C13.26 3.795 14.58 3 16 3c2.761 0 5 2.239 5 5s-2.239 5-5 5c-1.42 0-2.74-.795-3.548-2h.026z" clipRule="evenodd" />
                  </svg>
                </Button>
              )}
              <Button onClick={handleOpenCreateModal} className="w-full sm:w-auto">Nytt Pass</Button>
            </div>
          </div>

          {sortedWorkouts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg shadow-md">
              <svg className="mx-auto h-12 w-12 text-flexibel/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-xl font-semibold text-gray-700">Inga pass skapade</h3>
              <p className="mt-1 text-base text-gray-500">Klicka 'Nytt Pass' för att börja.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedWorkouts.map((workout) => (
                <div key={workout.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-out">
                  <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-semibold text-flexibel">{workout.title}</h3>
                        <p className="text-base text-gray-500">Datum: {new Date(workout.date).toLocaleDateString('sv-SE')}</p>
                        <p className="text-base text-gray-500">Kategori: <span className="font-medium">{workout.category}</span></p>
                        <p className={`text-sm font-semibold mt-1 ${workout.isPublished ? 'text-green-600' : 'text-yellow-600'}`}>
                            {workout.isPublished ? 'Publicerat' : 'Utkast'}
                        </p>
                    </div>
                  </div>
                  {workout.coachNote && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                        <p className="text-sm font-semibold text-yellow-700">Anteckning till medlem:</p>
                        <p className="text-sm text-yellow-600 italic whitespace-pre-wrap">{workout.coachNote}</p>
                    </div>
                  )}
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Övningar ({workout.exercises.length}):</h4>
                    <ul className="list-none space-y-2 pl-0">
                      {workout.exercises.map((ex) => (
                        <li key={ex.id} className="text-base text-gray-600">
                          <span className="font-medium block">
                            {ex.name}
                            {ex.baseLiftType && <span className="text-sm text-flexibel/80 font-normal ml-1"> (Baslyft: {ex.baseLiftType})</span>}
                          </span>
                          {ex.notes && (
                            <div 
                              className="mt-1 pl-2 text-sm text-gray-500 whitespace-pre-wrap prose prose-sm max-w-none" 
                              dangerouslySetInnerHTML={{ __html: renderMarkdownBold(ex.notes) }}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 items-center">
                    {workout.isPublished ? (
                        <>
                            <Button onClick={() => handleOpenEditModal(workout)} variant="outline" size="sm">Redigera Pass</Button>
                            <Button onClick={() => handleTogglePublishState(workout.id)} variant="secondary" size="sm">Avpublicera</Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => handleOpenEditModal(workout)} variant="outline" size="sm">Redigera Utkast</Button>
                            <Button onClick={() => handleTogglePublishState(workout.id)} variant="primary" size="sm">Publicera</Button>
                        </>
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
              ))}
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
          />
          {ai && (
            <AICoachAssistantModal
                isOpen={isAiAssistantModalOpen}
                onClose={() => setIsAiAssistantModalOpen(false)}
                ai={ai}
                onSaveSuggestedWorkoutAsDraft={handleSaveSuggestedWorkoutAsDraft}
            />
          )}
        </div> 

        <ParticipantActivityOverview 
          workoutLogs={workoutLogs} 
          workouts={workouts} 
          ai={ai} 
        />
      </div>

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
  );
};