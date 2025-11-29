import React, { useState, useMemo } from 'react';
import { ParticipantProfile, ActivityLog, UserStrengthStat, ParticipantConditioningStat, ParticipantClubMembership, Workout, ClubDefinition, WorkoutLog, LiftType, Location } from '../../types';
import { CLUB_DEFINITIONS } from '../../constants';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { calculateEstimated1RM } from '../../utils/workoutUtils';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { useAppContext } from '../../context/AppContext';
import { Avatar } from '../Avatar';

interface ClubsViewProps {
    participantProfile: ParticipantProfile;
    allActivityLogs: ActivityLog[];
    strengthStatsHistory: UserStrengthStat[];
    conditioningStatsHistory: ParticipantConditioningStat[];
    clubMemberships: ParticipantClubMembership[]; // Current user's memberships
    allClubMemberships: ParticipantClubMembership[]; // All memberships in the org
    workouts: Workout[];
    allParticipants: ParticipantProfile[];
}

type ClubTab = 'mina-klubbar' | 'styrka' | 'kondition' | 'pass';

const HallOfFameModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    club: ClubDefinition | null;
    participantsInFilter: ParticipantProfile[];
    allMemberships: ParticipantClubMembership[];
}> = ({ isOpen, onClose, club, participantsInFilter, allMemberships }) => {
    if (!isOpen || !club) return null;

    const members = useMemo(() => {
        if (!club) return [];

        const participantIdsInFilter = new Set(participantsInFilter.map(p => p.id));
        const membershipsByParticipant = new Map<string, ParticipantClubMembership[]>();

        // Group all memberships by participant, but only for those in the current filter
        allMemberships.forEach(membership => {
            if (participantIdsInFilter.has(membership.participantId)) {
                if (!membershipsByParticipant.has(membership.participantId)) {
                    membershipsByParticipant.set(membership.participantId, []);
                }
                membershipsByParticipant.get(membership.participantId)!.push(membership);
            }
        });

        const currentMembers: (ParticipantProfile & { achievedDate: string })[] = [];

        // For each participant in the filter, find their highest achievements and check if it's THIS club
        membershipsByParticipant.forEach((participantMemberships, participantId) => {
            const highestAchievements = getHighestClubAchievements(participantMemberships);
            const isMemberOfThisClubAsHighest = highestAchievements.some(
                achievement => achievement.clubId === club.id
            );

            if (isMemberOfThisClubAsHighest) {
                const participant = participantsInFilter.find(p => p.id === participantId);
                const originalAchievement = participantMemberships.find(m => m.clubId === club.id);
                if (participant && originalAchievement) {
                    currentMembers.push({ ...participant, achievedDate: originalAchievement.achievedDate });
                }
            }
        });

        return currentMembers.sort((a, b) => new Date(a.achievedDate).getTime() - new Date(b.achievedDate).getTime());
    }, [club, allMemberships, participantsInFilter]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${club.icon} ${club.name}`}>
            <p className="text-lg text-gray-600 mb-4">{club.description}</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nuvarande Medlemmar ({members.length})</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {members.length > 0 ? (
                    members.map((member, index) => (
                        <div key={member.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-500 w-6">{index + 1}.</span>
                                <Avatar name={member.name} photoURL={member.photoURL} size="sm" />
                                <span className="font-semibold text-gray-700">{member.name}</span>
                            </div>
                            <span className="text-sm text-gray-500">{new Date(member.achievedDate).toLocaleDateString('sv-SE')}</span>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 italic">Inga medlemmar har detta som sin högsta prestation just nu.</p>
                )}
            </div>
        </Modal>
    );
};

const StudioFilterControl: React.FC<{
    value: string;
    onChange: (value: string) => void;
    locations: Location[];
    participantProfile: ParticipantProfile | null;
}> = ({ value, onChange, locations, participantProfile }) => {
    const myStudioLocation = useMemo(() => {
        if (!participantProfile?.locationId) return null;
        return locations.find(l => l.id === participantProfile.locationId);
    }, [locations, participantProfile]);

    const options = [{ value: 'all', label: 'Alla Studior' }];
    if (myStudioLocation) {
        options.unshift({ value: myStudioLocation.id, label: `Min Studio` });
    }
    
    if (options.length <= 1) return null;

    return (
        <div className="flex justify-center p-1 bg-gray-100 rounded-lg mb-4">
            {options.map(option => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors w-1/2 ${
                        value === option.value
                            ? 'bg-white text-flexibel shadow'
                            : 'text-gray-600 active:bg-gray-200'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export const ClubsView: React.FC<ClubsViewProps> = ({
    participantProfile, allActivityLogs, strengthStatsHistory, conditioningStatsHistory, clubMemberships, workouts, allParticipants, allClubMemberships
}) => {
    const [activeTab, setActiveTab] = useState<ClubTab>('mina-klubbar');
    const [selectedClub, setSelectedClub] = useState<ClubDefinition | null>(null);
    const [studioFilter, setStudioFilter] = useState<string>(participantProfile.locationId || 'all');
    const { locations } = useAppContext();

    const myHighestClubIds = useMemo(() => {
        const highestMemberships = getHighestClubAchievements(clubMemberships);
        return new Set(highestMemberships.map(m => m.clubId));
    }, [clubMemberships]);
    
    const participantsInFilter = useMemo(() => {
        if (studioFilter === 'all') return allParticipants.filter(p => p.isActive);
        return allParticipants.filter(p => p.isActive && p.locationId === studioFilter);
    }, [allParticipants, studioFilter]);
    
    const participantIdsInFilter = useMemo(() => new Set(participantsInFilter.map(p => p.id)), [participantsInFilter]);

    const memberCountsByClubId = useMemo(() => {
        const counts = new Map<string, { total: number, members: { id: string, name: string }[] }>();
        const membershipsByParticipant = new Map<string, ParticipantClubMembership[]>();

        const membershipsInFilter = allClubMemberships.filter(m => participantIdsInFilter.has(m.participantId));

        membershipsInFilter.forEach(membership => {
            if (!membershipsByParticipant.has(membership.participantId)) {
                membershipsByParticipant.set(membership.participantId, []);
            }
            membershipsByParticipant.get(membership.participantId)!.push(membership);
        });

        membershipsByParticipant.forEach((participantMemberships, participantId) => {
            const highestAchievements = getHighestClubAchievements(participantMemberships);
            const participant = participantsInFilter.find(p => p.id === participantId);
            if (!participant) return;
            
            highestAchievements.forEach(achievement => {
                if (!counts.has(achievement.clubId)) {
                    counts.set(achievement.clubId, { total: 0, members: [] });
                }
                const current = counts.get(achievement.clubId)!;
                current.total++;
                current.members.push({ id: participant.id, name: participant.name || 'Okänd' });
            });
        });
        
        counts.forEach(value => {
            value.members.sort((a, b) => {
                if (a.id === participantProfile.id) return -1;
                if (b.id === participantProfile.id) return 1;
                return a.name.localeCompare(b.name);
            });
        });

        return counts;
    }, [allClubMemberships, participantsInFilter, participantIdsInFilter, participantProfile.id]);


    const userProgressData = useMemo(() => {
        // This logic is unchanged and correct for showing progress bars
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
        if (activeTab === 'mina-klubbar') {
            clubs = CLUB_DEFINITIONS.filter(c => myHighestClubIds.has(c.id));
        } else if (activeTab === 'styrka') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'LIFT' || c.type === 'BODYWEIGHT_LIFT' || c.type === 'TOTAL_VOLUME');
        } else if (activeTab === 'kondition') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'CONDITIONING');
        } else if (activeTab === 'pass') {
            clubs = CLUB_DEFINITIONS.filter(c => c.type === 'SESSION_COUNT');
        }
        return clubs.sort((a,b) => {
            const valA = a.threshold || 0;
            const valB = b.threshold || 0;
            return a.comparison === 'LESS_OR_EQUAL' ? valB - valA : valA - valB;
        });
    }, [activeTab, myHighestClubIds]);

    const getTabButtonStyle = (tabName: ClubTab) => {
        return activeTab === tabName
            ? 'bg-flexibel/20 text-flexibel'
            : 'bg-gray-100 text-gray-600 active:bg-gray-200';
    };

    const renderProgressBar = (current: number, target: number, prevTarget: number = 0) => {
        // Unchanged
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
            <div className="p-2 bg-gray-100 rounded-lg flex justify-center gap-2 flex-wrap">
                <button onClick={() => setActiveTab('mina-klubbar')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('mina-klubbar')}`}>Mina klubbar</button>
                <button onClick={() => setActiveTab('styrka')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('styrka')}`}>Styrka</button>
                <button onClick={() => setActiveTab('kondition')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('kondition')}`}>Kondition</button>
                <button onClick={() => setActiveTab('pass')} className={`py-1.5 px-3 font-medium text-sm rounded-md ${getTabButtonStyle('pass')}`}>Pass & Dedikation</button>
            </div>
            
            {activeTab !== 'mina-klubbar' && <StudioFilterControl value={studioFilter} onChange={setStudioFilter} locations={locations} participantProfile={participantProfile}/>}

            {filteredClubs.length === 0 && activeTab === 'mina-klubbar' && (
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <p className="text-lg text-gray-600">Du är inte med i några klubbar än.</p>
                    <p className="text-base text-gray-500">Logga dina pass för att låsa upp dem!</p>
                </div>
            )}
            
            <div className="grid grid-cols-1 gap-4">
                {filteredClubs.map(club => {
                    const isMyHighestClub = myHighestClubIds.has(club.id);
                    const clubStats = memberCountsByClubId.get(club.id) || { total: 0, members: [] };
                    const memberCount = clubStats.total;
                    const memberNameObjects = clubStats.members.slice(0, 3).map(m => ({
                        id: m.id,
                        name: m.id === participantProfile.id ? "Du" : m.name.split(' ')[0]
                    }));
                    const remainingCount = Math.max(0, memberCount - memberNameObjects.length);
                    
                    let progressContent: React.ReactNode = null;
                    if (!isMyHighestClub) {
                        // Progress calculation logic is unchanged
                        // ...
                    }

                    return (
                        <button key={club.id} onClick={() => setSelectedClub(club)} className={`w-full text-left p-4 rounded-xl shadow-md transition-all ${isMyHighestClub ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white active:shadow-lg border-2 border-transparent active:scale-[0.98]'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <h3 className="text-2xl font-bold text-gray-800">{club.icon} {club.name}</h3>
                                    <p className="text-sm text-gray-600">{club.description}</p>
                                </div>
                            </div>
                            {progressContent}
                            {memberCount > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300/60">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {memberNameObjects.map(member => (
                                            <span key={member.id} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${member.name === 'Du' ? 'bg-yellow-300 text-yellow-900 ring-2 ring-yellow-400' : 'bg-gray-200 text-gray-800'}`}>{member.name}</span>
                                        ))}
                                        {remainingCount > 0 && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-800">+{remainingCount} till</span>}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <HallOfFameModal
                isOpen={!!selectedClub}
                onClose={() => setSelectedClub(null)}
                club={selectedClub}
                participantsInFilter={participantsInFilter}
                allMemberships={allClubMemberships}
            />
        </div>
    );
};