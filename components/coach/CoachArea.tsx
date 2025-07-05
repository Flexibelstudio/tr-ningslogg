import React, { useState } from 'react';
import { Workout, WorkoutLog, ParticipantProfile, ParticipantGoalData, GeneralActivityLog, GoalCompletionLog } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { MemberManagement } from './MemberManagement';
import { ParticipantActivityOverview } from './ParticipantActivityOverview'; 
import { WorkoutManagement } from './WorkoutManagement';
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_KEYS } from '../../constants';

type CoachTab = 'overview' | 'programs';

interface CoachAreaProps {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
  workoutLogs: WorkoutLog[];
  participantGoals: ParticipantGoalData[];
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  ai: GoogleGenAI | null;
}

export const CoachArea: React.FC<CoachAreaProps> = ({ 
  workouts, 
  setWorkouts, 
  workoutLogs,
  participantGoals,
  generalActivityLogs,
  goalCompletionLogs,
  ai 
}) => {
  const [activeTab, setActiveTab] = useState<CoachTab>('overview');
  const [participantDirectory, setParticipantDirectory] = useLocalStorage<ParticipantProfile[]>(LOCAL_STORAGE_KEYS.PARTICIPANT_DIRECTORY, []);
  
  const allActivityLogs = [...workoutLogs, ...generalActivityLogs, ...goalCompletionLogs];

  const getTabButtonStyle = (tabName: CoachTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };

  return (
    <div className="space-y-8">
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('overview')}`}
                    aria-current={activeTab === 'overview' ? 'page' : undefined}
                >
                    Översikt & Statistik
                </button>
                <button
                    onClick={() => setActiveTab('programs')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('programs')}`}
                    aria-current={activeTab === 'programs' ? 'page' : undefined}
                >
                    Program & Pass
                </button>
            </nav>
        </div>

        <div role="tabpanel" hidden={activeTab !== 'overview'}>
            {activeTab === 'overview' && (
                <>
                    <MemberManagement 
                        participants={participantDirectory}
                        setParticipants={setParticipantDirectory}
                        allParticipantGoals={participantGoals}
                        allActivityLogs={allActivityLogs}
                        ai={ai}
                    />
                    <ParticipantActivityOverview 
                        workoutLogs={workoutLogs} 
                        workouts={workouts} 
                        ai={ai} 
                    />
                </>
            )}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 'programs'}>
            {activeTab === 'programs' && (
                <WorkoutManagement 
                    workouts={workouts}
                    setWorkouts={setWorkouts}
                    ai={ai}
                />
            )}
        </div>
    </div>
  );
};
