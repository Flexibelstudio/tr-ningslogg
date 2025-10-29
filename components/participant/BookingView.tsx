import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { GroupClassSchedule, GroupClassDefinition, ParticipantBooking, StaffMember, ParticipantProfile, IntegrationSettings, BookingStatus, Membership } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { ConfirmationModal } from '../ConfirmationModal';
import { useAppContext } from '../../context/AppContext';

interface EnrichedClassInstance {
    instanceId: string;
    date: string; // YYYY-MM-DD
    startDateTime: Date;
    scheduleId: string;
    className: string;
    duration: number;
    coachName: string;
    maxParticipants: number;
    bookedCount: number;
    waitlistCount: number;
    isBookedByMe: boolean;
    isWaitlistedByMe: boolean;
    myWaitlistPosition: number;
    bookingId?: string;
    isFull: boolean;
    cancellationCutoffHours: number;
    myBookingStatus?: BookingStatus;
    isRestricted: boolean;
    hasWaitlist: boolean;
    color: string;
}

interface BookingViewProps {
    isOpen: boolean;
    onClose: () => void;
    schedules: GroupClassSchedule[];
    definitions: GroupClassDefinition[];
    bookings: ParticipantBooking[];
    staff: StaffMember[];
    onBookClass: (participantId: string, scheduleId: string, classDate: string) => void;
    onCancelBooking: (bookingId: string) => void;
    currentParticipantId: string;
    participantProfile: ParticipantProfile | null;
    integrationSettings: IntegrationSettings;
    membership: Membership | null | undefined;
    onOpenUpgradeModal: () => void;
}

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H3a2 2 0 01-2-2v-5a2 2 0 012-2zm5-2a3 3 0 00-3 3v2h6V7a3 3 0 00-3-3z" clipRule="evenodd" />
    </svg>
);


