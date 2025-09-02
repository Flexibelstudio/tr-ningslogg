import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserRole, StaffMember, ParticipantProfile, Organization, User } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

interface NavbarProps {
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfile }) => {
  const { user, logout, isImpersonating, stopImpersonating, isStaffViewingAsParticipant, viewAsParticipant, stopViewingAsParticipant, organizationId, currentParticipantId, currentRole } = useAuth();
  const { staffMembers, participantDirectory, allOrganizations, branding } = useAppContext();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserProfile = useMemo(() => {
    // If the current view is participant (could be a real participant or a staff member viewing as one)
    if (currentRole === UserRole.PARTICIPANT) {
      return participantDirectory.find(p => p.id === currentParticipantId);
    }
    // If it's a staff member in their own view, we might still want their linked profile for the avatar
    if (user?.linkedParticipantProfileId) {
        return participantDirectory.find(p => p.id === user.linkedParticipantProfileId);
    }
    return null;
  }, [currentRole, currentParticipantId, user, participantDirectory]);
  
  const loggedInStaff = staffMembers.find(s => s.email === user?.email);
  const currentOrganization = allOrganizations.find(o => o.id === organizationId);

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
    onOpenProfile();
    setIsMenuOpen(false);
  };

  if (!user) {
    return null;
  }
  
  const destinationView = isStaffViewingAsParticipant
      ? `Till ${user.roles.systemOwner ? 'Systemägar-vy' : (loggedInStaff?.role + '-vy') || 'Admin-vy'}`
      : 'Till Medlemsvy';

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
            {branding?.logoBase64 ? (
                <img src={branding.logoBase64} alt={`${currentOrganization?.name || APP_NAME} logotyp`} className="h-10 w-auto object-contain" />
            ) : (
                <img src="/icon-180x180.png" alt={APP_NAME} className="h-10 w-auto object-contain" />
            )}
            {isImpersonating && currentOrganization && (
                <div className="hidden sm:flex items-center gap-2 bg-yellow-100 text-yellow-800 text-sm font-semibold px-3 py-1 rounded-full">
                    <span>Adminvy för: {currentOrganization.name}</span>
                </div>
            )}
            {currentRole === UserRole.PARTICIPANT && (
                 <h1 className="text-2xl font-bold text-gray-800 hidden md:block">
                    {currentUserProfile?.name ? `, ${currentUserProfile.name.split(' ')[0]}!` : ''}
                 </h1>
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
                    name={currentUserProfile?.name || user.name} 
                    photoURL={currentUserProfile?.photoURL} 
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
                                {currentRole === UserRole.PARTICIPANT ? 'Medlem' : 
                                 (user.roles.systemOwner ? (isImpersonating ? 'Adminvy' : 'Systemägare') : 
                                 (loggedInStaff?.role || 'Personal'))
                                }
                            </p>
                        </div>
                        {user.roles.systemOwner && isImpersonating && !isStaffViewingAsParticipant && (
                            <MenuItem onClick={() => { stopImpersonating(); setIsMenuOpen(false); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                                Till systemägar-vy
                            </MenuItem>
                        )}
                        
                        <MenuItem onClick={handleProfileClick}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                            Redigera Profil
                        </MenuItem>

                        {(user.roles.orgAdmin || user.roles.systemOwner) && user.linkedParticipantProfileId && (
                            <MenuItem onClick={handleSwitchView}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                                {destinationView}
                            </MenuItem>
                        )}
                        <MenuItem onClick={logout}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
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