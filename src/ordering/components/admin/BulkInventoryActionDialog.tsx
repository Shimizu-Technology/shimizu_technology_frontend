// src/ordering/componenets/admin/BulkInventoryActionDialog.tsx
import React, { useState, useEffect, useRef } from 'react';
import { menuItemsApi } from '../../../shared/api/endpoints/menuItems';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';

interface OrderItem {
  id?: string | number | null;
  name: string;
  quantity: number;
  price?: number;
  enable_stock_tracking?: boolean;
  orderId?: string | number; // Order ID this item belongs to
}

export type PaymentAction = 'refund' | 'store_credit' | 'adjust_total' | 'no_action';

interface InventoryAction {
  itemId: string | number;
  uniqueId: string; // Track each unique instance of an item
  quantity: number;
  action: 'return_to_inventory' | 'mark_as_damaged';
  reason?: string;
  orderId?: string | number; // Track which order this item belongs to
  // Payment-related fields
  paymentAction?: PaymentAction;
  paymentReason?: string;
}

interface OrderPaymentInfo {
  orderId: string | number;
  total: number;
  previouslyRefunded: number;
  refundableAmount: number;
  paymentMethod?: string;
  contactEmail?: string;
}

interface BulkInventoryActionDialogProps {
  order: any; // The order or orders being canceled
  onClose: () => void;
  onConfirm: (inventoryActions: InventoryAction[]) => void;
  isBatch?: boolean; // Whether this is for a batch of orders or single order
}

