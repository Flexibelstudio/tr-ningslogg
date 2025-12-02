
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { ParticipantProfile, Lead, ProspectIntroCall, StaffMember } from '../../../types';

type LeadFilter = 'all' | 'new' | 'contacted' | 'intro_booked' | 'converted' | 'junk';
type IntroCallFilter = 'actionable' | 'archived';
type ClientJourneyTab = 'leads' | 'introCalls' | 'memberJourney';

export interface ClientJourneyEntryExtended extends ParticipantProfile {
  phase: 'Startprogram' | 'Medlem' | 'Riskzon';
  phaseColorClass: string;
  progressText: string;
  nextActionText: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  lastActivityDate: Date | null;
  engagementLevel: 'green' | 'yellow' | 'red' | 'neutral';
}

export const useClientJourney = (loggedInStaff: StaffMember | null) => {
  const {
    participantDirectory: participants,
    oneOnOneSessions,
    workoutLogs: allWorkoutLogs, // Using raw logs for calculations
    generalActivityLogs,
    goalCompletionLogs,
    memberships,
    integrationSettings,
    workouts,
    workoutCategories,
    leads,
    setLeadsData,
    prospectIntroCalls,
    setProspectIntroCallsData,
    setCoachNotesData,
  } = useAppContext();

  const allActivityLogs = useMemo(
    () => [...allWorkoutLogs, ...generalActivityLogs, ...goalCompletionLogs],
    [allWorkoutLogs, generalActivityLogs, goalCompletionLogs]
  );

  const [activeTab, setActiveTab] = useState<ClientJourneyTab>('leads');
  const [activeLeadFilter, setActiveLeadFilter] = useState<LeadFilter>('all'); // Default to 'all' (Active)
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // For journey tab
  const [introCallView, setIntroCallView] = useState<IntroCallFilter>('actionable');

  const journeyData = useMemo<ClientJourneyEntryExtended[]>(() => {
    return participants
      .filter((p) => p.isActive || p.isProspect)
      .map((p) => {
        const today = new Date();
        const referenceDateString = p.startDate || p.creationDate;
        if (!referenceDateString) return null;
        const referenceDate = new Date(referenceDateString);
        const daysSinceStart = Math.floor((today.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

        const myLogs = allActivityLogs
          .filter((l) => l.participantId === p.id)
          .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
        const myWorkoutLogs = allWorkoutLogs.filter((l) => l.participantId === p.id);
        const logsLast21Days = myLogs.filter(
          (l) => new Date(l.completedDate) > new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
        ).length;

        const lastActivityDate = myLogs[0] ? new Date(myLogs[0].completedDate) : null;
        const daysSinceLastActivity = lastActivityDate
          ? Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

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

        let finalEntry: Omit<ClientJourneyEntryExtended, keyof ParticipantProfile>;

        // 1. Riskzon
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
        // 2. Startprogram
        else if (p.isProspect) {
          const { startProgramCategoryId, startProgramSessionsRequired } = integrationSettings;
          const startProgramCategory = workoutCategories.find((c) => c.id === startProgramCategoryId);

          let progressText = 'Startprogram (ej konf.)';
          let nextActionText = 'Konfigurera startprogram';
          let nextActionPriority: 'high' | 'medium' | 'low' = 'high';

          if (startProgramCategory && startProgramSessionsRequired && startProgramSessionsRequired > 0) {
            const completedCount = myWorkoutLogs.filter((log) => {
              const workout = workouts.find((w) => w.id === log.workoutId);
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
        // 3. Medlem
        else {
          const membership = memberships.find((m) => m.id === p.membershipId);
          const checkInSessions = oneOnOneSessions
            .filter(
              (s) => s.participantId === p.id && s.title === 'Avstämningssamtal' && s.status === 'completed'
            )
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          const daysSinceLastCheckin = checkInSessions[0]
            ? Math.floor((today.getTime() - new Date(checkInSessions[0].startTime).getTime()) / (1000 * 60 * 60 * 24))
            : daysSinceStart;

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
      })
      .filter((p): p is ClientJourneyEntryExtended => p !== null);
  }, [
    participants,
    oneOnOneSessions,
    allActivityLogs,
    memberships,
    integrationSettings,
    allWorkoutLogs,
    workouts,
    workoutCategories,
  ]);

  const filteredAndSortedData = useMemo(() => {
    let data = journeyData;
    if (activeFilter === 'riskzon') {
      data = data.filter((p) => p.phase === 'Riskzon');
    } else if (activeFilter === 'startprogram') {
      data = data.filter((p) => p.phase === 'Startprogram');
    } else if (activeFilter === 'checkin') {
      data = data.filter((p) => p.phase === 'Medlem' && p.nextActionPriority !== 'low');
    }

    return data.sort((a, b) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return priorityOrder[a.nextActionPriority] - priorityOrder[b.nextActionPriority];
    });
  }, [journeyData, activeFilter]);

  const leadCounts = useMemo(() => {
    const counts: Record<string, number> = {
      new: 0,
      contacted: 0,
      intro_booked: 0,
      converted: 0,
      junk: 0,
      all: 0,
    };
    leads.forEach((l) => {
      if (counts[l.status] !== undefined) {
        counts[l.status]++;
      }
    });
    // "All" means "Active Leads" (excluding junk)
    counts.all = counts.new + counts.contacted + counts.intro_booked + counts.converted;
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const sortedLeads = [...leads].sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );
    
    if (activeLeadFilter === 'all') {
      // Filter out Junk when 'all' (All Active) is selected
      // Usually 'converted' are also filtered out from 'active' pipeline views, but prompt implied "Alla" includes converted?
      // Let's stick to standard: All Active = New + Contacted + Intro Booked + Converted (basically everything except junk)
      return sortedLeads.filter(l => l.status !== 'junk');
    }
    
    return sortedLeads.filter((l) => l.status === activeLeadFilter);
  }, [leads, activeLeadFilter]);

  const newLeadsList = useMemo(
    () =>
      leads
        .filter((l) => l.status === 'new')
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()),
    [leads]
  );

  const unlinkedCallsList = useMemo(
    () =>
      prospectIntroCalls
        .filter((c) => c.status === 'unlinked')
        .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()),
    [prospectIntroCalls]
  );

  const actionableIntroCalls = useMemo(() => {
    return prospectIntroCalls
      .filter((c) => {
        const isActionableUnlinked =
          c.status === 'unlinked' && (c.outcome === 'bought_starter' || c.outcome === 'bought_other');
        const isFollowUp = c.outcome === 'thinking';
        const isNew = c.status === 'unlinked' && c.outcome === undefined;
        return isActionableUnlinked || isFollowUp || isNew;
      })
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [prospectIntroCalls]);

  const archivedIntroCalls = useMemo(() => {
    return prospectIntroCalls
      .filter((c) => c.outcome === 'not_interested' || c.status === 'linked' || c.status === 'archived')
      .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
  }, [prospectIntroCalls]);

  const counts = useMemo(() => {
    const riskzon = journeyData.filter((p) => p.phase === 'Riskzon').length;
    const startprogram = journeyData.filter((p) => p.phase === 'Startprogram').length;
    const checkin = journeyData.filter((p) => p.phase === 'Medlem' && p.nextActionPriority !== 'low').length;
    return { riskzon, startprogram, checkin };
  }, [journeyData]);

  // Operations
  const handleSaveLead = (newLeadData: Pick<Lead, 'firstName' | 'lastName' | 'email' | 'phone' | 'locationId'>) => {
    const newLead: Lead = {
      id: crypto.randomUUID(),
      ...newLeadData,
      source: 'Manuell',
      status: 'new',
      createdDate: new Date().toISOString(),
    };
    setLeadsData((prev) => [...prev, newLead]);
  };

  const handleSaveIntroCall = (
    introCallData: Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>,
    leadBeingConverted: Lead | null
  ) => {
    if (!loggedInStaff) return;
    const newIntroCall: ProspectIntroCall = {
      ...introCallData,
      id: crypto.randomUUID(),
      createdDate: new Date().toISOString(),
      coachId: loggedInStaff.id,
      status: 'unlinked',
    };
    setProspectIntroCallsData((prev) => [...prev, newIntroCall]);

    if (leadBeingConverted) {
      const updatedLead = { ...leadBeingConverted, status: 'converted' as const };
      setLeadsData((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    }
  };

  const handleUpdateIntroCall = (updatedCall: ProspectIntroCall) => {
    setProspectIntroCallsData((prev) => prev.map((c) => (c.id === updatedCall.id ? updatedCall : c)));
  };
  
  const handleConfirmLink = (callToLink: ProspectIntroCall, participantToLinkId: string) => {
    // 1. Update the ProspectIntroCall
    const updatedCall = { ...callToLink, status: 'linked' as const, linkedParticipantId: participantToLinkId };
    setProspectIntroCallsData((prev) => prev.map((c) => (c.id === callToLink.id ? updatedCall : c)));

    // 2. Create a CoachNote
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

    setCoachNotesData((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        participantId: participantToLinkId,
        noteText: noteText,
        createdDate: new Date().toISOString(),
        noteType: 'intro-session',
      },
    ]);
  };

  const handleConfirmMarkAsJunk = (leadToMarkAsJunk: Lead) => {
    setLeadsData((prev) => prev.map((l) => (l.id === leadToMarkAsJunk.id ? { ...l, status: 'junk' } : l)));
  };
  
  const handleRestoreLead = (lead: Lead) => {
      setLeadsData((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'new' } : l)));
  };

  const handlePermanentDeleteLead = (lead: Lead) => {
      setLeadsData((prev) => prev.filter((l) => l.id !== lead.id));
  };

  const handleConfirmConsent = (leadToConfirmConsent: Lead) => {
    setLeadsData((prev) =>
      prev.map((l) => (l.id === leadToConfirmConsent.id ? { ...l, consentGiven: true } : l))
    );
  };

  const handleSaveContactAttempt = (updatedLead: Lead) => {
    setLeadsData((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
  };
  
  const handleArchiveIntroCall = (callId: string) => {
    setProspectIntroCallsData((prev) => prev.map(c => c.id === callId ? { ...c, status: 'archived' } : c));
  };

  const handleDeleteIntroCall = (callId: string) => {
    setProspectIntroCallsData(prev => prev.filter(c => c.id !== callId));
  };

  return {
    activeTab,
    setActiveTab,
    activeLeadFilter,
    setActiveLeadFilter,
    activeFilter,
    setActiveFilter,
    introCallView,
    setIntroCallView,
    journeyData,
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
    handleConfirmLink,
    handleConfirmMarkAsJunk,
    handleRestoreLead,
    handlePermanentDeleteLead,
    handleConfirmConsent,
    handleSaveContactAttempt,
    handleArchiveIntroCall,
    handleDeleteIntroCall,
  };
};
