// src/ordering/types/merchandise.ts

/**
 * Represents a merchandise variant (e.g., specific size/color combination)
 */
export interface MerchandiseVariant {
  id: number;
  merchandise_item_id: number;
  name?: string;
  size?: string;
  color?: string;
  price_adjustment: number;
  stock_quantity: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  stock_status?: 'in_stock' | 'out_of_stock' | 'low_stock';
  in_stock?: boolean;
  final_price?: number; // Computed: base_price + price_adjustment
}

/**
 * Represents a merchandise item
 */
export interface MerchandiseItem {
  id: number;
  name: string;
  description?: string;
  base_price: number;
  
  // Collection and category
  merchandise_collection_id: number;
  category_id?: number;
  category_name?: string;
  
  // Images
  image_url: string;
  second_image_url?: string;
  additional_images?: string[];
  
  // Inventory
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
  status_note?: string;
  low_stock_threshold?: number;
  enable_stock_tracking?: boolean; // Deprecated: Use enable_inventory_tracking instead
  enable_inventory_tracking?: boolean; // Whether to track inventory for this item
  stock_quantity?: number;
  damaged_quantity?: number;
  
  // Variants
  variants: MerchandiseVariant[];
  
  // Visibility
  hidden?: boolean;
  
  // Computed properties
  in_stock?: boolean;
}

/**
 * Parameters for updating merchandise stock quantity
 */
export interface UpdateMerchandiseStockParams {
  stock_quantity: number;
  reason_type: 'restock' | 'adjustment' | 'other' | 'return';
  reason_details?: string;
}

/**
 * Parameters for marking merchandise as damaged
 */
export interface MarkMerchandiseAsDamagedParams {
  quantity: number;
  reason: string;
  order_id?: string | number;
}

/**
 * Merchandise item with selected variant for cart
 */
export interface MerchandiseCartItem {
  id: number;
  type: 'merchandise';
  name: string;
  price: number;
  image: string;
  quantity: number;
  variant_id?: number;
  size?: string;
  color?: string;
  notes?: string;
}
