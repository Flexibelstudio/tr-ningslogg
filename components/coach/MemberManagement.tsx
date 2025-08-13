import React, { useState, useMemo, useCallback } from 'react';
import { ParticipantProfile, ParticipantGoalData, ActivityLog, CoachNote, WorkoutLog, Location, Membership, StaffMember, OneOnOneSession, GoalCompletionLog, Workout, WorkoutCategoryDefinition, StaffAvailability } from '../../types';
import { Button } from '../Button';
import { AddMemberModal } from './AddMemberModal';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import * as dateUtils from '../../utils/dateUtils';
import { Input } from '../Input';
import { BulkUpdateModal, BulkActionType } from './BulkUpdateModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { MemberNotesModal } from './MemberNotesModal';
import { useAppContext } from '../../context/AppContext';


interface MemberManagementProps {
  participants: ParticipantProfile[];
  allParticipantGoals: ParticipantGoalData[];
  allActivityLogs: ActivityLog[];
  coachNotes: CoachNote[];
  ai: GoogleGenAI | null;
  oneOnOneSessions: OneOnOneSession[];
  loggedInStaff: StaffMember | null;
}

// Combined type for enriched participant data, used for sorting keys.
type EnrichedParticipant = ParticipantProfile & { locationName: string; membershipName: string; };
type SortableKeys = keyof EnrichedParticipant;

const MemberIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
);

const Checkbox: React.FC<{ id: string, label: string, checked: boolean, onChange: (checked: boolean) => void }> = ({ id, label, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center space-x-2 cursor-pointer pr-4">
        <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
        />
        <span className="text-base text-gray-700">{label}</span>
    </label>
);

const StatCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <div className="bg-gray-100 p-3 rounded-lg shadow-sm text-center">
        <h4 className="text-xs font-medium text-gray-500 truncate">{title}</h4>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
);


