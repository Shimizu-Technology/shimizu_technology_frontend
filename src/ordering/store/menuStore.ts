// src/ordering/store/menuStore.ts
import { create } from 'zustand';
import { menusApi, Menu } from '../../shared/api/endpoints/menus';
import { handleApiError } from '../../shared/utils/errorHandler';
import { MenuItem, Category } from '../types/menu';
import { apiClient } from '../../shared/api/apiClient';
import { menuItemsApi } from '../../shared/api/endpoints/menuItems';
import { websocketService } from '../../shared/services/websocketService';

interface MenuState {
  menus: Menu[];
  currentMenuId: number | null;
  menuItems: MenuItem[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  
  // Inventory update state
  inventoryPolling: boolean;
  inventoryPollingInterval: number | null;
  websocketConnected: boolean;
  
  // Actions
  fetchMenus: () => Promise<void>;
  fetchMenuItems: () => Promise<void>;
  fetchAllMenuItemsForAdmin: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createMenu: (name: string, restaurantId: number) => Promise<Menu | null>;
  updateMenu: (id: number, data: Partial<Menu>) => Promise<Menu | null>;
  deleteMenu: (id: number) => Promise<boolean>;
  setActiveMenu: (id: number) => Promise<boolean>;
  cloneMenu: (id: number) => Promise<Menu | null>;
  addMenuItem: (data: any) => Promise<MenuItem | null>;
  updateMenuItem: (id: number | string, data: any) => Promise<MenuItem | null>;
  deleteMenuItem: (id: number | string) => Promise<boolean>;
  
  // Menu item copy functionality
  fetchMenuItemsByMenu: (menuId: number) => Promise<MenuItem[]>;
  copyMenuItem: (itemId: string, targetMenuId: number, categoryIds: number[]) => Promise<MenuItem | null>;
  
  // Visibility actions
  hideMenuItem: (id: number | string) => Promise<MenuItem | null>;
  showMenuItem: (id: number | string) => Promise<MenuItem | null>;
  toggleMenuItemVisibility: (id: number | string) => Promise<MenuItem | null>;
  
  // Inventory polling actions
  startInventoryPolling: (menuItemId?: number | string) => void;
  startInventoryPollingFallback: (menuItemId?: number | string) => void;
  stopInventoryPolling: () => void;
  startMenuItemsWebSocket: () => void;
  
  // Get individual menu item with fresh data
  getMenuItemById: (id: number | string) => Promise<MenuItem | null>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  menus: [],
  currentMenuId: null,
  menuItems: [],
  categories: [],
  loading: false,
  error: null,
  
  // Inventory update state
  inventoryPolling: false,
  inventoryPollingInterval: null,
  websocketConnected: false,

  fetchMenus: async () => {
    set({ loading: true, error: null });
    try {
      const menus = await menusApi.getAll();
      
      // Find the current menu (if any)
      const currentMenu = menus.find(menu => menu.active);
      const currentMenuId = currentMenu ? currentMenu.id : null;
      
      set({ menus, currentMenuId, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  createMenu: async (name: string, restaurantId: number) => {
    set({ loading: true, error: null });
    try {
      const newMenu = await menusApi.create({
        name,
        active: false,
        restaurant_id: restaurantId
      });
      
      set(state => ({
        menus: [...state.menus, newMenu],
        loading: false
      }));
      
      return newMenu;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  updateMenu: async (id: number, data: Partial<Menu>) => {
    set({ loading: true, error: null });
    try {
      const updatedMenu = await menusApi.update(id, data);
      
      set(state => ({
        menus: state.menus.map(menu => 
          menu.id === id ? updatedMenu : menu
        ),
        loading: false
      }));
      
      return updatedMenu;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  deleteMenu: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await menusApi.delete(id);
      
      set(state => ({
        menus: state.menus.filter(menu => menu.id !== id),
        loading: false
      }));
      
      return true;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return false;
    }
  },

  setActiveMenu: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const result = await menusApi.setActive(id);
      
      set(state => ({
        menus: state.menus.map(menu => ({
          ...menu,
          active: menu.id === id
        })),
        currentMenuId: result.current_menu_id,
        loading: false
      }));
      
      return true;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return false;
    }
  },

  cloneMenu: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const clonedMenu = await menusApi.clone(id);
      
      // After cloning a menu, fetch all menu items again to ensure we have
      // all the items associated with the newly cloned menu
      // Use the same parameters as fetchAllMenuItemsForAdmin
      const response = await apiClient.get('/menu_items?admin=true&show_all=true');
      const menuItems = response.data.map((item: any) => ({
        ...item,
        image: item.image_url || '/placeholder-food.png'
      }));
      
      set(state => ({
        menus: [...state.menus, clonedMenu],
        menuItems,
        loading: false
      }));
      
      return clonedMenu;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/categories');
      set({ categories: response.data, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  fetchMenuItems: async () => {
    // If we already have menu items and WebSocket is connected, don't fetch again
    const state = get();
    if (state.menuItems.length > 0 && state.websocketConnected) {
      console.debug('Skipping menu items fetch - using WebSocket updates');
      return;
    }

    set({ loading: true, error: null });
    try {
      console.debug('Fetching menu items from API');
      // Use the menuItemsApi to get menu items with stock information
      const menuItems = await menuItemsApi.getAll({ include_stock: true });
      
      // Process the items to ensure image property is set
      const processedItems = menuItems.map((item: any) => ({
        ...item,
        // Ensure the image property is set for compatibility
        image: item.image_url || '/placeholder-food.png'
      }));
      
      set({ menuItems: processedItems, loading: false });
      
      // Only try to start WebSocket if we have restaurant ID
      const restaurantId = localStorage.getItem('restaurantId');
      if (restaurantId) {
        // Start WebSocket connection for real-time updates
        get().startMenuItemsWebSocket();
      } else {
        console.debug('Restaurant ID not available yet, skipping WebSocket setup for menu items');
      }
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  fetchAllMenuItemsForAdmin: async () => {
    set({ loading: true, error: null });
    try {
      // Use the menuItemsApi to get all menu items with stock information
      const menuItems = await menuItemsApi.getAll({ 
        admin: true, 
        show_all: true,
        include_stock: true 
      });
      
      // Process the items to ensure image property is set
      const processedItems = menuItems.map((item: any) => ({
        ...item,
        // Ensure the image property is set for compatibility
        image: item.image_url || '/placeholder-food.png'
      }));
      
      set({ menuItems: processedItems, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  addMenuItem: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      
      // Handle file upload if present
      if (data.imageFile) {
        formData.append('menu_item[image]', data.imageFile);
        delete data.imageFile;
      }
      
      // Add all other fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Special handling for arrays
          if (Array.isArray(value)) {
            // For arrays like available_days, append each value individually
            value.forEach((item, index) => {
              formData.append(`menu_item[${key}][]`, String(item));
            });
          } else {
            formData.append(`menu_item[${key}]`, String(value));
          }
        }
      });
      
      const response = await apiClient.post('/menu_items', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const newItem = {
        ...response.data,
        image: response.data.image_url || '/placeholder-food.png'
      };
      
      set(state => ({
        menuItems: [...state.menuItems, newItem],
        loading: false
      }));
      
      return newItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  updateMenuItem: async (id: number | string, data: any) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      
      // Handle file upload if present
      if (data.imageFile) {
        formData.append('menu_item[image]', data.imageFile);
        delete data.imageFile;
      }
      
      // Add all other fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Special handling for arrays
          if (Array.isArray(value)) {
            // For arrays like available_days, append each value individually
            value.forEach((item, index) => {
              formData.append(`menu_item[${key}][]`, String(item));
            });
          } else {
            formData.append(`menu_item[${key}]`, String(value));
          }
        }
      });
      
      const response = await apiClient.patch(`/menu_items/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const updatedItem = {
        ...response.data,
        image: response.data.image_url || '/placeholder-food.png'
      };
      
      set(state => ({
        menuItems: state.menuItems.map(item => 
          String(item.id) === String(id) ? updatedItem : item
        ),
        loading: false
      }));
      
      return updatedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  deleteMenuItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      await apiClient.delete(`/menu_items/${id}`);
      
      set(state => ({
        menuItems: state.menuItems.filter(item => String(item.id) !== String(id)),
        loading: false
      }));
      
      return true;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return false;
    }
  },
  
  // Visibility actions
  hideMenuItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.patch(`/menu_items/${id}`, {
        menu_item: { hidden: true }
      });
      
      const updatedItem = {
        ...response.data,
        image: response.data.image_url || '/placeholder-food.png'
      };
      
      set(state => ({
        menuItems: state.menuItems.map(item => 
          String(item.id) === String(id) ? updatedItem : item
        ),
        loading: false
      }));
      
      return updatedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },
  
  showMenuItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.patch(`/menu_items/${id}`, {
        menu_item: { hidden: false }
      });
      
      const updatedItem = {
        ...response.data,
        image: response.data.image_url || '/placeholder-food.png'
      };
      
      set(state => ({
        menuItems: state.menuItems.map(item => 
          String(item.id) === String(id) ? updatedItem : item
        ),
        loading: false
      }));
      
      return updatedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },
  
  toggleMenuItemVisibility: async (id: number | string) => {
    const item = get().menuItems.find(item => String(item.id) === String(id));
    if (!item) return null;
    
    return item.hidden ? get().showMenuItem(id) : get().hideMenuItem(id);
  },
  
  // Get a single menu item by ID
  getMenuItemById: async (id: number | string) => {
    try {
      const item = await menuItemsApi.getById(id);
      
      // Update this item in the store
      set(state => ({
        menuItems: state.menuItems.map(existingItem => 
          String(existingItem.id) === String(id) 
            ? { ...item, image: item.image_url || existingItem.image || '/placeholder-food.png' }
            : existingItem
        )
      }));
      
      return item;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage });
      return null;
    }
  },
  
  // Start real-time inventory updates using WebSockets with polling fallback
  startInventoryPolling: (menuItemId?: number | string) => {
    // First stop any existing polling
    get().stopInventoryPolling();
    
    // Try to connect via WebSocket first
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      console.error('No restaurant ID found for WebSocket connection');
      return get().startInventoryPollingFallback(menuItemId);
    }
    
    // Set up WebSocket handlers for inventory updates
    try {
      // Subscribe to the inventory channel
      websocketService.subscribe({
        channel: 'InventoryChannel',
        received: (data) => {
          // Handle inventory updates
          if (data.type === 'inventory_update') {
            const updatedItem = data.item;
            
            // Update the specific item in our store
            set(state => ({
              menuItems: state.menuItems.map(item => 
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
              )
            }));
          }
        },
        connected: () => {
          console.debug('Connected to inventory channel');
          set({ websocketConnected: true });
        },
        disconnected: () => {
          console.debug('Disconnected from inventory channel');
          set({ websocketConnected: false });
          
          // Fall back to polling if WebSocket disconnects
          get().startInventoryPollingFallback(menuItemId);
        }
      });
    } catch (error) {
      console.error('Error connecting to WebSocket for inventory updates:', error);
      // Fall back to polling if WebSocket connection fails
      get().startInventoryPollingFallback(menuItemId);
    }
  },
  
  // Start WebSocket connection for real-time menu item updates
  startMenuItemsWebSocket: () => {
    // First, ensure any existing polling is stopped
    get().stopInventoryPolling();
    
    // Check if we're already connected to avoid duplicate subscriptions
    if (get().websocketConnected) {
      console.debug('[MenuStore] Already connected to menu items channel');
      return;
    }

    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      console.debug('[MenuStore] No restaurant ID found for WebSocket connection - will retry when available');
      
      // Set up a listener for when restaurant data becomes available
      const checkForRestaurantId = () => {
        const id = localStorage.getItem('restaurantId');
        if (id) {
          console.debug('[MenuStore] Restaurant ID now available, connecting to WebSocket');
          window.removeEventListener('storage', checkForRestaurantId);
          get().startMenuItemsWebSocket();
        }
      };
      
      // Listen for localStorage changes
      window.addEventListener('storage', checkForRestaurantId);
      
      // Also check again after a short delay in case the ID is set by the current window
      setTimeout(() => {
        if (!get().websocketConnected && localStorage.getItem('restaurantId')) {
          get().startMenuItemsWebSocket();
        }
      }, 2000);
      
      return;
    }
    
    try {
      console.debug('[MenuStore] Subscribing to menu items channel with restaurant ID:', restaurantId);
      // Set websocketConnected to true immediately to prevent duplicate API calls
      set({ websocketConnected: true });
      
      // Double-check that polling is stopped before WebSocket connection
      if (get().inventoryPollingInterval !== null) {
        console.debug('[MenuStore] Stopping inventory polling before WebSocket connection');
        get().stopInventoryPolling();
      }
      
      // Subscribe to the menu items channel
      websocketService.subscribe({
        channel: 'MenuItemsChannel',
        params: { restaurant_id: restaurantId },
        received: (data) => {
          console.debug('[MenuStore] Received menu items update via WebSocket', data.type);
          // Handle menu item updates
          if (data.type === 'menu_item_update') {
            const updatedItem = data.item;
            
            // Update the specific item in our store
            set(state => ({
              menuItems: state.menuItems.map(item => 
                item.id === updatedItem.id ? { ...item, ...updatedItem } : item
              )
            }));
            console.debug(`[MenuStore] Updated menu item ${updatedItem.id} via WebSocket`);
          } else if (data.type === 'menu_item_created') {
            // Add the new item to our store
            const newItem = data.item;
            set(state => ({
              menuItems: [...state.menuItems, {
                ...newItem,
                image: newItem.image_url || '/placeholder-food.png'
              }]
            }));
            console.debug(`[MenuStore] Added new menu item via WebSocket`);
          } else if (data.type === 'menu_item_deleted') {
            // Remove the item from our store
            const deletedItemId = data.item_id;
            set(state => ({
              menuItems: state.menuItems.filter(item => item.id !== deletedItemId)
            }));
            console.debug(`[MenuStore] Removed menu item ${deletedItemId} via WebSocket`);
          }
        },
        connected: () => {
          console.debug('[MenuStore] Connected to menu items channel');
          set({ websocketConnected: true });
          
          // Ensure polling is stopped when WebSocket is connected
          if (get().inventoryPollingInterval !== null) {
            console.debug('[MenuStore] Stopping inventory polling after WebSocket connection');
            get().stopInventoryPolling();
          }
          
          // Double-check that polling is stopped after connection
          setTimeout(() => {
            if (get().inventoryPollingInterval !== null) {
              console.debug('[MenuStore] Stopping lingering inventory polling after WebSocket connection');
              get().stopInventoryPolling();
            }
          }, 1000);
        },
        disconnected: () => {
          console.debug('[MenuStore] Disconnected from menu items channel');
          set({ websocketConnected: false });
          
          // Try to reconnect before falling back to polling
          console.debug('[MenuStore] Attempting to reconnect WebSocket before falling back to polling');
          setTimeout(() => {
            // Check if we're still disconnected before starting polling
            if (!get().websocketConnected && get().inventoryPollingInterval === null) {
              console.debug('[MenuStore] WebSocket reconnection failed, falling back to polling');
              get().startInventoryPollingFallback();
            }
          }, 3000);
        }
      });
    } catch (error) {
      console.error('[MenuStore] Error connecting to WebSocket for menu item updates:', error);
      set({ websocketConnected: false });
      
      // Try to reconnect before falling back to polling
      console.debug('[MenuStore] Attempting to reconnect WebSocket after error before falling back to polling');
      setTimeout(() => {
        // Check if we're still disconnected before starting polling
        if (!get().websocketConnected && get().inventoryPollingInterval === null) {
          console.debug('[MenuStore] WebSocket reconnection failed after error, falling back to polling');
          get().startInventoryPollingFallback();
        }
      }, 3000);
    }
  },
  
  // Fallback to traditional polling if WebSockets aren't available
  startInventoryPollingFallback: (menuItemId?: number | string) => {
    console.debug('[MenuStore] Considering fallback to inventory polling');
    
    // First, try to establish a WebSocket connection instead of polling
    if (!get().websocketConnected) {
      console.debug('[MenuStore] Attempting to establish WebSocket connection before falling back to polling');
      try {
        // Try to start WebSocket connection first
        get().startMenuItemsWebSocket();
        
        // Give the WebSocket a moment to connect before deciding to poll
        setTimeout(() => {
          if (get().websocketConnected) {
            console.debug('[MenuStore] WebSocket connected successfully, no need for polling');
            return;
          } else {
            console.debug('[MenuStore] WebSocket connection attempt failed, proceeding with polling');
            // Continue with polling setup below if the WebSocket didn't connect
            setupPolling();
          }
        }, 2000); // Wait 2 seconds for WebSocket to connect
        
        return; // Exit early while we wait to see if WebSocket connects
      } catch (error) {
        console.error('[MenuStore] Error attempting WebSocket connection:', error);
        // Continue with polling if WebSocket connection attempt fails
      }
    } else {
      console.debug('[MenuStore] WebSocket is already connected, not starting polling');
      return;
    }
    
    // Setup polling function that will be called if WebSocket fails
    function setupPolling() {
      // Double-check WebSocket status before setting up polling
      if (get().websocketConnected) {
        console.debug('[MenuStore] WebSocket is now connected, not starting polling');
        return;
      }
      
      // Check if polling is already active
      if (get().inventoryPollingInterval !== null) {
        console.debug('[MenuStore] Polling already active, not starting another interval');
        return;
      }
      
      // Set polling flag to true
      set({ inventoryPolling: true });
      
      // Start a new polling interval
      const intervalId = window.setInterval(async () => {
        // Double-check WebSocket status before each poll
        if (get().websocketConnected) {
          console.debug('[MenuStore] WebSocket is now connected, stopping polling');
          get().stopInventoryPolling();
          return;
        }
        
        console.debug(`[MenuStore] Polling for inventory updates${menuItemId ? ` for item ${menuItemId}` : ''}`);
        
        // If we have a specific menu item ID, just fetch that one
        if (menuItemId) {
          await get().getMenuItemById(menuItemId);
        } else {
          // Otherwise refresh all menu items
          await get().fetchAllMenuItemsForAdmin();
        }
        
        // Check WebSocket status after polling
        if (get().websocketConnected) {
          console.debug('[MenuStore] WebSocket connected after polling, stopping polling');
          get().stopInventoryPolling();
        }
        
        // Periodically try to reconnect WebSocket
        if (!get().websocketConnected && Math.random() < 0.2) { // 20% chance each poll interval
          console.debug('[MenuStore] Attempting to re-establish WebSocket connection during polling cycle');
          get().startMenuItemsWebSocket();
        }
      }, 10000); // Poll every 10 seconds
      
      // Store the interval ID so we can clear it later
      set({ inventoryPollingInterval: intervalId });
    }
    
    // Call setupPolling immediately if we didn't try WebSocket connection
    if (!get().websocketConnected) {
      setupPolling();
    }
  },
  
  // Stop polling for inventory updates
  // Fetch menu items for a specific menu
  fetchMenuItemsByMenu: async (menuId: number) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get(`/menus/${menuId}/menu_items`);
      
      // Process the items to ensure image property is set
      const processedItems = response.data.map((item: any) => ({
        ...item,
        image: item.image_url || '/placeholder-food.png'
      }));
      
      set({ loading: false });
      return processedItems;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return [];
    }
  },
  
  // Copy a menu item to another menu
  copyMenuItem: async (itemId: string, targetMenuId: number, categoryIds: number[]) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.post(`/menu_items/${itemId}/copy`, {
        target_menu_id: targetMenuId,
        category_ids: categoryIds
      });
      
      const newItem = {
        ...response.data,
        image: response.data.image_url || '/placeholder-food.png'
      };
      
      // Add the new item to our store
      set(state => ({
        menuItems: [...state.menuItems, newItem],
        loading: false
      }));
      
      return newItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },
  
  stopInventoryPolling: () => {
    const { inventoryPollingInterval, websocketConnected } = get();
    
    // Log the current state for debugging
    console.debug('[MenuStore] Stopping inventory polling', {
      hasPollingInterval: inventoryPollingInterval !== null,
      websocketConnected
    });
    
    // Clear any polling interval
    if (inventoryPollingInterval !== null) {
      console.debug('[MenuStore] Clearing inventory polling interval');
      window.clearInterval(inventoryPollingInterval);
      
      set({
        inventoryPollingInterval: null,
        inventoryPolling: false
      });
    }
    
    // Important: Do NOT set websocketConnected to false here
    // We want to keep the WebSocket connection if it's already established
    // Only unsubscribe from the inventory channel if we're explicitly told to
    // and we're not connected to the WebSocket
    if (!websocketConnected) {
      try {
        console.debug('[MenuStore] Unsubscribing from inventory channel');
        websocketService.unsubscribe('InventoryChannel');
      } catch (error) {
        console.error('[MenuStore] Error unsubscribing from inventory channel:', error);
      }
    }
  }
}));
