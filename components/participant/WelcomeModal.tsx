
import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { FLEXIBEL_PRIMARY_COLOR } from '../../constants';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Välkommen till Flexibel Träningslogg!" size="lg">
      <div className="space-y-4 text-base text-gray-700">
        <p className="font-semibold text-lg" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>Hej Medlem!</p>
        <p>
          Välkommen till Flexibel Träningslogg – din digitala följeslagare för att maximera din träning hos oss på Flexibel Hälsostudio!
        </p>
        <p>Med den här appen kan du:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong>Logga dina träningspass:</strong> Enkelt registrera allt från dina PT-pass till egen träning och andra aktiviteter.
          </li>
          <li>
            <strong>Följa din utveckling:</strong> Se dina tidigare resultat och anteckningar för att effektivt kunna planera din progression.
          </li>
          <li>
            <strong>Anpassa din profil & sätta mål:</strong> Fyll i din profil och dina mål. Detta hjälper dig (och vår AI) att anpassa din upplevelse. Du hittar detta under "Profil & Mål" i verktygsmenyn högst upp.
          </li>
          <li>
            <strong>Använda smarta verktyg:</strong> Jämför din styrka, logga konditionstester och få en tydligare bild av dina framsteg.
          </li>
          <li>
            <strong>Få AI-driven feedback:</strong> Vår AI-assistent kan ge dig personliga insikter och pepp baserat på din loggade aktivitet!
          </li>
        </ul>
        <p>
          Vi rekommenderar att du börjar med att kika in under "Profil & Mål" för att få ut det mesta av appen.
        </p>
        <p>Lycka till med din träning! Vi hejar på dig.</p>
        <p className="mt-6">
          Med vänliga hälsningar,
          <br />
          <span className="font-semibold">Teamet på Flexibel</span>
        </p>

        <div className="flex justify-end pt-4 border-t mt-6">
          <Button onClick={onClose} variant="primary">
            Jag förstår
          </Button>
        </div>
      </div>
    </Modal>
  );
};
