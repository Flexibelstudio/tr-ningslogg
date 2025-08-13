import React from 'react';
import { UserRole, StaffMember, ParticipantProfile, Organization, User } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

export const Navbar: React.FC = () => {
  const { user, logout, isImpersonating, stopImpersonating, isStaffViewingAsParticipant, viewAsParticipant, stopViewingAsParticipant, organizationId } = useAuth();
  const { staffMembers, participantDirectory, allOrganizations } = useAppContext();
  
  const loggedInStaff = staffMembers.find(s => s.email === user?.email);
  const currentOrganization = allOrganizations.find(o => o.id === organizationId);

  const correspondingParticipantForStaff = user?.linkedParticipantProfileId 
    ? participantDirectory.find(p => p.id === user.linkedParticipantProfileId)
    : undefined;

  const handleSwitchView = () => {
    if (isStaffViewingAsParticipant) {
      stopViewingAsParticipant();
    } else {
      viewAsParticipant();
    }
  };

  // Corrected Visibility Logic: Show navbar if the user is fundamentally a staff member (Admin/Owner),
  // regardless of whether they are currently viewing as a participant.
  if (!user || (!user.roles.systemOwner && !user.roles.orgAdmin)) {
    return null;
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="text-3xl font-bold" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
              {APP_NAME}
            </div>
            {isImpersonating && currentOrganization && (
                <div className="hidden sm:flex items-center gap-2 bg-yellow-100 text-yellow-800 text-sm font-semibold px-3 py-1 rounded-full">
                    <span>Adminvy för: {currentOrganization.name}</span>
                    <button onClick={stopImpersonating} className="font-bold underline hover:text-yellow-900">Avsluta</button>
                </div>
            )}
        </div>
        <div className="flex items-center space-x-3">
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">{user.name}</span>
                    <span className="text-xs text-gray-500 block">
                        {user.roles.systemOwner ? 'Systemägare' : loggedInStaff?.role}
                    </span>
                </div>
                <Avatar 
                    name={user.name} 
                    photoURL={correspondingParticipantForStaff?.photoURL} 
                    size="sm"
                />
            </div>
            <div className="h-8 border-l border-gray-200"></div>
            <div className="flex items-center space-x-2">
              {user.linkedParticipantProfileId && (
                <Button onClick={handleSwitchView} variant="outline" size="sm">
                  {isStaffViewingAsParticipant ? 'Byt till Coachvy' : 'Byt till Medlemsvy'}
                </Button>
              )}
              <Button onClick={logout} variant="secondary" size="sm">
                Logga ut
              </Button>
            </div>
        </div>
      </div>
    </nav>
  );
};