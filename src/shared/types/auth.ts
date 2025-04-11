// src/shared/types/auth.ts

/**
 * Represents an authenticated user in the system
 */
export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  name?: string; // Computed from first_name + last_name or provided directly
  phone?: string;
  role?: 'super_admin' | 'admin' | 'staff' | 'customer' | string;
  restaurant_id?: string;
  phone_verified?: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface SignupData {
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
  phone?: string;
  restaurant_id?: string | number;
}

/**
 * Auth response from API
 */
export interface AuthResponse {
  jwt: string;
  user: User;
}

/**
 * Phone verification data
 */
export interface PhoneVerificationData {
  code: string;
}
