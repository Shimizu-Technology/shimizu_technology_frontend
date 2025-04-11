// src/ordering/components/admin/RefundModal.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';

interface RefundItem {
  id: number;
  name: string;
  quantity: number;  // Quantity being refunded
  price: number;
  originalQuantity?: number; // Original quantity in the order
  enable_stock_tracking?: boolean; // Whether this item has inventory tracking
}

interface InventoryAction {
  itemId: number;
  quantity: number;
  action: 'return_to_inventory' | 'mark_as_damaged';
  reason?: string;
}

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  maxRefundable: number;
  orderItems?: any[]; // Original order items with refund status
  onRefundCreated: (refundedItems: RefundItem[], inventoryActions: InventoryAction[]) => void;
  preSelectedItem?: {
    id: number | string;
    quantity: number;
  } | null;
}

// Valid Stripe refund reasons
type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';

export function RefundModal({
  isOpen,
  onClose,
  orderId,
  maxRefundable,
  orderItems = [],
  onRefundCreated,
  preSelectedItem,
}: RefundModalProps) {
  const [amount, setAmount] = useState<string>(maxRefundable.toFixed(2));
  const [reason, setReason] = useState<RefundReason>('requested_by_customer');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<RefundItem[]>([]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [amountChangeHighlight, setAmountChangeHighlight] = useState<boolean>(false);
  
  // Inventory handling state
  const [inventoryActions, setInventoryActions] = useState<Record<number, {
    action: 'return_to_inventory' | 'mark_as_damaged';
    reason?: string;
    quantity: number;
  }>>({});
  
  // For damaged item reasons
  const [damageReasons, setDamageReasons] = useState<Record<number, string>>({});
  const [showInventorySection, setShowInventorySection] = useState<boolean>(false);

  // Get refundable items (not fully refunded) using useMemo to avoid recalculation on every render
  const refundableItems = useMemo(() => {
    return orderItems.filter(item => !item.isFullyRefunded);
  }, [orderItems]);

  // Define an interface for order items
  interface OrderItemWithRefund {
    id: number;
    name: string;
    quantity: number;
    price: number;
    isFullyRefunded?: boolean;
    isPartiallyRefunded?: boolean;
    refundedQuantity?: number;
    [key: string]: any; // Allow other properties
  }

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (refundableItems.length > 0) {
        const initialQuantities: Record<number, number> = {};
        refundableItems.forEach((item: OrderItemWithRefund) => {
          // For partially refunded items, only show the non-refunded quantity
          const availableQuantity = item.isPartiallyRefunded 
            ? item.quantity - (item.refundedQuantity || 0)
            : item.quantity;
          
          initialQuantities[item.id] = availableQuantity;
        });
        setItemQuantities(initialQuantities);
      }
      
      // Reset other state when modal opens
      setSelectedItems([]);
      setSelectAll(false);
      setAmount(maxRefundable.toFixed(2));
      setIsManuallyEdited(false);
      setCalculatedAmount(0);
      setError(null);
      setInventoryActions({});
      setDamageReasons({});
      
      // Check if we have any items with inventory tracking
      const hasInventoryItems = refundableItems.some(item => item.enable_stock_tracking);
      setShowInventorySection(hasInventoryItems);
      
      // If we have a pre-selected item, select it
      if (preSelectedItem) {
        const itemToSelect = refundableItems.find(item => 
          String(item.id) === String(preSelectedItem.id)
        );
        
        if (itemToSelect) {
          // Default to the quantity provided in preSelectedItem (or max available if less)
          const availableQuantity = itemToSelect.isPartiallyRefunded 
            ? itemToSelect.quantity - (itemToSelect.refundedQuantity || 0)
            : itemToSelect.quantity;
          
          const selectQuantity = Math.min(preSelectedItem.quantity, availableQuantity);
          
          // Add to selected items
          const newItem = {
            id: itemToSelect.id,
            name: itemToSelect.name,
            quantity: selectQuantity,
            price: itemToSelect.price,
            originalQuantity: itemToSelect.quantity,
            enable_stock_tracking: itemToSelect.enable_stock_tracking
          };
          
          setSelectedItems([newItem]);
          setItemQuantities(prev => ({
            ...prev,
            [itemToSelect.id]: selectQuantity
          }));
          
          // Update amount
          const itemAmount = selectQuantity * itemToSelect.price;
          setCalculatedAmount(itemAmount);
          setAmount(itemAmount.toFixed(2));
        }
      }
    }
  }, [isOpen, refundableItems, maxRefundable, preSelectedItem]);

  if (!isOpen) return null;

  // Calculate total refund amount based on selected items and their quantities
  const calculateRefundAmount = (items: RefundItem[]): number => {
    return items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  // Update the amount when selected items change
  const updateAmountFromSelectedItems = (items: RefundItem[]) => {
    const newCalculatedAmount = calculateRefundAmount(items);
    setCalculatedAmount(newCalculatedAmount);
    
    // Only update the amount field if it hasn't been manually edited
    if (!isManuallyEdited) {
      setAmount(newCalculatedAmount.toFixed(2));
      // Highlight the amount change
      setAmountChangeHighlight(true);
      setTimeout(() => setAmountChangeHighlight(false), 500);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow valid numbers
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
      setIsManuallyEdited(true);
    }
  };

  // Handle select all checkbox
  const handleSelectAll = (isSelected: boolean) => {
    setSelectAll(isSelected);
    
    if (isSelected) {
      // Select all refundable items with their current quantities
      const allItems = refundableItems.map((item: OrderItemWithRefund) => ({
        id: item.id,
        name: item.name,
        quantity: itemQuantities[item.id] || 
          (item.isPartiallyRefunded ? item.quantity - (item.refundedQuantity || 0) : item.quantity),
        price: item.price,
        originalQuantity: item.quantity
      }));
      setSelectedItems(allItems);
      updateAmountFromSelectedItems(allItems);
    } else {
      // Deselect all items
      setSelectedItems([]);
      updateAmountFromSelectedItems([]);
    }
  };

  // Handle individual item selection
  const handleItemSelect = (item: OrderItemWithRefund, isSelected: boolean) => {
    let updatedItems: RefundItem[];
    
    if (isSelected) {
      // Add item to selected items with current quantity
      const newItem = {
        id: item.id,
        name: item.name,
        quantity: itemQuantities[item.id] || item.quantity,
        price: item.price,
        originalQuantity: item.quantity
      };
      updatedItems = [...selectedItems, newItem];
    } else {
      // Remove item from selected items
      updatedItems = selectedItems.filter(i => i.id !== item.id);
      
      // Update select all state
      if (selectAll) {
        setSelectAll(false);
      }
    }
    
    setSelectedItems(updatedItems);
    updateAmountFromSelectedItems(updatedItems);
  };

  // Handle quantity change for an item
  const handleQuantityChange = (itemId: number, newQuantity: number, item: OrderItemWithRefund) => {
    // Ensure quantity is within valid range
    const availableQuantity = item.isPartiallyRefunded 
      ? item.quantity - (item.refundedQuantity || 0) 
      : item.quantity;
    
    newQuantity = Math.max(1, Math.min(newQuantity, availableQuantity));
    
    // Update quantities state
    setItemQuantities({
      ...itemQuantities,
      [itemId]: newQuantity
    });
    
    // If this item is selected, update its quantity in selectedItems
    const updatedItems = selectedItems.map(selectedItem => {
      if (selectedItem.id === itemId) {
        return {
          ...selectedItem,
          quantity: newQuantity
        };
      }
      return selectedItem;
    });
    
    setSelectedItems(updatedItems);
    updateAmountFromSelectedItems(updatedItems);
  };

  // Check if an item is selected
  const isItemSelected = (itemId: number): boolean => {
    return selectedItems.some(item => item.id === itemId);
  };

  // Update inventory actions when selected items change
  useEffect(() => {
    // Remove inventory actions for items that are no longer selected
    const updatedInventoryActions = { ...inventoryActions };
    
    // Check which items are no longer selected
    Object.keys(updatedInventoryActions).forEach(itemIdStr => {
      const itemId = parseInt(itemIdStr, 10);
      if (!selectedItems.some(item => item.id === itemId)) {
        delete updatedInventoryActions[itemId];
      }
    });
    
    // Add default inventory actions for newly selected items with inventory tracking
    selectedItems.forEach(item => {
      if (item.enable_stock_tracking && !updatedInventoryActions[item.id]) {
        updatedInventoryActions[item.id] = {
          action: 'return_to_inventory', // Default action
          quantity: item.quantity
        };
      }
    });
    
    setInventoryActions(updatedInventoryActions);
  }, [selectedItems]);

  // Update inventory action quantities when item quantities change
  useEffect(() => {
    const updatedInventoryActions = { ...inventoryActions };
    
    // Update quantities for all inventory actions
    Object.keys(updatedInventoryActions).forEach(itemIdStr => {
      const itemId = parseInt(itemIdStr, 10);
      const selectedItem = selectedItems.find(item => item.id === itemId);
      
      if (selectedItem) {
        updatedInventoryActions[itemId] = {
          ...updatedInventoryActions[itemId],
          quantity: selectedItem.quantity
        };
      }
    });
    
    setInventoryActions(updatedInventoryActions);
  }, [itemQuantities, selectedItems]);

  const handleInventoryActionChange = (itemId: number, action: 'return_to_inventory' | 'mark_as_damaged') => {
    setInventoryActions(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        action,
        // Clear reason if switching to return_to_inventory
        reason: action === 'return_to_inventory' ? undefined : prev[itemId]?.reason
      }
    }));
  };

  const handleDamageReasonChange = (itemId: number, reason: string) => {
    setDamageReasons(prev => ({
      ...prev,
      [itemId]: reason
    }));
    
    setInventoryActions(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        reason
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate item selection
    if (selectedItems.length === 0) {
      setError('Please select at least one item to refund');
      return;
    }

    // Validate amount
    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    if (refundAmount > maxRefundable) {
      setError(`Refund amount cannot exceed $${maxRefundable.toFixed(2)}`);
      return;
    }

    // Validate inventory actions
    const inventoryItemsWithoutReason = Object.entries(inventoryActions)
      .filter(([_, action]) => action.action === 'mark_as_damaged' && !action.reason)
      .map(([itemId]) => {
        const item = selectedItems.find(item => item.id === parseInt(itemId, 10));
        return item?.name || `Item #${itemId}`;
      });

    if (inventoryItemsWithoutReason.length > 0) {
      setError(`Please provide damage reasons for: ${inventoryItemsWithoutReason.join(', ')}`);
      return;
    }

    // Warn if manual amount doesn't match calculated amount (if items are selected)
    if (isManuallyEdited && Math.abs(refundAmount - calculatedAmount) > 0.01 && selectedItems.length > 0) {
      const confirmOverride = window.confirm(
        `The refund amount ($${refundAmount.toFixed(2)}) doesn't match the calculated amount from selected items ($${calculatedAmount.toFixed(2)}). Do you want to proceed with the manual amount?`
      );
      if (!confirmOverride) {
        return;
      }
    }

    // Process refund
    setIsProcessing(true);
    try {
      // Enhanced logging for debugging inventory actions
      const inventoryActionsForAPI = Object.entries(inventoryActions).map(([itemId, action]) => {
        const selectedItem = selectedItems.find(item => item.id === parseInt(itemId, 10));
        return {
          item_id: parseInt(itemId, 10),
          item_name: selectedItem?.name || 'Unknown',
          action: action.action,
          reason: action.reason,
          quantity: selectedItem?.quantity || 1 // Ensure quantity is explicitly set from the selected item
        };
      });
      
      // Inventory actions are now sent to the API
      
      await orderPaymentsApi.createRefund(orderId, {
        amount: refundAmount,
        reason: reason,
        description: customReason || undefined,
        refunded_items: selectedItems,
        inventory_actions: inventoryActionsForAPI
      });

      // Convert inventory actions to array format for the callback
      const inventoryActionsArray: InventoryAction[] = Object.entries(inventoryActions).map(
        ([itemId, action]) => ({
          itemId: parseInt(itemId, 10),
          quantity: action.quantity,
          action: action.action,
          reason: action.reason
        })
      );

      // Notify parent component with both refunded items and inventory actions
      onRefundCreated(selectedItems, inventoryActionsArray);
      
      // Close modal
      onClose();
    } catch (err) {
      console.error('Refund error:', err);
      setError('Failed to process refund. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-headline"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-headline">
                  Process Refund
                </h3>
                <div className="mt-4">
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <div className="flex justify-between items-center">
                        <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-1">
                          Refund Amount
                        </label>
                        {isManuallyEdited && selectedItems.length > 0 && (
                          <span className="text-xs text-orange-500">
                            Manual override
                          </span>
                        )}
                      </div>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="text"
                          id="refund-amount"
                          className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md transition-colors duration-300 ${
                            amountChangeHighlight ? 'bg-yellow-50' : ''
                          }`}
                          placeholder="0.00"
                          value={amount}
                          onChange={handleAmountChange}
                          aria-describedby="refund-amount-description"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm" id="refund-amount-description">
                            USD
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-sm text-gray-500">
                          Maximum refundable amount: ${maxRefundable.toFixed(2)}
                        </p>
                        {selectedItems.length > 0 && (
                          <p className="text-sm text-gray-500">
                            Selected items total: ${calculatedAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Items being refunded */}
                    {refundableItems && refundableItems.length > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Select Items Being Refunded
                          </label>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="select-all"
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              checked={selectAll}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            <label htmlFor="select-all" className="ml-2 block text-sm text-gray-700">
                              Select All
                            </label>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                          {refundableItems.map((item: OrderItemWithRefund, idx: number) => (
                            <div 
                              key={idx} 
                              className={`flex items-center justify-between mb-2 last:mb-0 p-1 rounded ${
                                isItemSelected(item.id) ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`item-${idx}`}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                  checked={isItemSelected(item.id)}
                                  onChange={(e) => handleItemSelect(item, e.target.checked)}
                                />
                                <label htmlFor={`item-${idx}`} className="ml-2 block text-sm text-gray-900">
                                  {item.name} (${item.price.toFixed(2)} each)
                                </label>
                              </div>
                              
                              {/* Quantity controls */}
                              {isItemSelected(item.id) && (
                                <div className="flex flex-col">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                      onClick={() => handleQuantityChange(item.id, (itemQuantities[item.id] || item.quantity) - 1, item)}
                                      disabled={(itemQuantities[item.id] || item.quantity) <= 1}
                                    >
                                      -
                                    </button>
                                    <span className="text-sm font-medium">
                                      {itemQuantities[item.id] || 
                                        (item.isPartiallyRefunded 
                                          ? item.quantity - (item.refundedQuantity || 0) 
                                          : item.quantity)}
                                    </span>
                                    <button
                                      type="button"
                                      className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                      onClick={() => handleQuantityChange(item.id, (itemQuantities[item.id] || item.quantity) + 1, item)}
                                      disabled={(itemQuantities[item.id] || item.quantity) >= 
                                        (item.isPartiallyRefunded 
                                          ? item.quantity - (item.refundedQuantity || 0) 
                                          : item.quantity)}
                                    >
                                      +
                                    </button>
                                  </div>
                                  
                                  {/* Quantity details */}
                                  <div className="mt-1 text-xs text-gray-500">
                                    {item.isPartiallyRefunded ? (
                                      <div className="flex flex-col">
                                        <span>Original: {item.quantity + (item.refundedQuantity || 0)}</span>
                                        <span className="text-red-500">Already refunded: {item.refundedQuantity}</span>
                                        <span className="text-green-500">Available: {item.quantity - (item.refundedQuantity || 0)}</span>
                                      </div>
                                    ) : (
                                      <span>Total quantity: {item.quantity}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Selecting items helps track what was refunded
                        </p>
                      </div>
                    )}
                    
                    {(!refundableItems || refundableItems.length === 0) && (
                      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md text-center">
                        <p className="text-gray-600">
                          No items available for refund. All items have been fully refunded.
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Refund
                      </label>
                      <select
                        id="refund-reason"
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        value={reason}
                        onChange={(e) => setReason(e.target.value as RefundReason)}
                      >
                        <option value="requested_by_customer">Customer requested refund</option>
                        <option value="duplicate">Duplicate charge</option>
                        <option value="fraudulent">Fraudulent charge</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        These are the only valid reasons accepted by Stripe for refunds.
                      </p>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        id="custom-reason"
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        rows={2}
                        placeholder="Add more details about this refund"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                      />
                    </div>

                    {/* Inventory Section - only show if there are items with inventory tracking */}
                    {showInventorySection && selectedItems.some(item => item.enable_stock_tracking) && (
                      <div className="mb-4 border-t border-gray-200 pt-4 mt-4">
                        <h4 className="text-base font-medium text-gray-900 mb-3">
                          Inventory Handling
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          The following items have inventory tracking. Please specify what should happen to each item.
                        </p>
                        
                        <div className="space-y-4">
                          {selectedItems
                            .filter(item => item.enable_stock_tracking)
                            .map((item, idx) => (
                              <div key={`inventory-${item.id}`} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h5 className="font-medium text-gray-900">{item.name}</h5>
                                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                                  </div>
                                </div>
                                
                                <div className="mt-2">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Action
                                  </label>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleInventoryActionChange(item.id, 'return_to_inventory')}
                                      className={`px-4 py-2 rounded-md text-sm font-medium flex-1 ${
                                        inventoryActions[item.id]?.action === 'return_to_inventory'
                                          ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    >
                                      Return to Inventory
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleInventoryActionChange(item.id, 'mark_as_damaged')}
                                      className={`px-4 py-2 rounded-md text-sm font-medium flex-1 ${
                                        inventoryActions[item.id]?.action === 'mark_as_damaged'
                                          ? 'bg-red-100 text-red-800 border-2 border-red-300'
                                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                      }`}
                                    >
                                      Mark as Damaged
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Reason field for damaged items */}
                                {inventoryActions[item.id]?.action === 'mark_as_damaged' && (
                                  <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Reason (Required)
                                    </label>
                                    <input
                                      type="text"
                                      value={damageReasons[item.id] || ''}
                                      onChange={(e) => handleDamageReasonChange(item.id, e.target.value)}
                                      placeholder="Why is this item damaged?"
                                      className="border border-gray-300 rounded-md px-3 py-2 w-full text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                      <button
                        type="submit"
                        disabled={isProcessing || selectedItems.length === 0}
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm ${
                          isProcessing || selectedItems.length === 0 ? 'opacity-75 cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing ? 'Processing...' : 'Process Refund'}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
