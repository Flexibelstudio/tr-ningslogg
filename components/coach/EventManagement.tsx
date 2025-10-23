import React, { useState } from 'react';
import { CoachEvent, WorkoutLog, ParticipantProfile, WeeklyHighlightSettings } from '../../types';
import { Button } from '../Button';
import { CreateEventModal } from './CreateEventModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants';
import { Textarea } from '../Textarea';
import * as dateUtils from '../../utils/dateUtils';
import { Input, Select } from '../Input';
import { ToggleSwitch } from '../ToggleSwitch';
import { useAppContext } from '../../context/AppContext';
import { callGeminiApiFn } from '../../firebaseClient';

interface EventManagementProps {
  events: CoachEvent[];
  setEvents: (events: CoachEvent[] | ((prev: CoachEvent[]) => CoachEvent[])) => void;
  participants: ParticipantProfile[];
  workoutLogs: WorkoutLog[];
  weeklyHighlightSettings: WeeklyHighlightSettings;
  setWeeklyHighlightSettings: (settings: WeeklyHighlightSettings | ((prev: WeeklyHighlightSettings) => WeeklyHighlightSettings)) => void;
}

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const DAY_OF_WEEK_OPTIONS = [
  { value: 1, label: 'Måndag' },
  { value: 2, label: 'Tisdag' },
  { value: 3, label: 'Onsdag' },
  { value: 4, label: 'Torsdag' },
  { value: 5, label: 'Fredag' },
  { value: 6, label: 'Lördag' },
  { value: 7, label: 'Söndag' },
];

const HIGHLIGHT_STUDIO_OPTIONS = [
    { value: 'separate', label: 'Separata inlägg per studio' },
    { value: 'all', label: 'Ett gemensamt inlägg (Båda)' },
    { value: 'salem', label: 'Endast Salem centrum' },
    { value: 'karra', label: 'Endast Kärra centrum' }
];

