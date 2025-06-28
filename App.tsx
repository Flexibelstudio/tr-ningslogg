
import React, { useState, useEffect } from 'react';
import { UserRole, Workout, WorkoutLog, Exercise, ActivityLog, WorkoutCategory, WorkoutBlock, LiftType, IntensityLevel, ParticipantGamificationStats } from './types'; // Added WorkoutBlock, ParticipantGamificationStats, LiftType, IntensityLevel
import { useLocalStorage } from './hooks/useLocalStorage';
import { Navbar } from './components/Navbar';
import { RoleSelector } from './components/RoleSelector';
import { CoachArea } from './components/coach/CoachArea';
import { ParticipantArea } from './components/participant/ParticipantArea';
import { LOCAL_STORAGE_KEYS, INTENSITY_LEVELS } from './constants'; // Imported INTENSITY_LEVELS
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; 

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
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>(
    LOCAL_STORAGE_KEYS.WORKOUTS,
    predefinedWorkouts 
  );
  const [workoutLogs, setWorkoutLogs] = useLocalStorage<WorkoutLog[]>(
    LOCAL_STORAGE_KEYS.WORKOUT_LOGS, 
    [] 
  );
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeModalShown, setWelcomeModalShown] = useLocalStorage<boolean>(
    LOCAL_STORAGE_KEYS.WELCOME_MESSAGE_SHOWN_PARTICIPANT,
    false
  );


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
            // This part ensures that if they exist, they are preserved, if not, they remain undefined.
            // No explicit change to `workoutChanged` here as we are not adding new default values if missing during migration.
            // The coach modal will handle adding them if the category is PT-bas and they are missing.
            if (currentWorkout.category === 'PT-bas') {
                if (!currentWorkout.hasOwnProperty('intensityLevel')) { // If property doesn't exist at all
                    currentWorkout.intensityLevel = undefined; // Initialize it
                    workoutChanged = true; // Mark change if we add the property
                }
                if (!currentWorkout.hasOwnProperty('intensityInstructions')) {
                    currentWorkout.intensityInstructions = undefined;
                    workoutChanged = true; 
                }
                 // If level is set but instructions are missing (and there's a default for that level)
                if (currentWorkout.intensityLevel && currentWorkout.intensityInstructions === undefined) {
                    const levelDetail = INTENSITY_LEVELS.find(l => l.value === currentWorkout.intensityLevel);
                    if (levelDetail && levelDetail.defaultInstructions) {
                        currentWorkout.intensityInstructions = levelDetail.defaultInstructions;
                        workoutChanged = true;
                    }
                }

            } else {
                // If not PT-bas, ensure these fields are not present
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
            // Check if the source of truth (localStorage) actually had items.
            // If it was empty or null, setWorkouts would fill it with predefined,
            // which is fine, but we only want to call setWorkouts here if we are
            // truly migrating existing persisted data.
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


  // Migrate existing workout logs to include the 'type' field if they don't have it.
  useEffect(() => {
    const logsFromStorage = window.localStorage.getItem(LOCAL_STORAGE_KEYS.WORKOUT_LOGS);
    if (logsFromStorage) {
      try {
        const parsedLogs = JSON.parse(logsFromStorage) as any[]; 
        if (Array.isArray(parsedLogs)) {
          const needsMigration = parsedLogs.some(log => !log.type && log.workoutId);
          if (needsMigration) {
            const migratedLogs: WorkoutLog[] = parsedLogs.map(log => {
              if (!log.type && log.workoutId) { 
                return { ...log, type: 'workout' };
              }
              return log;
            }).filter(log => log.type); 
            
            setWorkoutLogs(migratedLogs as WorkoutLog[]);
          }
        }
      } catch (e) {
        console.error("Error migrating workout logs:", e);
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
    if (currentRole === UserRole.PARTICIPANT && !welcomeModalShown) {
      setIsWelcomeModalOpen(true);
    }
  }, [currentRole, welcomeModalShown]);

  const handleCloseWelcomeModal = () => {
    setIsWelcomeModalOpen(false);
    setWelcomeModalShown(true);
  };

  if (!currentRole) {
    return <RoleSelector onSelectRole={setCurrentRole} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar currentRole={currentRole} onSetRole={setCurrentRole} />
       {currentRole === UserRole.PARTICIPANT && isWelcomeModalOpen && (
        <WelcomeModal
          isOpen={isWelcomeModalOpen}
          onClose={handleCloseWelcomeModal}
        />
      )}
      <main className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 flex-grow w-full">
        {currentRole === UserRole.COACH && (
          <CoachArea 
            workouts={workouts} 
            setWorkouts={setWorkouts}
            workoutLogs={workoutLogs} 
            ai={ai} 
          />
        )}
        {currentRole === UserRole.PARTICIPANT && (
          <ParticipantArea 
            workouts={workouts} 
            workoutLogs={workoutLogs} 
            setWorkoutLogs={setWorkoutLogs}
            currentRole={currentRole}
            onSetRole={setCurrentRole}
          />
        )}
      </main>
      <footer className="text-center py-4 text-lg text-gray-600 bg-gray-100 border-t border-gray-200">
        © {new Date().getFullYear()} Träningslogg
      </footer>
    </div>
  );
};

export default App;