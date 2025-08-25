import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  showCloseButtonOnly?: boolean; // New prop
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', showCloseButtonOnly = false }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 animate-fade-in">
      <div className={`relative bg-white text-gray-700 rounded-lg shadow-xl w-full ${sizeClass} max-h-[90vh] flex flex-col animate-scale-in`}>
        {showCloseButtonOnly ? (
            <button
                onClick={onClose}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors z-10"
                aria-label="Close modal"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        ) : (
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3> 
            <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close modal"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            </div>
        )}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};