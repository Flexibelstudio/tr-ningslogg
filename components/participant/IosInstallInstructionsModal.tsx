import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

// SVG icons for instructions
const ShareIcon = () => (
  <svg className="w-8 h-8 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const AddToHomeScreenIcon = () => (
  <svg className="w-8 h-8 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

interface IosInstallInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IosInstallInstructionsModal: React.FC<IosInstallInstructionsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Installera på iPhone/iPad">
      <div className="space-y-6 text-center text-gray-700">
        <p className="text-lg">Följ dessa tre enkla steg för att lägga till appen på din hemskärm:</p>
        
        <div className="space-y-4 text-left">
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-16 text-center">
                    <p className="text-3xl font-bold text-flexibel">1.</p>
                    <ShareIcon />
                </div>
                <p className="text-base">Tryck på <strong>Dela-knappen</strong> i menyraden i Safari.</p>
            </div>
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-16 text-center">
                    <p className="text-3xl font-bold text-flexibel">2.</p>
                    <AddToHomeScreenIcon />
                </div>
                <p className="text-base">Skrolla ner i listan och välj <strong>"Lägg till på hemskärmen"</strong>.</p>
            </div>
             <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-16 text-center">
                    <p className="text-3xl font-bold text-flexibel">3.</p>
                </div>
                <p className="text-base">Klart! Nu hittar du appen direkt på din hemskärm, precis som en vanlig app.</p>
            </div>
        </div>

        <div className="pt-4 border-t">
          <Button onClick={onClose} variant="primary" fullWidth size="lg">
            Jag förstår!
          </Button>
        </div>
      </div>
    </Modal>
  );
};
