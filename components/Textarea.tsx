
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  // id is optional, if not provided, props.name will be used.
}
export const Textarea: React.FC<TextareaProps> = ({ label, id, error, className, ...props }) => {
  const baseStyle = 'block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel sm:text-lg text-lg'; 
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  const effectiveId = id || props.name;

  return (
    <div className="w-full">
      {label && <label htmlFor={effectiveId} className="block text-lg font-medium text-gray-700 mb-1">{label}</label>} 
      <textarea id={effectiveId} name={props.name} className={`${baseStyle} ${errorStyle} ${className}`} {...props} />
      {error && <p className="mt-1 text-base text-red-600">{error}</p>} 
    </div>
  );
};
