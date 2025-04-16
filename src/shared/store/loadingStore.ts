// src/shared/store/loadingStore.ts

import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

/**
 * Store for managing global loading state
 * Used to show/hide loading indicators during API requests
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
