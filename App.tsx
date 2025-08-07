import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Workout, WorkoutLog, Exercise, ActivityLog, WorkoutCategory, WorkoutBlock, LiftType, ParticipantGamificationStats, ParticipantGoalData, GeneralActivityLog, GoalCompletionLog, ParticipantConditioningStat, ParticipantProfile, UserStrengthStat, ParticipantMentalWellbeing, ParticipantClubMembership, LeaderboardSettings, CoachEvent, Connection, Comment, Reaction, ParticipantPhysiqueStat, Location, StaffMember, Membership, StaffRole, CoachNote, WeeklyHighlightSettings, OneOnOneSession, WorkoutCategoryDefinition, StaffAvailability, IntegrationSettings, GroupClassDefinition, GroupClassSchedule, ParticipantBooking } from './types'; // Added WorkoutBlock, ParticipantGamificationStats, LiftType, IntensityLevel
import { useLocalStorage } from './hooks/useLocalStorage';
import { Navbar } from './components/Navbar';
import { RoleSelector } from './components/RoleSelector';
import { CoachArea } from './components/coach/CoachArea';
import { ParticipantArea } from './components/participant/ParticipantArea';
import { LOCAL_STORAGE_KEYS, CLUB_DEFINITIONS, PREDEFINED_MEMBERSHIPS, PREDEFINED_WORKOUT_CATEGORIES, PREDEFINED_GROUP_CLASSES } from './constants'; 
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; 
import { ParticipantSelector } from './components/ParticipantSelector';
import { StaffSelector } from './components/StaffSelector';

const API_KEY = process.env.API_KEY;

const predefinedWorkouts: Workout[] = [];

// --- SEEDED DATA FOR DEMO ---
const SEEDED_PARTICIPANTS: ParticipantProfile[] = [
    {
        id: 'participant-1-seed',
        name: 'Erik Svensson',
        email: 'erik@test.com',
        isActive: true,
        creationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        age: '35',
        gender: 'Man',
        bodyweightKg: 85,
        lastUpdated: new Date().toISOString(),
        enableLeaderboardParticipation: true,
        isSearchable: true,
        locationId: 'loc-1-seed', // Salem
        membershipId: 'membership-standard-seed',
    },
    {
        id: 'participant-2-seed',
        name: 'Anna Andersson',
        email: 'anna@test.com',
        isActive: true,
        creationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        age: '32',
        gender: 'Kvinna',
        bodyweightKg: 65,
        lastUpdated: new Date().toISOString(),
        enableLeaderboardParticipation: true,
        isSearchable: true,
        locationId: 'loc-1-seed', // Salem
        membershipId: 'membership-mini-seed',
    },
];

const SEEDED_WORKOUT_LOGS: WorkoutLog[] = [];

const SEEDED_GENERAL_LOGS: GeneralActivityLog[] = [
    {
        type: 'general',
        id: 'log-anna-2-seed',
        participantId: 'participant-2-seed', // Anna's ID
        activityName: 'Promenad',
        durationMinutes: 60,
        comment: 'Skönt väder idag!',
        completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        moodRating: 4,
        reactions: [],
        comments: [
            {
                id: 'comment-1-seed',
                authorId: 'participant-1-seed', // Erik's ID
                authorName: 'Erik Svensson',
                text: 'Härligt! Bra jobbat!',
                createdDate: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
            }
        ],
    }
];

const SEEDED_CONNECTIONS: Connection[] = [
    {
        id: 'conn-1-seed',
        requesterId: 'participant-2-seed', // Anna requested
        receiverId: 'participant-1-seed', // Erik
        status: 'accepted',
        createdDate: new Date().toISOString(),
    }
];

const SEEDED_LOCATIONS: Location[] = [
    { id: 'loc-1-seed', name: 'Salem' },
    { id: 'loc-2-seed', name: 'Kärra' },
];

const SEEDED_STAFF_MEMBERS: StaffMember[] = [
    {
        id: 'staff-1-seed',
        name: 'Kalle Coach',
        email: 'kalle.coach@flexibel.se',
        role: 'Coach',
        locationId: 'loc-2-seed', // Kärra
        isActive: true,
    },
    {
        id: 'staff-2-seed',
        name: 'Sanna Admin',
        email: 'sanna.admin@flexibel.se',
        role: 'Admin',
        locationId: 'loc-1-seed', // Salem
        isActive: true,
    },
    {
        id: 'staff-3-seed-erik',
        name: 'Erik Svensson (Personal)',
        email: 'erik@test.com',
        role: 'Coach',
        locationId: 'loc-2-seed',
        isActive: true,
    }
];

const SEEDED_GROUP_CLASS_SCHEDULES: GroupClassSchedule[] = [];
// --- END OF SEEDED DATA ---

