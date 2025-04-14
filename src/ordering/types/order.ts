// src/ordering/types/order.ts
import { Location } from '../../shared/types/Location';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: string[];
  notes?: string;
  customizations?: any[];
}

export interface MerchandiseOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variant_id?: number;
  size?: string;
  color?: string;
  notes?: string;
}

export interface Order {
  id: string;
  order_number?: string; // New restaurant-specific order number
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'error';
  items: OrderItem[];
  merchandise_items?: MerchandiseOrderItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  tip?: number;
  special_instructions?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  pickup_time?: string;
  payment_method?: string;
  transaction_id?: string;
  restaurant_id?: string;
  staff_created?: boolean; // Flag to indicate if order was created by staff
  created_by_staff_id?: number | string | null; // ID of the staff member who created this order
  is_staff_order?: boolean; // Flag to indicate if this is a staff order (vs customer order)
  error?: string; // For error handling in optimistic updates
  global_last_acknowledged_at?: string; // Timestamp when any admin acknowledged the order
  location?: Location; // Location information for multi-location restaurants
  location_id?: number; // ID of the location for this order
}

export interface OrderManagerProps {
  selectedOrderId: number | null;
  setSelectedOrderId: React.Dispatch<React.SetStateAction<number | null>>;
  restaurantId?: string;
}

export interface ManagerProps {
  restaurantId?: string;
}
