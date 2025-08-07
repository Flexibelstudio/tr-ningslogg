import React, { useMemo, useRef } from 'react';
import { Button } from '../Button';
import { Workout, WorkoutCategory, Membership, IntegrationSettings, WorkoutCategoryDefinition } from '../../types';

interface FabMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  workouts: Workout[];
  currentParticipantId: string;
  onSelectWorkoutCategory: (category: WorkoutCategory) => void;
  onOpenLogGeneralActivityModal: () => void;
  restrictedCategories?: WorkoutCategory[];
  onOpenUpgradeModal: () => void;
  onOpenBookingModal: () => void;
  integrationSettings: IntegrationSettings;
  onOpenQrScanner: (mode: 'workout' | 'checkin') => void;
  workoutCategories: WorkoutCategoryDefinition[];
}

// Icons
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H3a2 2 0 01-2-2v-5a2 2 0 012-2zm5-2a3 3 0 00-3 3v2h6V7a3 3 0 00-3-3z" clipRule="evenodd" /></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-flexibel transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

const categoryIcons: Record<string, React.ReactNode> = {
    'PT-bas': <span className="text-lg">🏋️</span>,
    'PT-grupp': <span className="text-lg">🔥</span>,
    'Workout': <span className="text-lg">⚡️</span>,
    'Personligt program': <span className="text-lg">📝</span>,
    'Annat': <span className="text-lg">🤸‍♀️</span>
};


export const FabMenu: React.FC<FabMenuProps> = ({ isOpen, onToggle, onClose, workouts, currentParticipantId, onSelectWorkoutCategory, onOpenLogGeneralActivityModal, restrictedCategories, onOpenUpgradeModal, onOpenBookingModal, integrationSettings, onOpenQrScanner, workoutCategories }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCategoryClick = (category: WorkoutCategory) => {
    if (category !== 'Personligt program' && restrictedCategories?.includes(category)) {
      onOpenUpgradeModal();
    } else {
      onSelectWorkoutCategory(category);
    }
    onClose();
  };
  
  const handleLogGeneralActivity = () => {
    onOpenLogGeneralActivityModal();
    onClose();
  };

  const allMenuItems = useMemo(() => {
    const actions: { key: string; label: string; icon: React.ReactNode; onClick: () => void; isRestricted: boolean; }[] = [];

    if (integrationSettings.isBookingEnabled) {
      actions.push({
          key: 'book-class',
          label: 'Boka Pass',
          icon: <span className="text-lg">🗓️</span>,
          onClick: () => {
              onOpenBookingModal();
              onClose();
          },
          isRestricted: false,
      });
      actions.push({
        key: 'check-in',
        label: 'Checka in (QR)',
        icon: <span className="text-lg">✅</span>,
        onClick: () => {
            onOpenQrScanner('checkin');
            onClose();
        },
        isRestricted: false,
      });
    }

    const availableTemplateCategories = new Set(
      workouts
        .filter(w => w.isPublished && !w.assignedToParticipantId)
        .map(w => w.category)
    );

    let finalMenuItems = workoutCategories
        .map(cat => ({ value: cat.name, label: cat.name }))
        .filter(catOption => availableTemplateCategories.has(catOption.value));

    const hasPersonalWorkouts = workouts.some(
      w => w.assignedToParticipantId === currentParticipantId
    );

    const personalProgramCategory = workoutCategories.find(c => c.name === 'Personligt program');
    if (hasPersonalWorkouts && personalProgramCategory) {
      if (!finalMenuItems.some(item => item.value === 'Personligt program')) {
        finalMenuItems.push({ value: personalProgramCategory.name, label: personalProgramCategory.name });
      }
    } else {
      finalMenuItems = finalMenuItems.filter(item => item.value !== 'Personligt program');
    }

    finalMenuItems.forEach(category => {
        const isRestricted = category.value !== 'Personligt program' && (restrictedCategories?.includes(category.value) || false);
        actions.push({
            key: category.value,
            label: `Logga ${category.label}`,
            icon: categoryIcons[category.value] || <span className="text-lg">🤸‍♀️</span>,
            onClick: () => handleCategoryClick(category.value),
            isRestricted: isRestricted,
        });
    });

    actions.push({
        key: 'log-general',
        label: 'Logga Annan Aktivitet',
        icon: <span className="text-lg">✍️</span>,
        onClick: handleLogGeneralActivity,
        isRestricted: false,
    });
    
    // Custom sort: 'Boka Pass' first, then others alphabetically.
    actions.sort((a, b) => {
        if (a.key === 'book-class') return -1;
        if (b.key === 'book-class') return 1;
        if (a.key === 'check-in') return -1;
        if (b.key === 'check-in') return 1;
        return a.label.localeCompare(b.label, 'sv');
    });

    return actions;
}, [workouts, currentParticipantId, restrictedCategories, onOpenUpgradeModal, onSelectWorkoutCategory, onClose, onOpenLogGeneralActivityModal, integrationSettings, onOpenBookingModal, onOpenQrScanner, workoutCategories]);

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-4">
      {/* Main FAB */}
      <Button
        onClick={onToggle}
        variant="secondary"
        className="!w-20 !h-20 !rounded-full !p-0 shadow-xl transform transition-transform duration-200 hover:scale-105"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Öppna loggningsmeny"
      >
        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
            <PlusIcon />
        </div>
      </Button>

      {/* Menu Items */}
      <div className={`flex flex-col items-end gap-3 transition-all duration-300 w-72 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isOpen && (
          allMenuItems.map((item, index) => (
            <Button
              key={item.key}
              onClick={item.onClick}
              style={{ animationDelay: `${(index + 1) * 40}ms` }}
              variant="fab-menu-item"
              className="w-full !justify-between py-2 px-3 animate-fade-in-down group"
              aria-label={`${item.label} ${item.isRestricted ? '(Låst)' : ''}`}
            >
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-flexibel group-hover:bg-flexibel/10 transition-colors">
                    {item.icon}
                  </div>
                  <span className={`font-semibold text-base ${item.isRestricted ? 'text-gray-500' : 'text-gray-800'}`}>
                    {item.label}
                  </span>
                </div>
                {item.isRestricted ? <LockIcon /> : <ChevronRightIcon />}
            </Button>
          ))
        )}
      </div>
    </div>
  );
};