export const MemberManagement: React.FC<MemberManagementProps> = ({ participants, allParticipantGoals, allActivityLogs, coachNotes, ai, oneOnOneSessions, loggedInStaff }) => {
    const {
        setParticipantDirectoryData,
        setCoachNotesData,
        locations,
        memberships,
        staffMembers,
        setOneOnOneSessionsData,
        setParticipantGoalsData,
        setGoalCompletionLogsData,
        workouts,
        setWorkoutsData,
        workoutCategories,
        staffAvailability,
    } = useAppContext();

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantProfile | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipantForNotes, setSelectedParticipantForNotes] = useState<ParticipantProfile | null>(null);

  type StatusOption = 'active' | 'inactive' | 'prospects';
  const statusOptions: { value: StatusOption, label: string }[] = [
      { value: 'active', label: 'Aktiva Medlemmar' },
      { value: 'prospects', label: 'Prospekt' },
      { value: 'inactive', label: 'Inaktiva Medlemmar' },
  ];
  
  const visibleStatusOptions = loggedInStaff?.role === 'Admin' 
    ? statusOptions 
    : statusOptions.filter(opt => opt.value === 'active' || opt.value === 'prospects');

  const handleFilterChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
    isChecked: boolean
  ) => {
    setter(prev => {
        if (isChecked) {
            return [...prev, value];
        } else {
            return prev.filter(item => item !== value);
        }
    });
  };

  const handleSaveMember = (memberData: ParticipantProfile) => {
    setParticipantDirectoryData(prev => {
        const existing = prev.find(p => p.id === memberData.id);
        if (existing) {
            return prev.map(p => p.id === memberData.id ? memberData : p);
        }
        return [...prev, memberData];
    });
  };

  const handleToggleStatus = (participantId: string) => {
    setParticipantDirectoryData(prev =>
      prev.map(p =>
        p.id === participantId ? { ...p, isActive: !(p.isActive ?? true), lastUpdated: new Date().toISOString() } : p
      )
    );
  };

  const handleOpenAddModal = () => {
    setEditingParticipant(null);
    setIsAddEditModalOpen(true);
  };
  
  const handleOpenEditModal = (participant: ParticipantProfile) => {
    setEditingParticipant(participant);
    setIsAddEditModalOpen(true);
  };
  
  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipantForNotes(participant);
    setIsNotesModalOpen(true);
  };
  
  const handleAddNote = (participantId: string, isProspect: boolean) => (noteText: string) => {
    if (!selectedParticipantForNotes) return;
    const newNote: CoachNote = {
        id: crypto.randomUUID(),
        participantId: participantId,
        noteText,
        createdDate: new Date().toISOString(),
        noteType: isProspect ? 'intro-session' : 'check-in',
    };
    setCoachNotesData(prev => [...prev, newNote]);
  };

  const filteredAndSortedParticipants = useMemo(() => {
    const filtered = participants
    .filter(p => {
        // Location filter
        if (selectedLocations.length > 0 && !selectedLocations.includes(p.locationId || '')) {
            return false;
        }
        // Membership filter
        if (selectedMemberships.length > 0 && !selectedMemberships.includes(p.membershipId || '')) {
            return false;
        }
        // Status filter
        if (selectedStatuses.length > 0) {
            const isProspect = p.isProspect;
            const isActiveMember = p.isActive && !isProspect;
            const isInactiveMember = !p.isActive && !isProspect;

            let matchesStatus = false;
            if (selectedStatuses.includes('prospects') && isProspect) matchesStatus = true;
            if (selectedStatuses.includes('active') && isActiveMember) matchesStatus = true;
            if (selectedStatuses.includes('inactive') && isInactiveMember) matchesStatus = true;
            
            if (!matchesStatus) return false;
        }

        // Search query filter
        if (searchQuery.trim() !== '') {
            const lowerCaseQuery = searchQuery.toLowerCase();
            return (
                p.name?.toLowerCase().includes(lowerCaseQuery) ||
                p.email?.toLowerCase().includes(lowerCaseQuery)
            );
        }
        return true;
    })
    .map(p => {
        const locationName = locations.find(loc => loc.id === p.locationId)?.name || 'N/A';
        const membershipName = memberships.find(mem => mem.id === p.membershipId)?.name || 'Inget';

        return {
            ...p,
            locationName,
            membershipName,
        }
    });

    // Sorting logic
    return filtered.sort((a, b) => {
        const { key, direction } = sortConfig;
        const aValue = a[key];
        const bValue = b[key];

        // Handle null/undefined/empty strings to be sorted last
        const aHasValue = aValue != null && aValue !== '';
        const bHasValue = bValue != null && bValue !== '';

        if (!aHasValue) return 1;
        if (!bHasValue) return -1;

        let comparison = 0;
        
        if (key === 'startDate' || key === 'endDate') {
            comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
        } else if (key === 'age') {
            comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
        } else {
            comparison = String(aValue).localeCompare(String(bValue), 'sv', { numeric: true });
        }
        
        return direction === 'descending' ? comparison * -1 : comparison;
    });

  }, [participants, locations, memberships, searchQuery, selectedLocations, selectedMemberships, selectedStatuses, sortConfig]);
  
  const stats = useMemo(() => {
    const activeMembers = participants.filter(p => p.isActive && !p.isProspect);
    const membershipCounts = memberships.reduce((acc, mem) => {
        acc[mem.name] = activeMembers.filter(p => p.membershipId === mem.id).length;
        return acc;
    }, {} as Record<string, number>);

    return {
        totalMembers: activeMembers.length,
        totalProspects: participants.filter(p => p.isProspect).length,
        men: activeMembers.filter(p => p.gender === 'Man').length,
        women: activeMembers.filter(p => p.gender === 'Kvinna').length,
        ...membershipCounts
    };
  }, [participants, memberships]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const filteredIds = useMemo(() => filteredAndSortedParticipants.map(p => p.id), [filteredAndSortedParticipants]);
  const isAllFilteredSelected = filteredIds.length > 0 && selectedMemberIds.length === filteredIds.length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedMemberIds(filteredIds);
      } else {
          setSelectedMemberIds([]);
      }
  };

  const handleSelectOne = (participantId: string, isChecked: boolean) => {
      if (isChecked) {
          setSelectedMemberIds(prev => [...prev, participantId]);
      } else {
          setSelectedMemberIds(prev => prev.filter(id => id !== participantId));
      }
  };
  
  const handleConfirmBulkUpdate = (value: string) => {
    if (!bulkAction) return;

    setParticipantDirectoryData(prev =>
        prev.map(p => {
            if (selectedMemberIds.includes(p.id)) {
                switch (bulkAction) {
                    case 'membership':
                        return { ...p, membershipId: value, lastUpdated: new Date().toISOString() };
                    case 'location':
                        return { ...p, locationId: value, lastUpdated: new Date().toISOString() };
                    case 'status':
                        const newIsActive = value === 'active';
                        // A prospect being "activated" becomes a regular member
                        const newIsProspect = p.isProspect ? !newIsActive : false;
                        return { ...p, isActive: newIsActive, isProspect: newIsProspect, lastUpdated: new Date().toISOString() };
                    default:
                        return p;
                }
            }
            return p;
        })
    );
    setBulkAction(null);
    setSelectedMemberIds([]);
  };

  const handleConfirmBulkDelete = () => {
    setParticipantDirectoryData(prev => prev.filter(p => !selectedMemberIds.includes(p.id)));
    setIsDeleteConfirmOpen(false);
    setSelectedMemberIds([]);
  };

  return (
    <div className="mt-10 mb-8 p-4 sm:p-6 bg-white rounded-lg shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800 flex items-center">
                <MemberIcon />
                Medlemmar
            </h2>
             <div className="flex items-center gap-2 mt-3 sm:mt-0">
                <Button onClick={handleOpenAddModal}>
                    Lägg till Medlem
                </Button>
            </div>
        </div>
        
        {loggedInStaff?.role === 'Admin' && (
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="Aktiva Medlemmar" value={stats.totalMembers} />
                <StatCard title="Prospekts" value={stats.totalProspects} />
                <StatCard title="Kvinnor / Män" value={`${stats.women} / ${stats.men}`} />
                {memberships.map(mem => (
                    <StatCard key={mem.id} title={mem.name} value={stats[mem.name] || 0} />
                ))}
            </div>
        )}

        <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
                <label htmlFor="search-member" className="block text-base font-medium text-gray-700 mb-1">Sök medlem</label>
                <Input
                    id="search-member"
                    placeholder="Sök på namn eller e-post..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    inputSize="sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t mt-4">
                <fieldset>
                    <legend className="block text-base font-medium text-gray-700 mb-2">Filtrera Status</legend>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2">
                        {visibleStatusOptions.map(option => (
                            <Checkbox
                                key={option.value}
                                id={`status-${option.value}`}
                                label={option.label}
                                checked={selectedStatuses.includes(option.value)}
                                onChange={isChecked => handleFilterChange(setSelectedStatuses, option.value, isChecked)}
                            />
                        ))}
                    </div>
                </fieldset>
                {loggedInStaff?.role === 'Admin' && (
                    <>
                        <fieldset>
                            <legend className="block text-base font-medium text-gray-700 mb-2">Filtrera Ort</legend>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2">
                                {locations.map(loc => (
                                    <Checkbox
                                        key={loc.id}
                                        id={`loc-${loc.id}`}
                                        label={loc.name}
                                        checked={selectedLocations.includes(loc.id)}
                                        onChange={isChecked => handleFilterChange(setSelectedLocations, loc.id, isChecked)}
                                    />
                                ))}
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend className="block text-base font-medium text-gray-700 mb-2">Filtrera Medlemskap</legend>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2">
                                {memberships.map(mem => (
                                    <Checkbox
                                        key={mem.id}
                                        id={`mem-${mem.id}`}
                                        label={mem.name}
                                        checked={selectedMemberships.includes(mem.id)}
                                        onChange={isChecked => handleFilterChange(setSelectedMemberships, mem.id, isChecked)}
                                    />
                                ))}
                            </div>
                        </fieldset>
                    </>
                )}
            </div>
        </div>
        
        {selectedMemberIds.length > 0 && loggedInStaff?.role === 'Admin' && (
            <div className="my-4 p-3 bg-flexibel/10 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in-down">
                <p className="text-base font-semibold text-flexibel">{selectedMemberIds.length} medlemmar valda</p>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setBulkAction('membership')} size="sm" variant="outline">Ändra Medlemskap</Button>
                    <Button onClick={() => setBulkAction('status')} size="sm" variant="outline">Ändra Status</Button>
                    <Button onClick={() => setBulkAction('location')} size="sm" variant="outline">Ändra Ort</Button>
                    <Button onClick={() => setIsDeleteConfirmOpen(true)} size="sm" variant="danger">Ta bort</Button>
                </div>
            </div>
        )}

        <div className="overflow-x-auto">
            {filteredAndSortedParticipants.length === 0 ? (
                 <div className="text-center py-10 bg-gray-50 rounded-lg">
                    <p className="text-lg text-gray-500">Inga medlemmar matchade din sökning.</p>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {loggedInStaff?.role === 'Admin' && (
                                <th scope="col" className="p-4">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                                        checked={isAllFilteredSelected}
                                        onChange={handleSelectAll}
                                        aria-label="Välj alla"
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('name')}>Namn{getSortIndicator('name')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('age')}>Ålder{getSortIndicator('age')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('gender')}>Kön{getSortIndicator('gender')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('membershipName')}>Medlemskap{getSortIndicator('membershipName')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('locationName')}>Ort{getSortIndicator('locationName')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('startDate')}>Startdatum{getSortIndicator('startDate')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('endDate')}>Slutdatum{getSortIndicator('endDate')}</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedParticipants.map((p, index) => {
                            const isSelected = selectedMemberIds.includes(p.id);
                            const rowClass = p.isProspect ? 'bg-blue-50' : !p.isActive ? 'bg-gray-100 opacity-70' : '';
                            return (
                                <tr key={p.id} className={`${rowClass} ${isSelected ? 'bg-flexibel/20' : ''}`} style={{ animation: `fadeIn 0.4s ease-out ${index * 30}ms backwards` }}>
                                    {loggedInStaff?.role === 'Admin' && (
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                                                checked={isSelected}
                                                onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                                                aria-label={`Välj ${p.name}`}
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                            {p.name}
                                            {p.isProspect && <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">Prospekt</span>}
                                        </div>
                                        <div className="text-xs text-gray-500">{p.email}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.age || '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.gender || '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.membershipName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.locationName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.startDate ? new Date(p.startDate).toLocaleDateString('sv-SE') : '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.endDate ? new Date(p.endDate).toLocaleDateString('sv-SE') : '-'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <Button onClick={() => handleOpenNotesModal(p)} variant="outline" size="sm" className="!text-xs">Klientkort</Button>
                                            <Button onClick={() => handleOpenEditModal(p)} variant="outline" size="sm" className="!text-xs">Redigera</Button>
                                            {loggedInStaff?.role === 'Admin' && !p.isProspect && (
                                                <Button onClick={() => handleToggleStatus(p.id)} variant={p.isActive ?? true ? 'danger' : 'primary'} size="sm" className="!text-xs">
                                                    {p.isActive ?? true ? 'Avaktivera' : 'Aktivera'}
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>

        <AddMemberModal
            isOpen={isAddEditModalOpen}
            onClose={() => setIsAddEditModalOpen(false)}
            onSaveMember={handleSaveMember}
            memberToEdit={editingParticipant}
            existingEmails={participants.map(p => p.email).filter((e): e is string => !!e)}
            locations={locations}
            memberships={memberships}
            loggedInStaff={loggedInStaff}
        />
        {bulkAction && (
             <BulkUpdateModal
                isOpen={!!bulkAction}
                onClose={() => setBulkAction(null)}
                onConfirm={handleConfirmBulkUpdate}
                action={bulkAction}
                memberCount={selectedMemberIds.length}
                locations={locations}
                memberships={memberships}
            />
        )}
        <ConfirmationModal
            isOpen={isDeleteConfirmOpen}
            onClose={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleConfirmBulkDelete}
            title={`Ta bort ${selectedMemberIds.length} medlemmar?`}
            message={`Är du säker på att du vill ta bort de valda ${selectedMemberIds.length} medlemmarna? All deras data kommer att raderas permanent. Detta kan inte ångras.`}
            confirmButtonText="Ja, ta bort"
        />
        {ai && selectedParticipantForNotes && loggedInStaff && (
             <MemberNotesModal
                isOpen={isNotesModalOpen}
                onClose={() => setIsNotesModalOpen(false)}
                ai={ai}
                participant={selectedParticipantForNotes}
                notes={coachNotes.filter(n => n.participantId === selectedParticipantForNotes.id)}
                allParticipantGoals={allParticipantGoals}
                setParticipantGoals={setParticipantGoalsData}
                allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipantForNotes.id)}
                setGoalCompletionLogs={setGoalCompletionLogsData}
                onAddNote={handleAddNote(selectedParticipantForNotes.id, selectedParticipantForNotes.isProspect || false)}
                oneOnOneSessions={oneOnOneSessions}
                setOneOnOneSessions={setOneOnOneSessionsData}
                coaches={staffMembers}
                loggedInCoachId={loggedInStaff.id}
                workouts={workouts}
                setWorkouts={setWorkoutsData}
                workoutCategories={workoutCategories}
                participants={participants}
                staffAvailability={staffAvailability}
            />
        )}
    </div>
  );
};
