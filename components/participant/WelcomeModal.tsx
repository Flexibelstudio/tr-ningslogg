
import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { FLEXIBEL_PRIMARY_COLOR } from '../../constants';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
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

      </div>
    </Modal>
  );
};
