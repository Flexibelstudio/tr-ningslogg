import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
import { APP_NAME } from '../constants';
import dataService from '../services/dataService';
import { User } from '../types';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      // AuthProvider will handle the redirect/UI change
    } catch (err: any) {
      console.error(err);
      if (err.message === 'OFFLINE_LOGIN_ATTEMPT') {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold tracking-tight text-gray-800 animate-fade-in-down">
          Välkommen till <span style={{ color: '#3bab5a' }}>{APP_NAME}</span>
        </h1>
        <p className="text-gray-600 mt-4 text-2xl animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          Din digitala träningspartner.
        </p>
      </div>
      <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-4 animate-fade-in-down" style={{ animationDelay: '0.4s' }}>
        <h2 className="text-4xl font-semibold text-gray-800 text-center mb-6">Logga in</h2>
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
          <Button type="submit" fullWidth size="lg" disabled={isLoading}>
            {isLoading ? 'Loggar in...' : 'Logga in'}
          </Button>
        </form>
      </div>
       <footer className="mt-12 text-center text-gray-500 text-base animate-fade-in" style={{ animationDelay: '0.6s' }}>
        Powered by Flexibel Hälsostudio.
      </footer>
    </div>
  );
};