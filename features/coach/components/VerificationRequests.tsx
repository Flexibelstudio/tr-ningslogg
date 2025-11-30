
import React, { useMemo } from 'react';
import { UserStrengthStat, ParticipantProfile, LiftType } from '../../../types';
import { Button } from '../../../components/Button';
import { useAppContext } from '../../../context/AppContext';

interface VerificationRequestsProps {
    userStrengthStats: UserStrengthStat[];
    participants: ParticipantProfile[];
    onVerify: (statId: string, lift: LiftType, status: 'verified' | 'rejected' | 'unverified') => void;
}

interface PendingRequest {
    statId: string;
    participantName: string;
    lift: LiftType;
    weight: number;
    date: string;
}

export const VerificationRequests: React.FC<VerificationRequestsProps> = ({ userStrengthStats, participants, onVerify }) => {
    const pendingRequests = useMemo(() => {
        const requests: PendingRequest[] = [];
        
        userStrengthStats.forEach(stat => {
            const participant = participants.find(p => p.id === stat.participantId);
            if (!participant) return;
            const name = participant.name || 'Okänd Medlem';
            const date = stat.lastUpdated;

            if (stat.squatVerificationStatus === 'pending' && stat.squat1RMaxKg) {
                requests.push({ statId: stat.id, participantName: name, lift: 'Knäböj', weight: stat.squat1RMaxKg, date });
            }
            if (stat.benchPressVerificationStatus === 'pending' && stat.benchPress1RMaxKg) {
                requests.push({ statId: stat.id, participantName: name, lift: 'Bänkpress', weight: stat.benchPress1RMaxKg, date });
            }
            if (stat.deadliftVerificationStatus === 'pending' && stat.deadlift1RMaxKg) {
                requests.push({ statId: stat.id, participantName: name, lift: 'Marklyft', weight: stat.deadlift1RMaxKg, date });
            }
            if (stat.overheadPressVerificationStatus === 'pending' && stat.overheadPress1RMaxKg) {
                requests.push({ statId: stat.id, participantName: name, lift: 'Axelpress', weight: stat.overheadPress1RMaxKg, date });
            }
        });
        
        return requests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [userStrengthStats, participants]);

    if (pendingRequests.length === 0) return null;

    return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6 shadow-sm animate-fade-in-down">
            <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center">
                <span className="text-xl mr-2">🏅</span> Nya PB att granska ({pendingRequests.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {pendingRequests.map((req, index) => (
                    <div key={`${req.statId}-${req.lift}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-white rounded border border-yellow-100 shadow-sm gap-2">
                        <div>
                            <p className="font-semibold text-gray-900">{req.participantName} <span className="font-normal text-gray-600">– {req.lift}: <strong className="text-gray-900">{req.weight} kg</strong></span></p>
                            <p className="text-xs text-gray-500">Uppdaterad: {new Date(req.date).toLocaleDateString('sv-SE')}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                            <Button size="sm" variant="ghost" className="!text-gray-500 hover:!text-red-600 hover:!bg-red-50" onClick={() => onVerify(req.statId, req.lift, 'unverified')}>Avfärda</Button>
                            <Button size="sm" variant="primary" className="!bg-green-600 hover:!bg-green-700 border-green-600" onClick={() => onVerify(req.statId, req.lift, 'verified')}>Verifiera ✅</Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
