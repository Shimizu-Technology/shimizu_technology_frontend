// src/shared/api/endpoints/menu.ts
import { api } from '../apiClient';
import { uploadFile, objectToFormData } from '../utils';

/**
 * Menu interface
 */
export interface Menu {
  id: number;
  name: string;
  restaurant_id?: number;
  active?: boolean;
  // ...any other properties
}

/**
 * Menu Item interface (example)
 */
export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price?: number;
  menu_id?: number;
  // ...any other properties
}

/**
 * Fetch all menus
 */
export const fetchMenus = async () => {
  return api.get('/menus');
};

/**
 * Fetch a single menu
 */
export const fetchMenu = async (menuId: number) => {
  return api.get(`/menus/${menuId}`);
};

/**
 * Create a new menu
 */
export const createMenu = async (name: string, restaurantId: number) => {
  return api.post('/menus', {
    menu: { name, restaurant_id: restaurantId },
  });
};

/**
 * Update an existing menu
 */
export const updateMenu = async (menuId: number, data: Partial<Menu>) => {
  return api.patch(`/menus/${menuId}`, {
    menu: data,
  });
};

/**
 * Delete a menu
 */
export const deleteMenu = async (menuId: number) => {
  return api.delete(`/menus/${menuId}`);
};

/**
 * Set a menu as active
 */
export const setActiveMenu = async (menuId: number) => {
  return api.patch(`/menus/${menuId}/activate`);
};

/**
 * Clone an existing menu
 */
export const cloneMenu = async (menuId: number) => {
  return api.post(`/menus/${menuId}/clone`);
};

/**
 * Fetch all menu items
 */
export const fetchAllMenuItems = async () => {
  return api.get('/menu_items');
};

/**
 * Create or update a menu item (with optional image upload example)
 */
export const saveMenuItemWithImage = async (
  data: Record<string, any>,
  imageFile?: File | null,
  itemId?: string | number
) => {
  if (!imageFile) {
    // Normal JSON request
    const endpoint = itemId ? `/menu_items/${itemId}` : '/menu_items';
    const method = itemId ? 'patch' : 'post';
    return api[method](endpoint, { menu_item: data });
  } else {
    // Multipart form-data
    const formData = objectToFormData({ menu_item: data });
    formData.append('menu_item[image]', imageFile);
    const endpoint = itemId ? `/menu_items/${itemId}` : '/menu_items';
    const method = itemId ? 'PATCH' : 'POST';
    return api.upload(endpoint, formData, method);
  }
};

/**
 * Example of uploading just an image for a menu item
 */
export const uploadMenuItemImage = async (itemId: string, file: File) => {
  return uploadFile(`/menu_items/${itemId}/upload_image`, file, 'image');
};
