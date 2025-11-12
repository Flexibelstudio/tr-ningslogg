import React, { useState, useMemo, useEffect } from 'react';
import { ParticipantProfile, OneOnOneSession, ActivityLog, StaffMember, CoachNote, ParticipantGoalData, WorkoutLog, Membership, ProspectIntroCall, Lead, Location, LeadStatus, ContactAttemptMethod, ContactAttemptOutcome, ContactAttempt } from '../../types';
import { Button } from '../Button';
import { MemberNotesModal } from './MemberNotesModal';
import * as dateUtils from '../../utils/dateUtils';
import { InfoModal } from '../participant/InfoModal';
import { useAppContext } from '../../context/AppContext';
import { IntroCallModal } from './IntroCallModal';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { Select, Input } from '../Input';
import { ConfirmationModal } from '../ConfirmationModal';
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

interface ClientJourneyEntry extends ParticipantProfile {
  phase: 'Startprogram' | 'Medlem' | 'Riskzon';
  phaseColorClass: string;
  progressText: string;
  nextActionText: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  lastActivityDate: Date | null;
  engagementLevel: 'green' | 'yellow' | 'red' | 'neutral';
}

type ClientJourneyTab = 'leads' | 'introCalls' | 'memberJourney';
type LeadFilter = LeadStatus | 'all';

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

    const locationOptions = useMemo(() => [
        { value: '', label: 'Välj studio/ort...' },
        ...locations.map(loc => ({ value: loc.id, label: loc.name }))
    ], [locations]);
    
    useEffect(() => {
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
    const [method, setMethod] = useState<ContactAttemptMethod>('phone');
    const [outcome, setOutcome] = useState<ContactAttemptOutcome>('no_answer');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMethod('phone');
            setOutcome('no_answer');
            setNotes('');
        }
    }, [isOpen]);

    const handleSave = () => {
        const newAttempt: ContactAttempt = {
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
                <Select label="Metod" value={method} onChange={e => setMethod(e.target.value as ContactAttemptMethod)} options={CONTACT_ATTEMPT_METHOD_OPTIONS} />
                <Select label="Resultat" value={outcome} onChange={e => setOutcome(e.target.value as ContactAttemptOutcome)} options={CONTACT_ATTEMPT_OUTCOME_OPTIONS} />
                <Textarea label="Anteckningar" value={notes} onChange={e => setNotes(e.target.value)} placeholder="T.ex. 'Ringde, inget svar. Provar igen imorgon.'" rows={3} />
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                    <Button onClick={handleSave}>Logga försök</Button>
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
        memberships,
        integrationSettings,
        workoutLogs,
        setParticipantGoalsData,
        setGoalCompletionLogsData,
        setCoachNotesData,
        setOneOnOneSessionsData,
        workouts,
        addWorkout,
        updateWorkout,
        deleteWorkout,
        workoutCategories,
        staffAvailability,
        staffMembers,
        leads,
        setLeadsData,
        prospectIntroCalls,
        setProspectIntroCallsData,
        locations,
        addParticipant,
    } = useAppContext();
    
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantProfile | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isIntroCallModalOpen, setIsIntroCallModalOpen] = useState(false);
  const [callToEdit, setCallToEdit] = useState<ProspectIntroCall | null>(null);
  const [callToLink, setCallToLink] = useState<ProspectIntroCall | null>(null);
  const [participantToLinkId, setParticipantToLinkId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ClientJourneyTab>('leads');
  const [leadBeingConverted, setLeadBeingConverted] = useState<Lead | null>(null);
  const [leadToMarkAsJunk, setLeadToMarkAsJunk] = useState<Lead | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [leadToConfirmConsent, setLeadToConfirmConsent] = useState<Lead | null>(null);

  const [activeLeadFilter, setActiveLeadFilter] = useState<LeadFilter>('new');
  const [leadToLogContactFor, setLeadToLogContactFor] = useState<Lead | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);


  const journeyData = useMemo<ClientJourneyEntry[]>(() => {
    return participants
      .filter(p => p.isActive || p.isProspect)
      .map(p => {
        const today = new Date();
        const referenceDateString = p.startDate || p.creationDate;
        if (!referenceDateString) return null; // Skip participants without a start/creation date
        const referenceDate = new Date(referenceDateString);
        const daysSinceStart = Math.floor((today.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        const myLogs = allActivityLogs.filter(l => l.participantId === p.id).sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
        const myWorkoutLogs = workoutLogs.filter(l => l.participantId === p.id);
        const logsLast21Days = myLogs.filter(l => new Date(l.completedDate) > new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)).length;
        
        const lastActivityDate = myLogs[0] ? new Date(myLogs[0].completedDate) : null;
        const daysSinceLastActivity = lastActivityDate ? Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;

        let engagementLevel: 'green' | 'yellow' | 'red' | 'neutral' = 'neutral';
        if (p.isProspect) {
            engagementLevel = 'neutral';
        } else if (p.isActive === false) {
            engagementLevel = 'red';
        } else if (lastActivityDate) {
            if (daysSinceLastActivity > 14) engagementLevel = 'red';
            else if (daysSinceLastActivity > 7) engagementLevel = 'yellow';
            else engagementLevel = 'green';
        }

        let finalEntry: Omit<ClientJourneyEntry, keyof ParticipantProfile>;
        
        if (!p.isProspect && logsLast21Days < 4 && daysSinceStart > 14) {
            finalEntry = {
                phase: 'Riskzon',
                phaseColorClass: 'bg-red-100 text-red-800',
                progressText: `${logsLast21Days} pass/21d`,
                nextActionText: 'Kontakta - låg aktivitet',
                nextActionPriority: 'high',
                lastActivityDate,
                engagementLevel,
            };
        }
        else if (p.isProspect) {
            const { startProgramCategoryId, startProgramSessionsRequired } = integrationSettings;
            const startProgramCategory = workoutCategories.find(c => c.id === startProgramCategoryId);
            
            let progressText = 'Startprogram (ej konf.)';
            let nextActionText = 'Konfigurera startprogram';
            let nextActionPriority: 'high' | 'medium' | 'low' = 'high';

            if (startProgramCategory && startProgramSessionsRequired && startProgramSessionsRequired > 0) {
                const completedCount = myWorkoutLogs.filter(log => {
                    const workout = workouts.find(w => w.id === log.workoutId);
                    return workout?.category === startProgramCategory.name;
                }).length;
                
                progressText = `${completedCount}/${startProgramSessionsRequired} startpass`;
                
                if (completedCount >= startProgramSessionsRequired) {
                    nextActionText = 'Konvertera till medlem!';
                    nextActionPriority = 'high';
                } else {
                    nextActionText = `Följ upp startpass #${completedCount + 1}`;
                    nextActionPriority = 'medium';
                }
            }
            
            finalEntry = {
                phase: 'Startprogram',
                phaseColorClass: 'bg-blue-100 text-blue-800',
                progressText: progressText,
                nextActionText: nextActionText,
                nextActionPriority: nextActionPriority,
                lastActivityDate,
                engagementLevel,
            };
        }
        else {
            const membership = memberships.find(m => m.id === p.membershipId);
            const checkInSessions = oneOnOneSessions.filter(s => s.participantId === p.id && s.title === 'Avstämningssamtal' && s.status === 'completed').sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
            const daysSinceLastCheckin = checkInSessions[0] ? Math.floor((today.getTime() - new Date(checkInSessions[0].startTime).getTime()) / (1000 * 60 * 60 * 24)) : daysSinceStart;

            let nextActionText = 'Fortsätt peppa!';
            let nextActionPriority: 'high' | 'medium' | 'low' = 'low';

            if (daysSinceLastCheckin > 120) {
                nextActionText = 'Dags för avstämning!';
                nextActionPriority = 'high';
            } else if (daysSinceLastCheckin > 90) {
                nextActionText = 'Boka in avstämning snart';
                nextActionPriority = 'medium';
            }

            finalEntry = {
                phase: 'Medlem',
                phaseColorClass: 'bg-green-100 text-green-800',
                progressText: membership?.name || 'Aktiv',
                nextActionText,
                nextActionPriority,
                lastActivityDate,
                engagementLevel,
            };
        }
        
        return { ...p, ...finalEntry };
      }).filter((p): p is ClientJourneyEntry => p !== null);
  }, [participants, oneOnOneSessions, allActivityLogs, memberships, integrationSettings, workoutLogs, workouts, workoutCategories]);

  const filteredLeads = useMemo(() => {
    const sortedLeads = [...leads].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    if (activeLeadFilter === 'all') {
        return sortedLeads;
    }
    return sortedLeads.filter(l => l.status === activeLeadFilter);
  }, [leads, activeLeadFilter]);

  const unlinkedCalls = useMemo(() => {
    return prospectIntroCalls
        .filter(c => c.status === 'unlinked')
        .sort((a,b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [prospectIntroCalls]);

  const filteredAndSortedData = useMemo(() => {
    let data = journeyData;
    if (activeFilter === 'riskzon') {
        data = data.filter(p => p.phase === 'Riskzon');
    } else if (activeFilter === 'startprogram') {
        data = data.filter(p => p.phase === 'Startprogram');
    } else if (activeFilter === 'checkin') {
        data = data.filter(p => p.phase === 'Medlem' && p.nextActionPriority !== 'low');
    }

    return data.sort((a, b) => {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return priorityOrder[a.nextActionPriority] - priorityOrder[b.nextActionPriority];
    });
  }, [journeyData, activeFilter]);
  
  const counts = useMemo(() => {
    const riskzon = journeyData.filter(p => p.phase === 'Riskzon').length;
    const startprogram = journeyData.filter(p => p.phase === 'Startprogram').length;
    const checkin = journeyData.filter(p => p.phase === 'Medlem' && p.nextActionPriority !== 'low').length;
    return { riskzon, startprogram, checkin };
  }, [journeyData]);

  const handleOpenNotesModal = (participant: ParticipantProfile) => {
    setSelectedParticipant(participant);
    setIsNotesModalOpen(true);
  };
  
  const handleSaveIntroCall = (introCallData: Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>) => {
    if (!loggedInStaff) return;
    const newIntroCall: ProspectIntroCall = {
        ...introCallData,
        id: crypto.randomUUID(),
        createdDate: new Date().toISOString(),
        coachId: loggedInStaff.id,
        status: 'unlinked',
    };
    setProspectIntroCallsData(prev => [...prev, newIntroCall]);

    if (leadBeingConverted) {
        // This is now handled in handleCreateIntroCallFromLead to immediately move it
        setLeadBeingConverted(null);
    }
  };

  const handleUpdateIntroCall = (updatedCall: ProspectIntroCall) => {
    setProspectIntroCallsData(prev => prev.map(c => c.id === updatedCall.id ? updatedCall : c));
  };
  
  const handleConfirmLink = () => {
    if (!callToLink || !participantToLinkId) return;
    
    const updatedCall = { ...callToLink, status: 'linked' as const, linkedParticipantId: participantToLinkId };
    setProspectIntroCallsData(prev => prev.map(c => c.id === callToLink.id ? updatedCall : c));

    if (callToLink.linkedLeadId) {
        setLeadsData(prev => prev.map(l => l.id === callToLink.linkedLeadId ? { ...l, status: 'converted' } : l));
    }

    const noteText = `
--- INTROSAMTALSAMMANFATTNING ---
Datum: ${new Date(callToLink.createdDate).toLocaleDateString('sv-SE')}

Träningsmål & 'Varför':
${callToLink.trainingGoals || 'Ej angivet.'}

Timing - 'Varför just nu?':
${callToLink.timingNotes || 'Ej angivet.'}

Sömn & Stress:
${callToLink.sleepAndStress || 'Ej angivet.'}

Skador/Hälsoproblem:
${callToLink.healthIssues || 'Ej angivet.'}

Coachanteckningar & Nästa Steg:
${callToLink.coachSummary || 'Ej angivet.'}
    `.trim();

    const newNote: CoachNote = {
        id: crypto.randomUUID(),
        participantId: participantToLinkId,
        noteText: noteText,
        createdDate: new Date().toISOString(),
        noteType: 'intro-session'
    };
    setCoachNotesData(prev => [...prev, newNote]);

    setCallToLink(null);
    setParticipantToLinkId('');
  };
  
  const handleCreateIntroCallFromLead = (lead: Lead) => {
    setLeadsData(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'intro_booked' } : l));
    setLeadBeingConverted(lead);
    setIsIntroCallModalOpen(true);
  };

  const handleConfirmMarkAsJunk = () => {
    if (!leadToMarkAsJunk) return;
    setLeadsData(prev => prev.map(l => l.id === leadToMarkAsJunk.id ? { ...l, status: 'junk' } : l));
    setLeadToMarkAsJunk(null);
  };
  
  const handleSaveLead = (newLeadData: Pick<Lead, 'firstName' | 'lastName' | 'email' | 'phone' | 'locationId'>) => {
    const newLead: Lead = {
        id: crypto.randomUUID(),
        ...newLeadData,
        source: 'Manuell',
        status: 'new',
        createdDate: new Date().toISOString(),
    };
    setLeadsData(prev => [...prev, newLead]);
  };
  
  const handleConfirmConsent = () => {
    if (!leadToConfirmConsent) return;
    setLeadsData(prev => prev.map(l => l.id === leadToConfirmConsent.id ? { ...l, consentGiven: true } : l));
    setLeadToConfirmConsent(null);
  };

  if (!loggedInStaff) return <div>Laddar...</div>;

  const priorityClasses: Record<'high' | 'medium' | 'low', string> = {
    high: 'border-red-500 bg-red-50 text-red-700',
    medium: 'border-yellow-500 bg-yellow-50 text-yellow-700',
    low: 'border-green-500 bg-green-50 text-green-700',
  };

  const statusConfig: Record<LeadStatus, { text: string; color: string }> = {
      new: { text: 'Ny', color: 'bg-blue-100 text-blue-800' },
      contacted: { text: 'Kontaktad', color: 'bg-yellow-100 text-yellow-800' },
      intro_booked: { text: 'Intro Bokat', color: 'bg-purple-100 text-purple-800' },
      converted: { text: 'Konverterad', color: 'bg-green-100 text-green-800' },
      junk: { text: 'Skräp', color: 'bg-gray-100 text-gray-800' },
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
    .filter(p => p.isActive || p.isProspect)
    .map(p => ({ value: p.id, label: p.name || 'Okänd' }))
    .sort((a,b) => a.label.localeCompare(b.label));

  const leadFilterOptions: { label: string; value: LeadFilter }[] = [
      { label: 'Nya', value: 'new' },
      { label: 'Kontaktade', value: 'contacted' },
      { label: 'Bokade Intro', value: 'intro_booked' },
      { label: 'Konverterade', value: 'converted' },
      { label: 'Skräp', value: 'junk' },
      { label: 'Alla', value: 'all' },
  ];

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
                    {leads.filter(l => l.status === 'new').length > 0 && <span className="ml-2 inline-block bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{leads.filter(l => l.status === 'new').length}</span>}
                </button>
                <button onClick={() => setActiveTab('introCalls')} className={`relative whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('introCalls')}`}>
                    Introsamtal
                    {unlinkedCalls.length > 0 && <span className="ml-2 inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unlinkedCalls.length}</span>}
                </button>
                <button onClick={() => setActiveTab('memberJourney')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('memberJourney')}`}>
                    Medlemsresan
                </button>
            </nav>
        </div>
      
      <div role="tabpanel" hidden={activeTab !== 'leads'} className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="flex flex-wrap gap-2">
                {leadFilterOptions.map(opt => (
                    <Button key={opt.value} variant={activeLeadFilter === opt.value ? 'primary' : 'outline'} size="sm" onClick={() => setActiveLeadFilter(opt.value)}>
                        {opt.label} ({opt.value === 'all' ? leads.length : leads.filter(l => l.status === opt.value).length})
                    </Button>
                ))}
            </div>
            <Button onClick={() => setIsAddLeadModalOpen(true)} className="w-full sm:w-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Lägg till lead manuellt
            </Button>
        </div>
        {filteredLeads.length > 0 ? (
            <div className="space-y-3">
                {filteredLeads.map(lead => {
                    const location = locations.find(l => l.id === lead.locationId);
                    const isRecommendation = lead.source === 'Rekommendation';
                    const consentNeeded = isRecommendation && !lead.consentGiven;
                    const lastContact = lead.contactHistory?.[lead.contactHistory.length - 1];

                    return (
                        <div key={lead.id} className="p-4 bg-white rounded-lg border shadow-sm flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div className="flex-grow">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <p className="font-bold text-lg text-gray-900">{lead.firstName} {lead.lastName}</p>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[lead.status].color}`}>
                                        {statusConfig[lead.status].text}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600">{lead.email || <i>E-post saknas</i>}</p>
                                {lead.phone && <p className="text-sm text-gray-600">{lead.phone}</p>}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{lead.source}</span>
                                    {location && <span className="font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{location.name}</span>}
                                    <span className="text-gray-400">Skapad: {new Date(lead.createdDate).toLocaleDateString('sv-SE')}</span>
                                </div>
                                {lastContact && <p className="text-xs text-gray-500 mt-1">Senast kontaktad: {new Date(lastContact.timestamp).toLocaleDateString('sv-SE')}</p>}
                                {lead.referredBy && (
                                    <p className="text-xs text-gray-500 mt-1 italic">Rekommenderad av: {lead.referredBy.participantName}</p>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-center flex-shrink-0 items-center">
                                {isRecommendation && (
                                    <button
                                        onClick={() => consentNeeded && setLeadToConfirmConsent(lead)}
                                        disabled={!consentNeeded}
                                        className={`p-2 rounded-full text-2xl ${consentNeeded ? 'text-gray-400 hover:text-gray-700' : 'text-green-500 cursor-default'}`}
                                        title={consentNeeded ? "Klicka för att bekräfta att samtycke har inhämtats" : "Samtycke har inhämtats"}
                                        aria-label={consentNeeded ? "Bekräfta samtycke" : "Samtycke bekräftat"}
                                    >
                                        {consentNeeded ? '🔒' : '🔓'}
                                    </button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}>Historik</Button>
                                <Button size="sm" variant="outline" onClick={() => setLeadToLogContactFor(lead)}>➕ Logga kontakt</Button>
                                {lead.status === 'new' && (
                                    <Button size="sm" variant="primary" onClick={() => handleCreateIntroCallFromLead(lead)} disabled={consentNeeded} title={consentNeeded ? "Samtycke krävs" : ""}>Skapa Introsamtal</Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">Inga leads matchar filtret.</p>
            </div>
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'introCalls'} className="animate-fade-in space-y-6">
        <div className="flex justify-end">
            <Button onClick={() => { setLeadBeingConverted(null); setCallToEdit(null); setIsIntroCallModalOpen(true); }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Lägg till nytt introsamtal
            </Button>
        </div>
        {unlinkedCalls.length > 0 ? (
             <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                 <h3 className="text-xl font-bold text-gray-800">Okopplade Introsamtal ({unlinkedCalls.length})</h3>
                 <div className="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2">
                     {unlinkedCalls.map(call => {
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
                                    <div className="flex gap-2 self-start sm:self-center flex-shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => { setCallToEdit(call); setIsIntroCallModalOpen(true); }}>Redigera</Button>
                                        <Button size="sm" variant="primary" onClick={() => { setCallToLink(call); setParticipantToLinkId(''); }}>Länka</Button>
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
            loggedInCoachId={loggedInStaff.id}
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
          leadId={leadBeingConverted?.id}
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
        <ConfirmationModal
            isOpen={!!leadToConfirmConsent}
            onClose={() => setLeadToConfirmConsent(null)}
            onConfirm={handleConfirmConsent}
            title="Bekräfta Samtycke"
            message="Jag bekräftar att jag har fått ett godkännande från den som rekommenderade att vi får kontakta detta lead."
            confirmButtonText="Ja, bekräfta"
        />
        {leadToLogContactFor && loggedInStaff && (
            <LogContactAttemptModal
                isOpen={!!leadToLogContactFor}
                onClose={() => setLeadToLogContactFor(null)}
                lead={leadToLogContactFor}
                onSave={(updatedLead) => setLeadsData(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l))}
                loggedInStaffId={loggedInStaff.id}
            />
        )}
    </div>
  );
};