export const BookingView: React.FC<BookingViewProps> = ({ isOpen, onClose, schedules, definitions, bookings, staff, onBookClass, onCancelBooking, currentParticipantId, participantProfile, integrationSettings, membership, onOpenUpgradeModal }) => {
    const { getColorForCategory } = useAppContext();
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    const [selectedDate, setSelectedDate] = useState(today);
    const listRef = useRef<HTMLDivElement>(null);
    const [bookingToCancel, setBookingToCancel] = useState<EnrichedClassInstance | null>(null);

    const enrichedInstances = useMemo(() => {
        const instances: EnrichedClassInstance[] = [];
        if (!participantProfile?.locationId) return [];

        const memberLocationId = participantProfile.locationId;
        
        // Filter out schedules that have already ended entirely.
        const relevantSchedules = schedules.filter(s => {
            if (s.locationId !== memberLocationId) return false;
            // Parse endDate as local time to avoid timezone issues.
            const [endYear, endMonth, endDay] = s.endDate.split('-').map(Number);
            const endDate = new Date(endYear, endMonth - 1, endDay);
            endDate.setHours(23, 59, 59, 999); // Ensure we include the whole end day.
            return endDate >= today;
        });
        
        const bookingLeadTimeWeeks = integrationSettings.bookingLeadTimeWeeks || 2;
        const daysToScan = bookingLeadTimeWeeks * 7;
        const now = new Date(); // Get current time once for consistent comparison
    
        for (let i = 0; i < daysToScan; i++) {
            const currentDate = dateUtils.addDays(today, i);
            const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Mon=1, Sun=7
            const currentDateStr = dateUtils.toYYYYMMDD(currentDate);
    
            relevantSchedules.forEach(schedule => {
                const [startYear, startMonth, startDay] = schedule.startDate.split('-').map(Number);
                const startDate = new Date(startYear, startMonth - 1, startDay);
                
                const [endYear, endMonth, endDay] = schedule.endDate.split('-').map(Number);
                const endDate = new Date(endYear, endMonth - 1, endDay);
                endDate.setHours(23, 59, 59, 999);
                
                if (
                    schedule.daysOfWeek.includes(dayOfWeek) &&
                    currentDate >= startDate &&
                    currentDate <= endDate
                ) {
                    const classDef = definitions.find(d => d.id === schedule.groupClassId);
                    const coach = staff.find(s => s.id === schedule.coachId);
                    
                    if (classDef && coach) {
                        const [hour, minute] = schedule.startTime.split(':').map(Number);
                        const startDateTime = new Date(currentDate);
                        startDateTime.setHours(hour, minute, 0, 0);

                        // Explicitly check if the class start time is in the past.
                        if (startDateTime < now) {
                            return;
                        }

                        const allBookingsForInstance = bookings.filter(b => b.scheduleId === schedule.id && b.classDate === currentDateStr && b.status !== 'CANCELLED');
                        const myBooking = allBookingsForInstance.find(b => b.participantId === currentParticipantId);
                        
                        const bookedUsers = allBookingsForInstance.filter(b => b.status === 'BOOKED' || b.status === 'CHECKED-IN');
                        const waitlistedUsers = allBookingsForInstance.filter(b => b.status === 'WAITLISTED').sort((a,b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());
                        
                        let myPosition = 0;
                        if (myBooking?.status === 'WAITLISTED') {
                            myPosition = waitlistedUsers.findIndex(b => b.id === myBooking.id) + 1;
                        }

                        let isRestricted = false;
                        if (membership?.restrictedCategories) {
                            const categoryName = classDef.name;
                            isRestricted = membership.restrictedCategories.map(c => c.toLowerCase()).includes(categoryName.toLowerCase());
                        }
    
                        instances.push({
                            instanceId: `${schedule.id}-${currentDateStr}`,
                            date: currentDateStr,
                            startDateTime: startDateTime,
                            scheduleId: schedule.id,
                            className: classDef.name,
                            duration: schedule.durationMinutes,
                            coachName: coach.name,
                            maxParticipants: schedule.maxParticipants,
                            bookedCount: bookedUsers.length,
                            waitlistCount: waitlistedUsers.length,
                            isBookedByMe: myBooking?.status === 'BOOKED' || myBooking?.status === 'CHECKED-IN',
                            isWaitlistedByMe: myBooking?.status === 'WAITLISTED',
                            myBookingStatus: myBooking?.status,
                            myWaitlistPosition: myPosition,
                            bookingId: myBooking?.id,
                            isFull: bookedUsers.length >= schedule.maxParticipants,
                            cancellationCutoffHours: integrationSettings.cancellationCutoffHours ?? 2,
                            isRestricted: isRestricted,
                            hasWaitlist: schedule.hasWaitlist ?? classDef.hasWaitlist ?? false,
                            color: classDef.color || getColorForCategory(classDef.name),
                        });
                    }
                }
            });
        }
        return instances.sort((a,b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    }, [schedules, definitions, staff, bookings, currentParticipantId, today, participantProfile, integrationSettings, membership, getColorForCategory]);

    const groupedInstances = useMemo(() => {
        const groups: Map<string, EnrichedClassInstance[]> = new Map();
        enrichedInstances.forEach(instance => {
            if (!groups.has(instance.date)) {
                groups.set(instance.date, []);
            }
            groups.get(instance.date)!.push(instance);
        });
        return Array.from(groups.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    }, [enrichedInstances]);
    
    useEffect(() => {
        if (isOpen) {
            const element = document.getElementById(`day-header-${selectedDate.toISOString().split('T')[0]}`);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        }
    }, [isOpen, selectedDate, groupedInstances]);


    const weeks = useMemo(() => {
        const result = [];
        const startOfThisWeek = dateUtils.getStartOfWeek(today);
        const bookingLeadTimeWeeks = integrationSettings.bookingLeadTimeWeeks || 2;
        
        for (let i = 0; i < bookingLeadTimeWeeks; i++) {
            const weekStartDate = dateUtils.addDays(startOfThisWeek, i * 7);
            const weekNumber = dateUtils.getISOWeek(weekStartDate);
            const label = i === 0 ? 'Denna vecka' : `Vecka ${weekNumber}`;
            result.push({ label, weekNumber, startDate: weekStartDate });
        }
        return result;
    }, [today, integrationSettings]);

    const daysInSelectedWeek = useMemo(() => {
        const selectedWeekStart = dateUtils.getStartOfWeek(selectedDate);
        const result = [];
        for (let i = 0; i < 7; i++) {
            result.push(dateUtils.addDays(selectedWeekStart, i));
        }
        return result;
    }, [selectedDate]);
    
    const selectedWeekNumber = dateUtils.getISOWeek(selectedDate);

    const getDayLabel = (date: Date) => {
        if (dateUtils.isSameDay(date, today)) return 'idag';
        if (dateUtils.isSameDay(date, dateUtils.addDays(today, 1))) return 'imorgon';
        return date.toLocaleDateString('sv-SE', { weekday: 'long' });
    };

    const renderActionButton = (instance: EnrichedClassInstance) => {
        if (instance.isRestricted) {
            return <Button variant="accent" onClick={onOpenUpgradeModal}><LockIcon />Lås upp</Button>;
        }
        const now = new Date().getTime();
        const cutoffTime = instance.startDateTime.getTime() - (instance.cancellationCutoffHours * 3600 * 1000);
        const canCancel = now < cutoffTime;

        if (instance.isBookedByMe) {
            if (instance.myBookingStatus === 'CHECKED-IN') {
                return <Button variant="ghost" disabled className="!text-green-600">Incheckad ✅</Button>;
            }
            return (
                <Button variant="danger" onClick={() => setBookingToCancel(instance)} disabled={!canCancel} title={!canCancel ? `Avbokning måste ske senast ${instance.cancellationCutoffHours} timmar innan.` : 'Avboka passet'}>
                    {canCancel ? 'Avboka' : 'För sent'}
                </Button>
            );
        }
        if (instance.isWaitlistedByMe) {
            return (
                <Button variant="accent" onClick={() => setBookingToCancel(instance)}>
                    Lämna kö
                </Button>
            );
        }
        if (instance.isFull) {
            if (instance.hasWaitlist) {
                return (
                    <Button variant="outline" onClick={() => onBookClass(currentParticipantId, instance.scheduleId, instance.date)}>
                        Gå med i kö
                    </Button>
                );
            } else {
                return (
                    <button
                        disabled
                        className="w-full rounded-lg bg-gray-300 text-gray-600 font-semibold py-2 cursor-not-allowed"
                    >
                        FULLBOKAT
                    </button>
                );
            }
        }
        return (
            <Button onClick={() => onBookClass(currentParticipantId, instance.scheduleId, instance.date)}>
                Boka
            </Button>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Boka Pass" size="3xl">
            <div className="flex flex-col h-[80vh] text-gray-800">
                <div className="px-1 pb-4 border-b border-gray-200">
                    <div className="flex justify-around items-center text-center mb-4">
                        {weeks.map(week => (
                            <button key={week.weekNumber} onClick={() => setSelectedDate(week.startDate < today ? today : week.startDate)}
                                className={`px-3 py-1 text-sm sm:text-base rounded-full transition-colors ${selectedWeekNumber === week.weekNumber ? 'bg-gray-200 text-gray-800 font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}>
                                {week.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-around items-center">
                        {daysInSelectedWeek.map(day => {
                            const isSelected = dateUtils.isSameDay(day, selectedDate);
                            const isDisabled = day < today;
                            return (
                                <button key={day.toISOString()} onClick={() => !isDisabled && setSelectedDate(day)}
                                    disabled={isDisabled}
                                    className={`flex flex-col items-center p-2 rounded-full transition-colors w-12 h-12 sm:w-14 sm:h-14 justify-center ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isSelected ? 'bg-flexibel text-white' : 'hover:bg-gray-100'}`}>
                                    <span className="text-xs sm:text-sm font-semibold uppercase">
                                        {day.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')}
                                    </span>
                                    <span className="text-base sm:text-lg font-bold">{day.getDate()}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div ref={listRef} className="flex-grow overflow-y-auto pt-4 space-y-6">
                    {groupedInstances.length > 0 ? (
                        groupedInstances.map(([dateStr, instances]) => (
                            <div key={dateStr} id={`day-header-${dateStr}`} className="scroll-mt-4">
                                <div className={`px-2 pb-2 mb-2 ${dateUtils.isSameDay(new Date(dateStr), selectedDate) ? 'text-flexibel' : ''}`}>
                                    <h3 className="text-2xl font-bold capitalize">{getDayLabel(new Date(dateStr))}</h3>
                                    <p className="text-base text-gray-500">{new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</p>
                                </div>
                                <div className="space-y-3">
                                {instances.length > 0 ? instances.map(instance => {
                                    const isRestricted = instance.isRestricted;
                                    return (
                                        <div 
                                            key={instance.instanceId} 
                                            className={`relative flex items-center gap-3 p-3 rounded-lg shadow-sm border-l-4 transition-colors ${
                                                isRestricted 
                                                    ? 'bg-gray-100' 
                                                    : 'bg-white'
                                            }`}
                                            style={{ borderColor: isRestricted ? '#d1d5db' : instance.color }}
                                            title={instance.className}
                                        >
                                            {isRestricted && <div className="absolute inset-0 bg-gray-200/50 rounded-lg z-10 cursor-not-allowed"></div>}
                                            {instance.isFull && (
                                                <span className="absolute top-1 right-1 bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded z-20">FULLT</span>
                                            )}
                                            <div 
                                                className={`flex-shrink-0 w-20 h-20 flex flex-col items-center justify-center rounded-md text-white z-20 ${isRestricted ? 'opacity-60' : ''}`}
                                                style={{ backgroundColor: instance.isBookedByMe ? '#f43f5e' : instance.color }}
                                            >
                                                <p className="text-2xl font-bold">{instance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-sm">{instance.duration} min</p>
                                            </div>
                                            <div className="flex-grow z-20">
                                                <p className={`font-bold text-lg ${isRestricted ? 'text-gray-500' : ''}`}>{instance.className}</p>
                                                <div className={`flex items-center gap-2 text-sm ${isRestricted ? 'text-gray-500' : 'text-gray-600'}`}>
                                                    <Avatar name={instance.coachName} size="sm" className="!w-6 !h-6 !text-xs" />
                                                    <span>{instance.coachName}</span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 text-center w-28 z-20">
                                                {renderActionButton(instance)}
                                                {instance.isWaitlistedByMe ? (
                                                    <p className="text-sm text-amber-600 font-semibold mt-1">Köplats #{instance.myWaitlistPosition}</p>
                                                ) : (
                                                    !isRestricted && <p className="text-sm text-gray-500 mt-1">{instance.maxParticipants - instance.bookedCount} lediga</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }) : <p className="text-gray-500 px-2">Inga aktiviteter</p>}
                                </div>
                            </div>
                        ))
                    ) : <p className="text-center text-gray-500 py-8 text-lg">Inga pass schemalagda de kommande {integrationSettings.bookingLeadTimeWeeks || 2} veckorna för din valda ort.</p>}
                </div>
            </div>
            <ConfirmationModal
                isOpen={!!bookingToCancel}
                onClose={() => setBookingToCancel(null)}
                onConfirm={() => {
                    if (bookingToCancel?.bookingId) {
                        onCancelBooking(bookingToCancel.bookingId);
                    }
                    setBookingToCancel(null);
                }}
                title={
                    bookingToCancel?.isWaitlistedByMe
                        ? `Lämna kön för ${bookingToCancel?.className}?`
                        : `Avboka ${bookingToCancel?.className}?`
                }
                message={
                    bookingToCancel?.isWaitlistedByMe
                        ? `Är du säker på att du vill lämna kön för ${bookingToCancel?.className} den ${bookingToCancel?.startDateTime.toLocaleDateString('sv-SE')}?`
                        : `Är du säker på att du vill avboka din plats på ${bookingToCancel?.className} den ${bookingToCancel?.startDateTime.toLocaleDateString('sv-SE')}?`
                }
                confirmButtonText={bookingToCancel?.isWaitlistedByMe ? 'Ja, lämna kön' : 'Ja, avboka'}
                confirmButtonVariant="danger"
            />
        </Modal>
    );
};