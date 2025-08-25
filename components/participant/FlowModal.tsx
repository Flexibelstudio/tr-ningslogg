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
  UserStrengthStat
} from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';
import { CLUB_DEFINITIONS, REACTION_EMOJIS, DEFAULT_COACH_EVENT_ICON } from '../../constants';
import * as dateUtils from '../../utils/dateUtils';
import { CommentSection } from './CommentSection';
import { calculateFlexibelStrengthScoreInternal } from './StrengthComparisonTool';
import { useAppContext } from '../../context/AppContext';

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
  onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
  onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
  isProspect?: boolean;
}

interface FlowItem {
  id: string;
  date: Date;
  type: 'COACH_EVENT' | 'NEW_PB' | 'CLUB_MEMBERSHIP' | 'WORKOUT_LOGGED' | 'GENERAL_ACTIVITY' | 'WEEKLY_CHALLENGE' | 'NEW_GOAL' | 'GOAL_COMPLETED' | 'PHYSIQUE_UPDATE' | 'FSS_INCREASE';
  icon: string;
  title: string;
  description: string;
  authorName?: string;
  log?: WorkoutLog | GeneralActivityLog | CoachEvent;
  logType?: 'workout' | 'general' | 'coach_event';
  visibility?: '(vänner)' | '(alla)';
  praiseItems?: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[];
}

