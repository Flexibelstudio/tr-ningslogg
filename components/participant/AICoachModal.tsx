import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { ParticipantProfile, WorkoutLog, GeneralActivityLog, ParticipantGoalData, Workout, Membership } from '../../types';
import { callGeminiApiFn } from '../../firebaseClient';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

interface AICoachModalProps {
    isOpen: boolean;
    onClose: () => void;
    participantProfile: ParticipantProfile | null;
    myWorkoutLogs: WorkoutLog[];
    myGeneralActivityLogs: GeneralActivityLog[];
    latestGoal: ParticipantGoalData | null;
    allWorkouts: Workout[];
    membership: Membership | null;
}

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);

// FIX: Replaced JSX syntax with React.createElement to resolve "Cannot find namespace 'JSX'" error.
const renderMarkdownContent = (text: string): React.ReactElement[] => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let listItems: React.ReactElement[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(React.createElement('ul', { key: `ul-${elements.length}`, className: "list-disc pl-5 space-y-1" }, ...listItems));
            listItems = [];
        }
    };

    lines.forEach((line, index) => {
        // Handle bold text first
        const boldedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        if (boldedLine.trim().startsWith('* ')) {
            const content = boldedLine.trim().substring(2);
            listItems.push(React.createElement('li', { key: `li-${index}`, dangerouslySetInnerHTML: { __html: content } }));
        } else {
            flushList();
            if (boldedLine.trim() !== '') {
                elements.push(React.createElement('p', { key: `p-${index}`, className: "mb-2 last:mb-0", dangerouslySetInnerHTML: { __html: boldedLine } }));
            }
        }
    });

    flushList(); // Ensure any trailing list items are rendered
    return elements;
};

