import React from 'react';
import { StaffMember } from '../types';
import { Button } from './Button';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';

interface StaffSelectorProps {
  staff: StaffMember[];
  onSelectStaff: (id: string) => void;
  onGoBack: () => void;
}

const StaffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
    </svg>
);


export const StaffSelector: React.FC<StaffSelectorProps> = ({ staff, onSelectStaff, onGoBack }) => {
  const activeStaff = staff.filter(s => s.isActive);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Välj Personal
        </h1>
        <p className="text-gray-600 mt-2 text-2xl">Välj vem som loggar in.</p>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-lg space-y-4">
        <h2 className="text-3xl font-semibold text-gray-800 text-center mb-4">Vem är du?</h2>
        <div className="max-h-80 overflow-y-auto space-y-3 pr-2 -mr-2">
            {activeStaff.length > 0 ? (
                activeStaff.map(s => (
                    <button 
                        key={s.id}
                        onClick={() => onSelectStaff(s.id)}
                        className="w-full flex items-center p-4 rounded-lg bg-gray-50 hover:bg-flexibel/10 border border-gray-200 hover:border-flexibel transition-all duration-150 ease-in-out"
                    >
                        <StaffIcon />
                        <span className="text-xl font-medium text-gray-800">{s.name} <span className="text-base text-gray-500">({s.role})</span></span>
                    </button>
                ))
            ) : (
                <p className="text-center text-gray-500 py-4">
                    Ingen personal finns registrerad. En admin behöver lägga till personal först.
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
        {APP_NAME} för coacher och administratörer.
      </footer>
    </div>
  );
};