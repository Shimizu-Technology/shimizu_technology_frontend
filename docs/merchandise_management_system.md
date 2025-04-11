# Merchandise Management System

This document provides a comprehensive overview of the Merchandise Management System in Hafaloha, which allows restaurants to sell branded merchandise alongside their food items.

## Overview

The Merchandise Management System enables restaurants to:

- Organize merchandise into collections and categories
- Manage inventory for merchandise items
- Create variants of merchandise items (e.g., different sizes, colors)
- Track stock levels and receive low stock alerts
- Display merchandise in a dedicated storefront
- Include merchandise in food orders

## Architecture

### Core Components

The merchandise system consists of several interconnected components:

1. **Collections**: Top-level groupings of merchandise (e.g., "Summer Collection", "Holiday Collection")
2. **Categories**: Organizational groupings within collections (e.g., "T-Shirts", "Hats", "Accessories")
3. **Items**: Individual merchandise products with details like name, description, price, and images
4. **Variants**: Specific variations of items (e.g., "Small Blue T-Shirt", "Large Red T-Shirt")
5. **Stock Management**: Inventory tracking for merchandise items and variants

### Database Models

#### Merchandise Collection

```ruby
# app/models/merchandise_collection.rb
class MerchandiseCollection < ApplicationRecord
  apply_default_scope
  belongs_to :restaurant
  has_many :merchandise_items, dependent: :destroy
  
  validates :name, presence: true
  
  scope :active, -> { where(active: true) }
  
  def activate!
    restaurant.update!(current_merchandise_collection_id: id)
  end
  
  def deactivate!
    if restaurant.current_merchandise_collection_id == id
      restaurant.update!(current_merchandise_collection_id: nil)
    end
  end
end
```

#### Merchandise Category

```ruby
# app/models/merchandise_category.rb
class MerchandiseCategory < ApplicationRecord
  apply_default_scope
  belongs_to :restaurant
  has_many :merchandise_items
  
  validates :name, presence: true
  validates :display_order, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  
  default_scope { order(display_order: :asc) }
end
```

#### Merchandise Item

```ruby
# app/models/merchandise_item.rb
class MerchandiseItem < ApplicationRecord
  apply_default_scope
  belongs_to :merchandise_collection
  belongs_to :merchandise_category, optional: true
  has_many :merchandise_variants, dependent: :destroy
  has_many :merchandise_stock_audits, dependent: :destroy
  
  validates :name, presence: true
  validates :description, presence: true
  validates :base_price, numericality: { greater_than_or_equal_to: 0 }
  validates :low_stock_threshold, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  
  attribute :additional_images, :string, array: true, default: []
  
  enum stock_status: {
    in_stock: 'in_stock',
    low_stock: 'low_stock',
    out_of_stock: 'out_of_stock'
  }
  
  before_save :update_stock_status
  
  def update_stock_status
    return unless inventory_tracking_enabled
    
    total_stock = calculate_total_stock
    
    if total_stock <= 0
      self.stock_status = 'out_of_stock'
    elsif low_stock_threshold.present? && total_stock <= low_stock_threshold
      self.stock_status = 'low_stock'
    else
      self.stock_status = 'in_stock'
    end
  end
  
  def calculate_total_stock
    if merchandise_variants.any?
      merchandise_variants.sum(:stock_quantity)
    else
      stock_quantity
    end
  end
  
  def record_stock_change(quantity_change, reason, user_id)
    merchandise_stock_audits.create!(
      quantity_change: quantity_change,
      reason: reason,
      user_id: user_id,
      previous_quantity: stock_quantity,
      new_quantity: stock_quantity + quantity_change
    )
    
    update!(stock_quantity: stock_quantity + quantity_change)
  end
end
```

#### Merchandise Variant

```ruby
# app/models/merchandise_variant.rb
class MerchandiseVariant < ApplicationRecord
  apply_default_scope
  belongs_to :merchandise_item
  
  validates :name, presence: true
  validates :price, numericality: { greater_than_or_equal_to: 0 }
  validates :stock_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  
  after_save :update_parent_stock_status
  
  def update_parent_stock_status
    merchandise_item.update_stock_status
    merchandise_item.save
  end
  
  def record_stock_change(quantity_change, reason, user_id)
    MerchandiseStockAudit.create!(
      merchandise_item: merchandise_item,
      merchandise_variant_id: id,
      quantity_change: quantity_change,
      reason: reason,
      user_id: user_id,
      previous_quantity: stock_quantity,
      new_quantity: stock_quantity + quantity_change
    )
    
    update!(stock_quantity: stock_quantity + quantity_change)
  end
end
```

