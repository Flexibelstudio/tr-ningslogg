


import React, { useState, useMemo } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote } from '../../types';
import { Button } from '../Button';
import { AddMemberModal } from './AddMemberModal';
import { GoogleGenAI } from '@google/genai';
import { AICoachMemberInsightModal } from './AICoachMemberInsightModal';
import * as dateUtils from '../../utils/dateUtils';
import { MemberNotesModal } from './MemberNotesModal';

interface MemberManagementProps {
  participants: ParticipantProfile[];
  setParticipants: (updater: ParticipantProfile[] | ((prev: ParticipantProfile[]) => ParticipantProfile[])) => void;
  allParticipantGoals: ParticipantGoalData[];
  allActivityLogs: ActivityLog[];
  coachNotes: CoachNote[];
  setCoachNotes: (updater: CoachNote[] | ((prev: CoachNote[]) => CoachNote[])) => void;
  ai: GoogleGenAI | null;
}

const MemberIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
);

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

export const MemberManagement: React.FC<MemberManagementProps> = ({ participants, setParticipants, allParticipantGoals, allActivityLogs, coachNotes, setCoachNotes, ai }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);

  const handleAddMember = (memberData: Omit<ParticipantProfile, 'id' | 'lastUpdated'>) => {
    const newMember: ParticipantProfile = {
      ...memberData,
      id: crypto.randomUUID(),
      lastUpdated: new Date().toISOString(),
    };
    setParticipants(prev => [...prev, newMember].sort((a,b) => (a.name || '').localeCompare(b.name || '')));
  };

  const handleToggleStatus = (participantId: string) => {
    setParticipants(prev =>
      prev.map(p =>
        p.id === participantId ? { ...p, isActive: !(p.isActive ?? true), lastUpdated: new Date().toISOString() } : p
      )
    );
  };

  const handleOpenInsightModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsInsightModalOpen(true);
  }

  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  const detailedParticipantData = useMemo(() => {
    const engagementOrder = { red: 0, yellow: 1, green: 2, neutral: 3 };

    return participants.map(p => {
        const goals = allParticipantGoals.filter(g => g.participantId === p.id);
        const latestGoal = goals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
        
        const logs = allActivityLogs.filter(log => log.participantId === p.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
        const lastLog = logs[0];
        const lastActivityDate = lastLog ? new Date(lastLog.completedDate) : null;
        const daysSinceLastActivity = lastActivityDate ? Math.floor((new Date().getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

        let weeklyProgress = 'N/A';
        if (latestGoal && latestGoal.workoutsPerWeekTarget > 0) {
            const startOfWeek = dateUtils.getStartOfWeek(new Date());
            const logsThisWeek = logs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
            const target = latestGoal.workoutsPerWeekTarget;
            weeklyProgress = `${logsThisWeek}/${target}${logsThisWeek >= target ? ' ✅' : ''}`;
        }

        let engagementLevel: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
        if (p.isActive === false) {
            engagementLevel = 'red';
        } else if (lastActivityDate) {
            if (daysSinceLastActivity > 14) engagementLevel = 'red';
            else if (daysSinceLastActivity > 7) engagementLevel = 'yellow';
            else engagementLevel = 'green';
        }

        return {
            ...p,
            activeGoalSummary: latestGoal?.fitnessGoals || 'Inget mål satt',
            weeklyProgress,
            lastActivityDate,
            engagementLevel,
        }
    }).sort((a,b) => {
        const engagementDiff = engagementOrder[a.engagementLevel] - engagementOrder[b.engagementLevel];
        if (engagementDiff !== 0) return engagementDiff;
        return (a.name || '').localeCompare(b.name || '');
    });
  }, [participants, allParticipantGoals, allActivityLogs]);

  return (
    <div className="mt-10 mb-8 p-4 sm:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800 flex items-center">
                <MemberIcon />
                Medlemsöversikt
            </h2>
            <Button onClick={() => setIsAddModalOpen(true)} className="mt-3 sm:mt-0">
                Lägg till Medlem
            </Button>
        </div>

        <div className="overflow-x-auto">
            {detailedParticipantData.length === 0 ? (
                 <div className="text-center py-10 bg-gray-50 rounded-lg">
                    <p className="text-lg text-gray-500">Inga medlemmar tillagda än.</p>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagemang</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senaste Aktivitet</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktivt Mål</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Veckoprogress</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {detailedParticipantData.map(p => {
                            const { relative: relativeDate, absolute: absoluteDate } = formatRelativeDate(p.lastActivityDate);
                            return (
                                <tr key={p.id} className={p.isActive ? '' : 'bg-gray-100 opacity-60'}>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                        <div className="text-xs text-gray-500">{p.email}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                        <EngagementIndicator level={p.engagementLevel} />
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium" title={absoluteDate}>
                                        {relativeDate}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <p className="truncate max-w-xs" title={p.activeGoalSummary}>
                                          {p.activeGoalSummary}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                        {p.weeklyProgress}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-1">
                                            <Button onClick={() => handleOpenInsightModal(p)} variant="ghost" size="sm" className="!text-xs" disabled={!ai} title="AI Insikt">
                                                AI
                                            </Button>
                                            <Button onClick={() => handleOpenNotesModal(p)} variant="outline" size="sm" className="!text-xs" title="Anteckningar">
                                                Noteringar
                                            </Button>
                                            <Button onClick={() => handleToggleStatus(p.id)} variant={p.isActive ?? true ? 'danger' : 'primary'} size="sm" className="!text-xs">
                                                {p.isActive ?? true ? 'Avaktivera' : 'Aktivera'}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>

        <AddMemberModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAddMember={handleAddMember}
            existingEmails={participants.map(p => p.email).filter((e): e is string => !!e)}
        />
        {ai && selectedParticipant && (
            <AICoachMemberInsightModal
                isOpen={isInsightModalOpen}
                onClose={() => setIsInsightModalOpen(false)}
                ai={ai}
                participant={selectedParticipant}
                goals={allParticipantGoals.filter(g => g.participantId === selectedParticipant.id)}
                logs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
            />
        )}
        {ai && selectedParticipant && (
            <MemberNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                ai={ai}
                participant={selectedParticipant}
                notes={coachNotes.filter(n => n.participantId === selectedParticipant.id)}
                allParticipantGoals={allParticipantGoals.filter(g => g.participantId === selectedParticipant.id)}
                allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
                onAddNote={(noteText) => {
                    const newNote: CoachNote = {
                        id: crypto.randomUUID(),
                        participantId: selectedParticipant.id,
                        noteText,
                        createdDate: new Date().toISOString(),
                        noteType: 'check-in',
                    };
                    setCoachNotes(prev => [...prev, newNote]);
                }}
            />
        )}
    </div>
  );
};