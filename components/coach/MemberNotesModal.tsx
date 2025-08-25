import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, OneOnOneSession, StaffMember, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as dateUtils from '../../utils/dateUtils';
import { BookOneOnOneModal } from './BookOneOnOneModal';
import { GoalForm, GoalFormRef } from '../participant/GoalForm';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { ConfirmationModal } from '../ConfirmationModal';

interface MemberNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ai: GoogleGenAI | null;
  participant: ParticipantProfile;
  notes: CoachNote[];
  allParticipantGoals: ParticipantGoalData[];
  setParticipantGoals: (goals: ParticipantGoalData[] | ((prev: ParticipantGoalData[]) => ParticipantGoalData[])) => void;
  allActivityLogs: ActivityLog[];
  setGoalCompletionLogs: (logs: GoalCompletionLog[] | ((prev: GoalCompletionLog[]) => GoalCompletionLog[])) => void;
  onAddNote: (noteText: string) => void;
  onUpdateNote: (noteId: string, newText: string) => void;
  onDeleteNote: (noteId: string) => void;
  oneOnOneSessions: OneOnOneSession[];
  setOneOnOneSessions: (sessions: OneOnOneSession[] | ((prev: OneOnOneSession[]) => OneOnOneSession[])) => void;
  coaches: StaffMember[];
  loggedInCoachId: string;
  workouts: Workout[];
  addWorkout: (workout: Workout) => Promise<void>;
  updateWorkout: (workout: Workout) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  workoutCategories: WorkoutCategoryDefinition[];
  participants: ParticipantProfile[];
  staffAvailability: StaffAvailability[];
  isOnline: boolean;
}

