// src/shared/api/endpoints/vipCodes.ts

import { api } from '../apiClient';

/**
 * Fetch all VIP codes for a restaurant
 */
export const getVipCodes = async (eventId?: number, options?: { include_archived?: boolean }) => {
  const params: any = {};
  
  if (options?.include_archived) {
    params.include_archived = options.include_archived;
  }
  
  return api.get(`/vip_access/codes`, params);
};

/**
 * Search VIP codes by email
 * This is an optimized endpoint that performs the search on the backend
 */
export const searchVipCodesByEmail = async (email: string, options?: { include_archived?: boolean }) => {
  const params: any = { email };
  
  if (options?.include_archived) {
    params.include_archived = options.include_archived;
  }
  
  return api.get(`/vip_access/search_by_email`, params);
};

/**
 * Generate individual VIP codes
 */
export const generateIndividualCodes = async (params: {
  count: number;
  name?: string;
  prefix?: string;
  max_uses?: number | null;
}) => {
  return api.post('/vip_access/generate_codes', {
    ...params,
    batch: true
  });
};

/**
 * Generate a group VIP code
 */
export const generateGroupCode = async (params: {
  name?: string;
  prefix?: string;
  max_uses?: number | null;
}) => {
  return api.post('/vip_access/generate_codes', {
    ...params,
    batch: false
  });
};

/**
 * Deactivate a VIP code
 */
export const deactivateVipCode = async (id: number) => {
  return api.delete(`/vip_access/codes/${id}`);
};

/**
 * Reactivate a VIP code
 */
export const reactivateVipCode = async (id: number) => {
  return api.patch(`/vip_access/codes/${id}`, { is_active: true });
};

/**
 * Update a VIP code
 */
export const updateVipCode = async (id: number, data: any) => {
  return api.patch(`/vip_access/codes/${id}`, data);
};

/**
 * Archive a VIP code
 */
export const archiveVipCode = async (id: number) => {
  return api.post(`/vip_access/codes/${id}/archive`);
};

/**
 * Unarchive a VIP code
 */
export const unarchiveVipCode = async (id: number) => {
  return api.patch(`/vip_access/codes/${id}`, { archived: false });
};

/**
 * Get usage details for a VIP code
 */
export const getCodeUsage = async (id: number) => {
  return api.get(`/vip_access/codes/${id}/usage`);
};

/**
 * Validate a VIP code
 */
export const validateVipCode = async (code: string, restaurantId: number) => {
  return api.post(`/restaurants/${restaurantId}/vip_access/validate_code`, { code });
};

/**
 * Send a VIP code to multiple email addresses
 */
export const sendVipCodeEmail = async (codeId: number, emails: string[]) => {
  return api.post(`/vip_access/send_code_email`, {
    code_id: codeId,
    emails: emails
  });
};

/**
 * Bulk send VIP codes to multiple email addresses
 * Can generate a single code for all emails or a unique code for each email
 */
export const bulkSendVipCodes = async (options: {
  email_list: string[];
  batch_size?: number;
  prefix?: string;
  max_uses?: number;
  name?: string;
  one_code_per_batch?: boolean;
}) => {
  return api.post(`/vip_access/bulk_send_vip_codes`, options);
};

/**
 * Send existing VIP codes to multiple email addresses
 * Uses the provided code IDs instead of generating new ones
 */
export const sendExistingVipCodes = async (options: {
  email_list: string[];
  code_ids: number[];
  batch_size?: number;
}) => {
  return api.post(`/vip_access/send_existing_vip_codes`, options);
};
