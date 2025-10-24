import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, OneOnOneSession, StaffMember, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability, UserStrengthStat, ParticipantConditioningStat, ParticipantPhysiqueStat, ParticipantClubMembership, WorkoutLog, GeneralActivityLog } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { BookOneOnOneModal } from './BookOneOnOneModal';
import { GoalForm, GoalFormRef } from '../participant/GoalForm';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { ParticipantDashboardView } from '../participant/ParticipantDashboardView';
import { useAppContext } from '../../context/AppContext';
import { StrengthComparisonModal } from '../participant/StrengthComparisonModal';
import { ConditioningStatsModal } from '../participant/ConditioningStatsModal';
import { PhysiqueManagerModal } from '../participant/PhysiqueManagerModal';
import { Select } from '../Input';
import { callGeminiApiFn } from '../../firebaseClient';
import { renderMarkdown } from '../../utils/textUtils';

interface MemberNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
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

type MemberNotesTab = 'notes' | 'goals' | 'sessions' | 'program';

export const MemberNotesModal: React.FC<MemberNotesModalProps> = ({
  isOpen,
  onClose,
  participant,
  notes,
  allParticipantGoals,
  setParticipantGoals,
  allActivityLogs,
  setGoalCompletionLogs,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  oneOnOneSessions,
  setOneOnOneSessions,
  coaches,
  loggedInCoachId,
  workouts,
  addWorkout,
  updateWorkout,
  deleteWorkout,
  workoutCategories,
  participants,
  staffAvailability,
  isOnline,
}) => {
    const { 
        userStrengthStats, setUserStrengthStatsData, 
        userConditioningStatsHistory, setUserConditioningStatsHistoryData,
        participantPhysiqueHistory, setParticipantPhysiqueHistoryData,
        clubMemberships,
        updateParticipantProfile
    } = useAppContext();

  const [activeTab, setActiveTab] = useState<MemberNotesTab>('notes');
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<CoachNote | null>(null);

  const [isLoadingAiSummary, setIsLoadingAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<OneOnOneSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<OneOnOneSession | null>(null);
  const [templateToAssign, setTemplateToAssign] = useState<string>('');
  const [assignSuccessMessage, setAssignSuccessMessage] = useState('');
  const [programToEdit, setProgramToEdit] = useState<Workout | null>(null);
  const [programToDelete, setProgramToDelete] = useState<Workout | null>(null);

  const goalFormRef = useRef<GoalFormRef>(null);

  const [isStrengthModalOpen, setIsStrengthModalOpen] = useState(false);
  const [isConditioningModalOpen, setIsConditioningModalOpen] = useState(false);
  const [isPhysiqueModalOpen, setIsPhysiqueModalOpen] = useState(false);
  const [followUpBooked, setFollowUpBooked] = useState(false);


  const myGoals = useMemo(() => allParticipantGoals.filter(g => g.participantId === participant.id), [allParticipantGoals, participant.id]);
  const latestGoal = useMemo(() => {
    if (myGoals.length === 0) return null;
    const sortedGoals = [...myGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
    return sortedGoals.find(g => !g.isCompleted) || sortedGoals[0] || null;
  }, [myGoals]);

  const myActivityLogs = useMemo(() => allActivityLogs.filter(log => log.participantId === participant.id), [allActivityLogs, participant.id]);
  const myStrengthStats = useMemo(() => userStrengthStats.filter(s => s.participantId === participant.id), [userStrengthStats, participant.id]);
  const myConditioningStats = useMemo(() => userConditioningStatsHistory.filter(s => s.participantId === participant.id), [userConditioningStatsHistory, participant.id]);
  const myPhysiqueHistory = useMemo(() => participantPhysiqueHistory.filter(s => s.participantId === participant.id), [participantPhysiqueHistory, participant.id]);
  const myClubMemberships = useMemo(() => clubMemberships.filter(m => m.participantId === participant.id), [clubMemberships, participant.id]);
  
  const handleToolCardClick = (tool: 'strength' | 'conditioning' | 'physique') => {
    if (tool === 'strength') setIsStrengthModalOpen(true);
    if (tool === 'conditioning') setIsConditioningModalOpen(true);
    if (tool === 'physique') setIsPhysiqueModalOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab('notes');
      setNewNote('');
      setEditingNote(null);
      setAiSummary(null);
      setIsLoadingAiSummary(false);
      setIsBookingModalOpen(false);
      setIsProgramModalOpen(false);
      setTemplateToAssign('');
      setAssignSuccessMessage('');
      setProgramToEdit(null);
      setProgramToDelete(null);
      setFollowUpBooked(false);
    }
  }, [isOpen]);

  const assignedWorkouts = useMemo(() => 
    workouts.filter(w => w.assignedToParticipantId === participant.id)
            .sort((a, b) => a.title.localeCompare(b.title)), 
    [workouts, participant.id]
);

const handleOpenNewProgramModal = () => {
    setProgramToEdit(null);
    setIsProgramModalOpen(true);
};

const handleOpenEditProgramModal = (workout: Workout) => {
    setProgramToEdit(workout);
    setIsProgramModalOpen(true);
};

const handleConfirmDeleteProgram = () => {
    if (programToDelete) {
        deleteWorkout(programToDelete.id);
    }
    setProgramToDelete(null);
};


  const handleSaveNote = () => {
    if (!newNote.trim()) return;
    if (editingNote) {
      onUpdateNote(editingNote.id, newNote);
      setEditingNote(null);
    } else {
      onAddNote(newNote);
    }
    setNewNote('');
  };

  const handleInsertTemplate = () => {
    const today = new Date().toISOString().split('T')[0];
    const template = `AVSTÄMNING [Datum: ${today}]

HUR GÅR DET MED DIN TRÄNING?


VAD ÄR DU MEST STOLT ÖVER ATT HA UPPNÅTT DE SENASTE TRE MÅNADERNA (eller sen senaste avstämningen)? (BRIGHT SPOT)


VAD HAR VARIT DIN STÖRSTA UTMANING?


VILKA ÄR DINA NUVARANDE MÅL?


KÄNNER DU ATT DU ÄR PÅ VÄG MOT MÅLET?


FÖRNYAT/JUSTERAT MÅL:


HUR TAR VI OSS DIT?
Bra:
Bättre:
Bäst:
`;

    setNewNote(prevNote => {
        if (prevNote.trim() === '') {
            return template;
        }
        // Add two newlines for a clear separation
        return `${prevNote}\n\n${template}`;
    });
  };
  
  const handleGenerateAiSummary = async () => {
    setIsLoadingAiSummary(true);
    setAiSummary(null);
    
    const lastCheckinNote = notes
        .filter(n => n.noteType === 'check-in')
        .sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())[0];

    const sinceDate = lastCheckinNote ? new Date(lastCheckinNote.createdDate) : new Date(0);
    const logsSinceLastCheckin = myActivityLogs.filter(log => new Date(log.completedDate) > sinceDate);

    let logSummaryForPrompt = "Ingen aktivitet sedan senaste avstämning.";
    if (logsSinceLastCheckin.length > 0) {
        const workoutLogs = logsSinceLastCheckin.filter(l => l.type === 'workout') as WorkoutLog[];
        const generalLogs = logsSinceLastCheckin.filter(l => l.type === 'general') as GeneralActivityLog[];
        const totalCount = logsSinceLastCheckin.length;
        const firstLogDate = new Date(logsSinceLastCheckin[logsSinceLastCheckin.length - 1].completedDate);
        const periodDays = Math.max(1, (new Date().getTime() - firstLogDate.getTime()) / (1000 * 3600 * 24));
        const weeklyAverage = (totalCount / periodDays * 7).toFixed(1);

        const progressionPBs = workoutLogs
            .flatMap(log => log.postWorkoutSummary?.newPBs || [])
            .map(pb => `- ${pb.exerciseName}: ${pb.value}`)
            .slice(0, 5).join('\n');

        const moodRatings = logsSinceLastCheckin.map(l => l.moodRating).filter((r): r is number => r !== undefined);
        const avgMood = moodRatings.length > 0 ? (moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length).toFixed(1) : 'N/A';

        logSummaryForPrompt = `
- Period: Senaste ${Math.round(periodDays)} dagarna.
- Totala aktiviteter: ${totalCount} (${workoutLogs.length} gympass, ${generalLogs.length} övriga).
- Snitt per vecka: ${weeklyAverage} pass.
- Nya Personliga Rekord (PBs):
${progressionPBs || '  - Inga nya PBs loggade.'}
- Genomsnittligt mående (1-5): ${avgMood}
        `;
    }

    const prompt = `Du är en AI-assistent för en träningscoach. Ge en koncis och insiktsfull sammanfattning av en medlems aktivitet SEDAN SENASTE AVSTÄMNING. Fokusera på att ge coachen snabba, användbara insikter för ett check-in samtal. Svaret ska vara på svenska och formaterat med Markdown.

    Medlemmens data:
    - Namn: ${participant.name}
    - Aktivt mål: "${latestGoal?.fitnessGoals || 'Inget aktivt mål.'}"
    - Mål (pass/vecka): ${latestGoal?.workoutsPerWeekTarget || 'N/A'}

    Sammanfattning av aktivitet sedan senaste avstämning (${lastCheckinNote ? `den ${sinceDate.toLocaleDateString('sv-SE')}` : 'start'}):
    ${logSummaryForPrompt}

    Baserat på ALL data ovan, ge en sammanfattning som inkluderar:
    1.  ## Aktivitet & Konsistens: Jämför aktiviteten mot medlemmens mål. Är de på rätt spår?
    2.  ## Progress: Finns det tecken på framsteg (nya PBs)?
    3.  ## Mående & Engagemang: Vad indikerar humörskattningen?
    4.  ## Rekommendationer för Samtalet: Ge 1-2 konkreta förslag på diskussionspunkter för coachen.`;
    
    try {
        const result = await callGeminiApiFn({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        const { text, error } = result.data as { text?: string; error?: string };
        if (error) {
            throw new Error(`Cloud Function error: ${error}`);
        }
        setAiSummary(text);
    } catch (err) {
      setAiSummary("Kunde inte generera sammanfattning.");
    } finally {
      setIsLoadingAiSummary(false);
    }
  };

  const handleSaveGoal = async (
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
  ) => {
    // This function now just calls the parent updater, as AI prognosis is handled within GoalForm for coaches
    const myOldGoals = allParticipantGoals.filter(g => g.participantId !== participant.id);
    let myNewGoals = allParticipantGoals.filter(g => g.participantId === participant.id);
    
    const nonCompletedGoals = myNewGoals.filter(g => !g.isCompleted).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime());
    const latestExistingGoal = nonCompletedGoals[0] || null;
    
    if (markLatestGoalAsCompleted && latestExistingGoal) {
        setGoalCompletionLogs(prev => [...prev, {
            type: 'goal_completion', id: crypto.randomUUID(), participantId: participant.id,
            goalId: latestExistingGoal.id, goalDescription: latestExistingGoal.fitnessGoals,
            completedDate: new Date().toISOString()
        }]);
        myNewGoals = myNewGoals.map(g => g.id === latestExistingGoal.id ? { ...g, isCompleted: true, completedDate: new Date().toISOString() } : g);
    }

    const newGoal: ParticipantGoalData = {
        id: crypto.randomUUID(),
        participantId: participant.id,
        ...goalData,
        currentWeeklyStreak: latestExistingGoal?.currentWeeklyStreak || 0,
        lastStreakUpdateEpochWeekId: latestExistingGoal?.lastStreakUpdateEpochWeekId || dateUtils.getEpochWeekId(new Date()),
        setDate: new Date().toISOString(),
        isCompleted: false,
    };
    
    setParticipantGoals([...myOldGoals, ...myNewGoals, newGoal]);
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
    setSessionToEdit(null);
  };
  
  const handleConfirmDeleteSession = () => {
    if (!sessionToDelete) return;
    setOneOnOneSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
    setSessionToDelete(null);
  };

  const handleAssignExistingTemplate = () => {
    if (!templateToAssign) return;
    const workoutTemplate = workouts.find(w => w.id === templateToAssign);
    if (!workoutTemplate) return;

    const assignedWorkout: Workout = {
        ...workoutTemplate,
        id: crypto.randomUUID(),
        isPublished: false,
        assignedToParticipantId: participant.id,
    };
    addWorkout(assignedWorkout);
    setTemplateToAssign(''); // Reset dropdown
    setAssignSuccessMessage(`'${workoutTemplate.title}' har tilldelats.`);
    setTimeout(() => setAssignSuccessMessage(''), 3000);
  };


  const getTabButtonStyle = (tabName: MemberNotesTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };

  const templateWorkouts = workouts.filter(w => w.isPublished && !w.assignedToParticipantId);
  const templateOptions = [
    { value: '', label: 'Välj en passmall...' },
    ...templateWorkouts.map(w => ({ value: w.id, label: w.title }))
  ];
  
  const isCheckinNote = newNote.toUpperCase().includes('AVSTÄMNING');

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Klientkort: ${participant.name}`} size="6xl">
        <div className="flex flex-col md:flex-row gap-6 text-gray-800">

          {/* LEFT PANEL: MEMBER DASHBOARD VIEW */}
          <div className="md:w-2/5 flex-shrink-0 space-y-4">
              <ParticipantDashboardView 
                  participant={participant}
                  latestGoal={latestGoal}
                  allActivityLogs={myActivityLogs}
                  onToolCardClick={handleToolCardClick}
              />
          </div>

          {/* RIGHT PANEL: COACH NOTES & TOOLS */}
          <div className="md:w-3/5 flex-1 space-y-4">
             <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                    <button onClick={() => setActiveTab('notes')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('notes')}`}>Anteckningar</button>
                    <button onClick={() => setActiveTab('goals')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('goals')}`}>Mål & Plan</button>
                    <button onClick={() => setActiveTab('sessions')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('sessions')}`}>Boka 1-on-1</button>
                    <button onClick={() => setActiveTab('program')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('program')}`}>Program</button>
                </nav>
            </div>

            <div role="tabpanel" hidden={activeTab !== 'notes'}>
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                      <div className="p-3 bg-gray-50 rounded-lg border">
                          <Button onClick={handleGenerateAiSummary} fullWidth disabled={isLoadingAiSummary || !isOnline}>
                            {isLoadingAiSummary ? 'Genererar...' : (isOnline ? 'Generera AI Sammanfattning' : 'AI Offline')}
                          </Button>
                          {aiSummary && <div className="mt-3 p-2 bg-white rounded">{renderMarkdown(aiSummary)}</div>}
                        </div>
                      
                      <div className="space-y-2">
                        <Textarea
                          label={editingNote ? 'Redigera anteckning' : 'Ny anteckning'}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={4}
                        />

                        {isCheckinNote && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={followUpBooked}
                                        onChange={(e) => setFollowUpBooked(e.target.checked)}
                                        className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                                    />
                                    <span className="text-base font-medium text-gray-700">
                                        Nytt avstämningssamtal bokat
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                          <div>
                            {!editingNote && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleInsertTemplate}
                              >
                                Infoga Avstämningsmall
                              </Button>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            {editingNote && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setEditingNote(null);
                                  setNewNote('');
                                }}
                              >
                                Avbryt
                              </Button>
                            )}
                            <Button onClick={handleSaveNote} disabled={!newNote.trim()}>
                              {editingNote ? 'Spara ändring' : 'Spara anteckning'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                          {notes.sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()).map(note => (
                              <div key={note.id} className="p-3 bg-white rounded-md shadow-sm border">
                                  <p className="text-sm text-gray-500">{new Date(note.createdDate).toLocaleString('sv-SE')}</p>
                                  <p className="mt-1 text-base text-gray-700 whitespace-pre-wrap">{note.noteText}</p>
                                  <div className="flex justify-end gap-2 mt-2">
                                      <Button variant="outline" size="sm" className="!text-xs" onClick={() => { setEditingNote(note); setNewNote(note.noteText); }}>Redigera</Button>
                                      <Button variant="danger" size="sm" className="!text-xs" onClick={() => onDeleteNote(note.id)}>Ta bort</Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                )}
            </div>

            <div role="tabpanel" hidden={activeTab !== 'goals'}>
                {activeTab === 'goals' && (
                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                      <GoalForm
                          ref={goalFormRef}
                          currentGoalForForm={latestGoal}
                          allParticipantGoals={myGoals}
                          onSave={handleSaveGoal}
                          onTriggerAiGoalPrognosis={async () => { /* Handled by GoalForm internally for coach view */ }}
                          showCoachFields={true}
                          isOnline={isOnline}
                      />
                       <div className="flex justify-end pt-4 mt-4 border-t">
                          <Button onClick={() => goalFormRef.current?.submitForm()}>Spara Mål & Plan</Button>
                       </div>
                    </div>
                )}
            </div>

             <div role="tabpanel" hidden={activeTab !== 'sessions'}>
                {activeTab === 'sessions' && (() => {
                    const now = new Date();
                    const participantSessions = oneOnOneSessions.filter(s => s.participantId === participant.id);
                    const upcomingSessions = participantSessions.filter(s => new Date(s.startTime) >= now).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                    const pastSessions = participantSessions.filter(s => new Date(s.startTime) < now).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

                    const formatDateTime = (isoString: string) => {
                        const d = new Date(isoString);
                        const datePart = d.toISOString().split('T')[0];
                        const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                        return `${datePart} ${timePart}`;
                    };
                    
                    return (
                        <div>
                            <Button onClick={() => { setSessionToEdit(null); setIsBookingModalOpen(true); }} fullWidth>Boka ny 1-on-1 session</Button>
                            
                            <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-2">
                                <h4 className="text-xl font-semibold text-gray-800">Kommande Sessioner</h4>
                                {upcomingSessions.length > 0 ? (
                                    <div className="space-y-3">
                                        {upcomingSessions.map(session => (
                                            <div key={session.id} className="p-4 bg-white border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                                <div>
                                                    <p className="font-bold text-lg text-gray-900">{session.title}</p>
                                                    <p className="text-base text-gray-600">{formatDateTime(session.startTime)}</p>
                                                </div>
                                                <div className="flex gap-2 mt-2 sm:mt-0 self-end sm:self-center">
                                                    <Button size="sm" variant="outline" className="!text-xs" onClick={() => { setSessionToEdit(session); setIsBookingModalOpen(true); }}>Redigera</Button>
                                                    <Button size="sm" variant="danger" className="!text-xs" onClick={() => setSessionToDelete(session)}>Ta bort</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-gray-500 italic">Inga kommande sessioner bokade.</p>}

                                {pastSessions.length > 0 && (
                                    <details className="pt-4 border-t">
                                        <summary className="text-xl font-semibold text-gray-800 cursor-pointer list-none flex justify-between items-center group">
                                            Tidigare Sessioner
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </summary>
                                        <div className="mt-3 space-y-3">
                                            {pastSessions.map(session => (
                                                <div key={session.id} className="p-4 bg-gray-50 border rounded-lg opacity-80">
                                                    <p className="font-semibold text-lg text-gray-700">{session.title}</p>
                                                    <p className="text-base text-gray-500">{formatDateTime(session.startTime)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
             <div role="tabpanel" hidden={activeTab !== 'program'}>
                {activeTab === 'program' && (
                    <div className="space-y-6">
                        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                            <h4 className="text-xl font-semibold text-gray-800">Tilldelade Program</h4>
                            {assignSuccessMessage && <div className="p-2 mb-2 bg-green-100 text-green-700 rounded-md animate-fade-in">{assignSuccessMessage}</div>}
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 -mr-2">
                                {assignedWorkouts.length > 0 ? (
                                    assignedWorkouts.map(workout => (
                                        <div key={workout.id} className="p-3 bg-white rounded-md shadow-sm border flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold text-gray-900">{workout.title}</p>
                                                <p className="text-sm text-gray-500">{workout.blocks?.length || 0} block, {workout.blocks?.reduce((acc, b) => acc + (b.exercises?.length || 0), 0) || 0} övningar</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleOpenEditProgramModal(workout)}>Redigera</Button>
                                                <Button size="sm" variant="danger" onClick={() => setProgramToDelete(workout)}>Ta bort</Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 italic text-center py-4">Inga program har tilldelats denna medlem än.</p>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-2 text-sm text-gray-500">eller</span>
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                            <h4 className="text-lg font-semibold text-gray-800">Tilldela befintlig passmall</h4>
                            <Select
                                label="Välj mall"
                                value={templateToAssign}
                                onChange={e => setTemplateToAssign(e.target.value)}
                                options={templateOptions}
                            />
                            <Button onClick={handleAssignExistingTemplate} disabled={!templateToAssign}>
                                Tilldela valt pass
                            </Button>
                        </div>
                        
                        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                            <h4 className="text-lg font-semibold text-gray-800">Skapa nytt program</h4>
                            <p className="text-sm text-gray-600">Skapa ett helt nytt, anpassat program från grunden och tilldela det direkt till ${participant.name}.</p>
                            <Button onClick={handleOpenNewProgramModal}>
                                Skapa & Tilldela Nytt Program
                            </Button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </Modal>

      <BookOneOnOneModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSave={handleSaveOrUpdateSession}
        sessionToEdit={sessionToEdit}
        participants={participants}
        coaches={coaches}
        preselectedParticipant={participant}
        loggedInCoachId={loggedInCoachId}
        staffAvailability={staffAvailability}
      />
      
      <ConfirmationModal
          isOpen={!!sessionToDelete}
          onClose={() => setSessionToDelete(null)}
          onConfirm={handleConfirmDeleteSession}
          title="Ta bort 1-on-1 Session"
          message={`Är du säker på att du vill ta bort sessionen "${sessionToDelete?.title}" med ${participant.name}? Detta kan inte ångras.`}
          confirmButtonText="Ja, ta bort"
      />

      <CreateWorkoutModal
          isOpen={isProgramModalOpen}
          onClose={() => {
            setIsProgramModalOpen(false);
            setProgramToEdit(null);
          }}
          onSaveWorkout={(workout) => { addWorkout(workout); setIsProgramModalOpen(false); }}
          onUpdateWorkout={(workout) => { 
            updateWorkout(workout); 
            setIsProgramModalOpen(false); 
            setProgramToEdit(null); 
          }}
          workoutToEdit={programToEdit}
          participantToAssign={programToEdit ? undefined : participant}
          participantGoal={latestGoal}
          isOnline={isOnline}
      />

      <ConfirmationModal
          isOpen={!!programToDelete}
          onClose={() => setProgramToDelete(null)}
          onConfirm={handleConfirmDeleteProgram}
          title="Ta bort tilldelat program?"
          message={`Är du säker på att du vill ta bort programmet "${programToDelete?.title}" från ${participant.name}? Detta kan inte ångras.`}
          confirmButtonText="Ja, ta bort"
          confirmButtonVariant="danger"
      />

      {/* Modals for dashboard view */}
      <StrengthComparisonModal
        isOpen={isStrengthModalOpen}
        onClose={() => setIsStrengthModalOpen(false)}
        participantProfile={participant}
        latestGoal={latestGoal}
        userStrengthStatsHistory={myStrengthStats}
        clubMemberships={myClubMemberships}
        onSaveStrengthStats={(stats) => setUserStrengthStatsData(prev => [...prev.filter(s => s.participantId !== participant.id), stats])}
        onOpenPhysiqueModal={() => { setIsStrengthModalOpen(false); setTimeout(() => setIsPhysiqueModalOpen(true), 150); }}
      />
      <ConditioningStatsModal
        isOpen={isConditioningModalOpen}
        onClose={() => setIsConditioningModalOpen(false)}
        statsHistory={myConditioningStats}
        participantProfile={participant}
        clubMemberships={myClubMemberships}
        onSaveStats={(statsData) => {
            const newStat: ParticipantConditioningStat = {
                id: crypto.randomUUID(),
                participantId: participant.id,
                ...statsData,
            };
            setUserConditioningStatsHistoryData(prev => [...prev, newStat]);
        }}
      />
      <PhysiqueManagerModal
        isOpen={isPhysiqueModalOpen}
        onClose={() => setIsPhysiqueModalOpen(false)}
        currentProfile={participant}
        onSave={(physiqueData) => {
            const newHistoryEntry: ParticipantPhysiqueStat = {
                id: crypto.randomUUID(),
                participantId: participant.id,
                lastUpdated: new Date().toISOString(),
                ...physiqueData,
            };
            setParticipantPhysiqueHistoryData(prev => [...prev, newHistoryEntry]);
            updateParticipantProfile(participant.id, physiqueData);
        }}
      />
    </>
  );
};
