import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-flexibel"></div>
  </div>
);
