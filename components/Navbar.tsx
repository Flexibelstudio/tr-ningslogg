import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserRole, StaffMember, ParticipantProfile, Organization, User } from '../types';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

// --- ICONS ---
const GoalIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5l-7.5 7.5-3.5-3.5" /></svg>;
const FlowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const CommunityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const AiReceptIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>;

interface NavbarProps {
  onOpenProfile: () => void;
  onOpenGoalModal?: () => void;
  onOpenCommunity?: () => void;
  onOpenAiRecept?: () => void;
  onOpenFlowModal?: () => void;
  aiRecept?: string | null;
  newFlowItemsCount?: number;
  pendingRequestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
    onOpenProfile, 
    onOpenGoalModal, 
    onOpenCommunity, 
    onOpenAiRecept, 
    onOpenFlowModal, 
    aiRecept, 
    newFlowItemsCount, 
    pendingRequestsCount 
}) => {
  const { user, logout, isImpersonating, stopImpersonating, isStaffViewingAsParticipant, viewAsParticipant, stopViewingAsParticipant, organizationId, currentParticipantId, currentRole } = useAuth();
  const { staffMembers, participantDirectory, allOrganizations, branding } = useAppContext();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserProfile = useMemo(() => {
    if (currentRole === UserRole.PARTICIPANT) {
      return participantDirectory.find(p => p.id === currentParticipantId);
    }
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
                <img src={branding.logoBase64} alt={`${currentOrganization?.name || APP_NAME} logotyp`} className="h-14 w-auto object-contain" />
            ) : (
                <img src="/icon-180x180.png" alt={APP_NAME} className="h-14 w-auto object-contain" />
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
        
        <div className="flex items-center gap-2 sm:gap-4">
            {currentRole === UserRole.PARTICIPANT && (
              <div className="flex items-center gap-0 sm:gap-1">
                <button onClick={onOpenGoalModal} className="p-2 rounded-full text-flexibel hover:bg-flexibel/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel" title="Mål & Plan" aria-label="Mål & Plan"><GoalIcon /></button>
                {aiRecept && <button onClick={onOpenAiRecept} className="p-2 rounded-full text-flexibel hover:bg-flexibel/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel" title="AI Recept" aria-label="AI Recept"><AiReceptIcon /></button>}
                <button onClick={onOpenFlowModal} className="relative p-2 rounded-full text-flexibel hover:bg-flexibel/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel" title="Flöde" aria-label="Flöde"><FlowIcon />
                  {newFlowItemsCount > 0 && (
                      <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{newFlowItemsCount}</span>
                  )}
                </button>
                <button onClick={onOpenCommunity} className="relative p-2 rounded-full text-flexibel hover:bg-flexibel/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel" title="Community" aria-label="Community"><CommunityIcon />
                  {pendingRequestsCount > 0 && (
                      <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{pendingRequestsCount}</span>
                  )}
                </button>
              </div>
            )}

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
                        className="h-9 w-9"
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
      </div>
    </nav>
  );
};