import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { ProspectIntroCall } from '../../types';

interface IntroCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (introCall: Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>) => void;
  introCallToEdit?: ProspectIntroCall | null;
  onUpdate?: (introCall: ProspectIntroCall) => void;
  initialData?: Partial<Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>>;
}

export const IntroCallModal: React.FC<IntroCallModalProps> = ({ isOpen, onClose, onSave, introCallToEdit, onUpdate, initialData }) => {
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [backgroundNotes, setBackgroundNotes] = useState('');
  const [goalsNotes, setGoalsNotes] = useState('');
  const [lifestyleNotes, setLifestyleNotes] = useState('');
  const [physicalNotes, setPhysicalNotes] = useState('');
  const [coachSummary, setCoachSummary] = useState('');
  const [error, setError] = useState('');

  const isEditing = !!introCallToEdit;

  const resetForm = () => {
    setProspectName('');
    setProspectEmail('');
    setProspectPhone('');
    setBackgroundNotes('');
    setGoalsNotes('');
    setLifestyleNotes('');
    setPhysicalNotes('');
    setCoachSummary('');
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      if (introCallToEdit) {
        setProspectName(introCallToEdit.prospectName);
        setProspectEmail(introCallToEdit.prospectEmail || '');
        setProspectPhone(introCallToEdit.prospectPhone || '');
        setBackgroundNotes(introCallToEdit.backgroundNotes || '');
        setGoalsNotes(introCallToEdit.goalsNotes || '');
        setLifestyleNotes(introCallToEdit.lifestyleNotes || '');
        setPhysicalNotes(introCallToEdit.physicalNotes || '');
        setCoachSummary(introCallToEdit.coachSummary || '');
      } else if (initialData) {
        setProspectName(initialData.prospectName || '');
        setProspectEmail(initialData.prospectEmail || '');
        setProspectPhone(initialData.prospectPhone || '');
        setBackgroundNotes(initialData.backgroundNotes || '');
        setGoalsNotes(initialData.goalsNotes || '');
        setLifestyleNotes(initialData.lifestyleNotes || '');
        setPhysicalNotes(initialData.physicalNotes || '');
        setCoachSummary(initialData.coachSummary || '');
      }
       else {
        resetForm();
      }
      setError('');
    }
  }, [isOpen, introCallToEdit, initialData]);

  const handleSave = () => {
    if (!prospectName.trim()) {
      setError('Namn är obligatoriskt.');
      return;
    }
    setError('');

    const callData = {
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail.trim() || undefined,
      prospectPhone: prospectPhone.trim() || undefined,
      backgroundNotes: backgroundNotes.trim() || undefined,
      goalsNotes: goalsNotes.trim() || undefined,
      lifestyleNotes: lifestyleNotes.trim() || undefined,
      physicalNotes: physicalNotes.trim() || undefined,
      coachSummary: coachSummary.trim() || undefined,
    };

    if (isEditing && onUpdate && introCallToEdit) {
      onUpdate({ ...introCallToEdit, ...callData });
    } else {
      onSave(callData);
    }
    onClose();
  };
  
  const modalTitle = isEditing ? 'Redigera Introsamtal' : 'Nytt Introsamtal';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {error && <p className="text-red-500 bg-red-100 p-2 rounded-md">{error}</p>}

        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Grundinformation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Namn *"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            required
          />
          <Input
            label="E-post"
            type="email"
            value={prospectEmail}
            onChange={(e) => setProspectEmail(e.target.value)}
          />
        </div>
        <Input
          label="Telefonnummer"
          type="tel"
          value={prospectPhone}
          onChange={(e) => setProspectPhone(e.target.value)}
        />
        
        <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 pt-4">Samtalsmall</h3>
        
        <Textarea 
          label="Bakgrund & Träningshistorik"
          value={backgroundNotes}
          onChange={(e) => setBackgroundNotes(e.target.value)}
          rows={4}
          placeholder="Tidigare erfarenhet, vad har fungerat/inte fungerat?"
        />
        <Textarea 
          label="Målsättningar"
          value={goalsNotes}
          onChange={(e) => setGoalsNotes(e.target.value)}
          rows={4}
          placeholder="Vad vill personen uppnå? Varför är det viktigt?"
        />
        <Textarea 
          label="Nuläge & Livsstil"
          value={lifestyleNotes}
          onChange={(e) => setLifestyleNotes(e.target.value)}
          rows={4}
          placeholder="Jobb, stress, sömn, kostvanor i stora drag."
        />
        <Textarea 
          label="Fysiska Förutsättningar"
          value={physicalNotes}
          onChange={(e) => setPhysicalNotes(e.target.value)}
          rows={4}
          placeholder="Skador, smärta, sjukdomar vi bör känna till?"
        />
        <Textarea 
          label="Coachanteckningar & Nästa Steg"
          value={coachSummary}
          onChange={(e) => setCoachSummary(e.target.value)}
          rows={4}
          placeholder="Sammanfattning, rekommenderat medlemskap, plan för uppföljning etc."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t mt-4">
        <Button onClick={onClose} variant="secondary">Avbryt</Button>
        <Button onClick={handleSave} variant="primary">{isEditing ? 'Spara Ändringar' : 'Spara Introsamtal'}</Button>
      </div>
    </Modal>
  );
};