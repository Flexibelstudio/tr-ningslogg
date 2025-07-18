
import React from 'react';
import { UserRole } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';

interface NavbarProps {
  currentRole: UserRole | null;
  onSetRole: (role: UserRole | null) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRole, onSetRole }) => {
  // Only render Navbar content if the role is COACH
  if (currentRole !== UserRole.COACH) {
    return null; 
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="container mx-auto px-2 py-3 flex flex-col sm:flex-row items-center justify-between">
        <div className="text-3xl font-bold mb-2 sm:mb-0" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          {APP_NAME}
        </div>
        <div className="flex items-center space-x-2">
          {/* Content below is only for COACH role, already handled by the outer conditional */}
          <span className="text-base text-gray-600">
            Roll: <span className="font-semibold">Coach</span>
          </span>
          <Button onClick={() => onSetRole(null)} variant="outline" size="sm">
              Byt roll
          </Button>
        </div>
      </div>
    </nav>
  );
};