#### Merchandise Stock Audit

```ruby
# app/models/merchandise_stock_audit.rb
class MerchandiseStockAudit < ApplicationRecord
  apply_default_scope
  belongs_to :merchandise_item
  belongs_to :user
  
  validates :quantity_change, presence: true
  validates :reason, presence: true
  validates :previous_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :new_quantity, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  
  scope :recent, -> { order(created_at: :desc).limit(100) }
end
```

## API Endpoints

### Collections

```
GET /merchandise_collections
```
Returns all merchandise collections for the current restaurant.

```
POST /merchandise_collections
```
Creates a new merchandise collection.

```
GET /merchandise_collections/:id
```
Returns details for a specific merchandise collection.

```
PATCH /merchandise_collections/:id
```
Updates a merchandise collection.

```
DELETE /merchandise_collections/:id
```
Deletes a merchandise collection.

```
PATCH /merchandise_collections/:id/activate
```
Sets a collection as the active one for the restaurant.

### Categories

```
GET /merchandise_categories
```
Returns all merchandise categories for the current restaurant.

```
POST /merchandise_categories
```
Creates a new merchandise category.

```
PATCH /merchandise_categories/:id
```
Updates a merchandise category.

```
DELETE /merchandise_categories/:id
```
Deletes a merchandise category.

### Items

```
GET /merchandise_items
```
Returns merchandise items, optionally filtered by collection_id or category_id.

```
POST /merchandise_items
```
Creates a new merchandise item.

```
GET /merchandise_items/:id
```
Returns details for a specific merchandise item.

```
PATCH /merchandise_items/:id
```
Updates a merchandise item.

```
DELETE /merchandise_items/:id
```
Deletes a merchandise item.

```
POST /merchandise_items/:id/update_stock
```
Updates the stock quantity for a merchandise item.

```
POST /merchandise_items/:id/mark_damaged
```
Records damaged merchandise and reduces stock.

```
GET /merchandise_items/:id/stock_audits
```
Returns stock audit history for a merchandise item.

### Variants

```
GET /merchandise_variants
```
Returns merchandise variants, optionally filtered by item_id.

```
POST /merchandise_variants
```
Creates a new merchandise variant.

```
GET /merchandise_variants/:id
```
Returns details for a specific merchandise variant.

```
PATCH /merchandise_variants/:id
```
Updates a merchandise variant.

```
DELETE /merchandise_variants/:id
```
Deletes a merchandise variant.

```
POST /merchandise_variants/:id/update_stock
```
Updates the stock quantity for a merchandise variant.

## Frontend Components

### MerchandiseManager

The `MerchandiseManager` component is the main admin interface for managing merchandise:

```tsx
// src/ordering/components/admin/MerchandiseManager.tsx
import React, { useState } from 'react';
import { Tabs, Tab } from '../../../shared/components/ui/Tabs';
import CollectionsTab from './merchandise/CollectionsTab';
import CategoriesTab from './merchandise/CategoriesTab';
import ItemsTab from './merchandise/ItemsTab';
import StockManagementTab from './merchandise/StockManagementTab';

const MerchandiseManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('items');
  
  return (
    <div className="merchandise-manager">
      <h1>Merchandise Management</h1>
      
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <Tab id="items" label="Items">
          <ItemsTab />
        </Tab>
        <Tab id="collections" label="Collections">
          <CollectionsTab />
        </Tab>
        <Tab id="categories" label="Categories">
          <CategoriesTab />
        </Tab>
        <Tab id="stock" label="Stock Management">
          <StockManagementTab />
        </Tab>
      </Tabs>
    </div>
  );
};

export default MerchandiseManager;
```

### MerchandisePage

The `MerchandisePage` component displays merchandise to customers:

