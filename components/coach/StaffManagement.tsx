<<<<<<< HEAD
=======

>>>>>>> origin/staging
import React, { useState, useMemo } from 'react';
import { StaffMember, Location, StaffAvailability, ParticipantProfile } from '../../types';
import { Button } from '../Button';
import { AddEditStaffModal } from './AddEditStaffModal';
import { ConfirmationModal } from '../ConfirmationModal';
import { Input, Select } from '../Input';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { useAppContext } from '../../context/AppContext';
<<<<<<< HEAD
=======
import { CalendarSubscriptionModal } from '../CalendarSubscriptionModal';
>>>>>>> origin/staging

interface StaffManagementProps {
  staff: StaffMember[];
  setStaff: (updater: StaffMember[] | ((prev: StaffMember[]) => StaffMember[])) => void;
  locations: Location[];
  availability: StaffAvailability[];
  setAvailability: (availability: StaffAvailability[] | ((prev: StaffAvailability[]) => StaffAvailability[])) => void;
  loggedInStaff: StaffMember;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

export const StaffManagement: React.FC<StaffManagementProps> = ({ staff, setStaff, locations, availability, setAvailability, loggedInStaff }) => {
  const { participantDirectory, integrationSettings } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
<<<<<<< HEAD
=======
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
>>>>>>> origin/staging
  
  // State for calendar view
  const [selectedStaffId, setSelectedStaffId] = useState<string>(loggedInStaff.id);
  // State for table filter
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const isAdmin = loggedInStaff.role === 'Admin';

  const handleSaveStaff = (staffData: StaffMember) => {
    if (editingStaff) {
      setStaff(prev => prev.map(s => s.id === staffData.id ? staffData : s));
    } else {
      setStaff(prev => [...prev, staffData].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setIsModalOpen(true);
  };
  
  const openEditModal = (staffMember: StaffMember) => {
    setEditingStaff(staffMember);
    setIsModalOpen(true);
  };

  const initiateDelete = (staffMember: StaffMember) => {
    setStaffToDelete(staffMember);
  };
  
  const confirmDelete = () => {
    if (staffToDelete) {
      setStaff(prev => prev.filter(s => s.id !== staffToDelete.id));
      setAvailability(prev => prev.filter(a => a.staffId !== staffToDelete.id));
      if (selectedStaffId === staffToDelete.id) {
        setSelectedStaffId(loggedInStaff.id);
      }
    }
    setStaffToDelete(null);
  };

  const locationOptionsForFilter = [
      { value: 'all', label: 'Alla Orter' },
      ...locations.map(loc => ({ value: loc.id, label: loc.name }))
  ];
  
  const filteredStaffForTable = useMemo(() => {
    return staff.filter(s => {
        if (isAdmin) {
            return locationFilter === 'all' || s.locationId === locationFilter;
        }
        return s.locationId === loggedInStaff.locationId;
    });
  }, [staff, isAdmin, locationFilter, loggedInStaff.locationId]);

  const staffOptionsForCalendar = useMemo(() => 
    staff.filter(s => s.isActive).map(s => ({ value: s.id, label: s.name }))
  , [staff]);

  const selectedStaffMemberForCalendar = useMemo(() => staff.find(s => s.id === selectedStaffId) || loggedInStaff, [staff, selectedStaffId, loggedInStaff]);
<<<<<<< HEAD
=======
  
  // Construct mock URL. Safely access env.
  const projectId = (import.meta as any).env?.VITE_FB_PROJECT_ID || 'YOUR_PROJECT';
  const calendarUrl = `https://europe-west1-${projectId}.cloudfunctions.net/calendarFeed?userId=${loggedInStaff.id}&type=coach`;
>>>>>>> origin/staging

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-xl space-y-8">
      {/* Top Header */}
<<<<<<< HEAD
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center pb-4 border-b">
=======
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b gap-4">
        <Button variant="outline" onClick={() => setIsSubModalOpen(true)}>
             Prenumerera på mitt schema (iCal)
        </Button>
>>>>>>> origin/staging
        <Button onClick={openAddModal} className="mt-3 sm:mt-0">Lägg till Personal</Button>
      </div>

      {/* Staff Table Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-700">Personalregister</h3>
        {isAdmin && (
            <Select
                label="Filtrera på ort:"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                options={locationOptionsForFilter}
                inputSize="sm"
                containerClassName="max-w-xs"
            />
        )}
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ort</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStaffForTable.map(s => (
                        <tr key={s.id}>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.name}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{s.role}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{locations.find(l => l.id === s.locationId)?.name || 'Okänd'}</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {s.isActive ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                                <Button variant="outline" size="sm" className="!text-xs" onClick={() => openEditModal(s)}>Redigera</Button>
                                <Button variant="danger" size="sm" className="!p-1.5" onClick={() => initiateDelete(s)} aria-label={`Ta bort ${s.name}`}><TrashIcon /></Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
             {filteredStaffForTable.length === 0 && (
                <div className="text-center py-6 bg-gray-50">
                    <p className="text-sm text-gray-500">Ingen personal matchade filtret.</p>
                </div>
            )}
        </div>
      </div>

      {/* Availability Calendar Section */}
      {(integrationSettings.isScheduleEnabled ?? true) && (
        <div className="pt-8 border-t">
            {isAdmin && (
                <Select
                  label="Visa schema för:"
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  options={staffOptionsForCalendar}
                  inputSize="sm"
                  containerClassName="max-w-xs mb-4"
                />
            )}
            <AvailabilityCalendar
              staffMember={selectedStaffMemberForCalendar}
              availability={availability.filter(a => a.staffId === selectedStaffId)}
              setAvailability={setAvailability}
            />
        </div>
      )}
      
      <AddEditStaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStaff}
        staffToEdit={editingStaff}
        locations={locations}
        participants={participantDirectory}
      />

      <ConfirmationModal
        isOpen={!!staffToDelete}
        onClose={() => setStaffToDelete(null)}
        onConfirm={confirmDelete}
        title="Ta bort Personal"
        message={`Är du säker på att du vill ta bort "${staffToDelete?.name}"? Detta kommer också att radera deras arbetsschema. Detta kan inte ångras.`}
        confirmButtonText="Ta bort"
      />
<<<<<<< HEAD
=======
      
      <CalendarSubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        calendarUrl={calendarUrl}
      />
>>>>>>> origin/staging
    </div>
  );
};