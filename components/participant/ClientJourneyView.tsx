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
import { CallSelectorModal } from '../coach/CallSelectorModal';
import { SmsTemplateModal } from '../coach/SmsTemplateModal';
import { useNotifications } from '../../context/NotificationsContext';
import { trigger46elksActionFn } from '../../firebaseClient';

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

const cleanNumber = (num: string | undefined): string => {
    if (!num) return '';
    let cleaned = num.replace(/\s+/g, '').replace(/-/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
    if (cleaned.startsWith('0')) cleaned = '+46' + cleaned.substring(1);
    if (cleaned.startsWith('+460')) cleaned = '+46' + cleaned.substring(4);
    if (!cleaned.startsWith('+')) cleaned = '+46' + cleaned;
    return cleaned;
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
  const [leadToCall, setLeadToCall] = useState<Lead | null>(null);
  const [leadToSms, setLeadToSms] = useState<Lead | null>(null);
  const [expandedLeadHistoryIds, setExpandedLeadHistoryIds] = useState<Set<string>>(new Set());

  const executeCall = useCallback(async (callerId: string) => {
      if (!leadToCall || !loggedInStaff?.phone || !integrationSettings.elksApiId || !integrationSettings.elksApiSecret) {
          addNotification({ type: 'ERROR', title: 'Kunde inte ringa', message: 'Kontrollera att du angett ditt mottagningsnummer och att API-nycklar är sparade.' });
          return;
      }
      
      const from = cleanNumber(loggedInStaff.phone);
      const to = cleanNumber(leadToCall.phone);
      const displayId = cleanNumber(callerId);

      addNotification({ type: 'INFO', title: 'Ringer upp...', message: `Vi ringer din mobil ${from} först. Svara för att kopplas till kunden.` });

      try {
          const result = await trigger46elksActionFn({
              action: 'call',
              from,
              to,
              voice_start: JSON.stringify({ connect: to, callerid: displayId }),
              elksApiId: integrationSettings.elksApiId,
              elksApiSecret: integrationSettings.elksApiSecret
          });

          if (result.data.error) throw new Error(result.data.error);

          addNotification({ type: 'SUCCESS', title: 'Samtal startat', message: 'Håll telefonen redo!' });
          setLeadToCall(null);
          setLeadToLogContact(leadToCall);
      } catch (err) {
          console.error("46elks Call Error:", err);
          addNotification({ type: 'ERROR', title: 'Koppling misslyckades', message: 'Kunde inte starta samtalet via servern. Kontrollera API-inställningar.' });
      }
  }, [leadToCall, loggedInStaff, integrationSettings, addNotification]);

  const executeSms = useCallback(async (content: string, templateName: string) => {
    if (!leadToSms || !leadToSms.phone || !integrationSettings.elksApiId || !integrationSettings.elksApiSecret) {
        addNotification({ type: 'ERROR', title: 'Kunde inte skicka SMS', message: 'API-uppgifter saknas.' });
        return;
    }

    const to = cleanNumber(leadToSms.phone);
    const from = "Flexibel";

    try {
        const result = await trigger46elksActionFn({
            action: 'sms',
            from,
            to,
            message: content,
            elksApiId: integrationSettings.elksApiId,
            elksApiSecret: integrationSettings.elksApiSecret
        });

        if (result.data.error) throw new Error(result.data.error);

        addNotification({ type: 'SUCCESS', title: 'SMS Skickat!', message: `Meddelande skickat till ${leadToSms.firstName}.` });
        
        handleSaveContactAttempt(leadToSms.id, {
            method: 'sms',
            outcome: 'follow_up',
            notes: `Automatiskt SMS: ${templateName}`
        });

        setLeadToSms(null);
    } catch (err) {
        console.error("46elks SMS Error:", err);
        addNotification({ type: 'ERROR', title: 'Kunde inte skicka', message: 'Ett tekniskt fel uppstod vid sändning via servern.' });
    }
  }, [leadToSms, integrationSettings, handleSaveContactAttempt, addNotification]);

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
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
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
                                            <Button size="sm" variant="secondary" onClick={() => handleRestoreLead(lead)}>Återställ</Button>
                                            <Button size="sm" variant="danger" onClick={() => setLeadToDeletePermanent(lead)}>Radera permanent</Button>
                                        </>
                                    ) : (
                                        <>
                                            {lead.phone && (
                                                <div className="flex gap-1 mr-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="!text-green-600 !bg-green-50 hover:!bg-green-100" 
                                                        onClick={() => setLeadToCall(lead)}
                                                        title="Ring via 46elks"
                                                    >
                                                        📞 Ring
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="!text-blue-600 !bg-blue-50 hover:!bg-blue-100" 
                                                        onClick={() => setLeadToSms(lead)}
                                                        title="Skicka SMS-mall"
                                                    >
                                                        💬 SMS
                                                    </Button>
                                                </div>
                                            )}
                                            <Button size="sm" variant="outline" onClick={() => setLeadToLogContact(lead)}>Logga kontakt</Button>
                                            <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => setLeadToMarkAsJunk(lead)}>Skräp</Button>
                                            {lead.status !== 'converted' && (
                                                <Button size="sm" variant="primary" onClick={() => handleCreateIntroCallFromLead(lead)}>Skapa Introsamtal</Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {isExpanded && lead.contactHistory && lead.contactHistory.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100 animate-fade-in">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Kontaktlogg</h4>
                                    <div className="space-y-2">
                                        {lead.contactHistory.map(attempt => (
                                            <div key={attempt.id} className="text-sm bg-gray-50 p-2 rounded-md">
                                                <div className="flex justify-between">
                                                    <span className="font-medium text-gray-800">
                                                        {CONTACT_ATTEMPT_METHOD_OPTIONS.find(m => m.value === attempt.method)?.label || attempt.method}
                                                    </span>
                                                    <span className="text-gray-500 text-xs">{new Date(attempt.timestamp).toLocaleString('sv-SE')}</span>
                                                </div>
                                                <p className="text-gray-600">
                                                    {CONTACT_ATTEMPT_OUTCOME_OPTIONS.find(o => o.value === attempt.outcome)?.label || attempt.outcome}
                                                </p>
                                                {attempt.notes && <p className="text-gray-500 italic mt-1">"{attempt.notes}"</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">Inga leads i denna kategori.</p>
            </div>
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'introCalls'} className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="flex p-1 bg-gray-100 rounded-lg">
                <button
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${introCallView === 'actionable' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setIntroCallView('actionable')}
                >
                    Aktuella ({actionableIntroCalls.length})
                </button>
                <button
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${introCallView === 'archived' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setIntroCallView('archived')}
                >
                    Historik ({archivedIntroCalls.length})
                </button>
            </div>
            <Button onClick={() => { setLeadBeingConverted(null); setCallToEdit(null); setIsIntroCallModalOpen(true); }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Lägg till nytt introsamtal
            </Button>
        </div>
        
        {callsToDisplay.length > 0 ? (
             <div className={`p-4 rounded-lg border ${introCallView === 'actionable' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} space-y-4`}>
                 <h3 className={`text-xl font-bold ${introCallView === 'actionable' ? 'text-gray-800' : 'text-gray-600'}`}>
                     {introCallView === 'actionable' ? 'Att göra' : 'Tidigare samtal'}
                 </h3>
                 <div className="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2">
                     {callsToDisplay.map(call => {
                         const coach = staffMembers.find(s => s.id === call.coachId);
                         const isArchived = introCallView === 'archived';
                         
                         let statusBadge = null;
                         if (call.status === 'linked') {
                             statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">✅ Medlem</span>;
                         } else if (call.outcome === 'not_interested') {
                              statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800">⛔️ Ej intresserad</span>;
                         } else if (call.status === 'archived') {
                              statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">🗄 Arkiverad</span>;
                         } else if (call.outcome === 'thinking') {
                              statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">🤔 Tänker på saken</span>;
                         }

                         return (
                             <div key={call.id} className={`p-3 bg-white rounded-md border shadow-sm ${isArchived ? 'opacity-80' : ''}`}>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-lg text-gray-900">{call.prospectName}</p>
                                            {statusBadge}
                                        </div>
                                        <p className="text-sm text-gray-600">{call.prospectEmail}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="text-gray-500">Coach: {coach?.name || 'Okänd'}</span>
                                            <span className="text-gray-400">| {new Date(call.createdDate).toLocaleDateString('sv-SE')}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 self-start sm:self-center flex-shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => { setCallToEdit(call); setIsIntroCallModalOpen(true); }}>Redigera</Button>
                                        {isArchived ? (
                                            <Button size="sm" variant="secondary" onClick={() => {}}>Återaktivera</Button>
                                        ) : (
                                            <Button size="sm" variant="primary" onClick={() => { setCallToLink(call); setParticipantToLinkId(''); }}>Länka</Button>
                                        )}
                                    </div>
                                </div>
                             </div>
                         )
                     })}
                 </div>
             </div>
        ) : (
             <div className="text-center p-8 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-500">
                    {introCallView === 'actionable' ? 'Inga samtal att hantera just nu.' : 'Ingen historik att visa.'}
                </p>
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
                        const today = new Date();
                        const bindingEnd = p.bindingEndDate ? new Date(p.bindingEndDate) : null;
                        const daysToBindingEnd = bindingEnd ? Math.ceil((bindingEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;
                        const isExpiringSoon = bindingEnd && daysToBindingEnd <= 35 && daysToBindingEnd >= 0;

                        return (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <button onClick={() => handleOpenNotesModal(p)} className="text-left w-full">
                                        <div className="flex items-center gap-2">
                                            <EngagementIndicator level={p.engagementLevel} />
                                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                {p.name}
                                                {bindingEnd && (
                                                    <span 
                                                        title={isExpiringSoon ? `Bindningstid går ut ${bindingEnd.toLocaleDateString('sv-SE')} (${daysToBindingEnd} dagar kvar)` : `Bunden t.o.m. ${bindingEnd.toLocaleDateString('sv-SE')}`} 
                                                        className={`cursor-help text-base ${isExpiringSoon ? 'animate-pulse' : 'opacity-60'}`}
                                                        style={{ transform: 'scale(0.8)' }}
                                                    >
                                                        {isExpiringSoon ? '🔒⏳' : '🔒'}
                                                    </span>
                                                )}
                                            </div>
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
            allActivityLogs={allActivityLogs.filter(l => l.participantId === selectedParticipant.id)}
            setParticipantGoals={() => {}} 
            setGoalCompletionLogs={() => {}} 
            onAddNote={() => {}} 
            onUpdateNote={() => {}} 
            onDeleteNote={() => {}} 
            oneOnOneSessions={oneOnOneSessions}
            setOneOnOneSessions={() => {}} 
            coaches={staffMembers}
            loggedInCoachId={loggedInStaff!.id}
            workouts={[]} 
            addWorkout={async () => {}} 
            updateWorkout={async () => {}} 
            deleteWorkout={async () => {}} 
            workoutCategories={[]} 
            participants={participants}
            staffAvailability={[]} 
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
          onSave={(data) => handleSaveIntroCall(data, leadBeingConverted)}
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
                    <Button onClick={handleConfirmLink(callToLink!, participantToLinkId)} disabled={!participantToLinkId}>Länka och skapa anteckning</Button>
                </div>
            </div>
      </Modal>
      
      <LogContactModal 
        isOpen={!!leadToLogContact} 
        onClose={() => setLeadToLogContact(null)} 
        lead={leadToLogContact}
        onSave={(attempt) => leadToLogContact && handleSaveContactAttempt(leadToLogContact.id, attempt)}
      />

      <CallSelectorModal
        isOpen={!!leadToCall}
        onClose={() => setLeadToCall(null)}
        lead={leadToCall}
        coach={loggedInStaff}
        locations={locations}
        settings={integrationSettings}
        onConfirm={executeCall}
      />

      <SmsTemplateModal
        isOpen={!!leadToSms}
        onClose={() => setLeadToSms(null)}
        lead={leadToSms}
        coach={loggedInStaff}
        templates={smsTemplates}
        locations={locations}
        onConfirm={executeSms}
      />

      <ConfirmationModal
        isOpen={!!leadToMarkAsJunk}
        onClose={() => setLeadToMarkAsJunk(null)}
        onConfirm={() => handleConfirmMarkAsJunk(leadToMarkAsJunk!)}
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
    </div>
  );
};