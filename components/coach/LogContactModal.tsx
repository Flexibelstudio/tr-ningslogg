import React, { useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Select, Input } from '../Input';
import { Textarea } from '../Textarea';
import { ContactAttempt, ContactAttemptMethod, ContactAttemptOutcome, Lead } from '../../types';
import { CONTACT_ATTEMPT_METHOD_OPTIONS, CONTACT_ATTEMPT_OUTCOME_OPTIONS } from '../../constants';

interface LogContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSave: (attempt: Omit<ContactAttempt, 'id' | 'timestamp' | 'coachId'>) => void;
}

export const LogContactModal: React.FC<LogContactModalProps> = ({ isOpen, onClose, lead, onSave }) => {
  const [method, setMethod] = useState<ContactAttemptMethod | 'other'>('phone');
  const [customMethod, setCustomMethod] = useState('');
  const [outcome, setOutcome] = useState<ContactAttemptOutcome>('no_answer');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    onSave({
        method: method === 'other' ? (customMethod.trim() || 'Övrigt') : method,
        outcome,
        notes: notes.trim() || undefined
    });
    // Reset and close
    setMethod('phone');
    setCustomMethod('');
    setOutcome('no_answer');
    setNotes('');
    onClose();
  };

  if (!isOpen || !lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Logga kontakt: ${lead.firstName} ${lead.lastName}`} size="md">
      <div className="space-y-4">
          <div>
              <Select
                  label="Kontaktmetod"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as ContactAttemptMethod)}
                  options={CONTACT_ATTEMPT_METHOD_OPTIONS}
              />
          </div>
          
          {method === 'other' && (
              <div className="animate-fade-in-down">
                <Input 
                    label="Beskriv metod"
                    value={customMethod}
                    onChange={(e) => setCustomMethod(e.target.value)}
                    placeholder="T.ex. Messenger, via anhörig..."
                    required
                />
              </div>
          )}

          <div>
              <Select
                  label="Utfall"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as ContactAttemptOutcome)}
                  options={CONTACT_ATTEMPT_OUTCOME_OPTIONS}
              />
          </div>
          <div>
              <Textarea
                  label="Notering (valfritt)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="T.ex. Lämnade meddelande, bad ringa upp senare..."
                  rows={3}
              />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={onClose}>Avbryt</Button>
              <Button onClick={handleSave} disabled={method === 'other' && !customMethod.trim()}>Spara logg</Button>
          </div>
      </div>
    </Modal>
  );
};