
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../../components/Modal';
import { Input, Select } from '../../../components/Input';
import { Textarea } from '../../../components/Textarea';
import { Button } from '../../../components/Button';
import { ParticipantProfile, StaffMember, OneOnOneSession, StaffAvailability } from '../../../types';
import { ONE_ON_ONE_SESSION_TYPES } from '../../../constants';
import { addDays } from '../../../utils/dateUtils';
import { ConfirmationModal } from '../../../components/ConfirmationModal';

interface BookOneOnOneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: OneOnOneSession) => void;
  participants: ParticipantProfile[];
  coaches: StaffMember[];
  preselectedParticipant?: ParticipantProfile | null;
  loggedInCoachId: string;
  sessionToEdit?: OneOnOneSession | null;
  initialDate?: string | null;
  staffAvailability: StaffAvailability[];
}

export const BookOneOnOneModal: React.FC<BookOneOnOneModalProps> = ({
  isOpen,
  onClose,
  onSave,
  participants,
  coaches,
  preselectedParticipant,
  loggedInCoachId,
  sessionToEdit,
  initialDate,
  staffAvailability,
}) => {
  const [participantId, setParticipantId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [sessionTypeId, setSessionTypeId] = useState(ONE_ON_ONE_SESSION_TYPES[0].id);
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [sessionToConfirm, setSessionToConfirm] = useState<OneOnOneSession | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (sessionToEdit) {
        const sessionType = ONE_ON_ONE_SESSION_TYPES.find(s => s.title === sessionToEdit.title);
        setParticipantId(sessionToEdit.participantId);
        setCoachId(sessionToEdit.coachId);
        setSessionTypeId(sessionType?.id || ONE_ON_ONE_SESSION_TYPES[0].id);
        setPurpose(sessionToEdit.purpose);
        const startDateTime = new Date(sessionToEdit.startTime);
        setDate(startDateTime.toISOString().split('T')[0]);
        setStartTime(startDateTime.toTimeString().substring(0, 5));
      } else {
        setParticipantId(preselectedParticipant?.id || '');
        const firstCoachId = coaches.filter(c => c.isActive)[0]?.id || '';
        setCoachId(loggedInCoachId === 'system-owner' ? firstCoachId : loggedInCoachId);
        setSessionTypeId(ONE_ON_ONE_SESSION_TYPES[0].id);
        setPurpose(ONE_ON_ONE_SESSION_TYPES.find(s => s.id === ONE_ON_ONE_SESSION_TYPES[0].id)?.description || '');
        setDate(initialDate || '');
        setStartTime('');
      }
      setErrors({});
      setIsConflictModalOpen(false);
      setSessionToConfirm(null);
    }
  }, [isOpen, preselectedParticipant, loggedInCoachId, sessionToEdit, initialDate, coaches]);

  useEffect(() => {
    // Only auto-update purpose if not editing, to avoid overwriting custom text
    if (!sessionToEdit) {
        const sessionType = ONE_ON_ONE_SESSION_TYPES.find(s => s.id === sessionTypeId);
        if (sessionType) {
            setPurpose(sessionType.description);
        }
    }
  }, [sessionTypeId, sessionToEdit]);

  const participantOptions = useMemo(() => 
    [{ value: '', label: 'Välj en medlem...' }, ...participants
        .filter(p => p.isActive)
        .map(p => ({ value: p.id, label: p.name || 'Okänd' }))], 
    [participants]);
    
  const coachOptions = useMemo(() => 
    coaches.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name })), 
    [coaches]);

  const sessionTypeOptions = useMemo(() => 
    ONE_ON_ONE_SESSION_TYPES.map(s => ({ value: s.id, label: s.title })), 
    []);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!participantId) newErrors.participantId = 'Du måste välja en medlem.';
    if (!coachId) newErrors.coachId = 'Du måste välja en coach.';
    if (!date) newErrors.date = 'Datum är obligatoriskt.';
    else if (new Date(date) < addDays(new Date(), -1) && !sessionToEdit) {
      // Allow editing past events, but not creating new ones in the past
      newErrors.date = 'Datum kan inte vara i det förflutna.';
    }
    if (!startTime) newErrors.startTime = 'Starttid är obligatoriskt.';
    if (!purpose.trim()) newErrors.purpose = 'Syfte är obligatoriskt.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkCoachAvailability = (session: OneOnOneSession): boolean => {
    const coachAvailabilities = staffAvailability.filter(a => a.staffId === session.coachId);
    if (coachAvailabilities.length === 0) {
      return true; // No schedule set, assume available
    }

    const sessionStart = new Date(session.startTime);
    const sessionEnd = new Date(session.endTime);
    const sessionDayOfWeek = sessionStart.getDay() === 0 ? 7 : sessionStart.getDay();
    const sessionStartTimeInMinutes = sessionStart.getHours() * 60 + sessionStart.getMinutes();
    const sessionEndTimeInMinutes = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
    
    let isAvailable = false;

    for (const rule of coachAvailabilities) {
        const ruleStartDate = new Date(rule.startTime);
        let appliesToDay = false;

        if (rule.isRecurring && rule.recurringDetails) {
            const recurrenceStart = new Date(rule.startTime);
            recurrenceStart.setHours(0,0,0,0);
            const recurrenceEnd = rule.recurringDetails.recurringEndDate ? new Date(rule.recurringDetails.recurringEndDate) : null;
            if (recurrenceEnd) recurrenceEnd.setHours(23,59,59,999);

            if (
                rule.recurringDetails.daysOfWeek.includes(sessionDayOfWeek) &&
                sessionStart >= recurrenceStart &&
                (!recurrenceEnd || sessionStart <= recurrenceEnd)
            ) {
                appliesToDay = true;
            }
        } else {
            if (ruleStartDate.toDateString() === sessionStart.toDateString()) {
                appliesToDay = true;
            }
        }
        
        if (appliesToDay) {
            const ruleStartTime = new Date(rule.startTime);
            const ruleEndTime = new Date(rule.endTime);
            const ruleStartMinutes = ruleStartTime.getHours() * 60 + ruleStartTime.getMinutes();
            const ruleEndMinutes = ruleEndTime.getHours() * 60 + ruleEndTime.getMinutes();

            if (rule.type === 'unavailable') {
                if (sessionStartTimeInMinutes < ruleEndMinutes && sessionEndTimeInMinutes > ruleStartMinutes) {
                    return false; // Overlaps with unavailable time
                }
            } else if (rule.type === 'available') {
                if (sessionStartTimeInMinutes >= ruleStartMinutes && sessionEndTimeInMinutes <= ruleEndMinutes) {
                    isAvailable = true; // Found an available slot that contains the session
                }
            }
        }
    }
    
    // If we found an available slot and it wasn't overridden by an unavailable one, return true.
    // If no available slots were found for that day, isAvailable will be false.
    return isAvailable;
  };
  
  const handleAttemptSave = () => {
    if (!validate()) return;
    
    const sessionType = ONE_ON_ONE_SESSION_TYPES.find(s => s.id === sessionTypeId);
    if (!sessionType) return;

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + sessionType.durationMinutes * 60000);

    const sessionData: OneOnOneSession = {
      id: sessionToEdit?.id || crypto.randomUUID(),
      participantId,
      coachId,
      title: sessionType.title,
      purpose: purpose.trim(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      status: sessionToEdit?.status || 'scheduled',
      comments: sessionToEdit?.comments || [],
    };
    
    if (checkCoachAvailability(sessionData)) {
        onSave(sessionData);
        onClose();
    } else {
        setSessionToConfirm(sessionData);
        setIsConflictModalOpen(true);
    }
  };

  const handleConfirmSave = () => {
    if (sessionToConfirm) {
        onSave(sessionToConfirm);
    }
    onClose();
  };
  
  const modalTitle = sessionToEdit ? "Redigera 1-on-1 Session" : "Boka 1-on-1 Session";
  
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
        <div className="space-y-4">
          {!preselectedParticipant && (
              <Select 
                  label="Medlem *"
                  value={participantId}
                  onChange={e => setParticipantId(e.target.value)}
                  options={participantOptions}
                  error={errors.participantId}
              />
          )}
          <Select 
              label="Coach *"
              value={coachId}
              onChange={e => setCoachId(e.target.value)}
              options={coachOptions}
              error={errors.coachId}
          />
          <Select 
              label="Typ av session *"
              value={sessionTypeId}
              onChange={e => setSessionTypeId(e.target.value)}
              options={sessionTypeOptions}
          />
          <div className="grid grid-cols-2 gap-4">
              <Input 
                  label="Datum *"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  error={errors.date}
                  min={!sessionToEdit ? new Date().toISOString().split('T')[0] : undefined}
              />
              <Input 
                  label="Starttid *"
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  error={errors.startTime}
              />
          </div>
          <Textarea 
              label="Syfte *"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={3}
              error={errors.purpose}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button onClick={onClose} variant="secondary">Avbryt</Button>
            <Button onClick={handleAttemptSave}>{sessionToEdit ? 'Spara Ändringar' : 'Boka Session'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
          isOpen={isConflictModalOpen}
          onClose={() => setIsConflictModalOpen(false)}
          onConfirm={handleConfirmSave}
          title="Tid utanför arbetstid"
          message={`Tiden ligger utanför coachens schemalagda arbetstid. Vill du boka den ändå?`}
          confirmButtonText="Ja, boka ändå"
          confirmButtonVariant="primary"
          cancelButtonText="Avbryt"
      />
    </>
  );
};
