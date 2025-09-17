import React, { useState, useMemo } from 'react';
import { ParticipantProfile, ActivityLog, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, Workout, ClubDefinition, WorkoutLog, LiftType } from '../../types';
import { CLUB_DEFINITIONS } from '../../constants';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { calculateEstimated1RM } from '../../utils/workoutUtils';

interface ClubsViewProps {
    participantProfile: ParticipantProfile;
    allActivityLogs: ActivityLog[];
    strengthStatsHistory: UserStrengthStat[];
    conditioningStatsHistory: ParticipantConditioningStat[];
    clubMemberships: ParticipantClubMembership[];
    allClubMemberships: ParticipantClubMembership[];
    workouts: Workout[];
    allParticipants: ParticipantProfile[];
}

type ClubTab = 'styrka' | 'kondition' | 'pass';

const HallOfFameModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    club: ClubDefinition | null;
    allParticipants: ParticipantProfile[];
    allMemberships: ParticipantClubMembership[];
}> = ({ isOpen, onClose, club, allParticipants, allMemberships }) => {
    if (!isOpen || !club) return null;

    const members = allMemberships
        .filter(m => m.clubId === club.id)
        .map(m => {
            const participant = allParticipants.find(p => p.id === m.participantId);
            return participant ? { ...participant, achievedDate: m.achievedDate } : null;
        })
        .filter((p): p is ParticipantProfile & { achievedDate: string } => p !== null)
        .sort((a, b) => new Date(a.achievedDate).getTime() - new Date(b.achievedDate).getTime());

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${club.icon} ${club.name}`}>
            <p className="text-lg text-gray-600 mb-4">{club.description}</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Hall of Fame ({members.length} medlemmar)</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
                {members.length > 0 ? (
                    members.map((member, index) => (
                        <div key={member.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                            <span className="font-semibold text-gray-700">{index + 1}. {member.name}</span>
                            <span className="text-sm text-gray-500">{new Date(member.achievedDate).toLocaleDateString('sv-SE')}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 italic">Inga medlemmar har uppnått detta än.</p>
                )}
            </div>
        </Modal>
    );
};

export const ClubsView: React.FC<ClubsViewProps> = ({
    participantProfile, allActivityLogs, strengthStatsHistory, conditioningStatsHistory, clubMemberships, workouts, allParticipants, allClubMemberships
}) => {
    const [activeTab, setActiveTab] = useState<ClubTab>('styrka');
    const [selectedClub, setSelectedClub] = useState<ClubDefinition | null>(null);

    const myClubIds = useMemo(() => new Set(clubMemberships.map(m => m.clubId)), [clubMemberships]);

    const userProgressData = useMemo(() => {
        const sessionCount = allActivityLogs.length;

        const maxLifts = new Map<LiftType, number>();
        strengthStatsHistory.forEach(stat => {
            if (stat.squat1RMaxKg) maxLifts.set('Knäböj', Math.max(maxLifts.get('Knäböj') || 0, stat.squat1RMaxKg));
            if (stat.benchPress1RMaxKg) maxLifts.set('Bänkpress', Math.max(maxLifts.get('Bänkpress') || 0, stat.benchPress1RMaxKg));
            if (stat.deadlift1RMaxKg) maxLifts.set('Marklyft', Math.max(maxLifts.get('Marklyft') || 0, stat.deadlift1RMaxKg));
            if (stat.overheadPress1RMaxKg) maxLifts.set('Axelpress', Math.max(maxLifts.get('Axelpress') || 0, stat.overheadPress1RMaxKg));
        });

        allActivityLogs.forEach(log => {
            if (log.type === 'workout') {
                const workoutTemplate = workouts.find(w => w.id === (log as WorkoutLog).workoutId);
                (log as WorkoutLog).entries.forEach(entry => {
                    const exercise = workoutTemplate?.blocks.flatMap(b => b.exercises).find(e => e.id === entry.exerciseId);
                    if (exercise?.baseLiftType) {
                        entry.loggedSets.forEach(set => {
                            const e1rm = calculateEstimated1RM(set.weight, set.reps);
                            if (e1rm) {
                                maxLifts.set(exercise.baseLiftType!, Math.max(maxLifts.get(exercise.baseLiftType!) || 0, e1rm));
                            }
                        });
                    }
                });
            }
        });
        
        const bestConditioning = {
            airbike4MinKcal: Math.max(0, ...conditioningStatsHistory.map(s => s.airbike4MinKcal || 0)),
            skierg4MinMeters: Math.max(0, ...conditioningStatsHistory.map(s => s.skierg4MinMeters || 0)),
            rower4MinMeters: Math.max(0, ...conditioningStatsHistory.map(s => s.rower4MinMeters || 0)),
            treadmill4MinMeters: Math.max(0, ...conditioningStatsHistory.map(s => s.treadmill4MinMeters || 0)),
            rower2000mTimeSeconds: Math.min(Infinity, ...conditioningStatsHistory.map(s => s.rower2000mTimeSeconds || Infinity)),
        };

        return { sessionCount, maxLifts, bestConditioning };

    }, [allActivityLogs, strengthStatsHistory, conditioningStatsHistory, workouts]);
    
    const filteredClubs = useMemo(() => {
        let clubs: ClubDefinition[] = [];
        if (activeTab === 'styrka') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'LIFT' || c.type === 'BODYWEIGHT_LIFT');
        } else if (activeTab === 'kondition') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'CONDITIONING');
        } else if (activeTab === 'pass') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'SESSION_COUNT');
        }
        return clubs.sort((a,b) => (a.threshold || 0) - (b.threshold || 0));
    }, [activeTab]);

    const getTabButtonStyle = (tabName: ClubTab) => {
        return activeTab === tabName
            ? 'bg-flexibel/20 text-flexibel'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    };

    const renderProgressBar = (current: number, target: number, prevTarget: number = 0) => {
        const range = target - prevTarget;
        const progressInRange = current - prevTarget;
        const percentage = range > 0 ? Math.min(100, Math.max(0, (progressInRange / range) * 100)) : 0;
        
        return (
            <div className="mt-2 space-y-1">
                 <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-flexibel h-2.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                </div>
                <p className="text-right text-xs font-medium text-gray-500">{current.toLocaleString('sv-SE')} / {target.toLocaleString('sv-SE')}</p>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="p-2 bg-gray-100 rounded-lg flex justify-center gap-2">
                <button onClick={() => setActiveTab('styrka')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('styrka')}`}>Styrka</button>
                <button onClick={() => setActiveTab('kondition')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('kondition')}`}>Kondition</button>
                <button onClick={() => setActiveTab('pass')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('pass')}`}>Pass & Dedikation</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredClubs.map(club => {
                    const isAchieved = myClubIds.has(club.id);
                    let progressContent: React.ReactNode = null;
                    
                    if (!isAchieved) {
                        const allClubsInFamily = CLUB_DEFINITIONS.filter(c => c.liftType === club.liftType && c.type === club.type).sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
                        const currentClubIndex = allClubsInFamily.findIndex(c => c.id === club.id);
                        const prevClub = currentClubIndex > 0 ? allClubsInFamily[currentClubIndex - 1] : null;
                        const prevTarget = prevClub?.threshold || 0;

                        switch (club.type) {
                            case 'SESSION_COUNT':
                                progressContent = renderProgressBar(userProgressData.sessionCount, club.threshold!, prevTarget);
                                break;
                            case 'LIFT':
                                if (club.liftType) {
                                    const pb = userProgressData.maxLifts.get(club.liftType) || 0;
                                    progressContent = renderProgressBar(pb, club.threshold!, prevTarget);
                                }
                                break;
                            case 'BODYWEIGHT_LIFT':
                                if (club.liftType && participantProfile.bodyweightKg) {
                                    const pb = userProgressData.maxLifts.get(club.liftType) || 0;
                                    const targetWeight = participantProfile.bodyweightKg * (club.multiplier || 1);
                                    progressContent = renderProgressBar(pb, targetWeight, 0);
                                }
                                break;
                            case 'CONDITIONING':
                                if (club.conditioningMetric && club.threshold !== undefined) {
                                    const userBest = userProgressData.bestConditioning[club.conditioningMetric];
                                    if (club.comparison === 'LESS_OR_EQUAL') {
                                        if (userBest < Infinity) {
                                            const diff = userBest - club.threshold;
                                            const minutes = Math.floor(userBest / 60);
                                            const seconds = Math.round(userBest % 60);
                                            const targetMinutes = Math.floor(club.threshold / 60);
                                            const targetSeconds = club.threshold % 60;
                                            progressContent = (
                                                <div className="mt-2 text-sm text-gray-600">
                                                    <p><strong>Ditt bästa:</strong> {minutes}:{String(seconds).padStart(2, '0')}</p>
                                                    <p><strong>Mål:</strong> {targetMinutes}:{String(targetSeconds).padStart(2, '0')}</p>
                                                    {diff > 0 && <p className="font-bold text-flexibel-orange">Bara {diff.toFixed(0)} sekunder kvar!</p>}
                                                </div>
                                            );
                                        }
                                    } else {
                                        progressContent = renderProgressBar(userBest, club.threshold, prevTarget);
                                    }
                                }
                                break;
                        }
                    }

                    return (
                        <div key={club.id} onClick={() => setSelectedClub(club)} className={`p-4 rounded-lg shadow-md transition-all cursor-pointer ${isAchieved ? 'bg-green-100 border-2 border-green-300' : 'bg-white hover:shadow-lg'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{club.icon} {club.name}</h3>
                                    <p className="text-sm text-gray-600">{club.description}</p>
                                </div>
                                {isAchieved && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-200 text-green-800">MEDLEM</span>}
                            </div>
                            {progressContent}
                        </div>
                    );
                })}
            </div>

            <HallOfFameModal
                isOpen={!!selectedClub}
                onClose={() => setSelectedClub(null)}
                club={selectedClub}
                allParticipants={allParticipants}
                allMemberships={allClubMemberships}
            />
        </div>
    );
};
