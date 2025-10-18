import React, { useState, useMemo } from 'react';
import { StaffMember, ParticipantProfile, ActivityLog, CoachNote, ParticipantGoalData, Location, Membership, OneOnOneSession, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { MemberNotesModal } from './MemberNotesModal';
import { GoogleGenAI } from '@google/genai';
import * as dateUtils from '../../utils/dateUtils';
import { Button } from '../Button';

interface LimitedCoachViewProps {
    currentStaff: StaffMember;
    participants: ParticipantProfile[];
    allParticipantGoals: ParticipantGoalData[];
    setParticipantGoals: (goals: ParticipantGoalData[] | ((prev: ParticipantGoalData[]) => ParticipantGoalData[])) => void;
    allActivityLogs: ActivityLog[];
    setGoalCompletionLogs: (logs: GoalCompletionLog[] | ((prev: GoalCompletionLog[]) => GoalCompletionLog[])) => void;
    coachNotes: CoachNote[];
    setCoachNotes: (updater: CoachNote[] | ((prev: CoachNote[]) => CoachNote[])) => void;
    locations: Location[];
    memberships: Membership[];
    oneOnOneSessions: OneOnOneSession[];
    setOneOnOneSessions: (sessions: OneOnOneSession[] | ((prev: OneOnOneSession[]) => OneOnOneSession[])) => void;
    staffMembers: StaffMember[];
    workouts: Workout[];
    setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
    workoutCategories: WorkoutCategoryDefinition[];
    staffAvailability: StaffAvailability[];
    isOnline: boolean;
}

const EngagementIndicator: React.FC<{ level: 'green' | 'yellow' | 'red' | 'neutral' }> = ({ level }) => {
    const levelConfig = {
        green: { color: 'bg-green-500', tooltip: 'Aktiv nyligen' },
        yellow: { color: 'bg-yellow-500', tooltip: 'Minskad aktivitet' },
        red: { color: 'bg-red-500', tooltip: 'Inaktiv / Riskzon' },
        neutral: { color: 'bg-gray-400', tooltip: 'Ingen loggad aktivitet' },
    };
    const { color, tooltip } = levelConfig[level];
    return <span className={`inline-block h-3 w-3 rounded-full ${color}`} title={tooltip}></span>;
};

const formatRelativeDate = (date: Date | null): { absolute: string, relative: string } => {
    if (!date) return { absolute: '', relative: 'Aldrig' };
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
    let relative = '';
    if (diffDays === 0) relative = 'Idag';
    else if (diffDays === 1) relative = 'Igår';
    else if (diffDays <= 7) relative = `För ${diffDays} dgr sedan`;
    else if (diffDays <= 30) relative = `För ${Math.floor(diffDays / 7)}v sedan`;
    else relative = date.toLocaleDateString('sv-SE');
    
    return {
        absolute: date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }),
        relative: relative
    };
};

