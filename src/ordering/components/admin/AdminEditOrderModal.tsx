// src/ordering/components/admin/AdminEditOrderModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import toastUtils from '../../../shared/utils/toastUtils';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';
import { SetEtaModal } from './SetEtaModal';
import { SearchableMenuItemSelector } from './SearchableMenuItemSelector';
import { PaymentStatusSelector } from './PaymentStatusSelector';
import { InventoryReversionDialog } from './InventoryReversionDialog';
import { RefundModal } from './RefundModal';
import { OrderPaymentHistory } from './OrderPaymentHistory';
import { EnhancedAdditionalPaymentModal } from './EnhancedAdditionalPaymentModal';
import {
  PaymentHandlingDialog,
  PaymentAction,
  InventoryAction,
} from './PaymentHandlingDialog';
import { PaymentSummaryAlert } from './PaymentSummaryAlert';
import { menuItemsApi } from '../../../shared/api/endpoints/menuItems';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';
import { orderPaymentOperationsApi } from '../../../shared/api/endpoints/orderPaymentOperations';
import { MenuItem } from '../../types/menu';
import {
  handleOrderPreparationStatus,
  calculatePickupTime,
  requiresAdvanceNotice,
} from '../../../shared/utils/orderUtils';

// Define a local interface for refunded items to avoid conflicts
interface RefundedItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

// Rename to avoid conflict with imported type
interface OrderPaymentLocal {
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

interface AdminEditOrderModalProps {
  order: any; // The full order object
  onClose: () => void;
  onSave: (updatedData: any) => void;
}

/**
 * Represents an item on the order.
 * You may have more fields in your real code (customizations, etc.).
 */
export interface OrderItem {
  _editId: string;
  id?: string | number | null;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  customizations?: any;
  paymentStatus?: 'needs_payment' | 'already_paid';
  enable_stock_tracking?: boolean;
  stock_quantity?: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  option_groups?: any[];
  image?: string;
  description?: string;
  // Staff order fields
  pre_discount_price?: number; // Original price before staff discount
  // New fields for better quantity tracking
  originalQuantity?: number;  // Original quantity from the order
  paidQuantity?: number;      // How many units are already paid for
  unpaidQuantity?: number;    // How many units still require payment
  // Refund tracking
  refundedQuantity?: number;  // How many units have been refunded
  isFullyRefunded?: boolean;  // Whether the item is fully refunded
  isPartiallyRefunded?: boolean; // Whether the item is partially refunded
}

/**
 * Interface to track refund status by item
 */
interface RefundedItemsTracker {
  [itemId: string]: {
    totalQuantity: number;       // Original quantity in order
    refundedQuantity: number;    // How many have been refunded
    refundTransactions: Array<{  // All refund records for this item
      transactionId: string;
      date: string;
      quantity: number;
      amount: number;
    }>;
  };
}

// -------------- NEW HELPER FOR AVAILABLE QUANTITY --------------
/**
 * Safely calculate how many units of this item are actually available in inventory.
 * If stock tracking is disabled or stock_quantity is undefined, treat as unlimited.
 * Damaged quantity is subtracted out.
 */
function calculateAvailableQuantity(item: OrderItem): number {
  if (!item.enable_stock_tracking || item.stock_quantity === undefined) {
    return Infinity; // No tracking = unlimited
  }
  const damagedQty = item.damaged_quantity || 0;
  return Math.max(0, item.stock_quantity - damagedQty);
}

export function AdminEditOrderModal({
  order,
  onClose,
  onSave,
}: AdminEditOrderModalProps): JSX.Element {
  // ----------------------------------------------------------------
  // 1) Original vs. local items
  // ----------------------------------------------------------------
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
  const [localItems, setLocalItems] = useState<OrderItem[]>(() => {
    if (!order.items) return [];
    // Make a deep copy with a unique _editId for each item
    return order.items.map((item: any, index: number) => {
      const itemQuantity = parseInt(String(item.quantity), 10) || 0;
      return {
        ...item,
        _editId: `item-${item.id}-${index}-${JSON.stringify(
          item.customizations || {}
        )}`,
        enable_stock_tracking: !!item.enable_stock_tracking,
        paymentStatus: item.paymentStatus || 'already_paid',
        originalQuantity: itemQuantity,
        paidQuantity: itemQuantity,
        unpaidQuantity: 0,
      };
    });
  });

  /**
   * For items that are newly added, we track them separately so we can skip inventory reversion when removing.
   */
  const [newlyAddedItemIds, setNewlyAddedItemIds] = useState<Set<string>>(
    new Set()
  );

  /**
   * Used when removing an item that was part of the original order (to handle inventory or refunds).
   */
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{
    item: OrderItem;
    editId: string;
  } | null>(null);

  /**
   * Tracks a pending quantity change (specifically for partial-refund scenarios).
   */
  const [pendingQuantityChange, setPendingQuantityChange] = useState<{
    editId: string;
    oldQuantity: number;
    newQuantity: number;
    item: OrderItem;
  } | null>(null);

  /**
   * We store items that need to be marked as damaged so the backend can handle them on save.
   */
  const [itemsToMarkAsDamaged, setItemsToMarkAsDamaged] = useState<
    {
      itemId: string | number;
      quantity: number;
      reason: string;
    }[]
  >([]);

  /**
   * We store items that need to be returned to inventory so the backend can handle them on save.
   */
  const [itemsToReturnToInventory, setItemsToReturnToInventory] = useState<
    {
      itemId: string | number;
      quantity: number;
    }[]
  >([]);

  // For loading the full menu item data (e.g. inventory details)
  const [loadingMenuItemData, setLoadingMenuItemData] = useState(false);
  
  /**
   * Tracks refunded items and their quantities
   */
  const [refundedItemsMap, setRefundedItemsMap] = useState<RefundedItemsTracker>({});

  // On mount/load, set originalItems and fetch any additional item data if needed
  useEffect(() => {
    if (order.items) {
      // Build the original array of items (deep copy)
      const initialItems: OrderItem[] = JSON.parse(
        JSON.stringify(order.items)
      ).map((item: any) => ({
        ...item,
        enable_stock_tracking: !!item.enable_stock_tracking,
        paymentStatus: item.paymentStatus || 'already_paid',
      }));
      setOriginalItems(initialItems);
      setNewlyAddedItemIds(new Set());

      // First, fetch payments and refund data to ensure we have it before updating items
      const fetchPaymentsFirst = async () => {
        if (order.id) {
          try {
            // Fetching payments first for order
            const resp = await orderPaymentsApi.getPayments(order.id);
            const responseData = resp as any;
            let { payments: list, total_paid, total_refunded } = responseData.data;
            
            // Process initial API response for payments
            const paymentCount = list?.length || 0;
            
            // If no payments exist but order has total, simulate an initial payment
            if (list.length === 0 && order.total > 0) {
              // No initial payments found, creating initial payment
              const initialPayment: OrderPaymentLocal = {
                id: 0,
                payment_type: 'initial',
                amount: parseFloat(order.total),
                payment_method: order.payment_method || 'credit_card',
                status: 'completed',
                created_at: order.createdAt || new Date().toISOString(),
                description: 'Initial payment',
                transaction_id: order.transaction_id || 'N/A',
              };
              list = [initialPayment];
              total_paid = parseFloat(order.total);
              total_refunded = 0;
            }
            
            // Calculate max refundable amount using our helper function
            const calculatedMaxRefundable = calculateMaxRefundableAmount(list);
            
            // Use API values if provided, otherwise use calculated values
            let newMaxRefundable = calculatedMaxRefundable;
            if (total_paid !== undefined && total_refunded !== undefined) {
              newMaxRefundable = Math.max(0, total_paid - total_refunded);
            }
            
            // Setting initial max refundable amount
            
            // Set payments
            setPayments(list);
            setMaxRefundable(newMaxRefundable);
            
            // Build refund tracker
            const refundTracker = buildRefundTracker(list);
            setRefundedItemsMap(refundTracker);
            
            // Now proceed with fetching menu item data
            await fetchCompleteMenuItemData(initialItems, refundTracker);
            
          } catch (err) {
            console.error('Failed to load payments:', err);
            // Continue with menu item data even if payments fail
            await fetchCompleteMenuItemData(initialItems, {});
          }
        } else {
          // No order ID, just fetch menu item data
          await fetchCompleteMenuItemData(initialItems, {});
        }
      };

      // Handle undefined/null inventory values safely
      const fetchCompleteMenuItemData = async (items: OrderItem[], refundTracker: RefundedItemsTracker) => {
        try {
          setLoadingMenuItemData(true);
          const menuItemPromises = items
            .filter((it) => it.id)
            .map((it) =>
              menuItemsApi
                .getById(it.id!)
                .then((fullItem) => ({
                  ...it,
                  // Use safe defaults to protect against undefined
                  enable_stock_tracking: fullItem.enable_stock_tracking || false,
                  stock_quantity: fullItem.stock_quantity || 0,
                  damaged_quantity: fullItem.damaged_quantity || 0,
                  low_stock_threshold: fullItem.low_stock_threshold || 5,
                }))
                .catch((err) => {
                  console.error(
                    `Failed to fetch data for menu item ${it.id}:`,
                    err
                  );
                  // Provide safe defaults if API call fails
                  return {
                    ...it,
                    enable_stock_tracking: false,
                    stock_quantity: 0,
                    damaged_quantity: 0,
                    low_stock_threshold: 5,
                  };
                })
            );

          const completeItems = await Promise.all(menuItemPromises);

          // Update originalItems with full data
          setOriginalItems(completeItems);

          // Apply refund information to items before setting them
          const itemsWithRefundInfo = completeItems.map(item => {
            // Generate possible keys for this item
            const possibleKeys = [
              item.id ? String(item.id) : '',
              item.name.toLowerCase().replace(/\s+/g, '_')
            ].filter(Boolean);
            
            // Find matching refund info
            let refundInfo: typeof refundTracker[string] | undefined;
            let matchedKey = '';
            
            // Try direct key matching first
            for (const key of possibleKeys) {
              if (refundTracker[key]) {
                refundInfo = refundTracker[key];
                matchedKey = key;
                break;
              }
            }
            
            // If no direct match, try to find by matching function
            if (!refundInfo) {
              for (const key in refundTracker) {
                const matchedItem = matchRefundedItemToOrderItem(key, [item]);
                if (matchedItem) {
                  refundInfo = refundTracker[key];
                  matchedKey = key;
                  break;
                }
              }
            }
            
            // If we found refund info, update the item
            if (refundInfo) {
              // Update total quantity in the tracker
              if (matchedKey) {
                refundTracker[matchedKey].totalQuantity = item.quantity;
              }
              
              // Determine if fully or partially refunded
              const isFullyRefunded = refundInfo.refundedQuantity >= item.quantity;
              const isPartiallyRefunded = refundInfo.refundedQuantity > 0 && !isFullyRefunded;
              
              return {
                ...item,
                refundedQuantity: refundInfo.refundedQuantity,
                isFullyRefunded,
                isPartiallyRefunded
              };
            }
            
            // No match found, ensure refund properties are reset
            return {
              ...item,
              refundedQuantity: 0,
              isFullyRefunded: false,
              isPartiallyRefunded: false
            };
          });

          // Update localItems with the enriched data that includes both inventory and refund info
          setLocalItems((prevLocal) =>
            prevLocal.map((localItem) => {
              if (!localItem.id) return localItem;
              const enriched = itemsWithRefundInfo.find(
                (ci) => ci.id && String(ci.id) === String(localItem.id)
              );
              if (!enriched) return localItem;

              return {
                ...enriched,
                _editId: localItem._editId,
                quantity: localItem.quantity,
                notes: localItem.notes,
                price: localItem.price,
                paymentStatus: localItem.paymentStatus,
                customizations: localItem.customizations,
                originalQuantity: localItem.originalQuantity,
                paidQuantity: localItem.paidQuantity,
                unpaidQuantity: localItem.unpaidQuantity,
              };
            })
          );
        } catch (error) {
          console.error('Error fetching menu item data:', error);
          toastUtils.error('Unable to load inventory data. Some features may be limited.');
        } finally {
          setLoadingMenuItemData(false);
        }
      };

      // Start the process by fetching payments first
      fetchPaymentsFirst();
    }
  }, [order.items, order.id]);

  // ----------------------------------------------------------------
  // 2) Order-level local state
  // ----------------------------------------------------------------
  const [originalStatus] = useState(order.status);
  const [localStatus, setLocalStatus] = useState(order.status);

  // Sum of any refunds on the order so far (from order.order_payments).
  const sumRefunds = (order.order_payments || [])
    .filter((p: any) => p.payment_type === 'refund')
    .reduce((acc: number, p: any) => acc + parseFloat(String(p.amount)), 0);
  const netTotal = Math.max(
    0,
    parseFloat(String(order.total || '0')) - sumRefunds
  );

  // We initialize localTotal from the *items* rather than just `order.total`
  const [localTotal, setLocalTotal] = useState<string>(() => {
    if (!order.items) return '0.00';
    const initialSubtotal = order.items.reduce((sum: number, it: any) => {
      const price = parseFloat(String(it.price)) || 0;
      const qty = parseInt(String(it.quantity), 10) || 0;
      return sum + price * qty;
    }, 0);

    // Subtract refunds (to handle partial refunds in net total)
    const initialTotal = Math.max(0, initialSubtotal - sumRefunds);
    return initialTotal.toFixed(2);
  });

  // Special instructions / notes
  const [localInstructions, setLocalInstructions] = useState(
    order.special_instructions || order.specialInstructions || ''
  );

  // ETA modals (for pending -> preparing transitions)
  const [showEtaModal, setShowEtaModal] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(
    requiresAdvanceNotice(order) ? 10 : 5
  );

  // If status is preparing, we might let user update the ETA
  const [showEtaUpdateModal, setShowEtaUpdateModal] = useState(false);
  const [updateEtaMinutes, setUpdateEtaMinutes] = useState(() => {
    if (order.estimatedPickupTime || order.estimated_pickup_time) {
      const etaDate = new Date(
        order.estimatedPickupTime || order.estimated_pickup_time
      );
      if (requiresAdvanceNotice(order)) {
        // Convert to approximate hours if needed
        return etaDate.getHours() + (etaDate.getMinutes() === 30 ? 0.3 : 0);
      } else {
        // Convert to minutes from now
        const minutesFromNow = Math.max(
          5,
          Math.round((etaDate.getTime() - Date.now()) / 60000)
        );
        return Math.ceil(minutesFromNow / 5) * 5;
      }
    }
    return requiresAdvanceNotice(order) ? 10 : 5;
  });

  // ----------------------------------------------------------------
  // 3) Payment / Refund state
  // ----------------------------------------------------------------
  const [payments, setPayments] = useState<OrderPaymentLocal[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [maxRefundable, setMaxRefundable] = useState<number>(0);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showAdditionalPaymentModal, setShowAdditionalPaymentModal] =
    useState(false);
  const [showPaymentHandlingDialog, setShowPaymentHandlingDialog] =
    useState(false);
  
  /**
   * Used when pre-selecting an item for refund (e.g., when clicking the trash icon)
   */
  const [preSelectedRefundItem, setPreSelectedRefundItem] = useState<{
    id: number | string;
    quantity: number;
  } | null>(null);

  // Payment adjustment tracking (e.g., refunds, store credits, etc.)
  const [paymentAdjustments, setPaymentAdjustments] = useState<{
    refunds: Array<{ item: OrderItem; amount: number; reason: string }>;
    storeCredits: Array<{ item: OrderItem; amount: number; reason: string }>;
    adjustments: Array<{ item: OrderItem; amount: number; reason: string }>;
  }>({
    refunds: [],
    storeCredits: [],
    adjustments: [],
  });

  // Track whether payment processing or refund is in progress
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Summaries for display
  const [paymentSummary, setPaymentSummary] = useState({
    originalTotal: 0,
    newTotal: 0,
    totalRefunded: 0,
    totalStoreCredit: 0,
    hasPendingPayments: false,
  });

  // Tab switching
  const [activeTab, setActiveTab] = useState<'items' | 'details' | 'payments'>(
    'items'
  );

  // For custom status dropdown
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Close status dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ----------------------------------------------------------------
  // 4) Core item add/remove/edit logic
  // ----------------------------------------------------------------
  const [showMenuItemSelector, setShowMenuItemSelector] = useState(false);

  function handleAddItem() {
    setShowMenuItemSelector(true);
  }

  function handleMenuItemSelect(selectedItem: MenuItem) {
    setShowMenuItemSelector(false);

    // Create a new local item (default quantity = 1, needs payment)
    const newEditId = `new-item-${Date.now()}`;
    const newQuantity = 1;
    const newItem: OrderItem = {
      ...selectedItem,
      _editId: newEditId,
      id: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price ?? 0,
      quantity: newQuantity,
      notes: '',
      paymentStatus: 'needs_payment',
      enable_stock_tracking: selectedItem.enable_stock_tracking,
      stock_quantity: selectedItem.stock_quantity,
      damaged_quantity: selectedItem.damaged_quantity,
      low_stock_threshold: selectedItem.low_stock_threshold,
      originalQuantity: 0,
      paidQuantity: 0,
      unpaidQuantity: newQuantity,
    };

    setNewlyAddedItemIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(newEditId);
      return newSet;
    });

