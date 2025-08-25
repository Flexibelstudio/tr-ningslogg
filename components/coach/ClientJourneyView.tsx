import React, { useState, useMemo } from 'react';
import { ParticipantProfile, OneOnOneSession, ActivityLog, StaffMember, CoachNote, ParticipantGoalData, WorkoutLog, Membership } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { Button } from '../Button';
import { MemberNotesModal } from './MemberNotesModal';
import * as dateUtils from '../../utils/dateUtils';
import { InfoModal } from '../participant/InfoModal';
import { useAppContext } from '../../context/AppContext';

interface ClientJourneyViewProps {
  participants: ParticipantProfile[];
  oneOnOneSessions: OneOnOneSession[];
  allActivityLogs: ActivityLog[];
  loggedInStaff: StaffMember | null;
  allParticipantGoals: ParticipantGoalData[];
  coachNotes: CoachNote[];
  ai: GoogleGenAI | null;
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

interface ClientJourneyEntry extends ParticipantProfile {
  phase: 'Startprogram' | 'Medlem' | 'Riskzon';
  phaseColorClass: string;
  progressText: string;
  nextActionText: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  lastActivityDate: Date | null;
  engagementLevel: 'green' | 'yellow' | 'red' | 'neutral';
}

export const ClientJourneyView: React.FC<ClientJourneyViewProps> = ({
  participants,
  oneOnOneSessions,
  allActivityLogs,
  loggedInStaff,
  allParticipantGoals,
  coachNotes,
  ai,
  isOnline,
}) => {
    const {
        memberships,
        integrationSettings,
        workoutLogs,
        setParticipantGoalsData,
        setGoalCompletionLogsData,
        setCoachNotesData,
        setOneOnOneSessionsData,
        workouts,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        workoutCategories,
        staffAvailability,
        staffMembers
    } = useAppContext();
    
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const journeyData = useMemo<ClientJourneyEntry[]>(() => {
    return participants
      .filter(p => p.isActive || p.isProspect)
      .map(p => {
        const today = new Date();
        const referenceDateString = p.startDate || p.creationDate;
        if (!referenceDateString) return null; // Skip participants without a start/creation date
        const referenceDate = new Date(referenceDateString);
        const daysSinceStart = Math.floor((today.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        const myLogs = allActivityLogs.filter(l => l.participantId === p.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
        const myWorkoutLogs = workoutLogs.filter(l => l.participantId === p.id);
        const logsLast21Days = myLogs.filter(l => new Date(l.completedDate) > new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)).length;
        
        const lastActivityDate = myLogs[0] ? new Date(myLogs[0].completedDate) : null;
        const daysSinceLastActivity = lastActivityDate ? Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

        let engagementLevel: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
        if (lastActivityDate) {
            if (daysSinceLastActivity > 14) engagementLevel = 'red';
            else if (daysSinceLastActivity > 7) engagementLevel = 'yellow';
            else engagementLevel = 'green';
        }

        let finalEntry: Omit<ClientJourneyEntry, keyof ParticipantProfile>;
        
        // 1. Riskzon (highest priority)
        if (!p.isProspect && logsLast21Days < 4 && daysSinceStart > 14) {
            finalEntry = {
                phase: 'Riskzon',
                phaseColorClass: 'bg-red-100 text-red-800',
                progressText: `${logsLast21Days} pass/21d`,
                nextActionText: 'Kontakta - låg aktivitet',
                nextActionPriority: 'high',
                lastActivityDate,
                engagementLevel,
            };
        }
        // 2. Startprogram
        else if (p.isProspect) {
            const { startProgramCategoryId, startProgramSessionsRequired } = integrationSettings;
            const startProgramCategory = workoutCategories.find(c => c.id === startProgramCategoryId);
            
            let progressText = 'Startprogram (ej konf.)';
            let nextActionText = 'Konfigurera startprogram';
            let nextActionPriority: 'high' | 'medium' | 'low' = 'high';

            if (startProgramCategory && startProgramSessionsRequired && startProgramSessionsRequired > 0) {
                const completedCount = myWorkoutLogs.filter(log => {
                    const workout = workouts.find(w => w.id === log.workoutId);
                    return workout?.category === startProgramCategory.name;
                }).length;
                
                progressText = `${completedCount}/${startProgramSessionsRequired} startpass`;
                
                if (completedCount >= startProgramSessionsRequired) {
                    nextActionText = 'Konvertera till medlem!';
                    nextActionPriority = 'high';
                } else {
                    nextActionText = `Följ upp startpass #${completedCount + 1}`;
                    nextActionPriority = 'medium';
                }
            }
            
            finalEntry = {
                phase: 'Startprogram',
                phaseColorClass: 'bg-blue-100 text-blue-800',
                progressText: progressText,
                nextActionText: nextActionText,
                nextActionPriority: nextActionPriority,
                lastActivityDate,
                engagementLevel,
            };
        }
        // 3. Medlem
        else {
            const membership = memberships.find(m => m.id === p.membershipId);
            const checkInSessions = oneOnOneSessions.filter(s => s.participantId === p.id && s.title === 'Avstämningssamtal' && s.status === 'completed').sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
            const daysSinceLastCheckin = checkInSessions[0] ? Math.floor((today.getTime() - new Date(checkInSessions[0].startTime).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceStart;

            let nextActionText = 'Fortsätt peppa!';
            let nextActionPriority: 'high' | 'medium' | 'low' = 'low';

            if (daysSinceLastCheckin > 120) {
                nextActionText = 'Dags för avstämning!';
                nextActionPriority = 'high';
            } else if (daysSinceLastCheckin > 90) {
                nextActionText = 'Boka in avstämning snart';
                nextActionPriority = 'medium';
            }

            finalEntry = {
                phase: 'Medlem',
                phaseColorClass: 'bg-green-100 text-green-800',
                progressText: membership?.name || 'Aktiv',
                nextActionText,
                nextActionPriority,
                lastActivityDate,
                engagementLevel,
            };
        }
        
        return { ...p, ...finalEntry };
      }).filter((p): p is ClientJourneyEntry => p !== null);
  }, [participants, oneOnOneSessions, allActivityLogs, memberships, integrationSettings, workoutLogs, workouts, workoutCategories]);


  const filteredAndSortedData = useMemo(() => {
    let data = journeyData;
    if (activeFilter === 'riskzon') {
        data = data.filter(p => p.phase === 'Riskzon');
    } else if (activeFilter === 'startprogram') {
        data = data.filter(p => p.phase === 'Startprogram');
    } else if (activeFilter === 'checkin') {
        data = data.filter(p => p.phase === 'Medlem' && p.nextActionPriority !== 'low');
    }

    return data.sort((a, b) => {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return priorityOrder[a.nextActionPriority] - priorityOrder[b.nextActionPriority];
    });
  }, [journeyData, activeFilter]);
  
  const counts = useMemo(() => {
    const riskzon = journeyData.filter(p => p.phase === 'Riskzon').length;
    const startprogram = journeyData.filter(p => p.phase === 'Startprogram').length;
    const checkin = journeyData.filter(p => p.phase === 'Medlem' && p.nextActionPriority !== 'low').length;
    return { riskzon, startprogram, checkin };
  }, [journeyData]);

  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  if (!loggedInStaff) return <div>Laddar...</div>;

  const priorityClasses: Record<'high' | 'medium' | 'low', string> = {
    high: 'border-red-500 bg-red-50 text-red-700',
    medium: 'border-yellow-500 bg-yellow-50 text-yellow-700',
    low: 'border-green-500 bg-green-50 text-green-700',
  };

  const StatCard: React.FC<{ title: string; value: number; icon: string; onClick: () => void; isActive: boolean }> = ({ title, value, icon, onClick, isActive }) => (
    <button onClick={onClick} className={`p-4 rounded-xl shadow-md flex items-start text-left transition-all duration-200 border-2 ${isActive ? 'bg-flexibel/10 border-flexibel' : 'bg-white border-transparent hover:border-gray-300'}`}>
        <div className="text-3xl mr-4">{icon}</div>
        <div>
            <h4 className="text-sm font-semibold text-gray-500">{title}</h4>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-lg border">
        <div>
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">Fokusområden
                <button onClick={() => setIsInfoModalOpen(true)} className="text-gray-400 hover:text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
            </h3>
            <p className="text-sm text-gray-600">Klicka för att filtrera listan och se vilka medlemmar som behöver din uppmärksamhet.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
            <StatCard title="Riskzon" value={counts.riskzon} icon="⚠️" onClick={() => setActiveFilter(activeFilter === 'riskzon' ? null : 'riskzon')} isActive={activeFilter === 'riskzon'} />
            <StatCard title="Startprogram" value={counts.startprogram} icon="🚀" onClick={() => setActiveFilter(activeFilter === 'startprogram' ? null : 'startprogram')} isActive={activeFilter === 'startprogram'} />
            <StatCard title="Behöver Check-in" value={counts.checkin} icon="💬" onClick={() => setActiveFilter(activeFilter === 'checkin' ? null : 'checkin')} isActive={activeFilter === 'checkin'} />
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow border">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fas</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Framsteg / Medlemskap</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senaste Aktivitet</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nästa Steg</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedData.map(p => {
                    const { relative: relativeDate } = formatRelativeDate(p.lastActivityDate);
                    return (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap">
                                <button onClick={() => handleOpenNotesModal(p)} className="text-left w-full">
                                    <div className="flex items-center gap-2">
                                        <EngagementIndicator level={p.engagementLevel} />
                                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                    </div>
                                    <div className="text-xs text-gray-500">{p.email}</div>
                                </button>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.phaseColorClass}`}>
                                    {p.phase}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                <span>{p.progressText}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{relativeDate}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityClasses[p.nextActionPriority]}`}>
                                    {p.nextActionText}
                                </span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {filteredAndSortedData.length === 0 && (
            <div className="text-center p-6 text-gray-500">Inga medlemmar matchar de valda filtren.</div>
        )}
      </div>

      {selectedParticipant && (
        <MemberNotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            ai={ai}
            participant={selectedParticipant}
            notes={coachNotes.filter(n => n.participantId === selectedParticipant.id)}
            allParticipantGoals={allParticipantGoals}
            setParticipantGoals={setParticipantGoalsData}
            allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
            setGoalCompletionLogs={setGoalCompletionLogsData}
            onAddNote={(noteText) => setCoachNotesData(prev => [...prev, { id: crypto.randomUUID(), participantId: selectedParticipant.id, noteText, createdDate: new Date().toISOString(), noteType: 'check-in' }])}
            onUpdateNote={(noteId, newText) => {
                setCoachNotesData(prev => prev.map(note => 
                    note.id === noteId 
                    ? { ...note, noteText: newText, createdDate: new Date().toISOString() } 
                    : note
                ));
            }}
            onDeleteNote={(noteId) => {
                setCoachNotesData(prev => prev.filter(note => note.id !== noteId));
            }}
            oneOnOneSessions={oneOnOneSessions}
            setOneOnOneSessions={setOneOnOneSessionsData}
            coaches={staffMembers}
            loggedInCoachId={loggedInStaff!.id}
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
      
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="Om Klientresan"
      >
          <div className="space-y-2 text-base text-gray-700">
            <p>Klientresan är ett verktyg för att ge dig en snabb överblick över var dina medlemmar befinner sig och vem som kan behöva extra uppmärksamhet.</p>
            <p><strong>Faserna betyder:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
                <li><strong>Riskzon:</strong> Medlemmar vars aktivitet har sjunkit markant. Dessa är högst prioriterade att kontakta.</li>
                <li><strong>Startprogram:</strong> Helt nya medlemmar i sin onboarding-process. Målet är att de ska slutföra de definierade startpassen.</li>
                <li><strong>Medlem:</strong> Etablerade medlemmar. Fokus ligger på att bibehålla motivation och följa upp med regelbundna avstämningar.</li>
            </ul>
            <p>Använd "Nästa Steg"-kolumnen för att proaktivt nå ut och stötta dina medlemmar!</p>
          </div>
      </InfoModal>
    </div>
  );
};