export const LimitedCoachView: React.FC<LimitedCoachViewProps> = ({
    currentStaff,
    participants,
    allParticipantGoals,
    setParticipantGoals,
    allActivityLogs,
    setGoalCompletionLogs,
    coachNotes,
    setCoachNotes,
    locations,
    memberships,
    oneOnOneSessions,
    setOneOnOneSessions,
    staffMembers,
    workouts,
    setWorkouts,
    workoutCategories,
    staffAvailability,
    isOnline,
}) => {
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);

    const coachLocationName = useMemo(() => {
        const location = locations.find(loc => loc.id === currentStaff.locationId);
        return location?.name || 'Okänd Ort';
    }, [currentStaff.locationId, locations]);

    const handleOpenNotesModal = (participant: ParticipantProfile) => {
        setSelectedParticipant(participant);
        setIsNotesModalOpen(true);
    };

    const membersForCoach = useMemo(() => {
        return participants
            .filter(p => p.locationId === currentStaff.locationId) // Show all, including prospects
            .map(p => {
                const logs = allActivityLogs.filter(log => log.participantId === p.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
                const lastLog = logs[0];
                const lastActivityDate = lastLog ? new Date(lastLog.completedDate) : null;
                const daysSinceLastActivity = lastActivityDate ? Math.floor((new Date().getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

                let engagementLevel: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
                if (p.isProspect) {
                    // Prospects don't have an engagement level in the same way
                    engagementLevel = 'neutral';
                } else if (p.isActive === false) {
                    engagementLevel = 'red';
                } else if (lastActivityDate) {
                    if (daysSinceLastActivity > 14) engagementLevel = 'red';
                    else if (daysSinceLastActivity > 7) engagementLevel = 'yellow';
                    else engagementLevel = 'green';
                }
                
                return {
                    ...p,
                    lastActivityDate,
                    engagementLevel
                };
            })
            .sort((a, b) => a.name?.localeCompare(b.name || '') || 0);
    }, [participants, allActivityLogs, currentStaff.locationId]);

    const addWorkout = async (workout: Workout) => {
        setWorkouts(prev => [...prev, workout]);
    };

    const updateWorkout = async (workout: Workout) => {
        setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
    };

    const deleteWorkout = async (workoutId: string) => {
        setWorkouts(prev => prev.filter(w => w.id !== workoutId));
    };

    return (
        <div className="container mx-auto p-4 sm:p-6">
            <h2 className="text-3xl font-bold tracking-tight text-gray-800">Medlemmar på {coachLocationName}</h2>
            <p className="mt-1 text-lg text-gray-600">Enkel översikt för att följa upp medlemmar.</p>

            <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagemang</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senaste Aktivitet</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {membersForCoach.map(p => {
                            const { relative: relativeDate, absolute: absoluteDate } = formatRelativeDate(p.lastActivityDate);
                            return (
                                <tr key={p.id}>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                            {p.name}
                                            {p.isProspect && <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Prospekt</span>}
                                        </div>
                                        <div className="text-xs text-gray-500">{p.email}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                        <EngagementIndicator level={p.engagementLevel} />
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium" title={absoluteDate}>
                                        {p.isProspect ? '-' : relativeDate}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <Button onClick={() => handleOpenNotesModal(p)} variant="outline" size="sm" className="!text-xs">
                                            Visa/Skriv Anteckning
                                        </Button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {membersForCoach.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-lg">
                        <p className="text-lg text-gray-500">Inga medlemmar att visa för din ort.</p>
                    </div>
                 )}
            </div>

            {selectedParticipant && (
                <MemberNotesModal
                    isOpen={isNotesModalOpen}
                    onClose={() => setIsNotesModalOpen(false)}
                    participant={selectedParticipant}
                    notes={coachNotes.filter(n => n.participantId === selectedParticipant.id)}
                    allParticipantGoals={allParticipantGoals}
                    setParticipantGoals={setParticipantGoals}
                    allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
                    setGoalCompletionLogs={setGoalCompletionLogs}
                    onAddNote={(noteText) => {
                        const newNote: CoachNote = {
                            id: crypto.randomUUID(),
                            participantId: selectedParticipant.id,
                            noteText,
                            createdDate: new Date().toISOString(),
                            noteType: selectedParticipant.isProspect ? 'intro-session' : 'check-in',
                        };
                        setCoachNotes(prev => [...prev, newNote]);
                    }}
                    onUpdateNote={(noteId, newText) => {
                        setCoachNotes(prev => prev.map(note => 
                            note.id === noteId 
                            ? { ...note, noteText: newText, createdDate: new Date().toISOString() } 
                            : note
                        ));
                    }}
                    onDeleteNote={(noteId) => {
                        setCoachNotes(prev => prev.filter(note => note.id !== noteId));
                    }}
                    oneOnOneSessions={oneOnOneSessions}
                    setOneOnOneSessions={setOneOnOneSessions}
                    coaches={staffMembers}
                    loggedInCoachId={currentStaff.id}
                    workouts={workouts}
                    addWorkout={addWorkout}
                    updateWorkout={updateWorkout}
                    deleteWorkout={deleteWorkout}
                    workoutCategories={workoutCategories}
                    participants={participants}
                    staffAvailability={staffAvailability}
                    isOnline={isOnline}
                />
            )}
        </div>
    );
};