    // Add to local items
    setLocalItems((prev) => {
      const updated = [...prev, newItem];
      const newSubtotal = calculateSubtotalFromItems(updated);
      setLocalTotal(newSubtotal.toFixed(2));
      return updated;
    });
    
    // Update payment summary to reflect the new unpaid item
    updatePaymentSummary();
  }

  // -------------- UPDATED ITEM QUANTITY FUNCTION --------------
  /**
   * Enhanced quantity control that checks partial item availability (stock).
   * If we exceed effective availability, we reduce quantity and show a toast.
   * Also handles partial refund if user lowers quantity below paid portion.
   */
  function updateItemQuantity(_editId: string, newQuantity: number) {
    setLocalItems((prev) => {
      const itemToUpdate = prev.find((item) => item._editId === _editId);
      if (!itemToUpdate) return prev;

      const oldQuantity = itemToUpdate.quantity;
      if (oldQuantity === newQuantity) {
        return prev; // No change
      }

      // 1) Check partial item availability
      const originalItem = originalItems.find(
        (oi) => oi.id === itemToUpdate.id
      );
      const originalQty = originalItem ? originalItem.quantity : 0;

      // Calculate how many are truly available in stock
      const availableQty = calculateAvailableQuantity(itemToUpdate);

      // Effective availability includes the portion already in the original order
      // (since those units are presumably "reserved")
      const effectiveAvailable = availableQty + originalQty;

      if (newQuantity > effectiveAvailable) {
        toastUtils.error(`Only ${effectiveAvailable} units of ${itemToUpdate.name} are available. Setting quantity to maximum available.`, { duration: 5000 });
        newQuantity = effectiveAvailable;
      }

      // 2) Check partial refund scenario if user lowers quantity below paidQuantity
      const paidQuantity = itemToUpdate.paidQuantity || 0;
      if (newQuantity < paidQuantity) {
        setPendingQuantityChange({
          editId: _editId,
          oldQuantity,
          newQuantity,
          item: { ...itemToUpdate },
        });

        // The portion being removed is (paidQuantity - newQuantity).
        const removedQty = paidQuantity - newQuantity;
        const refundItem = {
          ...itemToUpdate,
          quantity: removedQty,
        };
        setItemToRemove({ item: refundItem, editId: _editId });
        setShowPaymentHandlingDialog(true);

        return prev; // We'll finalize after user picks how to handle it
      }

      // 3) If quantity > paidQuantity => these extra units are unpaid
      // 4) If user reverts quantity exactly back to original, mark as fully paid again
      return prev.map((it) => {
        if (it._editId !== _editId) return it;

        // If user sets newQuantity back to the original
        if (newQuantity === it.originalQuantity) {
          return {
            ...it,
            quantity: newQuantity,
            paymentStatus: 'already_paid',
            paidQuantity: newQuantity,
            unpaidQuantity: 0,
          };
        }

        if (newQuantity > paidQuantity) {
          const unpaidUnits = newQuantity - paidQuantity;
          return {
            ...it,
            quantity: newQuantity,
            paymentStatus: 'needs_payment',
            paidQuantity,
            unpaidQuantity: unpaidUnits,
          };
        }

        // Fallback
        return {
          ...it,
          quantity: newQuantity,
        };
      });
    });
  }

  function handleRemoveItem(editId: string) {
    const foundItem = localItems.find((i) => i._editId === editId);
    if (!foundItem) return;

    const isNewlyAdded = newlyAddedItemIds.has(editId);

    // If it's a newly added item (not yet paid for), remove immediately
    if (isNewlyAdded) {
      setLocalItems((prev) => {
        const updated = prev.filter((i) => i._editId !== editId);
        const newSubtotal = calculateSubtotalFromItems(updated);
        setLocalTotal(newSubtotal.toFixed(2));
        return updated;
      });
      return;
    }
    
    // Otherwise, open RefundModal with this item pre-selected
    // Set processing payment state to true since we're starting a refund process
    setIsProcessingPayment(true);
    setShowRefundModal(true);
    setPreSelectedRefundItem({
      id: foundItem.id!,
      quantity: 1 // Default to 1 unit
    });
  }

  function handleItemChange(
    _editId: string,
    field: keyof OrderItem,
    value: any
  ) {
    // If user changes quantity from an input box, use our “updateItemQuantity” function
    if (field === 'quantity') {
      const parsedValue = parseInt(String(value), 10);
      if (!isNaN(parsedValue) && parsedValue > 0) {
        updateItemQuantity(_editId, parsedValue);
      }
      return;
    }

    // For other fields (price, notes, etc.), just do a direct update
    setLocalItems((prev) =>
      prev.map((item) => {
        if (item._editId === _editId) {
          const updatedItem = {
            ...item,
            [field]: value,
          };

          // If modifying price, recalc totals
          if (field === 'price') {
            const newSubtotal = calculateSubtotalFromItems(
              prev.map((x) => (x._editId === _editId ? updatedItem : x))
            );
            setLocalTotal(newSubtotal.toFixed(2));
          }
          return updatedItem;
        }
        return item;
      })
    );
  }

  // ----------------------------------------------------------------
  // 5) PaymentHandlingDialog & partial-refund actions
  // ----------------------------------------------------------------
  function handlePaymentAction(
    action: PaymentAction | 'cancel' | 'none',
    reason: string,
    amount: number,
    inventoryAction?: InventoryAction,
    inventoryReason?: string
  ) {
    // This is called once the user chooses "Refund" / "StoreCredit" / "NoAction" etc.
    if (!itemToRemove) return;
    const { item, editId } = itemToRemove;
    const isPartialQuantity = !!pendingQuantityChange;

    // If action is 'cancel', just close the dialog without making changes
    if (action === 'cancel') {
      // If this was a partial quantity change, revert to the original quantity
      if (isPartialQuantity && pendingQuantityChange) {
        setLocalItems((prev) =>
          prev.map((i) => {
            if (i._editId === editId) {
              return {
                ...i,
                quantity: pendingQuantityChange.oldQuantity,
              };
            }
            return i;
          })
        );
      }
      
      // Close dialog and reset state
      setShowPaymentHandlingDialog(false);
      setItemToRemove(null);
      setPendingQuantityChange(null);
      return;
    }

    // If no amount is given, fallback to item.price * item.quantity
    const paymentAmount =
      amount ||
      parseFloat(String(item.price)) *
        parseInt(String(item.quantity), 10);

    // Record the chosen action for final processing on "Save"
    switch (action) {
      case 'refund':
        setPaymentAdjustments((prev) => ({
          ...prev,
          refunds: [...prev.refunds, { item, amount: paymentAmount, reason }],
        }));
        break;
      case 'store_credit':
        setPaymentAdjustments((prev) => ({
          ...prev,
          storeCredits: [
            ...prev.storeCredits,
            { item, amount: paymentAmount, reason },
          ],
        }));
        break;
      case 'adjust_total':
        setPaymentAdjustments((prev) => ({
          ...prev,
          adjustments: [
            ...prev.adjustments,
            { item, amount: paymentAmount, reason },
          ],
        }));
        break;
      case 'none':
        // No payment action needed, but we'll still update quantities
        break;
      default:
        console.warn(`Unhandled payment action: ${action}`);
        break;
    }

    // Handle inventory action if provided and item has stock tracking
    if (item.enable_stock_tracking && inventoryAction) {
      if (inventoryAction === 'mark_as_damaged' && item.id) {
        setItemsToMarkAsDamaged((prev) => [
          ...prev,
          {
            itemId: item.id!,
            quantity:
              isPartialQuantity && pendingQuantityChange
                ? pendingQuantityChange.oldQuantity -
                  pendingQuantityChange.newQuantity
                : item.quantity,
            reason: inventoryReason || 'Removed during order edit',
          },
        ]);
      } else if (inventoryAction === 'return_to_inventory' && item.id) {
        setItemsToReturnToInventory((prev) => [
          ...prev,
          {
            itemId: item.id!,
            quantity:
              isPartialQuantity && pendingQuantityChange
                ? pendingQuantityChange.oldQuantity -
                  pendingQuantityChange.newQuantity
                : item.quantity,
          },
        ]);
      }
    }

    // If partial quantity change
    if (isPartialQuantity && pendingQuantityChange) {
      // Actually set the new quantity for that item
      setLocalItems((prev) =>
        prev.map((i) => {
          if (i._editId === editId) {
            // If we partially refunded, the new "paidQuantity" should match the new quantity
            return {
              ...i,
              quantity: pendingQuantityChange.newQuantity,
              paidQuantity: pendingQuantityChange.newQuantity,
              paymentStatus: 'already_paid',
              unpaidQuantity: 0,
            };
          }
          return i;
        })
      );
    } else {
      // Otherwise, a full removal
      setLocalItems((prev) => {
        const updated = prev.filter((i) => i._editId !== editId);
        const newSubtotal = calculateSubtotalFromItems(updated);
        setLocalTotal(newSubtotal.toFixed(2));
        return updated;
      });
    }

    // Recalc summary
    updatePaymentSummary();

    // Close out the dialog, reset
    setShowPaymentHandlingDialog(false);
    setItemToRemove(null);
    setPendingQuantityChange(null);
  }

  function updatePaymentSummary() {
    const originalTotal = parseFloat(order.total) || 0;
    const newTotal = parseFloat(localTotal) || 0;

    // Summaries
    const totalRefunded = paymentAdjustments.refunds.reduce(
      (sum, r) => sum + r.amount,
      0
    );
    const totalStoreCredit = paymentAdjustments.storeCredits.reduce(
      (sum, s) => sum + s.amount,
      0
    );

    // Check if any items are currently in “needs_payment” status
    const hasPendingPayments = localItems.some(
      (it) => it.paymentStatus === 'needs_payment'
    );

    setPaymentSummary({
      originalTotal,
      newTotal,
      totalRefunded,
      totalStoreCredit,
      hasPendingPayments,
    });
  }

  function handleInventoryDialogAction(
    action: 'return_to_inventory' | 'mark_as_damaged',
    reason?: string
  ) {
    if (!itemToRemove) return;
    const { item, editId } = itemToRemove;

    // Remove from local items
    setLocalItems((prev) => {
      const updated = prev.filter((i) => i._editId !== editId);
      const newSubtotal = calculateSubtotalFromItems(updated);
      setLocalTotal(newSubtotal.toFixed(2));
      return updated;
    });

    // If user says "mark as damaged"
    if (action === 'mark_as_damaged' && item.id) {
      setItemsToMarkAsDamaged((prev) => [
        ...prev,
        {
          itemId: item.id!,
          quantity: item.quantity,
          reason: reason || 'Damaged during order edit',
        },
      ]);
    }

    setShowInventoryDialog(false);
    setItemToRemove(null);
  }

  /**
   * Builds a tracker for refunded items based on payment history
   */
  function buildRefundTracker(paymentsList: OrderPaymentLocal[]): RefundedItemsTracker {
    const tracker: RefundedItemsTracker = {};
    
    // Filter for refund transactions
    const refundTransactions = paymentsList.filter(p => p.payment_type === 'refund');
    
    // Process each refund transaction
    refundTransactions.forEach(refund => {
      try {
        // Try to extract refunded items from payment_details or refunded_items first
        if (refund.refunded_items && refund.refunded_items.length > 0) {
          refund.refunded_items.forEach((item: RefundedItem) => {
            const itemKey = String(item.id || item.name.toLowerCase().replace(/\s+/g, '_'));
            if (!tracker[itemKey]) {
              tracker[itemKey] = {
                totalQuantity: 0, // Will be updated later
                refundedQuantity: item.quantity,
                refundTransactions: [{
                  transactionId: String(refund.id),
                  date: refund.created_at,
                  quantity: item.quantity,
                  amount: item.price * item.quantity
                }]
              };
            } else {
              tracker[itemKey].refundedQuantity += item.quantity;
              tracker[itemKey].refundTransactions.push({
                transactionId: String(refund.id),
                date: refund.created_at,
                quantity: item.quantity,
                amount: item.price * item.quantity
              });
            }
          });
          return; // Skip the description parsing if we have refunded_items data
        }
        
        // Try to extract from payment_details
        if (refund.payment_details && refund.payment_details.refunded_items) {
          const refundedItems = refund.payment_details.refunded_items;
          refundedItems.forEach((item: any) => {
            const itemKey = String(item.id || item.name.toLowerCase().replace(/\s+/g, '_'));
            if (!tracker[itemKey]) {
              tracker[itemKey] = {
                totalQuantity: 0,
                refundedQuantity: item.quantity,
                refundTransactions: [{
                  transactionId: String(refund.id),
                  date: refund.created_at,
                  quantity: item.quantity,
                  amount: item.price * item.quantity
                }]
              };
            } else {
              tracker[itemKey].refundedQuantity += item.quantity;
              tracker[itemKey].refundTransactions.push({
                transactionId: String(refund.id),
                date: refund.created_at,
                quantity: item.quantity,
                amount: item.price * item.quantity
              });
            }
          });
          return;
        }
        
        // If no structured data, fall back to description parsing
        const description = refund.description || '';
        
        // Various parsing strategies
        // 1. Look for patterns like "Build-a-Bowl × 1 ($9.25)"
        const itemMatch = description.match(/([^×]+)\s*×\s*(\d+)\s*\(\$([^)]+)\)/);
        if (itemMatch) {
          const [_, itemName, quantityStr, priceStr] = itemMatch;
          const quantity = parseInt(quantityStr, 10);
          const price = parseFloat(priceStr);
          const nameKey = itemName.trim().toLowerCase().replace(/\s+/g, '_');
          
          if (!tracker[nameKey]) {
            tracker[nameKey] = {
              totalQuantity: 0,
              refundedQuantity: quantity,
              refundTransactions: [{
                transactionId: String(refund.id),
                date: refund.created_at,
                quantity,
                amount: !isNaN(price) ? price * quantity : refund.amount
              }]
            };
          } else {
            tracker[nameKey].refundedQuantity += quantity;
            tracker[nameKey].refundTransactions.push({
              transactionId: String(refund.id),
              date: refund.created_at,
              quantity,
              amount: !isNaN(price) ? price * quantity : refund.amount
            });
          }
          return;
        }
        
        // 2. Pattern: "Refund for: 2x Item Name ($10.00)"
        const refundedItemsMatch = description.match(/Refund for:\s*(.*?)(\$|$)/);
        if (refundedItemsMatch) {
          const itemsText = refundedItemsMatch[1];
          // Try to parse items like "2x Item Name, 1x Another Item"
          const itemMatches = itemsText.match(/(\d+)x\s+([^,]+)(?:,|$)/g);
          
          if (itemMatches) {
            itemMatches.forEach(match => {
              const parts = match.split('x');
              if (parts.length >= 2) {
                const quantityStr = parts[0].trim();
                const itemName = parts.slice(1).join('x').trim(); // Handle item names that might contain 'x'
                const quantity = parseInt(quantityStr, 10);
                
                if (!isNaN(quantity) && itemName) {
                  // Use item name as key if no ID available
                  const itemKey = itemName.toLowerCase().replace(/\s+/g, '_');
                  
                  if (!tracker[itemKey]) {
                    tracker[itemKey] = {
                      totalQuantity: 0, // Will be updated later
                      refundedQuantity: quantity,
                      refundTransactions: [{
                        transactionId: String(refund.id),
                        date: refund.created_at,
                        quantity,
                        amount: refund.amount / itemMatches.length // Approximate if multiple items
                      }]
                    };
                  } else {
                    // Add to existing refund record
                    tracker[itemKey].refundedQuantity += quantity;
                    tracker[itemKey].refundTransactions.push({
                      transactionId: String(refund.id),
                      date: refund.created_at,
                      quantity,
                      amount: refund.amount / itemMatches.length
                    });
                  }
                }
              }
            });
            return;
          }
        }
        
        // 3. Pattern: "Refund: Item Name"
        const simpleRefundMatch = description.match(/Refund:\s*(.+)/i);
        if (simpleRefundMatch && simpleRefundMatch[1]) {
          const itemName = simpleRefundMatch[1].trim();
          const nameKey = itemName.toLowerCase().replace(/\s+/g, '_');
          
          if (!tracker[nameKey]) {
            tracker[nameKey] = {
              totalQuantity: 0,
              refundedQuantity: 1, // Assume 1 if not specified
              refundTransactions: [{
                transactionId: String(refund.id),
                date: refund.created_at,
                quantity: 1,
                amount: refund.amount
              }]
            };
          } else {
            tracker[nameKey].refundedQuantity += 1;
            tracker[nameKey].refundTransactions.push({
              transactionId: String(refund.id),
              date: refund.created_at,
              quantity: 1,
              amount: refund.amount
            });
          }
          return;
        }
        
        // If we can't parse specific items, create a generic entry
        const genericKey = `refund_${refund.id}`;
        tracker[genericKey] = {
          totalQuantity: 0,
          refundedQuantity: 1,
          refundTransactions: [{
            transactionId: String(refund.id),
            date: refund.created_at,
            quantity: 1,
            amount: refund.amount
          }]
        };
      } catch (error) {
        console.error('Error processing refund transaction:', error);
      }
    });
    
    return tracker;
  }

  /**
   * Match a refunded item to an order item using strict matching strategies
   * This function is used to match refunded items to order items
   * It has been updated to use more strict matching to prevent incorrect matches
   */
  function matchRefundedItemToOrderItem(refundKey: string, orderItems: OrderItem[]): OrderItem | undefined {
    // If it's a generic refund key (refund_123), just return undefined immediately
    if (refundKey.startsWith('refund_')) return undefined;
    
    // Try exact ID match first (most reliable)
    const idMatch = orderItems.find(item => 
      item.id && String(item.id) === refundKey
    );
    if (idMatch) return idMatch;
    
    // Try case-insensitive ID match
    const caseInsensitiveIdMatch = orderItems.find(item => 
      item.id && String(item.id).toLowerCase() === refundKey.toLowerCase()
    );
    if (caseInsensitiveIdMatch) return caseInsensitiveIdMatch;
    
    // Try exact name match (normalize the refundKey if it's a name-based key)
    const normalizedKey = refundKey.replace(/_/g, ' ').trim();
    const nameMatch = orderItems.find(item => 
      item.name.toLowerCase().trim() === normalizedKey.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    
    // No match found with strict criteria
    return undefined;
  }

  /**
   * Update local items with refund information
   */
  function updateLocalItemsWithRefundInfo(refundTracker: RefundedItemsTracker) {
    setLocalItems(prevItems => {
      return prevItems.map(item => {
        // Generate possible keys for this item
        const possibleKeys = [
          item.id ? String(item.id) : '',
          item.name.toLowerCase().replace(/\s+/g, '_')
        ].filter(Boolean);
        
        // Find matching refund info
        let refundInfo: typeof refundTracker[string] | undefined;
        let matchedKey = '';
        
        // 1. Try direct key matching first - this is the most reliable method
        for (const key of possibleKeys) {
          if (refundTracker[key]) {
            refundInfo = refundTracker[key];
            matchedKey = key;
            break;
          }
        }
        
        // 2. If no direct match, try to find by exact ID match
        if (!refundInfo && item.id) {
          const itemId = String(item.id);
          for (const key in refundTracker) {
            // Check if the key contains the item ID as a whole number
            if (key === itemId) {
              refundInfo = refundTracker[key];
              matchedKey = key;
              break;
            }
          }
        }
        
        // 3. Try exact name match (more strict than fuzzy matching)
        if (!refundInfo) {
          const normalizedItemName = item.name.toLowerCase().trim();
          for (const key in refundTracker) {
            if (key.startsWith('refund_')) continue; // Skip generic entries
            
            const refundItemName = key.replace(/_/g, ' ').toLowerCase().trim();
            // Only match if names are exactly the same
            if (normalizedItemName === refundItemName) {
              refundInfo = refundTracker[key];
              matchedKey = key;
              break;
            }
          }
        }
        
        // If we found refund info, update the item
        if (refundInfo) {
          // Update total quantity in the tracker
          refundTracker[matchedKey].totalQuantity = item.quantity;
          
          // Determine if fully or partially refunded
          const isFullyRefunded = refundInfo.refundedQuantity >= item.quantity;
          const isPartiallyRefunded = refundInfo.refundedQuantity > 0 && !isFullyRefunded;
          
          return {
            ...item,
            refundedQuantity: refundInfo.refundedQuantity,
            isFullyRefunded,
            isPartiallyRefunded
          };
        }
        
        // No match found, ensure refund properties are reset
        return {
          ...item,
          refundedQuantity: 0,
          isFullyRefunded: false,
          isPartiallyRefunded: false
        };
      });
    });
  }

  // ----------------------------------------------------------------
  // 6) Payment tab & Additional Payment logic
  // ----------------------------------------------------------------
  
  // Fetch payments and process refunds immediately when component mounts
  useEffect(() => {
    async function initializePaymentsAndRefunds() {
      if (order.id) {
        try {
          // Initializing payments and refunds
          // Fetch payments
          const resp = await orderPaymentsApi.getPayments(order.id);
          const responseData = resp as any;
          let { payments: list, total_paid, total_refunded } = responseData.data;
          
          // Payments fetched successfully
          
          // If no payments exist but order has total, simulate an initial payment
          if (list.length === 0 && order.total > 0) {
            // No payments found, creating initial payment
            const initialPayment: OrderPaymentLocal = {
              id: 0,
              payment_type: 'initial',
              amount: parseFloat(order.total),
              payment_method: order.payment_method || 'credit_card',
              status: 'completed',
              created_at: order.createdAt || new Date().toISOString(),
              description: 'Initial payment',
              transaction_id: order.transaction_id || 'N/A',
            };
            list = [initialPayment];
            total_paid = parseFloat(order.total);
            total_refunded = 0;
          }
          
          // Set payments
          setPayments(list);
          setMaxRefundable(Math.max(0, total_paid - total_refunded));
          
          // Process refunds immediately
          if (list.length > 0) {
            const refundTransactions = list.filter((p: OrderPaymentLocal) => p.payment_type === 'refund');
            // Processing refund transactions
            
            // Always build the refund tracker, even if no refund transactions
            // This ensures we process any refunds that might exist
            const refundTracker = buildRefundTracker(list);
            // Refund tracker built successfully
            
            // Set the refunded items map
            setRefundedItemsMap(refundTracker);
            
            // Apply refund information to local items immediately
            // We call this directly instead of relying on the useEffect dependency
            updateLocalItemsWithRefundInfo(refundTracker);
            
            if (refundTransactions.length > 0) {
              // Update total to reflect refunds
              const currentSubtotal = calculateSubtotal();
              const sumRefundsLocal = list
                .filter((p: OrderPaymentLocal) => p.payment_type === 'refund')
                .reduce((acc: number, p: OrderPaymentLocal) => acc + parseFloat(String(p.amount)), 0);
              
              if (sumRefundsLocal > 0) {
                const newNet = Math.max(0, parseFloat(currentSubtotal) - sumRefundsLocal);
                setLocalTotal(newNet.toFixed(2));
              }
            }
          }
        } catch (err) {
          console.error('Failed to load payments:', err);
          
          // Fallback if the API fails
          if (order.total > 0) {
            setMaxRefundable(parseFloat(order.total));
            const initialPayment: OrderPaymentLocal = {
              id: 0,
              payment_type: 'initial',
              amount: parseFloat(order.total),
              payment_method: order.payment_method || 'credit_card',
              status: 'completed',
              created_at: order.createdAt || new Date().toISOString(),
              description: 'Initial payment',
              transaction_id: order.transaction_id || 'N/A',
            };
            setPayments([initialPayment]);
          }
        }
      }
    }
    
    // Call immediately when component mounts
    initializePaymentsAndRefunds();
  }, [order.id]);
  
  // Single useEffect to handle all payment and refund-related updates
  // This prevents race conditions between multiple useEffects
  useEffect(() => {
    if (order.id && payments.length > 0) {
      // Processing payments and refunds in unified handler
      
      // 1. Build refund tracker
      const refundTracker = buildRefundTracker(payments);
      
      // 2. Update refundedItemsMap state (but don't depend on it for updates)
      setRefundedItemsMap(refundTracker);
      
      // 3. Apply refund information directly to items
      // This ensures the refund info is applied in a single, consistent way
      updateLocalItemsWithRefundInfo(refundTracker);
      
      // 4. Update total based on refunds
      const currentSubtotal = calculateSubtotal();
      const sumRefundsLocal = payments
        .filter((p: OrderPaymentLocal) => p.payment_type === 'refund')
        .reduce((acc: number, p: OrderPaymentLocal) => acc + parseFloat(String(p.amount)), 0);
      
      if (sumRefundsLocal > 0) {
        const newNet = Math.max(0, parseFloat(currentSubtotal) - sumRefundsLocal);
        setLocalTotal(newNet.toFixed(2));
      }
      
      // 5. Recalculate max refundable amount based on all payments
      const newMaxRefundable = calculateMaxRefundableAmount(payments);
      // Recalculating max refundable amount
      setMaxRefundable(newMaxRefundable);
    }
  }, [order.id, payments]);
  
  // Refresh payments when switching to payments tab
  useEffect(() => {
    if (activeTab === 'payments' && order.id) {
      // Switching to payments tab, refreshing data
      fetchPayments().then(() => {
        // After fetching payments, manually recalculate max refundable amount
        if (payments.length > 0) {
          const newMaxRefundable = calculateMaxRefundableAmount(payments);
          // Tab switch - Recalculating max refundable amount
          setMaxRefundable(newMaxRefundable);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, order.id]);
  
  // Check for items that need payment and update isProcessingPayment state
  useEffect(() => {
    // Check if any items need payment
    const hasItemsNeedingPayment = localItems.some(it => it.paymentStatus === 'needs_payment');
    
    // Only set isProcessingPayment to true if it's not already true
    // This prevents overriding the state when a payment or refund is in progress
    if (hasItemsNeedingPayment && !isProcessingPayment) {
      setIsProcessingPayment(true);
    } else if (!hasItemsNeedingPayment && !showRefundModal && !showAdditionalPaymentModal) {
      // Only set to false if no payment or refund is in progress
      setIsProcessingPayment(false);
    }
  }, [localItems, showRefundModal, showAdditionalPaymentModal, isProcessingPayment]);

  async function fetchPayments() {
    if (!order.id) return;
    setLoadingPayments(true);
    try {
      // Fetching payments for order
      const resp = await orderPaymentsApi.getPayments(order.id);
      // Typically the backend returns { payments, total_paid, total_refunded, ... }
      const responseData = resp as any;
      let { payments: list, total_paid, total_refunded } = responseData.data;

      // Processing API response for payments
      const paymentCount = list?.length || 0;

      // Check if we need to simulate an initial payment
      const hasInitialPayment = list.some((p: OrderPaymentLocal) => p.payment_type === 'initial');
      
      // Check if there's an additional payment that covers the full amount
      const hasFullAdditionalPayment = list.some((p: OrderPaymentLocal) =>
        p.payment_type === 'additional' &&
        Math.abs(parseFloat(String(p.amount)) - parseFloat(String(order.total))) < 0.01
      );
      
      // Only simulate an initial payment if there's no initial payment AND no full additional payment
      if ((list.length === 0 || !hasInitialPayment) &&
          !hasFullAdditionalPayment &&
          order.total > 0 &&
          order.payment_method) {
        // Creating simulated initial payment
        
        // Calculate the initial payment amount
        // If there's a payment_amount, use that, otherwise use the total
        const initialAmount = parseFloat(order.payment_amount || order.total);
        
        // Create the initial payment object with details from the order
        const initialPayment: OrderPaymentLocal = {
          id: 0,
          payment_type: 'initial',
          amount: initialAmount,
          payment_method: order.payment_method,
          status: 'completed',
          created_at: order.createdAt || new Date().toISOString(),
          description: 'Initial payment',
          transaction_id: order.transaction_id || 'N/A',
          payment_details: order.payment_details || undefined
        };
        
        // Add the initial payment to the beginning of the list
        list = [initialPayment, ...list];
        
        // Update the total_paid to include this initial payment
        total_paid = (total_paid || 0) + initialAmount;
        total_refunded = total_refunded || 0;
        
        // Payment list updated with initial payment
      }

      // Calculate max refundable amount using our helper function
      const calculatedMaxRefundable = calculateMaxRefundableAmount(list);
      
      // Use API values if provided, otherwise use calculated values
      let newMaxRefundable = calculatedMaxRefundable;
      if (total_paid !== undefined && total_refunded !== undefined) {
        newMaxRefundable = Math.max(0, total_paid - total_refunded);
      }
      
      // Setting max refundable amount
      setMaxRefundable(newMaxRefundable);

      // Convert "additional" payments to "initial" payments in the UI if they're the only payment for the order
      // This ensures consistent display across all payment methods
      if (list.length === 1 && list[0].payment_type === 'additional') {
        // Converting additional payment to initial payment for UI consistency
        
        // Extract cash payment details if available
        const payment = list[0];
        const cashReceived = payment.cash_received;
        const changeDue = payment.change_due;
        
        // Create payment details if they don't exist
        const paymentDetails = payment.payment_details || {};
        
        // Get payment details from the order if available
        const orderPaymentDetails = order.payment_details ?
          (typeof order.payment_details === 'string' ?
            JSON.parse(order.payment_details) :
            order.payment_details) :
          {};
        
        // Ensure all cash payment details are preserved
        const enhancedPaymentDetails = {
          ...orderPaymentDetails,
          ...paymentDetails,
          status: paymentDetails.status || payment.status || orderPaymentDetails.status || 'succeeded',
          payment_method: payment.payment_method || orderPaymentDetails.payment_method,
          transaction_id: payment.transaction_id || orderPaymentDetails.transaction_id,
          payment_date: paymentDetails.payment_date || orderPaymentDetails.payment_date || new Date().toISOString().split('T')[0],
          notes: paymentDetails.notes || orderPaymentDetails.notes || `Cash payment - Received: $${cashReceived?.toFixed(2) || orderPaymentDetails.cash_received?.toFixed(2) || payment.amount}, Change: $${changeDue?.toFixed(2) || orderPaymentDetails.change_due?.toFixed(2) || '0.00'}`,
          cash_received: cashReceived || orderPaymentDetails.cash_received,
          change_due: changeDue || orderPaymentDetails.change_due
        };
        
        // Payment details enhanced with additional information
        
        // Create the enhanced payment with all details preserved
        list = [{
          ...payment,
          payment_type: 'initial',
          description: 'Initial payment',
          payment_details: enhancedPaymentDetails
        }];
      }

      setPayments(list);
      setMaxRefundable(newMaxRefundable);
    } catch (err) {
      console.error('Failed to load payments:', err);

      // Fallback if the API fails
      if (order.total > 0) {
        // API call failed, using order.total as fallback
        setMaxRefundable(parseFloat(order.total));
        const initialPayment: OrderPaymentLocal = {
          id: 0,
          payment_type: 'initial',
          amount: parseFloat(order.total),
          payment_method: order.payment_method || 'credit_card',
          status: 'completed',
          created_at: order.createdAt || new Date().toISOString(),
          description: 'Initial payment',
          transaction_id: order.transaction_id || 'N/A',
        };
        setPayments([initialPayment]);
      }
    } finally {
      setLoadingPayments(false);
    }
  }

  function handleRefundCreated(
    refundedItems: Array<{id: number, quantity: number}>,
    inventoryActions: Array<{
      itemId: number,
      quantity: number,
      action: 'return_to_inventory' | 'mark_as_damaged',
      reason?: string
    }>
  ) {
    // Log inventory actions for debugging
    // Processing inventory actions after refund
    
    // Process inventory actions
    inventoryActions.forEach(action => {
      // Ensure quantity is a valid number and greater than 0
      const quantity = Math.max(1, action.quantity || 1); // Default to 1 if undefined or 0
      
      if (action.action === 'mark_as_damaged') {
        // Marking items as damaged in inventory
        setItemsToMarkAsDamaged(prev => [
          ...prev,
          {
            itemId: action.itemId,
            quantity: quantity,
            reason: action.reason || 'Damaged during refund'
          }
        ]);
      } else if (action.action === 'return_to_inventory') {
        // Returning items to inventory
        setItemsToReturnToInventory(prev => [
          ...prev,
          {
            itemId: action.itemId,
            quantity: quantity
          }
        ]);
      }
    });
    
    // After a refund, re-fetch payments
    fetchPayments().then(() => {
      // After fetching payments, rebuild the refund tracker
      if (payments.length > 0) {
        const refundTracker = buildRefundTracker(payments);
        setRefundedItemsMap(refundTracker);
        
        // Apply refund information to local items
        updateLocalItemsWithRefundInfo(refundTracker);
      }
      
      // Recalc local total from items
      const currentSubtotal = calculateSubtotalFromItems(localItems);
      const sumRefundsLocal = payments
        .filter((p: OrderPaymentLocal) => p.payment_type === 'refund')
        .reduce((acc: number, p: OrderPaymentLocal) => acc + parseFloat(String(p.amount)), 0);
      const newNet = Math.max(0, currentSubtotal - sumRefundsLocal);
      setLocalTotal(newNet.toFixed(2));

      // Check if all items are now refunded
      const allItemsRefunded = localItems.every(item =>
        item.isFullyRefunded ||
        (item.refundedQuantity && item.refundedQuantity >= item.quantity)
      );
      
      // Update status based on refund state
      if (allItemsRefunded) {
        setLocalStatus('refunded');
      }
      // No longer changing status for partial refunds
      
      // Recalculate max refundable amount after refund
      const newMaxRefundable = calculateMaxRefundableAmount(payments);
      // After refund - Recalculating max refundable amount
      setMaxRefundable(newMaxRefundable);
      
      // Reset processing payment state since refund is complete
      setIsProcessingPayment(false);
    });
  }

  function handleProcessAdditionalPayment() {
    // Identify items needing payment
    const itemsNeedingPayment = localItems
      .filter((it) => it.paymentStatus === 'needs_payment')
      .map((it) => ({
        id:
          typeof it.id === 'string'
            ? parseInt(it.id, 10) || 0
            : it.id || 0,
        name: it.name,
        price: it.price,
        quantity: it.unpaidQuantity ?? it.quantity,
      }));

    if (itemsNeedingPayment.length === 0) {
      alert('No items require payment.');
      return;
    }

    // Set processing payment state to true
    setIsProcessingPayment(true);
    
    // Show the additional payment modal
    setShowAdditionalPaymentModal(true);
  }

  function handleAdditionalPaymentCompleted() {
    // Additional payment completed, updating items and refetching payments
    
    // Mark items as paid
    setLocalItems((prev) =>
      prev.map((it) =>
        it.paymentStatus === 'needs_payment'
          ? {
              ...it,
              paymentStatus: 'already_paid',
              // Increase paidQuantity to the full new quantity
              paidQuantity: it.quantity,
              unpaidQuantity: 0,
            }
          : it
      )
    );

    // Reload payment history
    fetchPayments().then(() => {
      // After fetching payments, manually recalculate max refundable amount
      if (payments.length > 0) {
        const newMaxRefundable = calculateMaxRefundableAmount(payments);
        // After payment completion - Recalculating max refundable amount
        setMaxRefundable(newMaxRefundable);
      }
    });
    
    // Reset processing payment state
    setIsProcessingPayment(false);
    
    // Close the modal
    setShowAdditionalPaymentModal(false);
  }

  function handlePaymentStatusChange(
    editId: string,
    status: 'needs_payment' | 'already_paid'
  ) {
    // Sometimes you might let the user forcibly toggle the payment status
    setLocalItems((prev) =>
      prev.map((it) => {
        if (it._editId === editId) {
          return { ...it, paymentStatus: status };
        }
        return it;
      })
    );
  }

  // ----------------------------------------------------------------
  // 7) Inventory & saving the final order
  // ----------------------------------------------------------------
  function findOriginalItem(item: OrderItem) {
    if (!item.id) return undefined;
    return originalItems.find(
      (orig) => orig.id && String(orig.id) === String(item.id)
    );
  }

  async function processInventoryChanges() {
    // Optionally, do any required inventory logic here in your backend calls
  }

  // -------------- NEW INVENTORY VALIDATION BEFORE SAVE --------------
  async function validateInventoryAvailability(): Promise<{
    success: boolean;
    error?: string;
    items?: Array<{ id: string | number; name: string; requested: number; available: number }>;
  }> {
    try {
      const itemsToValidate = localItems
        .filter((item) => item.enable_stock_tracking)
        .map((item) => ({
          id: item.id,
          quantity: item.quantity,
          originalQuantity: findOriginalItem(item)?.quantity || 0,
        }));
      if (itemsToValidate.length === 0) return { success: true };

      // Perform client-side validation since there's no backend endpoint
      const validationResults = await Promise.all(
        itemsToValidate.map(async (item) => {
          try {
            // Get the latest item data from the API
            const menuItem = await menuItemsApi.getById(item.id as string | number);
            
            // Calculate effective available quantity
            const availableQty = menuItem.available_quantity || 0;
            const effectiveAvailable = availableQty + item.originalQuantity;
            
            return {
              id: item.id,
              name: menuItem.name,
              requested: item.quantity,
              available: effectiveAvailable,
              isValid: item.quantity <= effectiveAvailable
            };
          } catch (err) {
            console.error(`Failed to validate item ${item.id}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any null results and find invalid items
      const validResults = validationResults.filter(r => r !== null) as Array<any>;
      const invalidItems = validResults.filter(r => !r.isValid);
      
      if (invalidItems.length > 0) {
        return {
          success: false,
          error: 'Some items have limited availability',
          items: invalidItems.map(item => ({
            id: item.id,
            name: item.name,
            requested: item.requested,
            available: item.available
          }))
        };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Inventory validation error:', error);
      return {
        success: false,
        error: 'Failed to verify inventory availability. Please try again.',
      };
    }
  }

  function handleInventoryValidationFailure(
    error: string,
    items?: Array<{ id: string | number; name: string; requested: number; available: number }>
  ) {
    if (items && items.length > 0) {
      toastUtils.custom(
        (t) => (
          <div className="bg-white shadow-lg rounded-lg p-4 max-w-md border border-red-200">
            <p className="font-bold text-red-600">Some items have limited availability</p>
            <p className="mt-1">The following items have changed since you started editing:</p>
            <ul className="mt-2 list-disc pl-4">
              {items.map((item) => (
                <li key={item.id}>
                  {item.name}: <span className="text-red-600 font-medium">
                    {item.available} available
                  </span>{' '}
                  (you requested {item.requested})
                </li>
              ))}
            </ul>
            <p className="mt-2">Would you like to adjust quantities to available amounts or cancel?</p>
            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => {
                  adjustToAvailableQuantities(items);
                  toastUtils.dismiss(t.id);
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Adjust Quantities
              </button>
              <button
                onClick={() => toastUtils.dismiss(t.id)}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        { duration: 10000 }
      );
    } else {
      toastUtils.error(`Inventory validation failed: ${error}`);
    }
  }

  function adjustToAvailableQuantities(
    items: Array<{ id: string | number; name: string; available: number }>
  ) {
    setLocalItems((prev) =>
      prev.map((item) => {
        const stockInfo = items.find((i) => i.id === item.id);
        if (stockInfo) {
          return {
            ...item,
            quantity: Math.min(item.quantity, stockInfo.available),
          };
        }
        return item;
      })
    );
    toastUtils.success('Quantities adjusted to match available inventory');
  }

  // ----------------------------------------------------------------
  // 8) Final saving logic
  // ----------------------------------------------------------------
  function handleSave() {
    // If going from pending -> preparing, show ETA modal
    const { shouldShowEtaModal } = handleOrderPreparationStatus(
      order,
      localStatus,
      originalStatus
    );
    if (shouldShowEtaModal) {
      setShowEtaModal(true);
      return;
    }
    proceedWithSave();
  }

  function handleConfirmEta() {
    const pickupTime = calculatePickupTime(order, etaMinutes);
    proceedWithSave(pickupTime);
    setShowEtaModal(false);
  }

  function handleConfirmEtaUpdate() {
    const pickupTime = calculatePickupTime(order, updateEtaMinutes);
    proceedWithSave(pickupTime);
    setShowEtaUpdateModal(false);
  }

  // -------------- UPDATED PROCEED WITH SAVE --------------
  async function proceedWithSave(pickupTime?: string) {
    try {
      // 1) Verify inventory availability first
      const inventoryValidation = await validateInventoryAvailability();
      if (!inventoryValidation.success) {
        handleInventoryValidationFailure(
          inventoryValidation.error || 'Unknown error',
          inventoryValidation.items
        );
        return;
      }

      // 2) Process inventory changes if needed
      await processInventoryChanges();

      // 3) Mark items as damaged (if any)
      if (itemsToMarkAsDamaged.length > 0) {
        const damageCalls = itemsToMarkAsDamaged.map((d) =>
          menuItemsApi.markAsDamaged(d.itemId, {
            quantity: d.quantity,
            reason: d.reason,
            order_id: order.id,
          })
        );
        await Promise.all(damageCalls);
      }

      // 4) Return items to inventory (if any)
      if (itemsToReturnToInventory.length > 0) {
        try {
          // Processing items to return to inventory
          
          const inventoryCalls = itemsToReturnToInventory.map(async (i) => {
            try {
              // Get current item details to know the current stock level
              const menuItem = await menuItemsApi.getById(i.itemId);
              
              // Calculate new stock level by adding the returned quantity
              const currentStockLevel = menuItem.stock_quantity || 0;
              // Ensure quantity is a valid number
              const quantityToAdd = i.quantity || 1; // Default to 1 if undefined or 0
              const newStockLevel = currentStockLevel + quantityToAdd;
              
              // Returning item to inventory with updated stock levels
              
              // Update the stock level with the new total
              const updateResult = await menuItemsApi.updateStock(i.itemId, {
                stock_quantity: newStockLevel,
                reason_type: 'return',
                reason_details: `Items returned from refund of Order #${order.id}`,
              });
              
              // Inventory update successful
              return updateResult;
            } catch (err) {
              console.error(`Failed to update inventory for item ${i.itemId}:`, err);
              // Show a toast notification to the user
              toastUtils.error(`Failed to return item to inventory. Please check the console for details.`);
              return Promise.reject(err);
            }
          });

          await Promise.all(inventoryCalls);
        } catch (error) {
          console.error('Error processing inventory returns:', error);
          alert('Failed to return some items to inventory. Check console for details.');
        }
      }

      // 5) Process all payment adjustments
      for (const refund of paymentAdjustments.refunds) {
        try {
          await orderPaymentOperationsApi.createPartialRefund(order.id, {
            amount: refund.amount,
            reason: refund.reason,
            items: [
              {
                id: refund.item.id || 0,
                name: refund.item.name,
                quantity: refund.item.quantity,
                price: refund.item.price,
              },
            ],
            refunded_items: [
              {
                id: refund.item.id || 0,
                name: refund.item.name,
                quantity: refund.item.quantity,
                price: refund.item.price,
              },
            ],
          });
        } catch (error) {
          console.error('Error processing refund:', error);
          alert(
            `Failed to process refund for ${refund.item.name}. Please try again.`
          );
          return;
        }
      }

      //    b) Store credits
      for (const credit of paymentAdjustments.storeCredits) {
        try {
          await orderPaymentOperationsApi.addStoreCredit(order.id, {
            amount: credit.amount,
            reason: credit.reason,
            email: order.contact_email,
          });
        } catch (error) {
          console.error('Error processing store credit:', error);
          alert(
            `Failed to process store credit for ${credit.item.name}. Please try again.`
          );
          return;
        }
      }

      //    c) Order total adjustments
      for (const adjustment of paymentAdjustments.adjustments) {
        try {
          await orderPaymentOperationsApi.adjustOrderTotal(order.id, {
            new_total: parseFloat(localTotal),
            reason: adjustment.reason,
          });
        } catch (error) {
          console.error('Error processing total adjustment:', error);
          alert('Failed to process total adjustment. Please try again.');
          return;
        }
      }

      // 6) Build updated order object
      const parsedTotal = parseFloat(localTotal) || 0;
      const cleanedItems = localItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        notes: i.notes || '',
        customizations: i.customizations || {},
        ...(i.enable_stock_tracking && {
          enable_stock_tracking: i.enable_stock_tracking,
          stock_quantity: i.stock_quantity,
          damaged_quantity: i.damaged_quantity,
          low_stock_threshold: i.low_stock_threshold,
        }),
      }));

      // Check if all items are refunded to determine the correct status
      const areAllItemsRefunded = localItems.length > 0 && localItems.every(item =>
        item.isFullyRefunded || (item.refundedQuantity && item.refundedQuantity >= item.quantity)
      );
      
      // If all items are refunded, set status to "refunded" regardless of UI state
      const finalStatus = areAllItemsRefunded ? 'refunded' : localStatus;
      
      // Log for debugging
      if (areAllItemsRefunded) {
        // All items are refunded, setting order status to "refunded"
      }

      const updatedOrder = {
        id: order.id,
        restaurant_id: order.restaurant_id,
        user_id: order.user_id,
        items: cleanedItems,
        total: parsedTotal,
        status: finalStatus,
        special_instructions: localInstructions,
        contact_name: order.contact_name,
        contact_phone: order.contact_phone,
        contact_email: order.contact_email,
        payment_method: order.payment_method,
        transaction_id: order.transaction_id,
        payment_status: order.payment_status,
        payment_amount: order.payment_amount,
        promo_code: order.promo_code,
        merchandise_items: order.merchandise_items || [],
        estimated_pickup_time: pickupTime || order.estimatedPickupTime,
      };

      // 7) Trigger parent onSave
      onSave(updatedOrder);
    } catch (error: any) {
      console.error('Error saving order changes:', error);

      // Enhanced error handling for inventory/POS failures
      if (error.response?.status === 503 || error.code === 'NETWORK_ERROR') {
toastUtils.error('Network issue when verifying inventory. Please try again or check your connection.');
      } else {
        toastUtils.error('Failed to save order changes. Check console for details.');
      }
    }
  }

  // ----------------------------------------------------------------
  // 9) UI rendering & helper functions
  // ----------------------------------------------------------------
  function calculateSubtotalFromItems(items: OrderItem[]) {
    return items.reduce((sum, it) => {
      const price = parseFloat(String(it.price)) || 0;
      const qty = parseInt(String(it.quantity), 10) || 0;
      return sum + price * qty;
    }, 0);
  }

  function calculateSubtotal() {
    return calculateSubtotalFromItems(localItems).toFixed(2);
  }
  
  /**
   * Helper function to calculate the total paid amount, avoiding double-counting
   * when we have both an initial payment and a full additional payment with the same amount
   */
  function calculateTotalPaid(paymentsList: OrderPaymentLocal[]): number {
    if (!paymentsList || paymentsList.length === 0) {
      return 0;
    }
    
    // Find initial payments and full additional payments with the same amount
    const initialPayments = paymentsList.filter(p => p.payment_type === 'initial');
    
    // If we have initial payments, check for matching additional payments
    if (initialPayments.length > 0) {
      // Create a copy of the payments list to avoid modifying the original
      let paymentsToCount = [...paymentsList];
      
      // For each initial payment, check if there's a matching additional payment
      initialPayments.forEach(initialPayment => {
        const matchingAdditionalPayments = paymentsList.filter(p =>
          p.payment_type === 'additional' &&
          Math.abs(parseFloat(String(p.amount)) - parseFloat(String(initialPayment.amount))) < 0.01
        );
        
        // If we have matching additional payments, remove the initial payment to avoid double-counting
        if (matchingAdditionalPayments.length > 0) {
          paymentsToCount = paymentsToCount.filter(p => p !== initialPayment);
        }
      });
      
      // Calculate total from the filtered list
      return paymentsToCount
        .filter(p => p.payment_type !== 'refund')
        .reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);
    }
    
    // If no initial payments, just calculate normally
    return paymentsList
      .filter(p => p.payment_type !== 'refund')
      .reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);
  }

  /**
   * Helper function to calculate the max refundable amount based on the payments array
   * This ensures consistent calculation throughout the application
   */
  function calculateMaxRefundableAmount(paymentsList: OrderPaymentLocal[]): number {
    if (!paymentsList || paymentsList.length === 0) {
      return 0;
    }
    
    // Use the calculateTotalPaid function to avoid double-counting
    const totalPaid = calculateTotalPaid(paymentsList);
    
    const totalRefunded = paymentsList
      .filter((p: OrderPaymentLocal) => p.payment_type === 'refund')
      .reduce((acc: number, p: OrderPaymentLocal) => acc + parseFloat(String(p.amount)), 0);
    
    return Math.max(0, totalPaid - totalRefunded);
  }

  function getStatusBadgeColor(status: string) {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      confirmed: 'bg-purple-100 text-purple-800',
      refunded: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-200 text-gray-800';
  }

  // ------------------ RENDER TABS ------------------
  // Helper function to count total refunded items
  function getTotalRefundedItemsCount() {
    return localItems.filter(item => 
      item.isFullyRefunded || item.isPartiallyRefunded
    ).length;
  }

  // Removed the redundant effect that was causing circular dependencies

  function renderItemsTab() {
    const currentSubtotal = calculateSubtotal();
    
    // Sum of refunds from the payments array
    const sumRefundsHere = payments
      .filter((p: OrderPaymentLocal) => p.payment_type === 'refund')
      .reduce((acc: number, p: OrderPaymentLocal) => acc + parseFloat(String(p.amount)), 0);

    // Calculate the actual net total after refunds
    const netTotal = Math.max(0, parseFloat(currentSubtotal) - sumRefundsHere);

    // Calculate payment summary information
    const itemsNeedingPayment = localItems.filter(
      (it) => it.paymentStatus === 'needs_payment'
    );

    const totalUnpaidAmount = itemsNeedingPayment.reduce((sum, item) => {
      const price = parseFloat(String(item.price)) || 0;
      const unpaidQty = item.unpaidQuantity || 0;
      return sum + price * unpaidQty;
    }, 0);

    const hasItemsNeedingPayment = itemsNeedingPayment.length > 0;
    const hasRefundedItems = getTotalRefundedItemsCount() > 0;

    return (
      <div className="space-y-4 p-4 sm:p-6">
        {/* Refunded Items Banner */}
        {hasRefundedItems && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-md mb-4">
            <div className="flex items-start">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <div>
                <h4 className="font-medium text-amber-800">
                  This order contains refunded items
                </h4>
                <p className="text-sm text-amber-700">
                  {getTotalRefundedItemsCount()} {getTotalRefundedItemsCount() === 1 ? 'item has' : 'items have'} been fully or partially refunded.
                </p>
                <button 
                  onClick={() => setActiveTab('payments')}
                  className="text-sm text-amber-800 underline mt-1 hover:text-amber-900"
                >
                  View payment history
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Payment Summary Alert - show at the top of the Items tab */}
        {hasItemsNeedingPayment && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8c-1.657 0-3
                    .895-3 2s1.343 2
                    3
                    2
                    3
                    .895
                    3
                    2-1.343
                    2-3
                    2m0-8c1.11
                    0
                    2.08.402
                    2.599
                    1M12
                    8V7m0
                    1v8m0
                    0v1m0-1c-1.11
                    0-2.08-.402-2.599-1M21
                    12a9
                    9
                    0
                    11-18
                    0
                    9
                    9
                    0
                    0118
                    0z"
                />
              </svg>
              <div>
                <h4 className="font-medium text-sm text-amber-800">
                  Payment Required
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  {itemsNeedingPayment.reduce(
                    (total, item) => total + (item.unpaidQuantity || 0),
                    0
                  ) === 1 ? (
                    <>1 unit requires payment.</>
                  ) : (
                    <>
                      {itemsNeedingPayment.reduce(
                        (total, item) => total + (item.unpaidQuantity || 0),
                        0
                      )}{' '}
                      units require payment.
                    </>
                  )}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  <span className="font-medium">
                    Amount due: ${totalUnpaidAmount.toFixed(2)}
                  </span>
                </p>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setActiveTab('payments');
                      setTimeout(() => handleProcessAdditionalPayment(), 100);
                    }}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md text-sm font-medium transition-colors inline-flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12
                          6v6m0
                          0v6m0-6h6m-6
                          0H6"
                      />
                    </svg>
                    Process Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {localItems.map((item, idx) => (
            <div
              key={item._editId}
              className={`border border-gray-200 rounded-lg p-4 space-y-3 transition-shadow hover:shadow-md ${
                item.isFullyRefunded ? 'bg-gray-100' : ''
              }`}
            >
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <h5 className={`font-medium ${item.isFullyRefunded ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {item.isFullyRefunded ? <s>Item {idx + 1}</s> : `Item ${idx + 1}`}
                  </h5>
                  
                  {/* Refund badges with tooltips */}
                  {item.isFullyRefunded && (
                    <div className="relative group ml-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Refunded
                      </span>
                      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -mt-1 left-0 ml-6 w-48">
                        {refundedItemsMap[item.id ? String(item.id) : item.name.toLowerCase().replace(/\s+/g, '_')]?.refundTransactions.map((t, i) => (
                          <div key={i} className="mb-1">
                            Refunded on {new Date(t.date).toLocaleDateString()}
                          </div>
                        )) || "Refund details not available"}
                      </div>
                    </div>
                  )}
                  {item.isPartiallyRefunded && (
                    <div className="relative group ml-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        Partially Refunded ({item.refundedQuantity} of {item.quantity + (item.refundedQuantity || 0)} units)
                      </span>
                      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -mt-1 left-0 ml-6 w-48">
                        {refundedItemsMap[item.id ? String(item.id) : item.name.toLowerCase().replace(/\s+/g, '_')]?.refundTransactions.map((t, i) => (
                          <div key={i} className="mb-1">
                            {t.quantity} unit(s) refunded on {new Date(t.date).toLocaleDateString()}
                          </div>
                        )) || "Refund details not available"}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item._editId)}
                  disabled={item.isFullyRefunded}
                  className={`text-sm font-medium flex items-center ${
                    item.isFullyRefunded 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-red-600 hover:text-red-700 transition-colors'
                  }`}
                >
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19
                        7l-.867
                        12.142A2
                        2
                        0
                        0116.138
                        21H7.862a2
                        2
                        0
                        01-1.995-1.858L5
                        7m5
                        4v6m4-6v6m1-10V4a1
                        1
                        0
                        00-1-1h-4a1
                        1
                        0
                        00-1
                        1v3M4
                        7h16"
                    />
                  </svg>
                  Remove
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  className={`border border-gray-300 rounded-md px-3 py-2 w-full text-sm ${
                    item.isFullyRefunded ? 'bg-gray-100 text-gray-500 line-through' : ''
                  }`}
                  value={item.name}
                  onChange={(e) =>
                    handleItemChange(item._editId, 'name', e.target.value)
                  }
                  disabled={item.isFullyRefunded}
                />
              </div>

              {/* Quantity & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Quantity
                    </label>
                    {item.paymentStatus === 'already_paid' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Already Paid
                      </span>
                    )}
                  </div>
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-2 ${
                        item.isFullyRefunded 
                          ? 'bg-gray-100 text-gray-400' 
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                      } border-r border-gray-300 transition-colors`}
                      onClick={() =>
                        updateItemQuantity(
                          item._editId,
                          Math.max(1, item.quantity - 1)
                        )
                      }
                      disabled={item.quantity <= 1 || item.isFullyRefunded || (item.isPartiallyRefunded && item.quantity <= (item.refundedQuantity || 0))}
                      aria-label="Decrease quantity"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20
                            12H4"
                        />
                      </svg>
                    </button>
                    <input
                      type="text"
                      className={`w-full px-3 py-2 text-center border-0 focus:ring-0 ${
                        item.isFullyRefunded ? 'bg-gray-100 text-gray-500' : ''
                      }`}
                      value={item.quantity}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        if (newVal === '' || /^\d+$/.test(newVal)) {
                          const parsedVal =
                            newVal === ''
                              ? 1
                              : Math.max(1, parseInt(newVal, 10));
                          
                          // For partially refunded items, don't allow quantity below refunded amount
                          if (item.isPartiallyRefunded && parsedVal < (item.refundedQuantity || 0)) {
                            toastUtils.error(`Cannot reduce quantity below refunded amount (${item.refundedQuantity})`);
                            return;
                          }
                          
                          updateItemQuantity(item._editId, parsedVal);
                        }
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={item.isFullyRefunded}
                    />
                    <button
                      type="button"
                      className={`px-3 py-2 ${
                        item.isFullyRefunded 
                          ? 'bg-gray-100 text-gray-400' 
                          : 'bg-green-50 hover:bg-green-100 text-green-800'
                      } border-l border-gray-300 transition-colors`}
                      onClick={() =>
                        updateItemQuantity(item._editId, item.quantity + 1)
                      }
                      disabled={item.isFullyRefunded}
                      aria-label="Increase quantity"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12
                            6v6m0
                            0v6m0-6h6m-6
                            0H6"
                        />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Show refund breakdown for partially refunded items */}
                  {item.isPartiallyRefunded && (
                    <p className="mt-1 text-xs text-gray-600">
                      <span className="font-medium">{item.quantity}</span> active, 
                      <span className="font-medium text-red-600"> {item.refundedQuantity}</span> refunded
                    </p>
                  )}
                  {item.paymentStatus === 'already_paid' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Decreasing quantity will require a refund or
                      store-credit flow.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  {/* Show original price and discounted price for staff orders */}
                  {order.is_staff_order && item.pre_discount_price && item.pre_discount_price !== item.price ? (
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center">
                        <span className="line-through text-gray-400 mr-2 text-xs">Original: ${Number(item.pre_discount_price).toFixed(2)}</span>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Staff Discount</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          className={`border border-gray-300 rounded-md pl-7 pr-3 py-2 w-full text-sm ${
                            item.isFullyRefunded ? 'bg-gray-100 text-gray-500 line-through' : ''
                          }`}
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(item._editId, 'price', e.target.value)
                          }
                          disabled={item.isFullyRefunded}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        className={`border border-gray-300 rounded-md pl-7 pr-3 py-2 w-full text-sm ${
                          item.isFullyRefunded ? 'bg-gray-100 text-gray-500 line-through' : ''
                        }`}
                        value={item.price}
                        onChange={(e) =>
                          handleItemChange(item._editId, 'price', e.target.value)
                        }
                        disabled={item.isFullyRefunded}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  className={`border border-gray-300 rounded-md px-3 py-2 w-full text-sm ${
                    item.isFullyRefunded ? 'bg-gray-100 text-gray-500 line-through' : ''
                  }`}
                  value={item.notes || ''}
                  onChange={(e) =>
                    handleItemChange(item._editId, 'notes', e.target.value)
                  }
                  placeholder="Special requests / modifications"
                  disabled={item.isFullyRefunded}
                />
              </div>

              {/* --- NEW: Enhanced Inventory Status UI --- */}
              {item.enable_stock_tracking && item.stock_quantity !== undefined && (
                <div className="mt-1">
                  {(() => {
                    const availableQty = calculateAvailableQuantity(item);
                    const originalItem = findOriginalItem(item);
                    const originalQty = originalItem
                      ? originalItem.quantity
                      : 0;
                    const effectiveAvailable = availableQty + originalQty;
                    const remainingAfterOrder =
                      effectiveAvailable - item.quantity;

                    if (remainingAfterOrder < 0) {
                      // Exceeds stock
                      return (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          Exceeds available stock by{' '}
                          {Math.abs(remainingAfterOrder)}
                        </span>
                      );
                    } else if (remainingAfterOrder === 0) {
                      // Last items
                      return (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Last items in stock
                        </span>
                      );
                    } else if (availableQty <= 0) {
                      // Out of stock
                      return (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          Out of stock
                        </span>
                      );
                    } else if (
                      availableQty <= (item.low_stock_threshold || 5)
                    ) {
                      // Low stock
                      return (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Low stock: {remainingAfterOrder} remaining
                        </span>
                      );
                    } else {
                      // Normal stock
                      return (
                        <span className="text-xs text-gray-500">
                          {remainingAfterOrder} remaining in stock
                        </span>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Payment Status Toggle */}
              <div className="mt-2">
                {item.isFullyRefunded ? (
                  <div className="text-sm text-gray-500 py-2 px-3 bg-gray-100 rounded-md">
                    Payment Status: {item.paymentStatus === 'already_paid' ? 'Already Paid' : 'Needs Payment'}
                  </div>
                ) : (
                  <PaymentStatusSelector
                    value={item.paymentStatus || 'needs_payment'}
                    onChange={(st) => handlePaymentStatusChange(item._editId, st)}
                  />
                )}
              </div>

              {/* Show customizations if any */}
              {item.customizations && Object.keys(item.customizations).length > 0 && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <h6 className="text-sm font-medium text-gray-700 mb-2">
                    Customizations:
                  </h6>
                  <div className="space-y-2">
                    {Object.entries(item.customizations).map(
                      ([category, values]) => (
                        <div key={category} className="text-sm">
                          <span className="font-medium">{category}:</span>
                          {Array.isArray(values) ? (
                            <ul className="list-disc pl-5 mt-1">
                              {values.map((val, idx2) => (
                                <li key={idx2} className="text-gray-600">
                                  {val}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-600 ml-2">
                              {String(values)}
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Item Total */}
              <div className="pt-2 text-right text-sm font-medium text-gray-700">
                Item Total: $
                {(
                  (parseFloat(String(item.price)) || 0) *
                  (parseInt(String(item.quantity), 10) || 0)
                ).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Button to add new item */}
        <button
          type="button"
          onClick={handleAddItem}
          className="w-full flex items-center justify-center px-4 py-3 bg-gray-50 text-sm font-medium
            text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <svg
            className="h-5 w-5 mr-2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12
                6v6m0
                0v6m0-6h6m-6
                0H6"
            />
          </svg>
          Add Item
        </button>

        {/* Subtotal/total area */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Subtotal</span>
            <span className="text-sm font-medium">${currentSubtotal}</span>
          </div>

          {sumRefundsHere > 0 && (
            <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Original Total</span>
              <span className="text-sm font-medium line-through text-gray-400">
                ${currentSubtotal}
              </span>
            </div>
          )}
          {sumRefundsHere > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-red-600">Refunded</span>
              <span className="text-sm font-medium text-red-600">
                -${sumRefundsHere.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-2 border-t border-gray-100 space-y-2 sm:space-y-0">
            <span className="text-base font-medium text-gray-900">Total</span>
            <div className="relative w-full sm:w-32">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                className="border border-gray-300 rounded-md pl-7 pr-3 py-2 w-full text-sm text-right font-medium"
                value={localTotal}
                onChange={(e) => setLocalTotal(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDetailsTab() {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        {/* Special instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Instructions
          </label>
          <textarea
            className="border border-gray-300 rounded-md px-3 py-2 w-full text-sm"
            rows={4}
            value={localInstructions}
            onChange={(e) => setLocalInstructions(e.target.value)}
            placeholder="Any special instructions for this order"
          />
        </div>

        {/* Basic metadata */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Order Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">Created</div>
            <div className="text-gray-900">
              {new Date(order.createdAt).toLocaleString()}
            </div>

            {order.created_by_user_id && (
              <>
                <div className="text-gray-500">Created By</div>
                <div className="text-gray-900">
                  {order.created_by_user_name || `User ID: ${order.created_by_user_id}`}
                </div>
              </>
            )}

            {order.contact_name && (
              <>
                <div className="text-gray-500">Customer</div>
                <div className="text-gray-900">{order.contact_name}</div>
              </>
            )}

            {(order.estimatedPickupTime || order.estimated_pickup_time) && (
              <>
                <div className="text-gray-500">Pickup Time</div>
                <div className="text-gray-900">
                  {new Date(
                    order.estimatedPickupTime || order.estimated_pickup_time
                  ).toLocaleString()}
                </div>
              </>
            )}
          </div>
        </div>

        {/* If localStatus=preparing, allow updating ETA */}
        {localStatus === 'preparing' && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-start mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12
                    8v4l3
                    3m6-3a9
                    9
                    0
                    11-18
                    0
                    9
                    9
                    0
                    0118
                    0z"
                />
              </svg>
              <div>
                <h4 className="font-medium text-sm text-amber-800">
                  Pickup Time / ETA
                </h4>
                {order.estimatedPickupTime || order.estimated_pickup_time ? (
                  <p className="text-sm text-amber-700 mt-1">
                    Current ETA:{' '}
                    {new Date(
                      order.estimatedPickupTime || order.estimated_pickup_time
                    ).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 mt-1">No ETA set</p>
                )}
              </div>
            </div>

            <div className="bg-amber-100 rounded p-3 mb-3 flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12
                    9v2m0
                    4h.01m-6.938
                    4h13.856c1.54
                    0
                    2.502-1.667
                    1.732-3L13.732
                    4c-.77-1.333-2.694-1.333-3.464
                    0L3.34
                    16c-.77
                    1.333.192
                    3
                    1.732
                    3z"
                />
              </svg>
              <p className="text-sm text-amber-800">
                Changing the ETA will send updated notifications to the customer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowEtaUpdateModal(true)}
              className="w-full flex items-center justify-center px-4 py-2 bg-amber-100
                hover:bg-amber-200 text-amber-800 rounded-md text-sm font-medium
                transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11
                    5H6a2
                    2
                    0
                    00-2
                    2v11a2
                    2
                    0
                    002
                    2h11a2
                    2
                    0
                    002-2v-5m-1.414-9.414a2
                    2
                    0
                    112.828
                    2.828L11.828
                    15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Update ETA
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderPaymentsTab() {
    // Count total unpaid units
    const itemsNeedingPayment = localItems.filter(
      (it) => it.paymentStatus === 'needs_payment'
    );
    const totalUnpaidUnits = itemsNeedingPayment.reduce((sum, item) => {
      if (typeof item.unpaidQuantity === 'number') {
        return sum + item.unpaidQuantity;
      }
      return sum + item.quantity;
    }, 0);

    const hasItemsNeedingPayment = itemsNeedingPayment.length > 0;
    const hasPayments = payments.length > 0;

    return (
      <div className="p-4 sm:p-6 space-y-4">
        {loadingPayments ? (
          <p className="text-gray-600">Loading payment history...</p>
        ) : (
          <>
            {/* Payment Actions */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <h3 className="text-base font-medium text-gray-900 mb-3">
                Payment Actions
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {hasItemsNeedingPayment && (
                  <button
                    onClick={handleProcessAdditionalPayment}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12
                          6v6m0
                          0v6m0-6h6m-6
                          0H6"
                      />
                    </svg>
                    Process Additional Payment test
                  </button>
                )}

                <button
                  onClick={() => setShowRefundModal(true)}
                  disabled={maxRefundable <= 0}
                  className={`px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center
                    ${
                      maxRefundable > 0
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3
                        10h10a8
                        8
                        0
                        018
                        8v2M3
                        10l6
                        6m-6-6l6-6"
                    />
                  </svg>
                  Issue Refund
                </button>
              </div>

              <div className="mt-3 text-sm">
                {hasItemsNeedingPayment && (
                  <div className="bg-amber-50 border border-amber-100 rounded-md p-3 mb-2">
                    <p className="text-amber-800 mb-1">
                      {totalUnpaidUnits === 1 ? (
                        <>
                          <span className="font-medium">1</span> unit requires
                          payment.
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{totalUnpaidUnits}</span>{' '}
                          units require payment.
                        </>
                      )}
                    </p>
                    <p className="text-amber-800 font-medium">
                      Amount due: $
                      {itemsNeedingPayment
                        .reduce((sum, item) => {
                          const price = parseFloat(String(item.price)) || 0;
                          const unpaidQty = item.unpaidQuantity || 0;
                          return sum + price * unpaidQty;
                        }, 0)
                        .toFixed(2)}
                    </p>
                  </div>
                )}
                <p className="text-gray-600">
                  Max refundable amount:{' '}
                  <span className="font-medium">
                    ${maxRefundable.toFixed(2)}
                  </span>
                </p>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-3">
                Payment History
              </h3>
              {hasPayments ? (
                <OrderPaymentHistory payments={payments} />
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-sm">
                    No payment records found for this order.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------
  // 9) Render the overall modal
  // ----------------------------------------------------------------
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fadeIn"
        style={{ isolation: 'isolate' }}
      >
        <div className="bg-white rounded-xl shadow-lg w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slideUp relative">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-20">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                Order #{order.id}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1
                  rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6
                      18L18
                      6M6
                      6l12
                      12"
                  />
                </svg>
              </button>
            </div>

            {/* Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 mr-2">
                  Status:
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                    localStatus
                  )}`}
                >
                  {localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
                </span>
              </div>

              {/* Custom status dropdown */}
              <div className="flex-1">
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    onClick={() =>
                      setIsStatusDropdownOpen(!isStatusDropdownOpen)
                    }
                    className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-2 text-sm"
                  >
                    <span>
                      {localStatus.charAt(0).toUpperCase() +
                        localStatus.slice(1)}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293
                          7.293a1
                          1
                          0
                          011.414
                          0L10
                          10.586l3.293-3.293a1
                          1
                          0
                          111.414
                          1.414l-4
                          4a1
                          1
                          0
                          01-1.414
                          0l-4-4a1
                          1
                          0
                          010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isStatusDropdownOpen && (
                    <div
                      className="absolute z-[99999] mt-1 w-full rounded-md bg-white shadow-lg"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                      }}
                    >
                      <ul className="max-h-60 overflow-auto py-1">
                        {[
                          { value: 'pending', label: 'Pending' },
                          { value: 'preparing', label: 'Preparing' },
                          { value: 'ready', label: 'Ready' },
                          { value: 'completed', label: 'Completed' },
                          { value: 'cancelled', label: 'Cancelled' },
                          { value: 'refunded', label: 'Refunded' }
                        ].map((option) => (
                          <li
                            key={option.value}
                            className={`cursor-pointer px-4 py-2 hover:bg-gray-100 ${
                              localStatus === option.value
                                ? 'bg-gray-100'
                                : ''
                            }`}
                            onClick={() => {
                              setLocalStatus(option.value);
                              setIsStatusDropdownOpen(false);
                            }}
                          >
                            {option.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="px-4 sm:px-6 pt-2 pb-2 flex border-b border-gray-200 overflow-x-auto bg-white absolute top-[120px] left-0 right-0 z-0"
            style={{ maxWidth: 'inherit', width: '100%' }}
          >
            <button
              onClick={() => setActiveTab('items')}
              className={`mr-4 pb-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === 'items'
                  ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Order Items
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`mr-4 pb-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === 'details'
                  ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Order Details
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === 'payments'
                  ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Payments
            </button>
          </div>
          <div className="w-full h-[12px] flex-shrink-0 mt-10"></div>

          {/* Tab Content */}
          <div
            className="flex-1 overflow-y-auto relative"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            <div
              className={`transition-opacity duration-300 ${
                activeTab === 'items'
                  ? 'opacity-100'
                  : 'opacity-0 absolute inset-0 pointer-events-none'
              }`}
            >
              {activeTab === 'items' && renderItemsTab()}
            </div>
            <div
              className={`transition-opacity duration-300 ${
                activeTab === 'details'
                  ? 'opacity-100'
                  : 'opacity-0 absolute inset-0 pointer-events-none'
              }`}
            >
              {activeTab === 'details' && renderDetailsTab()}
            </div>
            <div
              className={`transition-opacity duration-300 ${
                activeTab === 'payments'
                  ? 'opacity-100'
                  : 'opacity-0 absolute inset-0 pointer-events-none'
              }`}
            >
              {activeTab === 'payments' && renderPaymentsTab()}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3 sticky bottom-0 bg-white">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 sm:py-2.5 bg-white border border-gray-300
                text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50
                transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessingPayment}
              className={`w-full sm:w-auto px-4 py-3 sm:py-2.5 ${
                isProcessingPayment
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#c1902f] hover:bg-[#d4a43f]'
              } text-white rounded-lg text-sm font-medium transition-colors shadow-sm
                order-1 sm:order-2`}
            >
              {isProcessingPayment ? 'Process Payment First' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ETA Modals */}
      {showEtaModal && (
        <SetEtaModal
          order={order}
          etaMinutes={etaMinutes}
          setEtaMinutes={setEtaMinutes}
          onClose={() => setShowEtaModal(false)}
          onConfirm={handleConfirmEta}
        />
      )}
      {showEtaUpdateModal && (
        <SetEtaModal
          order={order}
          etaMinutes={updateEtaMinutes}
          setEtaMinutes={setUpdateEtaMinutes}
          onClose={() => setShowEtaUpdateModal(false)}
          onConfirm={handleConfirmEtaUpdate}
          isUpdateMode
        />
      )}

      {/* Item Selector Modal */}
      {showMenuItemSelector && (
        <SearchableMenuItemSelector
          onSelect={handleMenuItemSelect}
          onClose={() => setShowMenuItemSelector(false)}
        />
      )}

      {/* Inventory Reversion Dialog */}
      {showInventoryDialog && itemToRemove && (
        <InventoryReversionDialog
          itemName={itemToRemove.item.name}
          onClose={() => {
            setShowInventoryDialog(false);
            setItemToRemove(null);
          }}
          onConfirm={handleInventoryDialogAction}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <RefundModal
          isOpen={showRefundModal}
          onClose={() => {
            setShowRefundModal(false);
            setPreSelectedRefundItem(null);
            // Reset processing payment state if user cancels the refund
            setIsProcessingPayment(false);
          }}
          orderId={order.id}
          maxRefundable={maxRefundable}
          orderItems={localItems}
          onRefundCreated={handleRefundCreated}
          preSelectedItem={preSelectedRefundItem}
        />
      )}

      {/* Additional Payment Modal */}
      {showAdditionalPaymentModal && (
        <EnhancedAdditionalPaymentModal
          isOpen={showAdditionalPaymentModal}
          onClose={() => {
            setShowAdditionalPaymentModal(false);
            // Reset processing payment state if user cancels the payment
            setIsProcessingPayment(false);
          }}
          orderId={order.id}
          paymentItems={localItems
            .filter((it) => it.paymentStatus === 'needs_payment')
            .map((it) => ({
              id:
                typeof it.id === 'string'
                  ? parseInt(it.id, 10) || 0
                  : it.id || 0,
              name: it.name,
              price: it.price,
              // Charge only the unpaid portion for each item
              quantity: it.unpaidQuantity ?? it.quantity,
            }))}
          onPaymentCompleted={handleAdditionalPaymentCompleted}
        />
      )}

      {/* Payment Handling Dialog */}
      {showPaymentHandlingDialog && itemToRemove && (
        <PaymentHandlingDialog
          item={{
            name: itemToRemove.item.name,
            quantity: parseInt(String(itemToRemove.item.quantity), 10),
            price: parseFloat(String(itemToRemove.item.price)),
            id: itemToRemove.item.id || undefined,
            enable_stock_tracking: itemToRemove.item.enable_stock_tracking,
          }}
          isPartialQuantity={pendingQuantityChange !== null}
          orderId={order.id}
          orderStatus={localStatus}
          onClose={() => {
            setShowPaymentHandlingDialog(false);
            setItemToRemove(null);
            setPendingQuantityChange(null);
          }}
          onAction={(
            action,
            reason,
            amount,
            inventoryAction,
            inventoryReason
          ) =>
            handlePaymentAction(
              action,
              reason,
              amount,
              inventoryAction,
              inventoryReason
            )
          }
        />
      )}
    </>
  );
}
