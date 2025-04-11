// src/shared/components/auth/AuthRoutes.tsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import { ProfilePage } from '../profile';
import { ProtectedRoute } from '../../auth';

export function AuthRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginForm />} />
      <Route 
        path="/auth/profile" 
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default AuthRoutes;
