import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../../constants';
import { Button } from '../Button';
import { IosInstallInstructionsModal } from './IosInstallInstructionsModal';

export const InstallPwaBanner: React.FC = () => {
  const { canInstall, triggerInstallPrompt, isIOS, isStandalone } = usePWAInstall();
  const [dismissedUntil, setDismissedUntil] = useLocalStorage<number>(LOCAL_STORAGE_KEYS.INSTALL_PROMPT_DISMISSED_UNTIL, 0);
  const [isVisible, setIsVisible] = useState(false);
  const [isIosModalOpen, setIsIosModalOpen] = useState(false);

  useEffect(() => {
    const isDismissed = Date.now() < dismissedUntil;
    
    // The banner should be visible if it can be installed, is not already, and hasn't been recently dismissed.
    if (canInstall && !isStandalone && !isDismissed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [canInstall, isStandalone, dismissedUntil]);

  const handleDismiss = () => {
    // Dismiss for 7 days
    const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;
    setDismissedUntil(Date.now() + sevenDaysInMillis);
    setIsVisible(false);
  };
  
  const handleInstallClick = async () => {
    if (isIOS) {
      setIsIosModalOpen(true);
    } else {
      const accepted = await triggerInstallPrompt();
      if (accepted) {
        setIsVisible(false); // Hide banner after successful install
      }
    }
  };

  if (!isVisible) {
    return null;
  }
  
  const buttonText = isIOS ? "Visa hur" : "Installera";

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 animate-fade-in-down">
        <div className="container mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <img src="/public/icon-192x192.png" alt="App icon" className="w-12 h-12 hidden sm:block"/>
             <div>
                <p className="text-base font-bold text-gray-800">Installera Träningslogg på hemskärmen!</p>
                <p className="text-sm text-gray-600">Få snabbare åtkomst och en bättre upplevelse.</p>
             </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
            <Button variant="ghost" size="md" onClick={handleDismiss} className="w-1/2 sm:w-auto">Inte nu</Button>
            <Button variant="primary" size="md" onClick={handleInstallClick} className="w-1/2 sm:w-auto">{buttonText}</Button>
          </div>
        </div>
      </div>
      
      <IosInstallInstructionsModal 
        isOpen={isIosModalOpen}
        onClose={() => setIsIosModalOpen(false)}
      />
    </>
  );
};
