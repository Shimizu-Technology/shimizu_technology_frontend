// src/shared/api/endpoints/reservations.ts

import { api } from '../apiClient';

/**
 * Fetch reservations for a specific date
 */
export const fetchReservations = async (date?: string) => {
  const params: any = {};
  if (date) params.date = date;
  return api.get('/reservations', params);
};

/**
 * Create a new reservation
 */
export const createReservation = async (data: any) => {
  return api.post('/reservations', data);
};

/**
 * Update an existing reservation
 */
export const updateReservation = async (id: number, data: any) => {
  return api.patch(`/reservations/${id}`, data);
};

/**
 * Delete a reservation
 */
export const deleteReservation = async (id: number) => {
  return api.delete(`/reservations/${id}`);
};

/**
 * Fetch waitlist entries for a specific date
 */
export const fetchWaitlistEntries = async (date?: string) => {
  const params: any = {};
  if (date) params.date = date;
  return api.get('/waitlist_entries', params);
};

/**
 * Fetch availability for a specific date and party size
 */
export const fetchAvailability = async (date: string, partySize: number) => {
  return api.get('/availability', { date, party_size: partySize });
};
