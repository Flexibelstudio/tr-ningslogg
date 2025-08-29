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
    <Modal isOpen={isOpen} onClose={onClose} title="Välkommen till Träningsloggen!" size="lg">
      <div className="space-y-4 text-lg text-gray-700">
        <p className="font-semibold text-xl" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Hej och välkommen till Träningsloggen!
        </p>
        <p>
          Din digitala följeslagare för att maximera din träning på Flexibel Hälsostudio.
        </p>
        <p className="font-semibold pt-2">
          Här är en snabbguide för att komma igång:
        </p>
        <ul className="space-y-4">
          <li>
            <strong className="text-xl flex items-center gap-2">1. Sätt dina mål <span role="img" aria-label="måltavla">🎯</span></strong>
            <p className="pl-1 mt-0.5 text-base">
              Börja med att klicka på <strong>Profil</strong> i menyn högst upp. Att fylla i din profil och dina mål är nyckeln till personlig feedback och ett skräddarsytt 'AI Recept' för din träningsresa.
            </p>
          </li>
          <li>
            <strong className="text-xl flex items-center gap-2">2. Logga allt! <span role="img" aria-label="penna som skriver">✍️</span></strong>
            <p className="pl-1 mt-0.5 text-base">
              Använd plus-knappen (+) nere till höger för att logga ett gympass eller annan aktivitet. Du kan även <strong>scanna QR-koden</strong> på skärmen i studion för att logga dagens pass direkt!
            </p>
          </li>
          <li>
            <strong className="text-xl flex items-center gap-2">3. Utforska din hemskärm <span role="img" aria-label="instrumentpanel">📊</span></strong>
            <p className="pl-1 mt-0.5 text-base">
              Din hemskärm är din personliga instrumentpanel. Här ser du direkt ditt <strong>veckomål</strong>, din <strong>streak</strong>, och nyckelvärden som FSS (styrkepoäng) och InBody-score. Använd verktygskorten för att dyka djupare in i din styrka, kondition och kroppssammansättning.
            </p>
          </li>
           <li>
            <strong className="text-xl flex items-center gap-2">4. Håll dig uppdaterad i Flödet <span role="img" aria-label="stjärnor">✨</span></strong>
            <p className="pl-1 mt-0.5 text-base">
              I <strong>Flödet</strong> (uppe i menyn) ser du alla dina prestationer, nya rekord och händelser från coacherna. Under <strong>Community</strong> kan du lägga till vänner och se deras framsteg i ditt flöde – träna är roligare tillsammans!
            </p>
          </li>
          <li>
            <strong className="text-xl flex items-center gap-2">5. Tävla & Jämför <span role="img" aria-label="pokal">🏆</span></strong>
            <p className="pl-1 mt-0.5 text-base">
                Delta i veckans utmaningar och se hur du placerar dig på våra <strong>Topplistor</strong>. Du hittar dem under 'Loggbok & Prestationer' på hemskärmen. Kom ihåg att aktivera deltagande i din profil!
            </p>
          </li>
        </ul>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800">
            <h4 className="font-bold text-lg flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.242-1.21 2.878 0l5.25 10.001c.636 1.21-.29 2.7-1.638 2.7H5.251c-1.348 0-2.274-1.49-1.638-2.7l5.25-10.001zM10 12a1 1 0 110-2 1 1 0 010 2zm-1-3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>Viktigt om AI-Coachen</h4>
            <p className="mt-1 text-base">
                Tänk på att vår AI-coach, "Flexibot", är ett verktyg för att ge tips och motivation. Den kan ibland ha fel. Våra mänskliga coacher i studion är de verkliga experterna och AI:n är deras förlängda arm. Fråga alltid en coach på plats om du är osäker!
            </p>
        </div>

        <p className="pt-2">
          Vi rekommenderar att du börjar med att sätta dina mål. Lycka till!
        </p>
        <p className="mt-4">
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