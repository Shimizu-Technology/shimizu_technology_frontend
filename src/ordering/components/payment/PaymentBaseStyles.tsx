import React from 'react';

// Brand colors
export const brandColors = {
  primary: '#c1902f',
  primaryHover: '#d4a43f',
  primaryLight: '#f5ecd9',
  secondary: '#6c757d',
  success: '#28a745',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#17a2b8',
};

// Shared button styles for both Stripe and PayPal components
export const ButtonStyles = {
  primary: `px-4 py-3 w-full bg-[${brandColors.primary}] text-white font-medium rounded-md 
            hover:bg-[${brandColors.primaryHover}] focus:outline-none focus:ring-2 
            focus:ring-[${brandColors.primary}] focus:ring-opacity-50 transition-colors duration-200`,
  secondary: `px-4 py-3 w-full bg-gray-100 text-gray-700 font-medium rounded-md 
              hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 
              focus:ring-opacity-50 transition-colors duration-200`,
};

// Shared input field styles
export const InputStyles = {
  base: `w-full px-4 py-2 border border-gray-300 rounded-md
         focus:ring-[${brandColors.primary}] focus:border-[${brandColors.primary}]`,
  disabled: `w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500`,
};

// Test mode indicator banner
export const TestModeIndicator: React.FC = () => (
  <div className="p-3 mb-4 bg-yellow-50 border border-yellow-200 rounded-md">
    <div className="flex items-center">
      <span className="inline-flex items-center bg-yellow-100 text-yellow-800 font-semibold px-2 py-1 rounded mr-2">
        TEST MODE
      </span>
      <span className="text-yellow-700 text-sm">Payments will be simulated without processing real cards.</span>
    </div>
  </div>
);

// Payment method selector component
export const PaymentMethodSelector: React.FC<{
  paymentMethod: string;
  onChange: (method: string) => void;
  options: Array<{ id: string; label: string }>;
}> = ({ paymentMethod, onChange, options }) => (
  <div className="mb-6">
    <div className="flex border rounded-lg overflow-hidden">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`flex-1 py-2 text-center ${
            paymentMethod === option.id
              ? `bg-[${brandColors.primary}] text-white`
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

// Card field styling for both implementations
export const CardFieldContainer: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <div className="bg-white border border-gray-300 rounded-md shadow-sm p-4 mb-4">
    {children}
  </div>
);

// Loading indicator component
export const LoadingIndicator: React.FC<{text?: string}> = ({ text = "Loading..." }) => (
  <div className="flex justify-center items-center p-6">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#c1902f]"></div>
    <span className="ml-3 text-gray-600">{text}</span>
  </div>
);
