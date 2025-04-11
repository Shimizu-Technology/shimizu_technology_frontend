// src/shared/api/endpoints/categories.ts
import { api } from '../apiClient';

/**
 * Representation of a Category on the frontend
 */
export interface Category {
  id: number;
  name: string;
  position?: number;
  description?: string;
  menu_id: number;
}

/**
 * Fetch all categories (backward compatibility).
 * It is recommended to use menu-specific endpoints instead.
 */
export const fetchAllCategories = async () => {
  return api.get('/categories');
};

/**
 * Fetch categories for a specific menu
 */
export const fetchCategoriesByMenu = async (menuId: number, restaurantId?: number): Promise<Category[]> => {
  const params: Record<string, any> = {};
  if (restaurantId) {
    params.restaurant_id = restaurantId;
  }
  return api.get<Category[]>(`/menus/${menuId}/categories`, { params });
};

/**
 * Create a new category for a menu
 */
export const createCategory = async (menuId: number, categoryData: Partial<Category>, restaurantId?: number): Promise<Category> => {
  // Add restaurant_id to the URL as a query parameter
  const url = restaurantId
    ? `/menus/${menuId}/categories?restaurant_id=${restaurantId}`
    : `/menus/${menuId}/categories`;
  
  return api.post<Category>(url, {
    category: categoryData,
  });
};

/**
 * Update an existing category
 */
export const updateCategory = async (
  menuId: number,
  categoryId: number,
  categoryData: Partial<Category>,
  restaurantId?: number
): Promise<Category> => {
  // Add restaurant_id to the URL as a query parameter
  const url = restaurantId
    ? `/menus/${menuId}/categories/${categoryId}?restaurant_id=${restaurantId}`
    : `/menus/${menuId}/categories/${categoryId}`;
  
  return api.patch<Category>(url, {
    category: categoryData,
  });
};

/**
 * Delete a category
 */
export const deleteCategory = async (menuId: number, categoryId: number, restaurantId?: number) => {
  // Add restaurant_id to the URL as a query parameter
  const url = restaurantId
    ? `/menus/${menuId}/categories/${categoryId}?restaurant_id=${restaurantId}`
    : `/menus/${menuId}/categories/${categoryId}`;
  
  return api.delete(url);
};
