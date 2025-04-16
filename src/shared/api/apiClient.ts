// src/shared/api/apiClient.ts

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';
import { isTokenExpired } from '../utils/jwt';
import { config } from '../config';
import { useAuthStore } from '../auth/authStore';

// Get base URL from config
const API_BASE_URL = config.apiBaseUrl;

// Endpoints that require restaurant_id parameter for ordering
const ORDERING_RESTAURANT_CONTEXT_ENDPOINTS = [
  'availability',
  'menus',
  'categories',
  'menu_items',
  'option_groups',
  'options',
  'promo_codes',
  'orders',
  'locations'
];

// Endpoints that require restaurant_id parameter for reservations
const RESERVATIONS_RESTAURANT_CONTEXT_ENDPOINTS = [
  'availability',
  'layouts',
  'reservations',
  'waitlist_entries',
  'seat_allocations'
];

// Combine all endpoints that need restaurant context
const RESTAURANT_CONTEXT_ENDPOINTS = [
  ...ORDERING_RESTAURANT_CONTEXT_ENDPOINTS,
  ...RESERVATIONS_RESTAURANT_CONTEXT_ENDPOINTS
];

// Helper to check if an endpoint needs restaurant context
const needsRestaurantContext = (endpoint: string): boolean => {
  return RESTAURANT_CONTEXT_ENDPOINTS.some(e => endpoint.includes(e));
};

// Create an Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// We'll use a simple approach without the loading store
// This prevents the need for additional dependencies
let silentRequestsCount = 0;

// Add request interceptor to handle authentication and restaurant context
axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Check if this is a silent request (background polling)
  const isSilentRequest = config.headers?.['X-Silent-Request'] === 'true' || 
                          config.url?.includes('_silent=true');
  
  // Track silent requests for debugging
  if (isSilentRequest) {
    silentRequestsCount++;
    console.debug(`[API] Silent request started (${silentRequestsCount} active)`);
  }
  
  // Identify this frontend and send the configured restaurant ID
  config.headers.set('X-Frontend-ID', 'shimizu_technology');
  config.headers.set('X-Frontend-Restaurant-ID', import.meta.env.VITE_RESTAURANT_ID || '2');
  
  const token = localStorage.getItem('token');
  
  // Check token expiration
  if (token) {
    if (isTokenExpired(token)) {
      // Only logout if we're not already on the login page
      const isLoginPage = window.location.pathname.includes('/login');
      
      if (!isLoginPage) {
        // Token is expired, clear auth state and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Use the auth store to logout
        const authStore = useAuthStore.getState();
        authStore.logout();
      } else {
        // Just clear the token without redirecting
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      
      // Reject the request
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
    
    // Add token to headers
    config.headers.set('Authorization', `Bearer ${token}`);
  }
    // Always add restaurant_id to authenticated requests
  if (token) {
    // For Shimizu Technology frontend, always use restaurant ID 2
    // This ensures proper tenant isolation
    const shimizuRestaurantId = import.meta.env.VITE_RESTAURANT_ID || '2';
    
    // Add restaurant_id to headers for all authenticated requests
    config.headers.set('X-Restaurant-ID', shimizuRestaurantId);
    
    // Also add to params for backward compatibility and specific endpoints
    config.params = config.params || {};
    
    // If endpoint specifically needs restaurant context or it's an authenticated request
    if (config.url && (needsRestaurantContext(config.url) || token)) {
      // Always use the Shimizu Technology restaurant ID (2) for this frontend
      // This prevents data leakage from other restaurants
      
      // Only set if not already specified in the request
      if (!config.params.restaurant_id) {
        config.params.restaurant_id = shimizuRestaurantId;
      }
    }
  } else if (config.url && needsRestaurantContext(config.url)) {
    // For unauthenticated requests to endpoints that need restaurant context
    // Always use Shimizu Technology ID (2) for this frontend
    const shimizuRestaurantId = import.meta.env.VITE_RESTAURANT_ID || '2';
    
    config.params = config.params || {};
    if (!config.params.restaurant_id) {
      config.params.restaurant_id = shimizuRestaurantId;
    }
  }
  
  return config;
});

