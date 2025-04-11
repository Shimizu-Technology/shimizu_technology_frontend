// src/shared/api/endpoints/menuItems.ts
import { apiClient } from '../apiClient';
import { 
  MenuItem, 
  MenuItemStockAudit, 
  MarkAsDamagedParams, 
  UpdateStockParams 
} from '../../../ordering/types/menu';

export const menuItemsApi = {
  /**
   * Get all menu items
   */
  getAll: async (params?: { 
    menu_id?: number; 
    category_id?: number; 
    admin?: boolean; 
    include_stock?: boolean;
    show_all?: boolean;
  }): Promise<MenuItem[]> => {
    const response = await apiClient.get('/menu_items', { 
      params: { 
        ...params,
        include_stock: params?.include_stock !== false // Default to true unless explicitly set to false
      } 
    });
    return response.data;
  },

  /**
   * Get a specific menu item by ID
   */
  getById: async (id: string | number, includeStock: boolean = true): Promise<MenuItem> => {
    const response = await apiClient.get(`/menu_items/${id}`, {
      params: { include_stock: includeStock }
    });
    return response.data;
  },

  /**
   * Create a new menu item
   */
  create: async (data: Partial<MenuItem>): Promise<MenuItem> => {
    const formData = new FormData();
    
    // Convert object to form data for API compatibility
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'imageFile' && value instanceof File) {
        formData.append('menu_item[image]', value);
      } else if ((key === 'category_ids' || key === 'available_days') && Array.isArray(value)) {
        // Handle arrays like category_ids and available_days
        if (value.length > 0) {
          value.forEach(item => {
            formData.append(`menu_item[${key}][]`, item.toString());
          });
        } else {
          // For empty arrays, send an empty array parameter
          formData.append(`menu_item[${key}][]`, '');
        }
      } else if (value !== undefined && value !== null) {
        formData.append(`menu_item[${key}]`, value.toString());
      }
    });
    
    console.log('Creating menu item with data:', Object.fromEntries(formData.entries()));
    
    const response = await apiClient.post('/menu_items', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Update an existing menu item
   */
  update: async (id: string | number, data: Partial<MenuItem>): Promise<MenuItem> => {
    const formData = new FormData();
    
    // Convert object to form data for API compatibility
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'imageFile' && value instanceof File) {
        formData.append('menu_item[image]', value);
      } else if ((key === 'category_ids' || key === 'available_days') && Array.isArray(value)) {
        // Handle arrays like category_ids and available_days
        if (value.length > 0) {
          value.forEach(item => {
            formData.append(`menu_item[${key}][]`, item.toString());
          });
        } else {
          // For empty arrays, send an empty array parameter
          formData.append(`menu_item[${key}][]`, '');
        }
      } else if (value !== undefined && value !== null) {
        formData.append(`menu_item[${key}]`, value.toString());
      }
    });
    
    console.log('Sending data to API:', Object.fromEntries(formData.entries()));
    
    const response = await apiClient.patch(`/menu_items/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Delete a menu item
   */
  delete: async (id: string | number): Promise<void> => {
    await apiClient.delete(`/menu_items/${id}`);
  },

  /**
   * Upload an image for a menu item
   */
  uploadImage: async (id: string | number, imageFile: File): Promise<MenuItem> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await apiClient.post(`/menu_items/${id}/upload_image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  /**
   * Mark a quantity of menu items as damaged
   */
  markAsDamaged: async (id: string | number, params: MarkAsDamagedParams): Promise<MenuItem> => {
    const response = await apiClient.post(`/menu_items/${id}/mark_as_damaged`, params);
    return response.data;
  },

  /**
   * Update the stock quantity of a menu item
   */
  updateStock: async (id: string | number, params: UpdateStockParams): Promise<MenuItem> => {
    const response = await apiClient.post(`/menu_items/${id}/update_stock`, params);
    return response.data;
  },

  /**
   * Get stock audit history for a menu item
   */
  getStockAudits: async (id: string | number): Promise<MenuItemStockAudit[]> => {
    const response = await apiClient.get(`/menu_items/${id}/stock_audits`);
    return response.data;
  }
};
