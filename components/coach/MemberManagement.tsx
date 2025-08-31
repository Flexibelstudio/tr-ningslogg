import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, WorkoutLog, Location, Membership, StaffMember, OneOnOneSession, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { Button } from '../Button';
import { AddMemberModal } from './AddMemberModal';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
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
            locationId: participant.locationId, // Ensure locationId is preserved
        };

        if (isInStartProgram) {
            updates.isProspect = true;
        } else {
            updates.isProspect = false;
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
                        type="checkbox"
                        checked={isInStartProgram}
                        onChange={(e) => setIsInStartProgram(e.target.checked)}
                        className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                    />
                    <div>
                        <span className="text-lg font-medium text-gray-700">Placera i Startprogram</span>
                        <p className="text-sm text-gray-500">
                            Medlemmen markeras som ny och placeras i "Startprogram"-fasen i Klientresan.
                        </p>
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
  ai: GoogleGenAI | null;
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
  ai,
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

    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkActionType>('membership');
    const [participantToApprove, setParticipantToApprove] = useState<ParticipantProfile | null>(null);
    const [showConfirmDecline, setShowConfirmDecline] = useState(false);
    const [participantToDecline, setParticipantToDecline] = useState<ParticipantProfile | null>(null);


    const handleOpenNotesModal = (participant: ParticipantProfile) => {
      setSelectedParticipantForNotes(participant);
      setIsNotesModalOpen(true);
    };

    const handleOpenEditModal = (member: ParticipantProfile) => {
      setEditingMember(member);
      setIsAddMemberModalOpen(true);
    };

    const handleSaveMember = async (memberData: ParticipantProfile) => {
        if (editingMember) {
            await updateParticipantProfile(memberData.id, memberData);
        } else {
            await addParticipant(memberData);
        }
    };
    
    const handleConfirmApproval = async (updates: Partial<ParticipantProfile>) => {
        if (participantToApprove) {
            await updateParticipantProfile(participantToApprove.id, updates);
            setParticipantToApprove(null);
        }
    };

    const handleDeclineUser = async (participantId: string) => {
        await updateParticipantProfile(participantId, { approvalStatus: 'declined', isActive: false });
    };

    const handleDeleteMember = async (participantId: string) => {
        await updateParticipantProfile(participantId, { isActive: false, endDate: new Date().toISOString().split('T')[0] });
    };

    const confirmDeleteMember = async () => {
        if (memberToDelete) {
            await handleDeleteMember(memberToDelete.id);
        }
        setMemberToDelete(null);
    };

    const getMembershipName = useCallback((membershipId?: string) => {
      if (!membershipId) return 'Inget';
      return memberships.find(m => m.id === membershipId)?.name || 'Okänt';
    }, [memberships]);
    
    const locationNameMap = useMemo(() => {
        return new Map(locations.map(l => [l.id, l.name]));
    }, [locations]);

    const enrichedParticipants = useMemo(() => {
        return participants.map(p => {
            let typeForDisplay = 'Aktiv Medlem';
            if (p.isProspect) typeForDisplay = 'Startprogram';
            if (!p.isActive) typeForDisplay = 'Inaktiv';
            
            return {
                ...p,
                locationName: p.locationId ? (locationNameMap.get(p.locationId) || 'Okänd') : 'Okänd',
                typeForDisplay: typeForDisplay,
            };
        });
    }, [participants, locationNameMap]);

    const filteredAndSortedParticipants = useMemo(() => {
        let sortableItems = [...enrichedParticipants];
        
        // Filtering
        if (filter) {
          const lowercasedFilter = filter.toLowerCase();
          sortableItems = sortableItems.filter(p =>
            p.name?.toLowerCase().includes(lowercasedFilter) ||
            p.email?.toLowerCase().includes(lowercasedFilter)
          );
        }
        if (statusFilter !== 'all') {
            if (statusFilter === 'active') sortableItems = sortableItems.filter(p => p.isActive);
            if (statusFilter === 'inactive') sortableItems = sortableItems.filter(p => !p.isActive);
            if (statusFilter === 'prospects') sortableItems = sortableItems.filter(p => p.isProspect);
        }

        // Sorting
        // FIX: The sorting logic was treating `age` as a string, leading to incorrect sorting (e.g., "9" > "35").
        // This has been corrected to parse `age` as a number for proper numerical comparison.
        // String sorting for other columns has been made more robust with `localeCompare`.
        sortableItems.sort((a, b) => {
            const key = sortConfig.key;
            const direction = sortConfig.direction === 'ascending' ? 1 : -1;
            
            // Handle numeric sorting for age
            if (key === 'age') {
                const numA = a.age ? parseInt(a.age, 10) : Number.MIN_SAFE_INTEGER;
                const numB = b.age ? parseInt(b.age, 10) : Number.MIN_SAFE_INTEGER;
                const valA = isNaN(numA) ? Number.MIN_SAFE_INTEGER : numA;
                const valB = isNaN(numB) ? Number.MIN_SAFE_INTEGER : numB;
                return (valA - valB) * direction;
            }
        
            // Handle string sorting for all other keys
            const aValue = String(a[key] || '');
            const bValue = String(b[key] || '');
            return aValue.localeCompare(bValue) * direction;
        });
        return sortableItems;
    }, [enrichedParticipants, filter, statusFilter, sortConfig]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedMemberIds(filteredAndSortedParticipants.map(p => p.id));
        } else {
            setSelectedMemberIds([]);
        }
    };
    
    const handleSelectOne = (id: string, isSelected: boolean) => {
        if (isSelected) {
            setSelectedMemberIds(prev => [...prev, id]);
        } else {
            setSelectedMemberIds(prev => prev.filter(memberId => memberId !== id));
        }
    };

    const handleBulkUpdateConfirm = async (value: string) => {
        if (!value) return;
        let updateData: Partial<ParticipantProfile> = {};
        if (bulkAction === 'membership') {
            updateData.membershipId = value;
        } else if (bulkAction === 'location') {
            updateData.locationId = value;
        } else if (bulkAction === 'status') {
            updateData.isActive = value === 'active';
        }
    
        const updates = selectedMemberIds.map(id => updateParticipantProfile(id, updateData));
        await Promise.all(updates);
    
        setIsBulkUpdateModalOpen(false);
        setSelectedMemberIds([]);
    };
    
    const pendingMembers = useMemo(() => {
        return participants.filter(p => p.approvalStatus === 'pending');
    }, [participants]);

    const addNote = async (noteText: string) => {
        if (selectedParticipantForNotes) {
            setCoachNotesData(prev => [...prev, {
                id: crypto.randomUUID(),
                participantId: selectedParticipantForNotes.id,
                noteText,
                createdDate: new Date().toISOString(),
                noteType: 'check-in',
            }]);
        }
    };
    
    const updateNote = async (noteId: string, newText: string) => {
        setCoachNotesData(prev => prev.map(note => note.id === noteId ? { ...note, noteText: newText, createdDate: new Date().toISOString() } : note));
    };
    
    const deleteNote = async (noteId: string) => {
        setCoachNotesData(prev => prev.filter(note => note.id !== noteId));
    };

    const existingEmails = useMemo(() => participants.map(p => (p.email || '').toLowerCase()).filter(Boolean), [participants]);

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
        <h2 className="text-3xl font-bold tracking-tight text-gray-800 flex items-center">
            <MemberIcon /> Medlemsregister
        </h2>
        <Button onClick={() => { setEditingMember(null); setIsAddMemberModalOpen(true); }}>
            Lägg till Medlem
        </Button>
      </div>

      {pendingMembers.length > 0 && (
          <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
              <h3 className="text-xl font-bold text-gray-800">Väntar på godkännande ({pendingMembers.length})</h3>
              <div className="mt-2 space-y-2">
                  {pendingMembers.map(p => (
                      <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-white rounded shadow-sm">
                          <div>
                            <p className="font-semibold text-gray-900">{p.name} ({p.email})</p>
                            <p className="text-sm text-gray-600">
                                Ort: {locations.find(l => l.id === p.locationId)?.name || 'Okänd'}
                            </p>
                          </div>
                          <div className="flex gap-2 mt-2 sm:mt-0">
                              <Button onClick={() => setParticipantToApprove(p)} size="sm">Godkänn</Button>
                              <Button onClick={() => setParticipantToDecline(p)} variant="danger" size="sm">Neka</Button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <Input 
          placeholder="Sök på namn eller e-post..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-grow"
        />
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: 'active', label: 'Aktiva' },
            { value: 'inactive', label: 'Inaktiva' },
            { value: 'prospects', label: 'Startprogram' },
            { value: 'all', label: 'Alla' },
          ]}
          className="w-full sm:w-48"
        />
      </div>

       {selectedMemberIds.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg flex flex-col sm:flex-row items-center gap-4 mb-4 animate-fade-in-down">
                <p className="font-semibold text-blue-800 flex-grow">{selectedMemberIds.length} medlemmar valda</p>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setBulkAction('membership'); setIsBulkUpdateModalOpen(true); }}>Ändra Medlemskap...</Button>
                    <Button size="sm" variant="outline" onClick={() => { setBulkAction('location'); setIsBulkUpdateModalOpen(true); }}>Ändra Ort...</Button>
                    <Button size="sm" variant="outline" onClick={() => { setBulkAction('status'); setIsBulkUpdateModalOpen(true); }}>Ändra Status...</Button>
                </div>
            </div>
       )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
               <th scope="col" className="p-4">
                    <input type="checkbox" className="h-4 w-4 text-flexibel" onChange={handleSelectAll} checked={selectedMemberIds.length > 0 && selectedMemberIds.length === filteredAndSortedParticipants.length} />
               </th>
              {/* Table headers */}
              {(['name', 'typeForDisplay', 'locationName', 'age', 'gender'] as SortableKeys[]).map(key => (
                  <th key={key} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(key)}>
                    {
                      { name: 'Namn', typeForDisplay: 'Typ', locationName: 'Ort', age: 'Ålder', gender: 'Kön'}[key]
                    }
                     {sortConfig.key === key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                  </th>
              ))}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
             {filteredAndSortedParticipants.map(p => (
                <tr key={p.id}>
                    <td className="p-4">
                        <input type="checkbox" className="h-4 w-4 text-flexibel" checked={selectedMemberIds.includes(p.id)} onChange={e => handleSelectOne(p.id, e.target.checked)} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{p.name}</div><div className="text-xs text-gray-500">{p.email}</div></td>
                    <td className="px-4 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.typeForDisplay === 'Startprogram' ? 'bg-blue-100 text-blue-800' : p.typeForDisplay === 'Aktiv Medlem' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.typeForDisplay}</span></td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.locationName}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.age || 'N/A'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.gender || 'N/A'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <Button variant="outline" size="sm" className="!text-xs" onClick={() => handleOpenNotesModal(p)}>Anteckningar</Button>
                        <Button variant="outline" size="sm" className="!text-xs" onClick={() => handleOpenEditModal(p)}>Redigera</Button>
                        {p.isActive && <Button variant="danger" size="sm" className="!text-xs" onClick={() => setMemberToDelete(p)}>Inaktivera</Button>}
                    </td>
                </tr>
            ))}
          </tbody>
        </table>
         {filteredAndSortedParticipants.length === 0 && (
            <div className="text-center py-6 bg-gray-50">
                <p className="text-sm text-gray-500">Inga medlemmar matchade filtret.</p>
            </div>
        )}
      </div>
      
      {isAddMemberModalOpen && (
        <AddMemberModal
            isOpen={isAddMemberModalOpen}
            onClose={() => setIsAddMemberModalOpen(false)}
            onSaveMember={handleSaveMember}
            memberToEdit={editingMember}
            existingEmails={existingEmails}
            locations={locations}
            memberships={memberships}
            loggedInStaff={loggedInStaff}
        />
      )}

      {selectedParticipantForNotes && ai && (
         <MemberNotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            ai={ai}
            participant={selectedParticipantForNotes}
            notes={coachNotes.filter(note => note.participantId === selectedParticipantForNotes.id)}
            allParticipantGoals={allParticipantGoals}
            setParticipantGoals={setParticipantGoalsData}
            allActivityLogs={allActivityLogs}
            setGoalCompletionLogs={setGoalCompletionLogsData}
            onAddNote={addNote}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            oneOnOneSessions={oneOnOneSessions}
            setOneOnOneSessions={setOneOnOneSessionsData}
            coaches={staffMembers}
            loggedInCoachId={loggedInStaff?.id || ''}
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
      
       <BulkUpdateModal
          isOpen={isBulkUpdateModalOpen}
          onClose={() => setIsBulkUpdateModalOpen(false)}
          onConfirm={handleBulkUpdateConfirm}
          action={bulkAction}
          memberCount={selectedMemberIds.length}
          locations={locations}
          memberships={memberships}
       />
       
       <ConfirmationModal
            isOpen={!!memberToDelete}
            onClose={() => setMemberToDelete(null)}
            onConfirm={confirmDeleteMember}
            title="Inaktivera Medlem"
            message={`Är du säker på att du vill inaktivera ${memberToDelete?.name}? Deras data kommer finnas kvar men de markeras som inaktiva.`}
            confirmButtonText="Ja, inaktivera"
       />

       {participantToApprove && (
           <ApprovalModal
               isOpen={!!participantToApprove}
               onClose={() => setParticipantToApprove(null)}
               participant={participantToApprove}
               onConfirm={handleConfirmApproval}
               memberships={memberships}
           />
       )}
       
       {participantToDecline && (
            <ConfirmationModal
                isOpen={!!participantToDecline}
                onClose={() => setParticipantToDecline(null)}
                onConfirm={async () => {
                    if (participantToDecline) {
                        await handleDeclineUser(participantToDecline.id);
                        setParticipantToDecline(null);
                    }
                }}
                title="Neka Medlem?"
                message={`Är du säker på att du vill neka registreringen för ${participantToDecline.name}? Användaren kommer inte kunna logga in.`}
                confirmButtonText="Ja, neka"
                confirmButtonVariant="danger"
            />
       )}
    </div>
  );
};
