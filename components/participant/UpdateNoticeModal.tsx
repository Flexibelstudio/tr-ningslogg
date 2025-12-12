
import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface UpdateNoticeModalProps {
  show: boolean;
  onClose: () => void;
}

const FeatureItem = ({ icon, title, description, colorClass, iconBgClass }: { icon: string, title: string, description: string, colorClass: string, iconBgClass: string }) => (
  <div className={`p-4 rounded-xl border flex items-start gap-4 transition-all duration-300 hover:shadow-sm ${colorClass}`}>
    <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-2xl shadow-sm ${iconBgClass}`}>
      {icon}
    </div>
    <div>
      <h4 className="font-bold text-gray-900 text-base mb-1">{title}</h4>
      <p className="text-sm text-gray-700 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

export const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ show, onClose }) => {
  return (
    <Modal isOpen={show} onClose={onClose} title="Nyhet: Verifierade Resultat! 🛡️" size="lg">
      <div className="space-y-6 pb-2">
        
        {/* Header */}
        <div className="text-center px-2 pt-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3 leading-tight">
                Nu granskar vi dina PB! 🌟
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Vi har uppdaterat hur personbästa (PB) hanteras för att säkerställa kvalitet och rättvisa på topplistorna.
            </p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-3">
            <FeatureItem
                icon="⏳"
                title="Status: Väntar"
                description="När du loggar ett nytt PB i ett baslyft (Knäböj, Bänkpress, Marklyft, Axelpress) markeras det först som preliminärt (gult)."
                colorClass="bg-yellow-50 border-yellow-100"
                iconBgClass="bg-white"
            />

            <FeatureItem
                icon="✅"
                title="Status: Verifierad"
                description="En coach granskar ditt resultat. Vid godkännande får du en grön verifieringssymbol och resultatet blir officiellt!"
                colorClass="bg-green-50 border-green-100"
                iconBgClass="bg-white"
            />

            <FeatureItem
                icon="🔔"
                title="Håll dig uppdaterad"
                description="Du får en notis direkt i flödet när ditt resultat har hanterats. Om det nekas får du veta varför, så du kan försöka igen."
                colorClass="bg-blue-50 border-blue-100"
                iconBgClass="bg-white"
            />
        </div>

        {/* Footer / CTA */}
        <div className="pt-6 border-t mt-2 flex flex-col items-center gap-4 bg-white sticky bottom-0">
          <p className="text-lg font-medium text-gray-800 text-center">
            Logga ditt nästa pass och se hur det funkar! 💪
          </p>
          <Button onClick={onClose} variant="primary" size="lg" className="w-full sm:w-auto shadow-lg shadow-flexibel/20 px-8">
            Toppen, jag hänger med!
          </Button>
        </div>

      </div>
    </Modal>
  );
};
