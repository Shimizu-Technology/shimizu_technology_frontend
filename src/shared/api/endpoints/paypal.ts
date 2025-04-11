import { api } from '../apiClient';

/**
 * Creates a new PayPal order with the specified amount
 * @param amount The order amount as a string (e.g. "10.00")
 * @returns The order ID and client token from PayPal
 */
export const createOrder = async (amount: string): Promise<{ orderId: string }> => {
  return api.post('/paypal/create_order', { amount });
};

/**
 * Captures a previously created PayPal order
 * @param orderID The PayPal order ID to capture
 * @returns Information about the captured payment
 */
export const captureOrder = async (orderID: string): Promise<{ 
  status: string;
  transaction_id: string;
  amount: string;
}> => {
  return api.post('/paypal/capture_order', { orderID });
};
