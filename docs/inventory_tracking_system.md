# Menu Item Inventory Tracking - Frontend Implementation

This document describes the frontend implementation of the menu item inventory tracking system in the Hafaloha application.

## Overview

The inventory tracking system allows restaurant managers to:

1. Enable/disable inventory tracking for specific menu items
2. Set and monitor stock quantities
3. Record damaged items
4. View stock audit history
5. Manage low stock thresholds
6. See automatic stock status updates

## Components

### ItemInventoryModal

**Location**: `src/ordering/components/admin/ItemInventoryModal.tsx`

The main component for managing inventory for a menu item. It provides:

- Toggle for enabling/disabling inventory tracking
- Fields for setting stock quantities and low stock threshold
- Interface for marking items as damaged
- Interface for updating stock quantities
- Display of available inventory (stock minus damaged)
- Audit history table showing all inventory changes

The component makes real-time API calls to update inventory settings, ensuring that the UI state always matches the database state. When the inventory tracking toggle is switched, it immediately saves the change to prevent UI/database inconsistencies.

### MenuManager Integration

**Location**: `src/ordering/components/admin/MenuManager.tsx`

The MenuManager component integrates with the inventory system by:

1. Displaying an "Inventory Tracked" badge on items with tracking enabled
2. Providing a button to open the ItemInventoryModal
3. Automatically refreshing data after inventory changes
4. Showing status indicators (In Stock, Low Stock, Out of Stock)
5. Maintaining UI consistency between the edit form and inventory modal

When inventory tracking is toggled in the modal, the edit form is immediately updated to reflect this change.

## State Management

### Menu Item Types

**Location**: `src/ordering/types/menu.ts`

Type definitions for inventory-related fields:

```typescript
interface MenuItem {
  // Existing fields...
  
  // Inventory fields
  enable_stock_tracking?: boolean;
  stock_quantity?: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  
  // The stock status is automatically determined when tracking is enabled
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
}

interface MenuItemStockAudit {
  id: number;
  menu_item_id: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  reason_type?: string;
  created_at: string;
  updated_at: string;
}
```

### API Integration

**Location**: `src/shared/api/endpoints/menuItems.ts`

The API client provides methods for inventory operations:

```typescript
// Update menu item (including inventory settings)
const update = (id: string, data: Partial<MenuItem>): Promise<MenuItem> => {
  return api.patch(`/menu_items/${id}`, data);
};

// Mark items as damaged
const markAsDamaged = (id: string, data: { quantity: number, reason: string }): Promise<void> => {
  return api.post(`/menu_items/${id}/mark_damaged`, data);
};

// Update stock quantity
const updateStock = (id: string, data: {
  stock_quantity: number,
  reason_type: string,
  reason_details?: string
}): Promise<void> => {
  return api.post(`/menu_items/${id}/update_stock`, data);
};

// Get stock audit history
const getStockAudits = (id: string): Promise<MenuItemStockAudit[]> => {
  return api.get(`/menu_items/${id}/stock_audits`);
};
```

## Workflow

### Enabling Inventory Tracking

1. User clicks the "Manage Inventory" button for a menu item
2. ItemInventoryModal opens, displaying current inventory state
3. User toggles "Enable Inventory Tracking"
4. The change is immediately saved to the database
5. UI updates to show inventory fields
6. MenuManager item display updates with an "Inventory Tracked" badge

### Managing Stock

1. With tracking enabled, user can:
   - Set initial stock quantity
   - Update the low stock threshold
   - Record damaged items
   - Update stock quantities with reason
2. Each action creates an entry in the audit history
3. Available quantity is calculated (stock - damaged)
4. Stock status is automatically determined based on available quantity and threshold

### Stock Status Integration

When inventory tracking is enabled, the stock status field is automatically determined:

- Available = 0: "Out of Stock"
- Available ≤ Threshold: "Low Stock"
- Available > Threshold: "In Stock"

The MenuManager displays appropriate status indicators and badges based on this status.

### Order Processing Integration

The inventory tracking system is fully integrated with the ordering process:

1. When a customer places an order for items with inventory tracking enabled:
   - The backend automatically deducts the ordered quantity from the stock
   - The system creates stock audit records with the order reference
   - The stock status is updated in real-time based on available inventory

2. Administrators can view:
   - Current inventory levels in the inventory management modal
   - Full audit history showing which orders consumed inventory
   - Automatic status changes as items go from "In Stock" to "Low Stock" or "Out of Stock"

This integration ensures inventory levels are always accurate and reflect real-time usage as orders are placed.

## UX Considerations

- The inventory toggle has immediate effect, reducing user confusion
- Error handling includes UI state reversion if API calls fail
- Success messages confirm actions
- The UI clearly indicates when inventory tracking is controlling item availability
- Audit history provides accountability and tracking of all changes

## Performance Considerations

- Audit history is loaded only when needed
- API calls are batched where possible
- UI elements are conditionally rendered based on tracking state

## Testing

The implementation includes comprehensive tests:

- Component tests for ItemInventoryModal
- Integration tests for MenuManager with inventory features
- Edge case handling (e.g., network failures, validation errors)
