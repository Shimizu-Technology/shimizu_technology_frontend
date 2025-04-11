// src/shared/api/endpoints/events.ts

import { api } from '../apiClient';

/**
 * Fetch all operating hours
 */
export const fetchOperatingHours = async () => {
  return api.get('/operating_hours');
};

/**
 * Update an operating hour
 */
export const updateOperatingHour = async (id: number, data: any) => {
  return api.patch(`/operating_hours/${id}`, data);
};

/**
 * Fetch all special events
 */
export const fetchSpecialEvents = async () => {
  return api.get('/special_events');
};

/**
 * Create a new special event
 */
export const createSpecialEvent = async (data: any) => {
  return api.post('/special_events', data);
};

/**
 * Update an existing special event
 */
export const updateSpecialEvent = async (id: number, data: any) => {
  return api.patch(`/special_events/${id}`, data);
};

/**
 * Delete a special event
 */
export const deleteSpecialEvent = async (id: number) => {
  return api.delete(`/special_events/${id}`);
};
