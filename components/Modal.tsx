import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  showCloseButtonOnly?: boolean; // New prop
  isClosable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', showCloseButtonOnly = false, isClosable = true }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const titleId = React.useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isClosable) {
        onClose();
      }
      if (event.key === 'Tab') {
        // Focus trap
        const focusableElements = focusableElementsRef.current;
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) { // Shift+Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else { // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Set focusable elements and focus the first one
    if (modalRef.current) {
// FIX: Cast element to HTMLElement and use hasAttribute to ensure 'disabled' property check is safe.
        const focusable = Array.from(
            modalRef.current.querySelectorAll(
                'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
            )
        ).filter(el => !(el as HTMLElement).hasAttribute('disabled')) as HTMLElement[];
        focusableElementsRef.current = focusable;
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
             modalRef.current?.focus(); // Fallback focus
        }
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isClosable]);


  if (!isOpen) return null;

  let sizeClass = 'max-w-md';
  if (size === 'sm') sizeClass = 'max-w-sm';
  if (size === 'lg') sizeClass = 'max-w-lg';
  if (size === 'xl') sizeClass = 'max-w-xl';
  if (size === '2xl') sizeClass = 'max-w-2xl';
  if (size === '3xl') sizeClass = 'max-w-3xl';
  if (size === '4xl') sizeClass = 'max-w-4xl';
  if (size === '5xl') sizeClass = 'max-w-5xl';
  if (size === '6xl') sizeClass = 'max-w-6xl';


  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={isClosable ? onClose : undefined} // Close on backdrop click
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white text-gray-700 rounded-2xl shadow-2xl w-full ${sizeClass} max-h-[90vh] flex flex-col animate-scale-in outline-none`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {showCloseButtonOnly ? (
            isClosable && (
              <button
                  onClick={onClose}
                  className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
                  aria-label="Stäng modal"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
            )
        ) : (
            <div className="flex items-center justify-center p-5 border-b border-gray-200 relative">
          {title && <h3 id={titleId} className="text-xl font-semibold text-gray-900">{title}</h3>}
          {isClosable && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
              aria-label="Stäng modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        )}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};