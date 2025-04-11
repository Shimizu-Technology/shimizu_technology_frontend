// src/shared/api/endpoints/auth.ts

import { api } from '../apiClient';
import type { AuthResponse, LoginCredentials, SignupData, User } from '../../types/auth';

/**
 * Login a user with email and password
 */
export async function loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
  return api.post<AuthResponse>('/login', credentials);
}

/**
 * Register a new user
 */
export async function signupUser(data: SignupData): Promise<AuthResponse> {
  return api.post<AuthResponse>('/signup', {
    user: {
      email: data.email,
      password: data.password,
      password_confirmation: data.password_confirmation,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      restaurant_id: data.restaurant_id,
    }
  });
}

/**
 * Verify a user's phone number with a code
 */
export async function verifyPhone(code: string): Promise<{ message: string; user: User }> {
  return api.post<{ message: string; user: User }>('/verify_phone', { code });
}

/**
 * Resend a verification code to the user's phone
 */
export async function resendVerificationCode(): Promise<{ message: string }> {
  return api.post<{ message: string }>('/resend_code', {});
}

/**
 * Request a password reset for a user
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/password/reset', { email });
}

/**
 * Reset a user's password with a token
 */
export async function resetPassword(
  token: string,
  password: string,
  passwordConfirmation: string
): Promise<{ message: string }> {
  return api.post<{ message: string }>('/password/update', {
    token,
    password,
    password_confirmation: passwordConfirmation,
  });
}

/**
 * Update a user's profile
 */
export async function updateUserProfile(
  userId: string,
  data: Partial<User>
): Promise<User> {
  return api.patch<User>(`/users/${userId}`, { user: data });
}
