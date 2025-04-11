// src/shared/api/index.ts

// Export the API client
export { api, apiClient, extractData, switchRestaurantContext } from './apiClient';

// Export utility functions
export { uploadFile, objectToFormData } from './utils';

// Export all endpoints
export * from './endpoints/analytics';
export * from './endpoints/auth';
export * from './endpoints/events';
export * from './endpoints/layouts';
export * from './endpoints/menu';
export * from './endpoints/orders';
export * from './endpoints/reports';
export * from './endpoints/reservations';
export * from './endpoints/restaurants';
export * from './endpoints/seats';

// Re-export types
export type { AuthResponse, LoginCredentials, SignupData, User } from '../types/auth';
