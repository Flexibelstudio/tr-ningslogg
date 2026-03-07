
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ParticipantProfile, OneOnOneSession, ActivityLog, StaffMember, CoachNote, ParticipantGoalData, WorkoutLog, Membership, ProspectIntroCall, Lead, Location, ContactAttempt, ContactAttemptMethod } from '../../types';
import { Button } from '../Button';
import { MemberNotesModal } from '../coach/MemberNotesModal';
import * as dateUtils from '../../utils/dateUtils';
import { InfoModal } from '../participant/InfoModal';
import { useAppContext } from '../../context/AppContext';
import { IntroCallModal } from '../coach/IntroCallModal';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { Select, Input } from '../Input';
import { ConfirmationModal } from '../ConfirmationModal';
import { useClientJourney } from '../../features/coach/hooks/useClientJourney';
import { LogContactModal } from '../coach/LogContactModal';
import { CONTACT_ATTEMPT_OUTCOME_OPTIONS, CONTACT_ATTEMPT_METHOD_OPTIONS } from '../../constants';
import { useNotifications } from '../../context/NotificationsContext';

interface ClientJourneyViewProps {
  participants: ParticipantProfile[];
  oneOnOneSessions: OneOnOneSession[];
  allActivityLogs: ActivityLog[];
  loggedInStaff: StaffMember | null;
  allParticipantGoals: ParticipantGoalData[];
  coachNotes: CoachNote[];
  isOnline: boolean;
}

const EngagementIndicator: React.FC<{ level: 'green' | 'yellow' | 'red' | 'neutral' }> = ({ level }) => {
    const levelConfig = {
        green: { color: 'bg-green-500', tooltip: 'Aktiv nyligen' },
        yellow: { color: 'bg-yellow-500', tooltip: 'Minskad aktivitet' },
        red: { color: 'bg-red-500', tooltip: 'Inaktiv / Riskzon' },
        neutral: { color: 'bg-gray-400', tooltip: 'Ingen loggad aktivitet' },
    };
    const { color, tooltip } = levelConfig[level];
    return <span className={`inline-block h-3 w-3 rounded-full ${color}`} title={tooltip}></span>;
};

const AddLeadModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (data: any) => void; locations: Location[] }> = ({ isOpen, onClose, onSave, locations }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [locationId, setLocationId] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setLocationId(locations[0]?.id || '');
        }
    }, [isOpen, locations]);

    const handleSave = () => {
        if (!firstName || !lastName || !email) return;
        onSave({ firstName, lastName, email, phone, locationId });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Lägg till lead">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Förnamn" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    <Input label="Efternamn" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
                <Input label="E-post" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
                <Select label="Studio" value={locationId} onChange={e => setLocationId(e.target.value)} options={locations.map(l => ({ value: l.id, label: l.name }))} />
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                    <Button onClick={handleSave}>Spara</Button>
                </div>
            </div>
        </Modal>
    );
};


