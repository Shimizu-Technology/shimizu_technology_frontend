// src/shared/api/endpoints/menus.ts
import { apiClient } from '../apiClient';

export interface Menu {
  id: number;
  name: string;
  active: boolean;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

export const menusApi = {
  /**
   * Get all menus for the current restaurant
   * @param params Optional parameters for filtering menus
   * @param params.active If true, only returns active menus; if false, only returns inactive menus
   */
  getAll: async (params?: { active?: boolean; restaurant_id?: number }): Promise<Menu[]> => {
    const response = await apiClient.get('/menus', { params });
    return response.data;
  },

  /**
   * Get a specific menu by ID
   */
  getById: async (id: number): Promise<Menu> => {
    const response = await apiClient.get(`/menus/${id}`);
    return response.data;
  },

  /**
   * Create a new menu
   */
  create: async (data: { name: string; active: boolean; restaurant_id: number }): Promise<Menu> => {
    const response = await apiClient.post('/menus', { menu: data });
    return response.data;
  },

  /**
   * Update an existing menu
   */
  update: async (id: number, data: Partial<Menu>): Promise<Menu> => {
    const response = await apiClient.patch(`/menus/${id}`, { menu: data });
    return response.data;
  },

  /**
   * Delete a menu
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/menus/${id}`);
  },

  /**
   * Set a menu as the active menu for the restaurant
   */
  setActive: async (id: number): Promise<{ message: string; current_menu_id: number }> => {
    const response = await apiClient.post(`/menus/${id}/set_active`);
    return response.data;
  },

  /**
   * Clone a menu (creates a copy with all its menu items)
   */
  clone: async (id: number): Promise<Menu> => {
    const response = await apiClient.post(`/menus/${id}/clone`);
    return response.data;
  }
};
