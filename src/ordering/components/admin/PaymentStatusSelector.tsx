// src/ordering/components/admin/PaymentStatusSelector.tsx

import React from 'react';

interface PaymentStatusSelectorProps {
  value: 'needs_payment' | 'already_paid';
  onChange: (status: 'needs_payment' | 'already_paid') => void;
}

export function PaymentStatusSelector({ value, onChange }: PaymentStatusSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Payment Status:</span>
      <div className="flex rounded-md shadow-sm">
        <button
          type="button"
          className={`relative inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-l-md border ${
            value === 'needs_payment'
              ? 'bg-yellow-50 border-yellow-300 text-yellow-800 z-10'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => onChange('needs_payment')}
        >
          {value === 'needs_payment' && (
            <span className="absolute -left-px -top-px -bottom-px w-0.5 bg-yellow-500 rounded-l-md" aria-hidden="true"></span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 mr-1.5 ${value === 'needs_payment' ? 'text-yellow-600' : 'text-gray-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Needs Payment
        </button>
        <button
          type="button"
          className={`relative -ml-px inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-r-md border ${
            value === 'already_paid'
              ? 'bg-green-50 border-green-300 text-green-800 z-10'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => onChange('already_paid')}
        >
          {value === 'already_paid' && (
            <span className="absolute -right-px -top-px -bottom-px w-0.5 bg-green-500 rounded-r-md" aria-hidden="true"></span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 mr-1.5 ${value === 'already_paid' ? 'text-green-600' : 'text-gray-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Already Paid
        </button>
      </div>
    </div>
  );
}
