import React, { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ParticipantProfile, ActivityLog, WorkoutLog, UserStrengthStat, ClubDefinition, ParticipantClubMembership, LeaderboardSettings } from '../../types';
import * as dateUtils from '../../utils/dateUtils';
import { calculateFlexibelStrengthScoreInternal } from './StrengthComparisonTool';
import { CLUB_DEFINITIONS } from '../../constants';

interface ParticipantLeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentParticipantId: string;
    participants: ParticipantProfile[]; // These are already filtered to opted-in participants
    allActivityLogs: ActivityLog[];
    userStrengthStats: UserStrengthStat[];
    clubMemberships: ParticipantClubMembership[];
    leaderboardSettings: LeaderboardSettings;
}

type LeaderboardTab = 'weekly' | 'all-time' | 'clubs';

interface LeaderboardEntry {
    participant: ParticipantProfile;
    value: number;
    rank: number;
    isCurrentUser: boolean;
}

const LeaderboardCard: React.FC<{ title: string; entries: LeaderboardEntry[]; unit?: string, currentUserEntry?: LeaderboardEntry | null }> = ({ title, entries, unit, currentUserEntry }) => (
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
        {currentUserEntry && !entries.some(e => e.isCurrentUser) && (
             <div className="mt-3 pt-3 border-t">
                <p className="flex items-center justify-between p-2 rounded-md bg-flexibel/20 border-2 border-flexibel">
                    <span className="flex items-center">
                        <span className="text-lg font-semibold w-8 text-flexibel">{currentUserEntry.rank}.</span>
                        <span className="text-base font-medium text-gray-800">Du</span>
                    </span>
                    <span className="text-lg font-bold text-flexibel">{currentUserEntry.value.toLocaleString('sv-SE')} {unit}</span>
                </p>
             </div>
        )}
    </div>
);

