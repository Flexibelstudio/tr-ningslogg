import React from 'react';
import { useNetworkStatus } from '../context/NetworkStatusContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-yellow-500 text-white text-center p-2 font-semibold animate-fade-in-down"
    >
      Du är offline. Vissa funktioner är begränsade.
    </div>
  );
};