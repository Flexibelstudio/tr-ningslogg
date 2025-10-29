import React, { useState, useMemo } from 'react';
import { ParticipantProfile, ActivityLog, WorkoutLog, UserStrengthStat, ParticipantClubMembership, LeaderboardSettings, Location, LiftType, Workout, ParticipantConditioningStat, Exercise } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { calculateFlexibelStrengthScoreInternal } from './StrengthComparisonTool';

interface LeaderboardViewProps {
    currentParticipantId: string;
    participants: ParticipantProfile[];
    allActivityLogs: ActivityLog[];
    userStrengthStats: UserStrengthStat[];
    clubMemberships: ParticipantClubMembership[];
    leaderboardSettings: LeaderboardSettings;
    isProspect?: boolean;
    locations: Location[];
    participantProfile: ParticipantProfile | null;
    workouts: Workout[];
    conditioningStatsHistory: ParticipantConditioningStat[];
}

type LeaderboardSubTab = 'weekly' | 'all-time';
type StudioFilter = string; // 'all' or a locationId

interface LeaderboardEntry {
    participant: ParticipantProfile;
    value: number;
    rank: number;
    isCurrentUser: boolean;
}

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
        options.unshift({ value: myStudioLocation.id, label: `Min Studio (${myStudioLocation.name})` });
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


