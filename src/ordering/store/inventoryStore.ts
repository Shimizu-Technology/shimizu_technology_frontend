import { create } from 'zustand';
import { api } from '../lib/api';
import type { InventoryStatus } from '../types/inventory';

interface InventoryStore {
  inventory: Record<string, InventoryStatus>;
  loading: boolean;
  error: string | null;
  fetchInventory: () => Promise<void>;
  updateInventoryStatus: (itemId: string, status: Partial<InventoryStatus>) => Promise<void>;
}

// Example shape from Rails: [{ itemId: 'aloha-poke', inStock: true, lowStock: false, quantity: 20 }, ...]

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  inventory: {},
  loading: false,
  error: null,

  // GET /inventory_status
  fetchInventory: async () => {
    set({ loading: true, error: null });
    try {
      // Suppose your rails endpoint returns an array of inventory statuses
      const list: InventoryStatus[] = await api.get('/inventory_status');
      const record: Record<string, InventoryStatus> = {};
      list.forEach((inv) => {
        record[inv.itemId] = inv;
      });
      set({ inventory: record, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  // PATCH /inventory_status/:itemId
  updateInventoryStatus: async (itemId, status) => {
    set({ loading: true, error: null });
    try {
      // Usually we'd pass the updated fields in a JSON body, e.g.
      const updated = await api.patch(`/inventory_status/${itemId}`, {
        ...status
      });
      // Merge updated into local store
      set((state) => ({
        loading: false,
        inventory: {
          ...state.inventory,
          [itemId]: { ...state.inventory[itemId], ...updated }
        }
      }));
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  }
}));
