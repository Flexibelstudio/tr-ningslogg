import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotifications } from '../../context/NotificationsContext';
import { NotificationItem } from './NotificationItem';

export const NotificationCenter: React.FC = () => {
  const { notifications } = useNotifications();

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 z-[100]"
    >
      <div className="w-full max-w-sm">
        <AnimatePresence initial={false}>
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
