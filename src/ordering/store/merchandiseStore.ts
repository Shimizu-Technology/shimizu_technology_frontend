// src/ordering/store/merchandiseStore.ts
import { create } from 'zustand';
import { handleApiError } from '../../shared/utils/errorHandler';
import { MerchandiseItem, MerchandiseVariant } from '../types/merchandise';
import { apiClient } from '../../shared/api/apiClient';
import { merchandiseItemsApi } from '../../shared/api/endpoints/merchandiseItems';

interface MerchandiseState {
  merchandiseItems: MerchandiseItem[];
  categories: { id: number; name: string; description?: string }[];
  collections: { id: number; name: string; active: boolean }[];
  currentCollectionId: number | null;
  loading: boolean;
  error: string | null;
  
  // Inventory polling state
  inventoryPolling: boolean;
  inventoryPollingInterval: number | null;
  
  // Actions
  fetchMerchandiseItems: () => Promise<void>;
  fetchAllMerchandiseItemsForAdmin: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  addMerchandiseItem: (data: any) => Promise<MerchandiseItem | null>;
  updateMerchandiseItem: (id: number | string, data: any) => Promise<MerchandiseItem | null>;
  deleteMerchandiseItem: (id: number | string) => Promise<boolean>;
  
  // Visibility actions
  hideMerchandiseItem: (id: number | string) => Promise<MerchandiseItem | null>;
  showMerchandiseItem: (id: number | string) => Promise<MerchandiseItem | null>;
  toggleMerchandiseItemVisibility: (id: number | string) => Promise<MerchandiseItem | null>;
  
  // Inventory polling actions
  startInventoryPolling: (itemId?: number | string) => void;
  stopInventoryPolling: () => void;
  
  // Get individual merchandise item with fresh data
  getMerchandiseItemById: (id: number | string) => Promise<MerchandiseItem | null>;
  
  // Variant management
  getVariants: (itemId: number | string) => Promise<MerchandiseVariant[]>;
  updateVariantStock: (itemId: number | string, variantId: number | string, quantity: number, reason: string) => Promise<MerchandiseVariant | null>;
}

