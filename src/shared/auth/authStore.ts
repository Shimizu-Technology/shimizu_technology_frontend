// src/shared/auth/authStore.ts

import { create } from 'zustand';
import { isTokenExpired, getRestaurantId } from '../utils/jwt';
import type { User, LoginCredentials, SignupData, AuthResponse } from '../types/auth';
import { loginUser as loginUserApi, signupUser as signupUserApi, verifyPhone as verifyPhoneApi, resendVerificationCode as resendCodeApi } from '../api/endpoints/auth';

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Core auth actions
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  
  // Helper methods
  setUserFromResponse: (response: AuthResponse) => void;
  updateUser: (updatedUser: User) => void;
  
  // Phone verification
  verifyPhone: (code: string) => Promise<void>;
  resendVerificationCode: () => Promise<{ message: string }>;
  
  // JWT token helpers
  getToken: () => string | null;
  isAuthenticated: () => boolean;
  
  // Role helpers
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  isStaff: () => boolean;
  isCustomer: () => boolean;
  isAdminOrAbove: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const store: AuthStore = {
    user: null,
    isLoading: false,
    error: null,

    // Helper to set user from API response
    setUserFromResponse: ({ jwt, user }) => {
      // Check if the token has a restaurant_id and add it to the user object if not present
      if (!user.restaurant_id) {
        const restaurantId = getRestaurantId(jwt);
        if (restaurantId) {
          user = { ...user, restaurant_id: restaurantId };
        }
      }
      
      // Save to localStorage so we persist across reloads
      localStorage.setItem('token', jwt);
      localStorage.setItem('auth_token', jwt); // Also save as auth_token for WebSocket compatibility
      localStorage.setItem('user', JSON.stringify(user));
      
      // Make token available to window.authStore for WebSocket service
      if (typeof window !== 'undefined') {
        window.authStore = window.authStore || { getState: () => ({ token: jwt }) };
      }

      // Update our store state
      set({ user, isLoading: false, error: null });
    },

    // Update user data
    updateUser: (updatedUser) => {
      // Keep the user in localStorage in sync
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    },

    // Login
    login: async ({ email, password }) => {
      set({ isLoading: true, error: null });
      try {
        // Clear any old tokens first
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Call the API
        const response = await loginUserApi({ email, password });
        get().setUserFromResponse(response);
      } catch (err: any) {
        set({ isLoading: false, error: err.message });
        throw err;
      }
    },

    // Signup
    signup: async (data) => {
      set({ isLoading: true, error: null });
      try {
        // Clear any old tokens first
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Call the API
        const response = await signupUserApi(data);
        get().setUserFromResponse(response);
      } catch (err: any) {
        set({ isLoading: false, error: err.message });
        throw err;
      }
    },

    // Logout
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('auth_token'); // Also remove auth_token for WebSocket compatibility
      localStorage.removeItem('user');
      
      // Clear window.authStore
      if (typeof window !== 'undefined' && window.authStore) {
        window.authStore = { getState: () => ({}) };
      }
      set({ user: null, isLoading: false, error: null });
      
      // Redirect to login page
      window.location.href = '/login';
    },

    // Verify phone
    verifyPhone: async (code) => {
      set({ isLoading: true, error: null });
      try {
        const response = await verifyPhoneApi(code);
        if (response.user) {
          get().updateUser(response.user);
        }
        set({ isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, error: err.message });
        throw err;
      }
    },

    // Resend verification code
    resendVerificationCode: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await resendCodeApi();
        set({ isLoading: false });
        return response;
      } catch (err: any) {
        set({ isLoading: false, error: err.message });
        throw err;
      }
    },

    // Get the JWT token
    getToken: () => {
      return localStorage.getItem('token');
    },

    // Check if user is authenticated
    isAuthenticated: () => {
      const token = localStorage.getItem('token');
      if (!token) return false;
      return !isTokenExpired(token);
    },
    
    // Role helper methods
    isSuperAdmin: () => {
      // Check for 'super_admin' role
      return get().user?.role === 'super_admin';
    },
    
    isAdmin: () => {
      return get().user?.role === 'admin';
    },
    
    isStaff: () => {
      return get().user?.role === 'staff';
    },
    
    isCustomer: () => {
      console.log('[AuthStore] isCustomer check - user:', get().user);
      console.log('[AuthStore] isCustomer check - role:', get().user?.role);
      return get().user?.role === 'customer' || !get().user?.role;
    },
    
    isAdminOrAbove: () => {
      return get().isSuperAdmin() || get().isAdmin();
    }
  };

  //
  // On store creation, rehydrate from localStorage if present
  //
  const existingToken = localStorage.getItem('token');
  const existingUser = localStorage.getItem('user');
  
  if (existingToken && existingUser) {
    // Check if token is expired
    if (isTokenExpired(existingToken)) {
      // Token is expired, clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else {
      // Token is valid, restore user from localStorage
      let user = JSON.parse(existingUser) as User;
      
      // Check if user has restaurant_id, if not extract it from token
      if (!user.restaurant_id) {
        const restaurantId = getRestaurantId(existingToken);
        if (restaurantId) {
          user = { ...user, restaurant_id: restaurantId };
        }
      }
      
      // We only restore the user from localStorage. 
      // The token is read from localStorage by api.ts automatically.
      store.user = user;
    }
  }

  return store;
});
