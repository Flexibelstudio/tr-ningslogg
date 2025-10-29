import React, { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantProfile, ParticipantBooking } from '../../types';
import { Select } from '../Input';
import { ConfirmationModal } from '../ConfirmationModal';

interface EnrichedClassInstance {
    instanceId: string;
    date: string;
    startDateTime: Date;
    scheduleId: string;
    className: string;
    coachName: string;
    maxParticipants: number;
    allBookingsForInstance: ParticipantBooking[];
}

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInstance: EnrichedClassInstance;
  participants: ParticipantProfile[];
  onCheckIn: (bookingId: string) => void;
  onUnCheckIn: (bookingId: string) => void;
  onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
  onCancelBooking: (bookingId: string) => void;
  onPromoteFromWaitlist: (bookingId: string) => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({ 
    isOpen, onClose, classInstance, participants, onCheckIn, onUnCheckIn, onBookClass, onCancelBooking, onPromoteFromWaitlist 
}) => {
    const [participantToAdd, setParticipantToAdd] = useState('');
    const [bookingToCancel, setBookingToCancel] = useState<ParticipantBooking | null>(null);

    const { booked, waitlisted, availableSpots, checkedInCount } = useMemo(() => {
        const b = classInstance.allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
        const w = classInstance.allBookingsForInstance.filter(b => b.status === 'WAITLISTED').sort((a,b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
        const spots = classInstance.maxParticipants - b.length;
        const checkedIn = b.filter(booking => booking.status === 'CHECKED-IN').length;
        return { booked: b, waitlisted: w, availableSpots: spots, checkedInCount: checkedIn };
    }, [classInstance]);

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

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="2xl">
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-md border text-base">
                        <p><strong>Datum & Tid:</strong> {formattedStartTime}</p>
                        <p><strong>Coach:</strong> {classInstance.coachName}</p>
                        <p><strong>Status:</strong> {booked.length} / {classInstance.maxParticipants} bokade ({availableSpots} lediga, {checkedInCount} incheckade)</p>
                        {waitlisted.length > 0 && <p><strong>Kölista:</strong> {waitlisted.length} pers.</p>}
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
                </div>
            </Modal>
            
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