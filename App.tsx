

import React, { useState, useEffect } from 'react';
import { UserRole, Workout, WorkoutLog, Exercise, ActivityLog, WorkoutCategory } from './types'; // Added ActivityLog, WorkoutCategory
import { useLocalStorage } from './hooks/useLocalStorage';
import { Navbar } from './components/Navbar';
import { RoleSelector } from './components/RoleSelector';
import { CoachArea } from './components/coach/CoachArea';
import { ParticipantArea } from './components/participant/ParticipantArea';
import { LOCAL_STORAGE_KEYS } from './constants';
import { GoogleGenAI } from '@google/genai';
import { WelcomeModal } from './components/participant/WelcomeModal'; // New import

const API_KEY = process.env.API_KEY;

// getDefaultWorkouts is no longer used.

const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useLocalStorage<UserRole | null>(LOCAL_STORAGE_KEYS.USER_ROLE, null);
  const [workouts, setWorkouts] = useLocalStorage<Workout[]>(
    LOCAL_STORAGE_KEYS.WORKOUTS,
    [] // Initialize with an empty array, no default workout
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


  // Migrate existing workouts to include the 'category' field if they don't have it.
  useEffect(() => {
    const workoutsFromStorage = window.localStorage.getItem(LOCAL_STORAGE_KEYS.WORKOUTS);
    if (workoutsFromStorage) {
      try {
        const parsedWorkouts = JSON.parse(workoutsFromStorage) as any[];
        if (Array.isArray(parsedWorkouts)) {
          const needsMigration = parsedWorkouts.some(w => w.id && w.title && !w.category);
          if (needsMigration) {
            const migratedWorkouts: Workout[] = parsedWorkouts.map(w => {
              if (w.id && w.title && !w.category) {
                return { ...w, category: 'Annat' as WorkoutCategory }; // Default to 'Annat' for old workouts
              }
              return w;
            });
            setWorkouts(migratedWorkouts as Workout[]);
          }
        }
      } catch (e) {
        console.error("Error migrating workouts for category:", e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to check and migrate workouts for category field


  // Migrate existing workout logs to include the 'type' field if they don't have it.
  useEffect(() => {
    const logsFromStorage = window.localStorage.getItem(LOCAL_STORAGE_KEYS.WORKOUT_LOGS);
    if (logsFromStorage) {
      try {
        const parsedLogs = JSON.parse(logsFromStorage) as any[]; // Parse as any[] for migration
        if (Array.isArray(parsedLogs)) {
          const needsMigration = parsedLogs.some(log => !log.type && log.workoutId);
          if (needsMigration) {
            const migratedLogs: WorkoutLog[] = parsedLogs.map(log => {
              if (!log.type && log.workoutId) { // Check if it looks like an old WorkoutLog
                return { ...log, type: 'workout' };
              }
              return log;
            }).filter(log => log.type); // Ensure only logs with a type are kept if mixed data existed
            
            setWorkoutLogs(migratedLogs as WorkoutLog[]);
          }
        }
      } catch (e) {
        console.error("Error migrating workout logs:", e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to check and migrate logs


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
      <main className="container mx-auto px-2 py-4 sm:py-6 lg:py-8 flex-grow w-full">
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
        © {new Date().getFullYear()} Flexibel Hälsostudio Träningslogg
      </footer>
    </div>
  );
};

export default App;
