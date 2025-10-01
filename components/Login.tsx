import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
import { APP_NAME } from '../constants';
import dataService from '../services/dataService';
import { User } from '../types';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import { Modal } from './Modal';
import { auth } from '../firebaseConfig';

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

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      // AuthProvider will handle the redirect/UI change
    } catch (err: any) {
      console.error(err);
      if (err.message === 'AUTH_APPROVAL_PENDING') {
        setError('Ditt konto väntar på godkännande av en coach. Du kan inte logga in än.');
      } else {
        // Map Firebase error codes to user-friendly messages
        setError('Fel e-post eller lösenord. Försök igen.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setIsSendingReset(true);
    setResetMessage(null);

    try {
        if (auth) {
            await auth.sendPasswordResetEmail(resetEmail);
            setResetMessage({ type: 'success', text: 'En återställningslänk har skickats till din e-postadress. Kontrollera din inkorg (och skräppostmappen).' });
        } else {
            throw new Error("Firebase Auth is not initialized.");
        }
    } catch (error: any) {
        console.error("Password reset error:", error);
        if (error.code === 'auth/user-not-found') {
            setResetMessage({ type: 'error', text: 'Ingen användare hittades med den e-postadressen.' });
        } else {
            setResetMessage({ type: 'error', text: 'Ett fel uppstod. Försök igen senare.' });
        }
    } finally {
        setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dotted-pattern bg-dotted-size bg-gray-100">
      <main className="flex-grow flex items-start sm:items-center justify-center py-12 px-4 overflow-y-auto">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-6 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <div className="text-center">
            <img src="/icon-180x180.png" alt="Logotyp" className="mx-auto h-20 w-auto mb-4" />
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
              {isLoading ? 'Loggar in...' : (isOnline ? 'Logga in' : 'Logga in (Offline)')}
            </Button>
          </form>
          <div className="text-center mt-4 space-y-2">
              <button onClick={(e) => { e.preventDefault(); setIsResetModalOpen(true); setResetMessage(null); setResetEmail(''); }} className="text-sm text-flexibel hover:underline">
                Glömt lösenord?
              </button>
              <p>
                  <button onClick={onSwitchToRegister} className="text-flexibel hover:underline font-semibold">
                      Inget konto? Skapa ett här
                  </button>
              </p>
          </div>
        </div>
      </main>
      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Återställ lösenord">
        {resetMessage ? (
            <div className="space-y-4 text-center">
            <p className={`text-lg ${resetMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{resetMessage.text}</p>
            <Button onClick={() => setIsResetModalOpen(false)}>Stäng</Button>
            </div>
        ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
            <p>Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.</p>
            <Input
                label="E-post"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
            />
            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)} disabled={isSendingReset}>Avbryt</Button>
                <Button type="submit" disabled={isSendingReset || !resetEmail.trim()}>
                {isSendingReset ? 'Skickar...' : 'Skicka återställningslänk'}
                </Button>
            </div>
            </form>
        )}
      </Modal>
    </div>
  );
};
