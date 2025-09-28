import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { ParticipantProfile, Location, Membership, StaffMember, StaffRole, User } from '../../types';
import { addDays } from '../../utils/dateUtils';
import { useAppContext } from '../../context/AppContext';
import { STAFF_ROLE_OPTIONS } from '../../constants';
import { useAuth } from '../../context/AuthContext';

interface AddEditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMember: (memberData: ParticipantProfile) => Promise<void>;
  memberToEdit: ParticipantProfile | null;
  existingEmails: string[];
  locations: Location[];
  memberships: Membership[];
  loggedInStaff: StaffMember | null;
}

export const AddMemberModal: React.FC<AddEditMemberModalProps> = ({ isOpen, onClose, onSaveMember, memberToEdit, existingEmails, locations, memberships, loggedInStaff }) => {
  const { staffMembers, setStaffMembersData, allUsers, updateUser } = useAppContext();
  const { organizationId } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [locationId, setLocationId] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [remainingClips, setRemainingClips] = useState('');
  const [clipCardExpiryDate, setClipCardExpiryDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  const [isStaff, setIsStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>('Coach');

  const isAdmin = loggedInStaff?.role === 'Admin';

  useEffect(() => {
    if (isOpen) {
      if (memberToEdit) {
        setName(memberToEdit.name || '');
        setEmail(memberToEdit.email || '');
        setLocationId(memberToEdit.locationId || '');
        setMembershipId(memberToEdit.membershipId || '');
        setStartDate(memberToEdit.startDate || '');
        setEndDate(memberToEdit.endDate || '');
        setRemainingClips(memberToEdit.clipCardStatus?.remainingClips?.toString() || '');
        setClipCardExpiryDate(memberToEdit.clipCardStatus?.expiryDate || '');

        const existingStaff = staffMembers.find(s => s.linkedParticipantProfileId === memberToEdit.id || s.email?.toLowerCase() === memberToEdit.email?.toLowerCase());
        setIsStaff(!!existingStaff);
        setStaffRole(existingStaff?.role || 'Coach');
      } else {
        setName('');
        setEmail('');
        const initialLocation = isAdmin ? '' : (loggedInStaff?.locationId || '');
        setLocationId(initialLocation);
        setMembershipId(memberships[0]?.id || '');
        setStartDate('');
        setEndDate('');
        setRemainingClips('');
        setClipCardExpiryDate('');
        setIsStaff(false);
        setStaffRole('Coach');
      }
      setFormError(null);
      setIsSaving(false);
      setHasSaved(false);
    }
  }, [isOpen, memberToEdit, memberships, isAdmin, loggedInStaff, staffMembers]);

  const formErrors = useMemo(() => {
    const newErrors: { name?: string, email?: string, locationId?: string, membershipId?: string, remainingClips?: string } = {};
    const trimmedEmail = email.trim().toLowerCase();

    if (!name.trim()) {
      newErrors.name = "Namn är obligatoriskt.";
    }
    if (!trimmedEmail) {
      newErrors.email = "E-post är obligatoriskt.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Ogiltig e-postadress.";
    } else if (existingEmails.includes(trimmedEmail) && trimmedEmail !== memberToEdit?.email?.toLowerCase()) {
      newErrors.email = "Denna e-postadress är redan registrerad.";
    }
    if (!locationId) {
        newErrors.locationId = "Ort är obligatoriskt.";
    }

    if (isAdmin) {
        if (!membershipId) {
            newErrors.membershipId = "Medlemskap är obligatoriskt.";
        } else {
            const selectedMembership = memberships.find(m => m.id === membershipId);
            if (selectedMembership?.type === 'clip_card') {
                const clips = remainingClips.trim();
                if (clips !== '' && (isNaN(Number(clips)) || Number(clips) < 0 || !Number.isInteger(Number(clips)))) {
                    newErrors.remainingClips = "Ange ett giltigt, positivt heltal för antal klipp.";
                }
            }
        }
    }
    return newErrors;
  }, [name, email, locationId, membershipId, remainingClips, existingEmails, memberToEdit, isAdmin, memberships]);

  const isFormValidForSaving = Object.keys(formErrors).length === 0;

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

  const handleSave = async () => {
    if (!isFormValidForSaving) {
      return;
    }

    setIsSaving(true);
    setHasSaved(false);
    setFormError(null);

    const finalIsActive = memberToEdit?.isActive ?? true;

    const memberData: any = {
        ...(memberToEdit || {}),
        id: memberToEdit?.id || crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        isActive: finalIsActive,
        isSearchable: memberToEdit?.isSearchable ?? true,
        locationId: locationId,
        creationDate: memberToEdit?.creationDate || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };
    
    let finalMembershipId: string | undefined;

    if (isAdmin) {
        finalMembershipId = membershipId;
    } else {
        if (!memberToEdit) {
            finalMembershipId = membershipId;
        } else {
            finalMembershipId = memberToEdit.membershipId;
        }
    }
    
    memberData.membershipId = finalMembershipId || '';
    memberData.startDate = startDate || '';
    memberData.endDate = isAdmin ? (endDate || '') : (memberToEdit?.endDate || '');

    const selectedMembership = memberships.find(m => m.id === finalMembershipId);
    
    if (selectedMembership?.type === 'clip_card') {
        const clipCardStatus = {
            remainingClips: remainingClips.trim() ? parseInt(remainingClips, 10) : (selectedMembership.clipCardClips || 0),
        };
        if (clipCardExpiryDate.trim()) {
            (clipCardStatus as any).expiryDate = clipCardExpiryDate.trim();
        }
        memberData.clipCardStatus = clipCardStatus;
    } else {
        delete memberData.clipCardStatus;
    }
    
    try {
        // --- Robust Staff & User Synchronization ---
        if (isAdmin && memberToEdit && organizationId) {
            const existingStaff = staffMembers.find(s => s.linkedParticipantProfileId === memberToEdit.id || s.email?.toLowerCase() === memberToEdit.email?.toLowerCase());
            const targetUser = memberToEdit.email ? allUsers.find(u => u.email.toLowerCase() === memberToEdit.email!.toLowerCase()) : null;
            const editedParticipantId = memberData.id;

            if (isStaff && !targetUser) {
                setFormError(`Kunde inte hitta ett matchande användarkonto för e-postadressen ${memberToEdit.email}. Personalstatus kan inte uppdateras eftersom användarens systemroller måste ändras. Detta beror troligen på ett behörighetsproblem. Kontakta systemägaren.`);
                setIsSaving(false);
                return;
            }

            if (isStaff) {
                // Sync User document first, if it exists
                if (targetUser) {
                    const updatesForUser: Partial<Omit<User, 'id'>> = {};
                    const currentRoles = targetUser.roles || {};
                    const currentOrgAdmins = currentRoles.orgAdmin || [];
                    const hasAdminRole = currentOrgAdmins.includes(organizationId);
                    const shouldBeAdmin = staffRole === 'Admin';
                    
                    // Sync orgAdmin role
                    if (shouldBeAdmin && !hasAdminRole) {
                        updatesForUser.roles = { ...currentRoles, orgAdmin: [...currentOrgAdmins, organizationId] };
                    } else if (!shouldBeAdmin && hasAdminRole) {
                        updatesForUser.roles = { ...currentRoles, orgAdmin: currentOrgAdmins.filter(id => id !== organizationId) };
                    }

                    // Sync linkedParticipantProfileId on User doc
                    if (targetUser.linkedParticipantProfileId !== editedParticipantId) {
                        updatesForUser.linkedParticipantProfileId = editedParticipantId;
                    }

                    // Sync name on User doc
                    if (targetUser.name !== memberData.name) {
                        updatesForUser.name = memberData.name;
                    }
                    
                    // Apply updates if there are any
                    if (Object.keys(updatesForUser).length > 0) {
                        await updateUser(targetUser.id, updatesForUser);
                    }
                }

                // Now sync StaffMember document
                if (existingStaff) {
                    const updatedStaff = { 
                        ...existingStaff, 
                        role: staffRole, 
                        name: memberData.name, 
                        locationId: memberData.locationId,
                        email: memberData.email,
                        linkedParticipantProfileId: editedParticipantId,
                        isActive: true
                    };
                    setStaffMembersData(prev => prev.map(s => s.id === existingStaff.id ? updatedStaff : s));
                } else {
                    const newStaff: StaffMember = {
                        id: crypto.randomUUID(),
                        name: memberData.name,
                        email: memberData.email,
                        role: staffRole,
                        locationId: memberData.locationId,
                        isActive: true,
                        linkedParticipantProfileId: editedParticipantId,
                        startDate: new Date().toISOString().split('T')[0],
                    };
                    setStaffMembersData(prev => [...prev, newStaff]);
                }
            } else { // isStaff is unchecked, so we're demoting/removing them
                if (existingStaff) {
                    setStaffMembersData(prev => prev.filter(s => s.id !== existingStaff.id));
                }
                if (targetUser) {
                    const currentRoles = targetUser.roles || {};
                    const currentOrgAdmins = currentRoles.orgAdmin || [];
                    const hasAdminRole = currentOrgAdmins.includes(organizationId);
                    if (hasAdminRole) {
                        const newRoles = {
                            ...currentRoles,
                            orgAdmin: currentOrgAdmins.filter(id => id !== organizationId)
                        };
                        await updateUser(targetUser.id, { roles: newRoles });
                    }
                }
            }
        }
        // --- End of Sync Logic ---
        
        await onSaveMember(memberData);

        setHasSaved(true);
        setTimeout(() => {
            onClose();
        }, 800);
    } catch (e) {
        setFormError('Kunde inte spara medlemmen. Detta beror troligen på ett behörighetsproblem i databasen. Kontrollera Firebase-reglerna.');
        setIsSaving(false);
    }
  };

  const locationOptions = locations.map(loc => ({ value: loc.id, label: loc.name }));
  const membershipOptions = memberships.map(mem => ({ value: mem.id, label: mem.name }));
  const modalTitle = memberToEdit ? "Redigera Medlem" : "Lägg till Ny Medlem";
  
  const selectedMembership = memberships.find(m => m.id === membershipId);
  const isClipCardMembership = selectedMembership?.type === 'clip_card';

  let saveButtonText = memberToEdit ? "Spara Ändringar" : "Spara";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        {formError && <p className="text-center bg-red-100 text-red-700 p-3 rounded-lg">{formError}</p>}
        <Input
          label="Namn *"
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={formErrors.name}
          required
        />
        <Input
          label="E-post *"
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={formErrors.email}
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
          error={formErrors.locationId}
          required
          disabled={!isAdmin && !!memberToEdit}
          className={!isAdmin && !!memberToEdit ? 'bg-gray-100 cursor-not-allowed' : ''}
        />

        {isAdmin && (
            <Select
            label="Medlemskap *"
            id="member-membership"
            value={membershipId}
            onChange={(e) => handleMembershipChange(e.target.value)}
            options={[{ value: '', label: 'Välj medlemskap...' }, ...membershipOptions]}
            error={formErrors.membershipId}
            required
            />
        )}
        
        {isAdmin && isClipCardMembership && (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-blue-50/50 animate-fade-in-down">
                <Input
                    label="Antal Klipp Kvar"
                    id="member-clips"
                    type="number"
                    value={remainingClips}
                    onChange={(e) => setRemainingClips(e.target.value)}
                    error={formErrors.remainingClips}
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

        <div>
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
        </div>
        
        {isAdmin && memberToEdit && (
            <div className="pt-4 mt-4 border-t space-y-3">
                <h3 className="text-lg font-semibold text-gray-700">Personalstatus</h3>
                <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isStaff}
                        onChange={(e) => setIsStaff(e.target.checked)}
                        className="h-6 w-6 mt-1 text-flexibel"
                    />
                    <div>
                        <span className="text-lg font-medium text-gray-700">Gör denna medlem till Personal</span>
                    </div>
                </label>
                {isStaff && (
                    <div className="pl-4 animate-fade-in-down">
                        <Select 
                            label="Roll"
                            value={staffRole}
                            onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                            options={STAFF_ROLE_OPTIONS}
                        />
                    </div>
                )}
                <p className="text-xs text-gray-500 italic px-2">
                    När du gör en medlem till personal får de automatiskt behörighet att se coach-vyn. 'Admin'-rollen ger full behörighet.
                </p>
            </div>
        )}


        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
          <Button onClick={handleSave} variant="primary" disabled={!isFormValidForSaving || isSaving}>
            {saveButtonText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};