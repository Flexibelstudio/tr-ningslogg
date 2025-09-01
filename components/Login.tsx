import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
import { APP_NAME } from '../constants';
import dataService from '../services/dataService';
import { User } from '../types';
import { useNetworkStatus } from '../context/NetworkStatusContext';

interface LoginProps {
    onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      // AuthProvider will handle the redirect/UI change
    } catch (err: any) {
      console.error(err);
      if (err.message === 'AUTH_APPROVAL_PENDING') {
        setError('Ditt konto väntar på godkännande av en coach. Du kan inte logga in än.');
      } else if (err.message === 'OFFLINE_LOGIN_ATTEMPT') {
          setError('Inloggning misslyckades. Appen körs i offlineläge eftersom den inte kan ansluta till Firebase. Kontrollera att Firebase-variablerna är korrekt konfigurerade i driftsättningsmiljön.');
      } else {
        // Map Firebase error codes to user-friendly messages
        setError('Fel e-post eller lösenord. Försök igen.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-rows-[1fr_auto] bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
      <main className="flex items-center justify-center overflow-y-auto pt-8 pb-16">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-4 my-auto animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <div className="text-center mb-8 space-y-4">
              <img src="/icon-180x180.png" alt="Logotyp" className="h-20 w-20 mx-auto" />
              <h1 className="text-3xl font-bold text-gray-800">Välkommen tillbaka</h1>
          </div>
          {error && <p className="text-center bg-red-100 text-red-700 p-3 rounded-lg">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="E-post"
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Lösenord"
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" fullWidth size="lg" disabled={isLoading || !isOnline}>
              {isLoading ? 'Loggar in...' : (isOnline ? 'Logga in' : 'Offline')}
            </Button>
          </form>
          <div className="text-center mt-4 space-y-2">
              <a href="#" className="text-flexibel hover:underline">Glömt lösenord?</a>
              <p>
                  <button onClick={onSwitchToRegister} className="text-flexibel hover:underline font-semibold">
                      Inget konto? Skapa ett här
                  </button>
              </p>
          </div>
        </div>
      </main>
       <footer className="py-6 text-center text-gray-500 text-base animate-fade-in" style={{ animationDelay: '0.3s' }}>
        Powered by Flexibel Hälsostudio.
      </footer>
    </div>
  );
};