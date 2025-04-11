// src/ordering/components/admin/CollapsibleOrderCard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { StatusTimer } from './StatusTimer';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';

interface RefundedItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface OrderPayment {
  id: number;
  payment_type: 'initial' | 'additional' | 'refund';
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  description?: string;
  transaction_id?: string;
  payment_details?: any;
  refunded_items?: RefundedItem[];
}

interface CollapsibleOrderCardProps {
  order: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isNew?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onSelectChange?: (selected: boolean) => void;
  renderActions: (order: any) => React.ReactNode;
  getStatusBadgeColor: (status: string) => string;
  formatDate: (dateString: string | null | undefined) => string;
  requiresAdvanceNotice: (order: any) => boolean;
}

// Interface for refund tracking
interface RefundInfo {
  isFullyRefunded: boolean;
  isPartiallyRefunded: boolean;
  refundedQuantity: number;
  originalQuantity: number;
  refundDetails: Array<{
    date: string;
    amount: number;
    quantity: number;
    reason?: string;
    transactionId?: string; // Add transaction ID for tracking
  }>;
}

// Helper function to find the best matching original item for a refunded item
function findBestMatchingItem(
  itemsMap: Record<string, RefundInfo>,
  refundedItem: RefundedItem
): string | null {
  // First try to match by ID
  if (refundedItem.id) {
    const idMatches = Object.keys(itemsMap).filter(key => 
      key.startsWith(`${refundedItem.id}-`));
      
    // Find items that haven't been fully refunded yet
    const availableMatches = idMatches.filter(key => 
      !itemsMap[key].isFullyRefunded && 
      itemsMap[key].refundedQuantity < itemsMap[key].originalQuantity);
      
    if (availableMatches.length > 0) {
      // Sort by available quantity first, then by refunded percentage
      return availableMatches.sort((a, b) => {
        // Sort by available quantity (unreduced quantity) first
        const aAvailable = itemsMap[a].originalQuantity - itemsMap[a].refundedQuantity;
        const bAvailable = itemsMap[b].originalQuantity - itemsMap[b].refundedQuantity;
        if (aAvailable !== bAvailable) return bAvailable - aAvailable;
        
        // Then sort by refund percentage if available quantities are the same
        return (itemsMap[a].refundedQuantity / itemsMap[a].originalQuantity) - 
               (itemsMap[b].refundedQuantity / itemsMap[b].originalQuantity);
      })[0];
    }
  }
  
  // If no ID match or all ID-matched items are fully refunded, try name matching
  const nameMatches = Object.keys(itemsMap).filter(key => 
    key.includes(`-${refundedItem.name}-`));
    
  const availableNameMatches = nameMatches.filter(key => 
    !itemsMap[key].isFullyRefunded && 
    itemsMap[key].refundedQuantity < itemsMap[key].originalQuantity);
    
  if (availableNameMatches.length > 0) {
    // Sort by available quantity first, then by refunded percentage
    return availableNameMatches.sort((a, b) => {
      // Sort by available quantity (unreduced quantity) first
      const aAvailable = itemsMap[a].originalQuantity - itemsMap[a].refundedQuantity;
      const bAvailable = itemsMap[b].originalQuantity - itemsMap[b].refundedQuantity;
      if (aAvailable !== bAvailable) return bAvailable - aAvailable;
      
      // Then sort by refund percentage if available quantities are the same
      return (itemsMap[a].refundedQuantity / itemsMap[a].originalQuantity) - 
             (itemsMap[b].refundedQuantity / itemsMap[b].originalQuantity);
    })[0];
  }
  
  // If no matches found yet, try fuzzy name matching as a last resort
  if (refundedItem.name) {
    const fuzzyMatches = Object.keys(itemsMap).filter(key => {
      const keyParts = key.toLowerCase().split('-');
      const itemName = refundedItem.name.toLowerCase();
      
      // Try different matching strategies
      return keyParts.some(part => 
        part.includes(itemName) || 
        itemName.includes(part) ||
        // Handle common variations like "Burger" matching "Hafaloha Burger"
        (itemName.includes("burger") && part.includes("burger")) ||
        (itemName.includes("bowl") && part.includes("bowl")) ||
        // Handle "Cali Poke" or other poke variations
        (itemName.includes("poke") && part.includes("poke"))
      );
    });
    
    const availableFuzzyMatches = fuzzyMatches.filter(key => 
      !itemsMap[key].isFullyRefunded && 
      itemsMap[key].refundedQuantity < itemsMap[key].originalQuantity);
    
    if (availableFuzzyMatches.length > 0) {
      return availableFuzzyMatches.sort((a, b) => {
        const aAvailable = itemsMap[a].originalQuantity - itemsMap[a].refundedQuantity;
        const bAvailable = itemsMap[b].originalQuantity - itemsMap[b].refundedQuantity;
        return bAvailable - aAvailable;
      })[0];
    }
  }
  
  return null;
}

