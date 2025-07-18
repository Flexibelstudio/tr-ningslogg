import React, { useState } from 'react';
import { Workout, WorkoutLog, ParticipantProfile, ParticipantGoalData, GeneralActivityLog, GoalCompletionLog, CoachNote, UserStrengthStat, ParticipantClubMembership, LeaderboardSettings, CoachEvent } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { MemberManagement } from './MemberManagement';
import { ParticipantActivityOverview } from './ParticipantActivityOverview'; 
import { WorkoutManagement } from './WorkoutManagement';
import { GoogleGenAI } from '@google/genai';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { LeaderboardManagement } from './LeaderboardManagement';
import { EventManagement } from './EventManagement';

type CoachTab = 'overview' | 'programs' | 'leaderboards' | 'events';

interface CoachAreaProps {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[] | ((prevWorkouts: Workout[]) => Workout[])) => void;
  workoutLogs: WorkoutLog[];
  participantGoals: ParticipantGoalData[];
  generalActivityLogs: GeneralActivityLog[];
  goalCompletionLogs: GoalCompletionLog[];
  ai: GoogleGenAI | null;
  participantDirectory: ParticipantProfile[];
  setParticipantDirectory: (updater: ParticipantProfile[] | ((prev: ParticipantProfile[]) => ParticipantProfile[])) => void;
  userStrengthStats: UserStrengthStat[];
  clubMemberships: ParticipantClubMembership[];
  setClubMemberships: (updater: ParticipantClubMembership[] | ((prev: ParticipantClubMembership[]) => ParticipantClubMembership[])) => void;
  leaderboardSettings: LeaderboardSettings;
  setLeaderboardSettings: (settings: LeaderboardSettings | ((prev: LeaderboardSettings) => LeaderboardSettings)) => void;
  coachEvents: CoachEvent[];
  setCoachEvents: (events: CoachEvent[] | ((prev: CoachEvent[]) => CoachEvent[])) => void;
}

export const CoachArea: React.FC<CoachAreaProps> = ({ 
  workouts, 
  setWorkouts, 
  workoutLogs,
  participantGoals,
  generalActivityLogs,
  goalCompletionLogs,
  ai,
  participantDirectory,
  setParticipantDirectory,
  userStrengthStats,
  clubMemberships,
  setClubMemberships,
  leaderboardSettings,
  setLeaderboardSettings,
  coachEvents,
  setCoachEvents,
}) => {
  const [activeTab, setActiveTab] = useState<CoachTab>('overview');
  const [coachNotes, setCoachNotes] = useLocalStorage<CoachNote[]>(LOCAL_STORAGE_KEYS.COACH_MEMBER_NOTES, []);
  
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
                <button
                    onClick={() => setActiveTab('leaderboards')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('leaderboards')}`}
                    aria-current={activeTab === 'leaderboards' ? 'page' : undefined}
                >
                    Topplistor
                </button>
                 <button
                    onClick={() => setActiveTab('events')}
                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${getTabButtonStyle('events')}`}
                    aria-current={activeTab === 'events' ? 'page' : undefined}
                >
                    Händelser
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
                        coachNotes={coachNotes}
                        setCoachNotes={setCoachNotes}
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

        <div role="tabpanel" hidden={activeTab !== 'leaderboards'}>
            {activeTab === 'leaderboards' && (
                <LeaderboardManagement
                  participants={participantDirectory}
                  allActivityLogs={allActivityLogs}
                  workoutLogs={workoutLogs}
                  userStrengthStats={userStrengthStats}
                  clubMemberships={clubMemberships}
                  setClubMemberships={setClubMemberships}
                  leaderboardSettings={leaderboardSettings}
                  setLeaderboardSettings={setLeaderboardSettings}
                />
            )}
        </div>

         <div role="tabpanel" hidden={activeTab !== 'events'}>
            {activeTab === 'events' && (
                <EventManagement
                    events={coachEvents}
                    setEvents={setCoachEvents}
                />
            )}
        </div>
    </div>
  );
};