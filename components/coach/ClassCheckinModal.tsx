import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantProfile, ParticipantBooking, StaffMember } from '../../types';

interface EnrichedClassInstance {
    instanceId: string;
    date: string;
    startDateTime: Date;
    scheduleId: string;
    className: string;
    coachId: string;
    locationId: string;
    duration: number;
    coachName: string;
    maxParticipants: number;
    bookedCount: number;
    waitlistCount: number;
    isFull: boolean;
    allBookingsForInstance: ParticipantBooking[];
}

interface ClassCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  classInstance: EnrichedClassInstance;
  participants: ParticipantProfile[];
  onCheckIn: (bookingId: string) => void;
}

export const ClassCheckinModal: React.FC<ClassCheckinModalProps> = ({ isOpen, onClose, classInstance, participants, onCheckIn }) => {
    if (!isOpen) return null;

    const booked = classInstance.allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
    const waitlisted = classInstance.allBookingsForInstance.filter(b => b.status === 'WAITLISTED');

    const modalTitle = `Incheckning: ${classInstance.className}`;
    const formattedStartTime = classInstance.startDateTime.toLocaleString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
            <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-md border text-base">
                    <p><strong>Datum & Tid:</strong> {formattedStartTime}</p>
                    <p><strong>Coach:</strong> {classInstance.coachName}</p>
                    <p><strong>Bokade:</strong> {classInstance.bookedCount} / {classInstance.maxParticipants}</p>
                    {classInstance.waitlistCount > 0 && <p><strong>Kölista:</strong> {classInstance.waitlistCount} pers.</p>}
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Bokade deltagare</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {booked.length > 0 ? booked.map(booking => {
                            const participant = participants.find(p => p.id === booking.participantId);
                            return (
                                <div key={booking.id} className="flex items-center justify-between p-2 bg-white rounded-md border">
                                    <span className="font-medium text-gray-800">{participant?.name || 'Okänd Medlem'}</span>
                                    {booking.status === 'CHECKED-IN' ? (
                                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Incheckad ✅</span>
                                    ) : (
                                        <Button size="sm" onClick={() => onCheckIn(booking.id)}>Checka in</Button>
                                    )}
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
                                        {/* Future: Add button to move to booked if space is available */}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};