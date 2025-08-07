import React from 'react';
import { UserRole, StaffMember, ParticipantProfile } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';
import { Avatar } from './Avatar';

interface NavbarProps {
  currentRole: UserRole | null;
  onSetRole: (role: UserRole | null) => void;
  loggedInStaff: StaffMember | null;
  loggedInStaffAsParticipant?: ParticipantProfile | null;
  hasParticipantProfile: boolean;
  onSwitchToParticipantView: () => void;
  onLogoutStaff: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onSetRole,
  loggedInStaff,
  loggedInStaffAsParticipant,
  hasParticipantProfile,
  onSwitchToParticipantView,
  onLogoutStaff,
}) => {
  // Only render Navbar content if the role is COACH (meaning a staff member is logged in)
  if (!loggedInStaff) {
    return null;
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="text-3xl font-bold" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          {APP_NAME}
        </div>
        <div className="flex items-center space-x-3">
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">{loggedInStaff.name}</span>
                    <span className="text-xs text-gray-500 block">{loggedInStaff.role}</span>
                </div>
                <Avatar 
                    name={loggedInStaff.name} 
                    photoURL={loggedInStaffAsParticipant?.photoURL} 
                    size="sm"
                />
            </div>
            <div className="h-8 border-l border-gray-200"></div>
            <div className="flex items-center space-x-2">
              {hasParticipantProfile && (
                <Button onClick={onSwitchToParticipantView} variant="outline" size="sm">
                  Medlemsvy
                </Button>
              )}
              <Button onClick={onLogoutStaff} variant="secondary" size="sm">
                Logga ut
              </Button>
            </div>
        </div>
      </div>
    </nav>
  );
};
