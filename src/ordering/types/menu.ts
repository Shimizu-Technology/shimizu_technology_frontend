// src/ordering/types/menu.ts

// Import the Category type from the API endpoints to ensure consistency
import { Category } from '../../shared/api/endpoints/categories';

// Re-export the Category type
export type { Category };

/**
 * Interface for menu item filtering parameters
 * Used for optimized backend filtering instead of frontend filtering
 */
export interface MenuItemFilterParams {
  restaurant_id?: number;
  category_id?: number;
  menu_id?: number;
  featured?: boolean;
  seasonal?: boolean;
  hidden?: boolean;
  available_on_day?: number | string; // 0-6 for days of week (can be string for API compatibility)
  search_query?: string;
  view_type?: 'list' | 'detail' | 'admin'; // Optimize response size
  include_stock?: boolean;
  page?: number;
  per_page?: number;
}

export interface MenuOption {
  id: number;
  name: string;
  additional_price: number;
  additional_price_float?: number; // Added this property to match the API response
  available: boolean;
  is_preselected?: boolean;
  is_available?: boolean; // Whether this option is currently available for ordering
}

export interface OptionGroup {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_option_count: number;
  options: MenuOption[];
  has_available_options?: boolean;
  required_but_unavailable?: boolean;
}

/**
 * Stock audit record for tracking inventory changes
 */
export interface MenuItemStockAudit {
  id: number;
  menu_item_id: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  user_id?: number;
  order_id?: number;
  created_at: string;
  updated_at: string;
}

/**
 * API response shape for a menu item 
 */
export interface MenuItem {
  // API returns string IDs, but we sometimes work with them as numbers
  id: string;
  name: string;
  description: string;
  price: number;
  has_required_unavailable_options?: boolean;
  cost_to_make?: number;
  
  // Restaurant identifier for tenant isolation
  restaurant_id?: string | number;

  /**
   * Just numeric category IDs from your Rails model
   * Example: category_ids: [1, 2, 3]
   */
  category_ids?: number[];

  // Image-related properties
  image: string;  // Used for display - this is REQUIRED (set fallback if needed)
  image_url?: string; // Raw response from API

  // Menu related
  menu_id?: number;
  
  // Option groups
  option_groups?: OptionGroup[];
  
  // Availability
  advance_notice_hours?: number;
  seasonal?: boolean;
  available_from?: string | null;
  available_until?: string | null;
  promo_label?: string | null;
  featured?: boolean;
  
  /**
   * Day-specific availability (0-6, where 0 is Sunday)
   * Empty array means available on all days
   * Note: The API may return these as strings, so the type allows both
   */
  available_days?: (number | string)[];
  
  // Inventory status
  stock_status?: 'in_stock' | 'out_of_stock' | 'low_stock' | 'limited';
  status_note?: string | null;
  
  // Inventory tracking
  enable_stock_tracking?: boolean;
  stock_quantity?: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  available_quantity?: number; // Computed: stock_quantity - damaged_quantity
  
  // Visibility status
  hidden?: boolean;
  
  // Customizations for order items
  customizations?: Record<string, string[]> | any;
  
  // Payment status for added items in orders
  paymentStatus?: 'needs_payment' | 'already_paid';
  
  // For inventory tracking when removing items
  inventoryAction?: 'return_to_inventory' | 'mark_as_damaged';
  damageReason?: string;
}

/**
 * Extended MenuItem type for form handling with file upload
 */
export interface MenuItemFormData extends Omit<MenuItem, 'id'> {
  id?: number | string;
  imageFile?: File | null;
}

/**
 * Parameters for marking an item as damaged
 */
export interface MarkAsDamagedParams {
  quantity: number;
  reason: string;
  order_id?: string | number;  // When marking item as damaged from an order
}

/**
 * Parameters for updating stock quantity
 */
export interface UpdateStockParams {
  stock_quantity: number;
  reason_type: 'restock' | 'adjustment' | 'other' | 'return';
  reason_details?: string;
}
