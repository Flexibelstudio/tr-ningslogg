<<<<<<< HEAD
=======

>>>>>>> origin/staging
import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { FLEXIBEL_PRIMARY_COLOR } from '../../constants';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

<<<<<<< HEAD
=======
interface BentoCardProps {
  icon: string;
  title: string;
  description: React.ReactNode;
  colorClass: string;
  iconBgClass: string;
}

const BentoCard: React.FC<BentoCardProps> = ({ icon, title, description, colorClass, iconBgClass }) => (
  <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col items-start gap-3 shadow-sm h-full ${colorClass}`}>
    <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-2xl shadow-sm ${iconBgClass}`}>
      {icon}
    </div>
    <div>
      <h4 className="font-bold text-gray-900 text-base sm:text-lg mb-1">{title}</h4>
      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

>>>>>>> origin/staging
export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
<<<<<<< HEAD
    <Modal isOpen={isOpen} onClose={onClose} title="Välkommen till SmartStudio!" size="lg">
      <div className="space-y-4 text-lg text-gray-700">
        <p className="font-semibold text-xl" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
          Hej och välkommen till SmartStudio!
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
=======
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
      <div className="space-y-6 pb-2">
        
        {/* Header Section */}
        <div className="text-center space-y-2 px-4 pt-2">
           <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Välkommen till <span style={{ color: FLEXIBEL_PRIMARY_COLOR }}>Träningslogg!</span> 👋
          </h2>
          <p className="text-lg text-gray-600">
            Din digitala träningspartner för att maximera dina resultat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BentoCard
                icon="🎯"
                title="Steg 1: Sätt dina mål"
                description="Klicka på 'Mål' i menyn. Att definiera vad du vill uppnå är nyckeln till att få skräddarsydda 'AI Recept' och personlig feedback."
                colorClass="bg-orange-50 border-orange-100"
                iconBgClass="bg-white text-orange-500"
            />

           <BentoCard 
              icon="✍️"
              title="Logga enkelt"
              colorClass="bg-blue-50 border-blue-100"
              iconBgClass="bg-white text-blue-500"
              description={<>Använd <strong>plus-knappen (+)</strong> för att logga pass. Scanna QR-koden i studion för snabbast möjliga start!</>}
           />
           
           <BentoCard 
              icon="📊"
              title="Din Översikt"
              colorClass="bg-purple-50 border-purple-100"
              iconBgClass="bg-white text-purple-500"
              description={<>Startsidan är din instrumentpanel. Här ser du din <strong>streak</strong>, veckomål och verktyg för att analysera din styrka.</>}
           />
           
           <BentoCard 
              icon="✨"
              title="Flödet & Community"
              colorClass="bg-indigo-50 border-indigo-100"
              iconBgClass="bg-white text-indigo-500"
              description={<>Se dina framsteg i menyn <strong>Flöde</strong>. Lägg till vänner under <strong>Community</strong> för att peppa varandra.</>}
           />
           
           <BentoCard 
              icon="🏆"
              title="Tävla & Jämför"
              colorClass="bg-yellow-50 border-yellow-100"
              iconBgClass="bg-white text-yellow-600"
              description={<>Lås upp prestationsklubbar och se hur du ligger till på <strong>Topplistor</strong> (om du vill!).</>}
           />

           <BentoCard
                icon="🤖"
                title="AI-Coachen"
                colorClass="bg-gray-50 border-gray-200"
                iconBgClass="bg-white text-gray-600"
                description="Vår AI ger tips och motivation. Kom ihåg att våra mänskliga coacher i studion alltid är de verkliga experterna!"
            />
        </div>

        {/* Footer Action */}
        <div className="pt-4 border-t mt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500 text-center sm:text-left">
            Vi rekommenderar att du börjar med att sätta dina mål. Lycka till!
          </p>
          <Button onClick={onClose} variant="primary" size="lg" className="w-full sm:w-auto shadow-lg shadow-flexibel/20">
            Nu kör vi! 🚀
          </Button>
        </div>

>>>>>>> origin/staging
      </div>
    </Modal>
  );
};
