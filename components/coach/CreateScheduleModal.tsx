import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { GroupClassSchedule, GroupClassDefinition, Location, StaffMember } from '../../types';
import { ToggleSwitch } from '../ToggleSwitch';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: GroupClassSchedule) => void;
  scheduleToEdit: GroupClassSchedule | null;
  classDefinitions: GroupClassDefinition[];
  locations: Location[];
  coaches: StaffMember[];
}

const WEEK_DAYS = [
    { label: 'Mån', value: 1 }, { label: 'Tis', value: 2 }, { label: 'Ons', value: 3 },
    { label: 'Tor', value: 4 }, { label: 'Fre', value: 5 }, { label: 'Lör', value: 6 },
    { label: 'Sön', value: 7 },
];

const DayOfWeekSelector: React.FC<{ selectedDays: number[]; onToggleDay: (day: number) => void }> = ({ selectedDays, onToggleDay }) => {
    return (
        <div className="flex justify-center gap-1">
            {WEEK_DAYS.map(day => (
                <Button
                    key={day.value}
                    type="button"
                    onClick={() => onToggleDay(day.value)}
                    variant={selectedDays.includes(day.value) ? 'primary' : 'outline'}
                    className="!px-3 !py-2 !text-xs sm:!text-sm"
                >
                    {day.label}
                </Button>
            ))}
        </div>
    );
};

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({ isOpen, onClose, onSave, scheduleToEdit, classDefinitions, locations, coaches }) => {
    const [formState, setFormState] = useState<Partial<Omit<GroupClassSchedule, 'id'>> & { maxParticipants: number | string, durationMinutes: number | string }>({
        locationId: '',
        groupClassId: '',
        coachId: '',
        daysOfWeek: [],
        startTime: '',
        durationMinutes: 0,
        maxParticipants: 12,
        startDate: '',
        endDate: '',
        hasWaitlist: true,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saveAndCopySuccess, setSaveAndCopySuccess] = useState<string | null>(null);

    const resetForm = useCallback(() => {
        const initialClassDef = classDefinitions[0];
        setFormState({
            locationId: locations[0]?.id || '',
            groupClassId: initialClassDef?.id || '',
            coachId: coaches.filter(c => c.isActive)[0]?.id || '',
            daysOfWeek: [],
            startTime: '',
            durationMinutes: initialClassDef?.defaultDurationMinutes || 45,
            maxParticipants: 12,
            startDate: '',
            endDate: '',
            hasWaitlist: initialClassDef?.hasWaitlist ?? true,
        });
        setErrors({});
    }, [locations, classDefinitions, coaches]);

    useEffect(() => {
        if (isOpen) {
            if (scheduleToEdit) {
                setFormState(scheduleToEdit);
            } else {
                resetForm();
            }
            setErrors({});
            setSaveAndCopySuccess(null);
        }
    }, [isOpen, scheduleToEdit, resetForm]);

    const handleInputChange = (field: keyof typeof formState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (!scheduleToEdit) { // Only for new schedules, not when editing
            const classDef = classDefinitions.find(c => c.id === formState.groupClassId);
            if (classDef) {
                setFormState(prev => ({
                    ...prev,
                    durationMinutes: classDef.defaultDurationMinutes || 45,
                    hasWaitlist: classDef.hasWaitlist ?? true
                }));
            }
        }
    }, [formState.groupClassId, classDefinitions, scheduleToEdit]);

    const handleDayToggle = (day: number) => {
        setFormState(prev => {
            const newDays = prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...prev.daysOfWeek, day];
            return { ...prev, daysOfWeek: newDays.sort() };
        });
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formState.locationId) newErrors.locationId = 'Ort måste väljas.';
        if (!formState.groupClassId) newErrors.groupClassId = 'Pass måste väljas.';
        if (!formState.coachId) newErrors.coachId = 'Coach måste väljas.';
        if (!formState.daysOfWeek || formState.daysOfWeek.length === 0) newErrors.daysOfWeek = 'Välj minst en dag.';
        if (!formState.startTime) newErrors.time = 'Tid måste anges.';
        if (!formState.durationMinutes || Number(formState.durationMinutes) <= 0) newErrors.duration = 'Längd måste vara större än 0.';
        if (!formState.maxParticipants || Number(formState.maxParticipants) <= 0) newErrors.maxParticipants = 'Max deltagare måste vara större än 0.';
        if (!formState.startDate || !formState.endDate) newErrors.date = 'Start- och slutdatum måste anges.';
        else if (formState.startDate > formState.endDate) newErrors.date = 'Slutdatum kan inte vara före startdatum.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = (shouldClose: boolean) => {
        if (!validate()) return;

        setSaveAndCopySuccess(null);
        
        const scheduleData: GroupClassSchedule = {
            id: scheduleToEdit ? scheduleToEdit.id : crypto.randomUUID(),
            locationId: formState.locationId!,
            groupClassId: formState.groupClassId!,
            coachId: formState.coachId!,
            daysOfWeek: formState.daysOfWeek!,
            startTime: formState.startTime!,
            startDate: formState.startDate!,
            endDate: formState.endDate!,
            durationMinutes: Number(formState.durationMinutes),
            maxParticipants: Number(formState.maxParticipants),
            hasWaitlist: formState.hasWaitlist ?? false,
        };
        
        onSave(scheduleData);

        if (shouldClose) {
            onClose();
        } else {
            // "Save and Copy" logic: Reset form for a new entry
            const savedStartTime = formState.startTime;
            resetForm();
            setSaveAndCopySuccess(`Passet kl ${savedStartTime} sparat!`);
            setTimeout(() => setSaveAndCopySuccess(null), 2500);
        }
    };

    const locationOptions = locations.map(l => ({ value: l.id, label: l.name }));
    const classOptions = classDefinitions.map(c => ({ value: c.id, label: c.name }));
    const coachOptions = coaches.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={scheduleToEdit ? 'Redigera Gruppass-schema' : 'Lägg ut Gruppass'} size="2xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select label="Ort *" value={formState.locationId} onChange={e => handleInputChange('locationId', e.target.value)} options={locationOptions} error={errors.locationId} />
                    <Select label="Typ av pass *" value={formState.groupClassId} onChange={e => handleInputChange('groupClassId', e.target.value)} options={classOptions} error={errors.groupClassId} />
                </div>
                
                <div>
                    <label className="block text-xl font-medium text-gray-700 mb-1">Veckodag(ar) *</label>
                    <DayOfWeekSelector selectedDays={formState.daysOfWeek || []} onToggleDay={handleDayToggle} />
                    {errors.daysOfWeek && <p className="mt-1 text-sm text-red-600">{errors.daysOfWeek}</p>}
                </div>
                
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input label="Tid *" type="time" value={formState.startTime} onChange={e => handleInputChange('startTime', e.target.value)} error={errors.time} />
                    <Input label="Längd (min) *" type="number" value={String(formState.durationMinutes)} onChange={e => handleInputChange('durationMinutes', e.target.value)} error={errors.duration} />
                    <Input label="Max deltagare *" type="number" value={String(formState.maxParticipants)} onChange={e => handleInputChange('maxParticipants', e.target.value)} error={errors.maxParticipants} />
                </div>

                <Select label="Coach *" value={formState.coachId} onChange={e => handleInputChange('coachId', e.target.value)} options={coachOptions} error={errors.coachId} />
                
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Från vecka (startdatum) *" type="date" value={formState.startDate} onChange={e => handleInputChange('startDate', e.target.value)} error={errors.date} />
                    <Input label="Till vecka (slutdatum) *" type="date" value={formState.endDate} onChange={e => handleInputChange('endDate', e.target.value)} />
                </div>

                <div className="pt-4 border-t">
                    <ToggleSwitch
                        id="hasWaitlist"
                        label="Aktivera kölista"
                        description="Tillåt medlemmar att köa om passet är fullt."
                        checked={formState.hasWaitlist ?? false}
                        onChange={(val) => handleInputChange('hasWaitlist', val)}
                    />
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                    <div>
                        {saveAndCopySuccess && <p className="text-green-600 font-semibold animate-fade-in-down">{saveAndCopySuccess}</p>}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={onClose} variant="secondary">Avbryt</Button>
                        {!scheduleToEdit && <Button onClick={() => handleSave(false)} variant="outline">Spara & Kopiera</Button>}
                        <Button onClick={() => handleSave(true)} variant="primary">{scheduleToEdit ? 'Spara Ändringar' : 'Spara & Stäng'}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};