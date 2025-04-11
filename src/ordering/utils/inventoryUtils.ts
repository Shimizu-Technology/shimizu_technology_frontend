// src/ordering/utils/inventoryUtils.ts

import { OrderItem } from '../components/admin/AdminEditOrderModal';
import { MenuItem } from '../types/menu';

/**
 * Calculates the effective available quantity for an item, taking into account
 * the original order quantity (to handle edit scenarios).
 * 
 * @param item The order item to calculate effective quantity for
 * @param originalItems The original items from the order before editing
 * @returns The effective available quantity, or Infinity if stock tracking is disabled
 */
export function calculateEffectiveQuantity(
  item: OrderItem, 
  originalItems: OrderItem[]
): number {
  // If stock tracking is disabled or no stock quantity is defined, return Infinity (no limit)
  if (!item.enable_stock_tracking || item.stock_quantity === undefined) {
    return Infinity;
  }
  
  // Find if the item exists in the original order
  const originalItem = originalItems.find(oi => oi.id === item.id);
  const originalQty = originalItem ? originalItem.quantity : 0;
  
  // Calculate effective available quantity
  // Current stock + original quantity (since that's already accounted for in the inventory)
  return item.stock_quantity + originalQty;
}

/**
 * Determines if an item is out of stock.
 *
 * @param item The order item to check
 * @returns True if the item is out of stock, false otherwise
 */
export function isOutOfStock(item: OrderItem): boolean {
  // Check inventory tracking
  return !!item.enable_stock_tracking &&
         item.stock_quantity !== undefined &&
         item.stock_quantity <= 0;
}

/**
 * Determines if an item is low on stock.
 *
 * @param item The order item to check
 * @returns True if the item is low on stock, false otherwise
 */
export function isLowStock(item: OrderItem): boolean {
  // Check inventory tracking
  return !!item.enable_stock_tracking &&
         item.stock_quantity !== undefined &&
         item.stock_quantity > 0 &&
         item.stock_quantity <= (item.low_stock_threshold || 5);
}

/**
 * Gets the appropriate stock status label for an item.
 *
 * @param item The order item to get the status for
 * @param currentQuantity The current quantity in the order
 * @param effectiveQuantity The effective available quantity
 * @returns A string with the stock status label
 */
export function getStockStatusLabel(
  item: OrderItem,
  currentQuantity: number,
  effectiveQuantity: number
): string {
  // If inventory tracking is disabled, return empty string
  if (!item.enable_stock_tracking || item.stock_quantity === undefined) {
    return '';
  }
  
  const remainingAfterOrder = effectiveQuantity - currentQuantity;
  
  if (remainingAfterOrder < 0) {
    return `Exceeds available stock by ${Math.abs(remainingAfterOrder)}`;
  } else if (remainingAfterOrder === 0) {
    return 'Last items in stock';
  } else if (isOutOfStock(item)) {
    return 'Out of stock';
  } else if (isLowStock(item)) {
    return `Low stock: ${remainingAfterOrder} remaining`;
  } else {
    return `${remainingAfterOrder} remaining in stock`;
  }
}

/**
 * Calculates the available quantity for a menu item.
 *
 * @param item The menu item to calculate available quantity for
 * @returns The available quantity, or Infinity if stock tracking is disabled and item is in stock
 */
export function calculateAvailableQuantity(item: MenuItem): number {
  // If inventory tracking is disabled, check the manually set stock status
  if (!item.enable_stock_tracking) {
    // If manually set to out of stock, return 0
    if (item.stock_status === 'out_of_stock') {
      return 0;
    }
    // If manually set to low stock, return a low number (e.g., 2)
    if (item.stock_status === 'low_stock') {
      return item.low_stock_threshold || 2;
    }
    // Otherwise, return Infinity (unlimited)
    return Infinity;
  }
  
  // When inventory tracking is enabled, use the available quantity
  if (item.available_quantity === undefined) {
    return Infinity;
  }
  
  return Math.max(0, item.available_quantity);
}

/**
 * Derives the stock status for a menu item.
 *
 * @param item The menu item to check
 * @returns 'out_of_stock', 'low_stock', or 'in_stock'
 */
export function deriveStockStatus(item: MenuItem): 'out_of_stock' | 'low_stock' | 'in_stock' {
  // If inventory tracking is disabled, respect the manually set stock_status
  if (!item.enable_stock_tracking) {
    // Check if the item has a manually set stock_status
    if (item.stock_status === 'out_of_stock' || item.stock_status === 'low_stock') {
      return item.stock_status;
    }
    return 'in_stock';
  }
  
  // When inventory tracking is enabled, calculate based on available quantity
  if (item.available_quantity === undefined) {
    return 'in_stock';
  }
  
  if (item.available_quantity <= 0) {
    return 'out_of_stock';
  }
  
  const lowStockThreshold = item.low_stock_threshold || 5;
  if (item.available_quantity <= lowStockThreshold) {
    return 'low_stock';
  }
  
  return 'in_stock';
}
