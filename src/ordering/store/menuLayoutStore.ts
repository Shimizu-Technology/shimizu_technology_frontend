// src/ordering/store/menuLayoutStore.ts
import { create } from 'zustand';
import { useRestaurantStore, MenuLayoutPreferences } from '../../shared/store/restaurantStore';

// Define the available layout types
export type MenuLayoutType = 'gallery' | 'list';

interface MenuLayoutState {
  // Current active layout
  layoutType: MenuLayoutType;
  
  // Loading state for API operations
  loading: boolean;
  error: string | null;
  
  // Set the layout type
  setLayoutType: (layoutType: MenuLayoutType) => void;
  
  // Get the default layout for the current restaurant (from admin settings)
  getDefaultLayout: () => MenuLayoutType;
  
  // Check if layout switching is allowed (from admin settings)
  isLayoutSwitchingAllowed: () => boolean;
  
  // Initialize layout based on restaurant settings
  initializeLayout: (restaurantId: number) => void;
  
  // Save layout preferences to the backend
  saveLayoutPreferences: (preferences: MenuLayoutPreferences) => Promise<void>;
  
  // Fetch layout preferences from the backend
  fetchLayoutPreferences: (restaurantId: number) => Promise<void>;
}

export const useMenuLayoutStore = create<MenuLayoutState>()(
  (set, get) => ({
    // Default to gallery view
    layoutType: 'gallery',
    loading: false,
    error: null,
    
    // Set the layout type
    setLayoutType: (layoutType: MenuLayoutType) => {
      // Check if layout switching is allowed by admin settings
      if (!get().isLayoutSwitchingAllowed()) {
        console.debug('MenuLayoutStore: Layout switching is disabled by admin settings, ignoring user preference');
        // If switching is not allowed, keep the admin-defined default
        const defaultLayout = get().getDefaultLayout();
        if (defaultLayout !== get().layoutType) {
          set({ layoutType: defaultLayout });
        }
        return;
      }
      
      // Update local state
      set({ layoutType });
      console.debug(`MenuLayoutStore: Layout set to ${layoutType}`);
    },
    
    // Get the default layout from restaurant admin settings
    getDefaultLayout: () => {
      // Get the current restaurant
      const { restaurant } = useRestaurantStore.getState();
      
      // If we have a restaurant with layout preferences, use those
      if (restaurant?.admin_settings?.menu_layout_preferences?.default_layout) {
        return restaurant.admin_settings.menu_layout_preferences.default_layout as MenuLayoutType;
      }
      
      // Otherwise, fall back to gallery as default
      return 'gallery';
    },
    
    // Check if layout switching is allowed by admin settings
    isLayoutSwitchingAllowed: () => {
      const { restaurant } = useRestaurantStore.getState();
      // Default to true if not specified
      return restaurant?.admin_settings?.menu_layout_preferences?.allow_layout_switching ?? true;
    },
    
    // Initialize layout based on restaurant settings
    initializeLayout: (restaurantId: number) => {
      try {
        console.debug(`MenuLayoutStore: Initializing layout for restaurant ${restaurantId}`);
        
        // Get the current restaurant from the store
        const { restaurant } = useRestaurantStore.getState();
        
        if (!restaurant) {
          console.debug('Cannot initialize layout: No restaurant found in store');
          return;
        }
        
        // Get layout preferences from restaurant settings
        const defaultLayout = restaurant?.admin_settings?.menu_layout_preferences?.default_layout || 'gallery';
        
        // Set the layout type based on restaurant settings
        set({ layoutType: defaultLayout });
        
        console.debug(`MenuLayoutStore: Initialized layout to ${defaultLayout} for restaurant ${restaurantId}`);
      } catch (error) {
        console.error(`MenuLayoutStore: Error initializing layout for restaurant ${restaurantId}:`, error);
      }
    },
    
    // Save layout preferences to the backend
    saveLayoutPreferences: async (preferences: MenuLayoutPreferences) => {
      const { restaurant } = useRestaurantStore.getState();
      
      if (!restaurant || !restaurant.id) {
        set({ error: 'No restaurant context found for saving layout preferences' });
        return;
      }
      
      try {
        set({ loading: true, error: null });
        
        // Import dynamically to avoid circular dependency
        const { updateMenuLayoutPreferences } = await import('../../shared/api/endpoints/menuLayout');
        await updateMenuLayoutPreferences(restaurant.id, preferences);
        
        // Update the local state if this includes a layout change
        if (preferences.default_layout && preferences.default_layout !== get().layoutType) {
          set({ layoutType: preferences.default_layout });
        }
        
        console.debug(`MenuLayoutStore: Saved layout preferences for restaurant ${restaurant.id}:`, preferences);
        
        set({ loading: false });
      } catch (error: unknown) {
        console.error('Error saving menu layout preferences:', error);
        set({ 
          loading: false, 
          error: error instanceof Error ? error.message : 'Unknown error saving layout preferences' 
        });
      }
    },
    
    // Fetch layout preferences from the backend
    fetchLayoutPreferences: async (restaurantId: number) => {
      if (!restaurantId) {
        set({ error: 'Restaurant ID is required for fetching layout preferences' });
        return;
      }
      
      try {
        set({ loading: true, error: null });
        
        // Import dynamically to avoid circular dependency
        const { fetchMenuLayoutPreferences } = await import('../../shared/api/endpoints/menuLayout');
        const preferences = await fetchMenuLayoutPreferences(restaurantId);
        
        // Update the layout type based on fetched preferences
        if (preferences?.default_layout) {
          set({ layoutType: preferences.default_layout });
        }
        
        console.debug(`MenuLayoutStore: Fetched layout preferences for restaurant ${restaurantId}:`, preferences);
        
        set({ loading: false });
      } catch (error: unknown) {
        console.error('Error fetching menu layout preferences:', error);
        set({ 
          loading: false, 
          error: error instanceof Error ? error.message : 'Unknown error fetching layout preferences' 
        });
      }
    }
  })
);
