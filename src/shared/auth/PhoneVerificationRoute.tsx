// src/shared/auth/PhoneVerificationRoute.tsx

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './authStore';

interface PhoneVerificationRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * A specialized route guard component for phone verification.
 * - If user is not authenticated, redirects to login
 * - If user is authenticated and phone is already verified, redirects to home
 * - If user is authenticated but phone is not verified, shows the verification page
 */
export function PhoneVerificationRoute({
  children,
  redirectTo,
}: PhoneVerificationRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  
  // If user is not authenticated, redirect to login
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  // If user is authenticated and phone is already verified, redirect to home or specified path
  if (user?.phone_verified) {
    const redirectPath = redirectTo || '/';
    return <Navigate to={redirectPath} replace />;
  }
  
  // User is authenticated but phone is not verified, show the verification page
  return <>{children}</>;
}
