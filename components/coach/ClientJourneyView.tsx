
import React, { useState, useMemo, useEffect } from 'react';
import { ParticipantProfile, OneOnOneSession, ActivityLog, StaffMember, CoachNote, ParticipantGoalData, WorkoutLog, Membership, ProspectIntroCall, Lead, Location } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { Button } from '../Button';
import { MemberNotesModal } from '../coach/MemberNotesModal';
import * as dateUtils from '../../utils/dateUtils';
import { InfoModal } from '../participant/InfoModal';
import { useAppContext } from '../../context/AppContext';
import { IntroCallModal } from '../coach/IntroCallModal';
// FIX: Corrected import path for useAuth
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { Select, Input } from '../Input';
import { ConfirmationModal } from '../ConfirmationModal';
import { useClientJourney } from '../../features/coach/hooks/useClientJourney';
import { CONTACT_ATTEMPT_METHOD_OPTIONS, CONTACT_ATTEMPT_OUTCOME_OPTIONS } from '../../constants';
import { Textarea } from '../Textarea';

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

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newLeadData: Pick<Lead, 'firstName' | 'lastName' | 'email' | 'phone' | 'locationId'>) => void;
    locations: Location[];
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, onSave, locations }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [locationId, setLocationId] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const locationOptions = React.useMemo(() => [
        { value: '', label: 'Välj studio/ort...' },
        ...locations.map(loc => ({ value: loc.id, label: loc.name }))
    ], [locations]);
    
    React.useEffect(() => {
        if (isOpen) {
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhone('');
            setLocationId(locations.length > 0 ? locations[0].id : '');
            setErrors({});
        }
    }, [isOpen, locations]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!firstName.trim()) newErrors.firstName = "Förnamn är obligatoriskt.";
        if (!lastName.trim()) newErrors.lastName = "Efternamn är obligatoriskt.";
        if (!email.trim()) {
            newErrors.email = "E-post är obligatoriskt.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = "Ogiltig e-postadress.";
        }
        if (!locationId) newErrors.locationId = "Du måste välja en studio/ort.";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (validate()) {
            onSave({ 
                firstName: firstName.trim(), 
                lastName: lastName.trim(), 
                email: email.trim(), 
                phone: phone.trim() || undefined, 
                locationId 
            });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Lägg till Lead Manuellt">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Förnamn *" value={firstName} onChange={e => setFirstName(e.target.value)} error={errors.firstName} required />
                    <Input label="Efternamn *" value={lastName} onChange={e => setLastName(e.target.value)} error={errors.lastName} required />
                </div>
                <Input label="E-post *" type="email" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} required />
                <Input label="Mobilnummer" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                <Select label="Studio/Ort *" value={locationId} onChange={e => setLocationId(e.target.value)} options={locationOptions} error={errors.locationId} required />

                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Avbryt</Button>
                    <Button onClick={handleSave}>Spara Lead</Button>
                </div>
            </div>
        </Modal>
    );
};

interface LogContactAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    onSave: (updatedLead: Lead) => void;
    loggedInStaffId: string;
}

