// src/shared/auth/ProtectedRoute.tsx

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
  redirectTo?: string;
}

/**
 * A route guard component that requires a user to be logged in.
 * Optionally can require the user to be an admin.
 */
export function ProtectedRoute({
  children,
  adminOnly = false,
  redirectTo,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  
  // Default redirect path is the login page
  const redirectPath = redirectTo || '/login';
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    return <Navigate to={redirectPath} replace />;
  }
  
  // If adminOnly is true, check if user has admin or super_admin role
  if (adminOnly && user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'staff') {
    console.log('[ProtectedRoute] User role not authorized for admin route:', user?.role);
    return <Navigate to="/" replace />;
  }
  
  // User is authenticated and has required role, render children
  return <>{children}</>;
}
