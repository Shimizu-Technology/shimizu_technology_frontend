// src/shared/utils/jwt.ts

/**
 * Decodes a JWT token and returns the payload
 */
export function decodeJwt(token: string): any {
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload;
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
}

/**
 * Checks if a JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  if (!token) return true;
  
  try {
    const payload = decodeJwt(token);
    // Check if token has expiration and if it's in the past
    return payload.exp && payload.exp < Date.now() / 1000;
  } catch (e) {
    console.error('Error checking token expiration:', e);
    return true;
  }
}

/**
 * Gets the restaurant ID from a JWT token
 */
export function getRestaurantId(token: string): string | null {
  if (!token) return null;
  
  try {
    const payload = decodeJwt(token);
    return payload.restaurant_id;
  } catch (e) {
    console.error('Error getting restaurant ID from token:', e);
    return null;
  }
}

/**
 * Gets the user's role from a JWT token
 */
export function getUserRole(token: string): string | null {
  if (!token) return null;
  
  try {
    const payload = decodeJwt(token);
    return payload.role;
  } catch (e) {
    console.error('Error getting user role from token:', e);
    return null;
  }
}

/**
 * Gets tenant-specific permissions from a JWT token
 */
export function getTenantPermissions(token: string): Record<string, any> | null {
  if (!token) return null;
  
  try {
    const payload = decodeJwt(token);
    return payload.tenant_permissions || {};
  } catch (e) {
    console.error('Error getting tenant permissions from token:', e);
    return null;
  }
}

/**
 * Checks if the current token has access to a specific restaurant
 */
export function hasRestaurantAccess(token: string, restaurantId: string | number): boolean {
  if (!token) return false;
  
  try {
    const payload = decodeJwt(token);
    
    // Super admins can access all restaurants
    if (payload.role === 'super_admin') return true;
    
    // Check if token's restaurant_id matches the requested restaurant
    return payload.restaurant_id === restaurantId.toString();
  } catch (e) {
    console.error('Error checking restaurant access:', e);
    return false;
  }
}
