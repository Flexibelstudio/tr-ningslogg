
import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';

interface CalendarSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarUrl: string;
  title?: string;
}

export const CalendarSubscriptionModal: React.FC<CalendarSubscriptionModalProps> = ({ isOpen, onClose, calendarUrl, title = "Prenumerera på kalender" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-blue-800 text-sm">
          <p className="font-semibold mb-1">Vad är detta?</p>
          <p>
            Detta är en prenumerationslänk (iCal). Genom att lägga till den i din kalender (Google, Outlook, iPhone) dyker dina pass upp automatiskt och uppdateras om något ändras.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Din personliga kalenderlänk</label>
          <div className="flex gap-2">
            <Input 
              value={calendarUrl} 
              readOnly 
              className="bg-gray-50 text-gray-600 text-sm font-mono" 
              onClick={(e) => e.currentTarget.select()}
            />
            <Button onClick={handleCopy} variant={copied ? 'primary' : 'outline'}>
              {copied ? 'Kopierad!' : 'Kopiera'}
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <p className="font-semibold text-gray-700">Så här gör du:</p>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li><strong>iPhone:</strong> Inställningar &gt; Kalender &gt; Konton &gt; Lägg till konto &gt; Annat &gt; Lägg till prenumererad kalender. Klistra in länken.</li>
            <li><strong>Google Calendar:</strong> Öppna på datorn &gt; Klicka på '+' vid "Andra kalendrar" &gt; "Från webbadress". Klistra in länken.</li>
            <li><strong>Outlook:</strong> Lägg till kalender &gt; Prenumerera från webben.</li>
          </ul>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} variant="secondary">Stäng</Button>
        </div>
      </div>
    </Modal>
  );
};
