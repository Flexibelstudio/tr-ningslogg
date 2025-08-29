import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { StaffMember, Location, StaffRole, ParticipantProfile } from '../../types';
import { STAFF_ROLE_OPTIONS } from '../../constants';

interface AddEditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (staffMember: StaffMember) => void;
  staffToEdit: StaffMember | null;
  locations: Location[];
  participants: ParticipantProfile[];
}

export const AddEditStaffModal: React.FC<AddEditStaffModalProps> = ({ isOpen, onClose, onSave, staffToEdit, locations, participants }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('Coach');
  const [locationId, setLocationId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<{ name?: string, locationId?: string, email?: string }>({});

  useEffect(() => {
    if (isOpen) {
      if (staffToEdit) {
        setName(staffToEdit.name);
        setEmail(staffToEdit.email || '');
        setRole(staffToEdit.role);
        setLocationId(staffToEdit.locationId);
        setIsActive(staffToEdit.isActive);
        setStartDate(staffToEdit.startDate || '');
        setEndDate(staffToEdit.endDate || '');
      } else {
        // Reset for new member
        setName('');
        setEmail('');
        setRole('Coach');
        setLocationId(locations[0]?.id || ''); // Default to first location if available
        setIsActive(true);
        setStartDate('');
        setEndDate('');
      }
      setErrors({});
    }
  }, [isOpen, staffToEdit, locations]);

  const locationOptions = locations.map(loc => ({ value: loc.id, label: loc.name }));

  const handleSave = () => {
    const newErrors: { name?: string, locationId?: string, email?: string } = {};
    if (!name.trim()) newErrors.name = 'Namn är obligatoriskt.';
    if (!locationId) newErrors.locationId = 'Ort är obligatoriskt.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Ogiltig e-postadress.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const participantWithSameEmail = participants.find(
      p => p.email && email.trim() && p.email.toLowerCase() === email.trim().toLowerCase()
    );
    
    const staffData: StaffMember = {
      id: staffToEdit?.id || crypto.randomUUID(),
      name: name.trim(),
      email: email.trim() || undefined,
      role,
      locationId,
      isActive,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      linkedParticipantProfileId: participantWithSameEmail?.id,
    };

    onSave(staffData);
    onClose();
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={staffToEdit ? 'Redigera Personal' : 'Lägg till Personal'}>
      <div className="space-y-4">
        <Input label="Namn *" value={name} onChange={e => setName(e.target.value)} required error={errors.name} />
        <Input label="E-post (för växla till medlemsvy)" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
        <Select label="Roll *" value={role} onChange={e => setRole(e.target.value as StaffRole)} options={STAFF_ROLE_OPTIONS} required />
        <Select label="Ort *" value={locationId} onChange={e => setLocationId(e.target.value)} options={[{value: '', label: 'Välj en ort...'}, ...locationOptions]} required error={errors.locationId} />
        
        <div className="grid grid-cols-2 gap-4">
            <Input
                label="Startdatum"
                id="staff-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
                label="Slutdatum"
                id="staff-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
            />
        </div>

        <label className="flex items-center space-x-2 pt-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isActive} 
            onChange={e => setIsActive(e.target.checked)} 
            className="h-5 w-5 text-flexibel rounded border-gray-300 focus:ring-flexibel"
          />
          <span className="text-gray-700">Aktiv</span>
        </label>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave}>Spara</Button>
        </div>
      </div>
    </Modal>
  );
};
