
















import React, { useState, useEffect } from 'react';
import { UserRole, Workout, WorkoutLog, Exercise, ActivityLog, WorkoutCategory, WorkoutBlock, LiftType, IntensityLevel, ParticipantGamificationStats, ParticipantGoalData, GeneralActivityLog, GoalCompletionLog, ParticipantConditioningStat, ParticipantProfile, UserStrengthStat, ParticipantMentalWellbeing, ParticipantClubMembership, LeaderboardSettings, CoachEvent } from './types'; // Added WorkoutBlock, ParticipantGamificationStats, LiftType, IntensityLevel
import { useLocalStorage } from './hooks/useLocalStorage';
import { Navbar } from './components/Navbar';
import { RoleSelector } from './components/RoleSelector';
import { CoachArea } from './components/coach/CoachArea';
import { ParticipantArea } from './components/participant/ParticipantArea';
import { LOCAL_STORAGE_KEYS, INTENSITY_LEVELS, CLUB_DEFINITIONS } from './constants'; // Imported INTENSITY_LEVELS
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; 
import { ParticipantSelector } from './components/ParticipantSelector';

const API_KEY = process.env.API_KEY;

const predefinedWorkouts: Workout[] = [
  {
    id: "predefined-pt-bas-1",
    title: "Baspass 1: Knäböj & Axelpress",
    category: 'PT-bas',
    coachNote: "Fokusera på god teknik och kontrollerade rörelser i detta pass.",
    blocks: [
      {
        id: crypto.randomUUID(),
        name: 'Huvudblock',
        exercises: [
          {
            id: crypto.randomUUID(),
            name: 'Knäböj',
            notes: '3 set x 8-10 reps. Fokus på teknik och djup.',
            baseLiftType: 'Knäböj' as LiftType,
          },
          {
            id: crypto.randomUUID(),
            name: 'Axelpress',
            notes: '3 set x 8-10 reps. Stabil bål, full ROM (Range of Motion).',
            baseLiftType: 'Axelpress' as LiftType,
          },
        ],
      },
    ],
    isPublished: true,
    intensityLevel: 'Medel' as IntensityLevel, 
    intensityInstructions: INTENSITY_LEVELS.find(l => l.value === 'Medel')?.defaultInstructions,
  },
  {
    id: "predefined-pt-bas-2",
    title: "Baspass 2: Marklyft & Bänkpress",
    category: 'PT-bas',
    coachNote: "Värm upp ordentligt inför marklyften. Tänk på anspänning i bålen.",
    blocks: [
      {
        id: crypto.randomUUID(),
        name: 'Huvudblock',
        exercises: [
          {
            id: crypto.randomUUID(),
            name: 'Marklyft',
            notes: '3 set x 12-15 reps. Lättare vikt, fokus på teknik.',
            baseLiftType: 'Marklyft' as LiftType,
          },
          {
            id: crypto.randomUUID(),
            name: 'Bänkpress',
            notes: '3 set x 12-15 reps. Kontrollerad rörelse.',
            baseLiftType: 'Bänkpress' as LiftType,
          },
        ],
      },
    ],
    isPublished: true,
    intensityLevel: 'Lätt' as IntensityLevel, 
    intensityInstructions: INTENSITY_LEVELS.find(l => l.value === 'Lätt')?.defaultInstructions,
  },
  {
    id: "modifiable-pt-bas-uuid", 
    title: "Modifierbart PT-Bas",
    category: 'PT-bas',
    coachNote: "Välj två övningar från listan som passar dig idag. Fokusera på god teknik. Ange set och reps.",
    isModifiable: true,
    exerciseSelectionOptions: {
      list: ['Knäböj', 'Marklyft', 'Bänkpress', 'Axelpress', 'Stående Rodd'],
      maxSelect: 2,
      instructions: "Välj exakt 2 övningar från listan nedan."
    },
    blocks: [], 
    isPublished: true,
    intensityLevel: 'Tungt' as IntensityLevel, 
    intensityInstructions: INTENSITY_LEVELS.find(l => l.value === 'Tungt')?.defaultInstructions,
  },
  {
    id: "predefined-pt-grupp-juni-2024",
    title: "Månadens Program Juni",
    category: 'PT-grupp',
    coachNote: "Fokus på helkroppsstyrka och uthållighet denna månad. Anpassa vikter efter din dagsform!",
    blocks: [
      {
        id: crypto.randomUUID(),
        name: 'Uppvärmning & Aktivering',
        exercises: [
          { id: crypto.randomUUID(), name: 'Dynamisk Rörlighet', notes: '5-10 min (Höftcirklar, Armcirklar, Utfallssteg med rotation)' },
          { id: crypto.randomUUID(), name: 'Lätt Kardio (valfritt)', notes: '3-5 min (Roddmaskin, Airbike eller Jumping Jacks)' },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Block A - Styrka Fokus',
        exercises: [
          { id: crypto.randomUUID(), name: 'Goblet Squat', notes: '3 set x 10-12 reps. Djupa och kontrollerade.', baseLiftType: 'Knäböj' },
          { id: crypto.randomUUID(), name: 'Hantelrodd', notes: '3 set x 10-12 reps per sida. Fokus på skulderbladskontraktion.', baseLiftType: 'Hantelrodd' },
          { id: crypto.randomUUID(), name: 'Push-ups / Knästående Push-ups', notes: '3 set x Max reps (AMRAP). Behåll god form.', baseLiftType: 'Bänkpress' },
        ],
      },
      {
        id: crypto.randomUUID(),
        name: 'Block B - Uthållighet & Core',
        exercises: [
          { id: crypto.randomUUID(), name: 'Farmer\'s Walk', notes: '3 set x 30-45 sekunder. Tung vikt, stolt hållning.', baseLiftType: 'Farmer’s Walk' },
          { id: crypto.randomUUID(), name: 'Planka', notes: '3 set x 30-60 sekunder. Spänn bålen, rak kropp.' },
        ],
      },
    ],
    isPublished: true,
  },
  {
    id: "predefined-pt-grupp-augusti-2024",
    title: "Månadens Program Augusti",
    category: 'PT-grupp',
    coachNote: "Augusti fokus: Styrkeuthållighet och core stabilitet!",
    blocks: [
      {
        id: crypto.randomUUID(),
        name: 'BLOCK - ÖVERKROPP',
        exercises: (() => {
          const supersetId = crypto.randomUUID();
          return [
            {
              id: crypto.randomUUID(),
              name: 'Hantelpress på bänk',
              notes: '3 set x 10-12 reps. Kontrollerad rörelse.',
              baseLiftType: 'Bänkpress' as LiftType,
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'TRX Rodd',
              notes: '3 set x 12-15 reps. Fokus på skulderbladskontraktion.',
              baseLiftType: 'Stående Rodd' as LiftType,
              supersetIdentifier: supersetId,
            },
          ];
        })(),
      },
      {
        id: crypto.randomUUID(),
        name: 'BLOCK - UNDERKROPP',
        exercises: (() => {
          const supersetId = crypto.randomUUID();
          return [
            {
              id: crypto.randomUUID(),
              name: 'Landmine Hack Squat',
              notes: '3 set x 10-12 reps. Håll ryggen rak, pressa från hälarna.',
              baseLiftType: 'Knäböj' as LiftType,
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'Splitstand RDL',
              notes: '3 set x 10-12 reps per ben. Fokus på höftfällning och hamstring.',
              baseLiftType: 'RDL' as LiftType,
              supersetIdentifier: supersetId,
            },
          ];
        })(),
      },
      {
        id: crypto.randomUUID(),
        name: 'BLOCK - GEMENSAMT',
        exercises: (() => {
          const supersetId = crypto.randomUUID();
          return [
            {
              id: crypto.randomUUID(),
              name: 'Ballistic row med viktsplatta',
              notes: '3 set x 10-12 reps. Explosiv dragrörelse.',
              baseLiftType: 'Stående Rodd' as LiftType,
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'Overhead Kettlebell Svingar',
              notes: '3 set x 15-20 reps. Kraft från höften, stabil bål.',
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'Slamball över axel',
              notes: '3 set x 10-12 reps per sida. Kraftfull rotation och lyft.',
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'Box Step Over + Ner på Mage',
              notes: '3 set x 8-10 reps. Kontrollerad rörelse, spänn bålen.',
              supersetIdentifier: supersetId,
            },
            {
              id: crypto.randomUUID(),
              name: 'Farmers Walk',
              notes: '3 set x 30-45 sekunder. Tung vikt, stolt hållning.',
              baseLiftType: 'Farmer’s Walk' as LiftType,
              supersetIdentifier: supersetId,
            },
          ];
        })(),
      },
    ],
    isPublished: true,
  }
];


const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useLocalStorage<UserRole | null>(LOCAL_STORAGE_KEYS.USER_ROLE, null);
  const [currentParticipantId, setCurrentParticipantId] = useLocalStorage<string | null>('flexibel_currentParticipantId', null);

  // Centralized state management
  const [participantDirectory, setParticipantDirectory] = useLocalStorage<ParticipantProfile[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_DIRECTORY, []);
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>(LOCAL_STORAGE_KEYS.WORKOUTS, predefinedWorkouts);
  const [workoutLogs, setWorkoutLogs] = useLocalStorage<WorkoutLog[]>(LOCAL_STORAGE_KEYS.WORKOUT_LOGS, []);
  const [participantGoals, setParticipantGoals] = useLocalStorage<ParticipantGoalData[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_GOALS, []);
  const [generalActivityLogs, setGeneralActivityLogs] = useLocalStorage<GeneralActivityLog[]>(LOCAL_STORAGE_KEYS.GENERAL_ACTIVITY_LOGS, []);
  const [goalCompletionLogs, setGoalCompletionLogs] = useLocalStorage<GoalCompletionLog[]>(LOCAL_STORAGE_KEYS.GOAL_COMPLETION_LOGS, []);
  const [userStrengthStats, setUserStrengthStats] = useLocalStorage<UserStrengthStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_STRENGTH_STATS, []);
  const [userConditioningStatsHistory, setUserConditioningStatsHistory] = useLocalStorage<ParticipantConditioningStat[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_CONDITIONING_STATS, []);
  const [participantMentalWellbeing, setParticipantMentalWellbeing] = useLocalStorage<ParticipantMentalWellbeing[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_MENTAL_WELLBEING, []);
  const [participantGamificationStats, setParticipantGamificationStats] = useLocalStorage<ParticipantGamificationStats[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_GAMIFICATION_STATS, []);
  const [clubMemberships, setClubMemberships] = useLocalStorage<ParticipantClubMembership[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_CLUB_MEMBERSHIPS, []);
  const [leaderboardSettings, setLeaderboardSettings] = useLocalStorage<LeaderboardSettings>(
      LOCAL_STORAGE_KEYS.LEADERBOARD_SETTINGS,
      { leaderboardsEnabled: true, weeklyPBChallengeEnabled: true, weeklySessionChallengeEnabled: true }
  );
  const [coachEvents, setCoachEvents] = useLocalStorage<CoachEvent[]>(LOCAL_STORAGE_KEYS.COACH_EVENTS, []);

  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeModalShown, setWelcomeModalShown] = useLocalStorage<boolean>(
    LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT,
    false
  );
  const [openProfileModalOnInit, setOpenProfileModalOnInit] = useState(false);

  useEffect(() => {
    // This effect ensures that if the role is changed, the participant ID is cleared.
    if (currentRole !== UserRole.PARTICIPANT) {
      setCurrentParticipantId(null);
    }
  }, [currentRole, setCurrentParticipantId]);

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
            
            // Ensure intensityLevel and intensityInstructions are present or undefined
            if (currentWorkout.category === 'PT-bas') {
                if (!currentWorkout.hasOwnProperty('intensityLevel')) { 
                    currentWorkout.intensityLevel = undefined;
                    workoutChanged = true;
                }
                if (!currentWorkout.hasOwnProperty('intensityInstructions')) {
                    currentWorkout.intensityInstructions = undefined;
                    workoutChanged = true; 
                }
                if (currentWorkout.intensityLevel && currentWorkout.intensityInstructions === undefined) {
                    const levelDetail = INTENSITY_LEVELS.find(l => l.value === currentWorkout.intensityLevel);
                    if (levelDetail && levelDetail.defaultInstructions) {
                        currentWorkout.intensityInstructions = levelDetail.defaultInstructions;
                        workoutChanged = true;
                    }
                }

            } else {
                if (currentWorkout.hasOwnProperty('intensityLevel')) {
                    delete currentWorkout.intensityLevel;
                    workoutChanged = true;
                }
                if (currentWorkout.hasOwnProperty('intensityInstructions')) {
                    delete currentWorkout.intensityInstructions;
                    workoutChanged = true;
                }
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

    // Centralized Club Membership Calculation
    useEffect(() => {
        const newMemberships: ParticipantClubMembership[] = [];
        const existingMembershipsSet = new Set(clubMemberships.map(m => `${m.participantId}-${m.clubId}`));
        
        const optedInParticipants = participantDirectory.filter(p => p.enableLeaderboardParticipation && p.isActive);
        const allLogs = [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];

        optedInParticipants.forEach(p => {
            CLUB_DEFINITIONS.forEach(club => {
                const membershipId = `${p.id}-${club.id}`;
                if (existingMembershipsSet.has(membershipId)) {
                    return;
                }

                let achieved = false;
                let achievedDate = new Date().toISOString();

                if (club.type === 'SESSION_COUNT' && club.threshold) {
                    const participantLogs = allLogs.filter(log => log.participantId === p.id);
                    if (participantLogs.length >= club.threshold) {
                        achieved = true;
                        if(participantLogs.length > 0) {
                            const sortedLogs = participantLogs.sort((a,b) => new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime());
                            if (sortedLogs[club.threshold - 1]) {
                                achievedDate = sortedLogs[club.threshold - 1].completedDate;
                            }
                        }
                    }
                } else if (club.type === 'LIFT' && club.liftType && club.threshold) {
                    const relevantStats = userStrengthStats
                        .filter(s => s.participantId === p.id)
                        .sort((a,b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
                    
                    for (const userStat of relevantStats) {
                        let oneRepMax: number | undefined;
                        switch(club.liftType) {
                            case 'Knäböj': oneRepMax = userStat.squat1RMaxKg; break;
                            case 'Bänkpress': oneRepMax = userStat.benchPress1RMaxKg; break;
                            case 'Marklyft': oneRepMax = userStat.deadlift1RMaxKg; break;
                            case 'Axelpress': oneRepMax = userStat.overheadPress1RMaxKg; break;
                        }
                        if (oneRepMax !== undefined && oneRepMax >= club.threshold) {
                            achieved = true;
                            achievedDate = userStat.lastUpdated;
                            break; 
                        }
                    }
                } else if (club.type === 'BODYWEIGHT_LIFT' && club.liftType && club.multiplier) {
                    const relevantStats = userStrengthStats
                        .filter(s => s.participantId === p.id)
                        .sort((a,b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
                    
                    for (const userStat of relevantStats) {
                        if (userStat.bodyweightKg && userStat.bodyweightKg > 0) {
                            let oneRepMax: number | undefined;
                            switch(club.liftType) {
                                case 'Knäböj': oneRepMax = userStat.squat1RMaxKg; break;
                                case 'Bänkpress': oneRepMax = userStat.benchPress1RMaxKg; break;
                                case 'Marklyft': oneRepMax = userStat.deadlift1RMaxKg; break;
                                case 'Axelpress': oneRepMax = userStat.overheadPress1RMaxKg; break;
                            }
                            if (oneRepMax !== undefined && oneRepMax >= userStat.bodyweightKg * club.multiplier) {
                                achieved = true;
                                achievedDate = userStat.lastUpdated;
                                break; 
                            }
                        }
                    }
                } else if (club.type === 'CONDITIONING' && club.conditioningMetric && club.threshold) {
                    const relevantStats = userConditioningStatsHistory
                        .filter(s => s.participantId === p.id)
                        .sort((a,b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());
                    
                    for (const userStat of relevantStats) {
                        const value = userStat[club.conditioningMetric];
                        if (value !== undefined) {
                            const comparison = club.comparison || 'GREATER_OR_EQUAL';
                            let conditionMet = false;
                            if (comparison === 'GREATER_OR_EQUAL') {
                                conditionMet = value >= club.threshold;
                            } else { // LESS_OR_EQUAL
                                conditionMet = value <= club.threshold;
                            }

                            if (conditionMet) {
                                achieved = true;
                                achievedDate = userStat.lastUpdated;
                                break;
                            }
                        }
                    }
                }


                if (achieved) {
                    newMemberships.push({
                        participantId: p.id,
                        clubId: club.id,
                        achievedDate: achievedDate
                    });
                    existingMembershipsSet.add(membershipId);
                }
            });
        });

        if (newMemberships.length > 0) {
            setClubMemberships(prev => [...prev, ...newMemberships]);
        }
    }, [participantDirectory, userStrengthStats, userConditioningStatsHistory, workoutLogs, generalActivityLogs, goalCompletionLogs, clubMemberships, setClubMemberships]);


  const handleSetRole = (role: UserRole | null) => {
      setCurrentRole(role);
      setCurrentParticipantId(null);
  }

  const handleCloseWelcomeModal = () => {
    setIsWelcomeModalOpen(false);
    setWelcomeModalShown(true);
    setOpenProfileModalOnInit(true);
  };
  
  const handleProfileModalOpened = () => {
      setOpenProfileModalOnInit(false);
  };
  
  const renderContent = () => {
    if (!currentRole) {
      return <RoleSelector onSelectRole={handleSetRole} />;
    }

    if (currentRole === UserRole.COACH) {
      return (
          <CoachArea 
            workouts={workouts} 
            setWorkouts={setWorkouts}
            workoutLogs={workoutLogs} 
            ai={ai}
            participantGoals={participantGoals}
            generalActivityLogs={generalActivityLogs}
            goalCompletionLogs={goalCompletionLogs}
            participantDirectory={participantDirectory}
            setParticipantDirectory={setParticipantDirectory}
            userStrengthStats={userStrengthStats}
            clubMemberships={clubMemberships}
            setClubMemberships={setClubMemberships}
            leaderboardSettings={leaderboardSettings}
            setLeaderboardSettings={setLeaderboardSettings}
            coachEvents={coachEvents}
            setCoachEvents={setCoachEvents}
          />
      );
    }
    
    if (currentRole === UserRole.PARTICIPANT) {
        if (!currentParticipantId) {
            return (
                <ParticipantSelector 
                    participants={participantDirectory}
                    onSelectParticipant={setCurrentParticipantId}
                    onGoBack={() => handleSetRole(null)}
                />
            );
        }
        return (
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
              participantMentalWellbeing={participantMentalWellbeing}
              setParticipantMentalWellbeing={setParticipantMentalWellbeing}
              participantGamificationStats={participantGamificationStats}
              setParticipantGamificationStats={setParticipantGamificationStats}
              clubMemberships={clubMemberships}
              leaderboardSettings={leaderboardSettings}
              coachEvents={coachEvents}
              currentRole={currentRole}
              onSetRole={handleSetRole}
              openProfileModalOnInit={openProfileModalOnInit}
              onProfileModalOpened={handleProfileModalOpened}
            />
        );
    }
    return null;
  }


  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar currentRole={currentRole} onSetRole={handleSetRole} />
       {currentRole === UserRole.PARTICIPANT && isWelcomeModalOpen && (
        <WelcomeModal
          isOpen={isWelcomeModalOpen}
          onClose={handleCloseWelcomeModal}
        />
      )}
      <main className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 flex-grow w-full">
        {renderContent()}
      </main>
      <footer className="text-center py-4 text-lg text-gray-600 bg-gray-100 border-t border-gray-200">
        © {new Date().getFullYear()} Träningslogg
      </footer>
    </div>
  );
};

export default App;