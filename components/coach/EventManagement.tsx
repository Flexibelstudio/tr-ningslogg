import React, { useState } from 'react';
import { CoachEvent } from '../../types';
import { Button } from '../Button';
import { CreateEventModal } from './CreateEventModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { DEFAULT_COACH_EVENT_ICON, STUDIO_TARGET_OPTIONS } from '../../constants';

interface EventManagementProps {
  events: CoachEvent[];
  setEvents: (events: CoachEvent[] | ((prev: CoachEvent[]) => CoachEvent[])) => void;
}

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

export const EventManagement: React.FC<EventManagementProps> = ({ events, setEvents }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CoachEvent | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CoachEvent | null>(null);

  const handleSaveEvent = (newEventData: Omit<CoachEvent, 'id'>) => {
    const newEvent: CoachEvent = { ...newEventData, id: crypto.randomUUID() };
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

  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">
                Händelser & Kommunikation
            </h2>
            <Button onClick={openCreateModal} className="mt-3 sm:mt-0">
                Skapa Ny Händelse
            </Button>
        </div>

        <div className="space-y-4">
            {sortedEvents.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Inga händelser har skapats än.</p>
            ) : (
                sortedEvents.map(event => (
                    <div key={event.id} className="p-4 border rounded-md flex justify-between items-start gap-4">
                        <div className="flex-grow">
                            <p className="text-sm font-semibold text-flexibel">{new Date(event.date).toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <h3 className="text-lg font-bold text-gray-800">{DEFAULT_COACH_EVENT_ICON} {event.title}</h3>
                                <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{getStudioLabel(event.studioTarget)}</span>
                            </div>
                            {event.description && <p className="text-base text-gray-600 mt-1">{event.description}</p>}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <Button onClick={() => openEditModal(event)} variant="outline" size="sm">Redigera</Button>
                            <Button onClick={() => initiateDelete(event)} variant="danger" size="sm" aria-label={`Ta bort händelse ${event.title}`}><TrashIcon /></Button>
                        </div>
                    </div>
                ))
            )}
        </div>

        <CreateEventModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSaveEvent={editingEvent ? handleUpdateEvent : handleSaveEvent}
            eventToEdit={editingEvent}
        />

        <ConfirmationModal
            isOpen={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)}
            onConfirm={confirmDelete}
            title="Ta bort händelse"
            message={`Är du säker på att du vill ta bort händelsen "${eventToDelete?.title}"? Detta kan inte ångras.`}
            confirmButtonText="Ta bort"
        />
    </div>
  );
};
