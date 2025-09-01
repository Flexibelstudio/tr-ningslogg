import React from 'react';

// A simple hashing function to get a consistent color for initials
const getInitialsColor = (name: string): string => {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    'bg-rose-500'
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % colors.length);
  return colors[index];
};

const getInitials = (name: string): string => {
  if (!name) return '';
  const names = name.split(' ');
  if (names.length > 1 && names[0] && names[names.length - 1]) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

interface AvatarProps {
  name?: string | null;
  photoURL?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, photoURL, size = 'md', className }) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-lg',
    lg: 'h-16 w-16 text-2xl',
  };

  const baseClasses = 'rounded-full flex items-center justify-center font-bold text-white shrink-0';

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name || 'Profilbild'}
        className={`${baseClasses} ${sizeClasses[size]} object-cover ${className}`}
      />
    );
  }

  if (name) {
    const initials = getInitials(name);
    const colorClass = getInitialsColor(name);
    return (
      <div
        className={`${baseClasses} ${sizeClasses[size]} ${colorClass} ${className}`}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  // Fallback icon
  return (
    <div className={`${baseClasses} ${sizeClasses[size]} bg-gray-400 ${className}`} aria-label="Anonym användare">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-2/3 w-2/3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </div>
  );
};