
import React, { useState } from 'react';
// FIX: Import `FlowItemLogType` from the central types file instead of defining it locally.
import { Comment, FlowItemLogType } from '../../types';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
// FIX: Correct the import path for dateUtils.
import { formatRelativeTime } from '../../utils/dateUtils';


interface CommentSectionProps {
  logId: string;
  logType: FlowItemLogType;
  comments: Comment[];
  currentUserId: string;
  onAddComment: (logId: string, logType: FlowItemLogType, text: string) => void;
  onDeleteComment: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: FlowItemLogType, commentId: string) => void;
  readOnly?: boolean;
  containerClassName?: string;
  inputClassName?: string;
  isDarkBackground?: boolean;
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
  containerClassName = "mt-3 pt-3 border-t",
  inputClassName,
  isDarkBackground = false,
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

  const textClass = isDarkBackground ? "text-white/90" : "text-gray-700";
  const nameClass = isDarkBackground ? "text-white font-bold" : "text-gray-800 font-semibold";
  const timeClass = isDarkBackground ? "text-white/60" : "text-gray-500";
  const hoverBgClass = isDarkBackground ? "hover:bg-white/10" : "hover:bg-gray-100";

  return (
    <div className={containerClassName}>
      {sortedComments.length > 0 && (
        <div className="space-y-1 mb-3">
          {sortedComments.map(comment => {
            const myLike = comment.reactions?.find(r => r.participantId === currentUserId && r.emoji === '❤️');
            const likeCount = comment.reactions?.filter(r => r.emoji === '❤️').length || 0;
            return (
              <div key={comment.id} className={`group flex items-start gap-2 text-base p-1.5 rounded-md ${hoverBgClass}`}>
                <div className="flex-grow">
                  <div>
                    <span className={nameClass}>
                        {comment.authorId === currentUserId ? 'Du' : comment.authorName.split(' ')[0]}
                    </span>
                    <span className={`${timeClass} ml-2 text-xs`}>{formatRelativeTime(comment.createdDate).relative}</span>
                  </div>
                  <p className={`${textClass} whitespace-pre-wrap break-words mt-0.5 text-sm`}>{comment.text}</p>
                  
                  {/* LIKE BUTTON AND COUNT */}
                  <div className="mt-1 flex items-center">
                      <button
                          onClick={() => onToggleCommentReaction(logId, logType, comment.id)}
                          className={`flex items-center gap-1 text-xs transition-colors rounded-full p-1 -ml-1 ${myLike ? 'text-red-500' : (isDarkBackground ? 'text-white/50 hover:text-red-400' : 'text-gray-400 hover:text-red-400')}`}
                          aria-pressed={!!myLike}
                          aria-label={myLike ? 'Ta bort gilla-markering' : 'Gilla kommentar'}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-all duration-150`} fill={myLike ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                      </button>
                      {likeCount > 0 && (
                          <span className={`text-xs font-semibold ${isDarkBackground ? 'text-white/70' : 'text-gray-600'}`}>{likeCount}</span>
                      )}
                  </div>
                </div>
                {comment.authorId === currentUserId && (
                  <button
                    onClick={() => onDeleteComment(logId, logType, comment.id)}
                    className={`opacity-40 hover:opacity-100 focus:opacity-100 p-2 rounded-full transition-opacity flex-shrink-0 ${isDarkBackground ? 'text-white hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
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
            className={`text-sm !py-2 !px-3 flex-grow transition-all duration-200 ${inputClassName || ''}`}
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
