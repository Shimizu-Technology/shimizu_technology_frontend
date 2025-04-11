// src/shared/api/endpoints/seats.ts

import { api } from '../apiClient';

/**
 * Fetch seat allocations for a specific date and optional time
 */
export const fetchSeatAllocations = async (params: { date: string, time?: string }) => {
  return api.get('/seat_allocations', params);
};

/**
 * Reserve seats for a reservation or waitlist entry
 */
export const seatAllocationReserve = async (data: any) => {
  return api.post('/seat_allocations/reserve', data);
};

/**
 * Create multiple seat allocations at once
 */
export const seatAllocationMultiCreate = async (data: any) => {
  return api.post('/seat_allocations/multi_create', data);
};

/**
 * Mark seat allocation as finished
 */
export const seatAllocationFinish = async (data: any) => {
  return api.post('/seat_allocations/finish', data);
};

/**
 * Mark seat allocation as no-show
 */
export const seatAllocationNoShow = async (data: any) => {
  return api.post('/seat_allocations/no_show', data);
};

/**
 * Mark seat allocation as arrived
 */
export const seatAllocationArrive = async (data: any) => {
  return api.post('/seat_allocations/arrive', data);
};

/**
 * Cancel seat allocation
 */
export const seatAllocationCancel = async (data: any) => {
  return api.post('/seat_allocations/cancel', data);
};

/**
 * Fetch seat sections
 */
export const fetchSeatSections = async () => {
  return api.get('/seat_sections');
};

/**
 * Fetch seats
 */
export const fetchSeats = async () => {
  return api.get('/seats');
};

/**
 * Update a seat
 */
export const updateSeat = async (id: number, data: any) => {
  return api.patch(`/seats/${id}`, data);
};
