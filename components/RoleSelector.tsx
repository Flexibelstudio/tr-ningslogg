

import React from 'react';
import { UserRole } from '../types';
import { Button } from './Button';
import { APP_NAME, FLEXIBEL_PRIMARY_COLOR } from '../constants';

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Välkommen till {APP_NAME}!
        </h1>
        <p className="text-gray-600 mt-2 text-xl">Välj din roll för att fortsätta.</p>
      </div>
      <div className="bg-white p-10 rounded-xl shadow-xl w-full max-w-md space-y-6">
        <h2 className="text-3xl font-semibold text-gray-800 text-center">Jag är...</h2>
        <Button onClick={() => onSelectRole(UserRole.COACH)} fullWidth size="lg">
          Coach
        </Button>
        <Button onClick={() => onSelectRole(UserRole.PARTICIPANT)} fullWidth size="lg" variant="secondary">
          Medlem
        </Button>
      </div>
       <footer className="mt-12 text-center text-gray-500 text-base">
        Enkel träningsloggning för Flexibel Hälsostudio.
      </footer>
    </div>
  );
};