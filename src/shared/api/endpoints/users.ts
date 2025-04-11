// src/shared/api/endpoints/users.ts
import { api } from '../apiClient';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

export const usersApi = {
  // Get current user profile
  getCurrentProfile: async (): Promise<UserProfile> => {
    return api.get<UserProfile>('/users/me');
  },
  
  // Get user by ID
  getById: async (id: number): Promise<UserProfile> => {
    return api.get<UserProfile>(`/users/${id}`);
  },
  
  // Update user
  update: async (id: number, data: Partial<UserProfile>): Promise<UserProfile> => {
    return api.patch<UserProfile>(`/users/${id}`, { user: data });
  }
};
