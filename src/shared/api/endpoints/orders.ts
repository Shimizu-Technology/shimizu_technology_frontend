// src/shared/api/endpoints/orders.ts

import { api } from '../apiClient';

/**
 * Fetch all orders
 */
export const fetchOrders = async (params?: any) => {
  return api.get('/orders', params);
};

/**
 * Fetch a specific order
 */
export const fetchOrder = async (id: number) => {
  return api.get(`/orders/${id}`);
};

/**
 * Create a new order
 */
export const createOrder = async (data: any) => {
  return api.post('/orders', data);
};

/**
 * Update an existing order
 */
export const updateOrder = async (id: number, data: any) => {
  return api.patch(`/orders/${id}`, data);
};

/**
 * Delete an order
 */
export const deleteOrder = async (id: number) => {
  return api.delete(`/orders/${id}`);
};

/**
 * Fetch all promo codes
 */
export const fetchPromoCodes = async () => {
  return api.get('/promo_codes');
};

/**
 * Validate a promo code
 */
export const validatePromoCode = async (code: string) => {
  return api.post('/promo_codes/validate', { code });
};
