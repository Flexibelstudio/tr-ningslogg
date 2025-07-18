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

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setTitle(eventToEdit.title);
        setDescription(eventToEdit.description || '');
        // Date input needs YYYY-MM-DD format
        setDate(eventToEdit.date.split('T')[0]);
        setStudioTarget(eventToEdit.studioTarget || 'all');
      } else {
        setTitle('');
        setDescription('');
        setDate('');
        setStudioTarget('all');
      }
      setError('');
    }
  }, [isOpen, eventToEdit]);
  
  const handleSave = () => {
    if (!title.trim() || !date) {
      setError('Titel och datum är obligatoriska fält.');
      return;
    }
    setError('');

    const eventData = {
        title: title.trim(),
        description: description.trim() || undefined,
        date, // Already in YYYY-MM-DD format
        studioTarget,
    };

    if (eventToEdit) {
      onSaveEvent({ ...eventData, id: eventToEdit.id });
    } else {
      onSaveEvent(eventData);
    }
    onClose();
  };

  const modalTitle = eventToEdit ? 'Redigera Händelse' : 'Skapa Ny Händelse';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
        <Input
          label="Titel *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="T.ex. InBody-mätningsdag"
          required
        />
        <Textarea
          label="Beskrivning (valfri)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="En kort beskrivning av händelsen."
          rows={3}
        />
        <Input
          label="Datum *"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Select
          label="Gäller för *"
          value={studioTarget}
          onChange={(e) => setStudioTarget(e.target.value as 'all' | 'salem' | 'karra')}
          options={STUDIO_TARGET_OPTIONS}
        />
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave} variant="primary">Spara Händelse</Button>
        </div>
      </div>
    </Modal>
  );
};
