import React, { useState, useMemo, useEffect } from 'react';
import { ParticipantProfile, ActivityLog, WorkoutLog, UserStrengthStat, LiftType, ClubDefinition, ParticipantClubMembership, LeaderboardSettings } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { calculateFlexibelStrengthScoreInternal } from '../participant/StrengthComparisonTool';
import { CLUB_DEFINITIONS, LOCAL_STORAGE_KEYS } from '../../constants';

interface LeaderboardManagementProps {
    participants: ParticipantProfile[];
    allActivityLogs: ActivityLog[];
    workoutLogs: WorkoutLog[];
    userStrengthStats: UserStrengthStat[];
    clubMemberships: ParticipantClubMembership[];
    setClubMemberships: (updater: ParticipantClubMembership[] | ((prev: ParticipantClubMembership[]) => ParticipantClubMembership[])) => void;
    leaderboardSettings: LeaderboardSettings;
    setLeaderboardSettings: (settings: LeaderboardSettings | ((prev: LeaderboardSettings) => LeaderboardSettings)) => void;
}

type LeaderboardTab = 'weekly' | 'all-time' | 'clubs';

interface LeaderboardEntry {
    participant: ParticipantProfile;
    value: number;
    rank: number;
}

const LeaderboardCard: React.FC<{ title: string; entries: LeaderboardEntry[]; unit?: string }> = ({ title, entries, unit }) => (
    <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-flexibel mb-3">{title}</h3>
        {entries.length === 0 ? (
            <p className="text-gray-500">Ingen data att visa. Medlemmar behöver delta och logga aktivitet.</p>
        ) : (
            <ol className="space-y-2">
                {entries.map(({ participant, value, rank }) => (
                    <li key={participant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold w-8 text-gray-500">{rank}.</span>
                            <span className="text-base font-medium text-gray-800">{participant.name}</span>
                        </div>
                        <span className="text-lg font-bold text-flexibel">{value.toLocaleString('sv-SE')} {unit}</span>
                    </li>
                ))}
            </ol>
        )}
    </div>
);

const ToggleSwitch: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }> = ({ id, checked, onChange, label, description }) => (
    <label htmlFor={id} className="flex items-start justify-between cursor-pointer p-2 rounded-md hover:bg-gray-100">
        <div className="flex-grow mr-4">
            <span className="font-medium text-gray-700">{label}</span>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="relative inline-flex items-center flex-shrink-0 mt-1">
            <input 
                type="checkbox" 
                id={id} 
                className="sr-only peer"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-flexibel/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flexibel"></div>
        </div>
    </label>
);


