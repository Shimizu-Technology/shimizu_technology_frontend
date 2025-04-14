/**
 * Interface representing a restaurant location
 */
export interface Location {
  id: number;
  restaurant_id: number;
  name: string;
  address: string;
  phone_number: string;
  email?: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  order_count?: number;
}

/**
 * Interface for location creation/update payload
 */
export interface LocationPayload {
  name: string;
  address: string;
  phone_number: string;
  email?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
}
