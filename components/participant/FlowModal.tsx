import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
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
  FlowItemLogType,
  FlowItem as FlowItemType
} from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';
import { REACTION_EMOJIS, DEFAULT_COACH_EVENT_ICON } from '../../constants';
import { CommentSection } from './CommentSection';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../Button';

interface FlowItemCardProps { 
    item: any; // Using 'any' as it's a transient view model
    index: number;
    currentUserId: string;
    allParticipants: ParticipantProfile[];
    onToggleReaction: (logId: string, logType: FlowItemLogType, emoji: string) => void;
    onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
    onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
    onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
}

const FlowItemCard: React.FC<FlowItemCardProps> = React.memo(({ item, index, currentUserId, allParticipants, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction }) => {
    
    const renderReactions = () => {
        if (!item.log || !item.logType) return null;

        // FIX: Cast to Reaction[] to solve type inference issue where `allReactions` becomes `unknown`.
        const allReactions = (item.log.reactions || []) as Reaction[];
        const isMyPost = item.log.participantId === currentUserId;

        if (isMyPost) {
            if (allReactions.length === 0) {
                return (
                    <div className="mt-3 pt-2 border-t">
                        <p className="text-sm text-gray-400 italic">Inga reaktioner än.</p>
                    </div>
                );
            }

            const reactionSummary = allReactions.reduce((acc, reaction) => {
                if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
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
                            <span key={emoji} className="flex items-center text-base bg-gray-200 px-2 py-1 rounded-full cursor-help" title={whoReacted}>
                                {emoji}
                                <span className="ml-1 font-semibold text-gray-600">{participantIds.length}</span>
                            </span>
                        );
                    })}
                </div>
            );
        }

        const reactionSummary = allReactions.reduce((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const myReaction = allReactions.find(r => r.participantId === currentUserId);

        return (
            <div className="mt-3 pt-2 border-t flex flex-wrap items-center gap-1.5">
                {REACTION_EMOJIS.map(emoji => {
                    const count = reactionSummary[emoji] || 0;
                    const whoReacted = count > 0 ? allReactions.filter(r => r.emoji === emoji).map(r => {
                        if (r.participantId === currentUserId) return 'Du';
                        return allParticipants.find(p => p.id === r.participantId)?.name?.split(' ')[0] || 'Okänd';
                    }).join(', ') : `Reagera med ${emoji}`;

                    return (
                        <button
                            key={emoji}
                            onClick={() => onToggleReaction(item.log!.id, item.logType!, emoji)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-base transition-colors duration-150 ${myReaction?.emoji === emoji ? 'bg-blue-100 ring-1 ring-blue-400' : 'bg-gray-200 hover:bg-gray-300'}`}
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

    const coachEvent = item.logType === 'coach_event' ? (item.log as CoachEvent) : null;

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
                
                {coachEvent?.linkUrl && (
                    <div className="mt-3">
                        <a 
                          href={coachEvent.linkUrl.startsWith('http') ? coachEvent.linkUrl : `https://${coachEvent.linkUrl}`}
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-block"
                        >
                            <Button>
                                {coachEvent.linkButtonText || 'Läs mer här'}
                            </Button>
                        </a>
                    </div>
                )}

                {item.praiseItems && item.praiseItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {item.praiseItems.map((praise: any, index: number) => (
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
});

interface FlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  allParticipants: ParticipantProfile[];
  connections: Connection[];
  workoutLogs: WorkoutLog[]; // Still needed for fallback/migration
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
  userConditioningStatsHistory: ParticipantConditioningStat[];
}

export const FlowModal: React.FC<FlowModalProps> = ({ isOpen, onClose, currentUserId, allParticipants, connections, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction }) => {
    const { flowItems } = useAppContext();
    const [visibleCount, setVisibleCount] = useState(15);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setVisibleCount(15);
        }
    }, [isOpen]);

    const allFlowItems = useMemo(() => {
        if (!isOpen) return [];

        const allowedParticipantIds = new Set<string>([currentUserId]);
        connections.forEach(conn => {
            if (conn.status === 'accepted') {
                if (conn.requesterId === currentUserId) allowedParticipantIds.add(conn.receiverId);
                if (conn.receiverId === currentUserId) allowedParticipantIds.add(conn.requesterId);
            }
        });
        
        return (flowItems || [])
            .filter(item => {
                if (item.visibility === 'public') return true;
                return allowedParticipantIds.has(item.participantId);
            })
            .map(item => {
                const author = allParticipants.find(p => p.id === item.participantId);
                const isCoach = author?.email?.includes('@flexibel.se');
                const authorName = item.participantId === currentUserId 
                    ? 'Du' 
                    : isCoach ? 'Coach' : (author?.name || 'Okänd');
                
                return {
                    ...item,
                    date: new Date(item.timestamp),
                    authorName,
                    log: item, // The log for interactions is the item itself
                    logType: 'flow_item' as FlowItemLogType,
                    visibility: (item.visibility === 'friends' && item.participantId !== currentUserId) ? '(vänner)' as const : undefined,
                };
            })
            .sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [isOpen, flowItems, connections, currentUserId, allParticipants]);

    const flowItemsToShow = useMemo(() => {
        return allFlowItems.slice(0, visibleCount);
    }, [allFlowItems, visibleCount]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                setVisibleCount(prevCount => Math.min(prevCount + 10, allFlowItems.length));
            }
        }
    }, [allFlowItems.length]);
    
    const loadMore = () => {
        setVisibleCount(prevCount => Math.min(prevCount + 15, allFlowItems.length));
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Flöde" size="2xl">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="space-y-3 max-h-[70vh] overflow-y-auto bg-gray-100 p-3 rounded-md"
            >
                {flowItemsToShow.length > 0 ? (
                    <>
                        {flowItemsToShow.map((item, index) => (
                            <FlowItemCard 
                                key={item.id} 
                                item={item} 
                                index={index}
                                currentUserId={currentUserId}
                                allParticipants={allParticipants}
                                onToggleReaction={onToggleReaction}
                                onAddComment={onAddComment}
                                onDeleteComment={onDeleteComment}
                                onToggleCommentReaction={onToggleCommentReaction}
                            />
                        ))}
                        {allFlowItems.length > visibleCount && (
                            <div className="text-center py-4">
                                <Button onClick={loadMore} variant="outline">
                                    Läs in fler händelser
                                </Button>
                            </div>
                        )}
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
