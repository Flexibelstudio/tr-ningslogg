import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { ParticipantProfile } from '../../types';

const getInBodyScoreInterpretation = (score: number | undefined | null): { label: string; color: string; } | null => {
    if (score === undefined || score === null || isNaN(score)) return null;
    if (score >= 90) return { label: 'Utmärkt', color: 'text-teal-600' };
    if (score >= 80) return { label: 'Bra', color: 'text-green-600' };
    if (score >= 70) return { label: 'Medel', color: 'text-yellow-600' };
    return { label: 'Under Medel', color: 'text-orange-600' };
};

interface PhysiqueManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ParticipantProfile | null;
  onSave: (physiqueData: Partial<Pick<ParticipantProfile, 'bodyweightKg' | 'muscleMassKg' | 'fatMassKg' | 'inbodyScore'>>) => void;
}

export const PhysiqueManagerModal: React.FC<PhysiqueManagerModalProps> = ({ isOpen, onClose, currentProfile, onSave }) => {
    const [bodyweight, setBodyweight] = useState('');
    const [muscleMass, setMuscleMass] = useState('');
    const [fatMass, setFatMass] = useState('');
    const [inbodyScore, setInbodyScore] = useState('');

    const [bodyweightError, setBodyweightError] = useState('');
    const [muscleMassError, setMuscleMassError] = useState('');
    const [fatMassError, setFatMassError] = useState('');
    const [inbodyScoreError, setInbodyScoreError] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsSaving(false);
            setHasSaved(false);
            setBodyweight(currentProfile?.bodyweightKg?.toString() || '');
            setMuscleMass(currentProfile?.muscleMassKg?.toString() || '');
            setFatMass(currentProfile?.fatMassKg?.toString() || '');
            setInbodyScore(currentProfile?.inbodyScore?.toString() || '');
            setBodyweightError('');
            setMuscleMassError('');
            setFatMassError('');
            setInbodyScoreError('');
        }
    }, [isOpen, currentProfile]);

    const validateWeightField = (value: string, errorSetter: React.Dispatch<React.SetStateAction<string>>) => {
        if (value === '') {
            errorSetter('');
            return true;
        }
        const num = Number(value.replace(',', '.'));
        if (isNaN(num) || num < 0) {
            errorSetter('Ange ett giltigt positivt tal (kg).');
            return false;
        }
        errorSetter('');
        return true;
    };
  
    const handleBodyweightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBodyweight(e.target.value);
        validateWeightField(e.target.value, setBodyweightError);
    };

    const handleMuscleMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMuscleMass(e.target.value);
        validateWeightField(e.target.value, setMuscleMassError);
    };

    const handleFatMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFatMass(e.target.value);
        validateWeightField(e.target.value, setFatMassError);
    };

    const handleInbodyScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInbodyScore(value);
        if (value === '') {
            setInbodyScoreError('');
            return;
        }
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(Number(num))) {
            setInbodyScoreError('Ange en giltig InBody-poäng (heltal 0-100).');
        } else {
            setInbodyScoreError('');
        }
    };
  
    const handleSave = () => {
        const isBwValid = validateWeightField(bodyweight, setBodyweightError);
        const isMmValid = validateWeightField(muscleMass, setMuscleMassError);
        const isFmValid = validateWeightField(fatMass, setFatMassError);
        
        let isInBodyScoreValid = true;
        if (inbodyScore.trim() !== '') {
            const num = Number(inbodyScore);
            if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(Number(num))) {
                setInbodyScoreError('Ange en giltig InBody-poäng (heltal 0-100).');
                isInBodyScoreValid = false;
            } else {
                setInbodyScoreError('');
            }
        }

        if (!isBwValid || !isMmValid || !isFmValid || !isInBodyScoreValid) {
            return;
        }

        setIsSaving(true);
        setHasSaved(false);

        const physiqueData = {
            bodyweightKg: bodyweight.trim() ? parseFloat(bodyweight.replace(',', '.')) : undefined,
            muscleMassKg: muscleMass.trim() ? parseFloat(muscleMass.replace(',', '.')) : undefined,
            fatMassKg: fatMass.trim() ? parseFloat(fatMass.replace(',', '.')) : undefined,
            inbodyScore: inbodyScore.trim() ? parseInt(inbodyScore, 10) : undefined,
        };

        onSave(physiqueData);
        setHasSaved(true);
        setTimeout(() => {
            onClose();
        }, 800);
    };

    let saveButtonText = "Spara Kroppsdata";
    if (isSaving && !hasSaved) saveButtonText = "Sparar...";
    if (hasSaved) saveButtonText = "Sparat! ✓";

    const inbodyInterpretation = getInBodyScoreInterpretation(inbodyScore.trim() ? Number(inbodyScore.replace(',', '.')) : undefined);
    const currentScore = currentProfile?.inbodyScore;
    const currentInterpretation = getInBodyScoreInterpretation(currentScore);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Min Kropp (InBody)" size="lg">
            <div className="space-y-4">
                {currentScore && currentInterpretation && (
                  <div className="p-4 bg-gray-100 rounded-lg text-center mb-4 border">
                    <p className="text-base font-semibold text-gray-600">Senaste InBody Score</p>
                    <p className="text-5xl font-bold text-flexibel">{currentScore}</p>
                    <p className={`text-2xl font-bold ${currentInterpretation.color}`}>{currentInterpretation.label}</p>
                  </div>
                )}
                <p className="text-base text-gray-600">
                    Logga dina kroppsmått här. Dessa uppgifter hjälper till att ge dig mer precisa jämförelser och rekommendationer.
                </p>
                <Input
                    label="Kroppsvikt (kg)"
                    id="physiqueBodyweight"
                    name="physiqueBodyweight"
                    type="number"
                    step="0.1"
                    value={bodyweight}
                    onChange={handleBodyweightChange}
                    placeholder="T.ex. 66.5"
                    error={bodyweightError}
                />
                <Input
                    label="Muskelmassa (kg, InBody)"
                    id="physiqueMuscleMass"
                    name="physiqueMuscleMass"
                    type="number"
                    step="0.1"
                    value={muscleMass}
                    onChange={handleMuscleMassChange}
                    placeholder="T.ex. 35.5"
                    error={muscleMassError}
                />
                <Input
                    label="Fettmassa (kg, InBody)"
                    id="physiqueFatMass"
                    name="physiqueFatMass"
                    type="number"
                    step="0.1"
                    value={fatMass}
                    onChange={handleFatMassChange}
                    placeholder="T.ex. 12.0"
                    error={fatMassError}
                />
                <div>
                    <Input
                        label="InBody Score"
                        id="physiqueInbodyScore"
                        name="physiqueInbodyScore"
                        type="number"
                        value={inbodyScore}
                        onChange={handleInbodyScoreChange}
                        placeholder="T.ex. 82"
                        error={inbodyScoreError}
                    />
                    {inbodyInterpretation && !inbodyScoreError && (
                        <p className={`text-sm font-semibold mt-1 ${inbodyInterpretation.color}`}>
                            Nivå: {inbodyInterpretation.label}
                        </p>
                    )}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
                    <Button onClick={handleSave} variant="primary" disabled={isSaving}>
                        {saveButtonText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};