// src/shared/auth/AuthProvider.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from './authStore';
import type { User, LoginCredentials, SignupData } from '../types/auth';

// Create a context with the same shape as our auth store
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  verifyPhone: (code: string) => Promise<void>;
  resendVerificationCode: () => Promise<{ message: string }>;
  isAuthenticated: () => boolean;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: ReactNode }) {
  // Get values and actions from our Zustand store
  const {
    user,
    isLoading,
    error,
    login,
    signup,
    logout,
    verifyPhone,
    resendVerificationCode,
    isAuthenticated,
  } = useAuthStore();

  // Create the context value object
  const contextValue: AuthContextValue = {
    user,
    isLoading,
    error,
    login,
    signup,
    logout,
    verifyPhone,
    resendVerificationCode,
    isAuthenticated,
  };

  // Provide the context value to children
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