// Helper function to calculate total refund amount for an item
function calculateRefundAmount(refundInfo: RefundInfo): number {
  return refundInfo.refundDetails.reduce((total, detail) => {
    return total + detail.amount;
  }, 0);
}

// Additional matching function for name-based matching
function matchRefundedItemNameWithOrderItem(
  itemName: string,
  orderItems: any[]
): any | null {
  // Normalize the name for comparison
  const normalizedName = itemName.toLowerCase().trim();
  
  // Direct matching
  let match = orderItems.find(item => 
    item.name.toLowerCase().trim() === normalizedName
  );
  if (match) return match;
  
  // Partial matching (for names like "Cali Poke" vs "California Poke Bowl")
  match = orderItems.find(item => {
    const itemLower = item.name.toLowerCase();
    return itemLower.includes(normalizedName) || 
           normalizedName.includes(itemLower);
  });
  if (match) return match;
  
  // Word matching (for more robust matching)
  const nameWords = normalizedName.split(/\s+/);
  const significantWords = nameWords.filter(word => 
    word.length > 3 && !['with', 'and', 'the'].includes(word)
  );
  
  if (significantWords.length > 0) {
    match = orderItems.find(item => {
      const itemWords = item.name.toLowerCase().split(/\s+/);
      return significantWords.some(word => 
        itemWords.some((itemWord: string) => itemWord.includes(word) || word.includes(itemWord))
      );
    });
    return match || null;
  }
  
  return null;
}

// Helper function to count refunded items
function getTotalRefundedItemsCount(refundedItemsMap: Record<string, RefundInfo>): number {
  return Object.values(refundedItemsMap).filter(item => 
    item.isFullyRefunded || item.isPartiallyRefunded
  ).length;
}

// Helper function to calculate the true original total from all items
function calculateOriginalTotal(order: any): number {
  // If order has an explicit original_total property, use it
  if (order.original_total) {
    return parseFloat(String(order.original_total));
  }
  
  // Otherwise calculate from all items (including refunded ones)
  let total = 0;
  if (order.items && Array.isArray(order.items)) {
    total = order.items.reduce((sum: number, item: any) => {
      const price = parseFloat(String(item.price)) || 0;
      // Use original quantity if available (for partially refunded items)
      const originalQty = parseInt(String(item.originalQuantity || item.quantity), 10);
      return sum + (price * originalQty);
    }, 0);
  }
  
  // Fallback to order.total if calculation fails
  return total || parseFloat(String(order.total || 0));
}

// Helper function to detect if an order has refunds using multiple indicators
function detectOrderHasRefunds(order: any): { 
  hasRefund: boolean; 
  isFullRefund: boolean; 
  refundAmount: number;
  originalAmount: number;
} {
  
  // Check for refund status
  const hasRefundStatus = order.status === 'refunded';
  // Check for refund amount in order_payments
  const refunds = (order.order_payments || []).filter((p: any) => p.payment_type === 'refund');
  if (refunds.length > 0) {
  }
  
  let refundAmount = refunds.reduce((sum: number, p: any) => sum + parseFloat(String(p.amount)), 0);
  
  // If no refund data in order_payments but order has total_refunded property, use that
  if (refunds.length === 0 && order.total_refunded) {
    refundAmount = parseFloat(String(order.total_refunded));
  }
  
  // Calculate the true original total from all items
  const originalTotal = calculateOriginalTotal(order);
  
  // Calculate net amount
  const netAmount = Math.max(0, originalTotal - refundAmount);
  
  // Determine if it's a full refund
  const isFullRefund = (hasRefundStatus && order.status === 'refunded') || 
                       (refundAmount > 0 && Math.abs(netAmount) < 0.01);
                       
  // Determine if it's a partial refund (has refund amount but not a full refund)
  const isPartiallyRefunded = refundAmount > 0 && !isFullRefund;
  
  const result = {
    hasRefund: hasRefundStatus || refundAmount > 0,
    isFullRefund,
    isPartiallyRefunded,
    refundAmount,
    originalAmount: originalTotal
  };
  
  return result;
}

