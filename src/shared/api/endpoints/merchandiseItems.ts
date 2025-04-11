// src/shared/api/endpoints/merchandiseItems.ts
import { apiClient } from '../apiClient';
import { 
  MerchandiseItem, 
  MerchandiseVariant,
  UpdateMerchandiseStockParams,
  MarkMerchandiseAsDamagedParams
} from '../../../ordering/types/merchandise';

export const merchandiseItemsApi = {
  /**
   * Get all merchandise items
   */
  getAll: async (params?: { 
    collection_id?: number; 
    category_id?: number; 
    admin?: boolean; 
    include_stock?: boolean;
    show_all?: boolean;
  }): Promise<MerchandiseItem[]> => {
    const response = await apiClient.get('/merchandise_items', {
      params: {
        ...params,
        // Default include_stock to true unless explicitly set to false
        include_stock: params?.include_stock !== false
      }
    });
    return response.data;
  },

  /**
   * Get a specific merchandise item by ID
   */
  getById: async (id: string | number, includeStock: boolean = true): Promise<MerchandiseItem> => {
    const response = await apiClient.get(`/merchandise_items/${id}`, {
      params: { include_stock: includeStock }
    });
    return response.data;
  },

  /**
   * Create a new merchandise item
   */
  create: async (data: Partial<MerchandiseItem>): Promise<MerchandiseItem> => {
    const formData = new FormData();
    
    // Convert object to form data for API compatibility
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'imageFile' && value instanceof File) {
        formData.append('merchandise_item[image]', value);
      } else if (key === 'additional_images' && Array.isArray(value)) {
        // Handle additional images array
        if (value.length > 0) {
          value.forEach((item) => {
            if (item instanceof File) {
              formData.append('merchandise_item[additional_images][]', item);
            } else if (typeof item === 'string') {
              formData.append('merchandise_item[additional_image_urls][]', item);
            }
          });
        }
      } else if (value !== undefined && value !== null) {
        formData.append(`merchandise_item[${key}]`, value.toString());
      }
    });
    
    const response = await apiClient.post('/merchandise_items', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Update an existing merchandise item
   */
  update: async (id: string | number, data: Partial<MerchandiseItem>): Promise<MerchandiseItem> => {
    const formData = new FormData();
    
    // Convert object to form data for API compatibility
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'imageFile' && value instanceof File) {
        formData.append('merchandise_item[image]', value);
      } else if (key === 'additional_images' && Array.isArray(value)) {
        if (value.length > 0) {
          value.forEach((item) => {
            if (item instanceof File) {
              formData.append('merchandise_item[additional_images][]', item);
            } else if (typeof item === 'string') {
              formData.append('merchandise_item[additional_image_urls][]', item);
            }
          });
        } else {
          // For empty arrays, send an empty array parameter
          formData.append('merchandise_item[additional_images][]', '');
        }
      } else if (value !== undefined && value !== null) {
        formData.append(`merchandise_item[${key}]`, value.toString());
      }
    });
    
    const response = await apiClient.patch(`/merchandise_items/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Delete a merchandise item
   */
  delete: async (id: string | number): Promise<void> => {
    await apiClient.delete(`/merchandise_items/${id}`);
  },

  /**
   * Upload an image for a merchandise item
   */
  uploadImage: async (id: string | number, imageFile: File): Promise<MerchandiseItem> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const response = await apiClient.post(`/merchandise_items/${id}/upload_image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  },

  /**
   * Mark a quantity of merchandise items as damaged
   */
  markAsDamaged: async (
    id: string | number,
    params: MarkMerchandiseAsDamagedParams
  ): Promise<MerchandiseItem> => {
    const response = await apiClient.post(`/merchandise_items/${id}/mark_as_damaged`, params);
    return response.data;
  },

  /**
   * Update the stock quantity of a merchandise item
   */
  updateStock: async (
    id: string | number,
    params: UpdateMerchandiseStockParams
  ): Promise<MerchandiseItem> => {
    const response = await apiClient.post(`/merchandise_items/${id}/update_stock`, params);
    return response.data;
  },

  /**
   * Get variants for a merchandise item
   */
  getVariants: async (id: string | number): Promise<MerchandiseVariant[]> => {
    const response = await apiClient.get(`/merchandise_items/${id}/variants`);
    return response.data;
  },

  /**
   * Update a variant's stock quantity
   */
  updateVariantStock: async (
    itemId: string | number, 
    variantId: string | number, 
    quantity: number, 
    reason: string
  ): Promise<MerchandiseVariant> => {
    const response = await apiClient.post(
      `/merchandise_items/${itemId}/variants/${variantId}/update_stock`,
      {
        stock_quantity: quantity,
        reason
      }
    );
    return response.data;
  },

  /**
   * Update a variant's inventory fields (stock, damaged, threshold)
   */
  updateVariantInventory: async (
    variantId: string | number,
    data: {
      stock_quantity?: number;
      damaged_quantity?: number;
      low_stock_threshold?: number;
    }
  ): Promise<MerchandiseVariant> => {
    const response = await apiClient.patch(`/merchandise_variants/${variantId}`, {
      merchandise_variant: data
    });
    return response.data;
  }
};
