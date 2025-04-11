// src/shared/auth/index.ts

// Export all auth-related components and hooks
export { useAuthStore } from './authStore';
export { AuthProvider, useAuth } from './AuthProvider';
export { ProtectedRoute } from './ProtectedRoute';
export { AnonymousRoute } from './AnonymousRoute';

// Re-export types
export type { User, LoginCredentials, SignupData } from '../types/auth';