export const MemberNotesModal: React.FC<MemberNotesModalProps> = ({
    isOpen, onClose, ai, participant, notes, allParticipantGoals, setParticipantGoals, allActivityLogs, setGoalCompletionLogs,
    onAddNote, onUpdateNote, onDeleteNote, oneOnOneSessions, setOneOnOneSessions, coaches, loggedInCoachId,
    workouts, addWorkout, updateWorkout, deleteWorkout, workoutCategories, participants, staffAvailability, isOnline
}) => {
    const [newNote, setNewNote] = useState('');
    const [editingNote, setEditingNote] = useState<CoachNote | null>(null);
    const [isAiInsightModalOpen, setIsAiInsightModalOpen] = useState(false);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [isCreateWorkoutModalOpen, setIsCreateWorkoutModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<CoachNote | null>(null);

    const goalFormRef = useRef<GoalFormRef>(null);

    const latestParticipantGoal = useMemo(() => {
        const goalsForParticipant = allParticipantGoals.filter(g => g.participantId === participant.id);
        if (goalsForParticipant.length === 0) return null;
        return goalsForParticipant.sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    }, [allParticipantGoals, participant.id]);

    const handleSaveNote = () => {
        if (editingNote) {
            onUpdateNote(editingNote.id, newNote);
        } else {
            onAddNote(newNote);
        }
        setNewNote('');
        setEditingNote(null);
    };

    const handleEditClick = (note: CoachNote) => {
        setEditingNote(note);
        setNewNote(note.noteText);
    };

    const handleCancelEdit = () => {
        setEditingNote(null);
        setNewNote('');
    };
    
    const handleSaveOrUpdateSession = (session: OneOnOneSession) => {
        setOneOnOneSessions(prev => {
            const index = prev.findIndex(s => s.id === session.id);
            if (index > -1) {
                const newSessions = [...prev];
                newSessions[index] = session;
                return newSessions;
            } else {
                return [...prev, session];
            }
        });
    };
    
    const handleSaveGoal = async (
        goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean,
      ) => {
        
        setParticipantGoals(prevGoals => {
            const participantGoals = prevGoals.filter(g => g.participantId === participant.id);
            const otherParticipantsGoals = prevGoals.filter(g => g.participantId !== participant.id);
            
            let updatedParticipantGoals = [...participantGoals];
    
            if (markLatestGoalAsCompleted) {
                const latestGoal = updatedParticipantGoals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestGoal) {
                    const newLog: GoalCompletionLog = { type: 'goal_completion', id: crypto.randomUUID(), participantId: participant.id, goalId: latestGoal.id, goalDescription: latestGoal.fitnessGoals, completedDate: new Date().toISOString() };
                    setGoalCompletionLogs(prevLogs => [...prevLogs, newLog]);
                    updatedParticipantGoals = updatedParticipantGoals.map(g => g.id === latestGoal.id ? {...g, isCompleted: true, completedDate: new Date().toISOString()} : g);
                }
            }
            
            const newGoal: ParticipantGoalData = {
                id: crypto.randomUUID(),
                participantId: participant.id,
                fitnessGoals: goalData.fitnessGoals,
                workoutsPerWeekTarget: goalData.workoutsPerWeekTarget,
                preferences: goalData.preferences,
                targetDate: goalData.targetDate,
                coachPrescription: goalData.coachPrescription,
                currentWeeklyStreak: latestParticipantGoal?.currentWeeklyStreak || 0,
                lastStreakUpdateEpochWeekId: latestParticipantGoal?.lastStreakUpdateEpochWeekId || dateUtils.getEpochWeekId(new Date()),
                setDate: new Date().toISOString(),
                isCompleted: false,
            };
            updatedParticipantGoals.push(newGoal);
            
            return [...otherParticipantsGoals, ...updatedParticipantGoals];
        });
    };
    
    const sortedNotes = [...notes].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Klientkort: ${participant.name}`} size="4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Notes */}
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800">Anteckningar</h3>
                    <div className="space-y-2">
                        <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Skriv en ny anteckning..."/>
                        <div className="flex gap-2 justify-end">
                            {editingNote && <Button onClick={handleCancelEdit} variant="secondary">Avbryt</Button>}
                            <Button onClick={handleSaveNote} disabled={!newNote.trim()}>{editingNote ? 'Spara ändring' : 'Spara anteckning'}</Button>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2">
                        {sortedNotes.map(note => (
                            <div key={note.id} className="p-3 bg-gray-100 rounded-md">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.noteText}</p>
                                <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                                    <span>{new Date(note.createdDate).toLocaleString('sv-SE')}</span>
                                    <div>
                                        <Button variant="ghost" size="sm" className="!p-1" onClick={() => handleEditClick(note)}>Ändra</Button>
                                        <Button variant="ghost" size="sm" className="!p-1 !text-red-500" onClick={() => setNoteToDelete(note)}>Ta bort</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800">Åtgärder</h3>
                    <div className="space-y-2 flex flex-col">
                        <Button onClick={() => setIsAiInsightModalOpen(true)} variant="outline" disabled={!ai || !isOnline}>
                            {isOnline ? 'Generera AI Insikt' : 'AI Offline'}
                        </Button>
                        <Button onClick={() => setIsGoalModalOpen(true)} variant="outline">Sätt/Uppdatera Mål</Button>
                        <Button onClick={() => setIsCreateWorkoutModalOpen(true)} variant="outline">Skapa Program</Button>
                        <Button onClick={() => setIsBookingModalOpen(true)} variant="outline">Boka 1-on-1</Button>
                    </div>
                </div>
            </div>
        </Modal>

        {/* Action Modals */}
        {isGoalModalOpen && (
            <Modal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} title={`Sätt Mål för ${participant.name}`} size="xl">
                <div>
                     <GoalForm
                        ref={goalFormRef}
                        currentGoalForForm={latestParticipantGoal}
                        allParticipantGoals={allParticipantGoals.filter(g => g.participantId === participant.id)}
                        onSave={handleSaveGoal}
                        showCoachFields={true}
                        ai={ai}
                        isOnline={isOnline}
                    />
                    <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                        <Button onClick={() => setIsGoalModalOpen(false)} variant="secondary">Avbryt</Button>
                        <Button onClick={async () => {
                            if (goalFormRef.current) {
                                const success = await goalFormRef.current.submitForm();
                                if(success) setIsGoalModalOpen(false);
                            }
                        }} variant="primary">Spara Mål</Button>
                    </div>
                </div>
            </Modal>
        )}
        
        {isBookingModalOpen && (
            <BookOneOnOneModal
                isOpen={isBookingModalOpen}
                onClose={() => setIsBookingModalOpen(false)}
                onSave={handleSaveOrUpdateSession}
                participants={participants}
                coaches={coaches}
                preselectedParticipant={participant}
                loggedInCoachId={loggedInCoachId}
                staffAvailability={staffAvailability}
            />
        )}
        
        {isCreateWorkoutModalOpen && (
             <CreateWorkoutModal
                isOpen={isCreateWorkoutModalOpen}
                onClose={() => setIsCreateWorkoutModalOpen(false)}
                onSaveWorkout={(workout) => addWorkout(workout)}
                ai={ai}
                participantToAssign={participant}
                participantGoal={latestParticipantGoal}
                isOnline={isOnline}
            />
        )}
        
        <ConfirmationModal
            isOpen={!!noteToDelete}
            onClose={() => setNoteToDelete(null)}
            onConfirm={() => {
                if (noteToDelete) onDeleteNote(noteToDelete.id);
                setNoteToDelete(null);
            }}
            title="Ta bort Anteckning"
            message="Är du säker på att du vill ta bort denna anteckning? Det kan inte ångras."
            confirmButtonText="Ja, ta bort"
        />
        </>
    );
};