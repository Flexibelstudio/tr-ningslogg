
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { ParticipantProfile, ParticipantBooking, GroupClassScheduleException, StaffMember } from '../../../types';
import { Select, Input } from '../../../components/Input';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { useAppContext } from '../../../context/AppContext';

interface EnrichedClassInstance {
    instanceId: string;
    date: string;
    startDateTime: Date;
    scheduleId: string;
    className: string;
    coachName: string;
    coachId: string;
    duration: number;
    maxParticipants: number;
    allBookingsForInstance: ParticipantBooking[];
}

interface EditedDetails {
    date: string;
    startTime: string;
    durationMinutes: number | string;
    maxParticipants: number | string;
    coachId: string;
}

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInstance: EnrichedClassInstance;
  participants: ParticipantProfile[];
  groupClassScheduleExceptions: GroupClassScheduleException[];
  onCheckIn: (bookingId: string) => void;
  onUnCheckIn: (bookingId: string) => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onPromoteFromWaitlist: (bookingId: string) => void;
  onCancelClassInstance: (scheduleId: string, classDate: string, status: 'CANCELLED' | 'DELETED') => void;
  onUpdateClassInstance: (scheduleId: string, classDate: string, updates: Partial<EditedDetails & { newStartTime?: string, newDurationMinutes?: number, newMaxParticipants?: number, newCoachId?: string }>, notify: boolean) => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({ 
    isOpen, onClose, classInstance, participants, groupClassScheduleExceptions, onCheckIn, onUnCheckIn, onBookClass, onCancelBooking, onPromoteFromWaitlist, onCancelClassInstance, onUpdateClassInstance
}) => {
    const { staffMembers } = useAppContext();
    const [participantToAdd, setParticipantToAdd] = useState('');
    const [bookingToCancel, setBookingToCancel] = useState<ParticipantBooking | null>(null);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState<EditedDetails>({ date: '', startTime: '', durationMinutes: '', maxParticipants: '', coachId: '' });
    const [initialDetails, setInitialDetails] = useState<EditedDetails>({ date: '', startTime: '', durationMinutes: '', maxParticipants: '', coachId: '' });
    
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const details = {
                date: classInstance.date,
                startTime: classInstance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':'),
                durationMinutes: classInstance.duration,
                maxParticipants: classInstance.maxParticipants,
                coachId: classInstance.coachId,
            };
            setIsEditing(false);
            setEditedDetails(details);
            setInitialDetails(details);
        }
    }, [isOpen, classInstance]);
    
    const hasChanges = useMemo(() => JSON.stringify(editedDetails) !== JSON.stringify(initialDetails), [editedDetails, initialDetails]);

    const { booked, waitlisted, availableSpots, checkedInCount } = useMemo(() => {
        const b = classInstance.allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
        const w = classInstance.allBookingsForInstance.filter(b => b.status === 'WAITLISTED').sort((a,b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
        const spots = classInstance.maxParticipants - b.length;
        const checkedIn = b.filter(booking => booking.status === 'CHECKED-IN').length;
        return { booked: b, waitlisted: w, availableSpots: spots, checkedInCount: checkedIn };
    }, [classInstance]);
    
    const isCancelledOrDeleted = useMemo(() => {
        const exception = groupClassScheduleExceptions.find(ex => ex.scheduleId === classInstance.scheduleId && ex.date === classInstance.date);
        return exception && (exception.status === 'CANCELLED' || exception.status === 'DELETED');
    }, [groupClassScheduleExceptions, classInstance]);

    const isPast = useMemo(() => classInstance.startDateTime < new Date(), [classInstance.startDateTime]);

    const handleConfirmCancellation = (status: 'CANCELLED' | 'DELETED') => {
        onCancelClassInstance(classInstance.scheduleId, classInstance.date, status);
        setShowCancelConfirm(false);
        setShowDeleteConfirm(false);
        onClose();
    };

    const handleInputChange = (field: keyof EditedDetails, value: string | number) => {
        setEditedDetails(prev => ({...prev, [field]: value}));
    };

    const handleAttemptSave = () => {
        setShowSaveConfirm(true);
    };

    const handleSave = (notify: boolean) => {
        const updates = {
            ...editedDetails,
            newStartTime: editedDetails.startTime,
            newDurationMinutes: Number(editedDetails.durationMinutes),
            newMaxParticipants: Number(editedDetails.maxParticipants),
            newCoachId: editedDetails.coachId,
        };
        onUpdateClassInstance(classInstance.scheduleId, classInstance.date, updates, notify);
        setShowSaveConfirm(false);
        setIsEditing(false);
        // After saving, the new state is the initial state
        setInitialDetails(editedDetails); 
    };
    
    const handleCloseRequest = () => {
        if (isEditing && hasChanges) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };
    
    const handleCancelEditing = () => {
        setIsEditing(false);
        setEditedDetails(initialDetails);
    }

    const availableParticipantsForDropdown = useMemo(() => {
        const currentlyInClassIds = new Set(classInstance.allBookingsForInstance.map(b => b.participantId));
        return participants
            .filter(p => p.isActive && !currentlyInClassIds.has(p.id))
            .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [participants, classInstance]);

    const handleAddParticipant = () => {
        if (!participantToAdd) return;
        onBookClass(participantToAdd, classInstance.scheduleId, classInstance.date);
        setParticipantToAdd('');
    };
    
    const modalTitle = `Hantera: ${classInstance.className}`;
    const formattedStartTime = classInstance.startDateTime.toLocaleString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const coachOptions = useMemo(() => staffMembers.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name })), [staffMembers]);

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleCloseRequest} title={modalTitle} size="2xl">
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-md border text-base">
                        {!isEditing ? (
                            <div className="flex justify-between items-start">
                                <div>
                                    <p><strong>Datum & Tid:</strong> {formattedStartTime}</p>
                                    <p><strong>Coach:</strong> {classInstance.coachName}</p>
                                    <p><strong>Status:</strong> {booked.length} / {classInstance.maxParticipants} bokade ({availableSpots} lediga, {checkedInCount} incheckade)</p>
                                    {waitlisted.length > 0 && <p><strong>Kölista:</strong> {waitlisted.length} pers.</p>}
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Redigera pass</Button>
                            </div>
                        ) : (
                            <div className="space-y-3 animate-fade-in">
                                <h4 className="font-semibold text-lg">Redigera passinformation</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input type="date" label="Datum" value={editedDetails.date} onChange={(e) => handleInputChange('date', e.target.value)} />
                                    <Input type="time" label="Tid" value={editedDetails.startTime} onChange={(e) => handleInputChange('startTime', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input type="number" label="Längd (min)" value={String(editedDetails.durationMinutes)} onChange={(e) => handleInputChange('durationMinutes', e.target.value)} />
                                    <Input type="number" label="Platser" value={String(editedDetails.maxParticipants)} onChange={(e) => handleInputChange('maxParticipants', e.target.value)} />
                                </div>
                                <Select label="Coach" value={editedDetails.coachId} onChange={(e) => handleInputChange('coachId', e.target.value)} options={coachOptions} />
                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <Button variant="secondary" onClick={handleCancelEditing}>Avbryt</Button>
                                    <Button onClick={handleAttemptSave} disabled={!hasChanges}>Spara ändringar</Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Bokade deltagare</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {booked.length > 0 ? booked.map(booking => {
                                const participant = participants.find(p => p.id === booking.participantId);
                                return (
                                    <div key={booking.id} className="flex items-center justify-between p-2 bg-white rounded-md border">
                                        <span className="font-medium text-gray-800">{participant?.name || 'Okänd Medlem'}</span>
                                        <div className="flex items-center gap-2">
                                            {booking.status === 'CHECKED-IN' ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => onUnCheckIn(booking.id)} 
                                                    className="!bg-green-100 !text-green-800 hover:!bg-green-200 ring-1 ring-green-200 !py-1 !px-3 font-semibold"
                                                    aria-label={`Bocka ur ${participant?.name || 'deltagare'}`}
                                                >
                                                    Incheckad ✅
                                                </Button>
                                            ) : (
                                                <Button size="sm" onClick={() => onCheckIn(booking.id)}>Checka in</Button>
                                            )}
                                            <Button size="sm" variant="danger" onClick={() => setBookingToCancel(booking)}>Ta bort</Button>
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-gray-500 italic p-2">Inga deltagare bokade.</p>}
                        </div>
                    </div>
                    
                    {waitlisted.length > 0 && (
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Kölista</h3>
                             <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {waitlisted.map((booking, index) => {
                                    const participant = participants.find(p => p.id === booking.participantId);
                                    return (
                                        <div key={booking.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-md border">
                                            <span className="font-medium text-gray-800">{index + 1}. {participant?.name || 'Okänd Medlem'}</span>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="primary" onClick={() => onPromoteFromWaitlist(booking.id)} disabled={availableSpots <= 0}>Flytta till bokad</Button>
                                                <Button size="sm" variant="danger" onClick={() => setBookingToCancel(booking)}>Ta bort</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div className="pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Lägg till deltagare manuellt</h3>
                        <div className="flex items-end gap-2">
                            <Select 
                                label="Välj medlem"
                                value={participantToAdd}
                                onChange={(e) => setParticipantToAdd(e.target.value)}
                                options={[{ value: '', label: 'Välj...' }, ...availableParticipantsForDropdown]}
                                inputSize="sm"
                                containerClassName="flex-grow"
                            />
                            <Button onClick={handleAddParticipant} disabled={!participantToAdd} size="sm">Lägg till</Button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-red-200">
                        <h3 className="text-lg font-semibold text-red-700 mb-2">Administrera pass</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                variant="danger"
                                onClick={() => setShowCancelConfirm(true)}
                                disabled={isPast || isCancelledOrDeleted}
                                className="flex-1"
                                title={isPast ? "Kan inte ställa in ett pass som redan har varit" : (isCancelledOrDeleted ? "Detta pass är redan hanterat" : "Ställ in detta pass")}
                            >
                                {isCancelledOrDeleted ? 'Passet är Inställt' : 'Ställ in detta pass'}
                            </Button>
                             <Button
                                variant="secondary"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isPast || isCancelledOrDeleted}
                                className="flex-1 !bg-slate-100 !text-slate-700 border-slate-300 hover:!bg-slate-200"
                                title={isPast ? "Kan inte ta bort ett pass som redan har varit" : (isCancelledOrDeleted ? "Detta pass är redan hanterat" : "Ta bort detta enskilda pass från kalendern")}
                            >
                                Ta bort enskilt pass (tyst)
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>
            
            <ConfirmationModal
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => handleConfirmCancellation('CANCELLED')}
                title="Ställ in pass?"
                message={`Är du säker på att du vill ställa in ${classInstance.className}? Alla ${booked.length} bokade medlemmar och ${waitlisted.length} på kölistan kommer att meddelas. Passet kommer visas som överstruket i kalendern.`}
                confirmButtonText="Ja, ställ in passet"
                confirmButtonVariant="danger"
            />

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={() => handleConfirmCancellation('DELETED')}
                title="Ta bort passet tyst?"
                message={`Är du säker? Passet tas bort från kalendern utan att meddela deltagare. Detta är för administrativa korrigeringar och kan inte ångras.`}
                confirmButtonText="Ja, ta bort tyst"
                confirmButtonVariant="danger"
            />
            
            <ConfirmationModal
                isOpen={showSaveConfirm}
                onClose={() => setShowSaveConfirm(false)}
                title="Meddela deltagare om ändringen?"
                message="Vill du skicka en notis till alla bokade deltagare och de på kölistan om ändringarna du har gjort?"
                confirmButtonText="Spara och Meddela"
                cancelButtonText="Spara utan att Meddela"
            >
                <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200">
                    <Button onClick={() => { handleSave(false); setShowSaveConfirm(false); }} variant="secondary">
                        Spara utan att Meddela
                    </Button>
                    <Button onClick={() => { handleSave(true); setShowSaveConfirm(false); }} variant="primary">
                        Spara och Meddela
                    </Button>
                </div>
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={onClose}
                title="Stänga utan att spara?"
                message="Du har osparade ändringar. Är du säker på att du vill stänga? Dina ändringar kommer att förkastas."
                confirmButtonText="Ja, stäng"
            />

            <ConfirmationModal
                isOpen={!!bookingToCancel}
                onClose={() => setBookingToCancel(null)}
                onConfirm={() => {
                    if (bookingToCancel) onCancelBooking(bookingToCancel.id);
                    setBookingToCancel(null);
                }}
                title="Bekräfta borttagning"
                message={`Är du säker på att du vill ta bort ${participants.find(p => p.id === bookingToCancel?.participantId)?.name || 'denna deltagare'} från passet? Detta kan inte ångras.`}
                confirmButtonText="Ja, ta bort"
            />
        </>
    );
};