```tsx
// src/ordering/components/MerchandisePage.tsx
import React, { useState } from 'react';
import { useMerchandiseItems } from '../hooks/useMerchandiseItems';
import { useMerchandiseCategories } from '../hooks/useMerchandiseCategories';
import MerchandiseItem from './merchandise/MerchandiseItem';
import FilterSidebar from './merchandise/FilterSidebar';
import QuickViewModal from './merchandise/QuickViewModal';
import { MerchandiseItemType } from '../types/merchandise';

const MerchandisePage: React.FC = () => {
  const { items, isLoading } = useMerchandiseItems();
  const { categories } = useMerchandiseCategories();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<MerchandiseItemType | null>(null);
  
  const filteredItems = selectedCategory
    ? items.filter(item => item.merchandise_category_id === selectedCategory)
    : items;
  
  if (isLoading) {
    return <div className="loading">Loading merchandise...</div>;
  }
  
  return (
    <div className="merchandise-page">
      <div className="merchandise-header">
        <h1>Shop Our Merchandise</h1>
        <p>Show your support with our branded merchandise</p>
      </div>
      
      <div className="merchandise-content">
        <FilterSidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        
        <div className="merchandise-grid">
          {filteredItems.map(item => (
            <MerchandiseItem
              key={item.id}
              item={item}
              onQuickView={() => setQuickViewItem(item)}
            />
          ))}
          
          {filteredItems.length === 0 && (
            <div className="no-items">
              No merchandise items found in this category.
            </div>
          )}
        </div>
      </div>
      
      {quickViewItem && (
        <QuickViewModal
          item={quickViewItem}
          onClose={() => setQuickViewItem(null)}
        />
      )}
    </div>
  );
};

export default MerchandisePage;
```

### StockManagementDashboard

The `StockManagementDashboard` component provides inventory management tools:

```tsx
// src/ordering/components/admin/StockManagementDashboard.tsx
import React, { useState } from 'react';
import { useMerchandiseItems } from '../../hooks/useMerchandiseItems';
import { formatCurrency } from '../../../shared/utils/formatters';
import BulkInventoryActionDialog from './BulkInventoryActionDialog';
import ItemInventoryModal from './ItemInventoryModal';
import { MerchandiseItemType } from '../../types/merchandise';

const StockManagementDashboard: React.FC = () => {
  const { items, isLoading, refetch } = useMerchandiseItems();
  const [selectedItem, setSelectedItem] = useState<MerchandiseItemType | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  const filteredItems = filterStatus
    ? items.filter(item => item.stock_status === filterStatus)
    : items;
  
  const lowStockItems = items.filter(item => item.stock_status === 'low_stock');
  const outOfStockItems = items.filter(item => item.stock_status === 'out_of_stock');
  
  if (isLoading) {
    return <div className="loading">Loading inventory data...</div>;
  }
  
  return (
    <div className="stock-management-dashboard">
      <div className="dashboard-header">
        <h1>Merchandise Inventory Management</h1>
        
        <div className="inventory-summary">
          <div className="summary-card">
            <h3>Total Items</h3>
            <p>{items.length}</p>
          </div>
          <div className="summary-card warning">
            <h3>Low Stock</h3>
            <p>{lowStockItems.length}</p>
          </div>
          <div className="summary-card danger">
            <h3>Out of Stock</h3>
            <p>{outOfStockItems.length}</p>
          </div>
        </div>
        
        <div className="action-buttons">
          <button 
            className="bulk-action-btn"
            onClick={() => setShowBulkDialog(true)}
          >
            Bulk Inventory Update
          </button>
        </div>
        
        <div className="filter-controls">
          <label>Filter by Status:</label>
          <select 
            value={filterStatus || ''}
            onChange={e => setFilterStatus(e.target.value || null)}
          >
            <option value="">All Items</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>
      
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock Status</th>
            <th>Quantity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map(item => (
            <tr 
              key={item.id}
              className={item.stock_status === 'out_of_stock' ? 'out-of-stock' : 
                         item.stock_status === 'low_stock' ? 'low-stock' : ''}
            >
              <td>{item.name}</td>
              <td>{item.category_name || 'Uncategorized'}</td>
              <td>{formatCurrency(item.base_price)}</td>
              <td>
                <span className={`status-badge ${item.stock_status}`}>
                  {item.stock_status === 'in_stock' ? 'In Stock' :
                   item.stock_status === 'low_stock' ? 'Low Stock' :
                   'Out of Stock'}
                </span>
              </td>
              <td>{item.stock_quantity}</td>
              <td>
                <button 
                  className="manage-btn"
                  onClick={() => setSelectedItem(item)}
                >
                  Manage
                </button>
              </td>
            </tr>
          ))}
          
          {filteredItems.length === 0 && (
            <tr>
              <td colSpan={6} className="no-items">
                No merchandise items found with the selected filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {selectedItem && (
        <ItemInventoryModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={refetch}
        />
      )}
      
      {showBulkDialog && (
        <BulkInventoryActionDialog
          onClose={() => setShowBulkDialog(false)}
          onComplete={refetch}
        />
      )}
    </div>
  );
};

export default StockManagementDashboard;
```

