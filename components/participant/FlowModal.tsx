
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
  UserNotification
} from '../../types';
import { formatRelativeTime } from '../../utils/dateUtils';
import { CLUB_DEFINITIONS, REACTION_EMOJIS, DEFAULT_COACH_EVENT_ICON } from '../../constants';
import { CommentSection } from './CommentSection';
import { useAppContext } from '../../context/AppContext';
import { getHighestClubAchievements } from '../../services/gamificationService';
import { Button } from '../Button';
import { useParticipantOperations } from '../../features/participant/hooks/useParticipantOperations';
import { Avatar } from '../Avatar';

// --- TYPES ---
type FlowItemLog = WorkoutLog | GeneralActivityLog | CoachEvent | GoalCompletionLog | ParticipantClubMembership | UserStrengthStat | ParticipantPhysiqueStat | ParticipantGoalData | ParticipantConditioningStat | UserNotification;

type FilterType = 'all' | 'mine' | 'coach' | 'pb' | 'club';

interface FlowModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  userConditioningStatsHistory: ParticipantConditioningStat[];
}

interface FlowItem {
  id: string;
  date: Date;
  type: 'COACH_EVENT' | 'NEW_PB' | 'CLUB_MEMBERSHIP' | 'WORKOUT_LOGGED' | 'GENERAL_ACTIVITY' | 'WEEKLY_CHALLENGE' | 'PHYSIQUE_UPDATE' | 'FSS_INCREASE' | 'GOAL_COMPLETED' | 'NEW_GOAL' | 'CONDITIONING_TEST' | 'USER_NOTIFICATION';
  icon: string;
  title: string;
  description: string;
  authorName?: string;
  authorId?: string;
  log?: FlowItemLog;
  logType?: FlowItemLogType;
  praiseItems?: { icon: string; text: string; type: 'pb' | 'baseline' | 'club' }[];
  action?: { label: string, onClick: () => void };
}

// --- HELPER COMPONENTS ---

