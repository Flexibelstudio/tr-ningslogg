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
  oneOnOneSessions: OneOnOneSession[];
  setOneOnOneSessions: (sessions: OneOnOneSession[] | ((prev: OneOnOneSession[]) => OneOnOneSession[])) => void;
  coaches: StaffMember[];
  loggedInCoachId: string;
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
  workoutCategories: WorkoutCategoryDefinition[];
  participants: ParticipantProfile[];
  staffAvailability: StaffAvailability[];
}

type MemberNotesTab = 'notes' | 'goals' | 'sessions' | 'program';

const getIconForHeader = (headerText: string): JSX.Element | null => {
    const lowerHeaderText = headerText.toLowerCase();
    if (lowerHeaderText.includes("aktivitet") || lowerHeaderText.includes("konsistens")) return <span className="mr-2 text-xl" role="img" aria-label="Aktivitet">📊</span>;
    if (lowerHeaderText.includes("målsättning") || lowerHeaderText.includes("progress")) return <span className="mr-2 text-xl" role="img" aria-label="Målsättning">🎯</span>;
    if (lowerHeaderText.includes("mående") || lowerHeaderText.includes("engagemang")) return <span className="mr-2 text-xl" role="img" aria-label="Mående">😊</span>;
    if (lowerHeaderText.includes("rekommendationer")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommendationer">💡</span>;
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>;
};

const renderMarkdownContent = (markdownText: string | null): JSX.Element[] | null => {
    if (!markdownText) return null;
    const lines = markdownText.split('\n');
    const renderedElements: JSX.Element[] = [];
    let currentListItems: JSX.Element[] = [];
    let listKeySuffix = 0;
  
    const flushList = () => {
      if (currentListItems.length > 0) {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
        listKeySuffix++;
      }
    };
  
    for (let i = 0; i < lines.length; i++) {
      let lineContent = lines[i];
      lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
  
      if (lineContent.startsWith('## ')) {
        flushList();
        const headerText = lineContent.substring(3).trim();
        const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
        renderedElements.push(
          <h4 key={`h4-${i}`} className="text-lg font-bold text-gray-800 flex items-center mb-2 mt-3">
            {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
          </h4>
        );
      } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
        const listItemText = lineContent.substring(2).trim();
        currentListItems.push(
          <li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />
        );
      } else {
        flushList();
        if (lineContent.trim() !== '') {
            renderedElements.push(
              <p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />
            );
        }
      }
    }
    flushList();
    return renderedElements;
};

const CurrentGoalDisplay: React.FC<{ goal: ParticipantGoalData }> = ({ goal }) => (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border h-full">
        <div className="pb-2 border-b">
            <p className="text-sm font-semibold text-gray-500">Satt den: {new Date(goal.setDate).toLocaleDateString('sv-SE')}</p>
            {goal.isCompleted && goal.completedDate && (
                <p className="font-semibold text-green-700 text-sm mt-1">🏆 Slutfört: {new Date(goal.completedDate).toLocaleDateString('sv-SE')}</p>
            )}
        </div>
        <div>
            <p className="text-base font-medium text-gray-600">Målsättning:</p>
            <p className="text-base text-gray-800 italic">"{goal.fitnessGoals}"</p>
        </div>
        <div>
            <p className="text-base font-medium text-gray-600">Mål (pass/vecka): <span className="font-bold text-gray-800">{goal.workoutsPerWeekTarget}</span></p>
        </div>
        {goal.targetDate && (
            <div>
                <p className="text-base font-medium text-gray-600">Måldatum: <span className="font-bold text-gray-800">{new Date(goal.targetDate).toLocaleDateString('sv-SE')}</span></p>
            </div>
        )}
        {goal.coachPrescription && (
            <div className="pt-2 border-t">
                <p className="text-base font-medium text-gray-600">Coach Recept:</p>
                <p className="text-base text-gray-800 italic whitespace-pre-wrap">"{goal.coachPrescription}"</p>
            </div>
        )}
    </div>
);


export const MemberNotesModal: React.FC<MemberNotesModalProps> = ({ 
    isOpen, onClose, ai, participant, notes, allParticipantGoals, setParticipantGoals, allActivityLogs, setGoalCompletionLogs, onAddNote,
    oneOnOneSessions, setOneOnOneSessions, coaches, loggedInCoachId, workouts, setWorkouts, workoutCategories, participants, staffAvailability
}) => {
    const [newNoteText, setNewNoteText] = useState('');
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isLoadingAi, setIsLoadingAi] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiSectionVisible, setIsAiSectionVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<MemberNotesTab>('notes');
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const goalFormRef = useRef<GoalFormRef>(null);
    const [isSavingGoal, setIsSavingGoal] = useState(false);
    const [hasSavedGoal, setHasSavedGoal] = useState(false);

    // State for Program tab
    const [isCreateProgramModalOpen, setIsCreateProgramModalOpen] = useState(false);
    const [programToEdit, setProgramToEdit] = useState<Workout | null>(null);
    const [programToDelete, setProgramToDelete] = useState<Workout | null>(null);

    useEffect(() => {
        if (isOpen) {
            setNewNoteText('');
            setAiInsight(null);
            setIsLoadingAi(false);
            setAiError(null);
            setIsAiSectionVisible(false);
            setActiveTab('notes');
            setIsBookingModalOpen(false);
            setIsSavingGoal(false);
            setHasSavedGoal(false);
            setIsCreateProgramModalOpen(false);
            setProgramToEdit(null);
            setProgramToDelete(null);
        }
    }, [isOpen]);

    const latestGoal = useMemo(() => {
        const participantGoals = allParticipantGoals.filter(g => g.participantId === participant.id);
        if (participantGoals.length === 0) return null;
        return [...participantGoals].sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
    }, [allParticipantGoals, participant.id]);
    
    const mySessions = useMemo(() => {
        if (!participant) return [];
        return oneOnOneSessions
            .filter(s => s.participantId === participant.id)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }, [oneOnOneSessions, participant]);

    const myPersonalPrograms = useMemo(() => {
        return workouts
            .filter(w => w.assignedToParticipantId === participant.id)
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [workouts, participant.id]);

    const handleSaveNote = () => {
        if (newNoteText.trim()) {
            onAddNote(newNoteText.trim());
            setNewNoteText('');
        }
    };

    const handleSaveSession = (session: OneOnOneSession) => {
        setOneOnOneSessions(prev => [...prev, session]);
        setIsBookingModalOpen(false);
    };

    const handleSaveWorkout = (newWorkout: Workout) => {
        setWorkouts(prev => [...prev, newWorkout]);
        setIsCreateProgramModalOpen(false);
    };

    const handleUpdateWorkout = (updatedWorkout: Workout) => {
        setWorkouts(prev => prev.map(w => w.id === updatedWorkout.id ? updatedWorkout : w));
        setIsCreateProgramModalOpen(false);
        setProgramToEdit(null);
    };

    const handleDeleteProgram = () => {
        if (!programToDelete) return;
        setWorkouts(prev => prev.filter(w => w.id !== programToDelete.id));
        setProgramToDelete(null);
    };

    const handleSaveGoals = (
        goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
        markLatestGoalAsCompleted: boolean,
        noGoalAdviseOptOut: boolean
    ) => {
        setParticipantGoals(prevGoals => {
            let newGoalsArray = [...prevGoals];
            const participantOldGoals = newGoalsArray.filter(g => g.participantId === participant.id);

            if (markLatestGoalAsCompleted) {
                const latestExistingGoal = participantOldGoals.sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestExistingGoal && !latestExistingGoal.isCompleted) {
                    const newGoalCompletionLog: GoalCompletionLog = {
                        type: 'goal_completion',
                        id: crypto.randomUUID(),
                        participantId: participant.id,
                        goalId: latestExistingGoal.id,
                        goalDescription: latestExistingGoal.fitnessGoals,
                        completedDate: new Date().toISOString(),
                    };
                    setGoalCompletionLogs(prev => [...prev, newGoalCompletionLog]);
                    
                    newGoalsArray = newGoalsArray.map(g => 
                        g.id === latestExistingGoal.id 
                        ? { ...g, isCompleted: true, completedDate: new Date().toISOString() } 
                        : g
                    );
                }
            }
            
            if (goalData.fitnessGoals !== "Inga specifika mål satta" || (goalData.fitnessGoals === "Inga specifika mål satta" && !markLatestGoalAsCompleted)) {
                const newGoal: ParticipantGoalData = {
                    id: crypto.randomUUID(),
                    participantId: participant.id,
                    fitnessGoals: goalData.fitnessGoals,
                    workoutsPerWeekTarget: goalData.workoutsPerWeekTarget,
                    preferences: goalData.preferences,
                    targetDate: goalData.targetDate,
                    coachPrescription: goalData.coachPrescription,
                    currentWeeklyStreak: 0,
                    lastStreakUpdateEpochWeekId: dateUtils.getEpochWeekId(new Date()),
                    setDate: new Date().toISOString(),
                    isCompleted: false,
                };
                newGoalsArray.push(newGoal);
            }
            return newGoalsArray;
        });
    };

    const handleTriggerAiGoalPrognosis = async (goalDataOverride: Parameters<typeof handleSaveGoals>[0]) => {
        if (!ai) return;
        const goalToAnalyze = { ...latestGoal, ...goalDataOverride, fitnessGoals: goalDataOverride.fitnessGoals || "Inget mål angett" };

        const prompt = `Ge en kort (2-3 meningar) prognos och passrekommendation för en medlem med följande mål:
        - Mål: "${goalToAnalyze.fitnessGoals}"
        - Pass per vecka: ${goalToAnalyze.workoutsPerWeekTarget}
        - Preferenser: "${goalToAnalyze.preferences || 'Inga'}"`;

        try {
            const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
            setParticipantGoals(prev => {
                const latestGoalForParticipant = prev.filter(g => g.participantId === participant.id).sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime())[0];
                if (latestGoalForParticipant) {
                    return prev.map(g => g.id === latestGoalForParticipant.id ? {...g, aiPrognosis: response.text} : g);
                }
                return prev;
            });
        } catch (e) {
            console.error("AI Prognosis failed from coach view", e);
        }
    };
    
    const handleSaveGoal = () => {
        if (goalFormRef.current) {
            setIsSavingGoal(true);
            setHasSavedGoal(false);
            const savedSuccessfully = goalFormRef.current.submitForm();
            if (savedSuccessfully) {
                setHasSavedGoal(true);
                setTimeout(() => {
                    setIsSavingGoal(false);
                    setHasSavedGoal(false);
                }, 2000);
            } else {
                setIsSavingGoal(false);
            }
        }
    };

    const handleGenerateInsight = async () => {
        setIsAiSectionVisible(true);
        if (aiInsight || !ai) return;

        setIsLoadingAi(true);
        setAiError(null);

        const fourWeeksAgo = dateUtils.addDays(new Date(), -28);
        const logsLast4Weeks = allActivityLogs.filter(l => new Date(l.completedDate) >= fourWeeksAgo);
        const avgWeeklyActivities = (logsLast4Weeks.length / 4).toFixed(1);

        const moodRatings = allActivityLogs.map(l => l.moodRating).filter((r): r is number => r !== undefined);
        const avgMoodRating = moodRatings.length > 0 ? (moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length).toFixed(1) : null;
        
        const recentComments = allActivityLogs
            .map(l => (l.type === 'workout' ? (l as any).postWorkoutComment : (l as any).comment))
            .filter(Boolean)
            .slice(0, 5)
            .map(c => `* "${c}"`)
            .join('\n');

        const prompt = `Du är en AI-assistent för en träningscoach på Flexibel Hälsostudio. Din uppgift är att ge en koncis och insiktsfull sammanfattning av en specifik medlems aktivitet och mående. Fokusera på att ge coachen snabba, användbara insikter. Använd Markdown för att formatera ditt svar (## Rubriker, **fet text**, * punktlistor).

                Medlemmens data:
                - Namn: ${participant.name}
                - Mål: "${latestGoal?.fitnessGoals || 'Inget aktivt mål satt.'}"
                - Mål (pass/vecka): ${latestGoal?.workoutsPerWeekTarget || 'N/A'}
                - Coach Recept: "${latestGoal?.coachPrescription || 'Ingen specifik plan från coach.'}"
                - Antal totalt loggade aktiviteter: ${allActivityLogs.length}
                - Genomsnittligt antal pass/vecka (senaste 4 veckorna): ${avgWeeklyActivities}
                - Genomsnittligt mående (1-5): ${avgMoodRating || 'N/A'}
                - Senaste 5 kommentarerna: 
                ${recentComments || '* Inga kommentarer lämnade.'}

                Baserat på denna data, ge en sammanfattning som inkluderar:
                1.  **## Aktivitet & Konsistens:**
                    *   Hur många pass har medlemmen loggat totalt?
                    *   Hur ser den genomsnittliga träningsfrekvensen ut per vecka? Ligger den i linje med medlemmens mål?

                2.  **## Målsättning & Progress:**
                    *   Är medlemmen på väg att nå sitt mål för antal pass per vecka?
                    *   Baserat på målets text, vad bör du som coach hålla ett extra öga på? (t.ex. om målet är '100 kg bänkpress', uppmärksamma bänkpressloggar. Om målet är 'må bättre', kommentera på humörskattningarna).
                    *   Om det finns ett "Coach Recept", analysera om medlemmens loggade aktiviteter och kommentarer reflekterar denna plan. Lyft fram både framgångar och avvikelser.

                3.  **## Mående & Engagemang:**
                    *   Vad indikerar medlemmens genomsnittliga humörskattning?
                    *   Finns det några teman i kommentarerna (positiva, negativa, specifika utmaningar)?

                4.  **## Rekommendationer för Coachen:**
                    *   Ge 1-2 konkreta förslag på vad coachen kan ta upp med medlemmen vid nästa möte. (t.ex. "Fråga hur det känns i knäböjen eftersom de kommenterade att det var tungt", "Peppa dem för deras höga träningsfrekvens", "Diskutera om målet på 5 pass/vecka är realistiskt givet deras kommentarer om tidsbrist").`;
        
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
            });
            setAiInsight(response.text);
        } catch (err) {
            console.error("Error generating member insight:", err);
            setAiError("Kunde inte generera AI-insikt. Försök igen senare.");
        } finally {
            setIsLoadingAi(false);
        }
    };

    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    }, [notes]);

    const getTabButtonStyle = (tabName: MemberNotesTab) => {
        return activeTab === tabName
            ? 'border-flexibel text-flexibel'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Klientkort för ${participant.name}`} size="3xl">
            <div className="flex flex-col min-h-[70vh]">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        <button onClick={() => setActiveTab('notes')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('notes')}`}>
                            Anteckningar & AI Insikt
                        </button>
                        <button onClick={() => setActiveTab('goals')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('goals')}`}>
                            Mål & Plan
                        </button>
                        <button onClick={() => setActiveTab('program')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('program')}`}>
                            Program
                        </button>
                        <button onClick={() => setActiveTab('sessions')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('sessions')}`}>
                            1-on-1 Sessioner
                        </button>
                    </nav>
                </div>

                <div className="flex-grow mt-4 overflow-y-auto p-1">
                    {/* Notes Tab */}
                    <div role="tabpanel" hidden={activeTab !== 'notes'}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Notes */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-gray-800">Ny Anteckning</h3>
                                <Textarea
                                    value={newNoteText}
                                    onChange={(e) => setNewNoteText(e.target.value)}
                                    placeholder={`Skriv en anteckning om ${participant.name}...`}
                                    rows={4}
                                />
                                <Button onClick={handleSaveNote} disabled={!newNoteText.trim()}>Spara Anteckning</Button>
                                
                                <div className="pt-4 border-t">
                                    <h3 className="text-xl font-semibold text-gray-800">Historik</h3>
                                    <div className="mt-2 space-y-3 max-h-80 overflow-y-auto pr-2">
                                        {sortedNotes.length > 0 ? sortedNotes.map(note => (
                                            <div key={note.id} className="p-3 bg-gray-50 rounded-md border">
                                                <p className="text-xs text-gray-500">{new Date(note.createdDate).toLocaleString('sv-SE')}</p>
                                                <p className="text-base text-gray-800 whitespace-pre-wrap">{note.noteText}</p>
                                            </div>
                                        )) : <p className="text-gray-500">Inga anteckningar än.</p>}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right: AI Insight */}
                            <div className="space-y-3">
                                <Button onClick={handleGenerateInsight} disabled={isLoadingAi || !ai} fullWidth variant="primary" size="md">
                                    {isLoadingAi ? 'Analyserar...' : 'Generera AI Insikt'}
                                </Button>
                                <p className="text-sm text-gray-500 italic text-center px-4">
                                  AI:n analyserar medlemmens loggar, mål och anteckningar för att ge dig en snabb sammanfattning och proaktiva insikter.
                                </p>
                                {isAiSectionVisible && (
                                    <div className="p-4 bg-violet-50 rounded-lg border border-violet-200 min-h-[200px] max-h-[50vh] overflow-y-auto">
                                        {isLoadingAi && <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-flexibel"></div></div>}
                                        {aiError && <p className="text-red-500">{aiError}</p>}
                                        {aiInsight && <div>{renderMarkdownContent(aiInsight)}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Program Tab */}
                    <div role="tabpanel" hidden={activeTab !== 'program'}>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-semibold text-gray-800">Personliga Program</h3>
                                <Button onClick={() => { setProgramToEdit(null); setIsCreateProgramModalOpen(true); }}>Skapa Nytt Program</Button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                {myPersonalPrograms.length > 0 ? myPersonalPrograms.map(program => (
                                    <div key={program.id} className="p-3 border rounded-md flex justify-between items-start gap-4 bg-gray-50">
                                        <div className="flex-grow">
                                            <p className="font-semibold text-gray-800">{program.title}</p>
                                            <p className="text-sm text-gray-500">{program.blocks.reduce((acc, b) => acc + b.exercises.length, 0)} övningar</p>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <Button onClick={() => { setProgramToEdit(program); setIsCreateProgramModalOpen(true); }} variant="outline" size="sm" className="!text-xs">Redigera</Button>
                                            <Button onClick={() => setProgramToDelete(program)} variant="danger" size="sm" className="!text-xs">Ta bort</Button>
                                        </div>
                                    </div>
                                )) : <p className="text-gray-500 text-center py-4">Inga personliga program tilldelade.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Goals Tab */}
                    <div role="tabpanel" hidden={activeTab !== 'goals'}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">Nuvarande/Senaste Mål</h3>
                                {latestGoal ? <CurrentGoalDisplay goal={latestGoal} /> : <p className="text-gray-500 mt-2">Inga mål satta för denna medlem än.</p>}
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">{latestGoal && !latestGoal.isCompleted ? 'Uppdatera Mål & Plan' : 'Sätt Nytt Mål & Plan'}</h3>
                                <div className="p-4 border rounded-lg bg-gray-50">
                                    <GoalForm
                                        ref={goalFormRef}
                                        currentGoalForForm={latestGoal}
                                        allParticipantGoals={allParticipantGoals.filter(g => g.participantId === participant.id)}
                                        onSave={handleSaveGoals}
                                        onTriggerAiGoalPrognosis={handleTriggerAiGoalPrognosis}
                                        showCoachFields={true}
                                        ai={ai}
                                    />
                                    <div className="flex justify-end mt-4">
                                        <Button onClick={handleSaveGoal} disabled={isSavingGoal}>
                                            {isSavingGoal ? (hasSavedGoal ? 'Sparat ✓' : 'Sparar...') : 'Spara Mål & Plan'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sessions Tab */}
                    <div role="tabpanel" hidden={activeTab !== 'sessions'}>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-semibold text-gray-800">Bokade 1-on-1 Sessioner</h3>
                                <Button onClick={() => setIsBookingModalOpen(true)}>Boka Ny Session</Button>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                {mySessions.length > 0 ? mySessions.map(session => {
                                    const isUpcoming = new Date(session.startTime) > new Date();
                                    const coachName = coaches.find(c => c.id === session.coachId)?.name || 'Okänd';
                                    return (
                                        <div key={session.id} className={`p-3 border rounded-md ${isUpcoming ? 'bg-blue-50 border-blue-200' : 'bg-gray-100 border-gray-200'}`}>
                                            <p className={`font-semibold ${isUpcoming ? 'text-blue-800' : 'text-gray-800'}`}>{session.title} med {coachName}</p>
                                            <p className="text-sm text-gray-600">{new Date(session.startTime).toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' })}</p>
                                            <p className="text-sm text-gray-500 italic mt-1">{session.purpose}</p>
                                        </div>
                                    );
                                }) : <p className="text-gray-500">Inga 1-on-1 sessioner bokade.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <BookOneOnOneModal
                    isOpen={isBookingModalOpen}
                    onClose={() => setIsBookingModalOpen(false)}
                    onSave={handleSaveSession}
                    participants={[participant]}
                    coaches={coaches}
                    preselectedParticipant={participant}
                    loggedInCoachId={loggedInCoachId}
                    staffAvailability={staffAvailability}
                />
                 <CreateWorkoutModal
                    isOpen={isCreateProgramModalOpen}
                    onClose={() => { setIsCreateProgramModalOpen(false); setProgramToEdit(null); }}
                    onSaveWorkout={handleSaveWorkout}
                    onUpdateWorkout={handleUpdateWorkout}
                    workoutToEdit={programToEdit}
                    participantToAssign={programToEdit ? undefined : participant}
                    participantGoal={latestGoal}
                    ai={ai}
                />
                <ConfirmationModal
                    isOpen={!!programToDelete}
                    onClose={() => setProgramToDelete(null)}
                    onConfirm={handleDeleteProgram}
                    title="Ta bort personligt program?"
                    message={`Är du säker på att du vill ta bort programmet "${programToDelete?.title}"? Detta kan inte ångras.`}
                    confirmButtonText="Ja, ta bort"
                />
            </div>
        </Modal>
    );
};
