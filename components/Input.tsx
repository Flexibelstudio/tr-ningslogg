
import React from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
  id?: string; // Made id optional as it's not always used by parent for label linking directly
  className?: string;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseInputProps {}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseInputProps {
  options: { value: string; label: string }[];
}


export const Input: React.FC<InputProps> = ({ label, id, error, className, ...props }) => {
  const baseStyle = 'block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel sm:text-lg text-lg'; 
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  return (
    <div className="w-full">
      {label && <label htmlFor={id || props.name} className="block text-lg font-medium text-gray-700 mb-1">{label}</label>} 
      <input id={id || props.name} className={`${baseStyle} ${errorStyle} ${className}`} {...props} />
      {error && <p className="mt-1 text-base text-red-600">{error}</p>} 
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, id, error, className, options, ...props }) => {
  const baseStyle = 'block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel sm:text-lg text-lg'; 
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  return (
    <div className="w-full">
      {label && <label htmlFor={id || props.name} className="block text-lg font-medium text-gray-700 mb-1">{label}</label>} 
      <select id={id || props.name} className={`${baseStyle} ${errorStyle} ${className}`} {...props}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-base text-red-600">{error}</p>} 
    </div>
  );
};
