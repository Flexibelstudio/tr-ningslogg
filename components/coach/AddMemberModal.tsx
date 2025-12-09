
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { ParticipantProfile, Location, Membership, StaffMember, StaffRole, User } from '../../types';
import { addDays } from '../../utils/dateUtils';
import { useAppContext } from '../../context/AppContext';
import { STAFF_ROLE_OPTIONS } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationModal } from '../ConfirmationModal';

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

const getInitialFormState = (memberToEdit: ParticipantProfile | null, isAdmin: boolean, loggedInStaff: StaffMember | null, memberships: Membership[], staffMembers: StaffMember[]) => {
    const initialLocation = isAdmin ? '' : (loggedInStaff?.locationId || '');
    const existingStaff = memberToEdit ? staffMembers.find(s => s.linkedParticipantProfileId === memberToEdit.id || s.email?.toLowerCase() === memberToEdit.email?.toLowerCase()) : null;

    return {
        name: memberToEdit?.name || '',
        email: memberToEdit?.email || '',
        locationId: memberToEdit?.locationId || initialLocation,
        membershipId: memberToEdit?.membershipId || memberships[0]?.id || '',
        startDate: memberToEdit?.startDate || '',
        endDate: memberToEdit?.endDate || '',
        bindingEndDate: memberToEdit?.bindingEndDate || '',
        remainingClips: memberToEdit?.clipCardStatus?.remainingClips?.toString() || '',
        clipCardExpiryDate: memberToEdit?.clipCardStatus?.expiryDate || '',
        isStaff: !!existingStaff,
        staffRole: existingStaff?.role || 'Coach' as StaffRole,
    };
};

