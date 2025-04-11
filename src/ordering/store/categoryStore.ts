// src/ordering/store/categoryStore.ts
import { create } from 'zustand';
import { fetchAllCategories, fetchCategoriesByMenu, Category as ApiCategory } from '../../shared/api/endpoints/categories';
import { websocketService } from '../../shared/services/websocketService';

// Use the ApiCategory interface directly instead of creating a duplicate
export type Category = ApiCategory;


interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  currentMenuId: number | null;
  websocketConnected: boolean;

  fetchCategories: () => Promise<void>;
  fetchCategoriesForMenu: (menuId: number, restaurantId?: number) => Promise<void>;
  setCurrentMenuId: (menuId: number | null) => void;
  startCategoriesWebSocket: () => void;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  loading: false,
  error: null,
  currentMenuId: null,
  websocketConnected: false,

  // Set the current menu ID manually (if needed)
  setCurrentMenuId: (menuId: number | null) => {
    set({ currentMenuId: menuId });
  },

  // Fetch all categories (legacy/global)
  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetchAllCategories() as Category[];
      set({ categories: response, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // Fetch categories specific to a given menu
  fetchCategoriesForMenu: async (menuId: number, restaurantId?: number) => {
    // If we already have categories for this menu and WebSocket is connected, don't fetch again
    const state = get();
    if (state.currentMenuId === menuId && state.categories.length > 0 && state.websocketConnected) {
      console.debug('Skipping categories fetch - using WebSocket updates');
      return;
    }

    set({ loading: true, error: null, currentMenuId: menuId });
    try {
      console.debug('Fetching categories from API for menu', menuId);
      const response = await fetchCategoriesByMenu(menuId, restaurantId) as Category[];
      set({ categories: response, loading: false });
      
      // Only try to start WebSocket if we have restaurant ID
      const storedRestaurantId = localStorage.getItem('restaurantId');
      if (storedRestaurantId) {
        // Start WebSocket connection for real-time updates
        get().startCategoriesWebSocket();
      } else {
        console.debug('Restaurant ID not available yet, skipping WebSocket setup for categories');
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  
  // Start WebSocket connection for real-time category updates
  startCategoriesWebSocket: () => {
    // Check if we're already connected to avoid duplicate subscriptions
    if (get().websocketConnected) {
      console.debug('Already connected to categories channel');
      return;
    }

    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      console.debug('No restaurant ID found for WebSocket connection - will retry when available');
      
      // Set up a listener for when restaurant data becomes available
      const checkForRestaurantId = () => {
        const id = localStorage.getItem('restaurantId');
        if (id) {
          console.debug('Restaurant ID now available, connecting to categories WebSocket');
          window.removeEventListener('storage', checkForRestaurantId);
          get().startCategoriesWebSocket();
        }
      };
      
      // Listen for localStorage changes
      window.addEventListener('storage', checkForRestaurantId);
      
      // Also check again after a short delay in case the ID is set by the current window
      setTimeout(() => {
        if (!get().websocketConnected && localStorage.getItem('restaurantId')) {
          get().startCategoriesWebSocket();
        }
      }, 2000);
      
      return;
    }
    
    try {
      console.debug('Subscribing to categories channel with restaurant ID:', restaurantId);
      // Set websocketConnected to true immediately to prevent duplicate API calls
      set({ websocketConnected: true });
      
      // Subscribe to the categories channel
      websocketService.subscribe({
        channel: 'CategoriesChannel',
        params: { restaurant_id: restaurantId },
        received: (data) => {
          console.debug('Received category update via WebSocket', data.type);
          // Handle category updates
          if (data.type === 'category_update') {
            const updatedCategory = data.category;
            
            // Update the specific category in our store
            set(state => ({
              categories: state.categories.map(category => 
                category.id === updatedCategory.id ? { ...category, ...updatedCategory } : category
              )
            }));
          } else if (data.type === 'category_created') {
            // Add the new category to our store if it belongs to the current menu
            const newCategory = data.category;
            const currentMenuId = get().currentMenuId;
            
            if (newCategory.menu_id === currentMenuId) {
              set(state => ({
                categories: [...state.categories, newCategory]
              }));
            }
          } else if (data.type === 'category_deleted') {
            // Remove the category from our store
            const deletedCategoryId = data.category_id;
            set(state => ({
              categories: state.categories.filter(category => category.id !== deletedCategoryId)
            }));
          }
        },
        connected: () => {
          console.debug('Connected to categories channel');
          set({ websocketConnected: true });
        },
        disconnected: () => {
          console.debug('Disconnected from categories channel');
          set({ websocketConnected: false });
        }
      });
    } catch (error) {
      console.error('Error connecting to WebSocket for category updates:', error);
      set({ websocketConnected: false });
    }
  }
}));
