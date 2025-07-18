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
    <Modal isOpen={isOpen} onClose={onClose} title="Välkommen till Träningslogg!" size="lg">
      <div className="space-y-4 text-base text-gray-700">
        <p className="font-semibold text-lg" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Hej och välkommen till Träningslogg!
        </p>
        <p>
          Din digitala följeslagare för att maximera din träning på Flexibel Hälsostudio.
        </p>
        <p className="font-semibold pt-2">
          Här är en snabbguide för att komma igång:
        </p>
        <ul className="space-y-3">
          <li>
            <strong className="text-lg flex items-center gap-2">Sätt dina mål <span role="img" aria-label="måltavla">🎯</span></strong>
            <p className="pl-1 mt-0.5">
              Klicka på "Profil & Mål" i menyn högst upp. Att fylla i din profil och dina mål hjälper oss och vår AI-coach att ge dig de bästa råden och rekommendationerna.
            </p>
          </li>
          <li>
            <strong className="text-lg flex items-center gap-2">Logga allt! <span role="img" aria-label="penna som skriver">✍️</span></strong>
            <p className="pl-1 mt-0.5">
              Använd plus-knappen (+) nere till höger för att snabbt logga ett gympass eller annan aktivitet. Regelbunden loggning är nyckeln till framsteg.
            </p>
          </li>
          <li>
            <strong className="text-lg flex items-center gap-2">Utforska dina verktyg <span role="img" aria-label="verktygslåda">🛠️</span></strong>
            <p className="pl-1 mt-0.5">
              Under "Styrka" och "Kondition" kan du analysera din styrka och logga dina konditionstest. Du kan även checka in ditt mentala mående efter varje pass för en komplett bild av din hälsa!
            </p>
          </li>
          <li>
            <strong className="text-lg flex items-center gap-2">Följ dina prestationer <span role="img" aria-label="pokal">🏆</span></strong>
            <p className="pl-1 mt-0.5">
              På hemskärmen hittar du kortet "Mina Prestationer" där du kan se en sammanfattning av dina framsteg, som totalt antal pass, avklarade mål och din längsta tränings-streak!
            </p>
          </li>
          <li>
            <strong className="text-lg flex items-center gap-2">Tävla & Jämför <span role="img" aria-label="medalj">🏅</span></strong>
            <p className="pl-1 mt-0.5">
                Delta i veckans utmaningar och se hur du placerar dig på våra topplistor! Du hittar dem under "Mina Prestationer" på hemskärmen. Kom ihåg att aktivera deltagande under "Profil & Mål".
            </p>
          </li>
          <li>
            <strong className="text-lg flex items-center gap-2">Få smarta insikter <span role="img" aria-label="robotansikte">🤖</span></strong>
            <p className="pl-1 mt-0.5">
              Vår AI-assistent ger dig personliga tips inför pass, feedback på din utveckling, och hjälper dig att hålla motivationen uppe.
            </p>
          </li>
        </ul>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800">
            <h4 className="font-bold flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.242-1.21 2.878 0l5.25 10.001c.636 1.21-.29 2.7-1.638 2.7H5.251c-1.348 0-2.274-1.49-1.638-2.7l5.25-10.001zM10 12a1 1 0 110-2 1 1 0 010 2zm-1-3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>Viktigt om AI-Coachen</h4>
            <p className="mt-1 text-sm">
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
