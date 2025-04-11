// src/ordering/store/authStore.ts
// This is a proxy file that forwards all auth store requests to the shared auth store

import { useAuthStore as useSharedAuthStore } from '../../shared/auth';

// Re-export the shared auth store
export const useAuthStore = useSharedAuthStore;

// For backward compatibility
export const loginWithJwtUser = (jwt: string, user: any) => {
  const authStore = useSharedAuthStore.getState();
  localStorage.setItem('token', jwt);
  localStorage.setItem('user', JSON.stringify(user));
  authStore.login({ email: user.email, password: '' });
};
