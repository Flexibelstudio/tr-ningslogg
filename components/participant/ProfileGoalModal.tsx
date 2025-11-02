import React, { useRef, useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ProfileForm, ProfileFormRef } from './ProfileGoalForm'; // Re-using the file, but it contains ProfileForm
import { ParticipantProfile, GenderOption, ParticipantGamificationStats, Location } from '../../types';
import { TermsModal } from '../TermsModal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ParticipantProfile | null;
  onSave: (
    profileData: { name?: string; birthDate?: string; gender?: GenderOption; enableLeaderboardParticipation?: boolean; isSearchable?: boolean; locationId?: string; enableInBodySharing?: boolean; enableFssSharing?: boolean; photoURL?: string; }
  ) => void;
  locations: Location[];
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave,
  locations,
}) => {
  const formRef = useRef<ProfileFormRef>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setHasSaved(false);
    }
  }, [isOpen]);

  const handleSaveAndClose = () => {
    if (formRef.current) {
      setIsSaving(true);
      setHasSaved(false);
      const savedSuccessfully = formRef.current.submitForm();
      if (savedSuccessfully) {
        setHasSaved(true);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setIsSaving(false);
      }
    }
  };

  if (!isOpen) return null;

  const isProfileIncomplete = !currentProfile || !currentProfile.birthDate || !currentProfile.gender || currentProfile.gender === '-';
  const modalTitle = isProfileIncomplete ? "Slutför Din Profil" : "Min Profil";

  let saveButtonText = "Spara Profil";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
        <div>
          {isProfileIncomplete && (
            <div className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800" role="alert">
                <p className="font-bold">Viktigt!</p>
                <p>För att appen ska fungera optimalt och ge dig korrekta jämförelser, vänligen fyll i ditt <strong className="font-semibold">Födelsedatum</strong> och ditt <strong className="font-semibold">Kön</strong>.</p>
            </div>
          )}
          <ProfileForm
            ref={formRef}
            currentProfile={currentProfile}
            onSave={onSave}
            locations={locations}
          />
          <div className="text-center pt-4 border-t mt-6">
            <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="text-sm text-gray-500 hover:text-flexibel hover:underline focus:outline-none focus:ring-2 focus:ring-flexibel rounded"
            >
                Läs våra Användarvillkor & Integritetspolicy
            </button>
          </div>
          <div className="flex justify-end space-x-3 pt-4 mt-2">
            <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
            <Button onClick={handleSaveAndClose} variant="primary" disabled={isSaving}>
              {saveButtonText}
            </Button>
          </div>
        </div>
      </Modal>
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        onAccept={() => setIsTermsModalOpen(false)}
        isBlocking={false}
      />
    </>
  );
};