const LogContactAttemptModal: React.FC<LogContactAttemptModalProps> = ({ isOpen, onClose, lead, onSave, loggedInStaffId }) => {
    const [method, setMethod] = useState<'phone' | 'email' | 'sms'>('phone');
    const [outcome, setOutcome] = useState<'booked_intro' | 'not_interested' | 'no_answer' | 'left_voicemail' | 'follow_up'>('no_answer');
    const [notes, setNotes] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setMethod('phone');
            setOutcome('no_answer');
            setNotes('');
        }
    }, [isOpen]);

    const handleSave = () => {
        const newAttempt = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            method,
            outcome,
            notes: notes.trim() || undefined,
            coachId: loggedInStaffId,
        };

        let newStatus = lead.status;
        if (lead.status === 'new') {
            newStatus = 'contacted';
        }
        if (outcome === 'booked_intro') {
            newStatus = 'intro_booked';
        }
        if (outcome === 'not_interested') {
            newStatus = 'junk';
        }

        const updatedLead: Lead = {
            ...lead,
            status: newStatus,
            contactHistory: [...(lead.contactHistory || []), newAttempt],
        };

        onSave(updatedLead);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Logga kontakt för ${lead.firstName}`}>
            <div className="space-y-4">
                <Select label="Metod" value={method} onChange={e => setMethod(e.target.value as any)} options={CONTACT_ATTEMPT_METHOD_OPTIONS} />
                <Select label="Resultat" value={outcome} onChange={e => setOutcome(e.target.value as any)} options={CONTACT_ATTEMPT_OUTCOME_OPTIONS} />
                <Textarea label="Anteckningar" value={notes} onChange={e => setNotes(e.target.value)} placeholder="T.ex. 'Ringde, inget svar. Provar igen imorgon.'" rows={3} />
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                    <Button onClick={handleSave}>Logga försök</Button>
                </div>
            </div>
        </Modal>
    );
};

// Icons for UI
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
);
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
);

const MethodIcon: React.FC<{ method: string }> = ({ method }) => {
    switch (method) {
        case 'phone': return <span title="Telefon" className="text-xl">📞</span>;
        case 'email': return <span title="E-post" className="text-xl">✉️</span>;
        case 'sms': return <span title="SMS" className="text-xl">💬</span>;
        default: return <span>📝</span>;
    }
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
        setCoachNotesData,
        workouts,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        workoutCategories,
        staffAvailability,
        staffMembers,
        locations,
    } = useAppContext();
    
    // Use the new custom hook
    const {
        activeTab, setActiveTab,
        activeLeadFilter, setActiveLeadFilter,
        activeFilter, setActiveFilter,
        introCallView, setIntroCallView,
        filteredAndSortedData,
        leadCounts,
        filteredLeads,
        newLeadsList,
        unlinkedCallsList,
        actionableIntroCalls,
        archivedIntroCalls,
        counts,
        handleSaveLead,
        handleSaveIntroCall,
        handleUpdateIntroCall,
        handleConfirmLink: apiConfirmLink,
        handleConfirmMarkAsJunk,
        handleConfirmConsent,
        handleSaveContactAttempt,
        handleArchiveIntroCall,
        handleDeleteIntroCall,
    } = useClientJourney(loggedInStaff);
    
  // Local UI State
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isIntroCallModalOpen, setIsIntroCallModalOpen] = useState(false);
  const [callToEdit, setCallToEdit] = useState<ProspectIntroCall | null>(null);
  const [callToLink, setCallToLink] = useState<ProspectIntroCall | null>(null);
  const [callToArchive, setCallToArchive] = useState<ProspectIntroCall | null>(null);
  const [callToDelete, setCallToDelete] = useState<ProspectIntroCall | null>(null);
  const [participantToLinkId, setParticipantToLinkId] = useState<string>('');
  const [leadBeingConverted, setLeadBeingConverted] = useState<Lead | null>(null);
  const [leadToMarkAsJunk, setLeadToMarkAsJunk] = useState<Lead | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [leadToConfirmConsent, setLeadToConfirmConsent] = useState<Lead | null>(null);
  const [leadToLogContactFor, setLeadToLogContactFor] = useState<Lead | null>(null);

  // State for expanded leads
  const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());

  const introCallsToShow = unlinkedCallsList; // Using unlinkedCallsList as primary list based on existing code structure

  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  const handleCreateIntroCallFromLead = (lead: Lead) => {
    setLeadBeingConverted(lead);
    setIsIntroCallModalOpen(true);
  };

  const toggleLeadExpand = (leadId: string) => {
      setExpandedLeadIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(leadId)) {
              newSet.delete(leadId);
          } else {
              newSet.add(leadId);
          }
          return newSet;
      });
  };

  const getOutcomeLabel = (val: string) => CONTACT_ATTEMPT_OUTCOME_OPTIONS.find(o => o.value === val)?.label || val;

  const getCoachName = (coachId: string) => {
      return staffMembers.find(s => s.id === coachId)?.name || 'Okänd';
  };
  
  const confirmArchiveCall = () => {
    if (callToArchive) {
        handleArchiveIntroCall(callToArchive.id);
        setCallToArchive(null);
    }
  };

  const confirmDeleteCall = () => {
    if (callToDelete) {
        handleDeleteIntroCall(callToDelete.id);
        setCallToDelete(null);
    }
  };
  
  const handleConfirmLink = () => {
    if (callToLink && participantToLinkId) {
        apiConfirmLink(callToLink, participantToLinkId);
        setCallToLink(null);
        setParticipantToLinkId('');
    }
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
  
  const getTabButtonStyle = (tab: ClientJourneyTab) => {
    return activeTab === tab
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };
  
  const participantOptionsForLinking = participants
    .filter(p => p.isActive || p.isProspect) // Link to active members or prospects
    .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
    .sort((a,b) => a.label.localeCompare(b.label));

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
                    {unlinkedCallsList.length > 0 && <span className="ml-2 inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unlinkedCallsList.length}</span>}
                </button>
                <button onClick={() => setActiveTab('memberJourney')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('memberJourney')}`}>
                    Medlemsresan
                </button>
            </nav>
        </div>
      
      {/* Leads Tab */}
      <div role="tabpanel" hidden={activeTab !== 'leads'} className="animate-fade-in space-y-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Leads</h3>
            <Button onClick={() => setIsAddLeadModalOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Lägg till lead manuellt
            </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
            {[
                { key: 'all', label: 'Alla Aktiva' },
                { key: 'new', label: 'Nya' },
                { key: 'contacted', label: 'Kontaktade' },
                { key: 'intro_booked', label: 'Bokade Intro' },
                { key: 'converted', label: 'Konverterade' },
                { key: 'junk', label: 'Skräp' },
            ].map(filter => (
                 <button
                    key={filter.key}
                    onClick={() => setActiveLeadFilter(filter.key as any)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                        activeLeadFilter === filter.key
                            ? 'bg-flexibel text-white border-flexibel'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {filter.label} ({leadCounts[filter.key as keyof typeof leadCounts]})
                </button>
            ))}
        </div>

        {filteredLeads.length > 0 ? (
            <div className="space-y-3">
                {filteredLeads.map(lead => {
                    const location = locations.find(l => l.id === lead.locationId);
                    const history = lead.contactHistory || [];
                    const sortedHistory = [...history].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    const latestActivity = sortedHistory.length > 0 ? sortedHistory[0] : null;
                    const isExpanded = expandedLeadIds.has(lead.id);

                    return (
                        <div key={lead.id} className="bg-white rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md">
                             <div className="p-4 flex flex-col sm:flex-row justify-between items-start gap-3">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-lg text-gray-900">{lead.firstName} {lead.lastName}</p>
                                        {lead.consentGiven === false && (
                                            <span title="Väntar på samtycke" className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">⚠️ Väntar samtycke</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">{lead.email}</p>
                                    {lead.phone && <p className="text-sm text-gray-600">{lead.phone}</p>}
                                    
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{lead.source}</span>
                                        {location && <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{location.name}</span>}
                                        <span className="text-gray-400">Skapad: {new Date(lead.createdDate).toLocaleDateString('sv-SE')}</span>
                                    </div>
                                    
                                    {/* Latest activity preview (always visible, emphasized) */}
                                    {latestActivity && (
                                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-700 bg-blue-50 border-l-4 border-blue-400 p-2 rounded-r w-fit">
                                            <MethodIcon method={latestActivity.method} />
                                            <span className="font-medium">{getOutcomeLabel(latestActivity.outcome)}</span>
                                            <span className="text-gray-500 text-xs">({dateUtils.formatRelativeTime(latestActivity.timestamp).relative})</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                                    <div className="flex gap-2 self-start sm:self-center flex-wrap">
                                        <Button size="sm" variant="outline" onClick={() => setLeadToLogContactFor(lead)}>➕ Logga kontakt</Button>
                                        <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setLeadToMarkAsJunk(lead)}>Skräp</Button>
                                        <Button size="sm" variant="primary" onClick={() => handleCreateIntroCallFromLead(lead)}>Skapa Introsamtal</Button>
                                    </div>
                                     <button 
                                        onClick={() => toggleLeadExpand(lead.id)} 
                                        className="text-sm text-gray-500 hover:text-flexibel flex items-center gap-1 mt-2 focus:outline-none self-end"
                                    >
                                        {isExpanded ? 'Dölj historik' : 'Visa historik'}
                                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded History Section */}
                            {isExpanded && (
                                <div className="bg-gray-50 border-t border-gray-200 p-4 animate-fade-in">
                                    <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Kontakt- & Händelsehistorik</h4>
                                    {sortedHistory.length > 0 ? (
                                        <div className="space-y-0 relative ml-2">
                                            {/* Vertical line */}
                                            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-300"></div>
                                            
                                            {sortedHistory.map((attempt) => (
                                                <div key={attempt.id} className="relative pl-8 py-3">
                                                    {/* Dot */}
                                                    <div className="absolute left-[3px] top-4 w-2.5 h-2.5 bg-white border-2 border-flexibel rounded-full z-10"></div>
                                                    
                                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                                                <MethodIcon method={attempt.method} />
                                                                <span>{getOutcomeLabel(attempt.outcome)}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-400">{new Date(attempt.timestamp).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                                                        </div>
                                                        {attempt.notes && (
                                                            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap border-l-2 border-gray-100 pl-2">{attempt.notes}</p>
                                                        )}
                                                        <p className="text-xs text-gray-400 mt-2 text-right">Av: {getCoachName(attempt.coachId)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic pl-2">Inga kontaktförsök loggade än.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">Inga leads att hantera i denna vy.</p>
            </div>
        )}
      </div>

      {/* Introsamtal Tab */}
      <div role="tabpanel" hidden={activeTab !== 'introCalls'} className="animate-fade-in space-y-6">
        <div className="flex justify-end">
            <Button onClick={() => { setLeadBeingConverted(null); setCallToEdit(null); setIsIntroCallModalOpen(true); }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Lägg till nytt introsamtal
            </Button>
        </div>
        {unlinkedCallsList.length > 0 ? (
             <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                 <h3 className="text-xl font-bold text-gray-800">Okopplade Introsamtal ({unlinkedCallsList.length})</h3>
                 <div className="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2">
                     {unlinkedCallsList.map(call => {
                         const coach = staffMembers.find(s => s.id === call.coachId);
                         return (
                             <div key={call.id} className="p-3 bg-white rounded-md border shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                    <div>
                                        <p className="font-bold text-lg text-gray-900">{call.prospectName}</p>
                                        <p className="text-sm text-gray-600">{call.prospectEmail}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="text-gray-500">Coach: {coach?.name || 'Okänd'}</span>
                                            <span className="text-gray-400">| {new Date(call.createdDate).toLocaleDateString('sv-SE')}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 self-start sm:self-center flex-shrink-0 items-center">
                                        <Button size="sm" variant="outline" onClick={() => { setCallToEdit(call); setIsIntroCallModalOpen(true); }}>Redigera</Button>
                                        <Button size="sm" variant="primary" onClick={() => { setCallToLink(call); setParticipantToLinkId(''); }}>Länka</Button>
                                        <Button size="sm" variant="ghost" className="!text-gray-500" onClick={() => setCallToArchive(call)} title="Arkivera">🗃️</Button>
                                        <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setCallToDelete(call)} title="Ta bort"><TrashIcon /></Button>
                                    </div>
                                </div>
                             </div>
                         )
                     })}
                 </div>
             </div>
        ) : (
             <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">Inga okopplade introsamtal.</p>
            </div>
        )}
      </div>

      {/* Medlemsresa Tab */}
      <div role="tabpanel" hidden={activeTab !== 'memberJourney'} className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-lg border">
            <div>
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">Fokusområden
                    <button onClick={() => setIsInfoModalOpen(true)} className="text-gray-400 hover:text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
                </h3>
                <p className="text-sm text-gray-600">Klicka för att filtrera listan och se vilka medlemmar som behöver din uppmärksamhet.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto">
                <StatCard title="Riskzon" value={counts.riskzon} icon="⚠️" onClick={() => setActiveFilter(activeFilter === 'riskzon' ? null : 'riskzon')} isActive={activeFilter === 'riskzon'} />
                <StatCard title="Startprogram" value={counts.startprogram} icon="🚀" onClick={() => setActiveFilter(activeFilter === 'startprogram' ? null : 'startprogram')} isActive={activeFilter === 'startprogram'} />
                <StatCard title="Behöver Check-in" value={counts.checkin} icon="💬" onClick={() => setActiveFilter(activeFilter === 'checkin' ? null : 'checkin')} isActive={activeFilter === 'checkin'} />
            </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow border">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fas</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Framsteg / Medlemskap</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Senaste Aktivitet</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nästa Steg</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAndSortedData.map(p => {
                        const { relative: relativeDate } = dateUtils.formatRelativeTime(p.lastActivityDate);
                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <button onClick={() => handleOpenNotesModal(p)} className="text-left w-full">
                                        <div className="flex items-center gap-2">
                                            <EngagementIndicator level={p.engagementLevel} />
                                            <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                        </div>
                                        <div className="text-xs text-gray-500">{p.email}</div>
                                    </button>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.phaseColorClass}`}>
                                        {p.phase}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <span>{p.progressText}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{relativeDate}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityClasses[p.nextActionPriority]}`}>
                                        {p.nextActionText}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {filteredAndSortedData.length === 0 && (
                <div className="text-center p-6 text-gray-500">Inga medlemmar matchar de valda filtren.</div>
            )}
        </div>
      </div>

      {selectedParticipant && loggedInStaff && (
        <MemberNotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            participant={selectedParticipant}
            notes={coachNotes.filter(n => n.participantId === selectedParticipant.id)}
            allParticipantGoals={allParticipantGoals}
            setParticipantGoals={setParticipantGoalsData}
            allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
            setGoalCompletionLogs={setGoalCompletionLogsData}
            onAddNote={(noteText) => setCoachNotesData(prev => [...prev, { id: crypto.randomUUID(), participantId: selectedParticipant.id, noteText, createdDate: new Date().toISOString(), noteType: 'check-in' }])}
            onUpdateNote={(noteId, newText) => {
                setCoachNotesData(prev => prev.map(note => 
                    note.id === noteId 
                    ? { ...note, noteText: newText, createdDate: new Date().toISOString() } 
                    : note
                ));
            }}
            onDeleteNote={(noteId) => {
                setCoachNotesData(prev => prev.filter(note => note.id !== noteId));
            }}
            oneOnOneSessions={oneOnOneSessions}
            setOneOnOneSessions={setOneOnOneSessionsData}
            coaches={staffMembers}
            loggedInCoachId={loggedInStaff!.id}
            workouts={workouts}
            addWorkout={addWorkout}
            updateWorkout={updateWorkout}
            deleteWorkout={deleteWorkout}
            workoutCategories={workoutCategories}
            participants={participants}
            staffAvailability={staffAvailability}
            isOnline={isOnline}
        />
      )}
      
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="Om Klientresan"
      >
          <div className="space-y-2 text-base text-gray-700">
            <p>Klientresan är ett verktyg för att ge dig en snabb överblick över var dina medlemmar befinner sig och vem som kan behöva extra uppmärksamhet.</p>
            <p><strong>Faserna betyder:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
                <li><strong>Riskzon:</strong> Medlemmar vars aktivitet har sjunkit markant. Dessa är högst prioriterade att kontakta.</li>
                <li><strong>Startprogram:</strong> Helt nya medlemmar i sin onboarding-process. Målet är att de ska slutföra de definierade startpassen.</li>
                <li><strong>Medlem:</strong> Etablerade medlemmar. Fokus ligger på att bibehålla motivation och följa upp med regelbundna avstämningar.</li>
            </ul>
            <p>Använd "Nästa Steg"-kolumnen för att proaktivt nå ut och stötta dina medlemmar!</p>
          </div>
      </InfoModal>

      <IntroCallModal
          isOpen={isIntroCallModalOpen}
          onClose={() => {
            setIsIntroCallModalOpen(false);
            setLeadBeingConverted(null);
            setCallToEdit(null);
          }}
          onSave={handleSaveIntroCall}
          introCallToEdit={callToEdit}
          onUpdate={handleUpdateIntroCall}
          initialData={leadBeingConverted ? {
            prospectName: `${leadBeingConverted.firstName} ${leadBeingConverted.lastName}`,
            prospectEmail: leadBeingConverted.email,
            prospectPhone: leadBeingConverted.phone,
          } : undefined}
      />

      <Modal isOpen={!!callToLink} onClose={() => setCallToLink(null)} title={`Länka samtal med ${callToLink?.prospectName}`}>
            <div className="space-y-4">
                <p>Välj den medlemsprofil som detta introsamtal ska kopplas till. En sammanfattning av samtalet kommer att läggas till som en anteckning i medlemmens klientkort.</p>
                <Select
                    label="Välj medlem *"
                    value={participantToLinkId}
                    onChange={(e) => setParticipantToLinkId(e.target.value)}
                    options={[{ value: '', label: 'Välj en medlem...' }, ...participantOptionsForLinking]}
                />
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={() => setCallToLink(null)}>Avbryt</Button>
                    <Button onClick={handleConfirmLink} disabled={!participantToLinkId}>Länka och skapa anteckning</Button>
                </div>
            </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!leadToMarkAsJunk}
        onClose={() => setLeadToMarkAsJunk(null)}
        onConfirm={handleConfirmMarkAsJunk}
        title="Ta bort lead?"
        message={`Är du säker på att du vill ta bort leadet för ${leadToMarkAsJunk?.firstName} ${leadToMarkAsJunk?.lastName}? Detta markerar det som 'skräp' och döljer det från listan.`}
        confirmButtonText="Ja, ta bort"
        confirmButtonVariant="danger"
      />
       <AddLeadModal
            isOpen={isAddLeadModalOpen}
            onClose={() => setIsAddLeadModalOpen(false)}
            onSave={handleSaveLead}
            locations={locations}
        />
        
        {/* Render the Contact Attempt Modal if a lead is selected */}
        {leadToLogContactFor && loggedInStaff && (
            <LogContactAttemptModal
                isOpen={!!leadToLogContactFor}
                onClose={() => setLeadToLogContactFor(null)}
                lead={leadToLogContactFor}
                onSave={handleSaveContactAttempt}
                loggedInStaffId={loggedInStaff.id}
            />
        )}
        
        <ConfirmationModal
            isOpen={!!leadToConfirmConsent}
            onClose={() => setLeadToConfirmConsent(null)}
            onConfirm={() => { if (leadToConfirmConsent) { handleConfirmConsent(leadToConfirmConsent); setLeadToConfirmConsent(null); } }}
            title="Bekräfta samtycke"
            message={`Jag bekräftar att jag har fått godkännande att kontakta ${leadToConfirmConsent?.firstName} ${leadToConfirmConsent?.lastName}.`}
            confirmButtonText="Ja, bekräfta"
        />
        
        <ConfirmationModal
            isOpen={!!callToArchive}
            onClose={() => setCallToArchive(null)}
            onConfirm={confirmArchiveCall}
            title="Arkivera Introsamtal"
            message={`Är du säker på att du vill arkivera detta introsamtal? Det flyttas då bort från listan över aktiva samtal.`}
            confirmButtonText="Arkivera"
            confirmButtonVariant="secondary"
        />

        <ConfirmationModal
            isOpen={!!callToDelete}
            onClose={() => setCallToDelete(null)}
            onConfirm={confirmDeleteCall}
            title="Ta bort Introsamtal"
            message={`Är du säker på att du vill ta bort detta introsamtal permanent? Detta kan inte ångras.`}
            confirmButtonText="Ja, ta bort"
            confirmButtonVariant="danger"
        />

    </div>
  );
};
