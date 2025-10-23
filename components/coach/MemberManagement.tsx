import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, WorkoutLog, Location, Membership, StaffMember, OneOnOneSession, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { Button } from '../Button';
import { AddMemberModal } from './AddMemberModal';
import * as dateUtils from '../../utils/dateUtils';
import { Input, Select } from '../Input';
import { BulkUpdateModal, BulkActionType } from './BulkUpdateModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { MemberNotesModal } from './MemberNotesModal';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { addDays } from '../../utils/dateUtils';


interface ApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    participant: ParticipantProfile;
    onConfirm: (updates: Partial<ParticipantProfile>) => Promise<void>;
    memberships: Membership[];
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, participant, onConfirm, memberships }) => {
    const [isInStartProgram, setIsInStartProgram] = useState(true);
    const [membershipId, setMembershipId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [remainingClips, setRemainingClips] = useState('');
    const [clipCardExpiryDate, setClipCardExpiryDate] = useState('');
    const [errors, setErrors] = useState<{ membershipId?: string, remainingClips?: string }>({});

    useEffect(() => {
        if (isOpen) {
            setIsInStartProgram(true);
            setMembershipId(memberships.find(m => m.type === 'subscription')?.id || memberships[0]?.id || '');
            setStartDate(new Date().toISOString().split('T')[0]);
            setRemainingClips('');
            setClipCardExpiryDate('');
            setErrors({});
        }
    }, [isOpen, memberships]);

    const selectedMembership = useMemo(() => memberships.find(m => m.id === membershipId), [membershipId, memberships]);

    useEffect(() => {
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
            // "Startprogram" will be handled by assigning a specific membership ID.
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
                <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
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
                 <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
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

type EnrichedParticipant = ParticipantProfile & { 
    locationName: string; 
    typeForDisplay: string; 
};
type SortableKeys = 'name' | 'typeForDisplay' | 'locationName' | 'age' | 'gender';

const MemberIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015-5 5 5 0 015 5v1h-1.251a6.975 6.975 0 00-1.21-1.757.994.994 0 00-1.517.042A5.002 5.002 0 0111 15H6v-4z"/>
    </svg>
);

export const MemberManagement: React.FC<MemberManagementProps> = ({
  participants,
  allParticipantGoals,
  allActivityLogs,
  coachNotes,
  oneOnOneSessions,
  loggedInStaff,
  isOnline,
}) => {
    // hooks
    const { 
        locations, 
        memberships,
        staffMembers,
        addParticipant,
        updateParticipantProfile,
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
        integrationSettings,
    } = useAppContext();
    const { user } = useAuth();

    // state
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<ParticipantProfile | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<ParticipantProfile | null>(null);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedParticipantForNotes, setSelectedParticipantForNotes] = useState<ParticipantProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'prospect'>('active');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
    const [participantToDecline, setParticipantToDecline] = useState<ParticipantProfile | null>(null);
    const [approvingParticipant, setApprovingParticipant] = useState<ParticipantProfile | null>(null);


    const isAdmin = loggedInStaff?.role === 'Admin';
    
    // memoized values
    const enrichedParticipants = useMemo(() => {
        return participants.map(p => {
            const membership = memberships.find(m => m.id === p.membershipId);
            let typeText = '';
            
            if (!p.isActive) {
                typeText = 'Inaktiv';
            } else {
                if (membership) {
                    if (membership.type === 'clip_card' && p.clipCardStatus && p.clipCardStatus.remainingClips >= 0) {
                        typeText = `${membership.name} (${p.clipCardStatus.remainingClips} klipp)`;
                    } else {
                        typeText = membership.name;
                    }
                } else {
                    typeText = 'Aktiv (saknar medlemskap)';
                }
            }
    
            return {
                ...p,
                locationName: locations.find(l => l.id === p.locationId)?.name || 'N/A',
                typeForDisplay: typeText,
            };
        });
    }, [participants, locations, memberships]);

    const pendingParticipants = useMemo(() => {
        return participants.filter(p => p.approvalStatus === 'pending').sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime());
    }, [participants]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedParticipants = useMemo(() => {
        let filtered: EnrichedParticipant[] = enrichedParticipants;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (statusFilter === 'prospect') return p.typeForDisplay === 'Startprogram';
                if (statusFilter === 'active') return p.isActive && p.typeForDisplay !== 'Startprogram' && p.approvalStatus !== 'pending';
                if (statusFilter === 'inactive') return !p.isActive;
                return true;
            });
        }
        
        if (isAdmin && locationFilter !== 'all') {
            filtered = filtered.filter(p => p.locationId === locationFilter);
        }

        if (searchTerm.trim()) {
            const lowercasedFilter = searchTerm.toLowerCase();
            filtered = filtered.filter(p => p.name?.toLowerCase().includes(lowercasedFilter) || p.email?.toLowerCase().includes(lowercasedFilter));
        }

        if (sortConfig) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
    
                if (sortConfig.key === 'age') {
                    const numA = a.age ? parseInt(a.age, 10) : -1;
                    const numB = b.age ? parseInt(b.age, 10) : -1;
                    if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
    
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                const comparison = String(aValue).localeCompare(String(bValue), 'sv', { numeric: true });
    
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return filtered;
    }, [enrichedParticipants, statusFilter, locationFilter, searchTerm, sortConfig, isAdmin]);
    
    // handlers
    const handleSaveMember = async (memberData: ParticipantProfile) => {
        if (editingMember) {
            await updateParticipantProfile(editingMember.id, memberData);
        } else {
            await addParticipant(memberData);
        }
    };

    const handleDecline = (participant: ParticipantProfile) => {
        setParticipantToDecline(participant);
    };

    const handleConfirmDecline = async () => {
        if (participantToDecline) {
            await updateParticipantProfile(participantToDecline.id, { approvalStatus: 'declined', isActive: false });
            setParticipantToDecline(null);
        }
    };
    
    const handleOpenNotesModal = (participant: ParticipantProfile) => {
        setSelectedParticipantForNotes(participant);
        setIsNotesModalOpen(true);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedMembers(new Set(filteredAndSortedParticipants.map(p => p.id)));
        } else {
            setSelectedMembers(new Set());
        }
    };

    const handleSelectOne = (participantId: string) => {
        setSelectedMembers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(participantId)) {
                newSet.delete(participantId);
            } else {
                newSet.add(participantId);
            }
            return newSet;
        });
    };

    const handleBulkAction = (action: BulkActionType) => {
        setBulkAction(action);
        setIsBulkUpdateModalOpen(true);
    };

    const handleConfirmBulkUpdate = (value: string) => {
        const updates: Partial<ParticipantProfile> = {};
        if (bulkAction === 'location') updates.locationId = value;
        if (bulkAction === 'membership') updates.membershipId = value;
        if (bulkAction === 'status') {
            if (value === 'active') updates.isActive = true;
            if (value === 'inactive') updates.isActive = false;
        }

        const promises = Array.from(selectedMembers).map(id => updateParticipantProfile(id, updates));
        Promise.all(promises).then(() => {
            setSelectedMembers(new Set());
            setIsBulkUpdateModalOpen(false);
        });
    };

    const handleConfirmDelete = async () => {
        if (!memberToDelete) return;
        
        await updateParticipantProfile(memberToDelete.id, { isActive: false, endDate: new Date().toISOString() }); // Soft delete
        setMemberToDelete(null);
    };

    const getTypeDisplay = (p: EnrichedParticipant) => {
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

    // JSX
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
                              <Button size="sm" variant="danger" onClick={() => handleDecline(p)}>Neka</Button>
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
                    onChange={(e) => setStatusFilter(e.target.value as any)}
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
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('membership')}>Ändra Medlemskap</Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('location')}>Ändra Ort</Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkAction('status')}>Ändra Status</Button>
                </div>
            )}
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow border">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="p-4"><input type="checkbox" onChange={handleSelectAll} checked={selectedMembers.size > 0 && selectedMembers.size === filteredAndSortedParticipants.length && filteredAndSortedParticipants.length > 0} /></th>
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
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="p-4"><input type="checkbox" checked={selectedMembers.has(p.id)} onChange={() => handleSelectOne(p.id)} /></td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                <div className="text-xs text-gray-500">{p.email}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm">{getTypeDisplay(p)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.locationName}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.age || '-'}</td>
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
            onSaveMember={handleSaveMember}
            memberToEdit={editingMember}
            existingEmails={participants.map(p => p.email?.toLowerCase() || '')}
            locations={locations}
            memberships={memberships}
            loggedInStaff={loggedInStaff}
        />
        
        {selectedParticipantForNotes && (
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
                loggedInCoachId={user!.id}
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
                onConfirm={handleConfirmBulkUpdate}
                action={bulkAction}
                memberCount={selectedMembers.size}
                locations={locations}
                memberships={memberships}
            />
        )}

        <ConfirmationModal
            isOpen={!!memberToDelete}
            onClose={() => setMemberToDelete(null)}
            onConfirm={handleConfirmDelete}
            title="Inaktivera Medlem"
            message={`Är du säker på att du vill inaktivera ${memberToDelete?.name}? Detta kommer att markera dem som inaktiva istället för att ta bort dem permanent.`}
            confirmButtonText="Ja, inaktivera"
        />
         <ConfirmationModal
            isOpen={!!participantToDecline}
            onClose={() => setParticipantToDecline(null)}
            onConfirm={handleConfirmDecline}
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
                    await updateParticipantProfile(approvingParticipant.id, updates);
                    setApprovingParticipant(null);
                }}
                memberships={memberships}
            />
        )}
      </div>
    );
};
