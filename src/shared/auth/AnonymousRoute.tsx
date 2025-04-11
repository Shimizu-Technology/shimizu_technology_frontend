// src/shared/auth/AnonymousRoute.tsx

import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './authStore';

interface AnonymousRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * A route guard component that requires a user to be NOT logged in.
 * If the user is logged in, they will be redirected to the specified path.
 */
export function AnonymousRoute({
  children,
  redirectTo,
}: AnonymousRouteProps) {
  const { isAuthenticated } = useAuthStore();
  
  // Default redirect path is the home page
  const redirectPath = redirectTo || '/';
  
  // If user is authenticated, redirect them away from this route
  if (isAuthenticated()) {
    return <Navigate to={redirectPath} replace />;
  }
  
  // User is not authenticated, render children (login/signup form)
  return <>{children}</>;
}