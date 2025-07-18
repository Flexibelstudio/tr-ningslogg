import React from 'react';
import { ParticipantProfile } from '../types';
import { Button } from './Button';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';

interface ParticipantSelectorProps {
  participants: ParticipantProfile[];
  onSelectParticipant: (id: string) => void;
  onGoBack: () => void;
}

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);


export const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({ participants, onSelectParticipant, onGoBack }) => {
  const activeParticipants = participants.filter(p => p.isActive !== false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Välj Medlem
        </h1>
        <p className="text-gray-600 mt-2 text-2xl">Välj vem som ska logga sin träning.</p>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-lg space-y-4">
        <h2 className="text-3xl font-semibold text-gray-800 text-center mb-4">Vem är du?</h2>
        <div className="max-h-80 overflow-y-auto space-y-3 pr-2 -mr-2">
            {activeParticipants.length > 0 ? (
                activeParticipants.map(p => (
                    <button 
                        key={p.id}
                        onClick={() => onSelectParticipant(p.id)}
                        className="w-full flex items-center p-4 rounded-lg bg-gray-50 hover:bg-flexibel/10 border border-gray-200 hover:border-flexibel transition-all duration-150 ease-in-out"
                    >
                        <UserIcon />
                        <span className="text-xl font-medium text-gray-800">{p.name}</span>
                    </button>
                ))
            ) : (
                <p className="text-center text-gray-500 py-4">
                    Inga aktiva medlemmar finns. En coach behöver lägga till medlemmar först.
                </p>
            )}
        </div>
        <div className="pt-6 border-t">
             <Button onClick={onGoBack} variant="outline" fullWidth size="md">
                Tillbaka till Rollval
             </Button>
        </div>
      </div>
       <footer className="mt-12 text-center text-gray-500 text-base">
        Enkel träningsloggning för Flexibel Hälsostudio.
      </footer>
    </div>
  );
};
