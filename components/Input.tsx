import React from 'react';

interface BaseInputProps {
  label?: string;
  error?: string;
  id?: string; // Made id optional as it's not always used by parent for label linking directly
  className?: string;
  inputSize?: 'sm' | 'md' | 'lg'; // New prop
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseInputProps {
  containerClassName?: string;
}
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseInputProps {
  options: { value: string; label: string }[];
  containerClassName?: string;
}


export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, error, className, inputSize = 'md', containerClassName, ...props }, ref) => {
  const baseStyle = 'block w-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel text-gray-900 placeholder-gray-500';
  
  let sizeSpecificStyle = '';
  let labelStyle = 'block text-base font-medium text-gray-700 mb-1';

  if (inputSize === 'sm') {
    sizeSpecificStyle = 'px-2 py-1.5 text-sm rounded-md';
    labelStyle = 'block text-sm font-medium text-gray-700 mb-0.5';
  } else if (inputSize === 'lg') {
    sizeSpecificStyle = 'px-4 py-2.5 text-lg rounded-lg';
    labelStyle = 'block text-lg font-medium text-gray-700 mb-1.5';
  } else { // md (default)
    sizeSpecificStyle = 'px-3 py-2 text-base rounded-lg';
  }
  
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  
  return (
    <div className={containerClassName ?? "w-full"}>
      {label && <label htmlFor={id || props.name} className={labelStyle}>{label}</label>}
      <input ref={ref} id={id || props.name} className={`${baseStyle} ${sizeSpecificStyle} ${errorStyle} ${className}`} {...props} />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>} {/* Adjusted error text size for 'sm' inputs */}
    </div>
  );
});
Input.displayName = 'Input';

export const Select: React.FC<SelectProps> = ({ label, id, error, className, options, inputSize = 'md', containerClassName, ...props }) => {
  const baseStyle = 'block w-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-flexibel/40 focus:border-flexibel text-gray-900';
  
  let sizeSpecificStyle = '';
  let labelStyle = 'block text-base font-medium text-gray-700 mb-1';

  if (inputSize === 'sm') {
    sizeSpecificStyle = 'pl-2 pr-8 py-1.5 text-sm rounded-md'; // Adjusted padding for select
    labelStyle = 'block text-sm font-medium text-gray-700 mb-0.5';
  } else if (inputSize === 'lg') {
    sizeSpecificStyle = 'pl-4 pr-10 py-2.5 text-lg rounded-lg';
    labelStyle = 'block text-lg font-medium text-gray-700 mb-1.5';
  } else { // md (default)
    sizeSpecificStyle = 'pl-3 pr-10 py-2 text-base rounded-lg';
  }
  
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
  
  return (
    <div className={containerClassName ?? "w-full"}>
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
