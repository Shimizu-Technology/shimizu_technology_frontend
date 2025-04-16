// src/shared/utils/tenantUtils.ts
/**
 * Utility functions for tenant isolation and validation
 * These functions help ensure proper tenant isolation across components
 */

/**
 * Validates that a restaurant context exists and has a valid ID
 * @param restaurant The restaurant object from useRestaurantStore
 * @returns boolean indicating if the context is valid
 */
export function validateRestaurantContext(restaurant: any): boolean {
  if (!restaurant || !restaurant.id) {
    console.warn('Tenant Isolation Warning: Restaurant context missing or invalid');
    return false;
  }
  return true;
}

/**
 * Gets the current restaurant ID from either context or localStorage
 * @returns The restaurant ID or null if not found
 */
export function getCurrentRestaurantId(): number | null {
  // First try to get from localStorage as fallback
  const storedId = localStorage.getItem('restaurantId');
  if (storedId) {
    const parsedId = parseInt(storedId, 10);
    if (!isNaN(parsedId)) {
      return parsedId;
    }
  }
  return null;
}

/**
 * Logs a standardized tenant isolation warning
 * @param component Name of the component reporting the warning
 * @param message Specific warning message
 */
export function logTenantIsolationWarning(component: string, message: string): void {
  console.warn(`Tenant Isolation Warning [${component}]: ${message}`);
}

/**
 * Adds restaurant_id to API parameters if not already present
 * @param params The existing parameters object
 * @param restaurantId The restaurant ID to add
 * @returns Updated parameters object with restaurant_id
 */
export function addRestaurantIdToParams(params: Record<string, any> = {}, restaurantId?: number | null): Record<string, any> {
  // If params already has restaurant_id, don't override it
  if (params.restaurant_id !== undefined) {
    return params;
  }
  
  // If restaurantId is provided, use it
  if (restaurantId) {
    return { ...params, restaurant_id: restaurantId };
  }
  
  // Otherwise try to get from localStorage
  const currentRestaurantId = getCurrentRestaurantId();
  if (currentRestaurantId) {
    return { ...params, restaurant_id: currentRestaurantId };
  }
  
  // If we can't find a restaurant ID, log a warning and return original params
  logTenantIsolationWarning('addRestaurantIdToParams', 'No restaurant_id available to add to params');
  return params;
}

/**
 * Checks if we're in a development or test environment
 * Used to relax certain tenant isolation requirements during development
 */
export function isDevelopmentOrTest(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}
