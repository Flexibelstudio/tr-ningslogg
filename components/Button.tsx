
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'; // Removed 'fab-orange'
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', size = 'md', fullWidth = false, ...props }) => {
  const baseStyle = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition ease-in-out duration-150 shadow-sm';
  
  let variantStyle = '';
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-flexibel text-white hover:bg-flexibel/90 focus:ring-flexibel';
      break;
    case 'secondary':
      variantStyle = 'bg-flexibel-orange text-white hover:bg-flexibel-orange/90 focus:ring-flexibel-orange';
      break;
    case 'danger':
      variantStyle = 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500';
      break;
    case 'outline':
      variantStyle = 'bg-white text-flexibel border border-flexibel hover:bg-flexibel/10 focus:ring-flexibel';
      break;
    case 'ghost':
      variantStyle = 'text-flexibel hover:bg-flexibel/10 focus:ring-flexibel shadow-none hover:shadow-sm'; // Minimal style
      break;
    // 'fab-orange' case removed as it was identical to 'secondary'
  }

  let sizeStyle = '';
  switch (size) {
    case 'sm':
      sizeStyle = 'px-3 py-1.5 text-base'; 
      break;
    case 'md':
      sizeStyle = 'px-4 py-2 text-lg'; 
      break;
    case 'lg':
      sizeStyle = 'px-6 py-3 text-xl'; 
      break;
  }

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button className={`${baseStyle} ${variantStyle} ${sizeStyle} ${widthStyle} ${className}`} {...props}>
      {children}
    </button>
  );
};