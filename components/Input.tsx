import React from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
  id?: string; // Made id optional as it's not always used by parent for label linking directly
  className?: string;
  inputSize?: 'sm' | 'md'; // New prop
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseInputProps {}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseInputProps {
  options: { value: string; label: string }[];
}


export const Input: React.FC<InputProps> = ({ label, id, error, className, inputSize = 'md', ...props }) => {
  const baseStyle = 'block w-full border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel';
  
  let sizeSpecificStyle = '';
  let labelStyle = 'block text-xl font-medium text-gray-700 mb-1';

  if (inputSize === 'sm') {
    sizeSpecificStyle = 'px-3 py-2 text-lg rounded-lg';
    labelStyle = 'block text-base font-medium text-gray-700 mb-0.5';
  } else { // md (default)
    sizeSpecificStyle = 'px-4 py-2.5 text-xl rounded-xl';
  }
  
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  
  return (
    <div className="w-full">
      {label && <label htmlFor={id || props.name} className={labelStyle}>{label}</label>}
      <input id={id || props.name} className={`${baseStyle} ${sizeSpecificStyle} ${errorStyle} ${className}`} {...props} />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>} {/* Adjusted error text size for 'sm' inputs */}
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, id, error, className, options, inputSize = 'md', ...props }) => {
  const baseStyle = 'block w-full border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel';
  
  let sizeSpecificStyle = '';
  let labelStyle = 'block text-xl font-medium text-gray-700 mb-1';

  if (inputSize === 'sm') {
    sizeSpecificStyle = 'pl-3 pr-10 py-2 text-lg rounded-lg'; // Adjusted padding for select
    labelStyle = 'block text-base font-medium text-gray-700 mb-0.5';
  } else { // md (default)
    sizeSpecificStyle = 'pl-4 pr-10 py-2.5 text-xl rounded-xl';
  }
  
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  
  return (
    <div className="w-full">
      {label && <label htmlFor={id || props.name} className={labelStyle}>{label}</label>}
      <select id={id || props.name} className={`${baseStyle} ${sizeSpecificStyle} ${errorStyle} ${className}`} {...props}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>} {/* Adjusted error text size */}
    </div>
  );
};