## State Management

The merchandise system uses Zustand for state management:

```tsx
// src/ordering/store/merchandiseStore.ts
import create from 'zustand';
import { 
  fetchMerchandiseCollections,
  fetchMerchandiseCategories,
  fetchMerchandiseItems,
  updateMerchandiseItem,
  updateMerchandiseItemStock
} from '../../shared/api/endpoints/merchandiseItems';
import { MerchandiseItemType, MerchandiseCategoryType, MerchandiseCollectionType } from '../types/merchandise';

interface MerchandiseState {
  collections: MerchandiseCollectionType[];
  categories: MerchandiseCategoryType[];
  items: MerchandiseItemType[];
  activeCollection: MerchandiseCollectionType | null;
  isLoading: boolean;
  error: string | null;
  
  fetchCollections: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchItems: (collectionId?: number, categoryId?: number) => Promise<void>;
  updateItem: (id: number, data: Partial<MerchandiseItemType>) => Promise<void>;
  updateItemStock: (id: number, quantity: number, reason: string) => Promise<void>;
}

export const useMerchandiseStore = create<MerchandiseState>((set, get) => ({
  collections: [],
  categories: [],
  items: [],
  activeCollection: null,
  isLoading: false,
  error: null,
  
  fetchCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const collections = await fetchMerchandiseCollections();
      const activeCollection = collections.find(c => c.is_active) || null;
      set({ collections, activeCollection, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const categories = await fetchMerchandiseCategories();
      set({ categories, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchItems: async (collectionId, categoryId) => {
    set({ isLoading: true, error: null });
    try {
      const items = await fetchMerchandiseItems(collectionId, categoryId);
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await updateMerchandiseItem(id, data);
      
      // Update the item in the local state
      const items = get().items.map(item => 
        item.id === id ? { ...item, ...data } : item
      );
      
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  updateItemStock: async (id, quantity, reason) => {
    set({ isLoading: true, error: null });
    try {
      await updateMerchandiseItemStock(id, quantity, reason);
      
      // Refresh items to get updated stock status
      const items = await fetchMerchandiseItems();
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
```

## Integration with Order System

Merchandise items can be added to food orders:

```tsx
// Example of adding merchandise to an order
const addMerchandiseToOrder = async (orderId, merchandiseItemId, quantity, variantId = null) => {
  try {
    const response = await apiClient.post(`/orders/${orderId}/add_merchandise`, {
      merchandise_item_id: merchandiseItemId,
      quantity,
      merchandise_variant_id: variantId
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to add merchandise to order: ${error.message}`);
  }
};
```

## Image Management

Merchandise items support multiple images, which are stored in AWS S3:

```ruby
# app/controllers/merchandise_items_controller.rb
def update
  @merchandise_item = MerchandiseItem.find(params[:id])
  
  # Handle image uploads
  if params[:image].present?
    s3_uploader = S3Uploader.new
    image_url = s3_uploader.upload(
      params[:image],
      "merchandise/#{@merchandise_item.id}/main-#{SecureRandom.uuid}"
    )
    @merchandise_item.image_url = image_url
  end
  
  # Handle additional images
  if params[:additional_images].present?
    s3_uploader = S3Uploader.new unless defined?(s3_uploader)
    
    additional_images = params[:additional_images].map do |image|
      s3_uploader.upload(
        image,
        "merchandise/#{@merchandise_item.id}/additional-#{SecureRandom.uuid}"
      )
    end
    
    @merchandise_item.additional_images = additional_images
  end
  
  if @merchandise_item.update(merchandise_item_params)
    render json: @merchandise_item
  else
    render json: { errors: @merchandise_item.errors }, status: :unprocessable_entity
  end
