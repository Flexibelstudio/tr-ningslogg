import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ParticipantProfile, WorkoutLog, GeneralActivityLog, ParticipantGoalData, Workout } from '../../types';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

interface AICoachModalProps {
    isOpen: boolean;
    onClose: () => void;
    ai: GoogleGenAI | null;
    participantProfile: ParticipantProfile | null;
    myWorkoutLogs: WorkoutLog[];
    myGeneralActivityLogs: GeneralActivityLog[];
    latestGoal: ParticipantGoalData | null;
    allWorkouts: Workout[];
}

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
);

export const AICoachModal: React.FC<AICoachModalProps> = ({
    isOpen,
    onClose,
    ai,
    participantProfile,
    myWorkoutLogs,
    myGeneralActivityLogs,
    latestGoal,
    allWorkouts
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
                    text: `Hej ${participantProfile.name?.split(' ')[0]}! Jag är din digitala coach här i träningsloggen. Tänk på mig som din digitala morot i höstmörkret – här för att peppa dig när motivationen tryter. Vad kan jag hjälpa dig med idag?`,
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
        if (!text.trim() || isLoading || !ai) return;

        const userMessage: Message = { id: crypto.randomUUID(), text, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const context = {
                participant: {
                    name: participantProfile?.name,
                    age: participantProfile?.age,
                    gender: participantProfile?.gender,
                },
                goal: latestGoal ? `"${latestGoal.fitnessGoals}" (${latestGoal.workoutsPerWeekTarget} pass/vecka)` : 'Inget aktivt mål satt.',
                recentWorkouts: myWorkoutLogs.slice(0, 5).map(log => ({
                    workoutId: log.workoutId, completedDate: log.completedDate, moodRating: log.moodRating, comment: log.postWorkoutComment
                })),
                recentActivities: myGeneralActivityLogs.slice(0, 5).map(log => ({
                    name: log.activityName, duration: log.durationMinutes, completedDate: log.completedDate
                })),
                availableWorkouts: allWorkouts.filter(w => w.isPublished && !w.assignedToParticipantId).map(w => ({ title: w.title, category: w.category, focusTags: w.focusTags }))
            };

            const prompt = `Du är "Flexibot", en personlig, AI-driven träningscoach från Flexibel Hälsostudio. Din ton är peppande, kunnig och stöttande. Svara alltid på svenska. Ge korta, koncisa och hjälpsamma svar. Använd medlemmens namn ibland.

            Här är data om medlemmen du pratar med, ${participantProfile?.name?.split(' ')[0] || 'vän'}:
            ${JSON.stringify(context, null, 2)}

            Medlemmen frågar: "${text}"

            Baserat på ALL data ovan, ge ett svar. Om frågan handlar om att rekommendera ett pass, använd listan med passmallar för att ge ett specifikt förslag och motivera varför det passar baserat på medlemmens mål och historik. Om du inte kan svara, förklara varför på ett hjälpsamt sätt (t.ex. "För att analysera din styrkeutveckling behöver jag se fler loggade pass över tid.").`;

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const aiMessage: Message = { id: crypto.randomUUID(), text: response.text, sender: 'ai' };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            const errorMessage: Message = { id: crypto.randomUUID(), text: "Ursäkta, jag har lite problem just nu. Försök igen senare.", sender: 'ai' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [ai, isLoading, participantProfile, latestGoal, myWorkoutLogs, myGeneralActivityLogs, allWorkouts]);

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
        <Modal isOpen={isOpen} onClose={onClose} title="" size="lg" showCloseButtonOnly>
            <div className="flex flex-col h-[85vh] sm:h-[80vh]">
                <header className="flex items-center p-4 border-b flex-shrink-0">
                    <span className="text-2xl mr-3">✨</span>
                    <h2 className="text-xl font-bold text-gray-800">Fråga coachen</h2>
                    <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
                </header>

                <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4 bg-white">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && <span className="text-2xl mb-1">✨</span>}
                            <div className={`p-3 rounded-2xl max-w-[85%] animate-fade-in-down ${msg.sender === 'user' ? 'bg-flexibel text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                                <p className="text-base" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
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
                </div>

                <footer className="p-4 border-t bg-gray-50 flex-shrink-0">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {suggestionButtons.map(s => (
                            <Button key={s} variant="ghost" size="sm" onClick={() => handleSuggestionClick(s)} disabled={isLoading} className="!rounded-full !px-3 !py-1.5 !text-sm bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200">
                                {s}
                            </Button>
                        ))}
                    </div>
                    <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Skriv din fråga här..."
                            className="flex-grow !rounded-full !px-4 !py-2.5 !bg-gray-200"
                            disabled={isLoading}
                        />
                        <Button type="submit" disabled={isLoading || !inputValue.trim()} className="!rounded-full !w-12 !h-12 !p-0 flex-shrink-0 !bg-green-400 hover:!bg-green-500">
                            <SendIcon />
                        </Button>
                    </form>
                </footer>
            </div>
        </Modal>
    );
};
