import posthog from 'posthog-js';

/**
 * Track customer-facing events
 * 
 * @param eventName The name of the event to track
 * @param properties Additional properties to include with the event
 */
export const trackCustomerEvent = (
  eventName: string, 
  properties: Record<string, any> = {}
) => {
  posthog.capture(eventName, {
    ...properties,
    user_type: 'customer',
  });
};

/**
 * Track admin actions
 * 
 * @param eventName The name of the event to track
 * @param properties Additional properties to include with the event
 */
export const trackAdminEvent = (
  eventName: string, 
  properties: Record<string, any> = {}
) => {
  posthog.capture(eventName, {
    ...properties,
    user_type: 'admin',
  });
};

/**
 * Track general events (used when user type isn't known)
 * 
 * @param eventName The name of the event to track
 * @param properties Additional properties to include with the event
 */
export const trackEvent = (
  eventName: string, 
  properties: Record<string, any> = {}
) => {
  posthog.capture(eventName, properties);
};

/**
 * Common event names for consistent tracking
 */
export const EventNames = {
  // Page views
  PAGE_VIEWED: 'page_viewed',
  
  // Customer events
  ITEM_VIEWED: 'item_viewed',
  ITEM_ADDED_TO_CART: 'item_added_to_cart',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_COMPLETED: 'checkout_completed',
  RESERVATION_MADE: 'reservation_made',
  
  // Admin events
  ADMIN_MENU_ITEM_CREATED: 'admin.menu_item_created',
  ADMIN_MENU_ITEM_UPDATED: 'admin.menu_item_updated',
  ADMIN_ORDER_PROCESSED: 'admin.order_processed',
  ADMIN_SETTING_CHANGED: 'admin.setting_changed',
  
  // Feature flags
  FEATURE_FLAG_CALLED: '$feature_flag_called',
};
