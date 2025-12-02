
import React, { useMemo } from 'react';
import { UserNotification } from '../types';
import { formatRelativeTime } from '../utils/dateUtils';
import { Button } from './Button';

interface NotificationDropdownProps {
  notifications: UserNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onClose 
}) => {
  
  // Sort notifications: unread first, then by date descending
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notifications]);

  const getIcon = (type: UserNotification['type']) => {
    switch(type) {
        case 'FRIEND_BOOKING': return '👯‍♀️';
        case 'CLASS_CANCELLED': return '🚫';
        case 'CLASS_CHANGED': return '⚠️';
        case 'WAITLIST_PROMOTION': return '🎟️';
        default: return 'ℹ️';
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden animate-scale-in origin-top-right">
      <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-800">Notiser</h3>
        <div className="flex gap-2">
             {notifications.some(n => !n.read) && (
                <button 
                    onClick={onMarkAllAsRead}
                    className="text-xs text-flexibel font-medium hover:underline"
                >
                    Markera alla som lästa
                </button>
            )}
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto">
        {sortedNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                <p className="text-2xl mb-2">🔕</p>
                <p>Inga nya notiser.</p>
            </div>
        ) : (
            <ul className="divide-y divide-gray-100">
                {sortedNotifications.map(notif => (
                    <li 
                        key={notif.id} 
                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => {
                            if(!notif.read) onMarkAsRead(notif.id);
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 text-2xl mt-1">
                                {getIcon(notif.type)}
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className={`text-sm font-semibold ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                        {notif.title}
                                    </p>
                                    {!notif.read && <span className="w-2 h-2 bg-flexibel rounded-full mt-1.5 flex-shrink-0"></span>}
                                </div>
                                <p className="text-sm text-gray-600 mt-0.5 break-words">{notif.body}</p>
                                <p className="text-xs text-gray-400 mt-1.5">
                                    {formatRelativeTime(notif.createdAt).relative}
                                </p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};
