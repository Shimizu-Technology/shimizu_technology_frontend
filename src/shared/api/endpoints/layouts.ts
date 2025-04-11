// src/shared/api/endpoints/layouts.ts

import { api } from '../apiClient';

/**
 * Fetch a specific layout by ID
 */
export const fetchLayout = async (id: number) => {
  return api.get(`/layouts/${id}`);
};

/**
 * Fetch all layouts
 */
export const fetchLayouts = async () => {
  return api.get('/layouts');
};

/**
 * Create a new layout
 */
export const createLayout = async (data: any) => {
  return api.post('/layouts', data);
};

/**
 * Update an existing layout
 */
export const updateLayout = async (id: number, data: any) => {
  return api.patch(`/layouts/${id}`, data);
};

/**
 * Delete a layout
 */
export const deleteLayout = async (id: number) => {
  return api.delete(`/layouts/${id}`);
};

/**
 * Activate a layout (set as current layout for restaurant)
 */
export const activateLayout = async (id: number) => {
  return api.post(`/layouts/${id}/activate`);
};
