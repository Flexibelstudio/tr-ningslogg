
import React, { useMemo, useRef } from 'react';
<<<<<<< HEAD
import { Button } from '../Button';
=======
>>>>>>> origin/staging
import { Workout, WorkoutCategory, Membership, IntegrationSettings, WorkoutCategoryDefinition, WorkoutLog } from '../../types';

interface FabMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  workouts: Workout[];
  currentParticipantId: string;
  onAttemptLogWorkout: (category: WorkoutCategory) => void;
  onOpenLogGeneralActivityModal: () => void;
  membership?: Membership | null;
  onOpenUpgradeModal: () => void;
  onOpenBookingModal: () => void;
  integrationSettings: IntegrationSettings;
  onOpenQrScanner: (mode: 'workout' | 'checkin') => void;
  workoutCategories: WorkoutCategoryDefinition[];
  myWorkoutLogs: WorkoutLog[];
  onOpenAICoachModal: () => void;
}

// Icons
<<<<<<< HEAD
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

=======
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;
const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H3a2 2 0 01-2-2v-5a2 2 0 012-2zm5-2a3 3 0 00-3 3v2h6V7a3 3 0 00-3-3z" clipRule="evenodd" /></svg>;
const ChevronRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

const categoryColors: Record<string, string> = {
    'PT-bas': 'bg-blue-50 text-blue-600',
    'PT-grupp': 'bg-indigo-50 text-indigo-600',
    'Workout': 'bg-amber-50 text-amber-600',
    'Personligt program': 'bg-purple-50 text-purple-600',
    'Annat': 'bg-gray-100 text-gray-600',
    'Booking': 'bg-green-50 text-green-600',
    'QR': 'bg-rose-50 text-rose-600',
    'AI': 'bg-teal-50 text-teal-600',
};

const categoryIcons: Record<string, React.ReactNode> = {
    'PT-bas': <span className="text-xl">🏋️</span>,
    'PT-grupp': <span className="text-xl">🔥</span>,
    'Workout': <span className="text-xl">⚡️</span>,
    'Personligt program': <span className="text-xl">📝</span>,
    'Annat': <span className="text-xl">🤸‍♀️</span>,
    'Booking': <span className="text-xl">🗓️</span>,
    'QR': <span className="text-xl">✅</span>,
    'AI': <span className="text-xl">✨</span>,
    'Log': <span className="text-xl">✍️</span>,
};
>>>>>>> origin/staging