type CoachTab = 'overview' | 'klientresan' | 'programs' | 'bookings' | 'insights' | 'leaderboards' | 'events' | 'personal' | 'settings';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useLocalStorage<UserRole | null>(LOCAL_STORAGE_KEYS.USER_ROLE, null);
  const [currentParticipantId, setCurrentParticipantId] = useLocalStorage<string | null>('flexibel_currentParticipantId', null);
  const [currentStaffId, setCurrentStaffId] = useLocalStorage<string | null>('flexibel_currentStaffId', null);
  const [isViewingAsParticipant, setIsViewingAsParticipant] = useState(false);

  // Centralized state management
  const [participantDirectory, setParticipantDirectory] = useLocalStorage<ParticipantProfile[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_DIRECTORY, SEEDED_PARTICIPANTS);
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>(LOCAL_STORAGE_KEYS.WORKOUTS, predefinedWorkouts);
  const [workoutLogs, setWorkoutLogs] = useLocalStorage<WorkoutLog[]>(LOCAL_STORAGE_KEYS.WORKOUT_LOGS, SEEDED_WORKOUT_LOGS);
  const [participantGoals, setParticipantGoals] = useLocalStorage<ParticipantGoalData[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_GOALS, []);
  const [generalActivityLogs, setGeneralActivityLogs] = useLocalStorage<GeneralActivityLog[]>(LOCAL_STORAGE_KEYS.GENERAL_ACTIVITY_LOGS, SEEDED_GENERAL_LOGS);
  const [goalCompletionLogs, setGoalCompletionLogs] = useLocalStorage<GoalCompletionLog[]>(LOCAL_STORAGE_KEYS.GOAL_COMPLETION_LOGS, []);
  const [coachNotes, setCoachNotes] = useLocalStorage<CoachNote[]>(LOCAL_STORAGE_KEYS.COACH_MEMBER_NOTES, []);
  const [userStrengthStats, setUserStrengthStats] = useLocalStorage<UserStrengthStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_STRENGTH_STATS, []);
  const [userConditioningStatsHistory, setUserConditioningStatsHistory] = useLocalStorage<ParticipantConditioningStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_CONDITIONING_STATS, []);
  const [participantPhysiqueHistory, setParticipantPhysiqueHistory] = useLocalStorage<ParticipantPhysiqueStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_PHYSIQUE_HISTORY, []);
  const [participantMentalWellbeing, setParticipantMentalWellbeing] = useLocalStorage<ParticipantMentalWellbeing[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_MENTAL_WELLBEING, []);
  const [participantGamificationStats, setParticipantGamificationStats] = useLocalStorage<ParticipantGamificationStats[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_GAMIFICATION_STATS, []);
  const [clubMemberships, setClubMemberships] = useLocalStorage<ParticipantClubMembership[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_CLUB_MEMBERSHIPS, []);
  const [leaderboardSettings, setLeaderboardSettings] = useLocalStorage<LeaderboardSettings>(
      LOCAL_STORAGE_KEYS.LEADERBOARD_SETTINGS,
      { leaderboardsEnabled: true, weeklyPBChallengeEnabled: true, weeklySessionChallengeEnabled: true }
  );
  const [coachEvents, setCoachEvents] = useLocalStorage<CoachEvent[]>(LOCAL_STORAGE_KEYS.COACH_EVENTS, []);
  const [connections, setConnections] = useLocalStorage<Connection[]>(LOCAL_STORAGE_KEYS.CONNECTIONS, SEEDED_CONNECTIONS);
  const [lastFlowViewTimestamp, setLastFlowViewTimestamp] = useLocalStorage<string | null>(LOCAL_STORAGE_KEYS.LAST_FLOW_VIEW_TIMESTAMP, null);
  const [locations, setLocations] = useLocalStorage<Location[]>(LOCAL_STORAGE_KEYS.LOCATIONS, SEEDED_LOCATIONS);
  const [staffMembers, setStaffMembers] = useLocalStorage<StaffMember[]>(LOCAL_STORAGE_KEYS.STAFF_MEMBERS, SEEDED_STAFF_MEMBERS);
  const [memberships, setMemberships] = useLocalStorage<Membership[]>(LOCAL_STORAGE_KEYS.MEMBERSHIPS, PREDEFINED_MEMBERSHIPS);
  const [weeklyHighlightSettings, setWeeklyHighlightSettings] = useLocalStorage<WeeklyHighlightSettings>(
    LOCAL_STORAGE_KEYS.WEEKLY_HIGHLIGHT_SETTINGS,
    {
      isEnabled: false,
      dayOfWeek: 1, // Monday
      time: '09:00',
      studioTarget: 'separate',
    }
  );
  const [oneOnOneSessions, setOneOnOneSessions] = useLocalStorage<OneOnOneSession[]>(LOCAL_STORAGE_KEYS.ONE_ON_ONE_SESSIONS, []);
  const [workoutCategories, setWorkoutCategories] = useLocalStorage<WorkoutCategoryDefinition[]>(LOCAL_STORAGE_KEYS.WORKOUT_CATEGORIES, PREDEFINED_WORKOUT_CATEGORIES);
  const [staffAvailability, setStaffAvailability] = useLocalStorage<StaffAvailability[]>(LOCAL_STORAGE_KEYS.STAFF_AVAILABILITY, []);
  const [integrationSettings, setIntegrationSettings] = useLocalStorage<IntegrationSettings>(
    LOCAL_STORAGE_KEYS.INTEGRATION_SETTINGS,
    { enableQRCodeScanning: false, isBookingEnabled: true, bookingLeadTimeWeeks: 2, cancellationCutoffHours: 2 }
  );
  const [groupClassDefinitions, setGroupClassDefinitions] = useLocalStorage<GroupClassDefinition[]>(LOCAL_STORAGE_KEYS.GROUP_CLASS_DEFINITIONS, PREDEFINED_GROUP_CLASSES);
  const [groupClassSchedules, setGroupClassSchedules] = useLocalStorage<GroupClassSchedule[]>(LOCAL_STORAGE_KEYS.GROUP_CLASS_SCHEDULES, SEEDED_GROUP_CLASS_SCHEDULES);
  const [participantBookings, setParticipantBookings] = useLocalStorage<ParticipantBooking[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_BOOKINGS, []);


  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeModalShown, setWelcomeModalShown] = useLocalStorage<boolean>(
    LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT,
    false
  );
  const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);

  const handleSetRole = (role: UserRole | null) => {
    setCurrentRole(role);
    if (role !== UserRole.PARTICIPANT) {
      setIsViewingAsParticipant(false);
      setCurrentParticipantId(null);
    }
  };

  const handleLogoutStaff = () => {
    setCurrentStaffId(null);
    setCurrentRole(null);
    setIsViewingAsParticipant(false);
  };

  const handleBookClass = useCallback((participantId: string, scheduleId: string, classDate: string) => {
    const schedule = groupClassSchedules.find(s => s.id === scheduleId);
    if (!schedule) {
        console.error("Schedule not found");
        return;
    }

    const bookedCount = participantBookings.filter(b => b.scheduleId === scheduleId && b.classDate === classDate && b.status === 'BOOKED').length;
    
    const newStatus = bookedCount >= schedule.maxParticipants ? 'WAITLISTED' : 'BOOKED';

    const newBooking: ParticipantBooking = {
      id: crypto.randomUUID(),
      participantId,
      scheduleId,
      classDate,
      bookingDate: new Date().toISOString(),
      status: newStatus
    };
    setParticipantBookings(prev => [...prev, newBooking]);
  }, [setParticipantBookings, groupClassSchedules, participantBookings]);

  const handleCancelBooking = useCallback((bookingId: string) => {
    setParticipantBookings(prev => {
        const bookingToCancelIndex = prev.findIndex(b => b.id === bookingId);
        if (bookingToCancelIndex === -1) return prev;
        
        const bookingToCancel = prev[bookingToCancelIndex];
        let nextState = [...prev];

        // If the booking was waitlisted, we just cancel it.
        // If it was booked, we cancel it AND promote someone from the waitlist.
        const wasBooked = bookingToCancel.status === 'BOOKED';
        nextState[bookingToCancelIndex] = { ...bookingToCancel, status: 'CANCELLED' };

        if (wasBooked) {
            const waitlisters = prev
                .filter(b => 
                    b.scheduleId === bookingToCancel.scheduleId && 
                    b.classDate === bookingToCancel.classDate && 
                    b.status === 'WAITLISTED'
                )
                .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());

            if (waitlisters.length > 0) {
                const personToPromoteId = waitlisters[0].id;
                const personToPromoteIndex = nextState.findIndex(b => b.id === personToPromoteId);
                if (personToPromoteIndex !== -1) {
                    nextState[personToPromoteIndex] = { ...nextState[personToPromoteIndex], status: 'BOOKED' };
                }
            }
        }
        
        return nextState;
    });
  }, [setParticipantBookings]);

  const handleCheckInParticipant = useCallback((bookingId: string) => {
    setParticipantBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status: 'CHECKED-IN' } : b))
    );
  }, [setParticipantBookings]);

  const handleToggleReaction = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event', emoji: string) => {
    const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
        return logs.map(log => {
            if (log.id === logId) {
                if (!currentParticipantId) return log;
                const myReactions = (log.reactions || []).filter((r: Reaction) => r.participantId === currentParticipantId);
                let updatedReactions = [...(log.reactions || [])];

                if (myReactions.length > 0) { // I have reacted before
                    const myExistingReaction = myReactions.find(r => r.emoji === emoji);
                    updatedReactions = updatedReactions.filter(r => r.participantId !== currentParticipantId);
                    if (!myExistingReaction) { // I reacted with a different emoji, so add the new one
                        updatedReactions.push({ participantId: currentParticipantId, emoji });
                    }
                } else { // First time I react
                    updatedReactions.push({ participantId: currentParticipantId, emoji });
                }
                return { ...log, reactions: updatedReactions };
            }
            return log;
        });
    };

    if (logType === 'workout') {
        setWorkoutLogs(updater as (prev: WorkoutLog[]) => WorkoutLog[]);
    } else if (logType === 'general') {
        setGeneralActivityLogs(updater as (prev: GeneralActivityLog[]) => GeneralActivityLog[]);
    } else if (logType === 'coach_event') {
        setCoachEvents(updater as (prev: CoachEvent[]) => CoachEvent[]);
    }
  }, [setWorkoutLogs, setGeneralActivityLogs, setCoachEvents, currentParticipantId]);

  const handleAddComment = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', text: string) => {
    let authorId: string | null = null;
    let authorName: string = 'Okänd';
    
    const loggedInStaff = staffMembers.find(s => s.id === currentStaffId);
    const correspondingParticipantForStaff = loggedInStaff ? participantDirectory.find(p => p.email && loggedInStaff.email && p.email.toLowerCase() === loggedInStaff.email.toLowerCase()) : undefined;

    if (isViewingAsParticipant && correspondingParticipantForStaff) {
         authorId = correspondingParticipantForStaff.id;
         authorName = correspondingParticipantForStaff.name || 'Användare';
    } else if (currentStaffId && !isViewingAsParticipant) {
        authorId = currentStaffId;
        authorName = loggedInStaff?.name || 'Coach';
    } else if (currentParticipantId) {
        authorId = currentParticipantId;
        authorName = participantDirectory.find(p => p.id === currentParticipantId)?.name || 'Medlem';
    }

    if (!authorId) {
        console.error("Could not determine author for comment.");
        return;
    }

    const newComment: Comment = {
        id: crypto.randomUUID(),
        authorId: authorId,
        authorName: authorName,
        text,
        createdDate: new Date().toISOString(),
    };
    
    const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
        return logs.map(log => {
            if (log.id === logId) {
                const updatedComments = [...(log.comments || []), newComment];
                return { ...log, comments: updatedComments };
            }
            return log;
        });
    };

    if (logType === 'workout') {
        setWorkoutLogs(updater as (prev: WorkoutLog[]) => WorkoutLog[]);
    } else if (logType === 'general') {
        setGeneralActivityLogs(updater as (prev: GeneralActivityLog[]) => GeneralActivityLog[]);
    } else if (logType === 'coach_event') {
        setCoachEvents(updater as (prev: CoachEvent[]) => CoachEvent[]);
    } else if (logType === 'one_on_one_session') {
        setOneOnOneSessions(prev => 
            prev.map(session => {
                if (session.id === logId) {
                    const updatedComments = [...(session.comments || []), newComment];
                    return { ...session, comments: updatedComments };
                }
                return session;
            })
        );
    }
  }, [setWorkoutLogs, setGeneralActivityLogs, setCoachEvents, setOneOnOneSessions, currentStaffId, isViewingAsParticipant, currentParticipantId, staffMembers, participantDirectory]);
  
  const handleDeleteComment = useCallback((logId: string, logType: 'workout' | 'general' | 'coach_event' | 'one_on_one_session', commentId: string) => {
    const updater = (logs: (WorkoutLog | GeneralActivityLog | CoachEvent)[]) => {
        return logs.map(log => {
            if (log.id === logId) {
                const updatedComments = (log.comments || []).filter((c: Comment) => c.id !== commentId);
                return { ...log, comments: updatedComments };
            }
            return log;
        });
    };

    if (logType === 'workout') {
        setWorkoutLogs(updater as (prev: WorkoutLog[]) => WorkoutLog[]);
    } else if (logType === 'general') {
        setGeneralActivityLogs(updater as (prev: GeneralActivityLog[]) => GeneralActivityLog[]);
    } else if (logType === 'coach_event') {
        setCoachEvents(updater as (prev: CoachEvent[]) => CoachEvent[]);
    } else if (logType === 'one_on_one_session') {
        setOneOnOneSessions(prev => 
            prev.map(session => {
                if (session.id === logId) {
                    const updatedComments = (session.comments || []).filter((c: Comment) => c.id !== commentId);
                    return { ...session, comments: updatedComments };
                }
                return session;
            })
        );
    }
  }, [setWorkoutLogs, setGeneralActivityLogs, setCoachEvents, setOneOnOneSessions]);


  useEffect(() => {
    // This effect ensures that if the role is changed, the relevant ID is cleared.
    if (currentRole !== UserRole.PARTICIPANT) {
      setCurrentParticipantId(null);
    }
    if (currentRole !== UserRole.COACH) {
      setCurrentStaffId(null);
    }
  }, [currentRole, setCurrentParticipantId, setCurrentStaffId]);

  useEffect(() => {
    // One-time migration for existing physique data from participant profiles into the new history store.
    setParticipantPhysiqueHistory(prevHistory => {
      const migratedIds = new Set(prevHistory.map(h => h.participantId));
      const newHistoryEntries: ParticipantPhysiqueStat[] = [];
      participantDirectory.forEach(p => {
        if (!migratedIds.has(p.id) && (p.bodyweightKg || p.inbodyScore || p.muscleMassKg)) {
          newHistoryEntries.push({
            id: crypto.randomUUID(),
            participantId: p.id,
            bodyweightKg: p.bodyweightKg,
            muscleMassKg: p.muscleMassKg,
            fatMassKg: p.fatMassKg,
            inbodyScore: p.inbodyScore,
            lastUpdated: p.lastUpdated, // Use the profile's last updated timestamp for this initial entry
          });
        }
      });
      // Only update state if new entries were created to avoid re-renders
      return newHistoryEntries.length > 0 ? [...prevHistory, ...newHistoryEntries] : prevHistory;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantDirectory]); // Dependency on participantDirectory to catch initial load


  // Migrate existing workouts
  useEffect(() => {
    const workoutsFromStorage = window.localStorage.getItem(LOCAL_STORAGE_KEYS.WORKOUTS);
    if (workoutsFromStorage) {
      try {
        let parsedWorkouts = JSON.parse(workoutsFromStorage) as any[]; 
        if (Array.isArray(parsedWorkouts)) {
          let needsFullUpdate = false;

          const migratedWorkouts = parsedWorkouts.map(w => {
            let workoutChanged = false;
            let currentWorkout = { ...w };

            // Remove date if it exists
            if (currentWorkout.hasOwnProperty('date')) {
                delete currentWorkout.date;
                workoutChanged = true;
            }

            // Add category if missing
            if (currentWorkout.id && currentWorkout.title && !currentWorkout.category) {
              currentWorkout.category = 'Annat' as WorkoutCategory;
              workoutChanged = true;
            }
            
            // Migrate exercises to blocks ONLY if not a modifiable pass that already has this structure handled by definition
            if (!currentWorkout.isModifiable) {
                if (currentWorkout.exercises && !currentWorkout.blocks) {
                const exercisesWithIds = (currentWorkout.exercises as Exercise[]).map(ex => ({
                    ...ex,
                    id: ex.id || crypto.randomUUID(),
                }));
                currentWorkout.blocks = [{ id: crypto.randomUUID(), name: '', exercises: exercisesWithIds }];
                delete currentWorkout.exercises; 
                workoutChanged = true;
                } else if (currentWorkout.blocks) {
                currentWorkout.blocks = (currentWorkout.blocks as WorkoutBlock[]).map(b => {
                    let blockItselfChanged = false;
                    const newBlockId = b.id || crypto.randomUUID();
                    if (!b.id) blockItselfChanged = true;

                    const exercisesWithIds = (b.exercises || []).map(ex => {
                    if (!ex.id) {
                        blockItselfChanged = true; 
                        return { ...ex, id: crypto.randomUUID() };
                    }
                    return ex;
                    });
                    if (blockItselfChanged) workoutChanged = true;
                    return { ...b, id: newBlockId, exercises: exercisesWithIds };
                });
                }
            } else { 
                 if (!currentWorkout.blocks) {
                    currentWorkout.blocks = [];
                    workoutChanged = true;
                 }
            }
            
            if (currentWorkout.hasOwnProperty('intensityLevel')) {
                delete currentWorkout.intensityLevel;
                workoutChanged = true;
            }
            if (currentWorkout.hasOwnProperty('intensityInstructions')) {
                delete currentWorkout.intensityInstructions;
                workoutChanged = true;
            }


            if (workoutChanged) needsFullUpdate = true;
            return currentWorkout;
          });

          if (needsFullUpdate) {
            const existingRaw = window.localStorage.getItem(LOCAL_STORAGE_KEYS.WORKOUTS);
            if(existingRaw && JSON.parse(existingRaw).length > 0) { 
                 setWorkouts(migratedWorkouts as Workout[]);
            }
          }
        }
      } catch (e) {
        console.error("Error migrating workouts:", e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (API_KEY) {
      try {
        setAi(new GoogleGenAI({ apiKey: API_KEY }));
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI:", e);
      }
    } else {
      console.warn("API_KEY for Gemini not found. AI features will be disabled.");
    }
  }, []);

  useEffect(() => {
    if (currentRole === UserRole.PARTICIPANT && currentParticipantId) {
      const profile = participantDirectory.find(p => p.id === currentParticipantId);
      const isProfileComplete = !!(profile && profile.age && profile.gender && profile.gender !== '-');
      
      if (welcomeModalShown && !isProfileComplete) {
        setOpenProfileModalOnInit(true);
      }
      if (!welcomeModalShown) {
        setIsWelcomeModalOpen(true);
      }
    }
  }, [currentRole, currentParticipantId, welcomeModalShown, participantDirectory]);

    // Centralized Club Membership Calculation - REFACTORED
    useEffect(() => {
        const allLogs = [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];
        const optedInParticipants = participantDirectory.filter(p => p.enableLeaderboardParticipation && p.isActive);

        const correctlyCalculatedMemberships: ParticipantClubMembership[] = [];

        optedInParticipants.forEach(p => {
            const existingMembershipsForParticipant = clubMemberships.filter(cm => cm.participantId === p.id);

            // --- SESSION CLUBS ---
            const sessionClubs = CLUB_DEFINITIONS.filter(c => c.type === 'SESSION_COUNT');
            const participantLogs = allLogs.filter(log => log.participantId === p.id);
            const qualifiedSessionClubs = sessionClubs.filter(c => c.threshold && participantLogs.length >= c.threshold);
            if (qualifiedSessionClubs.length > 0) {
                const highestSessionClub = qualifiedSessionClubs.sort((a, b) => (b.threshold || 0) - (a.threshold || 0))[0];
                const existingMembership = existingMembershipsForParticipant.find(em => em.clubId === highestSessionClub.id);
                if (existingMembership) {
                    correctlyCalculatedMemberships.push(existingMembership);
                } else {
                    const sortedLogs = participantLogs.sort((a,b) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());
                    const achievedDate = sortedLogs[highestSessionClub.threshold! - 1]?.completedDate || new Date().toISOString();
                    correctlyCalculatedMemberships.push({ clubId: highestSessionClub.id, participantId: p.id, achievedDate });
                }
            }
            
            // --- LIFT & BODYWEIGHT LIFT CLUBS (Grouped by LiftType) ---
            const liftClubs = CLUB_DEFINITIONS.filter(c => c.type === 'LIFT' || c.type === 'BODYWEIGHT_LIFT');
            const liftTypes = [...new Set(liftClubs.map(c => c.liftType).filter((lt): lt is LiftType => !!lt))];

            liftTypes.forEach(liftType => {
                const clubsForThisLift = liftClubs.filter(c => c.liftType === liftType);
                const latestStats = userStrengthStats.filter(s => s.participantId === p.id).sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
                
                if (!latestStats) return;

                let oneRepMax: number | undefined;
                switch(liftType) {
                    case 'Knäböj': oneRepMax = latestStats.squat1RMaxKg; break;
                    case 'Bänkpress': oneRepMax = latestStats.benchPress1RMaxKg; break;
                    case 'Marklyft': oneRepMax = latestStats.deadlift1RMaxKg; break;
                    case 'Axelpress': oneRepMax = latestStats.overheadPress1RMaxKg; break;
                }
                if (oneRepMax === undefined) return;

                const qualifiedClubsForLift = clubsForThisLift.filter(club => {
                    if (club.type === 'LIFT' && club.threshold) return oneRepMax! >= club.threshold;
                    if (club.type === 'BODYWEIGHT_LIFT' && club.multiplier && latestStats.bodyweightKg) return oneRepMax! >= latestStats.bodyweightKg * club.multiplier;
                    return false;
                });

                if (qualifiedClubsForLift.length > 0) {
                    const highestLiftClub = qualifiedClubsForLift.sort((a, b) => {
                        const valA = a.threshold || (a.multiplier || 0) * (latestStats.bodyweightKg || 0);
                        const valB = b.threshold || (b.multiplier || 0) * (latestStats.bodyweightKg || 0);
                        return valB - valA;
                    })[0];
                    
                    const existingMembership = existingMembershipsForParticipant.find(em => em.clubId === highestLiftClub.id);
                    if (existingMembership) {
                        correctlyCalculatedMemberships.push(existingMembership);
                    } else {
                        correctlyCalculatedMemberships.push({ clubId: highestLiftClub.id, participantId: p.id, achievedDate: latestStats.lastUpdated });
                    }
                }
            });
            
            // --- CONDITIONING CLUBS ---
            const conditioningClubs = CLUB_DEFINITIONS.filter(c => c.type === 'CONDITIONING');
            const conditioningMetrics = [...new Set(conditioningClubs.map(c => c.conditioningMetric).filter((cm): cm is NonNullable<typeof cm> => !!cm))];

            conditioningMetrics.forEach(metric => {
                const clubsForMetric = conditioningClubs.filter(c => c.conditioningMetric === metric);
                const statsForMetric = userConditioningStatsHistory
                    .filter(s => s.participantId === p.id && (s as any)[metric] !== undefined && (s as any)[metric] !== null)
                    .sort((a, b) => {
                        const valA = (a as any)[metric]!;
                        const valB = (b as any)[metric]!;
                        return clubsForMetric[0].comparison === 'LESS_OR_EQUAL' ? valA - valB : valB - valA;
                    });
                
                const bestStat = statsForMetric[0];
                if (!bestStat) return;
                const bestValue = (bestStat as any)[metric]!;

                const qualifiedClubsForMetric = clubsForMetric.filter(club => {
                    if (!club.threshold) return false;
                    return club.comparison === 'LESS_OR_EQUAL' ? bestValue <= club.threshold : bestValue >= club.threshold;
                });

                if (qualifiedClubsForMetric.length > 0) {
                    const highestConditioningClub = qualifiedClubsForMetric.sort((a, b) => {
                        const valA = a.threshold || 0;
                        const valB = b.threshold || 0;
                        return a.comparison === 'LESS_OR_EQUAL' ? valA - valB : valB - valA;
                    })[0];

                    const existingMembership = existingMembershipsForParticipant.find(em => em.clubId === highestConditioningClub.id);
                    if (existingMembership) {
                        correctlyCalculatedMemberships.push(existingMembership);
                    } else {
                        correctlyCalculatedMemberships.push({ clubId: highestConditioningClub.id, participantId: p.id, achievedDate: bestStat.lastUpdated });
                    }
                }
            });
        });

        // Compare new state with old to avoid unnecessary re-renders
        const currentMembershipIds = new Set(clubMemberships.map(c => `${c.participantId}-${c.clubId}`));
        const newMembershipIds = new Set(correctlyCalculatedMemberships.map(c => `${c.participantId}-${c.clubId}`));

        if (currentMembershipIds.size !== newMembershipIds.size || ![...currentMembershipIds].every(id => newMembershipIds.has(id))) {
            setClubMemberships(correctlyCalculatedMemberships);
        }
    }, [participantDirectory, workoutLogs, generalActivityLogs, goalCompletionLogs, userStrengthStats, userConditioningStatsHistory, clubMemberships, setClubMemberships]);


  const loggedInStaff = staffMembers.find(s => s.id === currentStaffId);
  const correspondingParticipantForStaff = loggedInStaff ? participantDirectory.find(p => p.email && loggedInStaff.email && p.email.toLowerCase() === loggedInStaff.email.toLowerCase()) : undefined;

  const COACH_VISIBLE_TABS: CoachTab[] = ['overview', 'klientresan', 'bookings'];

  const handleSwitchToParticipantView = () => {
    if(correspondingParticipantForStaff) {
        setCurrentParticipantId(correspondingParticipantForStaff.id);
        setIsViewingAsParticipant(true);
    }
  };

  const handleSwitchToStaffView = () => {
      setIsViewingAsParticipant(false);
  };

  const renderContent = () => {
    if (!currentRole) {
      return <RoleSelector onSelectRole={handleSetRole} />;
    }

    if (currentRole === UserRole.COACH) {
      if (!currentStaffId || !loggedInStaff) {
        return <StaffSelector staff={staffMembers} onSelectStaff={setCurrentStaffId} onGoBack={() => handleSetRole(null)} />;
      }
      
      if (isViewingAsParticipant && correspondingParticipantForStaff) {
          return (
             <ParticipantArea
                currentParticipantId={correspondingParticipantForStaff.id}
                participantDirectory={participantDirectory}
                setParticipantDirectory={setParticipantDirectory}
                workouts={workouts}
                workoutLogs={workoutLogs}
                setWorkoutLogs={setWorkoutLogs}
                participantGoals={participantGoals}
                setParticipantGoals={setParticipantGoals}
                generalActivityLogs={generalActivityLogs}
                setGeneralActivityLogs={setGeneralActivityLogs}
                goalCompletionLogs={goalCompletionLogs}
                setGoalCompletionLogs={setGoalCompletionLogs}
                userStrengthStats={userStrengthStats}
                setUserStrengthStats={setUserStrengthStats}
                userConditioningStatsHistory={userConditioningStatsHistory}
                setUserConditioningStatsHistory={setUserConditioningStatsHistory}
                participantPhysiqueHistory={participantPhysiqueHistory}
                setParticipantPhysiqueHistory={setParticipantPhysiqueHistory}
                participantMentalWellbeing={participantMentalWellbeing}
                setParticipantMentalWellbeing={setParticipantMentalWellbeing}
                participantGamificationStats={participantGamificationStats}
                setParticipantGamificationStats={setParticipantGamificationStats}
                clubMemberships={clubMemberships}
                leaderboardSettings={leaderboardSettings}
                coachEvents={coachEvents}
                connections={connections}
                setConnections={setConnections}
                lastFlowViewTimestamp={lastFlowViewTimestamp}
                setLastFlowViewTimestamp={setLastFlowViewTimestamp}
                locations={locations}
                memberships={memberships}
                staffMembers={staffMembers}
                oneOnOneSessions={oneOnOneSessions}
                workoutCategories={workoutCategories}
                currentRole={currentRole}
                onSetRole={handleSetRole}
                onToggleReaction={handleToggleReaction}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                openProfileModalOnInit={openProfileModalOnInit}
                onProfileModalOpened={() => setOpenProfileModalOnInit(false)}
                isStaffViewingSelf={true}
                onSwitchToStaffView={handleSwitchToStaffView}
                integrationSettings={integrationSettings}
                groupClassSchedules={groupClassSchedules}
                groupClassDefinitions={groupClassDefinitions}
                allParticipantBookings={participantBookings}
                onBookClass={handleBookClass}
                onCancelBooking={handleCancelBooking}
                onCheckInParticipant={handleCheckInParticipant}
            />
          );
      }
      
      // Admin and Coach now use CoachArea, with different tabs
      return (
        <div className="container mx-auto p-4 sm:p-6">
          <CoachArea
            workouts={workouts}
            setWorkouts={setWorkouts}
            workoutLogs={workoutLogs}
            participantGoals={participantGoals}
            setParticipantGoals={setParticipantGoals}
            generalActivityLogs={generalActivityLogs}
            goalCompletionLogs={goalCompletionLogs}
            setGoalCompletionLogs={setGoalCompletionLogs}
            ai={ai}
            participantDirectory={participantDirectory}
            setParticipantDirectory={setParticipantDirectory}
            userStrengthStats={userStrengthStats}
            clubMemberships={clubMemberships}
            setClubMemberships={setClubMemberships}
            leaderboardSettings={leaderboardSettings}
            setLeaderboardSettings={setLeaderboardSettings}
            coachEvents={coachEvents}
            setCoachEvents={setCoachEvents}
            locations={locations}
            setLocations={setLocations}
            staffMembers={staffMembers}
            setStaffMembers={setStaffMembers}
            memberships={memberships}
            setMemberships={setMemberships}
            workoutCategories={workoutCategories}
            setWorkoutCategories={setWorkoutCategories}
            coachNotes={coachNotes}
            setCoachNotes={setCoachNotes}
            weeklyHighlightSettings={weeklyHighlightSettings}
            setWeeklyHighlightSettings={setWeeklyHighlightSettings}
            oneOnOneSessions={oneOnOneSessions}
            setOneOnOneSessions={setOneOnOneSessions}
            staffAvailability={staffAvailability}
            setStaffAvailability={setStaffAvailability}
            loggedInStaff={loggedInStaff}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            visibleTabs={loggedInStaff.role === 'Admin' ? undefined : COACH_VISIBLE_TABS}
            integrationSettings={integrationSettings}
            setIntegrationSettings={setIntegrationSettings}
            groupClassDefinitions={groupClassDefinitions}
            setGroupClassDefinitions={setGroupClassDefinitions}
            groupClassSchedules={groupClassSchedules}
            setGroupClassSchedules={setGroupClassSchedules}
            participantBookings={participantBookings}
            onCheckInParticipant={handleCheckInParticipant}
          />
        </div>
      );
    }
    
    if (currentRole === UserRole.PARTICIPANT) {
      if (!currentParticipantId) {
        return <ParticipantSelector participants={participantDirectory} onSelectParticipant={setCurrentParticipantId} onGoBack={() => handleSetRole(null)} />;
      }
      return (
        <>
            <ParticipantArea
                currentParticipantId={currentParticipantId}
                participantDirectory={participantDirectory}
                setParticipantDirectory={setParticipantDirectory}
                workouts={workouts}
                workoutLogs={workoutLogs}
                setWorkoutLogs={setWorkoutLogs}
                participantGoals={participantGoals}
                setParticipantGoals={setParticipantGoals}
                generalActivityLogs={generalActivityLogs}
                setGeneralActivityLogs={setGeneralActivityLogs}
                goalCompletionLogs={goalCompletionLogs}
                setGoalCompletionLogs={setGoalCompletionLogs}
                userStrengthStats={userStrengthStats}
                setUserStrengthStats={setUserStrengthStats}
                userConditioningStatsHistory={userConditioningStatsHistory}
                setUserConditioningStatsHistory={setUserConditioningStatsHistory}
                participantPhysiqueHistory={participantPhysiqueHistory}
                setParticipantPhysiqueHistory={setParticipantPhysiqueHistory}
                participantMentalWellbeing={participantMentalWellbeing}
                setParticipantMentalWellbeing={setParticipantMentalWellbeing}
                participantGamificationStats={participantGamificationStats}
                setParticipantGamificationStats={setParticipantGamificationStats}
                clubMemberships={clubMemberships}
                leaderboardSettings={leaderboardSettings}
                coachEvents={coachEvents}
                connections={connections}
                setConnections={setConnections}
                lastFlowViewTimestamp={lastFlowViewTimestamp}
                setLastFlowViewTimestamp={setLastFlowViewTimestamp}
                locations={locations}
                memberships={memberships}
                staffMembers={staffMembers}
                oneOnOneSessions={oneOnOneSessions}
                workoutCategories={workoutCategories}
                currentRole={currentRole}
                onSetRole={handleSetRole}
                onToggleReaction={handleToggleReaction}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                openProfileModalOnInit={openProfileModalOnInit}
                onProfileModalOpened={() => setOpenProfileModalOnInit(false)}
                integrationSettings={integrationSettings}
                groupClassSchedules={groupClassSchedules}
                groupClassDefinitions={groupClassDefinitions}
                allParticipantBookings={participantBookings}
                onBookClass={handleBookClass}
                onCancelBooking={handleCancelBooking}
                onCheckInParticipant={handleCheckInParticipant}
            />
            <WelcomeModal 
                isOpen={isWelcomeModalOpen}
                onClose={() => {
                    setIsWelcomeModalOpen(false);
                    setWelcomeModalShown(true);
                    // After welcome, if profile is incomplete, trigger profile modal
                    const profile = participantDirectory.find(p => p.id === currentParticipantId);
                    const isProfileComplete = !!(profile && profile.age && profile.gender && profile.gender !== '-');
                    if (!isProfileComplete) {
                        setOpenProfileModalOnInit(true);
                    }
                }}
            />
        </>
      );
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
        <Navbar 
          currentRole={currentRole} 
          onSetRole={handleSetRole}
          loggedInStaff={loggedInStaff}
          loggedInStaffAsParticipant={correspondingParticipantForStaff}
          hasParticipantProfile={!!correspondingParticipantForStaff}
          onSwitchToParticipantView={handleSwitchToParticipantView}
          onLogoutStaff={handleLogoutStaff}
        />
        <main>{renderContent()}</main>
    </div>
  );
};