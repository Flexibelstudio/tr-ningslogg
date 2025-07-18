import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { ParticipantProfile } from '../../types';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (memberData: Omit<ParticipantProfile, 'id' | 'lastUpdated'>) => void;
  existingEmails: string[];
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onAddMember, existingEmails }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string, email?: string }>({});

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const newErrors: { name?: string, email?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Namn är obligatoriskt.";
    }
    if (!email.trim()) {
      newErrors.email = "E-post är obligatoriskt.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Ogiltig e-postadress.";
    } else if (existingEmails.includes(email.trim().toLowerCase())) {
      newErrors.email = "Denna e-postadress är redan registrerad.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    onAddMember({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      isActive: true,
      creationDate: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lägg till Ny Medlem">
      <div className="space-y-4">
        <Input
          label="Namn *"
          id="new-member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="E-post *"
          id="new-member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave} variant="primary">Spara Medlem</Button>
        </div>
      </div>
    </Modal>
  );
};