export const LeaderboardManagement: React.FC<LeaderboardManagementProps> = ({ 
    participants, 
    allActivityLogs, 
    workoutLogs, 
    userStrengthStats,
    clubMemberships,
    setClubMemberships,
    leaderboardSettings,
    setLeaderboardSettings,
}) => {
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('weekly');
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [isManagementOpen, setIsManagementOpen] = useState(true);

    const handleSettingChange = (setting: keyof LeaderboardSettings, value: boolean) => {
        setLeaderboardSettings(prev => ({...prev, [setting]: value}));
        setShowSaveConfirm(true);
        setTimeout(() => setShowSaveConfirm(false), 2000);
    };

    const optedInParticipants = useMemo(() => {
        return participants.filter(p => p.enableLeaderboardParticipation && p.isActive);
    }, [participants]);

    const weeklyLeaderboards = useMemo(() => {
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const endOfWeek = dateUtils.getEndOfWeek(new Date());
        const logsThisWeek = allActivityLogs.filter(log => {
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
        
        const pbLeaderboardEntries = Object.entries(pbCounts)
            .map(([participantId, value]) => ({ participantId, value }))
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
                const participant = optedInParticipants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1 } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null).slice(0, 10);

        const sessionCounts: { [participantId: string]: number } = {};
        logsThisWeek.forEach(log => {
            sessionCounts[log.participantId] = (sessionCounts[log.participantId] || 0) + 1;
        });

        const sessionLeaderboardEntries = Object.entries(sessionCounts)
            .map(([participantId, value]) => ({ participantId, value }))
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
                const participant = optedInParticipants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1 } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null).slice(0, 10);
            
        return { pbLeaderboard: pbLeaderboardEntries, sessionLeaderboard: sessionLeaderboardEntries };
    }, [allActivityLogs, optedInParticipants]);

    const allTimeFssLeaderboard = useMemo(() => {
        return optedInParticipants.map(participant => {
            const latestStats = userStrengthStats
                .filter(stat => stat.participantId === participant.id)
                .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
            
            if (!latestStats) return null;

            const scoreData = calculateFlexibelStrengthScoreInternal(latestStats, participant);
            return scoreData ? { participant, value: scoreData.score, rank: 0 } : null;
        })
        .filter((e): e is { participant: ParticipantProfile; value: number; rank: number; } => e !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .slice(0, 20);
    }, [optedInParticipants, userStrengthStats]);

    const allTimeInBodyLeaderboard = useMemo(() => {
        return optedInParticipants.map(participant => {
            if (participant.inbodyScore === undefined || participant.inbodyScore === null) return null;
            return { participant, value: participant.inbodyScore, rank: 0 };
        })
        .filter((e): e is { participant: ParticipantProfile; value: number; rank: number; } => e !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .slice(0, 20);
    }, [optedInParticipants]);
    
    const getTabButtonStyle = (tabName: LeaderboardTab) => {
        return activeTab === tabName
            ? 'border-flexibel text-flexibel bg-flexibel/10'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-gray-800">Topplistor & Utmaningar</h2>

            <details className="bg-gray-50 p-4 rounded-lg border" open={isManagementOpen} onToggle={(e) => setIsManagementOpen(e.currentTarget.open)}>
                <summary className="font-semibold text-lg text-gray-700 cursor-pointer select-none">Hantera Topplistor & Utmaningar</summary>
                <div className="mt-4 pt-4 border-t space-y-2">
                     <ToggleSwitch
                        id="master-leaderboard-toggle"
                        checked={leaderboardSettings.leaderboardsEnabled}
                        onChange={(val) => handleSettingChange('leaderboardsEnabled', val)}
                        label="Aktivera Topplistor"
                        description="Huvudbrytare för att visa eller dölja alla topplistor."
                    />
                     <ToggleSwitch
                        id="pb-challenge-toggle"
                        checked={leaderboardSettings.weeklyPBChallengeEnabled}
                        onChange={(val) => handleSettingChange('weeklyPBChallengeEnabled', val)}
                        label="Aktivera Veckans PB-Utmaning"
                        description="Visar en topplista över vem som slagit flest personliga rekord under veckan."
                    />
                     <ToggleSwitch
                        id="session-challenge-toggle"
                        checked={leaderboardSettings.weeklySessionChallengeEnabled}
                        onChange={(val) => handleSettingChange('weeklySessionChallengeEnabled', val)}
                        label="Aktivera Veckans Pass-Utmaning"
                        description="Visar en topplista över vem som loggat flest pass under veckan."
                    />
                    {showSaveConfirm && <span className="text-sm text-green-600 font-semibold animate-fade-in-down ml-2">Sparat!</span>}
                </div>
            </details>

            {!leaderboardSettings.leaderboardsEnabled ? (
                <div className="text-center p-6 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-200">
                    <p className="font-semibold">Topplistor är för närvarande inaktiverade.</p>
                    <p className="text-sm">Aktivera dem i panelen ovan för att visa innehåll.</p>
                </div>
            ) : (
                <>
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => setActiveTab('weekly')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('weekly')}`}>
                                Veckans Utmaningar
                            </button>
                            <button onClick={() => setActiveTab('all-time')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('all-time')}`}>
                                All-Time Topplistor
                            </button>
                            <button onClick={() => setActiveTab('clubs')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('clubs')}`}>
                                Prestationsklubbar
                            </button>
                        </nav>
                    </div>
                    
                    <div role="tabpanel" hidden={activeTab !== 'weekly'}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {leaderboardSettings.weeklyPBChallengeEnabled && <LeaderboardCard title="🏆 Flest Personliga Rekord (PB) Denna Vecka" entries={weeklyLeaderboards.pbLeaderboard} unit="PB" />}
                            {leaderboardSettings.weeklySessionChallengeEnabled && <LeaderboardCard title="🔥 Flest Loggade Pass Denna Vecka" entries={weeklyLeaderboards.sessionLeaderboard} unit="pass" />}
                        </div>
                    </div>

                    <div role="tabpanel" hidden={activeTab !== 'all-time'}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <LeaderboardCard title="💪 Topplista: Relativ Styrka (FSS)" entries={allTimeFssLeaderboard} unit="poäng" />
                            <LeaderboardCard title="🧬 Topplista: InBody Score" entries={allTimeInBodyLeaderboard} unit="poäng" />
                        </div>
                    </div>

                    <div role="tabpanel" hidden={activeTab !== 'clubs'}>
                        <div className="space-y-4">
                            {CLUB_DEFINITIONS.map(club => {
                                const members = clubMemberships
                                    .filter(m => m.clubId === club.id)
                                    .map(m => optedInParticipants.find(p => p.id === m.participantId))
                                    .filter((p): p is ParticipantProfile => !!p);
                                
                                return (
                                    <div key={club.id} className="bg-white p-4 rounded-lg shadow-md">
                                        <h3 className="text-xl font-bold text-flexibel">{club.icon} {club.name}</h3>
                                        <p className="text-sm text-gray-600 mb-3">{club.description}</p>
                                        {members.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {members.map(member => (
                                                    <span key={member.id} className="bg-gray-200 text-gray-800 text-sm font-medium px-2.5 py-1 rounded-full">
                                                        {member.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic">Inga medlemmar har uppnått detta än.</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};