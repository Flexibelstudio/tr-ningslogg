import React, { useMemo } from 'react';
import { Modal } from '../Modal';
import {
  WorkoutLog,
  GeneralActivityLog,
  GoalCompletionLog,
  CoachEvent,
  Workout,
  ParticipantClubMembership,
  ParticipantGoalData,
  LeaderboardSettings,
  ParticipantProfile,
  Connection,
  Reaction,
  Comment,
  ParticipantPhysiqueStat,
  UserStrengthStat,
  Location,
  ParticipantConditioningStat,
  FlowItemLogType
} from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';
import { CLUB_DEFINITIONS, REACTION_EMOJIS, DEFAULT_COACH_EVENT_ICON } from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { CommentSection } from './CommentSection';
import { calculateFlexibelStrengthScoreInternal, getFssScoreInterpretation } from './StrengthComparisonTool';
import { useAppContext } from '../../context/AppContext';
import { getHighestClubAchievements } from '../../services/gamificationService';

// --- NEW EXPANDED TYPES ---
type FlowItemLog = WorkoutLog | GeneralActivityLog | CoachEvent | GoalCompletionLog | ParticipantClubMembership | UserStrengthStat | ParticipantPhysiqueStat | ParticipantGoalData | ParticipantConditioningStat;

interface FlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Data sources
  currentUserId: string;
  allParticipants: ParticipantProfile[];
  connections: Connection[];
  workoutLogs: WorkoutLog[];
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  coachEvents: CoachEvent[];
  workouts: Workout[];
  clubMemberships: ParticipantClubMembership[];
  participantGoals: ParticipantGoalData[];
  participantPhysiqueHistory: ParticipantPhysiqueStat[];
  userStrengthStats: UserStrengthStat[];
  leaderboardSettings: LeaderboardSettings;
  onToggleReaction: (logId: string, logType: FlowItemLogType, emoji: string) => void;
  onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
  onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  locations: Location[];
  userConditioningStatsHistory: ParticipantConditioningStat[]; // Added for new event type
}

interface FlowItem {
  id: string;
  date: Date;
  type: 'COACH_EVENT' | 'NEW_PB' | 'CLUB_MEMBERSHIP' | 'WORKOUT_LOGGED' | 'GENERAL_ACTIVITY' | 'WEEKLY_CHALLENGE' | 'PHYSIQUE_UPDATE' | 'FSS_INCREASE' | 'GOAL_COMPLETED' | 'NEW_GOAL' | 'CONDITIONING_TEST';
  icon: string;
  title: string;
  description: string;
  authorName?: string;
  log?: FlowItemLog;
  logType?: FlowItemLogType;
  visibility?: '(vänner)' | '(alla)';
  praiseItems?: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[];
}

interface FlowItemCardProps { 
    item: FlowItem; 
    index: number;
    currentUserId: string;
    allParticipants: ParticipantProfile[];
    onToggleReaction: (logId: string, logType: FlowItemLogType, emoji: string) => void;
    onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
    onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
    onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
}

