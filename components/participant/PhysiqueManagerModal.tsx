
import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { StrengthComparisonTool, StrengthComparisonToolRef } from './StrengthComparisonTool';
import { ConditioningStatsForm, ConditioningStatsFormRef } from './ConditioningStatsForm';
import { ParticipantProfile, UserStrengthStats, ParticipantConditioningStats, ParticipantGoalData } from '../../types';
import { FLEXIBEL_PRIMARY_COLOR } from '../../constants';

// Icons for internal tabs
const StrengthIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.5 2.028A1 1 0 0010.5 1h-1A1 1 0 008.5 2.028v2.944A6.974 6.974 0 004 11.532V14a1 1 0 001 1h10a1 1 0 001-1v-2.468A6.974 6.974 0 0011.5 4.972V2.028zM10 16a4 4 0 100-8 4 4 0 000 8z" clipRule="evenodd" /><path d="M10 13a1 1 0 100-2 1 1 0 000 2z" /></svg>;
const ConditioningIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>;


interface PhysiqueManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantProfile: ParticipantProfile | null;
  latestGoal: ParticipantGoalData | null;
  userStrengthStats: UserStrengthStats | null;
  userConditioningStats: ParticipantConditioningStats | null;
  onSaveStrengthStats: (stats: UserStrengthStats) => void;
  onSaveConditioningStats: (stats: ParticipantConditioningStats) => void;
}

type ActivePhysiqueTab = 'strength' | 'conditioning';

export const PhysiqueManagerModal: React.FC<PhysiqueManagerModalProps> = ({
  isOpen,
  onClose,
  participantProfile,
  latestGoal,
  userStrengthStats,
  userConditioningStats,
  onSaveStrengthStats,
  onSaveConditioningStats,
}) => {
  const [activeTab, setActiveTab] = useState<ActivePhysiqueTab>('strength');
  const strengthToolRef = useRef<StrengthComparisonToolRef>(null);
  const conditioningToolRef = useRef<ConditioningStatsFormRef>(null);

  const handleSaveAllPhysiqueData = useCallback(() => {
    let strengthSaved = true; // Default to true if form not active/rendered or no ref
    let conditioningSaved = true;

    // Attempt to save strength stats if the strength tool has been interacted with or is visible
    if (strengthToolRef.current) {
        strengthSaved = strengthToolRef.current.submitForm();
    }
    
    // Attempt to save conditioning stats
    if (conditioningToolRef.current) {
        conditioningSaved = conditioningToolRef.current.submitForm();
    }

    if (strengthSaved && conditioningSaved) {
      onClose();
    } else {
      // Alert or specific error handling could be improved, but child forms might show alerts.
      // For now, modal stays open if any save fails.
      console.warn("Saving failed for one or both physique sections.");
    }
  }, [onClose]);

  if (!isOpen) {
    return null;
  }
  
  const internalTabs: { id: ActivePhysiqueTab; label: string; icon: () => JSX.Element }[] = [
    { id: 'strength', label: 'Styrkeanalys', icon: StrengthIcon },
    { id: 'conditioning', label: 'Konditionstester', icon: ConditioningIcon },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Min Fysik" size="xl">
      <div className="flex flex-col min-h-[50vh]">
        {/* Internal Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-2 sm:space-x-4 px-1 overflow-x-auto" aria-label="Fysiksektioner">
            {internalTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap pb-3 pt-1 px-1 border-b-2 font-medium text-sm sm:text-base flex items-center
                  ${activeTab === tab.id
                    ? 'border-flexibel text-flexibel'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <tab.icon /> {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
          {activeTab === 'strength' && (
            <StrengthComparisonTool
              ref={strengthToolRef}
              profile={participantProfile}
              strengthStats={userStrengthStats}
              latestGoal={latestGoal}
              onSaveStrengthStats={onSaveStrengthStats}
              isEmbedded={true} 
            />
          )}
          {activeTab === 'conditioning' && (
            <ConditioningStatsForm
              ref={conditioningToolRef}
              currentStats={userConditioningStats}
              onSaveStats={onSaveConditioningStats}
              participantId={participantProfile?.id}
            />
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-auto">
          <Button onClick={onClose} variant="secondary">
            Avbryt
          </Button>
          <Button onClick={handleSaveAllPhysiqueData} variant="primary">
            Spara Fysikdata
          </Button>
        </div>
      </div>
    </Modal>
  );
};
