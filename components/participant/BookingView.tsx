import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Avatar } from '../Avatar';
import { GroupClassSchedule, GroupClassDefinition, ParticipantBooking, StaffMember, ParticipantProfile, IntegrationSettings, BookingStatus } from '../../types';
import * as dateUtils from '../../utils/dateUtils';

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
}

const getCategoryColor = (className: string): string => {
    const lowerClassName = className.toLowerCase();
    if (lowerClassName.includes('pt-bas') || lowerClassName.includes('pt-grupp')) {
        return 'border-sky-500';
    }
    if (lowerClassName.includes('hiit')) {
        return 'border-amber-500';
    }
    if (lowerClassName.includes('yoga')) {
        return 'border-violet-500';
    }
    if (lowerClassName.includes('workout')) {
        return 'border-emerald-500';
    }
    return 'border-slate-300';
};


export const BookingView: React.FC<BookingViewProps> = ({ isOpen, onClose, schedules, definitions, bookings, staff, onBookClass, onCancelBooking, currentParticipantId, participantProfile, integrationSettings }) => {
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    const [selectedDate, setSelectedDate] = useState(today);
    const listRef = useRef<HTMLDivElement>(null);

    const enrichedInstances = useMemo(() => {
        const instances: EnrichedClassInstance[] = [];
        if (!participantProfile?.locationId) return [];

        const memberLocationId = participantProfile.locationId;
        const relevantSchedules = schedules.filter(s => s.locationId === memberLocationId);
        
        const bookingLeadTimeWeeks = integrationSettings.bookingLeadTimeWeeks || 2;
        const daysToScan = bookingLeadTimeWeeks * 7;
    
        for (let i = 0; i < daysToScan; i++) {
            const currentDate = dateUtils.addDays(today, i);
            const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Mon=1, Sun=7
            const currentDateStr = currentDate.toISOString().split('T')[0];
    
            relevantSchedules.forEach(schedule => {
                // FIX: Parse date strings as local time to avoid timezone issues.
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

                        if (startDateTime < new Date()) {
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
                        });
                    }
                }
            });
        }
        return instances.sort((a,b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    }, [schedules, definitions, staff, bookings, currentParticipantId, today, participantProfile, integrationSettings]);

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
        const now = new Date().getTime();
        const cutoffTime = instance.startDateTime.getTime() - (instance.cancellationCutoffHours * 3600 * 1000);
        const canCancel = now < cutoffTime;

        if (instance.isBookedByMe) {
            if (instance.myBookingStatus === 'CHECKED-IN') {
                return <Button variant="ghost" disabled className="!text-green-600">Incheckad ✅</Button>;
            }
            return (
                <Button variant="danger" onClick={() => onCancelBooking(instance.bookingId!)} disabled={!canCancel} title={!canCancel ? `Avbokning måste ske senast ${instance.cancellationCutoffHours} timmar innan.` : 'Avboka passet'}>
                    {canCancel ? 'Avboka' : 'För sent'}
                </Button>
            );
        }
        if (instance.isWaitlistedByMe) {
            return (
                <Button variant="secondary" onClick={() => onCancelBooking(instance.bookingId!)}>
                    Lämna kö
                </Button>
            );
        }
        if (instance.isFull) {
            return (
                <Button variant="outline" onClick={() => onBookClass(currentParticipantId, instance.scheduleId, instance.date)}>
                    Gå med i kö
                </Button>
            );
        }
        return (
            <Button onClick={() => onBookClass(currentParticipantId, instance.scheduleId, instance.date)}>
                Boka
            </Button>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Veckoschema" size="3xl">
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
                                {instances.length > 0 ? instances.map(instance => (
                                    <div key={instance.instanceId} className={`flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border-l-4 ${getCategoryColor(instance.className)}`}>
                                        <div className={`flex-shrink-0 w-20 h-20 flex flex-col items-center justify-center rounded-md text-white ${instance.isBookedByMe ? 'bg-rose-400' : 'bg-flexibel'}`}>
                                            <p className="text-2xl font-bold">{instance.startDateTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p className="text-sm">{instance.duration} min</p>
                                        </div>
                                        <div className="flex-grow">
                                            <p className="font-bold text-lg">{instance.className}</p>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Avatar name={instance.coachName} size="sm" className="!w-6 !h-6 !text-xs" />
                                                <span>{instance.coachName}</span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 text-center w-28">
                                            {renderActionButton(instance)}
                                            {instance.isWaitlistedByMe ? (
                                                <p className="text-sm text-amber-600 font-semibold mt-1">Köplats #{instance.myWaitlistPosition}</p>
                                            ) : (
                                                <p className="text-sm text-gray-500 mt-1">{instance.maxParticipants - instance.bookedCount} lediga</p>
                                            )}
                                        </div>
                                    </div>
                                )) : <p className="text-gray-500 px-2">Inga aktiviteter</p>}
                                </div>
                            </div>
                        ))
                    ) : <p className="text-center text-gray-500 py-8 text-lg">Inga pass schemalagda de kommande {integrationSettings.bookingLeadTimeWeeks || 2} veckorna för din valda ort.</p>}
                </div>
            </div>
        </Modal>
    );
};