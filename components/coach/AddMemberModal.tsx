import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { ParticipantProfile, Location, Membership, StaffMember } from '../../types';
import { addDays } from '../../utils/dateUtils';

interface AddEditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMember: (memberData: ParticipantProfile) => void;
  memberToEdit: ParticipantProfile | null;
  existingEmails: string[];
  locations: Location[];
  memberships: Membership[];
  loggedInStaff: StaffMember | null;
}

export const AddMemberModal: React.FC<AddEditMemberModalProps> = ({ isOpen, onClose, onSaveMember, memberToEdit, existingEmails, locations, memberships, loggedInStaff }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isProspect, setIsProspect] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [remainingClips, setRemainingClips] = useState('');
  const [clipCardExpiryDate, setClipCardExpiryDate] = useState('');
  const [errors, setErrors] = useState<{ name?: string, email?: string, locationId?: string, membershipId?: string, remainingClips?: string }>({});

  const isAdmin = loggedInStaff?.role === 'Admin';

  useEffect(() => {
    if (isOpen) {
      if (memberToEdit) {
        setName(memberToEdit.name || '');
        setEmail(memberToEdit.email || '');
        setIsProspect(memberToEdit.isProspect || false);
        setLocationId(memberToEdit.locationId || '');
        setMembershipId(memberToEdit.membershipId || '');
        setStartDate(memberToEdit.startDate || '');
        setEndDate(memberToEdit.endDate || '');
        setRemainingClips(memberToEdit.clipCardStatus?.remainingClips?.toString() || '');
        setClipCardExpiryDate(memberToEdit.clipCardStatus?.expiryDate || '');
      } else {
        setName('');
        setEmail('');
        setIsProspect(false);
        setLocationId(locations[0]?.id || '');
        setMembershipId(memberships[0]?.id || '');
        setStartDate('');
        setEndDate('');
        setRemainingClips('');
        setClipCardExpiryDate('');
      }
      setErrors({});
    }
  }, [isOpen, memberToEdit, locations, memberships]);

  const validate = () => {
    const newErrors: { name?: string, email?: string, locationId?: string, remainingClips?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Namn är obligatoriskt.";
    }
    if (!email.trim()) {
      newErrors.email = "E-post är obligatoriskt.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Ogiltig e-postadress.";
    } else if (existingEmails.includes(email.trim().toLowerCase()) && email.trim().toLowerCase() !== memberToEdit?.email?.toLowerCase()) {
      newErrors.email = "Denna e-postadress är redan registrerad.";
    }
    if (!locationId) {
        newErrors.locationId = "Ort är obligatoriskt.";
    }
    const selectedMembership = memberships.find(m => m.id === membershipId);
    if (isAdmin && !isProspect && selectedMembership?.type === 'clip_card') {
        if (remainingClips.trim() !== '' && (isNaN(Number(remainingClips)) || Number(remainingClips) < 0 || !Number.isInteger(Number(remainingClips)))) {
            newErrors.remainingClips = "Ange ett giltigt, positivt heltal för antal klipp.";
        }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMembershipChange = (newMembershipId: string) => {
    setMembershipId(newMembershipId);
    const selectedMembership = memberships.find(m => m.id === newMembershipId);
    if (selectedMembership && selectedMembership.type === 'clip_card') {
      setRemainingClips(String(selectedMembership.clipCardClips || ''));
      let newExpiryDate = '';
      if (selectedMembership.clipCardValidityDays) {
          const effectiveStartDate = new Date(startDate || new Date().toISOString().split('T')[0]);
          const expiry = addDays(effectiveStartDate, selectedMembership.clipCardValidityDays);
          newExpiryDate = expiry.toISOString().split('T')[0];
      }
      setClipCardExpiryDate(newExpiryDate);
    } else {
      setRemainingClips('');
      setClipCardExpiryDate('');
    }
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    let finalIsActive = memberToEdit?.isActive ?? !isProspect;
    if (isProspect) {
        finalIsActive = false; // Prospects are always inactive.
    } else if (memberToEdit?.isProspect && !isProspect) {
        // This is a conversion from prospect to member
        finalIsActive = true;
    }
    
    // If a non-admin is converting a prospect, they can't see the membership dropdown.
    // We need to assign a default membership.
    const isConvertingProspectByCoach = !isAdmin && memberToEdit?.isProspect && !isProspect;
    
    let clipCardStatus: ParticipantProfile['clipCardStatus'] | undefined = undefined;
    const selectedMembership = memberships.find(m => m.id === membershipId);

    if (selectedMembership && selectedMembership.type === 'clip_card') {
        const newRemainingClips = remainingClips.trim() ? parseInt(remainingClips, 10) : (selectedMembership.clipCardClips || 0);
        const newExpiryDate: string | undefined = clipCardExpiryDate.trim() ? clipCardExpiryDate : undefined;

        clipCardStatus = {
            remainingClips: newRemainingClips,
            expiryDate: newExpiryDate,
        };
    } else {
        clipCardStatus = undefined;
    }

    const memberData: ParticipantProfile = {
        ...(memberToEdit || {}),
        id: memberToEdit?.id || crypto.randomUUID(),
        name: name.trim(),
        email: (isAdmin || !memberToEdit) ? email.trim().toLowerCase() : memberToEdit?.email,
        isProspect,
        isActive: finalIsActive,
        locationId: isAdmin ? locationId : memberToEdit?.locationId,
        
        startDate: isProspect ? undefined : (startDate || undefined),
        
        membershipId: isAdmin ? (isProspect ? undefined : membershipId) : (isConvertingProspectByCoach ? (memberships.find(m => m.name === 'Medlemskap')?.id || memberships[0]?.id) : memberToEdit?.membershipId),
        endDate: isAdmin ? (isProspect ? undefined : (endDate || undefined)) : (memberToEdit?.endDate),
        
        creationDate: memberToEdit?.creationDate || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        clipCardStatus,
    };

    onSaveMember(memberData);
    onClose();
  };

  const locationOptions = locations.map(loc => ({ value: loc.id, label: loc.name }));
  const membershipOptions = memberships.map(mem => ({ value: mem.id, label: mem.name }));
  const modalTitle = memberToEdit ? "Redigera Medlem" : "Lägg till Ny Medlem";
  
  const selectedMembership = memberships.find(m => m.id === membershipId);
  const isClipCardMembership = selectedMembership?.type === 'clip_card';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
            <input
                type="checkbox"
                checked={isProspect}
                onChange={(e) => setIsProspect(e.target.checked)}
                className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
            />
            <div>
                <span className="text-lg font-medium text-gray-700">
                    Prospekt / Introsamtal
                </span>
                <p className="text-sm text-gray-500">
                    Markera här om personen inte är en aktiv medlem än. Detta döljer medlemskapsfälten.
                </p>
            </div>
        </label>
        <Input
          label="Namn *"
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="E-post *"
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
          readOnly={!isAdmin && !!memberToEdit}
          className={!isAdmin && !!memberToEdit ? 'bg-gray-100 cursor-not-allowed' : ''}
        />
        <Select
          label="Ort *"
          id="member-location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          options={[{ value: '', label: 'Välj en ort...' }, ...locationOptions]}
          error={errors.locationId}
          required
          disabled={!isAdmin}
          className={!isAdmin ? 'bg-gray-100 cursor-not-allowed' : ''}
        />

        {/* Admin-only: Membership Type */}
        {isAdmin && !isProspect && (
            <Select
            label="Medlemskap *"
            id="member-membership"
            value={membershipId}
            onChange={(e) => handleMembershipChange(e.target.value)}
            options={[{ value: '', label: 'Välj medlemskap...' }, ...membershipOptions]}
            error={errors.membershipId}
            required
            />
        )}
        
        {isAdmin && !isProspect && isClipCardMembership && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-blue-50/50 animate-fade-in-down">
                <Input
                    label="Antal Klipp Kvar"
                    id="member-clips"
                    type="number"
                    value={remainingClips}
                    onChange={(e) => setRemainingClips(e.target.value)}
                    error={errors.remainingClips}
                    min="0"
                    step="1"
                    placeholder="Standard från medlemskap"
                />
                <Input
                    label="Klippkort Giltigt Till"
                    id="member-clipcard-expiry"
                    type="date"
                    value={clipCardExpiryDate}
                    onChange={(e) => setClipCardExpiryDate(e.target.value)}
                />
            </div>
        )}

        {/* Membership Dates - Start date visible to coach, End date admin-only */}
        {!isProspect && (
            <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                <Input
                    label="Startdatum"
                    id="member-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
                {isAdmin && (
                    <Input
                        label="Slutdatum"
                        id="member-end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                )}
            </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">Avbryt</Button>
          <Button onClick={handleSave} variant="primary">Spara</Button>
        </div>
      </div>
    </Modal>
  );
};
