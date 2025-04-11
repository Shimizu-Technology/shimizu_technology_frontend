// src/shared/utils/orderUtils.ts

/**
 * Checks if an order requires advance notice (24-hour notice)
 */
export function requiresAdvanceNotice(order: any): boolean {
  return order.requires_advance_notice === true;
}

/**
 * Determines if we need to show the ETA modal when changing order status
 */
export function handleOrderPreparationStatus(
  order: any,
  newStatus: string,
  originalStatus: string
): { shouldShowEtaModal: boolean } {
  // Only show ETA modal when changing from pending to preparing
  const shouldShowEtaModal = 
    originalStatus === 'pending' && 
    newStatus === 'preparing' && 
    !order.estimated_pickup_time && 
    !order.estimatedPickupTime;
  
  return { shouldShowEtaModal };
}

/**
 * Calculates the pickup time based on the ETA minutes or time slot
 */
export function calculatePickupTime(order: any, etaMinutes: number): string {
  if (requiresAdvanceNotice(order)) {
    // For advance notice orders, create a timestamp for tomorrow at the selected time
    const [hourStr, minuteStr] = String(etaMinutes).split('.');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr || '0', 10) === 3 ? 30 : 0; // Convert .3 to 30 minutes
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, minute, 0, 0);
    
    return tomorrow.toISOString();
  } else {
    // For regular orders, just add minutes to current time
    return new Date(Date.now() + Number(etaMinutes) * 60_000).toISOString();
  }
}