export const AddMemberModal: React.FC<AddEditMemberModalProps> = ({ isOpen, onClose, onSaveMember, memberToEdit, existingEmails, locations, memberships, loggedInStaff }) => {
  const { staffMembers, setStaffMembersData, allUsers, updateUser } = useAppContext();
  const { organizationId } = useAuth();
  
  const [formState, setFormState] = useState(getInitialFormState(memberToEdit, false, null, [], []));
  const [initialFormState, setInitialFormState] = useState(getInitialFormState(memberToEdit, false, null, [], []));
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isAdmin = loggedInStaff?.role === 'Admin';

  useEffect(() => {
    if (isOpen) {
      const initialState = getInitialFormState(memberToEdit, isAdmin, loggedInStaff, memberships, staffMembers);
      setFormState(initialState);
      setInitialFormState(initialState);
      setFormError(null);
      setIsSaving(false);
      setHasSaved(false);
    }
  }, [isOpen, memberToEdit, memberships, isAdmin, loggedInStaff, staffMembers]);
  
  const handleInputChange = (field: keyof typeof formState, value: string | boolean) => {
    setFormState(prev => ({...prev, [field]: value}));
  };

  const formErrors = useMemo(() => {
    const newErrors: { name?: string, email?: string, locationId?: string, membershipId?: string, remainingClips?: string } = {};
    const trimmedEmail = formState.email.trim().toLowerCase();

    if (!formState.name.trim()) {
      newErrors.name = "Namn är obligatoriskt.";
    }
    if (!trimmedEmail) {
      newErrors.email = "E-post är obligatoriskt.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Ogiltig e-postadress.";
    } else if (existingEmails.includes(trimmedEmail) && trimmedEmail !== memberToEdit?.email?.toLowerCase()) {
      newErrors.email = "Denna e-postadress är redan registrerad.";
    }
    if (!formState.locationId) {
        newErrors.locationId = "Ort är obligatoriskt.";
    }

    if (isAdmin) {
        if (!formState.membershipId) {
            newErrors.membershipId = "Medlemskap är obligatoriskt.";
        } else {
            const selectedMembership = memberships.find(m => m.id === formState.membershipId);
            if (selectedMembership?.type === 'clip_card') {
                const clips = formState.remainingClips.trim();
                if (clips !== '' && (isNaN(Number(clips)) || Number(clips) < 0 || !Number.isInteger(Number(clips)))) {
                    newErrors.remainingClips = "Ange ett giltigt, positivt heltal för antal klipp.";
                }
            }
        }
    }
    return newErrors;
  }, [formState, existingEmails, memberToEdit, isAdmin, memberships]);

  const hasChanges = useMemo(() => JSON.stringify(formState) !== JSON.stringify(initialFormState), [formState, initialFormState]);
  const isFormValidForSaving = Object.keys(formErrors).length === 0;

  const handleMembershipChange = (newMembershipId: string) => {
    const selectedMembership = memberships.find(m => m.id === newMembershipId);
    setFormState(prev => {
        const newState = {...prev, membershipId: newMembershipId};
        if (selectedMembership && selectedMembership.type === 'clip_card') {
          newState.remainingClips = String(selectedMembership.clipCardClips || '');
          let newExpiryDate = '';
          if (selectedMembership.clipCardValidityDays) {
              const effectiveStartDate = new Date(newState.startDate || new Date().toISOString().split('T')[0]);
              const expiry = addDays(effectiveStartDate, selectedMembership.clipCardValidityDays);
              newExpiryDate = expiry.toISOString().split('T')[0];
          }
          newState.clipCardExpiryDate = newExpiryDate;
        } else {
          newState.remainingClips = '';
          newState.clipCardExpiryDate = '';
        }
        return newState;
    });
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
        name: formState.name.trim(),
        email: formState.email.trim().toLowerCase(),
        isActive: finalIsActive,
        isSearchable: memberToEdit?.isSearchable ?? true,
        locationId: formState.locationId,
        creationDate: memberToEdit?.creationDate || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        bindingEndDate: formState.bindingEndDate || undefined,
    };
    
    let finalMembershipId: string | undefined;

    if (isAdmin) {
        finalMembershipId = formState.membershipId;
    } else {
        if (!memberToEdit) {
            finalMembershipId = formState.membershipId;
        } else {
            finalMembershipId = memberToEdit.membershipId;
        }
    }
    
    memberData.membershipId = finalMembershipId || '';
    memberData.startDate = formState.startDate || '';
    memberData.endDate = isAdmin ? (formState.endDate || '') : (memberToEdit?.endDate || '');

    const selectedMembership = memberships.find(m => m.id === finalMembershipId);
    
    if (selectedMembership?.type === 'clip_card') {
        const clipCardStatus = {
            remainingClips: formState.remainingClips.trim() ? parseInt(formState.remainingClips, 10) : (selectedMembership.clipCardClips || 0),
        };
        if (formState.clipCardExpiryDate.trim()) {
            (clipCardStatus as any).expiryDate = formState.clipCardExpiryDate.trim();
        }
        memberData.clipCardStatus = clipCardStatus;
    } else {
        delete memberData.clipCardStatus;
    }
    
    try {
        if (isAdmin && memberToEdit && organizationId) {
            const existingStaff = staffMembers.find(s => s.linkedParticipantProfileId === memberToEdit.id || s.email?.toLowerCase() === memberToEdit.email?.toLowerCase());
            const targetUser = memberToEdit.email ? allUsers.find(u => u.email.toLowerCase() === memberToEdit.email!.toLowerCase()) : null;
            const editedParticipantId = memberData.id;

            if (formState.isStaff && !targetUser) {
                setFormError(`Kunde inte hitta ett matchande användarkonto för e-postadressen ${memberToEdit.email}. Personalstatus kan inte uppdateras eftersom användarens systemroller måste ändras. Detta beror troligen på ett behörighetsproblem. Kontakta systemägaren.`);
                setIsSaving(false);
                return;
            }

            if (formState.isStaff) {
                if (targetUser) {
                    const updatesForUser: Partial<Omit<User, 'id'>> = {};
                    const currentRoles = targetUser.roles || {};
                    const currentOrgAdmins = currentRoles.orgAdmin || [];
                    const hasAdminRole = currentOrgAdmins.includes(organizationId);
                    const shouldBeAdmin = formState.staffRole === 'Admin';
                    
                    if (shouldBeAdmin && !hasAdminRole) {
                        updatesForUser.roles = { ...currentRoles, orgAdmin: [...currentOrgAdmins, organizationId] };
                    } else if (!shouldBeAdmin && hasAdminRole) {
                        updatesForUser.roles = { ...currentRoles, orgAdmin: currentOrgAdmins.filter(id => id !== organizationId) };
                    }

                    if (targetUser.linkedParticipantProfileId !== editedParticipantId) updatesForUser.linkedParticipantProfileId = editedParticipantId;
                    if (targetUser.name !== memberData.name) updatesForUser.name = memberData.name;
                    
                    if (Object.keys(updatesForUser).length > 0) await updateUser(targetUser.id, updatesForUser);
                }

                if (existingStaff) {
                    const updatedStaff = { 
                        ...existingStaff, 
                        role: formState.staffRole, 
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
                        role: formState.staffRole,
                        locationId: memberData.locationId,
                        isActive: true,
                        linkedParticipantProfileId: editedParticipantId,
                        startDate: new Date().toISOString().split('T')[0],
                    };
                    setStaffMembersData(prev => [...prev, newStaff]);
                }
            } else { 
                if (existingStaff) {
                    setStaffMembersData(prev => prev.filter(s => s.id !== existingStaff.id));
                }
                if (targetUser) {
                    const currentRoles = targetUser.roles || {};
                    const currentOrgAdmins = currentRoles.orgAdmin || [];
                    if (currentOrgAdmins.includes(organizationId)) {
                        const newRoles = { ...currentRoles, orgAdmin: currentOrgAdmins.filter(id => id !== organizationId) };
                        await updateUser(targetUser.id, { roles: newRoles });
                    }
                }
            }
        }
        
        await onSaveMember(memberData);
        setHasSaved(true);
        setTimeout(() => onClose(), 800);
    } catch (e) {
        setFormError('Kunde inte spara medlemmen. Detta beror troligen på ett behörighetsproblem i databasen. Kontrollera Firebase-reglerna.');
        setIsSaving(false);
    }
  };
  
  const handleCloseRequest = () => {
    if (hasChanges && !hasSaved) {
        setShowCancelConfirm(true);
    } else {
        onClose();
    }
  };

  const locationOptions = locations.map(loc => ({ value: loc.id, label: loc.name }));
  const membershipOptions = memberships.map(mem => ({ value: mem.id, label: mem.name }));
  const modalTitle = memberToEdit ? "Redigera Medlem" : "Lägg till Ny Medlem";

  const selectedMembership = memberships.find(m => m.id === formState.membershipId);
  const isClipCardMembership = selectedMembership?.type === 'clip_card';

  let saveButtonText = memberToEdit ? "Spara Ändringar" : "Spara";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleCloseRequest} title={modalTitle}>
        <div className="space-y-4">
          {formError && <p className="text-center bg-red-100 text-red-700 p-3 rounded-lg">{formError}</p>}
          <Input
            label="Namn *"
            id="member-name"
            value={formState.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={formErrors.name}
            required
          />
          <Input
            label="E-post *"
            id="member-email"
            type="email"
            value={formState.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={formErrors.email}
            required
            readOnly={!isAdmin && !!memberToEdit}
            className={!isAdmin && !!memberToEdit ? 'bg-gray-100 cursor-not-allowed' : ''}
          />
          <Select
            label="Ort *"
            id="member-location"
            value={formState.locationId}
            onChange={(e) => handleInputChange('locationId', e.target.value)}
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
              value={formState.membershipId}
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
                      value={formState.remainingClips}
                      onChange={(e) => handleInputChange('remainingClips', e.target.value)}
                      error={formErrors.remainingClips}
                      min="0"
                      step="1"
                      placeholder="Standard från medlemskap"
                  />
                  <Input
                      label="Klippkort Giltigt Till"
                      id="member-clipcard-expiry"
                      type="date"
                      value={formState.clipCardExpiryDate}
                      onChange={(e) => handleInputChange('clipCardExpiryDate', e.target.value)}
                  />
              </div>
          )}

          <div>
              <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  <Input
                      label="Startdatum"
                      id="member-start-date"
                      type="date"
                      value={formState.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                  {isAdmin && (
                      <Input
                          label="Slutdatum (Access)"
                          id="member-end-date"
                          type="date"
                          value={formState.endDate}
                          onChange={(e) => handleInputChange('endDate', e.target.value)}
                          placeholder="Lämnas tom för tillsvidare"
                      />
                  )}
              </div>
              {isAdmin && !isClipCardMembership && (
                  <div className="mt-4">
                       <Input
                          label="Bunden t.o.m."
                          id="member-binding-end-date"
                          type="date"
                          value={formState.bindingEndDate}
                          onChange={(e) => handleInputChange('bindingEndDate', e.target.value)}
                          placeholder="Datum då bindningstiden går ut"
                      />
                      <p className="text-xs text-gray-500 mt-1 ml-1">Används för uppföljning av bindningstid. Påverkar inte inloggning.</p>
                  </div>
              )}
          </div>
          
          {isAdmin && memberToEdit && (
              <div className="pt-4 mt-4 border-t space-y-3">
                  <h3 className="text-lg font-semibold text-gray-700">Personalstatus</h3>
                  <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
                      <input
                          type="checkbox"
                          checked={formState.isStaff}
                          onChange={(e) => handleInputChange('isStaff', e.target.checked)}
                          className="h-6 w-6 mt-1 text-flexibel"
                      />
                      <div>
                          <span className="text-lg font-medium text-gray-700">Gör denna medlem till Personal</span>
                      </div>
                  </label>
                  {formState.isStaff && (
                      <div className="pl-4 animate-fade-in-down">
                          <Select 
                              label="Roll"
                              value={formState.staffRole}
                              onChange={(e) => handleInputChange('staffRole', e.target.value)}
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
            <Button onClick={handleCloseRequest} variant="secondary" disabled={isSaving}>Avbryt</Button>
            <Button onClick={handleSave} variant="primary" disabled={!isFormValidForSaving || !hasChanges || isSaving}>
              {saveButtonText}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmationModal
          isOpen={showCancelConfirm}
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={onClose}
          title="Avbryta ändringar?"
          message="Du har osparade ändringar. Är du säker på att du vill stänga? Dina ändringar kommer inte att sparas."
          confirmButtonText="Ja, stäng"
          cancelButtonText="Nej, fortsätt redigera"
      />
    </>
  );
};