export function CollapsibleOrderCard({
  order,
  isExpanded,
  onToggleExpand,
  isNew = false,
  isSelected = false,
  isHighlighted = false,
  onSelectChange,
  renderActions,
  getStatusBadgeColor,
  formatDate,
  requiresAdvanceNotice
}: CollapsibleOrderCardProps) {
  
  // Mobile optimization enhancements
  const mobileStyles = `
    @media (max-width: 640px) {
      .refund-badge {
        font-size: 0.65rem;
        padding: 0.125rem 0.25rem;
      }
      
      .price-stack {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      
      .refund-summary {
        width: 100%;
        margin-top: 0.5rem;
      }
      
      .refund-details {
        margin-left: 0.5rem;
      }
      
      .refund-status-badge {
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
        display: inline-flex;
        align-items: center;
      }
    }
  `;
  
  // State for payments data
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Fetch payments when component mounts or order changes
  useEffect(() => {
    async function fetchPayments() {
      if (!order.id) return;
      
      setLoadingPayments(true);
      try {
        const resp = await orderPaymentsApi.getPayments(order.id);
        const responseData = resp as any;
        const { payments: list } = responseData.data;
        
        setPayments(list || []);
      } catch (err) {
        // Error loading payments for order
      } finally {
        setLoadingPayments(false);
      }
    }
    
    fetchPayments();
  }, [order.id]);
  
  // Process refunded items to identify which items have been refunded
  const refundedItemsMap = useMemo(() => {
    const itemsMap: Record<string, RefundInfo> = {};
    
    // Get order structure for processing
    
    // Create a copy of the order with our fetched payments
    const orderWithPayments = {
      ...order,
      order_payments: payments.length > 0 ? payments : order.order_payments
    };
    
    // Use our helper function to detect if the order has refunds
    const refundInfo = detectOrderHasRefunds(orderWithPayments);
    const isOrderRefunded = refundInfo.hasRefund;
    
    // If the order is refunded but we don't have payment data, we need to handle it specially
    if (isOrderRefunded || (order.total_refunded && parseFloat(String(order.total_refunded)) > 0)) {
      // Process refunded order
      
      // Calculate the refund amount from the order total and current total
      const originalTotal = parseFloat(String(order.original_total || order.total || 0));
      const currentTotal = parseFloat(String(order.total || 0));
      const refundAmount = order.total_refunded ? parseFloat(String(order.total_refunded)) : Math.max(0, originalTotal - currentTotal);
      
      // Calculate refund amount from order totals
      
      // For any order with refund status, check all items
      if (order.items && order.items.length > 0) {
        // First try to find items that are already marked as refunded
        const refundedItems = order.items.filter((item: any) => 
          item.isFullyRefunded || item.isPartiallyRefunded || item.refundedQuantity > 0
        );
        
        if (refundedItems.length > 0) {
          // Process pre-marked refunded items
          
          // Process pre-marked refunded items
          refundedItems.forEach((item: any, index: number) => {
            const itemIndex = order.items.findIndex((i: any) => i === item);
            if (itemIndex !== -1) {
              const itemKey = `${item.id || ''}-${item.name}-${itemIndex}`;
              
              itemsMap[itemKey] = {
                isFullyRefunded: !!item.isFullyRefunded,
                isPartiallyRefunded: !!item.isPartiallyRefunded && !item.isFullyRefunded,
                refundedQuantity: item.refundedQuantity || (item.isFullyRefunded ? item.quantity : 0),
                originalQuantity: item.quantity,
                refundDetails: [{
                  date: new Date().toISOString(),
                  amount: item.price * (item.refundedQuantity || item.quantity),
                  quantity: item.refundedQuantity || item.quantity,
                  reason: 'Refunded'
                }]
              };
              
              // Track pre-marked refunded items
            }
          });
        } 
        // If no items are pre-marked as refunded, try to infer from order status
        else if (isOrderRefunded && refundAmount > 0) {
          // Infer refunded items from order status
          
          // Try to infer which items might be refunded based on the order status
          // This is a fallback when we don't have specific item refund data
          const totalItemsValue = order.items.reduce((sum: number, item: any) => {
            return sum + (parseFloat(String(item.price)) * parseInt(String(item.quantity), 10));
          }, 0);
          
          // If refund amount is close to the total, mark all items as refunded
          if (Math.abs(refundAmount - totalItemsValue) < 0.01) {
            // Process fully refunded items
            order.items.forEach((item: any, index: number) => {
              const itemKey = `${item.id || ''}-${item.name}-${index}`;
              itemsMap[itemKey] = {
                isFullyRefunded: true,
                isPartiallyRefunded: false,
                refundedQuantity: item.quantity,
                originalQuantity: item.quantity,
                refundDetails: [{
                  date: new Date().toISOString(),
                  amount: parseFloat(String(item.price)) * parseInt(String(item.quantity), 10),
                  quantity: item.quantity,
                  reason: 'Order refunded'
                }]
              };
            });
          }
          // Otherwise, try to find items that might match the refund amount
          else {
            // Processing partial refund amount
            
            // Sort items by price (highest first) to try matching larger items first
            const sortedItems = [...order.items].sort((a, b) => 
              (parseFloat(String(b.price)) * parseInt(String(b.quantity), 10)) - 
              (parseFloat(String(a.price)) * parseInt(String(a.quantity), 10))
            );
            
            let remainingRefundAmount = refundAmount;
            
            // Try to match items to the refund amount
            for (const item of sortedItems) {
              const itemTotal = parseFloat(String(item.price)) * parseInt(String(item.quantity), 10);
              const itemIndex = order.items.findIndex((i: any) => i === item);
              const itemKey = `${item.id || ''}-${item.name}-${itemIndex}`;
              
              // If this item's value is less than or equal to the remaining refund amount
              if (itemTotal <= remainingRefundAmount + 0.01) { // Add small buffer for floating point
                // Process fully refunded item
                itemsMap[itemKey] = {
                  isFullyRefunded: true,
                  isPartiallyRefunded: false,
                  refundedQuantity: item.quantity,
                  originalQuantity: item.quantity,
                  refundDetails: [{
                    date: new Date().toISOString(),
                    amount: itemTotal,
                    quantity: item.quantity,
                    reason: 'Order partially refunded'
                  }]
                };
                remainingRefundAmount -= itemTotal;
              }
              // If we have a partial match (some units of this item might be refunded)
              else if (remainingRefundAmount > 0) {
                const unitPrice = parseFloat(String(item.price));
                const refundedUnits = Math.floor(remainingRefundAmount / unitPrice);
                
                if (refundedUnits > 0) {
                  // Process partially refunded item
                  itemsMap[itemKey] = {
                    isFullyRefunded: false,
                    isPartiallyRefunded: true,
                    refundedQuantity: refundedUnits,
                    originalQuantity: item.quantity,
                    refundDetails: [{
                      date: new Date().toISOString(),
                      amount: unitPrice * refundedUnits,
                      quantity: refundedUnits,
                      reason: 'Order partially refunded'
                    }]
                  };
                  remainingRefundAmount -= unitPrice * refundedUnits;
                }
              }
              
              // If we've accounted for all the refund amount, stop
              if (remainingRefundAmount < 0.01) break;
            }
          }
        }
      }
    }
    
    // Step 1: First map original order items with unique identifiers
    // This handles multiple instances of the same product in an order
    if (order.items) {
      order.items.forEach((item: any, index: number) => {
        // Create a unique key for each item instance in the order
        // Using both ID and index ensures we can distinguish between multiple instances
        const itemKey = `${item.id || ''}-${item.name}-${index}`;
        itemsMap[itemKey] = { 
          isFullyRefunded: false, 
          isPartiallyRefunded: false,
          refundedQuantity: 0,
          originalQuantity: item.quantity,
          refundDetails: []
        };
      });
    }
    
    // Step 2: Process refunds to identify refunded items
    const orderPayments = payments.length > 0 ? payments : order.order_payments;
    if (orderPayments && Array.isArray(orderPayments)) {
      const refunds = orderPayments.filter((p: OrderPayment) => p.payment_type === 'refund');
      
      // Sort refunds by date (oldest first) to ensure consistent application
      const sortedRefunds = [...refunds].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      sortedRefunds.forEach((refund: OrderPayment) => {
        // Process refunded items if they exist
        if (refund.refunded_items && refund.refunded_items.length > 0) {
          refund.refunded_items.forEach((refundedItem: RefundedItem) => {
            // Find the best matching item in our map for this refunded item
            let bestMatchKey = findBestMatchingItem(itemsMap, refundedItem);
            
            if (bestMatchKey) {
              // Add to refund details with transaction ID for tracking
              itemsMap[bestMatchKey].refundDetails.push({
                transactionId: String(refund.id),
                date: refund.created_at,
                amount: refundedItem.price * refundedItem.quantity,
                quantity: refundedItem.quantity,
                reason: refund.description
              });
              
              // Update refunded quantity
              itemsMap[bestMatchKey].refundedQuantity += refundedItem.quantity;
              
              // Update refund status
              if (itemsMap[bestMatchKey].refundedQuantity >= itemsMap[bestMatchKey].originalQuantity) {
                itemsMap[bestMatchKey].isFullyRefunded = true;
                itemsMap[bestMatchKey].isPartiallyRefunded = false;
              } else if (itemsMap[bestMatchKey].refundedQuantity > 0) {
                itemsMap[bestMatchKey].isPartiallyRefunded = true;
              }
            }
          });
        } 
        // If no refunded_items but there is a refund amount, try to match based on description
        else if (refund.amount > 0 && refund.description) {
          // Look for item name in the description - improved regex to better match burger names
          const itemNameMatch = refund.description.match(/([A-Za-z\s\-']+)(?:\s+×\s+(\d+)|:?\s+(\d+)\s+units?)?/i);
          if (itemNameMatch) {
            const itemName = itemNameMatch[1].trim();
            // Get quantity from either format: "× 2" or "2 units"
            const quantity = itemNameMatch[2] ? parseInt(itemNameMatch[2], 10) : 
                            (itemNameMatch[3] ? parseInt(itemNameMatch[3], 10) : 1);
            
            // Extract refund amount if present in description
            const amountMatch = refund.description.match(/\$(\d+\.?\d*)/);
            const refundAmount = amountMatch ? parseFloat(amountMatch[1]) : refund.amount;
            
            // Find items that match this name - improved matching logic for all food items
            const matchingKeys = Object.keys(itemsMap).filter(key => {
              // Check if the key contains the item name (case insensitive)
              const keyLower = key.toLowerCase();
              const itemNameLower = itemName.toLowerCase();
              
              // Try different matching strategies
              return keyLower.includes(itemNameLower) || 
                     itemNameLower.includes(keyLower) ||
                     // Handle common variations like "Burger" matching "Hafaloha Burger"
                     (itemNameLower.includes("burger") && keyLower.includes("burger")) ||
                     (itemNameLower.includes("bowl") && keyLower.includes("bowl")) ||
                     // Handle "Cali Poke" or other poke variations
                     (itemNameLower.includes("poke") && keyLower.includes("poke"));
            });
            
            if (matchingKeys.length > 0) {
              const bestMatchKey = matchingKeys[0]; // Take the first match
              
              // Add to refund details with the extracted amount
              itemsMap[bestMatchKey].refundDetails.push({
                date: refund.created_at,
                amount: refundAmount,
                quantity: quantity,
                reason: refund.description
              });
              
              // Update refunded quantity
              itemsMap[bestMatchKey].refundedQuantity += quantity;
              
              // Update refund status
              if (itemsMap[bestMatchKey].refundedQuantity >= itemsMap[bestMatchKey].originalQuantity) {
                itemsMap[bestMatchKey].isFullyRefunded = true;
                itemsMap[bestMatchKey].isPartiallyRefunded = false;
              } else if (itemsMap[bestMatchKey].refundedQuantity > 0) {
                itemsMap[bestMatchKey].isPartiallyRefunded = true;
              }
            }
          }
        }
      });
    }
    
    
    return itemsMap;
  }, [order.items, order.order_payments]);
  
  // Animation classes for new orders
  const newOrderClasses = isNew
    ? 'animate-pulse-light border-yellow-300 shadow-yellow-100'
    : '';
  const highlightClasses = isHighlighted
    ? 'ring-2 ring-[#c1902f] ring-opacity-70 shadow-md'
    : '';

  // Calculate the actual total based on the current items in the order
  const currentTotal = (order.items || []).reduce((sum: number, item: any) => {
    const price = parseFloat(String(item.price)) || 0;
    const qty = parseInt(String(item.quantity), 10) || 0;
    return sum + price * qty;
  }, 0);
  
  // Use our enhanced refund detection helper
  const orderPayments = payments.length > 0 ? payments : order.order_payments;
  const refunds = (orderPayments && Array.isArray(orderPayments) ? orderPayments : [])
    .filter((p: OrderPayment) => p.payment_type === 'refund');
  
  // Detect refund status using our helper function
  const orderWithPayments = {
    ...order,
    order_payments: orderPayments
  };
  const refundInfo = detectOrderHasRefunds(orderWithPayments);
  
  // Extract values from the refund detection
  const totalRefunded = refundInfo.refundAmount;
  const originalTotal = refundInfo.originalAmount;
  const netTotal = Math.max(0, originalTotal - totalRefunded);
  const isFullyRefunded = refundInfo.isFullRefund;
  const isPartiallyRefunded = refundInfo.hasRefund && !refundInfo.isFullRefund;
  
  
  return (
    <div
      id={`order-${order.id}`}
      className={`rounded-lg shadow-sm overflow-hidden ${newOrderClasses} ${highlightClasses} transition-all duration-200 ${
        order.staff_created
          ? 'bg-blue-50 border-l-4 border-blue-400 border-t border-r border-b border-gray-200 bg-[url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%234b91f1\' fill-opacity=\'0.05\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")]'
          : 'bg-white border border-gray-200'
      }`}
    >
      <style>{mobileStyles}</style>
      {/* Order header - optimized for mobile and tablet */}
      <div className="flex flex-wrap justify-between items-center p-3 border-b border-gray-100">
        <div className="flex items-center">
          {onSelectChange && (
            <div className="mr-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelectChange(e.target.checked)}
                className="h-5 w-5 text-[#c1902f] focus:ring-[#c1902f] border-gray-300 rounded"
                aria-label="Select order"
              />
            </div>
          )}
          <div>
            <div className="flex items-center">
              {isNew && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mr-2">
                  NEW
                </span>
              )}
              {order.staff_created ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mr-2 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Staff Order
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Customer Order
                </span>
              )}
              <h3 className="text-base font-medium text-gray-900">Order #{order.id}</h3>
            </div>
            {order.createdAt && (
              <div>
                <p className="text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleString()}
                </p>
                {/* Order Creator Information */}
                <p className="text-xs text-gray-500">
                  {order.created_by_user_id && (
                    <span className="inline-flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Created by: {order.created_by_user_name || `User ${order.created_by_user_id}`}
                    </span>
                  )}
                  {!order.created_by_user_id && order.created_by_staff_id && (
                    <span className="inline-flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Created by: {order.created_by_staff_name || `Staff ${order.created_by_staff_id}`}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          <StatusTimer 
            createdAt={order.createdAt} 
            statusUpdatedAt={order.statusUpdatedAt} 
            status={order.status} 
          />
          <div className="flex items-center space-x-1">
            {requiresAdvanceNotice(order) && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                24h
              </span>
            )}
            <span
              className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${getStatusBadgeColor(order.status)}
              `}
            >
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Order summary (always visible) */}
      <div className="p-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          {/* Left side - customer info and items */}
          <div className="mb-2 sm:mb-0">
            {order.contact_name && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Customer: </span>
                <span>{order.contact_name}</span>
                {order.staff_created && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Staff Order
                  </span>
                )}
              </div>
            )}
            {!order.contact_name && order.staff_created && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Type: </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Staff Order
                </span>
              </div>
            )}
            <div className="text-sm">
              <span className="font-medium text-gray-700">Pickup: </span>
              <span>{formatDate((order as any).estimatedPickupTime || (order as any).estimated_pickup_time)}</span>
            </div>
            
            {/* Preview of order items in collapsed state */}
            {!isExpanded && (
              <div className="mt-2">
                <div className="flex items-center">
                  <h4 className="font-medium text-sm text-gray-700">Items:</h4>
                  {order.staff_created && (
                    <span className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shadow-sm flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Staff Order
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1 flex flex-wrap">
                  {order.items && order.items.map((item: any, index: number) => {
                    // Get refund info for this specific item
                    const itemKey = `${item.id || ''}-${item.name}-${index}`;
                    const refundInfo = refundedItemsMap[itemKey];
                    const isRefunded = refundInfo && (refundInfo.isFullyRefunded || refundInfo.isPartiallyRefunded);
                    
                    // Calculate refund amount for this item using our helper function
                    const refundAmount = isRefunded ? calculateRefundAmount(refundInfo) : 0;
                    
                    return (
                      <div key={index} className="inline-flex items-center mr-2 mb-1">
                        <span 
                          className={`
                            px-2 py-0.5 rounded-full text-xs flex items-center
                            ${isRefunded 
                              ? refundInfo.isFullyRefunded 
                                ? 'bg-red-100 text-red-800 line-through' 
                                : 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                            }
                          `}
                          title={isRefunded ? `${refundInfo.refundedQuantity} of ${item.quantity} refunded ($${refundAmount.toFixed(2)})` : ''}
                        >
                          {isRefunded && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          )}
                          <span className={isRefunded && refundInfo.isFullyRefunded ? 'line-through' : ''}>
                            {item.quantity}× {item.name}
                          </span>
                          {isRefunded && !refundInfo.isFullyRefunded && (
                            <span className="ml-1 font-medium text-red-700">
                              (-${refundAmount.toFixed(2)})
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  
                  {/* Display refund summary in collapsed view */}
                  {totalRefunded > 0 && (
                    <div className="w-full mt-1">
                      <span className="refund-summary text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full flex items-center inline-flex">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        {getTotalRefundedItemsCount(refundedItemsMap)} item{getTotalRefundedItemsCount(refundedItemsMap) !== 1 ? 's' : ''} refunded (${totalRefunded.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Right side - price and expand button */}
          <div className="text-left sm:text-right">
            <div className="flex flex-wrap items-center justify-end">
              {totalRefunded > 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center">
                    <div className="flex items-center mb-1 sm:mb-0">
                  <span className="line-through text-gray-400 mr-2">
                    ${originalTotal.toFixed(2)}
                  </span>
                  <span className="font-medium">
                    ${netTotal.toFixed(2)}
                  </span>
                    </div>
                    <span 
                      className={`px-2 py-0.5 rounded-full text-xs font-medium sm:ml-2
                        whitespace-nowrap flex-shrink-0 w-auto text-center
                        ${isFullyRefunded 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-orange-100 text-orange-800'}`}
                    >
                      {isFullyRefunded ? 'Refunded' : 'Partial Refund'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-red-600 w-full text-right">
                    <div className="flex items-center justify-end flex-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span>Refunded: ${totalRefunded.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <span>Total: ${originalTotal.toFixed(2)}</span>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={onToggleExpand}
                className="text-[#c1902f] hover:text-[#a07929] text-sm font-medium flex items-center mt-1 py-1"
                aria-expanded={isExpanded}
                aria-controls={`order-details-${order.id}`}
              >
                {isExpanded ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Hide Details
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show Details
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details - with improved mobile layout */}
      {isExpanded && (
        <div 
          id={`order-details-${order.id}`}
          className="p-3 pt-0 border-t border-gray-100 mt-2 animate-expandDown"
        >
          {/* Order Summary Box - shows original total, refund amount, and current total */}
          {totalRefunded > 0 && (
            <div className="mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Order Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Original Total</div>
                  <div className="font-medium">${originalTotal.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-red-500 mb-1">Refunded</div>
                  <div className="font-medium text-red-600">-${totalRefunded.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-700 mb-1">Current Total</div>
                  <div className="font-medium text-lg">${netTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
          {/* Items with prices aligned to right - with refund indicators */}
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Order Items:</h4>
            <div className="space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((item: any, index: number) => {
                  // Get refund info for this specific item
                  const itemKey = `${item.id || ''}-${item.name}-${index}`;
                  const refundInfo = refundedItemsMap[itemKey];
                  const isRefunded = refundInfo && (refundInfo.isFullyRefunded || refundInfo.isPartiallyRefunded);
                  
                  return (
                    <div 
                      key={index} 
                      className={`mb-3 last:mb-0 ${isRefunded ? 'bg-red-50 rounded-md p-2' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between text-sm">
                        <div className="pr-2 flex items-center">
                          {isRefunded && (
                            <span 
                              className="refund-badge inline-flex items-center mr-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                              title={`Refunded on ${new Date(refundInfo.refundDetails[0]?.date).toLocaleDateString()}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              {refundInfo.isFullyRefunded ? 'Refunded' : `${refundInfo.refundedQuantity}/${item.quantity} Refunded`}
                            </span>
                          )}
                          <span className={`font-medium ${isRefunded ? (refundInfo?.isFullyRefunded ? 'line-through text-gray-400' : 'text-red-700') : ''}`}>
                            {item.name} × {item.quantity}
                          </span>
                        </div>
                        
                        <div className="price-stack text-right whitespace-nowrap mt-1 sm:mt-0">
                          {isRefunded ? (
                            <>
                              <span className="line-through text-gray-400 mr-2">
                                ${Number(item.price * item.quantity).toFixed(2)}
                              </span>
                              {!refundInfo.isFullyRefunded && (
                                <span className="font-medium">
                                  ${Number(item.price * (item.quantity - refundInfo.refundedQuantity)).toFixed(2)}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Show original price and discounted price for staff orders */}
                              {order.is_staff_order && item.pre_discount_price && item.pre_discount_price !== item.price ? (
                                <>
                                  <span className="line-through text-gray-400 mr-2">
                                    ${Number(item.pre_discount_price * item.quantity).toFixed(2)}
                                  </span>
                                  <span className="font-medium">
                                    ${Number(item.price * item.quantity).toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <>${Number(item.price * item.quantity).toFixed(2)}</>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Display refund details for partially refunded items */}
                      {refundInfo?.isPartiallyRefunded && refundInfo.refundDetails.length > 0 && (
                        <div className="mt-1 ml-4 text-xs text-red-500 bg-red-50 p-2 rounded">
                          <div className="font-medium mb-1">Refund Details:</div>
                          {refundInfo.refundDetails.map((detail, idx) => (
                            <div key={`refund-${idx}`} className="flex justify-between items-center mb-1 last:mb-0">
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                <span>{detail.quantity} units on {new Date(detail.date).toLocaleDateString()}</span>
                              </div>
                              <span className="font-medium">${detail.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          {refundInfo.refundDetails[0]?.reason && (
                            <div className="mt-1 pt-1 border-t border-red-100 text-xs">
                              <span className="font-medium">Reason: </span>
                              {refundInfo.refundDetails[0].reason}
                            </div>
                          )}
                          <div className="mt-1 pt-1 border-t border-red-100 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium">Total Refunded: </span>
                              <span className="font-medium text-red-600">${calculateRefundAmount(refundInfo).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Remaining Amount: </span>
                              <span className="font-medium">${Number(item.price * (item.quantity - refundInfo.refundedQuantity)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    
                    {/* Display customizations if they exist */}
                    {item.customizations && Object.keys(item.customizations).length > 0 && (
                      <div className="mt-1 ml-2 bg-gray-50 p-2 rounded-md">
                        <div className="text-xs text-gray-600">
                          {Array.isArray(item.customizations) ? (
                            // array format
                            item.customizations.map((custom: any, cidx: number) => (
                              <div key={`custom-${index}-${cidx}`}>
                                {custom.option_name}
                                {custom.price > 0 && ` (+$${custom.price.toFixed(2)})`}
                              </div>
                            ))
                          ) : (
                            // object format with improved styling
                            Object.entries(item.customizations).map(
                              ([group, options]: [string, any], cidx: number) => (
                                <div key={`custom-${index}-${cidx}`} className="mb-1 last:mb-0">
                                  <span className="font-medium text-gray-700">{group}:</span>{' '}
                                  <span className="text-gray-800">
                                    {Array.isArray(options) ? (
                                      options.map((option: string, optIdx: number) => (
                                        <span key={`option-${index}-${cidx}-${optIdx}`} className="inline-flex items-center">
                                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md mr-1 mb-1 inline-block">
                                            {option}
                                          </span>
                                          {optIdx < options.length - 1 && ' '}
                                        </span>
                                      ))
                                    ) : (
                                      <span>{options}</span>
                                    )}
                                  </span>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Display option groups if they exist */}
                    {item.option_groups && item.option_groups.length > 0 && (
                      <div className="mt-1 ml-2 bg-gray-50 p-2 rounded-md">
                        <div className="text-xs text-gray-600">
                          {item.option_groups.map((group: any, gidx: number) => (
                            <div key={`option-group-${index}-${gidx}`}>
                              <span className="font-medium">{group.name}:</span>{' '}
                              {group.options
                                .filter((opt: any) => opt.selected)
                                .map((opt: any) => opt.name)
                                .join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Display notes if they exist */}
                    {item.notes && item.notes.trim() && (
                      <div className="mt-1 ml-2 text-xs text-gray-500 italic">
                        Note: {item.notes}
                      </div>
                    )}
                  </div>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500">No items found</div>
              )}
            </div>
          </div>

          {/* Special instructions */}
          {((order as any).special_instructions || (order as any).specialInstructions) && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-1">Instructions:</h4>
              <p className="text-sm text-gray-600 break-words">
                {(order as any).special_instructions || (order as any).specialInstructions}
              </p>
            </div>
          )}
          
          {/* Show subtotal */}
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-sm text-gray-700">Subtotal:</h4>
              <span className="text-sm font-medium">${originalTotal.toFixed(2)}</span>
            </div>
            
            {/* If there are refunds, show the refund amount and net total */}
            {totalRefunded > 0 && (
              <>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-red-600">Refunded:</span>
                  <span className="text-sm font-medium text-red-600">-${totalRefunded.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Net Total:</span>
                  <span className="text-sm font-medium">${netTotal.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          
          {/* Render refunds if present */}
          {refunds.length > 0 && (
            <div className="mb-4 bg-red-50 p-3 rounded-md border border-red-100">
              <h4 className="font-medium text-sm text-red-700 mb-2 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8
                       0 018 8v2M3 10l6
                       6m-6-6l6-6"
                  />
                </svg>
                Refund Information:
              </h4>
              <div className="space-y-3">
                {refunds.map((refund: OrderPayment, idx: number) => (
                    <div key={idx} className="text-sm text-red-600 border-b border-red-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                        <div className="flex items-center mb-1 sm:mb-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Amount: ${parseFloat(String(refund.amount)).toFixed(2)}</span>
                        </div>
                        <span className="text-red-500 text-xs">
                          {new Date(refund.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {refund.description && (
                        <div className="text-xs text-red-500 mt-1 flex items-start">
                          <span className="font-medium mr-1">Reason:</span>
                          <span className="flex-1">{refund.description}</span>
                        </div>
                      )}
                      
                      {/* Display refunded items if available */}
                      {refund.refunded_items && refund.refunded_items.length > 0 && (
                        <div className="mt-2 bg-red-100 p-2 rounded">
                          <div className="text-xs font-medium text-red-700 mb-1">Refunded Items:</div>
                          <ul className="list-disc pl-5 text-xs">
                            {refund.refunded_items.map((item: RefundedItem, itemIdx: number) => (
                              <li key={itemIdx} className="mb-1 last:mb-0">
                                <div className="flex flex-wrap justify-between">
                                  <span>{item.name} × {item.quantity}</span>
                                  <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Order Type */}
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Order Type:</h4>
            <div className="text-sm">
              {order.staff_created ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Staff Order
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Customer Order
                </span>
              )}
            </div>
          </div>

          {/* Customer contact info */}
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-1">Contact Info:</h4>
            <div className="text-sm space-y-1">
              {order.contact_name && (
                <div>
                  <span className="font-medium text-gray-700">Name: </span>
                  <span>{order.contact_name}</span>
                </div>
              )}
              {order.contact_phone && (
                <div>
                  <span className="font-medium text-gray-700">Phone: </span>
                  <a href={`tel:${order.contact_phone}`} className="text-blue-600">
                    {order.contact_phone}
                  </a>
                </div>
              )}
              {order.contact_email && (
                <div>
                  <span className="font-medium text-gray-700">Email: </span>
                  <a href={`mailto:${order.contact_email}`} className="text-blue-600 break-words">
                    {order.contact_email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions - with improved touch targets */}
      <div className="p-3 pt-0 border-t border-gray-100">
        {renderActions(order)}
      </div>
    </div>
  );
}
