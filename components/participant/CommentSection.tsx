import React, { useState } from 'react';
import { Comment } from '../../types';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { formatRelativeTime } from '../../utils/dateUtils';

// FIX: Widened the logType to match all possible commentable items from the Flow view.
type FlowItemLogType = 'workout' | 'general' | 'coach_event' | 'one_on_one_session' | 'goal_completion' | 'participant_club_membership' | 'user_strength_stat' | 'participant_physique_stat' | 'participant_goal_data' | 'participant_conditioning_stat';

interface CommentSectionProps {
  logId: string;
  logType: FlowItemLogType;
  comments: Comment[];
  currentUserId: string;
  onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
  onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  readOnly?: boolean;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

export const CommentSection: React.FC<CommentSectionProps> = ({
  logId,
  logType,
  comments,
  currentUserId,
  onAddComment,
  onDeleteComment,
  onToggleCommentReaction,
  readOnly = false,
}) => {
  const [newComment, setNewComment] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(logId, logType, newComment.trim());
      setNewComment('');
      setIsFocused(false);
    }
  };

  const sortedComments = [...comments].sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());

  return (
    <div className="mt-3 pt-3 border-t">
      {sortedComments.length > 0 && (
        <div className="space-y-1 mb-3">
          {sortedComments.map(comment => {
            const myLike = comment.reactions?.find(r => r.participantId === currentUserId && r.emoji === '❤️');
            const likeCount = comment.reactions?.filter(r => r.emoji === '❤️').length || 0;
            return (
              <div key={comment.id} className="group flex items-start gap-2 text-base p-1.5 rounded-md hover:bg-gray-100">
                <div className="flex-grow">
                  <div>
                    <span className="font-semibold text-gray-800">
                        {comment.authorId === currentUserId ? 'Du' : comment.authorName.split(' ')[0]}
                    </span>
                    <span className="text-gray-500 ml-2 text-sm">{formatRelativeTime(comment.createdDate)}</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap break-words mt-0.5">{comment.text}</p>
                  
                  {/* LIKE BUTTON AND COUNT */}
                  <div className="mt-1 flex items-center">
                      <button
                          onClick={() => onToggleCommentReaction(logId, logType, comment.id)}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors rounded-full p-1 -ml-1"
                          aria-pressed={!!myLike}
                          aria-label={myLike ? 'Ta bort gilla-markering' : 'Gilla kommentar'}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-all duration-150 ${myLike ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`} fill={myLike ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                      </button>
                      {likeCount > 0 && (
                          <span className="text-sm font-semibold text-gray-600">{likeCount}</span>
                      )}
                  </div>
                </div>
                {comment.authorId === currentUserId && (
                  <button
                    onClick={() => onDeleteComment(logId, logType, comment.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 rounded-full transition-opacity flex-shrink-0"
                    aria-label="Ta bort kommentar"
                    title="Ta bort kommentar"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
            <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => !newComment && setIsFocused(false)}
            placeholder="Skriv en kommentar..."
            rows={isFocused || newComment ? 2 : 1}
            className="text-base !py-2 !px-3 flex-grow transition-all duration-200"
            />
            {(isFocused || newComment) && (
                <Button type="submit" size="sm" className="!py-2 !px-3 self-end" disabled={!newComment.trim()}>
                    Skicka
                </Button>
            )}
        </form>
      )}
    </div>
  );
};