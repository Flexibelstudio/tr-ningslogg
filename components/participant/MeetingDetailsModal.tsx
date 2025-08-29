import React from 'react';
import { Modal } from '../Modal';
import { OneOnOneSession, StaffMember } from '../../types';
import { Button } from '../Button';
import { CommentSection } from './CommentSection';

interface MeetingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: OneOnOneSession | null;
  coach: StaffMember | null;
  currentUserId: string;
  onAddComment: (logId: string, logType: 'one_on_one_session', text: string) => void;
  onDeleteComment: (logId: string, logType: 'one_on_one_session', commentId: string) => void;
  onToggleCommentReaction: (logId: string, logType: 'one_on_one_session', commentId: string) => void;
  readOnlyComments?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const MeetingDetailsModal: React.FC<MeetingDetailsModalProps> = ({ 
    isOpen, onClose, session, coach, currentUserId, onAddComment, onDeleteComment, onToggleCommentReaction, readOnlyComments = false, onEdit, onDelete 
}) => {
    if (!isOpen || !session) return null;

    const formattedStartTime = new Date(session.startTime).toLocaleString('sv-SE', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const formattedEndTime = new Date(session.endTime).toLocaleTimeString('sv-SE', {
        hour: '2-digit', minute: '2-digit'
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={session.title} size="lg">
            <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-md border text-lg">
                    <p><strong>Datum & Tid:</strong> {formattedStartTime} - {formattedEndTime}</p>
                    <p><strong>Med:</strong> {coach?.name || 'Okänd Coach'}</p>
                    <p className="mt-2"><strong>Syfte:</strong> <span className="italic">{session.purpose}</span></p>
                </div>

                <CommentSection
                    logId={session.id}
                    logType={'one_on_one_session'}
                    comments={session.comments || []}
                    currentUserId={currentUserId}
                    onAddComment={onAddComment}
                    onDeleteComment={onDeleteComment}
                    onToggleCommentReaction={onToggleCommentReaction}
                    readOnly={readOnlyComments}
                />
            </div>
            {(onEdit || onDelete) && (
                <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                    {onDelete && <Button onClick={onDelete} variant="danger">Ta bort</Button>}
                    {onEdit && <Button onClick={onEdit} variant="primary">Redigera</Button>}
                </div>
            )}
        </Modal>
    );
};