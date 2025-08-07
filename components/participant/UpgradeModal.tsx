import React from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Uppgradera för att låsa upp!" size="lg">
      <div className="space-y-4 text-center">
        <span className="text-7xl" role="img" aria-label="pokal">🏆</span>
        <h3 className="text-3xl font-bold text-gray-800">Lås upp din fulla potential!</h3>
        <p className="text-lg text-gray-600">
          Detta pass ingår i våra PT-medlemskap (PT-Bas & PT-Grupp) som är designade för att ge dig maximala resultat med personlig coachning.
        </p>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-left text-green-800 space-y-2">
            <p className="text-lg"><strong>Fördelar med att uppgradera:</strong></p>
            <ul className="list-disc pl-5 space-y-1 text-base">
                <li>Personlig feedback på din teknik för att undvika skador och maximera effekt.</li>
                <li>Strukturerade program som garanterar progression.</li>
                <li>Motivation och gemenskap i våra populära PT-grupper.</li>
                <li>Snabbare och bättre resultat mot dina mål!</li>
            </ul>
        </div>
        <p className="text-lg text-gray-600 pt-2">
          Är du intresserad av att nå dina mål snabbare och säkrare?
        </p>
        <div className="flex justify-center pt-4 border-t">
          <Button onClick={onClose} variant="primary" size="lg">
            Prata med en coach om uppgradering
          </Button>
        </div>
      </div>
    </Modal>
  );
};