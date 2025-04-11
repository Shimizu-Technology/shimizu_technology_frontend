export interface InventoryStatus {
  itemId: string;
  inStock: boolean;
  lowStock: boolean;
  quantity?: number;
}

export interface InventoryUpdate {
  itemId: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  quantity?: number;
}
