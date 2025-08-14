import React, { useState, useRef, useEffect } from 'react';
import { UserRole, StaffMember, ParticipantProfile, Organization, User } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

interface NavbarProps {
  onOpenProfileInParticipantView: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfileInParticipantView }) => {
  const { user, logout, isImpersonating, stopImpersonating, isStaffViewingAsParticipant, viewAsParticipant, stopViewingAsParticipant, organizationId } = useAuth();
  const { staffMembers, participantDirectory, allOrganizations } = useAppContext();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const loggedInStaff = staffMembers.find(s => s.email === user?.email);
  const currentOrganization = allOrganizations.find(o => o.id === organizationId);

  const correspondingParticipantForStaff = user?.linkedParticipantProfileId 
    ? participantDirectory.find(p => p.id === user.linkedParticipantProfileId)
    : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSwitchView = () => {
    if (isStaffViewingAsParticipant) {
      stopViewingAsParticipant();
    } else {
      viewAsParticipant();
    }
    setIsMenuOpen(false);
  };

  const handleProfileClick = () => {
    onOpenProfileInParticipantView();
    setIsMenuOpen(false);
  };

  if (!user || (!user.roles.systemOwner && !user.roles.orgAdmin)) {
    return null;
  }

  const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode; }> = ({ onClick, children }) => (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-base text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center gap-3 transition-colors"
      role="menuitem"
    >
      {children}
    </button>
  );

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
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel transition-transform duration-200 hover:scale-105"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                aria-label="Öppna användarmeny"
            >
                <Avatar 
                    name={user.name} 
                    photoURL={correspondingParticipantForStaff?.photoURL} 
                    size="md"
                    className="!h-11 !w-11"
                />
            </button>
            {isMenuOpen && (
                 <div
                    className="absolute right-0 mt-2 w-56 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-scale-in"
                    role="menu"
                    aria-orientation="vertical"
                 >
                    <div className="py-1">
                        <div className="px-4 py-3 border-b">
                            <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500">
                                {isStaffViewingAsParticipant ? 'Medlemsvy' : (user.roles.systemOwner ? 'Systemägare' : loggedInStaff?.role)}
                            </p>
                        </div>
                        {user.linkedParticipantProfileId && (
                            <MenuItem onClick={handleProfileClick}>
                                <span className="text-lg" role="img" aria-label="profil">👤</span>
                                Profil
                            </MenuItem>
                        )}
                        {user.linkedParticipantProfileId && (
                            <MenuItem onClick={handleSwitchView}>
                                <span className="text-lg" role="img" aria-label="växla vy">🔄</span>
                                {isStaffViewingAsParticipant ? 'Växla till Coachvy' : 'Växla till Medlemsvy'}
                            </MenuItem>
                        )}
                        <MenuItem onClick={logout}>
                            <span className="text-lg" role="img" aria-label="logga ut">🚪</span>
                            Logga ut
                        </MenuItem>
                    </div>
                 </div>
            )}
        </div>
      </div>
    </nav>
  );
};