export function BulkInventoryActionDialog({
  order,
  onClose,
  onConfirm,
  isBatch = false
}: BulkInventoryActionDialogProps) {
  // State to track actions for each inventory item
  const [inventoryActions, setInventoryActions] = useState<InventoryAction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment-related state
  const [orderPaymentInfo, setOrderPaymentInfo] = useState<OrderPaymentInfo[]>([]);
  const [selectedPaymentAction, setSelectedPaymentAction] = useState<PaymentAction>('refund');
  const [paymentReason, setPaymentReason] = useState('');
  const [customPaymentReason, setCustomPaymentReason] = useState('');
  const [isOtherReasonSelected, setIsOtherReasonSelected] = useState(false);
  const [isPaymentReasonDropdownOpen, setIsPaymentReasonDropdownOpen] = useState(false);
  
  // Refs for detecting outside clicks
  const paymentReasonDropdownRef = useRef<HTMLDivElement>(null);
  
  // Reason options based on selected action
  const reasonOptions = {
    refund: ['Customer request', 'Item unavailable', 'Item made incorrectly', 'Other'],
    store_credit: ['Customer preference', 'Loyalty bonus', 'Other'],
    adjust_total: ['Multi-item discount', 'Manager approval', 'Other'],
    no_action: ['Manager override', 'Payment already processed separately', 'Other']
  };

  // Icons for different payment actions
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

  // Process orders and find items with inventory tracking
  useEffect(() => {
    const findInventoryItems = async () => {
      setLoading(true);
      try {
        // Handle the case of a single order or multiple orders
        const orders = isBatch ? order : [order];
        const allItems: OrderItem[] = [];
        const paymentInfoList: OrderPaymentInfo[] = [];

        // Extract all items from all orders
        for (const currentOrder of orders) {
          if (currentOrder.items && currentOrder.items.length > 0) {
            // For each item in the order, get full item details including inventory tracking
            const itemsWithDetails = await Promise.all(
              currentOrder.items.map(async (item: OrderItem) => {
                if (!item.id) return null;
                
                try {
                  // Get full menu item details
                  const fullItem = await menuItemsApi.getById(item.id);
                  
                  // Return if item has inventory tracking
                  if (fullItem.enable_stock_tracking) {
                    return {
                      ...item,
                      enable_stock_tracking: fullItem.enable_stock_tracking,
                      // Use the item quantity from the order
                      quantity: item.quantity,
                      // Store the order ID this item belongs to
                      orderId: currentOrder.id,
                      // Include price for payment calculations
                      price: item.price || fullItem.price || 0
                    };
                  }
                } catch (error) {
                  console.error(`Failed to fetch item ${item.id}:`, error);
                }
                return null;
              })
            );

            // Filter out null items (no inventory tracking) and add to our collection
            const validItems = itemsWithDetails.filter((item): item is OrderItem => 
              item !== null && item.enable_stock_tracking === true
            );
            
            allItems.push(...validItems);
          }
          
          // Get payment information for this order
          try {
            const paymentResponse = await orderPaymentsApi.getPayments(currentOrder.id);
            const { total_paid = 0, total_refunded = 0 } = paymentResponse.data;
            
            paymentInfoList.push({
              orderId: currentOrder.id,
              total: parseFloat(currentOrder.total || '0'),
              previouslyRefunded: total_refunded,
              refundableAmount: Math.max(0, total_paid - total_refunded),
              paymentMethod: currentOrder.payment_method,
              contactEmail: currentOrder.contact_email
            });
          } catch (error) {
            console.error(`Failed to fetch payment info for order ${currentOrder.id}:`, error);
            // Fallback if API fails
            paymentInfoList.push({
              orderId: currentOrder.id,
              total: parseFloat(currentOrder.total || '0'),
              previouslyRefunded: 0,
              refundableAmount: parseFloat(currentOrder.total || '0'),
              paymentMethod: currentOrder.payment_method,
              contactEmail: currentOrder.contact_email
            });
          }
        }

        // Initialize inventory actions for each item
        const initialActions = allItems.map((item, index) => ({
          itemId: item.id!,
          uniqueId: `${item.id}-${item.orderId}-${index}`, // Create unique identifier for each item
          quantity: item.quantity,
          action: 'return_to_inventory' as const,
          reason: '',
          orderId: item.orderId, // Include the order ID in the action
          paymentAction: 'refund' as const, // Default payment action
          paymentReason: ''
        }));

        setInventoryItems(allItems);
        setInventoryActions(initialActions);
        setOrderPaymentInfo(paymentInfoList);
      } catch (error) {
        console.error('Error fetching inventory items:', error);
      } finally {
        setLoading(false);
      }
    };

    findInventoryItems();
  }, [order, isBatch]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (paymentReasonDropdownRef.current && !paymentReasonDropdownRef.current.contains(event.target as Node)) {
        setIsPaymentReasonDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle action change for an item
  const handleActionChange = (uniqueId: string, action: 'return_to_inventory' | 'mark_as_damaged') => {
    setInventoryActions(prev => 
      prev.map(item => 
        item.uniqueId === uniqueId 
          ? { ...item, action, reason: action === 'return_to_inventory' ? '' : item.reason } 
          : item
      )
    );
  };

  // Handle reason change for damaged items
  const handleReasonChange = (uniqueId: string, reason: string) => {
    setInventoryActions(prev => 
      prev.map(item => 
        item.uniqueId === uniqueId 
          ? { ...item, reason } 
          : item
      )
    );
  };

  // Handle payment action change
  const handlePaymentActionChange = (action: PaymentAction) => {
    setSelectedPaymentAction(action);
    
    // Update all inventory actions with the new payment action
    setInventoryActions(prev => 
      prev.map(item => ({ ...item, paymentAction: action }))
    );
  };

  // Handle payment reason change from dropdown
  const handlePaymentReasonChange = (reason: string) => {
    setPaymentReason(reason);
    
    // If "Other" is selected, set the flag and clear custom reason
    if (reason === 'Other') {
      setIsOtherReasonSelected(true);
      setCustomPaymentReason('');
    } else {
      setIsOtherReasonSelected(false);
      setCustomPaymentReason('');
      
      // Update all inventory actions with the new payment reason
      setInventoryActions(prev => 
        prev.map(item => ({ ...item, paymentReason: reason }))
      );
    }
  };
  
  // Handle custom payment reason input
  const handleCustomPaymentReasonChange = (customReason: string) => {
    setCustomPaymentReason(customReason);
    
    // Update all inventory actions with the custom reason
    setInventoryActions(prev => 
      prev.map(item => ({ ...item, paymentReason: customReason }))
    );
  };

  // Calculate total refundable amount across all orders
  const calculateTotalRefundable = () => {
    return orderPaymentInfo.reduce((sum, info) => sum + info.refundableAmount, 0);
  };

  // Calculate total order value across all orders
  const calculateTotalOrderValue = () => {
    return orderPaymentInfo.reduce((sum, info) => sum + info.total, 0);
  };

  // Process all items and confirm
  const handleConfirm = () => {
    // Make sure all required fields are filled
    const isValid = inventoryActions.every(action => {
      if (action.action === 'mark_as_damaged' && !action.reason) {
        return false;
      }
      return true;
    });

    if (!isValid) {
      alert('Please provide reasons for all damaged items.');
      return;
    }

    if (selectedPaymentAction !== 'no_action') {
      if (isOtherReasonSelected && !customPaymentReason) {
        alert('Please specify a reason.');
        return;
      } else if (!isOtherReasonSelected && !paymentReason) {
        alert('Please select a payment reason.');
        return;
      }
    }

    // Update all inventory actions with the final payment information
    const finalActions = inventoryActions.map(action => ({
      ...action,
      paymentAction: selectedPaymentAction,
      paymentReason: isOtherReasonSelected ? customPaymentReason : paymentReason
    }));

    onConfirm(finalActions);
  };

  // If no inventory items, we still need to handle payment actions
  useEffect(() => {
    if (!loading && inventoryItems.length === 0) {
      // Instead of closing, just skip to payment handling
      setInventoryActions([{
        itemId: 0, // Placeholder
        uniqueId: 'order-payment-only',
        quantity: 0,
        action: 'return_to_inventory',
        orderId: isBatch ? (order[0]?.id || 0) : (order?.id || 0),
        paymentAction: 'refund',
        paymentReason: ''
      }]);
    }
  }, [loading, inventoryItems, isBatch, order]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 animate-fadeIn">
          <div className="flex justify-center items-center h-32">
            <svg className="animate-spin h-8 w-8 text-[#c1902f]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-center text-gray-600">Checking inventory items...</p>
        </div>
      </div>
    );
  }

  // We still want to show the dialog even if there are no inventory items
  // so the user can handle payment actions

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">
              {isBatch 
                ? 'Manage Inventory & Payment for Cancelled Orders' 
                : 'Manage Inventory & Payment for Cancelled Order'
              }
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {inventoryItems.length > 0 
              ? 'The following items have inventory tracking. Please specify what should happen to each item.'
              : 'Please specify how you would like to handle payment for this cancellation.'}
          </p>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Payment section */}
          <div className="p-6 border-b border-gray-200">
            <h4 className="text-base font-medium text-gray-900 mb-4">
              Payment Handling
            </h4>
            
            {/* Payment summary */}
            <div className="bg-gray-50 p-4 rounded-lg mb-5 border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-900">Total Order Value:</span>
                <span className="text-base font-bold text-gray-900">${calculateTotalOrderValue().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">Refundable Amount:</span>
                <span className="text-base font-bold text-green-600">${calculateTotalRefundable().toFixed(2)}</span>
              </div>
            </div>
            
            {/* Payment action options */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Action
              </label>
              <div className="mt-1 space-y-3">
                {/* Refund option */}
                <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handlePaymentActionChange('refund')}>
                  <div className="flex items-center h-5">
                    <input
                      id="refund"
                      name="payment_action"
                      type="radio"
                      checked={selectedPaymentAction === 'refund'}
                      onChange={() => handlePaymentActionChange('refund')}
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
                <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handlePaymentActionChange('store_credit')}>
                  <div className="flex items-center h-5">
                    <input
                      id="store_credit"
                      name="payment_action"
                      type="radio"
                      checked={selectedPaymentAction === 'store_credit'}
                      onChange={() => handlePaymentActionChange('store_credit')}
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
                <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handlePaymentActionChange('adjust_total')}>
                  <div className="flex items-center h-5">
                    <input
                      id="adjust_total"
                      name="payment_action"
                      type="radio"
                      checked={selectedPaymentAction === 'adjust_total'}
                      onChange={() => handlePaymentActionChange('adjust_total')}
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
                <div className="flex items-start p-3 border rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => handlePaymentActionChange('no_action')}>
                  <div className="flex items-center h-5">
                    <input
                      id="no_action"
                      name="payment_action"
                      type="radio"
                      checked={selectedPaymentAction === 'no_action'}
                      onChange={() => handlePaymentActionChange('no_action')}
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
            
            {/* Payment reason dropdown - only show if an action other than 'no_action' is selected */}
            {selectedPaymentAction !== 'no_action' && (
              <div className="mb-5" ref={paymentReasonDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <div className="relative mt-1">
                  {/* Custom dropdown button */}
                  <button
                    type="button"
                    onClick={() => setIsPaymentReasonDropdownOpen(!isPaymentReasonDropdownOpen)}
                    className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    style={{ fontSize: '16px' }} // Prevent iOS zoom
                  >
                    <span className={`${!paymentReason ? 'text-gray-400' : 'text-gray-900'}`}>
                      {paymentReason || 'Select a reason'}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Dropdown menu */}
                  {isPaymentReasonDropdownOpen && (
                    <div className="absolute z-[999999] mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
                      <ul className="py-1">
                        {reasonOptions[selectedPaymentAction].map((option) => (
                          <li 
                            key={option}
                            className={`cursor-pointer px-4 py-2 hover:bg-gray-100 ${paymentReason === option ? 'bg-gray-100' : ''}`}
                            onClick={() => {
                              handlePaymentReasonChange(option);
                              setIsPaymentReasonDropdownOpen(false);
                            }}
                          >
                            {option}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {isOtherReasonSelected && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={customPaymentReason}
                      placeholder="Please specify reason"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-base py-3 border-gray-300 rounded-md"
                      style={{ fontSize: '16px' }} // Prevent iOS zoom
                      onChange={(e) => handleCustomPaymentReasonChange(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inventory items list - only show if there are inventory items */}
          {inventoryItems.length > 0 && (
            <div className="p-6">
              <h4 className="text-base font-medium text-gray-900 mb-4">
                Inventory Items
              </h4>
              
              <div className="space-y-6">
                {inventoryItems.map((item, index) => {
                  const uniqueItemId = `${item.id}-${item.orderId}-${index}`;
                  const action = inventoryActions.find(a => a.uniqueId === uniqueItemId);
                  
                  return (
                    <div 
                      key={uniqueItemId} 
                      className="border border-gray-200 rounded-lg p-4 animate-fadeIn"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-medium text-gray-900">{item.name}</h5>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          {item.price && (
                            <p className="text-sm text-gray-600">
                              Value: ${(item.price * item.quantity).toFixed(2)}
                            </p>
                          )}
                          {isBatch && item.orderId && (
                            <p className="text-sm text-gray-600">Order: #{item.orderId}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Action
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => handleActionChange(uniqueItemId, 'return_to_inventory')}
                              className={`px-4 py-2 rounded-md text-sm font-medium flex-1 ${
                                action?.action === 'return_to_inventory'
                                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Return to Inventory
                            </button>
                            <button
                              type="button"
                              onClick={() => handleActionChange(uniqueItemId, 'mark_as_damaged')}
                              className={`px-4 py-2 rounded-md text-sm font-medium flex-1 ${
                                action?.action === 'mark_as_damaged'
                                  ? 'bg-red-100 text-red-800 border-2 border-red-300'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              Mark as Damaged
                            </button>
                          </div>
                        </div>

                        {action?.action === 'mark_as_damaged' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Reason (Required)
                            </label>
                            <input
                              type="text"
                              value={action.reason || ''}
                              onChange={(e) => handleReasonChange(uniqueItemId, e.target.value)}
                              placeholder="Why is this item damaged?"
                              className="border border-gray-300 rounded-md px-3 py-2 w-full text-sm focus:ring-[#c1902f] focus:border-[#c1902f]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-[#c1902f] text-white rounded-lg text-sm font-medium hover:bg-[#d4a43f] transition-colors shadow-sm"
          >
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
