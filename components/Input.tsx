import React, { useState } from 'react';

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

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
);
  
const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2 2 0 012.828 2.828l1.515 1.515a4 4 0 00-5.858-5.858zM10 13a3 3 0 01-3-3 2.98 2.98 0 01.178-1.017l-2.639-2.64A10.005 10.005 0 00.458 10c1.274 4.057 5.022 7 9.542 7 1.852 0 3.597-.506 5.068-1.355l-2.194-2.194a3 3 0 01-3.873-3.873z" clipRule="evenodd" />
    </svg>
);


export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, id, error, className, inputSize = 'md', containerClassName, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = props.type === 'password';
  
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
  
  const inputElement = (
    <input 
      ref={ref} 
      id={id || props.name} 
      {...props}
      type={isPassword ? (showPassword ? 'text' : 'password') : props.type}
      className={`${baseStyle} ${sizeSpecificStyle} ${errorStyle} ${className} ${isPassword ? 'pr-10' : ''}`}
    />
  );
  
  return (
    <div className={containerClassName ?? "w-full"}>
      {label && <label htmlFor={id || props.name} className={labelStyle}>{label}</label>}
      {isPassword ? (
        <div className="relative">
          {inputElement}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-flexibel/40 rounded-r-lg"
            aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        inputElement
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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