end
```

## Frontend Image Upload Component

The `MultiImageUpload` component handles image uploads for merchandise:

```tsx
// src/shared/components/ui/MultiImageUpload.tsx
import React, { useState, useRef } from 'react';
import { FaUpload, FaTrash, FaStar } from 'react-icons/fa';

interface MultiImageUploadProps {
  mainImage?: string;
  additionalImages?: string[];
  onMainImageChange: (file: File) => void;
  onAdditionalImagesChange: (files: File[]) => void;
  onRemoveAdditionalImage: (index: number) => void;
  onSetMainImage: (url: string) => void;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  mainImage,
  additionalImages = [],
  onMainImageChange,
  onAdditionalImagesChange,
  onRemoveAdditionalImage,
  onSetMainImage
}) => {
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const additionalImagesInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const handleMainImageClick = () => {
    mainImageInputRef.current?.click();
  };
  
  const handleAdditionalImagesClick = () => {
    additionalImagesInputRef.current?.click();
  };
  
  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onMainImageChange(e.target.files[0]);
    }
  };
  
  const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      onAdditionalImagesChange(filesArray);
    }
  };
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onAdditionalImagesChange(filesArray);
    }
  };
  
  return (
    <div className="multi-image-upload">
      <div className="main-image-container">
        <h3>Main Image</h3>
        <div 
          className="main-image-upload"
          onClick={handleMainImageClick}
        >
          {mainImage ? (
            <img src={mainImage} alt="Main product" />
          ) : (
            <div className="upload-placeholder">
              <FaUpload />
              <p>Click to upload main image</p>
            </div>
          )}
          <input
            type="file"
            ref={mainImageInputRef}
            onChange={handleMainImageChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      </div>
      
      <div className="additional-images-container">
        <h3>Additional Images</h3>
        <div 
          className={`additional-images-upload ${dragActive ? 'drag-active' : ''}`}
          onClick={handleAdditionalImagesClick}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-placeholder">
            <FaUpload />
            <p>Click or drag to upload additional images</p>
          </div>
          <input
            type="file"
            ref={additionalImagesInputRef}
            onChange={handleAdditionalImagesChange}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
          />
        </div>
        
        {additionalImages.length > 0 && (
          <div className="image-preview-grid">
            {additionalImages.map((url, index) => (
              <div key={index} className="image-preview">
                <img src={url} alt={`Additional ${index + 1}`} />
                <div className="image-actions">
                  <button
                    className="set-main-btn"
                    onClick={() => onSetMainImage(url)}
                    title="Set as main image"
                  >
                    <FaStar />
                  </button>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveAdditionalImage(index)}
                    title="Remove image"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiImageUpload;
```

## Best Practices

When working with the Merchandise Management System, follow these best practices:

1. **Organize by Categories**: Use categories to organize merchandise for better customer navigation
2. **Optimize Images**: Resize and compress images before upload to improve page load times
3. **Set Low Stock Thresholds**: Configure appropriate thresholds to receive timely alerts
4. **Regular Inventory Audits**: Perform regular physical inventory counts and reconcile with system data
5. **Use Variants Appropriately**: Create variants only when necessary (e.g., for different sizes/colors)
6. **Maintain Consistent Pricing**: Ensure pricing is consistent with your brand positioning
7. **Track Inventory Changes**: Always use the stock audit system to track inventory changes

## Troubleshooting

Common issues and their solutions:

1. **Images Not Displaying**: Check S3 bucket permissions and CORS configuration
2. **Stock Status Discrepancies**: Verify that all stock changes are properly recorded through the API
3. **Category Display Issues**: Ensure categories have the correct display_order values
4. **Variant Management**: If variants aren't appearing, check that they're properly associated with the parent item

## Future Enhancements

Planned enhancements for the Merchandise Management System:

1. **Bulk Image Upload**: Support for uploading multiple images at once
2. **Advanced Filtering**: More sophisticated filtering options for customers
3. **Bundle Creation**: Ability to create merchandise bundles with special pricing
4. **Seasonal Collections**: Automated scheduling for seasonal merchandise collections
5. **Inventory Forecasting**: Predictive analytics for inventory management