export const ParticipantLeaderboardModal: React.FC<ParticipantLeaderboardModalProps> = ({
    isOpen, onClose, currentParticipantId, participants, allActivityLogs, userStrengthStats, clubMemberships, leaderboardSettings
}) => {
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('weekly');

    const { weeklyPBLeaderboard, weeklySessionLeaderboard, currentUserPBEntry, currentUserSessionEntry } = useMemo(() => {
        const startOfWeek = dateUtils.getStartOfWeek(new Date());
        const endOfWeek = dateUtils.getEndOfWeek(new Date());
        const logsThisWeek = allActivityLogs.filter(log => {
            const participant = participants.find(p => p.id === log.participantId);
            if (!participant) return false;
            const completedDate = new Date(log.completedDate);
            return completedDate >= startOfWeek && completedDate <= endOfWeek;
        });
        
        // PB Leaderboard
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
                const participant = participants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1, isCurrentUser: participant.id === currentParticipantId } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null);
        
        const weeklyPBLeaderboard = allPbEntries.slice(0, 10);
        const currentUserPBEntry = allPbEntries.find(e => e.isCurrentUser) || null;

        // Session Leaderboard
        const sessionCounts: { [participantId: string]: number } = {};
        logsThisWeek.forEach(log => {
            sessionCounts[log.participantId] = (sessionCounts[log.participantId] || 0) + 1;
        });
        const allSessionEntries = Object.entries(sessionCounts)
            .map(([participantId, value]) => ({ participantId, value }))
            .sort((a, b) => b.value - a.value)
            .map((entry, index) => {
                const participant = participants.find(p => p.id === entry.participantId);
                return participant ? { participant, value: entry.value, rank: index + 1, isCurrentUser: participant.id === currentParticipantId } : null;
            })
            .filter((e): e is LeaderboardEntry => e !== null);

        const weeklySessionLeaderboard = allSessionEntries.slice(0, 10);
        const currentUserSessionEntry = allSessionEntries.find(e => e.isCurrentUser) || null;

        return { weeklyPBLeaderboard, weeklySessionLeaderboard, currentUserPBEntry, currentUserSessionEntry };
    }, [allActivityLogs, participants, currentParticipantId]);

    const { allTimeFssLeaderboard, currentUserFssEntry } = useMemo(() => {
        const allEntries = participants.map(participant => {
            const latestStats = userStrengthStats
                .filter(stat => stat.participantId === participant.id)
                .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
            if (!latestStats) return null;
            const scoreData = calculateFlexibelStrengthScoreInternal(latestStats, participant);
            return scoreData ? { participant, value: scoreData.score, isCurrentUser: participant.id === currentParticipantId } : null;
        })
        .filter((e): e is Omit<LeaderboardEntry, 'rank'> => e !== null)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

        return {
            allTimeFssLeaderboard: allEntries.slice(0, 20),
            currentUserFssEntry: allEntries.find(e => e.isCurrentUser) || null,
        };
    }, [participants, userStrengthStats, currentParticipantId]);

    const { allTimeInBodyLeaderboard, currentUserInBodyEntry } = useMemo(() => {
        const allEntries = participants.map(participant => {
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
    }, [participants, currentParticipantId]);
    
    const getTabButtonStyle = (tabName: LeaderboardTab) => {
        return activeTab === tabName
            ? 'border-flexibel text-flexibel bg-flexibel/10'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
    };

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Topplistor & Utmaningar" size="2xl">
        <div className="space-y-4 min-h-[50vh]">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap gap-x-4 gap-y-2" aria-label="Tabs">
                    <button onClick={() => setActiveTab('weekly')} className={`py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('weekly')}`}>
                        Veckans Utmaningar
                    </button>
                    <button onClick={() => setActiveTab('all-time')} className={`py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('all-time')}`}>
                        All-Time Topplistor
                    </button>
                    <button onClick={() => setActiveTab('clubs')} className={`py-3 px-4 border-b-2 font-medium text-base rounded-t-lg ${getTabButtonStyle('clubs')}`}>
                        Prestationsklubbar
                    </button>
                </nav>
            </div>
            
            <div role="tabpanel" hidden={activeTab !== 'weekly'}>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {leaderboardSettings.weeklyPBChallengeEnabled 
                        ? <LeaderboardCard title="🏆 Flest Personliga Rekord (PB) Denna Vecka" entries={weeklyPBLeaderboard} currentUserEntry={currentUserPBEntry} unit="PB" />
                        : <div className="p-4 bg-gray-50 rounded-lg shadow-md text-gray-500">Veckans PB-utmaning är inaktiverad av coach.</div>
                    }
                    {leaderboardSettings.weeklySessionChallengeEnabled 
                        ? <LeaderboardCard title="🔥 Flest Loggade Pass Denna Vecka" entries={weeklySessionLeaderboard} currentUserEntry={currentUserSessionEntry} unit="pass" />
                        : <div className="p-4 bg-gray-50 rounded-lg shadow-md text-gray-500">Veckans pass-utmaning är inaktiverad av coach.</div>
                    }
                </div>
            </div>

            <div role="tabpanel" hidden={activeTab !== 'all-time'}>
                <div className="p-3 mb-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-r-lg" role="alert">
                    <p className="font-bold">Rättvis Jämförelse</p>
                    <p className="text-sm mt-1">
                        Dessa topplistor är justerade för att skapa en så rättvis jämförelse som möjligt. <strong>Relativ Styrka (FSS)</strong> tar hänsyn till din kroppsvikt, ålder och kön. Även <strong>InBody Score</strong>, som mäter kroppssammansättning, är justerat för din ålder, vilket gör poängen jämförbar mellan olika åldersgrupper.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LeaderboardCard title="💪 Topplista: Relativ Styrka (FSS)" entries={allTimeFssLeaderboard} currentUserEntry={currentUserFssEntry} unit="poäng" />
                    <LeaderboardCard title="🧬 Topplista: InBody Score" entries={allTimeInBodyLeaderboard} currentUserEntry={currentUserInBodyEntry} unit="poäng" />
                </div>
            </div>

            <div role="tabpanel" hidden={activeTab !== 'clubs'}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                    {CLUB_DEFINITIONS.map(club => {
                        const members = clubMemberships
                            .filter(m => m.clubId === club.id)
                            .map(m => participants.find(p => p.id === m.participantId))
                            .filter((p): p is ParticipantProfile => !!p);
                        
                        const isCurrentUserMember = members.some(m => m.id === currentParticipantId);
                        
                        return (
                            <div key={club.id} className={`p-4 rounded-lg shadow-md transition-all ${isCurrentUserMember ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-white'}`}>
                                <h3 className="text-xl font-bold text-flexibel">{club.icon} {club.name}</h3>
                                <p className="text-sm text-gray-600 mb-3">{club.description}</p>
                                {members.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {members.map(member => (
                                            <span key={member.id} className={`text-sm font-medium px-2.5 py-1 rounded-full ${member.id === currentParticipantId ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-800'}`}>
                                                {member.id === currentParticipantId ? 'Du' : member.name}
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
        </div>
        <div className="flex justify-end pt-4 border-t mt-4">
            <Button onClick={onClose} variant="primary">Stäng</Button>
        </div>
      </Modal>
    );
}