export const useMerchandiseStore = create<MerchandiseState>((set, get) => ({
  merchandiseItems: [],
  categories: [],
  collections: [],
  currentCollectionId: null,
  loading: false,
  error: null,
  
  // Inventory polling state
  inventoryPolling: false,
  inventoryPollingInterval: null,

  fetchMerchandiseItems: async () => {
    set({ loading: true, error: null });
    try {
      // Use the merchandiseItemsApi to get items with stock information
      const items = await merchandiseItemsApi.getAll({ include_stock: true });
      
      // Process the items to ensure image property is set
      const processedItems = items.map((item: any) => ({
        ...item,
        // Ensure the image property is set for compatibility
        image: item.image_url || '/placeholder-merchandise.jpg'
      }));
      
      set({ merchandiseItems: processedItems, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  fetchAllMerchandiseItemsForAdmin: async () => {
    set({ loading: true, error: null });
    try {
      // Use the merchandiseItemsApi to get all items with stock information
      const items = await merchandiseItemsApi.getAll({ 
        admin: true, 
        show_all: true,
        include_stock: true 
      });
      
      // Process the items to ensure image property is set
      const processedItems = items.map((item: any) => ({
        ...item,
        // Ensure the image property is set for compatibility
        image: item.image_url || '/placeholder-merchandise.jpg'
      }));
      
      set({ merchandiseItems: processedItems, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
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

  fetchCollections: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.get('/merchandise_collections');
      const collections = response.data;
      
      // Find the current collection (if any)
      const currentCollection = collections.find((c: any) => c.active);
      const currentCollectionId = currentCollection ? currentCollection.id : null;
      
      set({ collections, currentCollectionId, loading: false });
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
    }
  },

  addMerchandiseItem: async (data: any) => {
    set({ loading: true, error: null });
    try {
      const newItem = await merchandiseItemsApi.create(data);
      
      // Add image property for compatibility
      const processedItem = {
        ...newItem,
        image: newItem.image_url || '/placeholder-merchandise.jpg'
      };
      
      set(state => ({
        merchandiseItems: [...state.merchandiseItems, processedItem],
        loading: false
      }));
      
      return processedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  updateMerchandiseItem: async (id: number | string, data: any) => {
    set({ loading: true, error: null });
    try {
      const updatedItem = await merchandiseItemsApi.update(id, data);
      
      // Add image property for compatibility
      const processedItem = {
        ...updatedItem,
        image: updatedItem.image_url || '/placeholder-merchandise.jpg'
      };
      
      set(state => ({
        merchandiseItems: state.merchandiseItems.map(item => 
          String(item.id) === String(id) ? processedItem : item
        ),
        loading: false
      }));
      
      return processedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  deleteMerchandiseItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      await merchandiseItemsApi.delete(id);
      
      set(state => ({
        merchandiseItems: state.merchandiseItems.filter(item => String(item.id) !== String(id)),
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
  hideMerchandiseItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      const updatedItem = await merchandiseItemsApi.update(id, { hidden: true });
      
      // Add image property for compatibility
      const processedItem = {
        ...updatedItem,
        image: updatedItem.image_url || '/placeholder-merchandise.jpg'
      };
      
      set(state => ({
        merchandiseItems: state.merchandiseItems.map(item => 
          String(item.id) === String(id) ? processedItem : item
        ),
        loading: false
      }));
      
      return processedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },
  
  showMerchandiseItem: async (id: number | string) => {
    set({ loading: true, error: null });
    try {
      const updatedItem = await merchandiseItemsApi.update(id, { hidden: false });
      
      // Add image property for compatibility
      const processedItem = {
        ...updatedItem,
        image: updatedItem.image_url || '/placeholder-merchandise.jpg'
      };
      
      set(state => ({
        merchandiseItems: state.merchandiseItems.map(item => 
          String(item.id) === String(id) ? processedItem : item
        ),
        loading: false
      }));
      
      return processedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage, loading: false });
      return null;
    }
  },
  
  toggleMerchandiseItemVisibility: async (id: number | string) => {
    const item = get().merchandiseItems.find(item => String(item.id) === String(id));
    if (!item) return null;
    
    return item.hidden ? get().showMerchandiseItem(id) : get().hideMerchandiseItem(id);
  },
  
  // Get a single merchandise item by ID
  getMerchandiseItemById: async (id: number | string) => {
    try {
      const item = await merchandiseItemsApi.getById(id);
      
      // Add image property for compatibility
      const processedItem = {
        ...item,
        image: item.image_url || '/placeholder-merchandise.jpg'
      };
      
      // Update this item in the store
      set(state => ({
        merchandiseItems: state.merchandiseItems.map(existingItem => 
          String(existingItem.id) === String(id) 
            ? processedItem
            : existingItem
        )
      }));
      
      return processedItem;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage });
      return null;
    }
  },
  
  // Get variants for a merchandise item
  getVariants: async (itemId: number | string) => {
    try {
      const variants = await merchandiseItemsApi.getVariants(itemId);
      return variants;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage });
      return [];
    }
  },
  
  // Update a variant's stock
  updateVariantStock: async (itemId: number | string, variantId: number | string, quantity: number, reason: string) => {
    try {
      const updatedVariant = await merchandiseItemsApi.updateVariantStock(
        itemId, 
        variantId, 
        quantity, 
        reason
      );
      
      // Refresh the parent item to update its stock status
      await get().getMerchandiseItemById(itemId);
      
      return updatedVariant;
    } catch (error) {
      const errorMessage = handleApiError(error);
      set({ error: errorMessage });
      return null;
    }
  },
  
  // Start polling for inventory updates
  startInventoryPolling: (itemId?: number | string) => {
    // First stop any existing polling
    get().stopInventoryPolling();
    
    // Set polling flag to true
    set({ inventoryPolling: true });
    
    // Start a new polling interval
    const intervalId = window.setInterval(async () => {
      // If we have a specific item ID, just fetch that one
      if (itemId) {
        await get().getMerchandiseItemById(itemId);
      } else {
        // Otherwise refresh all items
        await get().fetchAllMerchandiseItemsForAdmin();
      }
    }, 10000); // Poll every 10 seconds
    
    // Store the interval ID so we can clear it later
    set({ inventoryPollingInterval: intervalId });
  },
  
  // Stop polling for inventory updates
  stopInventoryPolling: () => {
    const { inventoryPollingInterval } = get();
    
    if (inventoryPollingInterval !== null) {
      window.clearInterval(inventoryPollingInterval);
      set({ 
        inventoryPollingInterval: null,
        inventoryPolling: false
      });
    }
  }
}));
