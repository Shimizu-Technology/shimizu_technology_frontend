// src/ordering/store/siteSettingsStore.ts
import { create } from 'zustand';
import { api } from '../lib/api';

interface SiteSettingsState {
  heroImageUrl: string | null;
  spinnerImageUrl: string | null;
  fetchSiteSettings: () => Promise<void>;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set) => ({
  heroImageUrl: null,
  spinnerImageUrl: null,

  fetchSiteSettings: async () => {
    try {
      // Fetch global site settings
      const data = await api.get<{
        hero_image_url: string | null;
        spinner_image_url: string | null;
      }>('/admin/site_settings');
      
      set({
        heroImageUrl: data.hero_image_url,
        spinnerImageUrl: data.spinner_image_url,
      });
      
      // Note: We don't need to fetch restaurant-specific settings here
      // because the components that use these settings will also use
      // the useRestaurantStore hook to get the restaurant-specific settings.
      // This store is kept for backward compatibility and as a fallback.
    } catch (err) {
      console.error('Failed to fetch site settings:', err);
    }
  },
}));
