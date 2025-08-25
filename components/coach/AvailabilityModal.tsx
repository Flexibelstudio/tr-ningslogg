import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input, Select } from '../Input';
import { Button } from '../Button';
import { StaffMember, StaffAvailability } from '../../types';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (availability: StaffAvailability) => void;
  onDelete: (id: string) => void;
  staffMember: StaffMember;
  availabilityToEdit: StaffAvailability | null;
  initialTime: { date: Date, hour: number } | null;
}

const WEEK_DAYS = [
    { label: 'Mån', value: 1 }, { label: 'Tis', value: 2 }, { label: 'Ons', value: 3 },
    { label: 'Tor', value: 4 }, { label: 'Fre', value: 5 }, { label: 'Lör', value: 6 },
    { label: 'Sön', value: 7 },
];

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ isOpen, onClose, onSave, onDelete, staffMember, availabilityToEdit, initialTime }) => {
  const [type, setType] = useState<'available' | 'unavailable'>('available');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (isOpen) {
        if (availabilityToEdit) {
            const start = new Date(availabilityToEdit.startTime);
            const end = new Date(availabilityToEdit.endTime);

            setType(availabilityToEdit.type);
            
            // Correctly format local date to prevent timezone shift issues
            const year = start.getFullYear();
            const month = String(start.getMonth() + 1).padStart(2, '0');
            const day = String(start.getDate()).padStart(2, '0');
            setDate(`${year}-${month}-${day}`);

            setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
            setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
            setIsRecurring(availabilityToEdit.isRecurring || false);
            setDaysOfWeek(availabilityToEdit.recurringDetails?.daysOfWeek || []);
            setRecurringEndDate(availabilityToEdit.recurringDetails?.recurringEndDate ? new Date(availabilityToEdit.recurringDetails.recurringEndDate).toISOString().split('T')[0] : '');
        } else if (initialTime) {
            const year = initialTime.date.getFullYear();
            const month = String(initialTime.date.getMonth() + 1).padStart(2, '0');
            const day = String(initialTime.date.getDate()).padStart(2, '0');
            
            setType('available');
            setDate(`${year}-${month}-${day}`);
            setStartTime(`${String(initialTime.hour).padStart(2, '0')}:00`);
            setEndTime(`${String(initialTime.hour + 1).padStart(2, '0')}:00`);
            setIsRecurring(false);
            setDaysOfWeek([]);
            setRecurringEndDate('');
        }
        setErrors({});
    }
  }, [isOpen, availabilityToEdit, initialTime]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!startTime || !endTime) newErrors.time = "Start- och sluttid måste anges.";
    else if (startTime >= endTime) newErrors.time = "Sluttiden måste vara efter starttiden.";
    
    if (!isRecurring && !date) {
        newErrors.date = "Datum måste anges för en enskild händelse.";
    }
    if (isRecurring && daysOfWeek.length === 0) {
        newErrors.daysOfWeek = "Välj minst en veckodag för ett återkommande schema.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDayToggle = (dayValue: number) => {
    setDaysOfWeek(prev => 
        prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]
    );
  };
  
  const handleSave = () => {
    if (!validate()) return;

    const today = new Date();
    const localDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const referenceDate = date || localDateString;
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const [year, month, day] = referenceDate.split('-').map(Number);
    
    const startLocal = new Date(year, month - 1, day, startH, startM);
    const endLocal = new Date(year, month - 1, day, endH, endM);

    const saveData: Omit<StaffAvailability, 'recurringDetails'> & { recurringDetails?: StaffAvailability['recurringDetails'] } = {
        id: availabilityToEdit?.id || crypto.randomUUID(),
        staffId: staffMember.id,
        startTime: startLocal.toISOString(),
        endTime: endLocal.toISOString(),
        type,
        isRecurring,
    };

    if (isRecurring) {
        saveData.recurringDetails = {
            daysOfWeek: daysOfWeek.sort(),
        };
        if (recurringEndDate) {
            saveData.recurringDetails.recurringEndDate = new Date(`${recurringEndDate}T23:59:59`).toISOString();
        }
    }

    onSave(saveData as StaffAvailability);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={availabilityToEdit ? 'Redigera tid' : 'Lägg till tid'}>
      <div className="space-y-4">
        <div>
            <label className="block text-base font-medium text-gray-700 mb-2">Typ av tid</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <Button fullWidth variant={type === 'available' ? 'primary' : 'ghost'} onClick={() => setType('available')}>Tillgänglig (Arbetstid)</Button>
                <Button fullWidth variant={type === 'unavailable' ? 'danger' : 'ghost'} onClick={() => setType('unavailable')}>Ej tillgänglig</Button>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <Input label="Starttid *" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} error={errors.time} />
            <Input label="Sluttid *" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        
        <label className="flex items-center space-x-2 pt-2 cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-5 w-5 text-flexibel" />
            <span className="text-gray-700 font-medium">Upprepa detta schema</span>
        </label>

        {isRecurring ? (
            <div className="space-y-3 p-3 bg-gray-50 rounded-md border animate-fade-in-down">
                <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">Dagar *</label>
                    <div className="flex justify-center gap-1">
                        {WEEK_DAYS.map(day => (
                            <Button
                                key={day.value}
                                type="button"
                                onClick={() => handleDayToggle(day.value)}
                                variant={daysOfWeek.includes(day.value) ? 'primary' : 'outline'}
                                className="!px-3 !py-2 !text-xs sm:!text-sm"
                            >
                                {day.label}
                            </Button>
                        ))}
                    </div>
                    {errors.daysOfWeek && <p className="text-sm text-red-500 mt-1">{errors.daysOfWeek}</p>}
                </div>
                <Input label="Upprepas till (valfritt)" type="date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} />
            </div>
        ) : (
             <Input label="Datum *" type="date" value={date} onChange={e => setDate(e.target.value)} error={errors.date} />
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div>
            {availabilityToEdit && <Button onClick={() => onDelete(availabilityToEdit.id)} variant="danger">Ta bort</Button>}
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="secondary">Avbryt</Button>
            <Button onClick={handleSave} variant="primary">Spara</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};