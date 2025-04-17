// src/shared/store/restaurantStore.ts

import { create } from 'zustand';
import { 
  fetchRestaurant, 
  updateRestaurant as apiUpdateRestaurant,
  toggleVipMode as apiToggleVipMode,
  setCurrentEvent as apiSetCurrentEvent 
} from '../api/endpoints/restaurants';
import { config } from '../config';

// Menu layout preferences interface
export interface MenuLayoutPreferences {
  default_layout?: 'gallery' | 'list';
  allow_layout_switching?: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone_number: string;
  contact_email?: string;
  time_zone: string;
  time_slot_interval: number;
  default_reservation_length: number;
  admin_settings: Record<string, any> & {
    menu_layout_preferences?: MenuLayoutPreferences;
  };
  allowed_origins: string[];
  primary_frontend_url?: string;
  custom_pickup_location?: string;
  // Social media fields
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  // VIP-related fields
  vip_only_checkout?: boolean;
  vip_enabled?: boolean;
  code_prefix?: string;
  current_event_id?: number;
  current_layout_id?: number;
  current_seat_count?: number;
}

interface RestaurantStore {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  fetchRestaurant: () => Promise<void>;
  updateRestaurant: (data: Partial<Restaurant>) => Promise<void>;
  toggleVipMode: (enabled: boolean) => Promise<any>;
  setCurrentEvent: (eventId: number | null) => Promise<any>;
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  restaurant: null,
  loading: false,
  error: null,
  fetchRestaurant: async () => {
    set({ loading: true, error: null });
    try {
      // Use the configured restaurant ID from environment variables
      const restaurantId = parseInt(config.restaurantId);
      const data = await fetchRestaurant(restaurantId);
      set({ restaurant: data as Restaurant, loading: false });
    } catch (err: any) {
      console.error('Failed to fetch restaurant:', err);
      set({ 
        error: err.message || 'Failed to fetch restaurant', 
        loading: false 
      });
    }
  },
  updateRestaurant: async (data: Partial<Restaurant>) => {
    const { restaurant } = get();
    if (!restaurant) return;

    set({ loading: true, error: null });
    try {
      // Update on the server
      await apiUpdateRestaurant(restaurant.id, data);
      
      // Update in the store
      set({ 
        restaurant: { ...restaurant, ...data },
        loading: false 
      });
    } catch (err: any) {
      console.error('Failed to update restaurant:', err);
      set({ 
        error: err.message || 'Failed to update restaurant', 
        loading: false 
      });
      throw err; // Re-throw to allow the component to handle the error
    }
  },
  toggleVipMode: async (enabled: boolean) => {
    const { restaurant } = get();
    if (!restaurant) return;

    set({ loading: true, error: null });
    try {
      const result = await apiToggleVipMode(restaurant.id, enabled);
      set({ 
        restaurant: { 
          ...restaurant, 
          vip_enabled: enabled 
        },
        loading: false 
      });
      return result;
    } catch (err: any) {
      console.error('Failed to toggle VIP mode:', err);
      set({ 
        error: err.message || 'Failed to toggle VIP mode', 
        loading: false 
      });
      throw err;
    }
  },
  setCurrentEvent: async (eventId: number | null) => {
    const { restaurant } = get();
    if (!restaurant) return;

    set({ loading: true, error: null });
    try {
      const result = await apiSetCurrentEvent(restaurant.id, eventId);
      set({ 
        restaurant: result as Restaurant, 
        loading: false 
      });
      return result;
    } catch (err: any) {
      console.error('Failed to set current event:', err);
      set({ 
        error: err.message || 'Failed to set current event', 
        loading: false 
      });
      throw err;
    }
  }
}));
