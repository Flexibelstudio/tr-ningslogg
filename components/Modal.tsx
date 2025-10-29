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
  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const titleId = React.useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isClosable) onClose();

      if (event.key === "Tab") {
        const focusable = focusableElementsRef.current;
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    if (modalRef.current) {
      const focusable = Array.from(
        modalRef.current.querySelectorAll(
          'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !(el as HTMLElement).hasAttribute("disabled")) as HTMLElement[];
      focusableElementsRef.current = focusable;
      if (focusable.length > 0) focusable[0].focus();
      else modalRef.current.focus();
    }

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={isClosable ? onClose : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white text-gray-700 rounded-2xl shadow-2xl w-full ${sizeClass} max-h-[90vh] flex flex-col animate-scale-in outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButtonOnly ? (
          isClosable && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
              aria-label="Stäng modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )
        ) : (
          <div className="flex items-center justify-center border-b border-gray-200 relative py-3 px-4">
            {title && (
              <h3 id={titleId} className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            )}
            {isClosable && (
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors z-10"
                aria-label="Stäng modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