interface FlowItemCardProps { 
    item: FlowItem; 
    index: number;
    currentUserId: string;
    allParticipants: ParticipantProfile[];
    onToggleReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => void;
    onAddComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => void;
    onDeleteComment: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
    onToggleCommentReaction: (logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => void;
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
                <p className="text-base text-gray-600 mt-0.5 whitespace-pre-wrap break-words">{item.description}</p>
                
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

export const FlowModal: React.FC<FlowModalProps> = ({ isOpen, onClose, currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction, isProspect }) => {
    const data = { currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings };
    const { lastFlowViewTimestamp } = useAppContext();

    const { flowItemsToShow, totalItemCount } = useMemo(() => {
        if (!isOpen) return { flowItemsToShow: [], totalItemCount: 0 };

        const allowedParticipantIds = new Set<string>([data.currentUserId]);

        if (isProspect) {
            // Prospect sees public posts from all active, non-prospect members
            data.allParticipants.forEach(p => {
                if (p.isActive && !p.isProspect && p.isSearchable) {
                    allowedParticipantIds.add(p.id);
                }
            });
        } else {
            // Existing member sees their own and friends' posts
            data.connections.forEach(conn => {
                if (conn.status === 'accepted') {
                    if (conn.requesterId === data.currentUserId) allowedParticipantIds.add(conn.receiverId);
                    if (conn.receiverId === data.currentUserId) allowedParticipantIds.add(conn.requesterId);
                }
            });
        }
        
        const items: FlowItem[] = [];
        const lastViewDate = new Date(lastFlowViewTimestamp || 0);
        
        // 1. Coach Events
        data.coachEvents.forEach(event => {
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
                visibility: '(alla)',
            });
        });

        // 2. Workout Logs (with praises but not clubs)
        data.workoutLogs.forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            const workout = data.workouts.find(w => w.id === log.workoutId);
            const moodEmoji = log.moodRating ? ['😩','😟','😐','😊','😄'][log.moodRating - 1] : '';
            
            const hasPBs = log.postWorkoutSummary?.newPBs && log.postWorkoutSummary.newPBs.length > 0;
            const praiseItems: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[] = [];
            
            // Add PBs
            if(hasPBs) {
                log.postWorkoutSummary.newPBs.forEach(pb => {
                    praiseItems.push({
                        icon: '⭐',
                        text: `Nytt Personligt Rekord i ${pb.exerciseName}: ${pb.value}.`,
                        type: 'pb'
                    });
                });
            }
            // Add Baselines
            log.postWorkoutSummary?.newBaselines?.forEach(baseline => {
                praiseItems.push({
                    icon: '📊',
                    text: `Ny baslinje satt i ${baseline.exerciseName}: ${baseline.value}.`,
                    type: 'baseline'
                });
            });

            const hasAchievements = praiseItems.length > 0;

            items.push({
                id: `log-${log.id}`,
                date: new Date(log.completedDate),
                type: hasAchievements ? 'NEW_PB' : 'WORKOUT_LOGGED',
                icon: hasAchievements ? '⭐' : '🏋️',
                title: `loggade passet: ${workout?.title || 'Okänt pass'}`,
                description: `Slutförde passet med känslan ${moodEmoji}. Total volym: ${log.postWorkoutSummary?.totalWeightLifted?.toLocaleString('sv-SE') || 0} kg.`,
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
            const moodEmoji = log.moodRating ? ['😩','😟','😐','😊','😄'][log.moodRating - 1] : '';
            const descParts = [`Slutförde ${log.durationMinutes} minuter.`];
            if (moodEmoji) descParts.push(`Känsla: ${moodEmoji}.`);
            if (log.comment) descParts.push(`Kommentar: "${log.comment}".`);

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
        
        // 4. Standalone achievements
        data.goalCompletionLogs.forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            if (!author) return;
            const authorName = log.participantId === data.currentUserId ? 'Du' : author.name || 'En vän';

            items.push({
                id: `goalcomp-${log.id}`,
                date: new Date(log.completedDate),
                type: 'GOAL_COMPLETED',
                icon: '🏆',
                title: 'uppnådde ett mål!',
                description: `Grattis! ${authorName === 'Du' ? 'Du har' : `${authorName} har`} slutfört målet: "${log.goalDescription}".`,
                authorName: authorName,
                visibility: log.participantId === data.currentUserId ? undefined : '(vänner)',
            });
        });

        data.participantGoals.forEach(goal => {
            if (!allowedParticipantIds.has(goal.participantId)) return;
             if (goal.isCompleted) return;
            const author = data.allParticipants.find(p => p.id === goal.participantId);
            if (!author) return;
            const authorName = goal.participantId === data.currentUserId ? 'Du' : author.name || 'En vän';
            
            items.push({
                id: `newgoal-${goal.id}`,
                date: new Date(goal.setDate),
                type: 'NEW_GOAL',
                icon: '🏁',
                title: 'satte ett nytt mål!',
                description: `Nytt mål: "${goal.fitnessGoals}".`,
                authorName: authorName,
                visibility: goal.participantId === data.currentUserId ? undefined : '(vänner)',
            });
        });
        
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
                const authorName = participantId === data.currentUserId ? 'Du' : author.name || 'En vän';
                items.push({
                    id: `fss-${latestStat.id}`,
                    date: new Date(latestStat.lastUpdated),
                    type: 'FSS_INCREASE',
                    icon: '🚀',
                    title: `ökade sin styrkepoäng (FSS)!`,
                    description: `Ny FSS: ${latestFss.totalScore.toFixed(1)} poäng (från ${previousFss.totalScore.toFixed(1)}). Starkt!`,
                    authorName,
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
                    description: `Ny InBody Score: ${latestHistory.inbodyScore} (från ${previousHistory.inbodyScore}). Grym utveckling!`,
                    authorName,
                    visibility: isCurrentUser ? undefined : '(vänner)',
                });
            }
        });
        
        data.clubMemberships.forEach(membership => {
            if (!allowedParticipantIds.has(membership.participantId)) return;

            const club = CLUB_DEFINITIONS.find(c => c.id === membership.clubId);
            if (!club) return;

            const author = data.allParticipants.find(p => p.id === membership.participantId);
            if (!author) return;

            const isCurrentUser = membership.participantId === data.currentUserId;
            const authorName = isCurrentUser ? 'Du' : author.name || 'En vän';

            items.push({
                id: `club-${membership.participantId}-${membership.clubId}`,
                date: new Date(membership.achievedDate),
                type: 'CLUB_MEMBERSHIP',
                icon: '🏅',
                title: 'gick med i en ny klubb!',
                description: `${authorName} har kvalificerat ${isCurrentUser ? 'dig' : 'sig'} för ${club.name}. Starkt jobbat!`,
                authorName: authorName,
                visibility: isCurrentUser ? undefined : '(vänner)',
            });
        });
        
        // 5. Weekly Challenge (synthetic)
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
        
        // Post-filter to handle potential duplicate club memberships
        const finalItems: FlowItem[] = [];
        const seenClubAchievementIds = new Set<string>();

        for (const item of sortedItems) {
            if (item.type === 'CLUB_MEMBERSHIP') {
                if (seenClubAchievementIds.has(item.id)) {
                    continue; // Skip duplicate
                }
                seenClubAchievementIds.add(item.id);
            }
            finalItems.push(item);
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

    }, [isOpen, data, isProspect, lastFlowViewTimestamp]);
    
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