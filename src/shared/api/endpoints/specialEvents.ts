// src/shared/api/endpoints/specialEvents.ts

import { api } from '../apiClient';

export interface SpecialEvent {
  id: number;
  description: string;
  event_date: string;
  restaurant_id: number;
  vip_only_checkout?: boolean;
  code_prefix?: string;
}

export interface VipAccessCode {
  id: number;
  special_event_id: number;
  restaurant_id: number;
  code: string;
  name: string;
  max_uses?: number;
  current_uses: number;
  expires_at?: string;
  is_active: boolean;
  user_id?: number;
  group_id?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateCodeParams {
  batch: boolean;
  count?: number;
  name?: string;
  max_uses?: number;
}

// Get all special events for a restaurant
export const getSpecialEvents = async (restaurantId: number): Promise<SpecialEvent[]> => {
  return api.get<SpecialEvent[]>(`/restaurants/${restaurantId}/special_events`);
};

// Get a single special event
export const getSpecialEvent = async (eventId: number): Promise<SpecialEvent> => {
  return api.get<SpecialEvent>(`/special_events/${eventId}`);
};

// Get VIP codes for a special event
export const getVipCodes = async (specialEventId: number): Promise<VipAccessCode[]> => {
  return api.get<VipAccessCode[]>(`/admin/special_events/${specialEventId}/vip_access_codes`);
};

// Generate VIP codes for a special event
export const generateVipCodes = async (specialEventId: number, params: GenerateCodeParams): Promise<VipAccessCode[]> => {
  return api.post<VipAccessCode[]>(`/admin/special_events/${specialEventId}/vip_access_codes`, params);
};

// Update a special event
export const updateSpecialEvent = async (eventId: number, data: Partial<SpecialEvent>): Promise<SpecialEvent> => {
  return api.patch<SpecialEvent>(`/special_events/${eventId}`, data);
};

// Set an event as the current event
export const setAsCurrentEvent = async (eventId: number, restaurantId: number): Promise<SpecialEvent> => {
  return api.post<SpecialEvent>(`/special_events/${eventId}/set_as_current`, { restaurant_id: restaurantId });
};