const LeaderboardCard: React.FC<{ title: string; entries: LeaderboardEntry[]; unit?: string, currentUserEntry?: LeaderboardEntry | null, isProspect?: boolean }> = ({ title, entries, unit, currentUserEntry, isProspect }) => (
    <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-flexibel mb-3">{title}</h3>
        {entries.length === 0 ? (
            <p className="text-gray-500">Ingen data att visa. Var med och tävla!</p>
        ) : (
            <ol className="space-y-2">
                {entries.map(({ participant, value, rank, isCurrentUser }) => (
                    <li key={participant.id} className={`flex items-center justify-between p-2 rounded-md transition-colors ${isCurrentUser ? 'bg-flexibel/20 border-2 border-flexibel' : 'bg-gray-50'}`}>
                        <div className="flex items-center">
                            <span className={`text-lg font-semibold w-8 ${isCurrentUser ? 'text-flexibel' : 'text-gray-500'}`}>{rank}.</span>
                            <span className="text-base font-medium text-gray-800">{isCurrentUser ? 'Du' : participant.name}</span>
                        </div>
                        <span className="text-lg font-bold text-flexibel">{value.toLocaleString('sv-SE')} {unit}</span>
                    </li>
                ))}
            </ol>
        )}
        {isProspect ? (
            <div className="mt-3 pt-3 border-t">
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-center">
                    <p className="font-bold">✨ Lås upp din plats!</p>
                    <p className="text-sm mt-1">Logga ditt första pass för att se din placering och börja tävla.</p>
                </div>
            </div>
        ) : (
            currentUserEntry && !entries.some(e => e.isCurrentUser) && (
                 <div className="mt-3 pt-3 border-t">
                    <p className="flex items-center justify-between p-2 rounded-md bg-flexibel/20 border-2 border-flexibel">
                        <span className="flex items-center">
                            <span className="text-lg font-semibold w-8 text-flexibel">{currentUserEntry.rank}.</span>
                            <span className="text-base font-medium text-gray-800">Du</span>
                        </span>
                        <span className="text-lg font-bold text-flexibel">{currentUserEntry.value.toLocaleString('sv-SE')} {unit}</span>
                    </p>
                 </div>
            )
        )}
    </div>
);

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
    currentParticipantId, participants, allActivityLogs, userStrengthStats, clubMemberships, leaderboardSettings, isProspect, locations, participantProfile, workouts, conditioningStatsHistory
}) => {
    const [activeTab, setActiveTab] = useState<LeaderboardSubTab>('weekly');
    const [weeklyFilter, setWeeklyFilter] = useState<StudioFilter>(participantProfile?.locationId || 'all');
    const [allTimeFilter, setAllTimeFilter] = useState<StudioFilter>('all');
    
    const optedInParticipants = useMemo(() => {
        return participants.filter(p => p.enableLeaderboardParticipation && p.isActive);
    }, [participants]);
    
    const weeklyParticipants = useMemo(() => {
        if (weeklyFilter === 'all') return optedInParticipants;
        return optedInParticipants.filter(p => p.locationId === weeklyFilter);
    }, [optedInParticipants, weeklyFilter]);

    const allTimeParticipants = useMemo(() => {
        if (allTimeFilter === 'all') return optedInParticipants;
        return optedInParticipants.filter(p => p.locationId === allTimeFilter);
    }, [optedInParticipants, allTimeFilter]);


    const { weeklyPBLeaderboard, weeklySessionLeaderboard, currentUserPBEntry, currentUserSessionEntry } = useMemo(() => {
        const weeklyParticipantIds = new Set(weeklyParticipants.map(p => p.id));
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const endOfWeek = dateUtils.getEndOfWeek(new Date());
        const logsThisWeek = allActivityLogs.filter(log => {
            if (!weeklyParticipantIds.has(log.participantId)) return false;
            const completedDate = new Date(log.completedDate);
            return completedDate >= startOfWeek && completedDate <= endOfWeek;
        });
        
        const pbCounts: { [participantId: string]: number } = {};
        const workoutLogsThisWeek = logsThisWeek.filter(l => l.type === 'workout') as WorkoutLog[];
        workoutLogsThisWeek.forEach(log => {
            const pbCount = log.postWorkoutSummary?.newPBs?.length || 0;
            if (pbCount > 0) {
                pbCounts[log.participantId] = (pbCounts[log.participantId] || 0) + pbCount;
            }
        });
        const allPbEntries = Object.entries(pbCounts)
            .map(([participantId, value]) => ({ participantId, value }))
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
                const participant = weeklyParticipants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1, isCurrentUser: participant.id === currentParticipantId } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null);
        
        const weeklyPBLeaderboard = allPbEntries.slice(0, 10);
        const currentUserPBEntry = allPbEntries.find(e => e.isCurrentUser) || null;

        const sessionCounts: { [participantId: string]: number } = {};
        logsThisWeek.forEach(log => {
            sessionCounts[log.participantId] = (sessionCounts[log.participantId] || 0) + 1;
        });
        const allSessionEntries = Object.entries(sessionCounts)
            .map(([participantId, value]) => ({ participantId, value }))
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
                const participant = weeklyParticipants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1, isCurrentUser: participant.id === currentParticipantId } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null);

        const weeklySessionLeaderboard = allSessionEntries.slice(0, 10);
        const currentUserSessionEntry = allSessionEntries.find(e => e.isCurrentUser) || null;

        return { weeklyPBLeaderboard, weeklySessionLeaderboard, currentUserPBEntry, currentUserSessionEntry };
    }, [allActivityLogs, weeklyParticipants, currentParticipantId]);

    const { allTimeFssLeaderboard, currentUserFssEntry } = useMemo(() => {
        const allEntries = allTimeParticipants
        .filter(p => p.enableFssSharing)
        .map(participant => {
            const latestStats = userStrengthStats
                .filter(stat => stat.participantId === participant.id)
                .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
            if (!latestStats) return null;
            const scoreData = calculateFlexibelStrengthScoreInternal(latestStats, participant);
            return scoreData && scoreData.totalScore > 0 ? { participant, value: scoreData.totalScore, isCurrentUser: participant.id === currentParticipantId } : null;
        })
        .filter((e): e is Omit<LeaderboardEntry, 'rank'> => e !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

        return {
            allTimeFssLeaderboard: allEntries.slice(0, 20),
            currentUserFssEntry: allEntries.find(e => e.isCurrentUser) || null,
        };
    }, [allTimeParticipants, userStrengthStats, currentParticipantId]);

    const { allTimeInBodyLeaderboard, currentUserInBodyEntry } = useMemo(() => {
        const allEntries = allTimeParticipants
            .filter(p => p.enableInBodySharing)
            .map(participant => {
            if (participant.inbodyScore === undefined || participant.inbodyScore === null) return null;
            return { participant, value: participant.inbodyScore, isCurrentUser: participant.id === currentParticipantId };
        })
        .filter((e): e is Omit<LeaderboardEntry, 'rank'> => e !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

        return {
            allTimeInBodyLeaderboard: allEntries.slice(0, 20),
            currentUserInBodyEntry: allEntries.find(e => e.isCurrentUser) || null,
        };
    }, [allTimeParticipants, currentParticipantId]);
    
    const getSubTabButtonStyle = (tabName: LeaderboardSubTab) => {
        return activeTab === tabName
            ? 'bg-flexibel/20 text-flexibel'
            : 'bg-gray-100 text-gray-600 active:bg-gray-200';
    };

    if (!leaderboardSettings.leaderboardsEnabled) {
        return (
            <div className="text-center p-6 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
                <p className="font-semibold">Topplistor är för närvarande inaktiverade av coach.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="p-2 bg-gray-100 rounded-lg flex justify-center gap-2">
                <button onClick={() => setActiveTab('weekly')} className={`py-2.5 px-4 font-medium text-sm rounded-md ${getSubTabButtonStyle('weekly')}`}>
                    Veckans Utmaningar
                </button>
                <button onClick={() => setActiveTab('all-time')} className={`py-2.5 px-4 font-medium text-sm rounded-md ${getSubTabButtonStyle('all-time')}`}>
                    All-Time
                </button>
            </div>
            
            <div role="tabpanel" hidden={activeTab !== 'weekly'}>
                 <StudioFilterControl value={weeklyFilter} onChange={setWeeklyFilter} locations={locations} participantProfile={participantProfile} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {leaderboardSettings.weeklyPBChallengeEnabled && <LeaderboardCard title="🏆 Flest Personliga Rekord (PB) Denna Vecka" entries={weeklyPBLeaderboard} currentUserEntry={currentUserPBEntry} unit="PB" isProspect={isProspect} />}
                    {leaderboardSettings.weeklySessionChallengeEnabled && <LeaderboardCard title="🔥 Flest Loggade Pass Denna Vecka" entries={weeklySessionLeaderboard} currentUserEntry={currentUserSessionEntry} unit="pass" isProspect={isProspect} />}
                </div>
            </div>

            <div role="tabpanel" hidden={activeTab !== 'all-time'}>
                <StudioFilterControl value={allTimeFilter} onChange={setAllTimeFilter} locations={locations} participantProfile={participantProfile} />
                <div className="p-3 mb-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-r-lg" role="alert">
                    <p className="font-bold">Rättvis Jämförelse</p>
                    <p className="text-sm mt-1">
                        Dessa topplistor är justerade för att skapa en så rättvis jämförelse som möjligt. <strong>Relativ Styrka (FSS)</strong> tar hänsyn till din kroppsvikt, ålder och kön. Även <strong>InBody Score</strong>, som mäter kroppssammansättning, är justerat för din ålder, vilket gör poängen jämförbar mellan olika åldersgrupper.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LeaderboardCard title="💪 Topplista: Relativ Styrka (FSS)" entries={allTimeFssLeaderboard} currentUserEntry={currentUserFssEntry} unit="poäng" isProspect={isProspect} />
                    <LeaderboardCard title="🧬 Topplista: InBody Score" entries={allTimeInBodyLeaderboard} currentUserEntry={currentUserInBodyEntry} unit="poäng" isProspect={isProspect} />
                </div>
            </div>
        </div>
    );
}