export const EventManagement: React.FC<EventManagementProps> = ({ events, setEvents, participants, workoutLogs, weeklyHighlightSettings, setWeeklyHighlightSettings }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CoachEvent | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CoachEvent | null>(null);
  const [isLoadingAiHighlights, setIsLoadingAiHighlights] = useState(false);
  const [aiHighlightsError, setAiHighlightsError] = useState<string | null>(null);

  const handleSaveEvent = (newEventData: Omit<CoachEvent, 'id'>) => {
    const newEvent: CoachEvent = { ...newEventData, id: crypto.randomUUID(), createdDate: new Date().toISOString() };
    setEvents(prev => [...prev, newEvent]);
  };

  const handleUpdateEvent = (updatedEvent: CoachEvent) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
  };

  const openEditModal = (event: CoachEvent) => {
    setEditingEvent(event);
    setIsCreateModalOpen(true);
  };
  
  const openCreateModal = () => {
    setEditingEvent(null);
    setIsCreateModalOpen(true);
  };

  const initiateDelete = (event: CoachEvent) => {
    setEventToDelete(event);
    setShowConfirmDelete(true);
  };
  
  const confirmDelete = () => {
    if (eventToDelete) {
      setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
    }
    setEventToDelete(null);
    setShowConfirmDelete(false);
  };

  const getStudioLabel = (target: 'all' | 'salem' | 'karra') => {
    return STUDIO_TARGET_OPTIONS.find(opt => opt.value === target)?.label || 'Okänd';
  };

  const sortedEvents = [...events].sort((a, b) => new Date((b as any).createdDate || (b as any).date).getTime() - new Date((a as any).createdDate || (a as any).date).getTime());
  
  const handleSettingChange = (field: keyof WeeklyHighlightSettings, value: any) => {
    setWeeklyHighlightSettings(prev => ({...prev, [field]: value}));
  };
  
  const handleGenerateWeeklyHighlights = async () => {
    setIsLoadingAiHighlights(true);
    setAiHighlightsError(null);

    const oneWeekAgo = dateUtils.addDays(new Date(), -7);
    const logsLastWeek = workoutLogs.filter(log => new Date(log.completedDate) >= oneWeekAgo);

    const pbsLastWeek = logsLastWeek
      .flatMap(log => {
        const participant = participants.find(p => p.id === log.participantId);
        return (log.postWorkoutSummary?.newPBs || []).map(pb => ({ ...pb, participantName: participant?.name || 'Okänd' }));
      })
      .slice(0, 10); // Limit to 10 PBs for prompt length

    const prompt = `Du är "Flexibot", en AI-assistent för Flexibel Hälsostudio. Din uppgift är att skapa ett "Veckans Höjdpunkter"-inlägg för community-flödet. Svaret MÅSTE vara på svenska och formaterat med Markdown.

    **Data från den gångna veckan:**
    - Totalt antal loggade pass: ${logsLastWeek.length}
    - Antal medlemmar som tränat: ${new Set(logsLastWeek.map(l => l.participantId)).size}
    - Några av veckans personliga rekord (PBs):
    ${pbsLastWeek.length > 0 ? pbsLastWeek.map(pb => `  * ${pb.participantName} slog PB i ${pb.exerciseName} med ${pb.value}!`).join('\n') : '  * Inga nya PBs loggade denna vecka.'}

    **Ditt uppdrag:**
    1.  Skapa en titel i formatet: \`Veckans Höjdpunkter - v${dateUtils.getISOWeek(new Date())}\`.
    2.  Skriv en kort, peppande sammanfattning av veckans aktivitet.
    3.  Lyft fram 2-3 av de mest imponerande PBs från listan.
    4.  Avsluta med en uppmuntrande fras om att fortsätta kämpa.
    5.  Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.
    `;

    try {
        const result = await callGeminiApiFn({ model: 'gemini-2.5-flash', contents: prompt });
        const { text, error } = result.data as { text?: string; error?: string };
        if (error) throw new Error(error);
        
        const lines = text.split('\n');
        const title = lines.find(l => l.trim().length > 0) || `Veckans Höjdpunkter - v${dateUtils.getISOWeek(new Date())}`;
        const description = lines.slice(1).join('\n');

        const highlightEvent: Omit<CoachEvent, 'id' | 'createdDate'> = {
            title: title.replace(/#/g, '').trim(),
            description: description.trim(),
            type: 'news',
            studioTarget: 'all',
        };

        setEditingEvent({ ...highlightEvent, id: 'temp-ai-highlight', createdDate: new Date().toISOString() });
        setIsCreateModalOpen(true);
    } catch (err) {
        setAiHighlightsError(`Kunde inte generera höjdpunkter: ${err instanceof Error ? err.message : 'Okänt fel'}`);
    } finally {
        setIsLoadingAiHighlights(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center mb-6 pb-4 border-b">
            <Button onClick={openCreateModal} className="mt-3 sm:mt-0">
                Skapa Nytt Inlägg
            </Button>
        </div>

        <div className="space-y-4">
            {sortedEvents.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Inga inlägg har skapats än.</p>
            ) : (
                sortedEvents.map((event, index) => (
                    <div key={event.id} className="p-4 border rounded-md flex justify-between items-start gap-4" style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards` }}>
                        <div className="flex-grow">
                             <p className="text-sm font-semibold text-flexibel">
                                {event.type === 'event' && event.eventDate
                                ? `Händelsedatum: ${new Date(event.eventDate).toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
                                : `Publicerad: ${new Date(event.createdDate).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <h3 className="text-lg font-bold text-gray-800">{event.title.includes("Höjdpunkter") ? '' : DEFAULT_COACH_EVENT_ICON} {event.title}</h3>
                                <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{getStudioLabel(event.studioTarget)}</span>
                            </div>
                            {event.description && <p className="text-base text-gray-600 mt-1 whitespace-pre-wrap">{event.description}</p>}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <Button onClick={() => openEditModal(event)} variant="outline" size="sm">Redigera</Button>
                            <Button onClick={() => initiateDelete(event)} variant="danger" size="sm" aria-label={`Ta bort händelse ${event.title}`}><TrashIcon /></Button>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="mt-8 pt-6 border-t">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Automatisera Veckans Höjdpunkter (AI)</h3>
            <p className="text-base text-gray-600 mb-4">
                Generera automatiskt ett "Veckans Höjdpunkter"-inlägg för flödet baserat på medlemmarnas prestationer den senaste veckan. Endast medlemmar som godkänt att delta i topplistor inkluderas.
            </p>
            <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
                 <Button onClick={handleGenerateWeeklyHighlights} disabled={isLoadingAiHighlights}>
                    {isLoadingAiHighlights ? 'Genererar...' : 'Generera "Veckans Höjdpunkter" med AI'}
                </Button>
                {aiHighlightsError && <p className="text-sm text-red-600">{aiHighlightsError}</p>}
                <ToggleSwitch
                    id="highlight-toggle"
                    checked={weeklyHighlightSettings.isEnabled}
                    onChange={(val) => handleSettingChange('isEnabled', val)}
                    label="Aktivera automatiska veckoinlägg"
                    description="När detta är aktivt kommer systemet automatiskt att skapa ett 'Veckans Höjdpunkter'-inlägg baserat på dina schemainställningar nedan."
                />
                {weeklyHighlightSettings.isEnabled && (
                    <div className="space-y-4 pt-4 border-t animate-fade-in-down">
                         <Select
                            label="Publiceringsdag"
                            inputSize='sm'
                            value={String(weeklyHighlightSettings.dayOfWeek)}
                            onChange={(e) => handleSettingChange('dayOfWeek', Number(e.target.value))}
                            options={DAY_OF_WEEK_OPTIONS.map(opt => ({ value: String(opt.value), label: opt.label }))}
                        />
                         <Input
                            label="Publiceringstid"
                            type="time"
                            inputSize='sm'
                            value={weeklyHighlightSettings.time}
                            onChange={(e) => handleSettingChange('time', e.target.value)}
                        />
                         <Select
                            label="Målgrupp för inlägg"
                            inputSize='sm'
                            value={weeklyHighlightSettings.studioTarget}
                            onChange={(e) => handleSettingChange('studioTarget', e.target.value as WeeklyHighlightSettings['studioTarget'])}
                            options={HIGHLIGHT_STUDIO_OPTIONS}
                        />
                    </div>
                )}
            </div>
        </div>

        <CreateEventModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSaveEvent={editingEvent?.id === 'temp-ai-highlight' ? handleSaveEvent : (editingEvent ? handleUpdateEvent : handleSaveEvent)}
            eventToEdit={editingEvent}
        />

        <ConfirmationModal
            isOpen={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)}
            onConfirm={confirmDelete}
            title="Ta bort inlägg"
            message={`Är du säker på att du vill ta bort inlägget "${eventToDelete?.title}"? Detta kan inte ångras.`}
            confirmButtonText="Ta bort"
        />
    </div>
  );
};