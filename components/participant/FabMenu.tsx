import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../Button';
import { WorkoutCategory } from '../../types';
import { WORKOUT_CATEGORY_OPTIONS } from '../../constants';

interface FabMenuProps {
  onSelectWorkoutCategory: (category: WorkoutCategory) => void;
  onOpenLogGeneralActivityModal: () => void;
  availableCategories: WorkoutCategory[];
}

const PTGruppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.247-4.01A5.25 5.25 0 0013.5 8.25a5.25 5.25 0 00-3.741 1.528M15 11.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.75A11.25 11.25 0 004.5 21M3.75 12a11.255 11.255 0 0111.25-8.25M12.75 21a11.25 11.25 0 008.25-17.25" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 21a9.006 9.006 0 0011.668-5.02.062.062 0 00-.054.02M11.668 15.98a5.952 5.952 0 00-5.836-2.926.062.062 0 01-.054-.02M11.668 15.98l-.001.002H11.67v-.002M11.668 15.98a5.978 5.978 0 005.836 2.925.062.062 0 01.054.02" />
  </svg>
);

const PTBasIcon = () => ( 
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .345.28.625.625.625h2.25c.345 0 .625-.28.625-.625v-.568a2.25 2.25 0 01-.625-1.628V.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v.652A2.25 2.25 0 0112.75 3.03zM5.25 3.03v.568c0 .345.28.625.625.625h2.25c.345 0 .625-.28.625-.625v-.568a2.25 2.25 0 01-.625-1.628V.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v.652A2.25 2.25 0 015.25 3.03zM12.75 9.75v6.375a2.25 2.25 0 004.5 0V9.75M5.25 9.75v6.375a2.25 2.25 0 004.5 0V9.75M21 9.75H3" />
  </svg>
);

const AnnatCategoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
);

const ClipboardListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const categoryIcons: Record<WorkoutCategory, JSX.Element> = {
  'PT-bas': <PTBasIcon />,
  'PT-grupp': <PTGruppIcon />,
  'Annat': <AnnatCategoryIcon />,
};

export const FabMenu: React.FC<FabMenuProps> = ({
  onSelectWorkoutCategory,
  onOpenLogGeneralActivityModal,
  availableCategories,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectCategory = (category: WorkoutCategory) => {
    onSelectWorkoutCategory(category);
    setIsOpen(false);
  };

  const handleLogGeneral = () => {
    onOpenLogGeneralActivityModal();
    setIsOpen(false);
  };

  const displayableCategories = WORKOUT_CATEGORY_OPTIONS.filter((option) =>
    availableCategories.includes(option.value)
  );

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-40">
      <div className="flex flex-col items-end space-y-3">
        {isOpen && (
          <div className="flex flex-col items-end space-y-3">
            {displayableCategories.map((categoryOption) => (
              <Button
                key={categoryOption.value}
                onClick={() => handleSelectCategory(categoryOption.value)}
                variant="fab-menu-item"
                size="md"
                className="shadow-lg w-auto min-w-[180px] justify-start"
                aria-label={`Välj ${categoryOption.label}`}
              >
                {categoryIcons[categoryOption.value]}
                {categoryOption.label}
              </Button>
            ))}
            <Button
              onClick={handleLogGeneral}
              variant="fab-menu-item"
              size="md"
              className="shadow-lg w-auto min-w-[180px] justify-start"
              aria-label="Logga Annan Aktivitet"
            >
              <ClipboardListIcon />
              Logga Aktivitet
            </Button>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-4 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-flexibel-orange ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-45'
            : 'bg-flexibel-orange hover:bg-flexibel-orange/90'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Stäng meny' : 'Öppna meny för att logga'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 transition-transform duration-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};
