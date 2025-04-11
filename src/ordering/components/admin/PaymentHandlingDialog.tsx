import React, { useState, useRef, useEffect } from 'react';

export type PaymentAction = 'refund' | 'store_credit' | 'adjust_total' | 'no_action';
export type InventoryAction = 'return_to_inventory' | 'mark_as_damaged';

interface PaymentHandlingDialogProps {
  item: {
    name: string;
    quantity: number;
    price: number;
    id?: string | number;
    enable_stock_tracking?: boolean;
  };
  isPartialQuantity?: boolean; // New prop to indicate if this is a partial quantity change
  orderId: number;
  orderStatus?: string; // Added to help determine default inventory action
  onClose: () => void;
  onAction: (
    action: PaymentAction, 
    reason: string, 
    amount: number, 
    inventoryAction?: InventoryAction, 
    inventoryReason?: string
  ) => void;
}

export function PaymentHandlingDialog({ 
  item, 
  isPartialQuantity = false, // Default to false for backward compatibility
  orderId, 
  orderStatus = 'pending', // Default to pending if not provided
  onClose, 
  onAction 
}: PaymentHandlingDialogProps) {
  const [selectedAction, setSelectedAction] = useState<PaymentAction>('refund');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);
  
  // Inventory-related state
  const [inventoryAction, setInventoryAction] = useState<InventoryAction>(() => {
    // For completed or ready orders, default to "mark as damaged" since items likely already used
    if (orderStatus === 'completed' || orderStatus === 'ready') {
      return 'mark_as_damaged';
    }
    // For other statuses (pending, preparing), default to return to inventory
    return 'return_to_inventory';
  });
  const [inventoryReason, setInventoryReason] = useState<string>('');
  const [otherInventoryReason, setOtherInventoryReason] = useState<string>('');
  const [inventoryReasonOptions, setInventoryReasonOptions] = useState<string[]>(['fell', 'bad/spoiled', 'other']);
  const [isInventoryReasonDropdownOpen, setIsInventoryReasonDropdownOpen] = useState(false);
  
  // Refs for detecting outside clicks
  const reasonDropdownRef = useRef<HTMLDivElement>(null);
  const inventoryReasonDropdownRef = useRef<HTMLDivElement>(null);
  
  // Calculate the total amount for this item
  const itemTotal = item.price * item.quantity;
  
  // Reason options based on selected action
  const reasonOptions = {
    refund: ['Customer request', 'Item unavailable', 'Item made incorrectly', 'Other'],
    store_credit: ['Customer preference', 'Loyalty bonus', 'Other'],
    adjust_total: ['Multi-item discount', 'Manager approval', 'Other'],
    no_action: ['Manager override', 'Payment already processed separately', 'Other']
  };

  // Icons for different payment actions (for improved visual indicators)
  const actionIcons = {
    refund: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
    store_credit: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    adjust_total: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    no_action: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  };

  // Icons for inventory actions
  const inventoryIcons = {
    return_to_inventory: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    mark_as_damaged: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (reasonDropdownRef.current && !reasonDropdownRef.current.contains(event.target as Node)) {
        setIsReasonDropdownOpen(false);
      }
      if (inventoryReasonDropdownRef.current && !inventoryReasonDropdownRef.current.contains(event.target as Node)) {
        setIsInventoryReasonDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Get the final inventory reason if needed
    let finalInventoryReason = '';
    if (item.enable_stock_tracking && inventoryAction === 'mark_as_damaged') {
      finalInventoryReason = inventoryReason === 'other' ? otherInventoryReason : inventoryReason;
      
      // Save custom reason if checkbox is checked
      if (inventoryReason === 'other' && 
          (document.getElementById('saveInventoryReason') as HTMLInputElement)?.checked && 
          otherInventoryReason.trim() !== '') {
        setInventoryReasonOptions(prev => [
          ...prev.filter(opt => opt !== 'other'),
          otherInventoryReason,
          'other'
        ]);
      }
    }
    
    // Pass the action, reason, amount, and inventory info back to the parent component
    onAction(
      selectedAction, 
      reason, 
      itemTotal, 
      item.enable_stock_tracking ? inventoryAction : undefined,
      finalInventoryReason || undefined
    );
  };

  return (
      <div className="fixed inset-0 z-[99999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header with icon */}
            <div className="sm:flex sm:items-start mb-4">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {isPartialQuantity ? 'Quantity Reduction' : 'Item Removal'}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {isPartialQuantity ? (
                      // Partial quantity reduction
                      <>You've reduced the quantity of <span className="font-medium">{item.name}</span> by {item.quantity} 
                      (${itemTotal.toFixed(2)}). How would you like to handle the payment for the removed items?</>
                    ) : (
                      // Complete item removal (original message)
                      <>You've removed <span className="font-medium">{item.name}</span> (${itemTotal.toFixed(2)}) from this order.
                      How would you like to handle the payment?</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Summary card with amount */}
            <div className="bg-gray-50 p-4 rounded-lg mb-5 border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">Amount:</span>
                <span className="text-lg font-bold text-green-600">${itemTotal.toFixed(2)}</span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="mt-5">
              <div className="mb-5">
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Payment Action
                </label>
                <div className="mt-1 space-y-3">
                  {/* Refund option */}
                  <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedAction('refund')}>
                    <div className="flex items-center h-5">
                      <input
                        id="refund"
                        name="payment_action"
                        type="radio"
                        checked={selectedAction === 'refund'}
                        onChange={() => setSelectedAction('refund')}
                        className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 flex items-center">
                      <div className="mr-3">{actionIcons.refund}</div>
                      <div>
                        <label htmlFor="refund" className="font-medium text-gray-700">
                          Refund to customer
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Money will be returned to the customer's original payment method
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Store credit option */}
                  <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedAction('store_credit')}>
                    <div className="flex items-center h-5">
                      <input
                        id="store_credit"
                        name="payment_action"
                        type="radio"
                        checked={selectedAction === 'store_credit'}
                        onChange={() => setSelectedAction('store_credit')}
                        className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 flex items-center">
                      <div className="mr-3">{actionIcons.store_credit}</div>
                      <div>
                        <label htmlFor="store_credit" className="font-medium text-gray-700">
                          Add as store credit
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Customer can use this amount on a future purchase
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Adjust total option */}
                  <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedAction('adjust_total')}>
                    <div className="flex items-center h-5">
                      <input
                        id="adjust_total"
                        name="payment_action"
                        type="radio"
                        checked={selectedAction === 'adjust_total'}
                        onChange={() => setSelectedAction('adjust_total')}
                        className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 flex items-center">
                      <div className="mr-3">{actionIcons.adjust_total}</div>
                      <div>
                        <label htmlFor="adjust_total" className="font-medium text-gray-700">
                          Adjust order total only
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Total will be reduced but no refund will be processed
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* No action option */}
                  <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => setSelectedAction('no_action')}>
                    <div className="flex items-center h-5">
                      <input
                        id="no_action"
                        name="payment_action"
                        type="radio"
                        checked={selectedAction === 'no_action'}
                        onChange={() => setSelectedAction('no_action')}
                        className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 flex items-center">
                      <div className="mr-3">{actionIcons.no_action}</div>
                      <div>
                        <label htmlFor="no_action" className="font-medium text-gray-700">
                          Don't adjust payment
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          No change to payment (e.g., if already handled outside the system)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-5" ref={reasonDropdownRef}>
                <label className="block text-base font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <div className="relative mt-1">
                  {/* Custom dropdown button */}
                  <button
                    type="button"
                    onClick={() => setIsReasonDropdownOpen(!isReasonDropdownOpen)}
                    className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }} // Prevent iOS zoom
                  >
                    <span className={`${!reason ? 'text-gray-400' : 'text-gray-900'}`}>
                      {reason || 'Select a reason'}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Dropdown menu */}
                  {isReasonDropdownOpen && (
                    <div className="absolute z-[999999] mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
                      <ul className="py-1">
                        {reasonOptions[selectedAction].map((option) => (
                          <li 
                            key={option}
                            className={`cursor-pointer px-4 py-2 hover:bg-gray-100 ${reason === option ? 'bg-gray-100' : ''}`}
                            onClick={() => {
                              setReason(option);
                              setIsReasonDropdownOpen(false);
                            }}
                          >
                            {option}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {reason === 'Other' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Please specify reason"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-base py-3 border-gray-300 rounded-md"
                      style={{ fontSize: '16px' }} // Prevent iOS zoom
                      onChange={(e) => setReason(e.target.value !== 'Other' ? e.target.value : 'Other')}
                    />
                  </div>
                )}
              </div>
              
              {/* Inventory section - only show if item has stock tracking */}
              {item.enable_stock_tracking && (
                <>
                  <hr className="my-6" />
                  
                  <div className="mb-5">
                    <label className="block text-base font-medium text-gray-700 mb-3">
                      Inventory Action
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      What should happen to the {isPartialQuantity ? 'removed' : ''} items in inventory?
                    </p>
                    
                    <div className="mt-1 space-y-3">
                      {/* Return to inventory option */}
                      <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" 
                           onClick={() => setInventoryAction('return_to_inventory')}>
                        <div className="flex items-center h-5">
                          <input
                            id="return_to_inventory"
                            name="inventory_action"
                            type="radio"
                            checked={inventoryAction === 'return_to_inventory'}
                            onChange={() => setInventoryAction('return_to_inventory')}
                            className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                          />
                        </div>
                        <div className="ml-3 flex items-center">
                          <div className="mr-3">{inventoryIcons.return_to_inventory}</div>
                          <div>
                            <label htmlFor="return_to_inventory" className="font-medium text-gray-700">
                              Return to inventory
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                              Items will be added back to available stock
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Mark as damaged option */}
                      <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" 
                           onClick={() => setInventoryAction('mark_as_damaged')}>
                        <div className="flex items-center h-5">
                          <input
                            id="mark_as_damaged"
                            name="inventory_action"
                            type="radio"
                            checked={inventoryAction === 'mark_as_damaged'}
                            onChange={() => setInventoryAction('mark_as_damaged')}
                            className="focus:ring-blue-500 h-5 w-5 text-blue-600 border-gray-300"
                          />
                        </div>
                        <div className="ml-3 flex items-center">
                          <div className="mr-3">{inventoryIcons.mark_as_damaged}</div>
                          <div>
                            <label htmlFor="mark_as_damaged" className="font-medium text-gray-700">
                              Mark as damaged
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                              Items will be counted in damaged inventory
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reason dropdown - only show if 'mark_as_damaged' is selected */}
                  {inventoryAction === 'mark_as_damaged' && (
                    <div className="mb-5" ref={inventoryReasonDropdownRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Damage Reason
                      </label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setIsInventoryReasonDropdownOpen(!isInventoryReasonDropdownOpen)}
                          className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <span className={`${!inventoryReason ? 'text-gray-400' : 'text-gray-900'}`}>
                            {inventoryReason || 'Select a reason'}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {isInventoryReasonDropdownOpen && (
                          <div className="absolute z-[999999] mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
                            <ul className="py-1">
                              {inventoryReasonOptions.map((option) => (
                                <li
                                  key={option}
                                  className={`cursor-pointer px-4 py-2 hover:bg-gray-100 ${inventoryReason === option ? 'bg-gray-100' : ''}`}
                                  onClick={() => {
                                    setInventoryReason(option);
                                    setIsInventoryReasonDropdownOpen(false);
                                  }}
                                >
                                  {option === 'other' ? 'Other (specify)' : option.charAt(0).toUpperCase() + option.slice(1)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {inventoryReason === 'other' && (
                        <div className="mt-3">
                          <input
                            type="text"
                            placeholder="Please specify reason"
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-base py-3 border-gray-300 rounded-md"
                            style={{ fontSize: '16px' }}
                            value={otherInventoryReason}
                            onChange={(e) => setOtherInventoryReason(e.target.value)}
                          />
                          
                          <div className="mt-2 flex items-center">
                            <input
                              type="checkbox"
                              id="saveInventoryReason"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="saveInventoryReason" className="ml-2 block text-sm text-gray-700">
                              Save this reason for future use
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              
              <div className="mt-6 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="submit"
                  disabled={isProcessing || !reason || (item.enable_stock_tracking && inventoryAction === 'mark_as_damaged' && !inventoryReason)}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-3 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:col-start-2 sm:text-sm ${
                    isProcessing || !reason || (item.enable_stock_tracking && inventoryAction === 'mark_as_damaged' && !inventoryReason)
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-3 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
