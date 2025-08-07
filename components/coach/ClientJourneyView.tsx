import React, { useState, useMemo } from 'react';
import { ParticipantProfile, OneOnOneSession, ActivityLog, Location, StaffMember, CoachNote, ParticipantGoalData, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { Select } from '../Input';
import { Button } from '../Button';
import { MemberNotesModal } from './MemberNotesModal';
import * as dateUtils from '../../utils/dateUtils';
import { InfoModal } from '../participant/InfoModal';


interface ClientJourneyViewProps {
  participants: ParticipantProfile[];
  oneOnOneSessions: OneOnOneSession[];
  allActivityLogs: ActivityLog[];
  locations: Location[];
  staffMembers: StaffMember[];
  loggedInStaff: StaffMember | null;
  allParticipantGoals: ParticipantGoalData[];
  setParticipantGoals: (goals: ParticipantGoalData[] | ((prev: ParticipantGoalData[]) => ParticipantGoalData[])) => void;
  setGoalCompletionLogs: (logs: GoalCompletionLog[] | ((prev: GoalCompletionLog[]) => GoalCompletionLog[])) => void;
  coachNotes: CoachNote[];
  setCoachNotes: (notes: CoachNote[] | ((prev: CoachNote[]) => CoachNote[])) => void;
  setOneOnOneSessions: (sessions: OneOnOneSession[] | ((prev: OneOnOneSession[]) => OneOnOneSession[])) => void;
  ai: GoogleGenAI | null;
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
  workoutCategories: WorkoutCategoryDefinition[];
  staffAvailability: StaffAvailability[];
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
  phase: 'Onboarding' | 'Gruppträning' | 'Långsiktig' | 'Riskzon' | 'Okänd';
  phaseColorClass: string;
  progressType: 'bar' | 'text';
  progressValue: number;
  progressMax?: number;
  progressText: string;
  nextActionText: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  daysSinceStart: number;
  engagementLevel: 'green' | 'yellow' | 'red' | 'neutral';
  lastActivityDate: Date | null;
  activeGoalSummary: string;
  weeklyProgress: string;
}

const StatCard: React.FC<{ title: string; value: number; icon: string; onClick: () => void; isActive: boolean }> = ({ title, value, icon, onClick, isActive }) => (
    <button onClick={onClick} className={`p-4 rounded-xl shadow-md flex items-start text-left transition-all duration-200 border-2 ${isActive ? 'bg-flexibel/10 border-flexibel' : 'bg-white border-transparent hover:border-gray-300'}`}>
        <div className="text-3xl mr-4">{icon}</div>
        <div>
            <h4 className="text-sm font-semibold text-gray-500">{title}</h4>
            <p className="text-4xl font-bold text-gray-800">{value}</p>
        </div>
    </button>
);


export const ClientJourneyView: React.FC<ClientJourneyViewProps> = ({
  participants,
  oneOnOneSessions,
  allActivityLogs,
  locations,
  staffMembers,
  loggedInStaff,
  allParticipantGoals,
  setParticipantGoals,
  setGoalCompletionLogs,
  coachNotes,
  setCoachNotes,
  setOneOnOneSessions,
  ai,
  workouts,
  setWorkouts,
  workoutCategories,
  staffAvailability,
}) => {
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const { onboardingCount, checkinCount, expiringCount } = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let onboarding = 0;
    const needsCheckinIds = new Set<string>();
    let expiring = 0;

    for (const p of participants) {
        if (!p.isActive || !p.startDate) continue;
        
        const startDate = new Date(p.startDate);
        const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceStart >= 0 && daysSinceStart <= 30) {
            onboarding++;
        }
        
        // Logic to determine if a check-in is due
        const completedCheckInSessions = oneOnOneSessions.filter(s => s.participantId === p.id && s.title === 'Avstämningssamtal' && s.status === 'completed');
        const hasCompletedCheckInAroundDays = (day: number, range: number) => {
             const targetDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
             return completedCheckInSessions.some(s => {
                const sessionDate = new Date(s.startTime);
                const diffDays = Math.abs((sessionDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= range;
             });
        };

        if ((daysSinceStart >= 30 && !hasCompletedCheckInAroundDays(30, 15)) ||
            (daysSinceStart >= 60 && !hasCompletedCheckInAroundDays(60, 15)) ||
            (daysSinceStart >= 90 && !hasCompletedCheckInAroundDays(90, 15))) {
            needsCheckinIds.add(p.id);
        } else if (daysSinceStart > 90) {
            const lastCheckIn = completedCheckInSessions.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
            const daysSinceLastCheckIn = lastCheckIn ? Math.floor((now.getTime() - new Date(lastCheckIn.startTime).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceStart;
            if (daysSinceLastCheckIn > 90) {
                needsCheckinIds.add(p.id);
            }
        }
        
        // Expiring Memberships
        if (p.endDate) {
            const endDate = new Date(p.endDate);
            if (endDate > now && endDate < thirtyDaysFromNow) {
                expiring++;
            }
        }
    }
    
    return {
        onboardingCount: onboarding,
        checkinCount: needsCheckinIds.size,
        expiringCount: expiring,
    };
  }, [participants, oneOnOneSessions]);


  const journeyData = useMemo<ClientJourneyEntry[]>(() => {
    return participants
      .filter(p => p.isActive && p.startDate)
      .map(p => {
        const today = new Date();
        const startDate = new Date(p.startDate!);
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        const myCompletedSessions = oneOnOneSessions.filter(s => s.participantId === p.id && s.status === 'completed');
        const ptPassCount = myCompletedSessions.filter(s => s.title === 'PT-pass').length;
        const checkInSessions = myCompletedSessions.filter(s => s.title === 'Avstämningssamtal').sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        
        const myLogs = allActivityLogs.filter(l => l.participantId === p.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
        const logsLast21Days = myLogs.filter(l => new Date(l.completedDate) > new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)).length;
        
        const lastActivityDate = myLogs[0] ? new Date(myLogs[0].completedDate) : null;
        const daysSinceLastActivity = lastActivityDate ? Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

        let engagementLevel: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
        if (p.isActive === false) {
            engagementLevel = 'red';
        } else if (lastActivityDate) {
            if (daysSinceLastActivity > 14) engagementLevel = 'red';
            else if (daysSinceLastActivity > 7) engagementLevel = 'yellow';
            else engagementLevel = 'green';
        }
        
        const goals = allParticipantGoals.filter(g => g.participantId === p.id);
        const latestGoal = goals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
        
        let weeklyProgress = 'N/A';
        if (latestGoal && latestGoal.workoutsPerWeekTarget > 0) {
            const startOfWeek = dateUtils.getStartOfWeek(new Date());
            const logsThisWeek = myLogs.filter(log => new Date(log.completedDate) >= startOfWeek).length;
            const target = latestGoal.workoutsPerWeekTarget;
            weeklyProgress = `${logsThisWeek}/${target}${logsThisWeek >= target ? ' ✅' : ''}`;
        }

        let entry: Partial<ClientJourneyEntry> = {
            activeGoalSummary: latestGoal?.fitnessGoals || 'Inget mål satt',
            weeklyProgress,
            lastActivityDate,
            engagementLevel,
        };

        // 1. Riskzon (override)
        if (logsLast21Days < 4 && daysSinceStart > 14) {
          entry = {
            ...entry,
            phase: 'Riskzon',
            phaseColorClass: 'bg-red-100 text-red-800',
            progressType: 'text', progressText: `${logsLast21Days} pass/21d`, progressValue: logsLast21Days,
            nextActionText: 'Kontakta - låg aktivitet',
            nextActionPriority: 'high',
          };
        }
        // 2. Onboarding
        else if (ptPassCount < 4 && daysSinceStart < 45) { // Extended grace period to 45 days
          const myScheduledPTSessions = oneOnOneSessions.filter(s =>
            s.participantId === p.id &&
            s.status === 'scheduled' &&
            s.title === 'PT-pass' &&
            new Date(s.startTime) > new Date()
          ).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

          let nextActionTextForOnboarding = `Boka/följ upp PT-pass #${ptPassCount + 1}`;
          let nextActionPriorityForOnboarding: 'high' | 'medium' | 'low' = 'medium';
          
          if (myScheduledPTSessions.length > 0) {
            const nextSession = myScheduledPTSessions[0];
            const sessionDate = new Date(nextSession.startTime).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            nextActionTextForOnboarding = `PT-pass #${ptPassCount + 1} bokat: ${sessionDate}`;
            nextActionPriorityForOnboarding = 'low';
          }

          entry = {
            ...entry,
            phase: 'Onboarding',
            phaseColorClass: 'bg-blue-100 text-blue-800',
            progressType: 'bar', progressText: `${ptPassCount} / 4 PT-pass`, progressValue: ptPassCount, progressMax: 4,
            nextActionText: nextActionTextForOnboarding,
            nextActionPriority: nextActionPriorityForOnboarding,
          };
        }
        // 3. Post-Onboarding Journey
        else {
          const hasCheckInAroundDays = (day: number, range: number) => {
             const targetDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
             return checkInSessions.some(s => {
                const sessionDate = new Date(s.startTime);
                const diffDays = Math.abs((sessionDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= range;
             });
          };

          if (daysSinceStart >= 30 && !hasCheckInAroundDays(30, 15)) {
             entry = { ...entry, phase: 'Gruppträning', nextActionText: 'Dags för 30-dagars avstämning!', nextActionPriority: 'high' };
          } else if (daysSinceStart >= 60 && !hasCheckInAroundDays(60, 15)) {
             entry = { ...entry, phase: 'Gruppträning', nextActionText: 'Dags för 60-dagars avstämning!', nextActionPriority: 'high' };
          } else if (daysSinceStart >= 90 && !hasCheckInAroundDays(90, 15)) {
             entry = { ...entry, phase: 'Gruppträning', nextActionText: 'Dags för 90-dagars avstämning!', nextActionPriority: 'high' };
          }
          // Långsiktig (Quarterly check-ins)
          else if (daysSinceStart > 90) {
            const lastCheckIn = checkInSessions[0];
            const daysSinceLastCheckIn = lastCheckIn ? Math.floor((today.getTime() - new Date(lastCheckIn.startTime).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceStart;
            if (daysSinceLastCheckIn > 90) {
              entry = { ...entry, phase: 'Långsiktig', nextActionText: 'Dags för kvartalsavstämning!', nextActionPriority: 'high' };
            } else {
              entry = { ...entry, phase: 'Långsiktig', nextActionText: `Nästa avstämning om ${90 - daysSinceLastCheckIn} dagar`, nextActionPriority: 'low' };
            }
          }
          // Default state for those in Gruppträning but up-to-date on check-ins
          else {
            entry = { ...entry, phase: 'Gruppträning', nextActionText: 'I fas', nextActionPriority: 'low' };
          }

          if (!entry.phase) entry.phase = 'Gruppträning';
          entry.phaseColorClass = entry.phase === 'Långsiktig' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800';
          entry.progressType = 'text';
          entry.progressText = `Medlem i ${daysSinceStart} dagar`;
          entry.progressValue = daysSinceStart;
        }

        return { ...p, daysSinceStart, ...entry } as ClientJourneyEntry;
      })
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.nextActionPriority] !== priorityOrder[b.nextActionPriority]) {
            return priorityOrder[a.nextActionPriority] - priorityOrder[b.nextActionPriority];
        }
        return a.daysSinceStart - b.daysSinceStart;
      });
  }, [participants, oneOnOneSessions, allActivityLogs, allParticipantGoals]);

  const handleFilterClick = (filter: string) => {
    setActiveFilter(prev => (prev === filter ? null : filter));
  };

  const filteredParticipants = useMemo(() => {
    if (!activeFilter) {
      return journeyData;
    }
    const now = new Date();
    if (activeFilter === 'onboarding') {
        return journeyData.filter(p => p.phase === 'Onboarding');
    }
    if (activeFilter === 'checkin') {
        return journeyData.filter(p => p.nextActionPriority === 'high' && p.nextActionText.includes('avstämning'));
    }
    if (activeFilter === 'expiring') {
        return journeyData.filter(p => {
            if (!p.endDate) return false;
            const endDate = new Date(p.endDate);
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            return endDate > now && endDate < thirtyDaysFromNow;
        });
    }
    return journeyData;
  }, [activeFilter, journeyData]);


  const locationOptions = useMemo(() => [
    { value: 'all', label: 'Alla Orter' },
    ...locations.map(loc => ({ value: loc.id, label: loc.name }))
  ], [locations]);

  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  const journeyInfoContent = (
    <div className="space-y-4 text-base text-gray-700">
        <p>Denna vy ger en översikt över var medlemmarna befinner sig i sin resa hos oss, och flaggar proaktivt när det är dags för en coach att agera.</p>
        <h4 className="font-semibold text-lg">Faser:</h4>
        <ul className="list-disc pl-5 space-y-2">
            <li><strong>Onboarding:</strong> Medlemmens första 30 dagar, där målet är att genomföra fyra PT-pass.</li>
            <li><strong>Gruppträning:</strong> Efter onboarding, där fokus ligger på regelbundna avstämningar vid 30, 60 och 90 dagar.</li>
            <li><strong>Långsiktig:</strong> Medlemmar som varit hos oss i över 90 dagar, med kvartalsvisa avstämningar.</li>
            <li><strong>Riskzon:</strong> Medlemmar som visar tecken på minskad aktivitet (mindre än 4 pass de senaste 21 dagarna).</li>
        </ul>
        <h4 className="font-semibold text-lg">Nästa Åtgärd:</h4>
        <p>Detta fält visar vad som rekommenderas härnäst för att säkerställa medlemmens framgång och engagemang. Listan är sorterad så att de medlemmar som behöver din uppmärksamhet mest hamnar högst upp.</p>
    </div>
  );

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-gray-800">Klientresan</h2>
                <button
                    type="button"
                    onClick={() => setIsInfoModalOpen(true)}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-flexibel/10 text-flexibel border border-flexibel text-sm font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-flexibel"
                    aria-label="Läs mer om Klientresan"
                >
                    i
                </button>
            </div>
            
            {loggedInStaff?.role === 'Admin' && (
                <Select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    options={locationOptions}
                    inputSize="sm"
                    containerClassName="w-full sm:w-auto"
                />
            )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard title="I Onboarding (30d)" value={onboardingCount} icon="🚀" onClick={() => handleFilterClick('onboarding')} isActive={activeFilter === 'onboarding'}/>
            <StatCard title="Avstämningar Att Boka" value={checkinCount} icon="🗣️" onClick={() => handleFilterClick('checkin')} isActive={activeFilter === 'checkin'}/>
            <StatCard title="Medlemskap Löper Ut (30d)" value={expiringCount} icon="⏳" onClick={() => handleFilterClick('expiring')} isActive={activeFilter === 'expiring'}/>
        </div>
        
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fas</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Aktivt Mål</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Veckoprogress</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nästa Åtgärd</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredParticipants.map(p => {
                        const { relative: relativeDate } = formatRelativeDate(p.lastActivityDate);
                        const priorityClasses = {
                            high: 'bg-red-200 text-red-800',
                            medium: 'bg-yellow-200 text-yellow-800',
                            low: 'bg-green-200 text-green-800'
                        };

                        return (
                            <tr key={p.id}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <EngagementIndicator level={p.engagementLevel} />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                            <div className="text-xs text-gray-500">Senast aktiv: {relativeDate}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.phaseColorClass}`}>
                                        {p.phase}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                    {p.progressType === 'bar' && p.progressMax ? (
                                        <div className="w-32">
                                            <div className="relative pt-1">
                                                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                                                    <div style={{ width: `${(p.progressValue / p.progressMax) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-flexibel"></div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-center font-semibold">{p.progressText}</p>
                                        </div>
                                    ) : (
                                        <p>{p.progressText}</p>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell truncate max-w-xs">{p.activeGoalSummary}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-700 hidden lg:table-cell">{p.weeklyProgress}</td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${priorityClasses[p.nextActionPriority]}`}>
                                        {p.nextActionText}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                    <Button onClick={() => handleOpenNotesModal(p)} variant="outline" size="sm" className="!text-xs">
                                        Klientkort
                                    </Button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {filteredParticipants.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded-lg">
                    <p className="text-lg text-gray-500">Inga medlemmar att visa för detta filter.</p>
                </div>
            )}
        </div>

        {ai && selectedParticipant && loggedInStaff && (
            <MemberNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                ai={ai}
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
                oneOnOneSessions={oneOnOneSessions}
                setOneOnOneSessions={setOneOnOneSessions}
                coaches={staffMembers}
                loggedInCoachId={loggedInStaff.id}
                workouts={workouts}
                setWorkouts={setWorkouts}
                workoutCategories={workoutCategories}
                participants={participants}
                staffAvailability={staffAvailability}
            />
        )}
        
        <InfoModal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            title="Om Klientresan"
        >
            {journeyInfoContent}
        </InfoModal>
    </div>
  );
};