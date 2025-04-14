// src/shared/api/endpoints/locations.ts

import { apiClient } from '../apiClient';
import { Location, LocationPayload } from '../../types/Location';

const BASE_URL = '/locations';

export const locationsApi = {
  /**
   * Get all locations for the current restaurant
   * @param params Optional filter parameters
   * @returns Promise with locations array
   */
  getLocations: async (params?: { active?: boolean }): Promise<Location[]> => {
    const response = await apiClient.get(BASE_URL, { params });
    return response.data;
  },

  /**
   * Get a specific location by ID
   * @param id Location ID
   * @returns Promise with location object
   */
  getLocation: async (id: number): Promise<Location> => {
    const response = await apiClient.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Create a new location
   * @param location Location data
   * @returns Promise with created location
   */
  createLocation: async (location: LocationPayload): Promise<Location> => {
    const response = await apiClient.post(BASE_URL, { location });
    return response.data;
  },

  /**
   * Update an existing location
   * @param id Location ID
   * @param location Location data
   * @returns Promise with updated location
   */
  updateLocation: async (id: number, location: LocationPayload): Promise<Location> => {
    const response = await apiClient.put(`${BASE_URL}/${id}`, { location });
    return response.data;
  },

  /**
   * Delete a location
   * @param id Location ID
   * @returns Promise with no content
   */
  deleteLocation: async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Set a location as the default
   * @param id Location ID
   * @returns Promise with updated location
   */
  setDefaultLocation: async (id: number): Promise<Location> => {
    const response = await apiClient.put(`${BASE_URL}/${id}/default`);
    return response.data;
  }
};
