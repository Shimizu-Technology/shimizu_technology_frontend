// src/shared/store/siteSettingsStore.ts
import { create } from 'zustand';
import { api } from '../api';

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
      const data = await api.get<{ hero_image_url: string | null, spinner_image_url: string | null }>('/admin/site_settings');
      set({
        heroImageUrl: data.hero_image_url,
        spinnerImageUrl: data.spinner_image_url,
      });
    } catch (err) {
      console.error('Failed to fetch site settings:', err);
    }
  },
}));

// Initialize site settings on module load
useSiteSettingsStore.getState().fetchSiteSettings();