const FlowItemCard: React.FC<FlowItemCardProps> = ({ item, index, currentUserId, allParticipants, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction }) => {
    
    const renderReactions = () => {
        if (!item.log || !item.logType) return null;

        const allReactions = item.log.reactions || [];
        const isMyPost = (item.log as any).participantId === currentUserId;

        // --- RENDER MY POSTS (Summary View) ---
        if (isMyPost) {
            if (allReactions.length === 0) {
                return (
                    <div className="mt-3 pt-2 border-t">
                        <p className="text-sm text-gray-400 italic">Inga reaktioner än.</p>
                    </div>
                );
            }

            const reactionSummary = allReactions.reduce((acc, reaction) => {
                if (!acc[reaction.emoji]) {
                    acc[reaction.emoji] = [];
                }
                acc[reaction.emoji].push(reaction.participantId);
                return acc;
            }, {} as Record<string, string[]>);

            const sortedEmojiParticipantIds = Object.entries(reactionSummary).sort(([, a], [, b]) => b.length - a.length);

            return (
                <div className="mt-3 pt-2 border-t flex flex-wrap items-center gap-2">
                    {sortedEmojiParticipantIds.map(([emoji, participantIds]) => {
                        const whoReacted = participantIds.map(id => {
                            if (id === currentUserId) return 'Du';
                            return allParticipants.find(p => p.id === id)?.name?.split(' ')[0] || 'Okänd';
                        }).join(', ');

                        return (
                            <span
                                key={emoji}
                                className="flex items-center text-base bg-gray-200 px-2 py-1 rounded-full cursor-help"
                                title={whoReacted}
                            >
                                {emoji}
                                <span className="ml-1 font-semibold text-gray-600">{participantIds.length}</span>
                            </span>
                        );
                    })}
                </div>
            );
        }

        // --- RENDER OTHERS' POSTS (Interactive View) ---
        const reactionSummary = allReactions.reduce((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const myReaction = allReactions.find(r => r.participantId === currentUserId);

        return (
            <div className="mt-3 pt-2 border-t flex flex-wrap items-center gap-1.5">
                {REACTION_EMOJIS.map(emoji => {
                    const count = reactionSummary[emoji] || 0;
                    
                    const whoReacted = count > 0 ? allReactions
                        .filter(r => r.emoji === emoji)
                        .map(r => {
                            if (r.participantId === currentUserId) return 'Du';
                            return allParticipants.find(p => p.id === r.participantId)?.name?.split(' ')[0] || 'Okänd';
                        })
                        .join(', ') : `Reagera med ${emoji}`;

                    return (
                        <button
                            key={emoji}
                            onClick={() => onToggleReaction(item.log!.id, item.logType!, emoji)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-base transition-colors duration-150 ${
                                myReaction?.emoji === emoji ? 'bg-blue-100 ring-1 ring-blue-400' : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                            aria-pressed={myReaction?.emoji === emoji}
                            aria-label={whoReacted}
                            title={whoReacted}
                        >
                            <span>{emoji}</span>
                            {count > 0 && <span className="font-semibold text-sm text-gray-600">{count}</span>}
                        </button>
                    );
                })}
            </div>
        );
    }
    
    const titlePrefix = item.authorName ? <span className="font-bold">{item.authorName}</span> : null;
    const praiseTypeStyles: Record<'pb' | 'baseline' | 'club', string> = {
        pb: 'bg-yellow-50 border-yellow-300',
        baseline: 'bg-blue-50 border-blue-300',
        club: 'bg-green-50 border-green-300',
    };

    return (
        <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200" style={{ animation: `fadeInDown 0.5s ease-out ${index * 50}ms backwards` }}>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <h4 className="flex-grow text-base font-semibold text-gray-800 break-words">
                        <span className="text-2xl mr-2 align-middle">{item.icon}</span>
                        <span className="align-middle">
                            {titlePrefix} {item.title} 
                            {item.visibility && <span className="text-sm text-gray-400 font-normal ml-1">{item.visibility}</span>}
                        </span>
                    </h4>
                    <p className="text-sm text-gray-500 flex-shrink-0 ml-2">{formatRelativeTime(item.date)}</p>
                </div>
                {item.description && <p className="text-base text-gray-600 mt-0.5 whitespace-pre-wrap break-words">{item.description}</p>}
                
                {item.praiseItems && item.praiseItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {item.praiseItems.map((praise, index) => (
                            <div key={index} className={`p-2 border-l-4 rounded-r-md ${praiseTypeStyles[praise.type]}`}>
                                <p className="text-base font-medium text-gray-700">
                                    <span className="text-2xl mr-2 align-middle">{praise.icon}</span>
                                    <span className="align-middle">{praise.text}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {item.log && item.logType && (
                    <>
                        {renderReactions()}
                        <CommentSection
                            logId={item.log.id}
                            logType={item.logType}
                            comments={item.log.comments || []}
                            currentUserId={currentUserId}
                            onAddComment={onAddComment}
                            onDeleteComment={onDeleteComment}
                            onToggleCommentReaction={onToggleCommentReaction}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export const FlowModal: React.FC<FlowModalProps> = ({ isOpen, onClose, currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction, locations, userConditioningStatsHistory }) => {
    const data = { currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings, locations, userConditioningStatsHistory };
    const { lastFlowViewTimestamp } = useAppContext();

    const { flowItemsToShow, totalItemCount } = useMemo(() => {
        if (!isOpen) return { flowItemsToShow: [], totalItemCount: 0 };

        const allowedParticipantIds = new Set<string>([data.currentUserId]);
        
        data.connections.forEach(conn => {
            if (conn.status === 'accepted') {
                if (conn.requesterId === data.currentUserId) allowedParticipantIds.add(conn.receiverId);
                if (conn.receiverId === data.currentUserId) allowedParticipantIds.add(conn.requesterId);
            }
        });
        
        const items: FlowItem[] = [];
        const lastViewDate = new Date(lastFlowViewTimestamp || 0);
        
        const currentUserProfile = data.allParticipants.find(p => p.id === data.currentUserId);
        const currentUserLocation = currentUserProfile ? data.locations.find(l => l.id === currentUserProfile.locationId) : null;

        // 1. Coach Events
        data.coachEvents.forEach(event => {
            if (event.studioTarget && event.studioTarget !== 'all') {
                if (!currentUserLocation || !currentUserLocation.name.toLowerCase().includes(event.studioTarget)) {
                    return; // Skip this event if location doesn't match
                }
            }
            items.push({
                id: `coach-${event.id}`,
                date: new Date((event as any).createdDate || (event as any).date), // Handle old data
                type: 'COACH_EVENT',
                icon: DEFAULT_COACH_EVENT_ICON,
                title: `${event.title}`,
                description: (event.eventDate ? `Datum: ${new Date(event.eventDate).toLocaleDateString('sv-SE')}. ` : '') + (event.description || ''),
                authorName: 'Coach',
                log: event,
                logType: 'coach_event',
                visibility: event.studioTarget === 'all' ? '(alla)' : undefined,
            });
        });

        // 2. Workout Logs
        data.workoutLogs.forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            const workout = data.workouts.find(w => w.id === log.workoutId);
            
            const hasPBs = log.postWorkoutSummary?.newPBs && log.postWorkoutSummary.newPBs.length > 0;
            const praiseItems: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[] = [];
            
            if(hasPBs) {
                log.postWorkoutSummary.newPBs.forEach(pb => {
                    praiseItems.push({
                        icon: '⭐',
                        text: `Nytt Personligt Rekord i ${pb.exerciseName}: ${pb.value}.`,
                        type: 'pb'
                    });
                });
            }
            const hasAchievements = praiseItems.length > 0;

            items.push({
                id: `log-${log.id}`,
                date: new Date(log.completedDate),
                type: hasAchievements ? 'NEW_PB' : 'WORKOUT_LOGGED',
                icon: hasAchievements ? '⭐' : '🏋️',
                title: `loggade passet: ${workout?.title || 'Okänt pass'}`,
                description: ``,
                authorName,
                log,
                logType: 'workout',
                visibility: log.participantId === data.currentUserId ? undefined : '(vänner)',
                praiseItems: praiseItems.length > 0 ? praiseItems : undefined
            });
        });
        
        // 3. General Activity Logs
        data.generalActivityLogs.forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            
            const descParts = [`${log.durationMinutes} minuter`];
            if (log.distanceKm) {
                descParts.push(`- ${log.distanceKm} km`);
            }

            items.push({
                id: `general-${log.id}`,
                date: new Date(log.completedDate),
                type: 'GENERAL_ACTIVITY',
                icon: '🤸',
                title: `loggade aktiviteten: ${log.activityName}`,
                description: descParts.join(' '),
                authorName,
                log,
                logType: 'general',
                visibility: log.participantId === data.currentUserId ? undefined : '(vänner)',
            });
        });

        // 4. Goal Completion Logs
        data.goalCompletionLogs.forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            
            items.push({
                id: `goalcomp-${log.id}`,
                date: new Date(log.completedDate),
                type: 'GOAL_COMPLETED',
                icon: '🏆',
                title: `uppnådde ett mål!`,
                description: `Starkt jobbat!`,
                authorName,
                log,
                logType: 'goal_completion',
                visibility: log.participantId === data.currentUserId ? undefined : '(vänner)',
            });
        });
        
        // 5. Standalone achievements
        const statsByParticipant = data.userStrengthStats.reduce((acc, stat) => {
            if (!acc[stat.participantId]) acc[stat.participantId] = [];
            acc[stat.participantId].push(stat);
            return acc;
        }, {} as Record<string, UserStrengthStat[]>);

        Object.entries(statsByParticipant).forEach(([participantId, stats]) => {
            if (!allowedParticipantIds.has(participantId) || stats.length < 2) return;
            const sortedStats = stats.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
            const author = data.allParticipants.find(p => p.id === participantId);
            if (!author) return;

            const latestStat = sortedStats[sortedStats.length - 1];
            const previousStat = sortedStats[sortedStats.length - 2];
            const latestFss = calculateFlexibelStrengthScoreInternal(latestStat, author);
            const previousFss = calculateFlexibelStrengthScoreInternal(previousStat, author);

            if (latestFss && previousFss && latestFss.totalScore > previousFss.totalScore) {
                const levelInfo = getFssScoreInterpretation(latestFss.totalScore);
                const authorName = participantId === data.currentUserId ? 'Du' : author.name || 'En vän';
                items.push({
                    id: `fss-${latestStat.id}`,
                    date: new Date(latestStat.lastUpdated),
                    type: 'FSS_INCREASE',
                    icon: '🚀',
                    title: `ökade sin styrkepoäng (FSS)!`,
                    description: levelInfo
                        ? `Nådde nivån ${levelInfo.label} med ${latestFss.totalScore} poäng (från ${previousFss.totalScore}). Starkt!`
                        : `Ny FSS: ${latestFss.totalScore} poäng (från ${previousFss.totalScore}). Starkt!`,
                    authorName,
                    log: latestStat,
                    logType: 'user_strength_stat',
                    visibility: participantId === data.currentUserId ? undefined : '(vänner)',
                });
            }
        });

        const physiqueByParticipant = data.participantPhysiqueHistory.reduce((acc, history) => {
            if (!acc[history.participantId]) acc[history.participantId] = [];
            acc[history.participantId].push(history);
            return acc;
        }, {} as Record<string, ParticipantPhysiqueStat[]>);

        Object.entries(physiqueByParticipant).forEach(([participantId, history]) => {
            if (!allowedParticipantIds.has(participantId) || history.length < 2) return;
            const sortedHistory = history.sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
            const author = data.allParticipants.find(p => p.id === participantId);
            if (!author) return;

            const isCurrentUser = participantId === data.currentUserId;
            if (!isCurrentUser && !author.enableInBodySharing) {
                return; // Do not show InBody updates to friends if sharing is disabled
            }

            const latestHistory = sortedHistory[sortedHistory.length - 1];
            const previousHistory = sortedHistory[sortedHistory.length - 2];

            if (latestHistory.inbodyScore && previousHistory.inbodyScore && latestHistory.inbodyScore > previousHistory.inbodyScore) {
                const authorName = isCurrentUser ? 'Du' : author.name || 'En vän';
                items.push({
                    id: `inbody-increase-${latestHistory.id}`,
                    date: new Date(latestHistory.lastUpdated),
                    type: 'PHYSIQUE_UPDATE',
                    icon: '🧬',
                    title: `höjde sin InBody-poäng!`,
                    description: `Grym utveckling på InBody-mätningen! Ny poäng: ${latestHistory.inbodyScore} (från ${previousHistory.inbodyScore}).`,
                    authorName,
                    log: latestHistory,
                    logType: 'participant_physique_stat',
                    visibility: isCurrentUser ? undefined : '(vänner)',
                });
            }
        });
        
        const allVisibleMemberships = data.clubMemberships.filter(m => allowedParticipantIds.has(m.participantId));
        const membershipsByParticipant = allVisibleMemberships.reduce((acc, membership) => {
            if (!acc[membership.participantId]) {
                acc[membership.participantId] = [];
            }
            acc[membership.participantId].push(membership);
            return acc;
        }, {} as Record<string, ParticipantClubMembership[]>);

        const highestMembershipsToDisplay: ParticipantClubMembership[] = [];
        for (const participantId in membershipsByParticipant) {
            const participantMemberships = membershipsByParticipant[participantId];
            const highest = getHighestClubAchievements(participantMemberships);
            highestMembershipsToDisplay.push(...highest);
        }
        
        highestMembershipsToDisplay.forEach(membership => {
            const club = CLUB_DEFINITIONS.find(c => c.id === membership.clubId);
            if (!club) return;
            const author = data.allParticipants.find(p => p.id === membership.participantId);
            if (!author) return;
            const isCurrentUser = membership.participantId === data.currentUserId;
            const authorName = isCurrentUser ? 'Du' : author.name || 'En vän';

            items.push({
                id: `club-${membership.id}`,
                date: new Date(membership.achievedDate),
                type: 'CLUB_MEMBERSHIP',
                icon: '🏅',
                title: 'gick med i en ny klubb!',
                description: `${authorName} har kvalificerat ${isCurrentUser ? 'dig' : 'sig'} för ${club.name}. Starkt jobbat!`,
                authorName: authorName,
                log: membership,
                logType: 'participant_club_membership',
                visibility: isCurrentUser ? undefined : '(vänner)',
            });
        });
        
        data.userConditioningStatsHistory.forEach(stat => {
            if (!allowedParticipantIds.has(stat.participantId)) return;
            const author = data.allParticipants.find(p => p.id === stat.participantId);
            if (!author) return;
            const isCurrentUser = stat.participantId === data.currentUserId;
            const authorName = isCurrentUser ? 'Du' : author.name || 'En vän';

            const results: string[] = [];
            if (stat.airbike4MinKcal) results.push(`Airbike: ${stat.airbike4MinKcal} kcal`);
            if (stat.skierg4MinMeters) results.push(`SkiErg: ${stat.skierg4MinMeters} m`);
            if (stat.rower4MinMeters) results.push(`Rodd: ${stat.rower4MinMeters} m`);
            if (stat.treadmill4MinMeters) results.push(`Löpband: ${stat.treadmill4MinMeters} m`);
            if (stat.rower2000mTimeSeconds) {
                const minutes = Math.floor(stat.rower2000mTimeSeconds / 60);
                const seconds = stat.rower2000mTimeSeconds % 60;
                results.push(`Rodd 2000m: ${minutes}:${String(seconds).padStart(2, '0')}`);
            }

            if (results.length > 0) {
                items.push({
                    id: `cond-${stat.id}`,
                    date: new Date(stat.lastUpdated),
                    type: 'CONDITIONING_TEST',
                    icon: '💨',
                    title: `loggade ett konditionstest!`,
                    description: results.join(' | '),
                    authorName,
                    log: stat,
                    logType: 'participant_conditioning_stat',
                    visibility: isCurrentUser ? undefined : '(vänner)',
                });
            }
        });

        // 6. Weekly Challenge (synthetic)
        if (data.leaderboardSettings.weeklyPBChallengeEnabled || data.leaderboardSettings.weeklySessionChallengeEnabled) {
            const startOfWeek = dateUtils.getStartOfWeek(new Date());
            items.push({
                id: `challenge-${dateUtils.getEpochWeekId(startOfWeek)}`,
                date: startOfWeek,
                type: 'WEEKLY_CHALLENGE',
                icon: '🔥',
                title: 'Veckans Utmaning är igång!',
                description: 'Logga pass och sätt nya PBs för att klättra på topplistan. Kör hårt!',
                authorName: 'Systemet',
                visibility: '(alla)',
            });
        }

        const sortedItems = items.sort((a, b) => b.date.getTime() - a.date.getTime());
        
        // Post-filter to handle potential duplicate club memberships by only showing the highest tier
        const finalItems: FlowItem[] = [];
        const seenItemIds = new Set<string>();

        for (const item of sortedItems) {
            if (!seenItemIds.has(item.id)) {
                finalItems.push(item);
                seenItemIds.add(item.id);
            }
        }

        // Apply the 5-day filter
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 4);
        fiveDaysAgo.setHours(0, 0, 0, 0);

        const itemsLast5Days = finalItems.filter(item => item.date >= fiveDaysAgo);

        return {
            flowItemsToShow: itemsLast5Days,
            totalItemCount: itemsLast5Days.length
        };

    }, [isOpen, data, lastFlowViewTimestamp]);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Flöde" size="2xl">
            <div className="space-y-3 max-h-[70vh] overflow-y-auto bg-gray-100 p-3 rounded-md">
                {flowItemsToShow.length > 0 ? (
                    <>
                        {flowItemsToShow.map((item, index) => (
                            <FlowItemCard 
                                key={item.id} 
                                item={item} 
                                index={index}
                                currentUserId={data.currentUserId}
                                allParticipants={data.allParticipants}
                                onToggleReaction={onToggleReaction}
                                onAddComment={onAddComment}
                                onDeleteComment={onDeleteComment}
                                onToggleCommentReaction={onToggleCommentReaction}
                            />
                        ))}
                    </>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-xl text-gray-500">Flödet är tomt.</p>
                        <p className="text-lg text-gray-400">Logga ett pass eller sätt ett mål för att komma igång!</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};