export const ClientJourneyView: React.FC<ClientJourneyViewProps> = ({
  participants,
  oneOnOneSessions,
  allActivityLogs,
  loggedInStaff,
  allParticipantGoals,
  coachNotes,
  isOnline,
}) => {
    const {
        locations,
        staffMembers,
        integrationSettings,
        smsTemplates,
    } = useAppContext();

    const { addNotification } = useNotifications();

    const {
        activeTab,
        setActiveTab,
        activeLeadFilter,
        setActiveLeadFilter,
        activeFilter,
        setActiveFilter,
        introCallView,
        setIntroCallView,
        filteredAndSortedData,
        leadCounts,
        filteredLeads,
        newLeadsList,
        actionableIntroCalls,
        archivedIntroCalls,
        counts,
        handleSaveLead,
        handleSaveIntroCall,
        handleUpdateIntroCall,
        handleConfirmLink,
        handleConfirmMarkAsJunk,
        handleRestoreLead,
        handlePermanentDeleteLead,
        handleSaveContactAttempt,
    } = useClientJourney(loggedInStaff);
    
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isIntroCallModalOpen, setIsIntroCallModalOpen] = useState(false);
  const [callToEdit, setCallToEdit] = useState<ProspectIntroCall | null>(null);
  const [callToLink, setCallToLink] = useState<ProspectIntroCall | null>(null);
  const [participantToLinkId, setParticipantToLinkId] = useState<string>('');
  const [leadBeingConverted, setLeadBeingConverted] = useState<Lead | null>(null);
  const [leadToMarkAsJunk, setLeadToMarkAsJunk] = useState<Lead | null>(null);
  const [leadToDeletePermanent, setLeadToDeletePermanent] = useState<Lead | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  
  const [leadToLogContact, setLeadToLogContact] = useState<Lead | null>(null);
  const [expandedLeadHistoryIds, setExpandedLeadHistoryIds] = useState<Set<string>>(new Set());


  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  const handleCreateIntroCallFromLead = (lead: Lead) => {
    setLeadBeingConverted(lead);
    setIsIntroCallModalOpen(true);
  };

  const handleConfirmDeletePermanent = () => {
    if (leadToDeletePermanent) {
        handlePermanentDeleteLead(leadToDeletePermanent);
        setLeadToDeletePermanent(null);
    }
  };

  const toggleHistory = (leadId: string) => {
      setExpandedLeadHistoryIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(leadId)) newSet.delete(leadId);
          else newSet.add(leadId);
          return newSet;
      });
  };

  if (!loggedInStaff) return <div>Laddar...</div>;

  const priorityClasses: Record<'high' | 'medium' | 'low', string> = {
    high: 'border-red-500 bg-red-50 text-red-700',
    medium: 'border-yellow-500 bg-yellow-50 text-yellow-700',
    low: 'border-green-500 bg-green-50 text-green-700',
  };

  const StatCard: React.FC<{ title: string; value: number; icon: string; onClick: () => void; isActive: boolean }> = ({ title, value, icon, onClick, isActive }) => (
    <button onClick={onClick} className={`p-4 rounded-xl shadow-md flex items-start text-left transition-all duration-200 border-2 ${isActive ? 'bg-flexibel/10 border-flexibel' : 'bg-white border-transparent hover:border-gray-300'}`}>
        <div className="text-3xl mr-4">{icon}</div>
        <div>
            <h4 className="text-sm font-semibold text-gray-500">{title}</h4>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
        </div>
    </button>
  );
  
  const getTabButtonStyle = (tab: any) => {
    return activeTab === tab
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };

  const FilterChip = ({ label, count, active, onClick }: { label: string, count: number, active: boolean, onClick: () => void }) => (
      <button
          onClick={onClick}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
              active
                  ? 'bg-flexibel text-white border-flexibel'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
      >
          {label} ({count})
      </button>
  );
  
  const participantOptionsForLinking = participants
    .filter(p => p.isActive || p.isProspect)
    .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
    .sort((a,b) => a.label.localeCompare(b.label));
    
  const callsToDisplay = introCallView === 'actionable' ? actionableIntroCalls : archivedIntroCalls;

  const getContactSummary = (contactHistory?: ContactAttempt[]) => {
      if (!contactHistory || contactHistory.length === 0) {
          return { text: "⚪️ Ej kontaktad än", colorClass: "text-gray-500" };
      }
      const last = contactHistory[contactHistory.length - 1];
      const dateStr = dateUtils.formatRelativeTime(new Date(last.timestamp)).relative;
      const methodIcon = last.method === 'email' ? '✉️' : last.method === 'sms' ? '💬' : '📞';
      const outcomeLabel = CONTACT_ATTEMPT_OUTCOME_OPTIONS.find(o => o.value === last.outcome)?.label || last.outcome;
      
      return {
          text: `${methodIcon} ${dateStr}: ${outcomeLabel}`,
          colorClass: "text-gray-700"
      };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-800">Klientresan</h2>
            <p className="mt-1 text-lg text-gray-600">Hantera leads, prospekts och medlemmars engagemang.</p>
        </div>
      </div>

       <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                <button onClick={() => setActiveTab('leads')} className={`relative whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('leads')}`}>
                    Leads
                    {newLeadsList.length > 0 && <span className="ml-2 inline-block bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{newLeadsList.length}</span>}
                </button>
                <button onClick={() => setActiveTab('introCalls')} className={`relative whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('introCalls')}`}>
                    Introsamtal
                    {actionableIntroCalls.length > 0 && <span className="ml-2 inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">{actionableIntroCalls.length}</span>}
                </button>
                <button onClick={() => setActiveTab('memberJourney')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('memberJourney')}`}>
                    Medlemsresan
                </button>
            </nav>
        </div>
      
      <div role="tabpanel" hidden={activeTab !== 'leads'} className="animate-fade-in space-y-6">
        <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Leads</h3>
                <Button onClick={() => setIsAddLeadModalOpen(true)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Lägg till lead manuellt
                </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
                <FilterChip label="Nya" count={leadCounts.new} active={activeLeadFilter === 'new'} onClick={() => setActiveLeadFilter('new')} />
                <FilterChip label="Kontaktade" count={leadCounts.contacted} active={activeLeadFilter === 'contacted'} onClick={() => setActiveLeadFilter('contacted')} />
                <FilterChip label="Bokade Intro" count={leadCounts.intro_booked} active={activeLeadFilter === 'intro_booked'} onClick={() => setActiveLeadFilter('intro_booked')} />
                <FilterChip label="Konverterade" count={leadCounts.converted} active={activeLeadFilter === 'converted'} onClick={() => setActiveLeadFilter('converted')} />
                <FilterChip label="Skräp" count={leadCounts.junk} active={activeLeadFilter === 'junk'} onClick={() => setActiveLeadFilter('junk')} />
                <FilterChip label="Alla" count={leadCounts.all} active={activeLeadFilter === 'all'} onClick={() => setActiveLeadFilter('all')} />
            </div>
        </div>

        {filteredLeads.length > 0 ? (
            <div className="space-y-3">
                {filteredLeads.map(lead => {
                    const location = locations.find(l => l.id === lead.locationId);
                    const isJunk = lead.status === 'junk';
                    const contactSummary = getContactSummary(lead.contactHistory);
                    const isExpanded = expandedLeadHistoryIds.has(lead.id);
                    
                    return (
                        <div key={lead.id} className="p-4 bg-white rounded-lg border shadow-sm flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-lg text-gray-900">{lead.firstName} {lead.lastName}</p>
                                        {isJunk && <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Skräp</span>}
                                        {lead.status === 'converted' && <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Konverterad</span>}
                                    </div>
                                    <div className="flex flex-col gap-1 mt-1">
                                        <p className="text-sm text-gray-600">{lead.email} {lead.phone ? `• ${lead.phone}` : ''}</p>
                                        
                                        <button onClick={() => toggleHistory(lead.id)} className="text-left focus:outline-none group">
                                            <p className={`text-sm font-medium ${contactSummary.colorClass} flex items-center gap-1 group-hover:underline`}>
                                                {contactSummary.text}
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                            </p>
                                        </button>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{lead.source}</span>
                                        {location && <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{location.name}</span>}
                                        <span className="text-gray-400">{new Date(lead.createdDate).toLocaleString('sv-SE')}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 self-start sm:self-center flex-shrink-0 flex-wrap">
                                    {isJunk ? (
                                        <>
                                            <Button size="sm" variant="secondary" onClick={() => handleRestoreLead(lead)}>