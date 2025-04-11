// src/shared/api/endpoints/vipAccess.ts

import { apiClient } from '../apiClient';

interface VipCodeValidationResponse {
  valid: boolean;
  message?: string;
}

/**
 * Validates a VIP access code with the restaurant's server
 * @param restaurantId The ID of the restaurant
 * @param code The VIP code to validate
 * @returns Response indicating if the code is valid and a message if applicable
 */
export const validateVipCode = async (restaurantId: number, code: string): Promise<VipCodeValidationResponse> => {
  try {
    const response = await apiClient.post<VipCodeValidationResponse>(
      `/restaurants/${restaurantId}/vip_access/validate_code`,
      { code }
    );
    return response.data;
  } catch (error: any) {
    // Check if this is a 401 from VIP validation
    if (error.response?.status === 401) {
      // Return invalid response for VIP validation
      return {
        valid: false,
        message: error.response?.data?.message || 'Invalid VIP code'
      };
    }
    throw error;
  }
};
