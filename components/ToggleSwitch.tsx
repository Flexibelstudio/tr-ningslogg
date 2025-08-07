import React from 'react';

export const ToggleSwitch: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }> = ({ id, checked, onChange, label, description }) => (
    <label htmlFor={id} className="flex items-start justify-between cursor-pointer p-2 rounded-md hover:bg-gray-100">
        <div className="flex-grow mr-4">
            <span className="font-medium text-gray-700">{label}</span>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="relative inline-flex items-center flex-shrink-0 mt-1">
            <input 
                type="checkbox" 
                id={id} 
                className="sr-only peer"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-flexibel/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-flexibel"></div>
        </div>
    </label>
);
