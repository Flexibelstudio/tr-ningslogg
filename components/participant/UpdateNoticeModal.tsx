import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface UpdateNoticeModalProps {
  show: boolean;
  onClose: () => void;
}

export const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({ show, onClose }) => {
  return (
    <Modal isOpen={show} onClose={onClose} title="Nyheter & Förbättringar i Appen!" size="lg">
      <div className="space-y-4 text-gray-700">
        <p className="text-lg">
          Vi har lyssnat på er feedback och gjort några uppdateringar för att förbättra din upplevelse!
        </p>

        <ul className="space-y-3 list-disc pl-5">
          <li>
            <strong className="font-semibold text-gray-800">Renare Kalender:</strong>
            <p className="text-base">
              Din kalender visar nu enbart dina egna aktiviteter och prestationer för en mer personlig överblick.
            </p>
          </li>
          <li>
            <strong className="font-semibold text-gray-800">Tydligare Topplistor & Klubbar:</strong>
            <p className="text-base">
              Vi har justerat vyerna för Topplistor och Klubbar så att det blir enklare att följa din och andras utveckling.
            </p>
          </li>
          <li>
            <strong className="font-semibold text-gray-800">Förberedelse för Nya Funktioner:</strong>
            <p className="text-base">
              I plus-menyn (+) kan du nu se valen 'Boka pass' och 'Checka in'. Dessa är förberedelser för kommande funktioner och kommer att aktiveras inom kort!
            </p>
          </li>
        </ul>

        <div className="flex justify-end pt-6 border-t mt-6">
          <Button onClick={onClose} size="lg">
            Grymt, jag förstår!
          </Button>
        </div>
      </div>
    </Modal>
  );
};