export const FabMenu: React.FC<FabMenuProps> = ({ isOpen, onToggle, onClose, workouts, currentParticipantId, onAttemptLogWorkout, onOpenLogGeneralActivityModal, membership, onOpenUpgradeModal, onOpenBookingModal, integrationSettings, onOpenQrScanner, workoutCategories, myWorkoutLogs, onOpenAICoachModal }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogGeneralActivity = () => {
    onOpenLogGeneralActivityModal();
    onClose();
  };

  const menuItems = useMemo(() => {
<<<<<<< HEAD
    // Default menu for regular members
    const actions: { key: string; label: string; icon: React.ReactNode; onClick: () => void; isRestricted: boolean; isLocked?: boolean;}[] = [];

    if (integrationSettings.isBookingEnabled) {
      actions.push({
          key: 'book-class', label: 'Boka Pass', icon: <span className="text-lg">🗓️</span>,
          onClick: () => { onOpenBookingModal(); onClose(); }, isRestricted: false,
      });
      actions.push({
        key: 'check-in', label: 'Checka in (QR)', icon: <span className="text-lg">✅</span>,
=======
    const actions: { key: string; label: string; icon: React.ReactNode; colorClass: string; onClick: () => void; isRestricted: boolean; isLocked?: boolean;}[] = [];

    if (integrationSettings.isBookingEnabled) {
      actions.push({
          key: 'book-class', label: 'Boka Pass', icon: categoryIcons['Booking'], colorClass: categoryColors['Booking'],
          onClick: () => { onOpenBookingModal(); onClose(); }, isRestricted: false,
      });
      actions.push({
        key: 'check-in', label: 'Checka in (QR)', icon: categoryIcons['QR'], colorClass: categoryColors['QR'],
>>>>>>> origin/staging
        onClick: () => { onOpenQrScanner('checkin'); onClose(); }, isRestricted: false,
      });
    }

    const availableTemplateCategories = new Set(workouts.filter(w => w.isPublished && !w.assignedToParticipantId).map(w => w.category));
    let finalMenuItems = workoutCategories.map(c => ({ value: c.name, label: c.name })).filter(catOption => availableTemplateCategories.has(catOption.value));
    const hasPersonalWorkouts = workouts.some(w => w.assignedToParticipantId === currentParticipantId);
    const personalProgramCategory = workoutCategories.find(c => c.name === 'Personligt program');
    if (hasPersonalWorkouts && personalProgramCategory) {
      if (!finalMenuItems.some(item => item.value === 'Personligt program')) {
        finalMenuItems.push({ value: personalProgramCategory.name, label: personalProgramCategory.name });
      }
    } else {
      finalMenuItems = finalMenuItems.filter(item => item.value !== 'Personligt program');
    }

<<<<<<< HEAD
=======
    actions.push({
        key: 'log-general', label: 'Logga Annan Aktivitet', icon: categoryIcons['Log'], colorClass: 'bg-sky-50 text-sky-600',
        onClick: () => { handleLogGeneralActivity(); onClose(); }, isRestricted: false,
    });

>>>>>>> origin/staging
    finalMenuItems.forEach(category => {
        let isRestricted = false;
        let isHidden = false;

<<<<<<< HEAD
        // Check restrictions
=======
>>>>>>> origin/staging
        if (membership?.restrictedCategories && category.value !== 'Personligt program') {
            const restrictionBehavior = membership.restrictedCategories[category.value];
            if (restrictionBehavior === 'hide') {
                isHidden = true;
            } else if (restrictionBehavior === 'show_lock') {
                isRestricted = true;
            }
        }
        
        if (isHidden) return;
        
        actions.push({
<<<<<<< HEAD
            key: category.value, label: `Logga ${category.label}`, icon: categoryIcons[category.value] || <span className="text-lg">🤸‍♀️</span>,
            onClick: () => { isRestricted ? onOpenUpgradeModal() : onAttemptLogWorkout(category.value); onClose(); }, isRestricted: isRestricted,
=======
            key: category.value, 
            label: `Logga ${category.label}`, 
            icon: categoryIcons[category.value] || <span className="text-xl">💪</span>,
            colorClass: categoryColors[category.value] || categoryColors['Annat'],
            onClick: () => { isRestricted ? onOpenUpgradeModal() : onAttemptLogWorkout(category.value); onClose(); }, 
            isRestricted: isRestricted,
>>>>>>> origin/staging
        });
    });

    actions.push({
<<<<<<< HEAD
        key: 'log-general', label: 'Logga Annan Aktivitet', icon: <span className="text-lg">✍️</span>,
        onClick: () => { handleLogGeneralActivity(); onClose(); }, isRestricted: false,
    });
    
    actions.sort((a, b) => {
        if (a.key === 'book-class') return -1; if (b.key === 'book-class') return 1;
        if (a.key === 'check-in') return -1; if (b.key === 'check-in') return 1;
        return a.label.localeCompare(b.label, 'sv');
    });

    actions.push({
        key: 'ask-ai-coach',
        label: 'Fråga Coachen',
        icon: <span className="text-lg">✨</span>,
=======
        key: 'ask-ai-coach',
        label: 'Fråga Coachen',
        icon: categoryIcons['AI'],
        colorClass: categoryColors['AI'],
>>>>>>> origin/staging
        onClick: () => { onOpenAICoachModal(); onClose(); },
        isRestricted: false,
    });

<<<<<<< HEAD
    return actions;
=======
    // Sort order: Boka/Checkin first, then General Activity, then Workouts/Coach
    const getSortOrder = (key: string) => {
        if (key === 'book-class') return 1;
        if (key === 'check-in') return 2;
        if (key === 'log-general') return 3;
        if (key === 'ask-ai-coach') return 99;
        return 50; // Categories in middle
    };

    return actions.sort((a, b) => getSortOrder(a.key) - getSortOrder(b.key));
>>>>>>> origin/staging
}, [integrationSettings, workoutCategories, myWorkoutLogs, workouts, currentParticipantId, membership, onOpenUpgradeModal, onAttemptLogWorkout, onClose, onOpenLogGeneralActivityModal, onOpenBookingModal, onOpenQrScanner, onOpenAICoachModal]);

  return (
    <>
      {isOpen && (
        <div
<<<<<<< HEAD
          className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
=======
          className="fixed inset-0 bg-gray-900/60 z-40 backdrop-blur-sm transition-opacity duration-300"
>>>>>>> origin/staging
          onClick={onClose}
          aria-hidden="true"
        />
      )}
<<<<<<< HEAD
      <div ref={menuRef} className="fixed bottom-6 right-8 z-50 flex flex-col-reverse items-end gap-4">
        {/* Main FAB */}
        <Button
          onClick={onToggle}
          variant="secondary"
          className="!w-20 !h-20 !rounded-full !p-0 shadow-xl transform transition-transform duration-200 hover:scale-105"
=======
      <div ref={menuRef} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-4">
        {/* Main FAB */}
        <button
          onClick={onToggle}
          className="relative w-16 h-16 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 text-white hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-orange-200"
>>>>>>> origin/staging
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Öppna loggningsmeny"
        >
<<<<<<< HEAD
          <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
              <PlusIcon />
          </div>
        </Button>

        {/* Menu Items */}
        <div className={`flex flex-col items-end gap-3 transition-all duration-300 w-72 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {isOpen && (
            menuItems.map((item, index) => (
              <Button
                key={item.key}
                onClick={item.onClick}
                style={{ animationDelay: `${(index + 1) * 40}ms` }}
                variant="fab-menu-item"
                className="w-full !justify-between py-2 px-3 animate-fade-in-down group"
                aria-label={`${item.label} ${item.isRestricted ? '(Låst)' : ''}`}
                disabled={item.isLocked}
              >
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-flexibel group-hover:bg-flexibel/10 transition-colors">
                      {item.icon}
                    </div>
                    <span className={`font-semibold text-base ${item.isRestricted || item.isLocked ? 'text-gray-500' : 'text-gray-800'}`}>
                      {item.label}
                    </span>
                  </div>
                  {item.isRestricted || item.isLocked ? <LockIcon /> : <ChevronRightIcon />}
              </Button>
            ))
          )}
        </div>
      </div>
=======
          <div className={`transform transition-transform duration-300 ease-out ${isOpen ? 'rotate-[135deg]' : 'rotate-0'}`}>
              <PlusIcon />
          </div>
        </button>

        {/* Menu Items */}
        <div className={`flex flex-col items-end gap-3 transition-all duration-300 w-72 pb-2 ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          {isOpen && (
            menuItems.map((item, index) => {
                // Calculate delay for stagger effect from bottom up
                const delay = (menuItems.length - 1 - index) * 0.04;
                return (
                  <button
                    key={item.key}
                    onClick={item.onClick}
                    style={{ 
                        animation: `slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s backwards` 
                    }}
                    className="group w-full bg-white text-gray-800 shadow-lg hover:shadow-xl border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between transform transition-all duration-200 active:scale-[0.98]"
                    disabled={item.isLocked}
                  >
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${item.colorClass} bg-opacity-20`}>
                          {item.icon}
                        </div>
                        <span className={`font-bold text-base ${item.isRestricted || item.isLocked ? 'text-gray-400' : 'text-gray-800'}`}>
                          {item.label}
                        </span>
                      </div>
                      {item.isRestricted || item.isLocked ? <LockIcon /> : <ChevronRightIcon />}
                  </button>
                );
            })
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideUpFade {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
>>>>>>> origin/staging
    </>
  );
};
