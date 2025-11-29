
import React, { useState } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, OneOnOneSession, StaffMember, Membership } from '../../types';
import { Button } from '../Button';
import { AddMemberModal } from './AddMemberModal';
import { Input, Select } from '../Input';
import { BulkUpdateModal, BulkActionType } from './BulkUpdateModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { MemberNotesModal } from './MemberNotesModal';
import { useAppContext } from '../../context/AppContext';
import { Modal } from '../Modal';
import { addDays, calculateAge } from '../../utils/dateUtils';
import { useMembers } from '../../features/coach/hooks/useMembers';

interface ApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    participant: ParticipantProfile;
    onConfirm: (updates: Partial<ParticipantProfile>) => Promise<void>;
    memberships: Membership[];
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, participant, onConfirm, memberships }) => {
    // ... (ApprovalModal implementation remains unchanged, keeping it here for brevity)
    const [isInStartProgram, setIsInStartProgram] = useState(true);
    const [membershipId, setMembershipId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [remainingClips, setRemainingClips] = useState('');
    const [clipCardExpiryDate, setClipCardExpiryDate] = useState('');
    const [errors, setErrors] = useState<{ membershipId?: string, remainingClips?: string }>({});

    React.useEffect(() => {
        if (isOpen) {
            setIsInStartProgram(true);
            setMembershipId(memberships.find(m => m.type === 'subscription')?.id || memberships[0]?.id || '');
            setStartDate(new Date().toISOString().split('T')[0]);
            setRemainingClips('');
            setClipCardExpiryDate('');
            setErrors({});
        }
    }, [isOpen, memberships]);

    const selectedMembership = React.useMemo(() => memberships.find(m => m.id === membershipId), [membershipId, memberships]);

    React.useEffect(() => {
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
    }, [selectedMembership, startDate]);

    const handleConfirm = async () => {
        const newErrors: { membershipId?: string, remainingClips?: string } = {};
        if (!isInStartProgram && !membershipId) {
            newErrors.membershipId = "Du måste välja ett medlemskap.";
        }
        if (!isInStartProgram && selectedMembership?.type === 'clip_card') {
             if (remainingClips.trim() !== '' && (isNaN(Number(remainingClips)) || Number(remainingClips) < 0 || !Number.isInteger(Number(remainingClips)))) {
                newErrors.remainingClips = "Ange ett giltigt, positivt heltal för antal klipp.";
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) {
            return;
        }

        let updates: Partial<ParticipantProfile> = {
            approvalStatus: 'approved',
            isActive: true,
        };

        if (isInStartProgram) {
            const startProgramMembership = memberships.find(m => m.name.toLowerCase() === 'startprogram');
            updates.membershipId = startProgramMembership?.id;
        } else {
            updates.membershipId = membershipId;
            updates.startDate = startDate;
            if (selectedMembership?.type === 'clip_card') {
                const clipCardStatus = {
                    remainingClips: remainingClips.trim() ? parseInt(remainingClips, 10) : (selectedMembership.clipCardClips || 0),
                };
                if (clipCardExpiryDate.trim()) {
                    (clipCardStatus as any).expiryDate = clipCardExpiryDate.trim();
                }
                updates.clipCardStatus = clipCardStatus;
            }
        }
        await onConfirm(updates);
    };

    const membershipOptions = memberships.map(mem => ({ value: mem.id, label: mem.name }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Godkänn ${participant.name}`}>
            <div className="space-y-4">
                <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer active:bg-gray-200 transition-colors">
                    <input
                        type="radio"
                        name="approval-type"
                        checked={isInStartProgram}
                        onChange={() => setIsInStartProgram(true)}
                        className="h-6 w-6 mt-1 text-flexibel border-gray-300 focus:ring-flexibel"
                    />
                    <div>
                        <span className="text-lg font-medium text-gray-700">Placera i Startprogram</span>
                        <p className="text-sm text-gray-500">
                            Medlemmen tilldelas 'Startprogram'-medlemskapet.
                        </p>
                    </div>
                </label>
                 <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer active:bg-gray-200 transition-colors">
                    <input
                        type="radio"
                        name="approval-type"
                        checked={!isInStartProgram}
                        onChange={() => setIsInStartProgram(false)}
                        className="h-6 w-6 mt-1 text-flexibel border-gray-300 focus:ring-flexibel"
                    />
                    <div>
                        <span className="text-lg font-medium text-gray-700">Tilldela annat medlemskap direkt</span>
                    </div>
                </label>
                
                {!isInStartProgram && (
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50 animate-fade-in-down">
                        <h4 className="font-semibold text-lg text-gray-700">Tilldela Medlemskap</h4>
                        <Select
                            label="Medlemskap *"
                            value={membershipId}
                            onChange={(e) => setMembershipId(e.target.value)}
                            options={[{ value: '', label: 'Välj medlemskap...' }, ...membershipOptions]}
                            error={errors.membershipId}
                        />
                         <Input
                            label="Startdatum"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        {selectedMembership?.type === 'clip_card' && (
                             <div className="grid grid-cols-2 gap-4 p-2 border rounded-md bg-blue-50/50">
                                <Input
                                    label="Antal Klipp"
                                    type="number"
                                    value={remainingClips}
                                    onChange={(e) => setRemainingClips(e.target.value)}
                                    error={errors.remainingClips}
                                    min="0"
                                    step="1"
                                    placeholder="Standard från medlemskap"
                                />
                                <Input
                                    label="Giltigt Till"
                                    type="date"
                                    value={clipCardExpiryDate}
                                    onChange={(e) => setClipCardExpiryDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Avbryt</Button>
                    <Button onClick={handleConfirm}>Godkänn & Spara</Button>
                </div>
            </div>
        </Modal>
    );
};


interface MemberManagementProps {
  participants: ParticipantProfile[];
  allParticipantGoals: ParticipantGoalData[];
  allActivityLogs: ActivityLog[];
  coachNotes: CoachNote[];
  oneOnOneSessions: OneOnOneSession[];
  loggedInStaff: StaffMember | null;
  isOnline: boolean;
}

type SortableKeys = 'name' | 'typeForDisplay' | 'locationName' | 'age' | 'gender';

export const MemberManagement: React.FC<MemberManagementProps> = ({
  participants: _participants, // Not used directly, using hook instead
  allParticipantGoals,
  allActivityLogs,
  coachNotes,
  oneOnOneSessions,
  loggedInStaff,
  isOnline,
}) => {
    const { 
        setParticipantGoalsData,
        setGoalCompletionLogsData,
        setCoachNotesData,
        setOneOnOneSessionsData,
        workouts,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        workoutCategories,
        staffAvailability,
        staffMembers, // Used for Notes Modal
    } = useAppContext();

    // Use the custom hook
    const {
        participants,
        locations,
        memberships,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        locationFilter,
        setLocationFilter,
        sortConfig,
        requestSort,
        selectedMembers,
        handleSelectAll,
        handleSelectOne,
        filteredAndSortedParticipants,
        pendingParticipants,
        handleSaveMember,
        handleConfirmBulkUpdate,
        handleConfirmDelete,
        handleConfirmDecline,
        handleConfirmApprove,
        isAdmin
    } = useMembers(loggedInStaff);

    // UI State handled by component
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<ParticipantProfile | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<ParticipantProfile | null>(null);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedParticipantForNotes, setSelectedParticipantForNotes] = useState<ParticipantProfile | null>(null);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
    const [participantToDecline, setParticipantToDecline] = useState<ParticipantProfile | null>(null);
    const [approvingParticipant, setApprovingParticipant] = useState<ParticipantProfile | null>(null);

    const handleOpenNotesModal = (participant: ParticipantProfile) => {
        setSelectedParticipantForNotes(participant);
        setIsNotesModalOpen(true);
    };

    const handleBulkActionClick = (action: BulkActionType) => {
        setBulkAction(action);
        setIsBulkUpdateModalOpen(true);
    };

    const getTypeDisplay = (p: any) => {
        let className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ';
        const text = p.typeForDisplay;

        if (p.typeForDisplay === 'Startprogram') {
            className += 'bg-blue-100 text-blue-800';
        } else if (!p.isActive) {
            className += 'bg-red-100 text-red-800'; // Inaktiv
        } else if (p.isActive && !p.membershipId) {
            className += 'bg-orange-100 text-orange-800'; // Aktiv (saknar medlemskap)
        } else {
            className += 'bg-green-100 text-green-800'; // Medlemskap
        }
        
        return <span className={className}>{text}</span>;
    };
    
    const SortableTh: React.FC<{ sortKey: SortableKeys, children: React.ReactNode }> = ({ sortKey, children }) => {
        const isSorted = sortConfig?.key === sortKey;
        return (
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button onClick={() => requestSort(sortKey)} className="group inline-flex items-center">
                    {children}
                    <span className={`ml-2 flex-none rounded ${isSorted ? 'bg-gray-200 text-gray-900' : 'text-gray-400 invisible group-hover:visible'}`}>
                        {isSorted && sortConfig?.direction === 'asc' ? '▲' : '▼'}
                    </span>
                </button>
            </th>
        );
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
            <h2 className="text-3xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
                Medlemsregister
            </h2>
        </div>
        
        {isAdmin && pendingParticipants.length > 0 && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-300 space-y-4 mb-6 animate-fade-in-down">
              <h3 className="text-xl font-bold text-gray-800">Väntar på Godkännande ({pendingParticipants.length})</h3>
              <div className="space-y-2">
                  {pendingParticipants.map(p => {
                      const location = locations.find(l => l.id === p.locationId);
                      return (
                      <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-white rounded-md shadow-sm">
                          <div>
                              <p className="font-bold text-lg text-gray-900">{p.name || '(Namn saknas)'}</p>
                              <p className="text-sm text-gray-600">{p.email}</p>
                              {location && <p className="text-sm text-gray-500">Studio: <span className="font-medium">{location.name}</span></p>}
                              <p className="text-xs text-gray-400 mt-1">Registrerad: {new Date(p.creationDate || '').toLocaleDateString('sv-SE')}</p>
                          </div>
                          <div className="flex gap-2 mt-2 sm:mt-0 flex-shrink-0">
                              <Button size="sm" variant="primary" onClick={() => setApprovingParticipant(p)}>Godkänn</Button>
                              <Button size="sm" variant="danger" onClick={() => setParticipantToDecline(p)}>Neka</Button>
                          </div>
                      </div>
                  )})}
              </div>
          </div>
        )}
        
        <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
            <div className="flex flex-wrap items-end gap-4">
                <Input 
                    label="Sök"
                    placeholder="Sök på namn eller e-post..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    containerClassName="flex-grow min-w-[250px]"
                />
                <Select
                    label="Status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'prospect')}
                    options={[
                        { value: 'all', label: 'Alla' },
                        { value: 'active', label: 'Aktiva' },
                        { value: 'inactive', label: 'Inaktiva' },
                        { value: 'prospect', label: 'Startprogram' },
                    ]}
                    containerClassName="w-full sm:w-auto"
                />
                {isAdmin && (
                    <Select
                        label="Ort"
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        options={[{ value: 'all', label: 'Alla Orter' }, ...locations.map(l => ({ value: l.id, label: l.name }))]}
                        containerClassName="w-full sm:w-auto"
                    />
                )}
            </div>
            {selectedMembers.size > 0 && (
                <div className="pt-4 border-t flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{selectedMembers.size} markerade</span>
                    <Button size="sm" variant="outline" onClick={() => handleBulkActionClick('membership')}>Ändra Medlemskap</Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkActionClick('location')}>Ändra Ort</Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkActionClick('status')}>Ändra Status</Button>
                </div>
            )}
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow border">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="p-4"><input type="checkbox" onChange={(e) => handleSelectAll(e.target.checked)} checked={selectedMembers.size > 0 && selectedMembers.size === filteredAndSortedParticipants.length && filteredAndSortedParticipants.length > 0} /></th>
                        <SortableTh sortKey="name">Namn</SortableTh>
                        <SortableTh sortKey="typeForDisplay">Typ</SortableTh>
                        <SortableTh sortKey="locationName">Ort</SortableTh>
                        <SortableTh sortKey="age">Ålder</SortableTh>
                        <SortableTh sortKey="gender">Kön</SortableTh>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedParticipants.map(p => (
                        <tr key={p.id}>
                            <td className="p-4"><input type="checkbox" checked={selectedMembers.has(p.id)} onChange={() => handleSelectOne(p.id)} /></td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.email}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">{getTypeDisplay(p)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.locationName}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{calculateAge(p.birthDate) ?? p.age ?? '-'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.gender || '-'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleOpenNotesModal(p)}>Klientkort</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingMember(p); setIsAddMemberModalOpen(true); }}>Redigera</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredAndSortedParticipants.length === 0 && <p className="text-center text-gray-500 p-4">Inga medlemmar matchade din sökning/filter.</p>}
        </div>

        <AddMemberModal
            isOpen={isAddMemberModalOpen}
            onClose={() => setIsAddMemberModalOpen(false)}
            onSaveMember={async (data) => await handleSaveMember(data, !!editingMember)}
            memberToEdit={editingMember}
            existingEmails={participants.map(p => p.email?.toLowerCase() || '')}
            locations={locations}
            memberships={memberships}
            loggedInStaff={loggedInStaff}
        />
        
        {selectedParticipantForNotes && loggedInStaff && (
            <MemberNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                participant={selectedParticipantForNotes}
                notes={coachNotes.filter(n => n.participantId === selectedParticipantForNotes.id)}
                allParticipantGoals={allParticipantGoals}
                setParticipantGoals={setParticipantGoalsData}
                allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipantForNotes.id)}
                setGoalCompletionLogs={setGoalCompletionLogsData}
                onAddNote={(noteText) => setCoachNotesData(prev => [...prev, { id: crypto.randomUUID(), participantId: selectedParticipantForNotes.id, noteText, createdDate: new Date().toISOString(), noteType: 'check-in' }])}
                onUpdateNote={(noteId, newText) => {
                    setCoachNotesData(prev => prev.map(note => 
                        note.id === noteId 
                        ? { ...note, noteText: newText, createdDate: new Date().toISOString() } 
                        : note
                    ));
                }}
                onDeleteNote={(noteId) => {
                    setCoachNotesData(prev => prev.filter(note => note.id !== noteId));
                }}
                oneOnOneSessions={oneOnOneSessions}
                setOneOnOneSessions={setOneOnOneSessionsData}
                coaches={staffMembers}
                loggedInCoachId={loggedInStaff!.id}
                workouts={workouts}
                addWorkout={addWorkout}
                updateWorkout={updateWorkout}
                deleteWorkout={deleteWorkout}
                workoutCategories={workoutCategories}
                participants={participants}
                staffAvailability={staffAvailability}
                isOnline={isOnline}
            />
        )}
        
        {bulkAction && (
            <BulkUpdateModal
                isOpen={isBulkUpdateModalOpen}
                onClose={() => setIsBulkUpdateModalOpen(false)}
                onConfirm={(value) => {
                    handleConfirmBulkUpdate(bulkAction, value);
                    setIsBulkUpdateModalOpen(false);
                }}
                action={bulkAction}
                memberCount={selectedMembers.size}
                locations={locations}
                memberships={memberships}
            />
        )}

        <ConfirmationModal
            isOpen={!!memberToDelete}
            onClose={() => setMemberToDelete(null)}
            onConfirm={() => {
                if(memberToDelete) handleConfirmDelete(memberToDelete.id);
                setMemberToDelete(null);
            }}
            title="Inaktivera Medlem"
            message={`Är du säker på att du vill inaktivera ${memberToDelete?.name}? Detta kommer att markera dem som inaktiva istället för att ta bort dem permanent.`}
            confirmButtonText="Ja, inaktivera"
        />
         <ConfirmationModal
            isOpen={!!participantToDecline}
            onClose={() => setParticipantToDecline(null)}
            onConfirm={() => {
                if(participantToDecline) handleConfirmDecline(participantToDecline.id);
                setParticipantToDecline(null);
            }}
            title="Neka Medlem?"
            message={`Är du säker på att du vill neka ${participantToDecline?.name}? Medlemmen kommer att markeras som inaktiv och kommer inte kunna logga in.`}
            confirmButtonText="Ja, Neka"
            confirmButtonVariant="danger"
        />
        {approvingParticipant && (
            <ApprovalModal
                isOpen={!!approvingParticipant}
                onClose={() => setApprovingParticipant(null)}
                participant={approvingParticipant}
                onConfirm={async (updates) => {
                    await handleConfirmApprove(approvingParticipant.id, updates);
                    setApprovingParticipant(null);
                }}
                memberships={memberships}
            />
        )}
      </div>
    );
};
