import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface UpdateNoticeModalProps {
  show: boolean;
  onClose: () => void;
}

export const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ show, onClose }) => {
  return (
    <Modal isOpen={show} onClose={onClose} title="Nyheter i din träningslogg! 🎉" size="lg">
      <div className="space-y-4 text-gray-700">
        <p className="text-lg">
          Vi har lyssnat på er feedback och lagt till ett par efterlängtade funktioner för att göra din träningsresa ännu bättre!
        </p>

        <div className="space-y-4 pt-2">
            <div className="flex items-start gap-4">
                <span className="text-3xl mt-1">🗓️</span>
                <div>
                    <h4 className="font-semibold text-gray-800 text-lg">Missat att logga ett pass?</h4>
                    <p className="text-base">
                        Inga problem! Nu kan du enkelt <strong>bakåt datera dina pass</strong>. Gå in i loggningsvyn och ändra datumet högst upp. Perfekt för att se till att din streak och statistik alltid stämmer.
                    </p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                <span className="text-3xl mt-1">🏆</span>
                <div>
                    <h4 className="font-semibold text-gray-800 text-lg">Nya utmaningar väntar!</h4>
                    <p className="text-base">
                        Vi har lagt till <strong>ännu fler prestationsklubbar</strong> att låsa upp. Oavsett om du jagar nya rekord i styrka eller kondition finns det nya mål att erövra. Du hittar alla klubbar under "Loggbok & Prestationer".
                    </p>
                </div>
            </div>
        </div>

        <p className="text-lg pt-2">
          Hoppas du gillar uppdateringarna!
        </p>

        <div className="flex justify-end pt-6 border-t mt-6">
          <Button onClick={onClose} size="lg">
            Grymt, jag förstår!
          </Button>
        </div>
      </div>
    </Modal>
  );
};
