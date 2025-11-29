
import { useState, useMemo } from 'react';
import { ParticipantProfile, Membership, StaffMember } from '../../../types';
import { useAppContext } from '../../../context/AppContext';
import { calculateAge } from '../../../utils/dateUtils';
import { BulkActionType } from '../../../components/coach/BulkUpdateModal';

type SortableKeys = 'name' | 'typeForDisplay' | 'locationName' | 'age' | 'gender';

export const useMembers = (loggedInStaff: StaffMember | null) => {
  const {
    participantDirectory: participants,
    locations,
    memberships,
    addParticipant,
    updateParticipantProfile,
    staffMembers,
  } = useAppContext();

  const isAdmin = loggedInStaff?.role === 'Admin';

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'prospect'>('active');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  // Derived Data
  const enrichedParticipants = useMemo(() => {
    return participants.map((p) => {
      const membership = memberships.find((m) => m.id === p.membershipId);
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
        locationName: locations.find((l) => l.id === p.locationId)?.name || 'N/A',
        typeForDisplay: typeText,
      };
    });
  }, [participants, locations, memberships]);

  const pendingParticipants = useMemo(() => {
    return participants
      .filter((p) => p.approvalStatus === 'pending')
      .sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime());
  }, [participants]);

  const filteredAndSortedParticipants = useMemo(() => {
    let filtered = enrichedParticipants;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => {
        if (statusFilter === 'prospect') return p.typeForDisplay === 'Startprogram';
        if (statusFilter === 'active')
          return p.isActive && p.typeForDisplay !== 'Startprogram' && p.approvalStatus !== 'pending';
        if (statusFilter === 'inactive') return !p.isActive;
        return true;
      });
    }

    if (isAdmin && locationFilter !== 'all') {
      filtered = filtered.filter((p) => p.locationId === locationFilter);
    }

    if (searchTerm.trim()) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(lowercasedFilter) || p.email?.toLowerCase().includes(lowercasedFilter)
      );
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === 'age') {
          const ageA = calculateAge(a.birthDate) ?? (a.age ? parseInt(String(a.age), 10) : -1);
          const ageB = calculateAge(b.birthDate) ?? (b.age ? parseInt(String(b.age), 10) : -1);
          if (ageA < ageB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (ageA > ageB) return sortConfig.direction === 'asc' ? 1 : -1;
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

  // Actions
  const requestSort = (key: SortableKeys) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(new Set(filteredAndSortedParticipants.map((p) => p.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };

  const handleSelectOne = (participantId: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(participantId)) {
        newSet.delete(participantId);
      } else {
        newSet.add(participantId);
      }
      return newSet;
    });
  };

  const handleSaveMember = async (memberData: ParticipantProfile, isEditing: boolean) => {
    if (isEditing) {
      await updateParticipantProfile(memberData.id, memberData);
    } else {
      await addParticipant(memberData);
    }
  };

  const handleConfirmBulkUpdate = async (action: BulkActionType, value: string) => {
    const updates: Partial<ParticipantProfile> = {};
    if (action === 'location') updates.locationId = value;
    if (action === 'membership') updates.membershipId = value;
    if (action === 'status') {
      if (value === 'active') updates.isActive = true;
      if (value === 'inactive') updates.isActive = false;
    }

    const promises = Array.from(selectedMembers).map((id: string) => updateParticipantProfile(id, updates));
    await Promise.all(promises);
    setSelectedMembers(new Set());
  };

  const handleConfirmDelete = async (memberId: string) => {
    await updateParticipantProfile(memberId, { isActive: false, endDate: new Date().toISOString() });
  };

  const handleConfirmDecline = async (participantId: string) => {
    await updateParticipantProfile(participantId, { approvalStatus: 'declined', isActive: false });
  };

  const handleConfirmApprove = async (participantId: string, updates: Partial<ParticipantProfile>) => {
      await updateParticipantProfile(participantId, updates);
  };

  return {
    participants,
    locations,
    memberships,
    staffMembers,
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
  };
};