// Add response interceptor to handle errors and manage loading state
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Check if this was a silent request
    const isSilentRequest = response.config.headers?.['X-Silent-Request'] === 'true' || 
                           response.config.url?.includes('_silent=true');
    
    // Track silent requests for debugging
    if (isSilentRequest) {
      silentRequestsCount--;
      if (silentRequestsCount < 0) silentRequestsCount = 0;
      console.debug(`[API] Silent request completed (${silentRequestsCount} active)`);
    }
    
    return response;
  },
  (error) => {
    // Check if this was a silent request
    const isSilentRequest = error.config?.headers?.['X-Silent-Request'] === 'true' || 
                           error.config?.url?.includes('_silent=true');
    
    // Track silent requests for debugging
    if (isSilentRequest) {
      silentRequestsCount--;
      if (silentRequestsCount < 0) silentRequestsCount = 0;
      console.debug(`[API] Silent request completed (${silentRequestsCount} active)`);
    }
    // Handle 401 Unauthorized (expired token)
    if (error.response && error.response.status === 401) {
      // Check if this is a VIP validation request
      const isVipValidation = error.config?.url?.includes('/vip_access/validate_code');
      
      // Only proceed with logout if it's not a VIP validation and we're not on login page
      if (!isVipValidation) {
        const token = localStorage.getItem('token');
        const isLoginPage = window.location.pathname.includes('/login');
        
        if (token && !isLoginPage) {
          // Clear auth state and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Use the auth store to logout
          const authStore = useAuthStore.getState();
          authStore.logout();
        }
      }
    }
    
    // Handle 403 Forbidden (tenant access denied)
    if (error.response && error.response.status === 403) {
      console.error('Tenant access denied:', error.response.data);
      
      // Check if this is a tenant access issue
      if (error.response.data?.errors?.includes('User not authorized for this restaurant')) {
        const authStore = useAuthStore.getState();
        authStore.logout();
        // Could show a more specific error message here
      }
    }
    
    // Handle 422 Unprocessable Entity (missing restaurant context)
    if (error.response && error.response.status === 422) {
      if (error.response.data?.errors?.includes('Restaurant context required')) {
        console.error('Missing restaurant context:', error.response.data);
        // Could redirect to a restaurant selection page or show an error
      }
    }
    
    return Promise.reject(error);
  }
);

// Export the axios instance
export const apiClient = axiosInstance;

// Helper function to extract data from response
export const extractData = <T>(response: AxiosResponse<T>): T => {
  return response.data;
};

// This API object will be replaced by the one below

/**
 * Switch to a different restaurant context
 * @param restaurantId The restaurant ID to switch to
 * @returns Promise that resolves to the new JWT token and user object
 */
export const switchRestaurantContext = async (restaurantId: string | number): Promise<{ jwt: string; user: any }> => {
  try {
    const response = await apiClient.post<{ jwt: string; user: any }>('/switch-tenant', { restaurant_id: restaurantId });
    
    // Update the token in localStorage
    if (response.data.jwt) {
      localStorage.setItem('token', response.data.jwt);
      
      // Update user in localStorage if needed
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to switch restaurant context:', error);
    throw error;
  }
};

// Generic API functions with support for silent requests
export const api = {
  /**
   * GET request
   * @param endpoint API endpoint
   * @param params Query parameters
   * @param options Additional options like silent mode
   */
  async get<T>(endpoint: string, params?: any, options?: { silent?: boolean }): Promise<T> {
    const config: AxiosRequestConfig = { params };
    
    // Add silent flag to prevent loading indicators
    if (options?.silent) {
      config.headers = { 'X-Silent-Request': 'true' };
    }
    
    const response = await apiClient.get<T>(endpoint, config);
    return response.data;
  },
  
  /**
   * POST request
   * @param endpoint API endpoint
   * @param data Request body
   * @param options Additional options like silent mode
   */
  async post<T>(endpoint: string, data?: any, options?: { silent?: boolean }): Promise<T> {
    const config: AxiosRequestConfig = {};
    
    // Add silent flag to prevent loading indicators
    if (options?.silent) {
      config.headers = { 'X-Silent-Request': 'true' };
    }
    
    const response = await apiClient.post<T>(endpoint, data, config);
    return response.data;
  },
  
  /**
   * PATCH request
   * @param endpoint API endpoint
   * @param data Request body
   * @param options Additional options like silent mode
   */
  async patch<T>(endpoint: string, data?: any, options?: { silent?: boolean }): Promise<T> {
    const config: AxiosRequestConfig = {};
    
    // Add silent flag to prevent loading indicators
    if (options?.silent) {
      config.headers = { 'X-Silent-Request': 'true' };
    }
    
    const response = await apiClient.patch<T>(endpoint, data, config);
    return response.data;
  },
  
  /**
   * DELETE request
   * @param endpoint API endpoint
   * @param options Additional options like silent mode
   */
  async delete<T>(endpoint: string, options?: { silent?: boolean }): Promise<T> {
    const config: AxiosRequestConfig = {};
    
    // Add silent flag to prevent loading indicators
    if (options?.silent) {
      config.headers = { 'X-Silent-Request': 'true' };
    }
    
    const response = await apiClient.delete<T>(endpoint, config);
    return response.data;
  },
  
  /**
   * Upload file
   */
  async upload<T>(endpoint: string, formData: FormData, method: 'POST' | 'PATCH' = 'POST'): Promise<T> {
    const response = await apiClient({
      method,
      url: endpoint,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};
