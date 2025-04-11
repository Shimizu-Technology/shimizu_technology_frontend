// src/ordering/components/admin/SetEtaModal.tsx
import React from 'react';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';

interface SetEtaModalProps {
  order: any;
  etaMinutes: number;
  setEtaMinutes: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  onConfirm: () => void;
  isUpdateMode?: boolean; // Flag to indicate if we're updating an existing ETA
}

/**
 * The "Set ETA" modal for pending->preparing
 * Handles both regular orders (5-60 minute ETA) and 
 * advance notice orders (next day time slots)
 */
export function SetEtaModal({
  order,
  etaMinutes,
  setEtaMinutes,
  onClose,
  onConfirm,
  isUpdateMode = false,
}: SetEtaModalProps) {
  const requiresAdvanceNotice = order.requires_advance_notice === true;
  
  // For regular orders: 5-60 minutes in 5-minute increments
  const regularEtaOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 5).map(minutes => ({
    value: String(minutes),
    label: `${minutes} minutes`
  }));
  
  // For 24-hour notice orders: Next day time slots
  const getNextDayTimeSlots = () => {
    const slots = [];
    // Start at 10 AM, end at 6 PM, 30-minute intervals
    for (let hour = 10; hour <= 18; hour++) {
      for (let minute of [0, 30]) {
        if (hour === 18 && minute === 30) continue; // Skip 6:30 PM
        
        const timeString = `${hour % 12 || 12}:${minute === 0 ? '00' : '30'} ${hour < 12 ? 'AM' : 'PM'}`;
        const value = `${hour}.${minute}`; // Store as decimal for easy sorting
        
        slots.push({
          value,
          label: timeString
        });
      }
    }
    return slots;
  };
  
  const advanceNoticeOptions = getNextDayTimeSlots();
  
  // Use the appropriate options based on order type
  const etaOptions = requiresAdvanceNotice ? advanceNoticeOptions : regularEtaOptions;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-md w-full max-w-sm p-5 relative animate-slideUp">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Close</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold mb-4 pr-6">
          {requiresAdvanceNotice 
            ? isUpdateMode ? 'Update Next-Day Pickup Time' : 'Set Next-Day Pickup Time' 
            : isUpdateMode ? 'Update Preparation Time' : 'Set Preparation Time'}
        </h3>

        {requiresAdvanceNotice && (
          <div className="mb-4 p-3 bg-purple-50 rounded-md border border-purple-100">
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-purple-800">
                This order contains items that require 24-hour advance notice. 
                Please select a pickup time for tomorrow.
              </p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {requiresAdvanceNotice 
              ? 'Pickup time (tomorrow)' 
              : 'Estimated preparation time'}
          </label>
          <MobileSelect
            options={etaOptions}
            value={String(etaMinutes)}
            onChange={(value) => setEtaMinutes(Number(value))}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full sm:w-auto px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] transition-colors"
          >
            {requiresAdvanceNotice 
              ? isUpdateMode ? 'Update Pickup Time' : 'Confirm Next-Day Pickup' 
              : isUpdateMode ? 'Update ETA' : 'Start Preparing'}
          </button>
        </div>
      </div>
    </div>
  );
}
