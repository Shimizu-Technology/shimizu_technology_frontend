// src/shared/api/endpoints/menuLayout.ts
import { api } from '../apiClient';
import { MenuLayoutPreferences } from '../../store/restaurantStore';

/**
 * Update menu layout preferences for a restaurant
 * This is a specialized endpoint for updating just the menu layout preferences
 * within the restaurant's admin_settings
 */
export const updateMenuLayoutPreferences = async (restaurantId: number, preferences: MenuLayoutPreferences) => {
  // Validate restaurant ID for tenant isolation
  if (!restaurantId) {
    throw new Error('Restaurant ID is required for updating menu layout preferences');
  }

  // Construct the request payload with the nested structure expected by the API
  const payload = {
    admin_settings: {
      menu_layout_preferences: preferences
    }
  };

  // Log the update for debugging
  console.debug(`[menuLayout] Updating menu layout preferences for restaurant ${restaurantId}:`, preferences);

  // Use the existing restaurant update endpoint
  return api.patch(`/restaurants/${restaurantId}`, payload);
};

/**
 * Fetch menu layout preferences for a restaurant
 */
export const fetchMenuLayoutPreferences = async (restaurantId: number): Promise<MenuLayoutPreferences> => {
  // Validate restaurant ID for tenant isolation
  if (!restaurantId) {
    throw new Error('Restaurant ID is required for fetching menu layout preferences');
  }

  // Fetch the restaurant data which includes admin_settings
  const response = await api.get(`/restaurants/${restaurantId}`) as { data: { admin_settings?: { menu_layout_preferences?: MenuLayoutPreferences } } };
  
  // Get the typed response data
  const responseData = response.data;
  
  // Extract and return just the menu layout preferences
  return responseData?.admin_settings?.menu_layout_preferences || {
    default_layout: 'gallery',
    allow_layout_switching: true
  };
};