export const AICoachModal: React.FC<AICoachModalProps> = ({
    isOpen,
    onClose,
    participantProfile,
    myWorkoutLogs,
    myGeneralActivityLogs,
    latestGoal,
    allWorkouts,
    membership
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && participantProfile) {
            setMessages([
                {
                    id: crypto.randomUUID(),
                    text: `Hej ${participantProfile.name?.split(' ')[0]}! Jag är din coach här i Träningsloggen. Tänk på mig som din **digitala skivstång i gymmet** – här för att peppa dig när motivationen tryter. Oavsett om jag är din virtuella kettlebell eller din personliga timer, så är jag här för att göra din träningsresa lite mer underhållande!`,
                    sender: 'ai'
                }
            ]);
        } else {
            setMessages([]);
            setInputValue('');
        }
    }, [isOpen, participantProfile]);

    useEffect(() => {
        // Scroll to bottom when new messages are added
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);
    
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading || !participantProfile) return;

        const userMessage: Message = { id: crypto.randomUUID(), text, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Create a map of all known exercises for quick lookup
            const exerciseNameMap = new Map<string, string>();
            allWorkouts.forEach(workout => {
                (workout.blocks || []).forEach(block => {
                    block.exercises.forEach(ex => {
                        exerciseNameMap.set(ex.id, ex.name);
                    });
                });
            });
            myWorkoutLogs.forEach(log => {
                if (log.selectedExercisesForModifiable) {
                    log.selectedExercisesForModifiable.forEach(ex => {
                        if (!exerciseNameMap.has(ex.id)) {
                            exerciseNameMap.set(ex.id, ex.name);
                        }
                    });
                }
            });

            // Filter available workouts based on membership
            const availableWorkouts = allWorkouts.filter(w => {
                // 1. Include all personally assigned workouts
                if (w.assignedToParticipantId === participantProfile.id) {
                    return true;
                }
        
                // 2. Include published workouts that are not restricted by membership
                if (w.isPublished && !w.assignedToParticipantId) {
                    if (membership?.restrictedCategories && membership.restrictedCategories.includes(w.category)) {
                        return false; // This category is restricted
                    }
                    return true; // Published and not restricted
                }
        
                return false;
            }).map(w => ({ title: w.title, category: w.category, focusTags: w.focusTags }));

            // Create a more detailed workout history for the AI
            const enrichedRecentWorkouts = myWorkoutLogs.slice(0, 10).map(log => {
                const workoutTemplate = allWorkouts.find(w => w.id === log.workoutId);
                return {
                    workoutTitle: workoutTemplate?.title || 'Anpassat pass',
                    completedDate: log.completedDate,
                    comment: log.postWorkoutComment,
                    exercises: log.entries.map(entry => ({
                        exerciseName: exerciseNameMap.get(entry.exerciseId) || 'Okänd övning',
                        loggedSets: entry.loggedSets.map(set => ({
                            reps: set.reps,
                            weight: set.weight
                        })).filter(set => set.reps !== undefined || set.weight !== undefined)
                    }))
                };
            });

            const context = {
                participant: {
                    name: participantProfile?.name,
                    age: participantProfile?.age,
                    gender: participantProfile?.gender,
                },
                goal: latestGoal ? `"${latestGoal.fitnessGoals}" (${latestGoal.workoutsPerWeekTarget} pass/vecka)` : 'Inget aktivt mål satt.',
                recentWorkouts: enrichedRecentWorkouts,
                recentActivities: myGeneralActivityLogs.slice(0, 5).map(log => ({
                    name: log.activityName, duration: log.durationMinutes, completedDate: log.completedDate
                })),
                availableWorkouts: availableWorkouts
            };

            const prompt = `Du är "Flexibot", en personlig, AI-driven träningscoach från Flexibel Hälsostudio. Din ton är peppande, kunnig och stöttande. Svara alltid på svenska. Ge korta, koncisa och hjälpsamma svar. Använd medlemmens namn ibland.

            Här är data om medlemmen du pratar med, ${participantProfile?.name?.split(' ')[0] || 'vän'}:
            ${JSON.stringify(context, null, 2)}

            Medlemmen frågar: "${text}"

            Baserat på ALL data ovan, ge ett svar.
            - **Om frågan handlar om styrkeutveckling:** Analysera "loggedSets" i "recentWorkouts" för varje övning över tid. Leta efter progression i form av ökad vikt, fler repetitioner med samma vikt, eller högre total volym (vikt * reps). Presentera en tydlig sammanfattning av utvecklingen för de mest relevanta övningarna.
            - **Om frågan handlar om att rekommendera ett pass:** Använd ENDAST listan med "availableWorkouts" för att ge ett specifikt förslag och motivera varför det passar baserat på medlemmens mål och historik. Föreslå ALDRIG ett pass som inte finns i listan.
            - **Om du inte kan svara:** Förklara varför på ett hjälpsamt sätt. Om du inte kan se en tydlig trend för styrkeutveckling, förklara att fler loggade pass behövs för en djupare analys.`;

            const result = await callGeminiApiFn({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const { text: responseText, error } = result.data as { text?: string; error?: string };

            if (error) {
                throw new Error(`Cloud Function error: ${error}`);
            }
            if (!responseText) {
                throw new Error("Received empty response from AI.");
            }

            const aiMessage: Message = { id: crypto.randomUUID(), text: responseText, sender: 'ai' };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("Error calling AI Coach:", error);
            const errorMessage: Message = { id: crypto.randomUUID(), text: "Ursäkta, jag har lite problem just nu. Försök igen senare.", sender: 'ai' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, participantProfile, latestGoal, myWorkoutLogs, myGeneralActivityLogs, allWorkouts, membership]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    };

    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion);
    };

    const suggestionButtons = [
        "Hur ser min styrkeutveckling ut?",
        "Vad gjorde jag bra förra veckan?",
        "Ge mig tips för att förbättra min kondition.",
        "Vilket pass borde jag köra idag?",
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Fråga coachen" size="lg">
            <div className="flex flex-col h-[75vh] sm:h-[70vh] -m-6">
                <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 bg-white">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <span className="text-2xl mb-1">✨</span>}
                            <div className={`p-3 rounded-2xl max-w-[85%] animate-fade-in-down ${msg.sender === 'user' ? 'bg-flexibel text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                                {msg.sender === 'ai'
                                    ? <div className="text-base">{renderMarkdownContent(msg.text)}</div>
                                    : <p className="text-base" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                                }
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-end gap-2 justify-start animate-pulse">
                             <span className="text-2xl mb-1">✨</span>
                            <div className="p-3 rounded-2xl bg-gray-200 rounded-bl-none">
                                <div className="h-2 w-4 bg-gray-400 rounded-full"></div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 pt-4">
                        {suggestionButtons.map(s => (
                            <Button key={s} variant="ghost" size="sm" onClick={() => handleSuggestionClick(s)} disabled={isLoading} className="!rounded-full !px-2.5 !py-1 !text-xs bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200">
                                {s}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex-shrink-0">
                    <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Skriv din fråga här..."
                            className="flex-grow !rounded-full !px-4 !py-2.5 !bg-white border-gray-300"
                            disabled={isLoading}
                        />
                        <Button type="submit" disabled={isLoading || !inputValue.trim()} className="!rounded-full !w-12 !h-12 !p-0 flex-shrink-0 !bg-flexibel hover:!bg-flexibel/90">
                            <SendIcon />
                        </Button>
                    </form>
                </div>
            </div>
        </Modal>
    );
};