const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void; icon?: string }> = ({ label, active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap border ${
      active
        ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
    }`}
  >
    {icon && <span className="text-base">{icon}</span>}
    {label}
  </button>
);

// --- MAIN CARD COMPONENT ---

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

const FlowItemCard: React.FC<FlowItemCardProps> = React.memo(({ item, index, currentUserId, allParticipants, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction }) => {
    const [isLikesExpanded, setIsLikesExpanded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    
    // Helper to get author profile image
    const authorProfile = allParticipants.find(p => p.id === item.authorId);
    
    const allReactions = ((item.log as any)?.reactions || []) as Reaction[];
    const comments = (item.log as any)?.comments || [];
    const hasComments = comments.length > 0;

    const reactionNames = useMemo(() => {
        if (!allReactions.length) return [];
        const names = allReactions.map(r => {
            if (r.participantId === currentUserId) return 'Du';
            return allParticipants.find(p => p.id === r.participantId)?.name?.split(' ')[0] || 'Okänd';
        });
        return Array.from(new Set(names));
    }, [allReactions, allParticipants, currentUserId]);

    const isCoachEvent = item.type === 'COACH_EVENT';
    const isUserNotification = item.type === 'USER_NOTIFICATION';
    const coachEvent = item.logType === 'coach_event' ? (item.log as CoachEvent) : null;

    // --- STYLING CONFIG ---
    const containerClass = isCoachEvent 
        ? "bg-gradient-to-br from-flexibel to-teal-600 shadow-lg border-none text-white"
        : "bg-white border border-gray-100 shadow-sm text-gray-800";

    const textTitleClass = isCoachEvent ? "text-white" : "text-gray-900";
    const textDescClass = isCoachEvent ? "text-white/90" : "text-gray-600";
    const textTimeClass = isCoachEvent ? "text-white/70" : "text-gray-400";
    const dividerClass = isCoachEvent ? "border-white/20" : "border-gray-100";
    const actionBtnClass = isCoachEvent 
        ? "bg-white/20 text-white hover:bg-white/30 border-transparent" 
        : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200";
    const activeReactionClass = isCoachEvent
        ? "bg-white text-flexibel shadow-sm"
        : "bg-blue-50 text-blue-600 border-blue-200";

    const renderReactions = () => {
        if (!item.log || !item.logType || isUserNotification) return null;
        
        const reactionSummary = allReactions.reduce<Record<string, number>>((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
        }, {});

        const myReaction = allReactions.find(r => r.participantId === currentUserId);

        return (
            <div className="flex flex-wrap gap-2">
                {REACTION_EMOJIS.map(emoji => {
                    const count = reactionSummary[emoji] || 0;
                    const isActive = myReaction?.emoji === emoji;
                    return (
                        <button
                            key={emoji}
                            onClick={() => onToggleReaction(item.log!.id, item.logType!, emoji)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-all active:scale-95 border ${isActive ? activeReactionClass : actionBtnClass}`}
                        >
                            <span>{emoji}</span>
                            {count > 0 && <span className="font-bold text-xs opacity-90 ml-0.5">{count}</span>}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div 
            className={`rounded-2xl p-4 mb-3 relative overflow-hidden ${containerClass}`}
            style={{ animation: `fadeInDown 0.4s ease-out ${index * 50}ms backwards` }}
        >
             {/* Decorative bg element for coach cards */}
             {isCoachEvent && (
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
             )}

            <div className="flex items-start gap-3 relative z-10">
                {/* Avatar */}
                <Avatar 
                    name={item.authorName} 
                    photoURL={authorProfile?.photoURL} 
                    size="md" 
                    className={`flex-shrink-0 shadow-sm ${isCoachEvent ? "ring-2 ring-white/30" : ""}`} 
                />

                <div className="flex-grow min-w-0 pt-0.5">
                    {/* Header Row */}
                    <div className="flex justify-between items-baseline mb-1">
                         <h4 className={`text-base font-bold truncate ${textTitleClass}`}>
                            {item.authorName}
                        </h4>
                        <span className={`text-xs ${textTimeClass} whitespace-nowrap ml-2 flex-shrink-0`}>
                            {formatRelativeTime(item.date).relative}
                        </span>
                    </div>

                    {/* Content */}
                    <div>
                        <div className="flex items-start gap-1.5">
                            {/* Small Inline Icon */}
                            <span className="text-lg leading-snug mt-px">{item.icon}</span>
                            <div className="flex-1">
                                <p className={`text-base font-bold leading-snug ${textTitleClass}`}>
                                    {item.title}
                                </p>
                                {item.description && (
                                    <p className={`text-sm mt-1 whitespace-pre-wrap leading-relaxed ${textDescClass}`}>
                                        {item.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Coach Link */}
                        {coachEvent?.linkUrl && (
                            <div className="mt-3 pl-6">
                                <a 
                                    href={coachEvent.linkUrl.startsWith('http') ? coachEvent.linkUrl : `https://${coachEvent.linkUrl}`}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-block"
                                >
                                    <Button size="sm" variant={isCoachEvent ? 'secondary' : 'primary'} className={isCoachEvent ? 'bg-white text-teal-700 border-none shadow-sm hover:bg-gray-100' : ''}>
                                        {coachEvent.linkButtonText || 'Läs mer'}
                                    </Button>
                                </a>
                            </div>
                        )}

                        {/* Action Button */}
                        {item.action && (
                             <div className="mt-3 pl-6">
                                <Button size="sm" onClick={item.action.onClick}>{item.action.label}</Button>
                            </div>
                        )}

                        {/* Praise Items (PBs, etc.) */}
                        {item.praiseItems && item.praiseItems.length > 0 && (
                            <div className="mt-3 pl-6 space-y-1.5">
                                {item.praiseItems.map((praise, i) => (
                                    <div key={i} className={`flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg w-fit ${isCoachEvent ? 'bg-white/20 text-white' : 'bg-yellow-50 text-yellow-900 border border-yellow-100'}`}>
                                        <span className="text-sm">{praise.icon}</span>
                                        <span className="font-semibold">{praise.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            {item.log && item.logType && !isUserNotification && (
                <div className={`mt-3 pt-3 border-t ${dividerClass} relative z-10`}>
                    <div className="flex items-center justify-between">
                        {renderReactions()}
                        
                        <button 
                            onClick={() => setShowComments(!showComments)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${actionBtnClass}`}
                        >
                            <span className="text-base">💬</span>
                            {hasComments ? <span className="font-bold">{comments.length}</span> : <span className="text-xs font-medium opacity-80">Kommentera</span>}
                        </button>
                    </div>

                    {/* Likers Text */}
                    {reactionNames.length > 0 && (
                        <button 
                            onClick={() => setIsLikesExpanded(!isLikesExpanded)}
                            className={`mt-2 text-xs hover:underline text-left block ${textTimeClass}`}
                        >
                            {isLikesExpanded 
                                ? reactionNames.join(', ') 
                                : (reactionNames.length === 1
                                    ? `${reactionNames[0]} gillar detta`
                                    : `${reactionNames[0]} och ${reactionNames.length - 1} till gillar detta`)
                            }
                        </button>
                    )}

                    {/* Comments */}
                    {showComments && (
                        <div className="mt-3 animate-fade-in">
                             <CommentSection
                                logId={item.log.id}
                                logType={item.logType}
                                comments={comments}
                                currentUserId={currentUserId}
                                onAddComment={onAddComment}
                                onDeleteComment={onDeleteComment}
                                onToggleCommentReaction={onToggleCommentReaction}
                                readOnly={false}
                                className={isCoachEvent ? "bg-white/10 rounded-xl p-2 text-white placeholder-white/70" : "bg-gray-50 rounded-xl p-2"}
                                isDarkBackground={isCoachEvent}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
FlowItemCard.displayName = 'FlowItemCard';

// --- FLOW MODAL COMPONENT ---

const FlowModalFC: React.FC<FlowModalProps> = ({ isOpen, onClose, currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings, onToggleReaction, onAddComment, onDeleteComment, onToggleCommentReaction, locations, userConditioningStatsHistory }) => {
    const { lastFlowViewTimestamp, userNotifications, markAllNotificationsAsRead, participantBookings } = useAppContext();
    const { handleBookClass } = useParticipantOperations(currentUserId);
    
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [visibleCount, setVisibleCount] = useState(15);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const data = { currentUserId, allParticipants, connections, workoutLogs, generalActivityLogs, goalCompletionLogs, coachEvents, workouts, clubMemberships, participantGoals, participantPhysiqueHistory, userStrengthStats, leaderboardSettings, locations, userConditioningStatsHistory, userNotifications };

    useEffect(() => {
        if (isOpen) {
            setVisibleCount(15);
            markAllNotificationsAsRead(currentUserId);
        }
    }, [isOpen, markAllNotificationsAsRead, currentUserId]);

    const allFlowItems = useMemo(() => {
        if (!isOpen) return [];

        const allowedParticipantIds = new Set<string>([data.currentUserId]);
        
        (data.connections || []).forEach(conn => {
            if (conn.status === 'accepted') {
                if (conn.requesterId === data.currentUserId) allowedParticipantIds.add(conn.receiverId);
                if (conn.receiverId === data.currentUserId) allowedParticipantIds.add(conn.requesterId);
            }
        });
        
        const items: FlowItem[] = [];
        const currentUserProfile = data.allParticipants.find(p => p.id === data.currentUserId);
        const currentUserLocation = currentUserProfile ? data.locations.find(l => l.id === currentUserProfile.locationId) : null;

        // 0. User Notifications
        const myNotifications = (data.userNotifications || []).filter(n => n.recipientId === data.currentUserId);
        myNotifications.forEach(notif => {
             const created = new Date(notif.createdAt);
             const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3); threeDaysAgo.setHours(0, 0, 0, 0);
             if (created >= threeDaysAgo) {
                 let action = undefined;
                 if (notif.type === 'FRIEND_BOOKING' && notif.relatedScheduleId && notif.relatedClassDate) {
                     const isAlreadyBooked = participantBookings.some(b => 
                         b.participantId === currentUserId && b.scheduleId === notif.relatedScheduleId && b.classDate === notif.relatedClassDate && 
                         (b.status === 'BOOKED' || b.status === 'WAITLISTED' || b.status === 'CHECKED-IN')
                     );
                     if (!isAlreadyBooked) {
                        action = {
                            label: 'Haka på (Boka)',
                            onClick: () => { handleBookClass(currentUserId, notif.relatedScheduleId!, notif.relatedClassDate!); onClose(); }
                        };
                     }
                 }
                 items.push({
                     id: `notif-${notif.id}`, date: created, type: 'USER_NOTIFICATION',
                     icon: notif.type === 'FRIEND_BOOKING' ? '👯‍♀️' : (notif.type === 'CLASS_CANCELLED' ? '🚫' : 'ℹ️'),
                     title: notif.title, description: notif.body, log: notif, logType: 'user_notification', action, authorName: 'System'
                 });
             }
        });

        // 1. Coach Events
        (data.coachEvents || []).forEach(event => {
            if (event.targetParticipantIds && !event.targetParticipantIds.includes(data.currentUserId)) return;
            if (!event.targetParticipantIds && event.studioTarget && event.studioTarget !== 'all') {
                if (!currentUserLocation || !currentUserLocation.name.toLowerCase().includes(event.studioTarget)) return;
            }
            items.push({
                id: `coach-${event.id}`, date: new Date((event as any).createdDate || (event as any).date),
                type: 'COACH_EVENT', icon: event.title.includes("INSTÄLLT") ? '❗️' : DEFAULT_COACH_EVENT_ICON,
                title: `${event.title}`, description: (event.eventDate ? `Datum: ${new Date(event.eventDate).toLocaleDateString('sv-SE')}. ` : '') + (event.description || ''),
                authorName: 'Coach', authorId: 'coach', log: event, logType: 'coach_event',
            });
        });

        // 2. Workout Logs
        (data.workoutLogs || []).forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            const workout = data.workouts.find(w => w.id === log.workoutId);
            const hasPBs = log.postWorkoutSummary?.newPBs && log.postWorkoutSummary.newPBs.length > 0;
            const praiseItems = hasPBs ? log.postWorkoutSummary!.newPBs.map(pb => ({ icon: '⭐', text: `Nytt PB: ${pb.exerciseName} (${pb.value})`, type: 'pb' as const })) : undefined;

            items.push({
                id: `log-${log.id}`, date: new Date(log.completedDate),
                type: hasPBs ? 'NEW_PB' : 'WORKOUT_LOGGED', icon: hasPBs ? '🔥' : '🏋️',
                title: `loggade passet: ${workout?.title || 'Okänt pass'}`, description: log.postWorkoutComment || '', authorName, authorId: log.participantId,
                log, logType: 'workout', praiseItems
            });
        });
        
        // 3. General Activity Logs
        (data.generalActivityLogs || []).forEach(log => {
            if (!allowedParticipantIds.has(log.participantId)) return;
            const author = data.allParticipants.find(p => p.id === log.participantId);
            const authorName = log.participantId === data.currentUserId ? 'Du' : author?.name || 'En vän';
            items.push({
                id: `general-${log.id}`, date: new Date(log.completedDate), type: 'GENERAL_ACTIVITY', icon: '🏃',
                title: `loggade aktiviteten: ${log.activityName}`, description: `${log.durationMinutes} minuter ${log.distanceKm ? `• ${log.distanceKm} km` : ''} ${log.comment ? `\n"${log.comment}"` : ''}`,
                authorName, authorId: log.participantId, log, logType: 'general',
            });
        });

        // 4. Clubs
        const allVisibleMemberships = (data.clubMemberships || []).filter(m => allowedParticipantIds.has(m.participantId));
        const highestMemberships = getHighestClubAchievements(allVisibleMemberships); 
        highestMemberships.forEach(membership => {
            const club = CLUB_DEFINITIONS.find(c => c.id === membership.clubId);
            const author = data.allParticipants.find(p => p.id === membership.participantId);
            if (club && author) {
                items.push({
                    id: `club-${membership.id}`, date: new Date(membership.achievedDate), type: 'CLUB_MEMBERSHIP', icon: '🏅',
                    title: 'gick med i en ny klubb!', description: `${membership.participantId === data.currentUserId ? 'Du' : author.name} har kvalificerat sig för ${club.name}.`,
                    authorName: membership.participantId === data.currentUserId ? 'Du' : author.name, authorId: membership.participantId,
                    log: membership, logType: 'participant_club_membership', praiseItems: [{ icon: club.icon, text: club.name, type: 'club' }]
                });
            }
        });

        const sortedItems = items.sort((a, b) => b.date.getTime() - a.date.getTime());
        const uniqueItems = Array.from(new Set(sortedItems.map(i => i.id))).map(id => sortedItems.find(i => i.id === id)!);
        
        // Filter out older than 14 days to keep list relevant
        const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() - 14); cutoffDate.setHours(0, 0, 0, 0);
        return uniqueItems.filter(item => item.date >= cutoffDate);

    }, [isOpen, data, handleBookClass, participantBookings]);

    const filteredItems = useMemo(() => {
        return allFlowItems.filter(item => {
            if (item.type === 'WEEKLY_CHALLENGE') return false; 

            switch (activeFilter) {
                case 'mine': return item.authorId === currentUserId;
                case 'coach': return item.type === 'COACH_EVENT';
                case 'pb': return item.type === 'NEW_PB' || item.type === 'FSS_INCREASE';
                case 'club': return item.type === 'CLUB_MEMBERSHIP';
                default: return true;
            }
        });
    }, [allFlowItems, activeFilter, currentUserId]);

    const itemsToShow = filteredItems.slice(0, visibleCount);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                setVisibleCount(prev => Math.min(prev + 10, filteredItems.length));
            }
        }
    }, [filteredItems.length]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Flöde & Notiser" size="xl">
            <div className="flex flex-col h-[80vh] -mx-4 sm:mx-0">
                {/* Filter Bar */}
                <div className="px-4 pt-2 pb-4 border-b border-gray-100 flex gap-2 overflow-x-auto no-scrollbar">
                    <FilterChip label="Alla" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
                    <FilterChip label="Mina" active={activeFilter === 'mine'} onClick={() => setActiveFilter('mine')} icon="👤" />
                    <FilterChip label="Coach" active={activeFilter === 'coach'} onClick={() => setActiveFilter('coach')} icon="📣" />
                    <FilterChip label="PBs" active={activeFilter === 'pb'} onClick={() => setActiveFilter('pb')} icon="💪" />
                    <FilterChip label="Klubbar" active={activeFilter === 'club'} onClick={() => setActiveFilter('club')} icon="🏅" />
                </div>

                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-4"
                >
                    {itemsToShow.length > 0 ? (
                        <>
                            {itemsToShow.map((item, index) => (
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
                            {filteredItems.length > visibleCount && (
                                <div className="text-center py-6">
                                    <Button onClick={() => setVisibleCount(p => p + 10)} variant="ghost">Visa fler</Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                            <span className="text-5xl mb-4">📭</span>
                            <p className="text-lg font-medium">Inget att visa just nu.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export const FlowModal = React.memo(FlowModalFC);
