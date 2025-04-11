// src/ordering/components/admin/InventoryReversionDialog.tsx
import React, { useState } from 'react';

interface InventoryReversionDialogProps {
  itemName: string;
  onClose: () => void;
  onConfirm: (action: 'return_to_inventory' | 'mark_as_damaged', reason?: string) => void;
}

export function InventoryReversionDialog({ itemName, onClose, onConfirm }: InventoryReversionDialogProps) {
  const [action, setAction] = useState<'return_to_inventory' | 'mark_as_damaged'>('return_to_inventory');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Inventory Action Required</h3>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">
            You're removing <span className="font-medium">{itemName}</span> from this order. 
            What would you like to do with the inventory?
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  className="form-radio h-5 w-5 text-[#c1902f]"
                  checked={action === 'return_to_inventory'}
                  onChange={() => setAction('return_to_inventory')}
                />
                <div>
                  <span className="text-gray-900 font-medium">Return to inventory</span>
                  <p className="text-gray-500 text-sm">
                    The item will be added back to available stock.
                  </p>
                </div>
              </label>
            </div>
            
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  className="form-radio h-5 w-5 text-[#c1902f]"
                  checked={action === 'mark_as_damaged'}
                  onChange={() => setAction('mark_as_damaged')}
                />
                <div>
                  <span className="text-gray-900 font-medium">Mark as damaged/wasted</span>
                  <p className="text-gray-500 text-sm">
                    The item will be removed from inventory.
                  </p>
                </div>
              </label>
            </div>
            
            {action === 'mark_as_damaged' && (
              <div className="mt-4">
                <label htmlFor="damage-reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (Required)
                </label>
                <input
                  type="text"
                  id="damage-reason"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Dropped, customer complaint, etc."
                  required
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-[#c1902f] border border-transparent rounded-md text-white hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
            onClick={() => {
              if (action === 'mark_as_damaged' && !reason.trim()) {
                alert('Please provide a reason for marking the item as damaged.');
                return;
              }
              onConfirm(action, action === 'mark_as_damaged' ? reason : undefined);
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
