// src/shared/components/ui/Input.tsx

import React, { InputHTMLAttributes, forwardRef } from 'react';
import { Tooltip } from './Tooltip';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  tooltip?: React.ReactNode;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = false, className = '', tooltip, tooltipPosition = 'top', required, ...props }, ref) => {
    // Base classes
    const baseClasses = 'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm';
    
    // Error classes
    const errorClasses = error ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' : '';
    
    // Full width class
    const fullWidthClass = fullWidth ? 'w-full' : '';
    
    // Combine all classes
    const inputClasses = `
      ${baseClasses}
      ${errorClasses}
      ${fullWidthClass}
      ${className}
    `;
    
    const labelElement = label && (
      <div className="flex items-center">
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {tooltip && (
          <Tooltip 
            content={tooltip} 
            position={tooltipPosition}
            icon
            iconClassName="ml-1 h-4 w-4"
          />
        )}
      </div>
    );

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {labelElement}
        <div className="relative">
          <input
            ref={ref}
            className={inputClasses}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
