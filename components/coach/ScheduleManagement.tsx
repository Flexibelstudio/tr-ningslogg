import React, { useState, useMemo } from 'react';
import { GroupClassSchedule, GroupClassDefinition, Location, StaffMember } from '../../types';
import { Button } from '../Button';
import { CreateScheduleModal } from './CreateScheduleModal';
import { ConfirmationModal } from '../ConfirmationModal';

interface ScheduleManagementProps {
  schedules: GroupClassSchedule[];
  setSchedules: (updater: GroupClassSchedule[] | ((prev: GroupClassSchedule[]) => GroupClassSchedule[])) => void;
  classDefinitions: GroupClassDefinition[];
  locations: Location[];
  coaches: StaffMember[];
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
);

const dayOfWeekMap = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ schedules, setSchedules, classDefinitions, locations, coaches }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scheduleToEdit, setScheduleToEdit] = useState<GroupClassSchedule | null>(null);
    const [scheduleToDelete, setScheduleToDelete] = useState<GroupClassSchedule | null>(null);

    const handleSaveSchedule = (schedule: GroupClassSchedule) => {
        setSchedules(prev => {
            const exists = prev.some(s => s.id === schedule.id);
            if (exists) {
                return prev.map(s => s.id === schedule.id ? schedule : s);
            }
            return [...prev, schedule];
        });
    };

    const handleDelete = () => {
        if (!scheduleToDelete) return;
        setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete.id));
        setScheduleToDelete(null);
    };

    const openEditModal = (schedule: GroupClassSchedule) => {
        setScheduleToEdit(schedule);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setScheduleToEdit(null);
        setIsModalOpen(true);
    };
    
    const sortedSchedules = useMemo(() => {
        return [...schedules].sort((a, b) => {
            const timeA = a.startTime;
            const timeB = b.startTime;
            if (timeA < timeB) return -1;
            if (timeA > timeB) return 1;
            return a.startDate.localeCompare(b.startDate);
        });
    }, [schedules]);

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Schema för Gruppass</h3>
                <Button onClick={openCreateModal} className="mt-3 sm:mt-0">
                    Lägg ut nytt pass
                </Button>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {sortedSchedules.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Inga gruppass är schemalagda än.</p>
                ) : (
                    sortedSchedules.map(schedule => {
                        const classDef = classDefinitions.find(c => c.id === schedule.groupClassId);
                        const location = locations.find(l => l.id === schedule.locationId);
                        const coach = coaches.find(c => c.id === schedule.coachId);
                        const days = schedule.daysOfWeek.map(d => dayOfWeekMap[d % 7]).join(', ');

                        return (
                            <div key={schedule.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between items-start gap-4 bg-gray-50">
                                <div className="flex-grow">
                                    <p className="font-bold text-lg text-gray-800">{classDef?.name || 'Okänt pass'} - {schedule.startTime}</p>
                                    <p className="text-sm text-gray-600">
                                        {days} | {schedule.durationMinutes} min | Coach: {coach?.name || 'Okänd'}
                                    </p>
                                     <p className="text-sm text-gray-500">
                                        Ort: {location?.name || 'Okänd'} | Gäller: {schedule.startDate} till {schedule.endDate}
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                                    <Button onClick={() => openEditModal(schedule)} variant="outline" size="sm" className="!text-xs">Redigera</Button>
                                    <Button onClick={() => setScheduleToDelete(schedule)} variant="danger" size="sm" className="!p-1.5"><TrashIcon /></Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {isModalOpen && (
                <CreateScheduleModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveSchedule}
                    scheduleToEdit={scheduleToEdit}
                    classDefinitions={classDefinitions}
                    locations={locations}
                    coaches={coaches}
                />
            )}
            
            <ConfirmationModal
                isOpen={!!scheduleToDelete}
                onClose={() => setScheduleToDelete(null)}
                onConfirm={handleDelete}
                title="Ta bort schemalagt pass?"
                message="Är du säker på att du vill ta bort detta återkommande pass från schemat? Detta kan inte ångras."
                confirmButtonText="Ja, ta bort"
            />
        </div>
    );
};
