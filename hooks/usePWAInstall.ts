import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect if the app is running in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerInstallPrompt = async () => {
    if (!installPromptEvent) return false;

    await installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    
    // The prompt can only be used once. Clear it.
    setInstallPromptEvent(null);

    return outcome === 'accepted';
  };

  return { 
    canInstall: !isStandalone && (!!installPromptEvent || isIOS), 
    triggerInstallPrompt, 
    isIOS,
    isStandalone
  };
};
