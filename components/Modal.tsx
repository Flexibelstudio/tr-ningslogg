
import React, { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
  showCloseButtonOnly?: boolean;
  isClosable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButtonOnly = false,
  isClosable = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const focusableElsRef = useRef<HTMLElement[]>([]);
  const hasSetInitialFocus = useRef(false);
  const titleId = React.useId();

  // Update the list of focusable elements whenever the component renders (in case children changed)
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const els = Array.from(
        modalRef.current.querySelectorAll(
          'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !(el as HTMLElement).hasAttribute("disabled")) as HTMLElement[];
      
      focusableElsRef.current = els;
    }
  });

  // Effect 1: Set Initial Focus (Only runs when modal opens)
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure DOM is ready and to avoid conflict with the event that opened the modal
      const timer = setTimeout(() => {
        if (modalRef.current && !hasSetInitialFocus.current) {
          // Only set focus if we aren't already focusing something inside the modal
          if (!modalRef.current.contains(document.activeElement)) {
              const els = focusableElsRef.current;
              if (els.length > 0) {
                els[0].focus();
              } else {
                modalRef.current.focus();
              }
          }
          hasSetInitialFocus.current = true;
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      hasSetInitialFocus.current = false;
    }
  }, [isOpen]);

  // Effect 2: Handle Keydown Events (Escape & Tab)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isClosable) {
          e.stopPropagation();
          onClose();
      }
      if (e.key === "Tab") {
        const els = focusableElsRef.current;
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isClosable]);

  if (!isOpen) return null;

  let sizeClass = "max-w-md";
  if (size === "sm") sizeClass = "max-w-sm";
  if (size === "lg") sizeClass = "max-w-lg";
  if (size === "xl") sizeClass = "max-w-xl";
  if (size === "2xl") sizeClass = "max-w-2xl";
  if (size === "3xl") sizeClass = "max-w-3xl";
  if (size === "4xl") sizeClass = "max-w-4xl";
  if (size === "5xl") sizeClass = "max-w-5xl";
  if (size === "6xl") sizeClass = "max-w-6xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={isClosable ? onClose : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white text-gray-700 rounded-2xl shadow-2xl w-full ${sizeClass} max-h-[90vh] flex flex-col outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButtonOnly ? (
          isClosable && (
            <button
              onClick={onClose}
              className="absolute top-1.5 right-1.5 p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
              aria-label="Stäng modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )
        ) : (
          (title || isClosable) && (
            <div className="flex items-center justify-center border-b border-gray-200 relative py-2 px-3">
              {title && (
                <h3 id={titleId} className="text-base font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {isClosable && (
                <button
                  onClick={onClose}
                  className="absolute top-1.5 right-1.5 p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
                  aria-label="Stäng modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        )}

        {/* Minimal innehålls-padding */}
        <div className="p-2 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
