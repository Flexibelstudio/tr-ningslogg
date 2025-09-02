import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { CoachEvent } from '../../types';
import { STUDIO_TARGET_OPTIONS } from '../../constants';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEvent: (event: CoachEvent | Omit<CoachEvent, 'id'>) => void;
  eventToEdit?: CoachEvent | null;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onSaveEvent, eventToEdit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [studioTarget, setStudioTarget] = useState<'all' | 'salem' | 'karra'>('all');
  const [type, setType] = useState<'event' | 'news'>('event');

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setTitle(eventToEdit.title);
        setDescription(eventToEdit.description || '');
        setType(eventToEdit.type || 'event');
        // Date input needs YYYY-MM-DD format
        setDate(eventToEdit.eventDate ? eventToEdit.eventDate.split('T')[0] : '');
        setStudioTarget(eventToEdit.studioTarget || 'all');
      } else {
        setTitle('');
        setDescription('');
        setDate('');
        setStudioTarget('all');
        setType('event');
      }
      setError('');
    }
  }, [isOpen, eventToEdit]);
  
  const handleSave = () => {
    if (!title.trim() || (type === 'event' && !date)) {
      setError('Titel och datum (för händelser) är obligatoriska fält.');
      return;
    }
    setError('');

    const eventData = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        eventDate: type === 'event' ? date : undefined,
        createdDate: eventToEdit?.createdDate || new Date().toISOString(),
        studioTarget,
    };

    if (eventToEdit) {
      onSaveEvent({ ...eventData, id: eventToEdit.id });
    } else {
      onSaveEvent(eventData as Omit<CoachEvent, 'id'>);
    }
    onClose();
  };

  const modalTitle = eventToEdit ? 'Redigera Händelse/Nyhet' : 'Skapa Ny Händelse/Nyhet';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
        
        <div>
            <label className="block text-base font-medium text-gray-700 mb-2">Typ av inlägg</label>
            <div className="flex gap-4 p-2 bg-gray-100 rounded-md">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="event" checked={type === 'event'} onChange={() => setType('event')} className="h-4 w-4 text-flexibel"/> 
                    <span className="text-base">Händelse (med datum)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="news" checked={type === 'news'} onChange={() => setType('news')} className="h-4 w-4 text-flexibel"/> 
                    <span className="text-base">Nyhet (utan datum)</span>
                </label>
            </div>
        </div>

        <Input
          label="Titel *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="T.ex. InBody-mätningsdag"
          required
        />
        <Textarea
          label="Beskrivning/Text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="En kort beskrivning av händelsen eller nyheten."
          rows={3}
        />
        {type === 'event' && (
            <Input
            label="Datum *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            />
        )}
        <Select
          label="Gäller för *"
          value={studioTarget}
          onChange={(e) => setStudioTarget(e.target.value as 'all' | 'salem' | 'karra')}
          options={STUDIO_TARGET_OPTIONS}
        />
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave} variant="primary">Spara</Button>
        </div>
      </div>
    </Modal>
  );
};
