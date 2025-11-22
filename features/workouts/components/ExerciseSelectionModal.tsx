
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { LiftType, Exercise } from '../../../types';

interface ExerciseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  options?: {
    list: LiftType[];
    maxSelect: number;
    instructions?: string;
  };
  onConfirm: (selectedExercises: Exercise[]) => void;
}

export const ExerciseSelectionModal: React.FC<ExerciseSelectionModalProps> = ({
  isOpen,
  onClose,
  options,
  onConfirm,
}) => {
  const [selectedLifts, setSelectedLifts] = useState<LiftType[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && options) {
      setSelectedLifts([]);
      setError('');
    }
  }, [isOpen, options]);

  // Guard against rendering without options. This prevents the crash.
  if (!isOpen || !options) {
    return null;
  }

  const handleToggleLift = (lift: LiftType) => {
    setError('');
    setSelectedLifts((prevSelected) => {
      if (prevSelected.includes(lift)) {
        return prevSelected.filter((l) => l !== lift);
      } else {
        if (prevSelected.length < options.maxSelect) {
          return [...prevSelected, lift];
        } else {
          setError(`Du kan max välja ${options.maxSelect} övningar.`);
          return prevSelected;
        }
      }
    });
  };

  const handleConfirmSelection = () => {
    if (selectedLifts.length !== options.maxSelect) {
        setError(`Vänligen välj exakt ${options.maxSelect} övningar.`);
        return;
    }
    const exercises: Exercise[] = selectedLifts.map((liftName) => ({
      id: crypto.randomUUID(),
      name: liftName,
      notes: 'Logga set, reps och vikt.', // Standardanteckning
      baseLiftType: liftName, // Koppla till baslyftstyp
    }));
    onConfirm(exercises);
    onClose(); 
  };
  
  const defaultInstructions = `Välj ${options.maxSelect} övningar från listan nedan.`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Välj Övningar för Passet" size="md">
      <div className="space-y-4">
        <p className="text-base text-gray-700">{options.instructions || defaultInstructions}</p>
        
        {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
          {options.list.map((lift) => {
            const isSelected = selectedLifts.includes(lift);
            return (
              <button
                key={lift}
                onClick={() => handleToggleLift(lift)}
                className={`w-full text-left p-3 rounded-lg border text-base transition-colors duration-150
                  ${isSelected
                    ? 'bg-flexibel/20 border-flexibel ring-2 ring-flexibel text-flexibel font-semibold'
                    : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-700'
                  }`}
                aria-pressed={isSelected}
              >
                {lift}
              </button>
            );
          })}
        </div>
        
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button onClick={onClose} variant="secondary">
            Avbryt
          </Button>
          <Button 
            onClick={handleConfirmSelection} 
            variant="primary"
            disabled={selectedLifts.length !== options.maxSelect}
          >
            Bekräfta Val ({selectedLifts.length}/{options.maxSelect})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
