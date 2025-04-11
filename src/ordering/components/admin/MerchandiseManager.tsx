// src/ordering/components/merchandise/MerchandiseManager.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { useMerchandiseStore } from '../../store/merchandiseStore';
import { useAuthStore } from '../../store/authStore';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { LoadingSpinner, Tooltip } from '../../../shared/components/ui';
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Image,
  Save,
  MinusCircle,
  ArrowUp,
  ArrowDown,
  Package
} from 'lucide-react';
import MerchandiseInventoryModal from './MerchandiseInventoryModal';
import toastUtils from '../../../shared/utils/toastUtils';
import { useLoadingOverlay } from '../../../shared/components/ui/LoadingOverlay';
import { api } from '../../../shared/api/apiClient';
import OptimizedImage from '../../../shared/components/ui/OptimizedImage';

interface MerchandiseManagerProps {
  restaurantId?: string;
}

// Types for collection form
interface CollectionFormData {
  id?: number;
  name: string;
  description: string;
  active: boolean;
  image_url?: string;
  imageFile?: File | null;
}

// Types for item form
interface VariantFormData {
  id?: number;
  size: string;
  color: string;
  price_adjustment: number;
}

interface ItemFormData {
  id?: number;
  name: string;
  description: string;
  base_price: number;
  image_url?: string;
  imageFile?: File | null;
  second_image_url?: string;
  secondImageFile?: File | null;
  merchandise_collection_id: number;
  variants: VariantFormData[];
  is_one_size: boolean;
  color: string;
  
  // Inventory fields
  enable_stock_tracking?: boolean;
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
  status_note?: string | null;
  stock_quantity?: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  available_quantity?: number; // Computed: stock_quantity - damaged_quantity
}

const MerchandiseManager: React.FC<MerchandiseManagerProps> = ({ restaurantId }) => {
  const { user } = useAuthStore();
  const { restaurant } = useRestaurantStore();

  // ----- Pull store actions and data -----
  const {
    // Collections & items
    collections,
    merchandiseItems,
    loading,
    error,
    // Store actions
    fetchCollections,
    fetchMerchandiseItems,
    addMerchandiseItem,
    updateMerchandiseItem,
    deleteMerchandiseItem
  } = useMerchandiseStore();
  
  // API functions for collection management
  const createCollection = async (
    name: string, 
    description: string, 
    restId: number, 
    active: boolean
  ) => {
    try {
      const response = await api.post('/merchandise_collections', {
        merchandise_collection: {
          name,
          description,
          restaurant_id: restId,
          active
        }
      });
      return response;
    } catch (error) {
      console.error('Failed to create collection:', error);
      throw error;
    }
  };
  
  const updateCollection = async (id: number, data: any) => {
    try {
      // If you are uploading images, adapt to `api.upload(...)`
      const response = await api.patch(`/merchandise_collections/${id}`, {
        merchandise_collection: data
      });
      return response;
    } catch (error) {
      console.error('Failed to update collection:', error);
      throw error;
    }
  };
  
  const deleteCollection = async (id: number) => {
    try {
      await api.delete(`/merchandise_collections/${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete collection:', error);
      throw error;
    }
  };
  
  const setActiveCollection = async (id: number) => {
    try {
      const response = await api.patch(`/merchandise_collections/${id}/set_active`);
      return response;
    } catch (error) {
      console.error('Failed to set active collection:', error);
      throw error;
    }
  };

  // ---------- State for which collection is selected ----------
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  // ---------- Modals & toggles ----------
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [showCollectionSettings, setShowCollectionSettings] = useState(false);

  // ---------- Inventory modal ----------
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedItemForInventory, setSelectedItemForInventory] = useState<any>(null);

  // ---------- Collection form state ----------
  const [collectionFormData, setCollectionFormData] = useState<CollectionFormData>({
    name: '',
    description: '',
    active: false,
    image_url: '',
    imageFile: null
  });

  // ---------- Item form state ----------
  const [itemFormData, setItemFormData] = useState<ItemFormData>({
    name: '',
    description: '',
    base_price: 0,
    image_url: '',
    imageFile: null,
    second_image_url: '',
    secondImageFile: null,
    merchandise_collection_id: 0,
    variants: [],
    is_one_size: false,
    color: 'Black',
    stock_status: 'in_stock',
    status_note: '',
    enable_stock_tracking: false
  });

  // ----- Available sizes for merchandise (customize as needed) -----
  const availableSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'];

  // ----- Common colors for merchandise (customize as needed) -----
  const commonColors = [
    'Black',
    'White',
    'Red',
    'Blue',
    'Green',
    'Yellow',
    'Purple',
    'Orange',
    'Pink',
    'Gray',
    'Brown',
    'Navy'
  ];

  // ----- Loading overlay hook -----
  const { withLoading, LoadingOverlayComponent } = useLoadingOverlay();

  // ================================
  //         FETCH COLLECTIONS
  // ================================
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // ================================
  // AUTO-SELECT ACTIVE COLLECTION
  // ================================
  useEffect(() => {
    if (collections.length > 0) {
      const activeCol = collections.find((c) => c.active) || collections[0];
      setSelectedCollectionId(activeCol.id);
      // Retrieve all items, or optionally filter by that collection
      fetchMerchandiseItems();
    }
  }, [collections, fetchMerchandiseItems]);

  // ================================
  //   HANDLE UPDATE COLLECTION
  // ================================
  const handleUpdateCollection = async (collectionId: number, data: FormData) => {
    // If your API supports uploading images, adapt accordingly
    try {
      const updated = await api.patch(`/merchandise_collections/${collectionId}`, data);
      if (updated) {
        toastUtils.success('Collection updated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update collection:', error);
      toastUtils.error('Failed to update collection');
      throw error;
    }
  };

  // ================================
  //   SUBMIT (CREATE/UPDATE) COLLECTION
  // ================================
  const handleCollectionSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!collectionFormData.name.trim()) {
      toastUtils.error('Collection name is required.');
      return;
    }

    try {
      await withLoading(async () => {
        // If the user hasn't selected or created a restaurant, default to 1
        const restId = restaurant?.id || 1;

        // Create FormData for image upload
        const formData = new FormData();
        formData.append('merchandise_collection[name]', collectionFormData.name);
        formData.append('merchandise_collection[description]', collectionFormData.description);
        formData.append(
          'merchandise_collection[active]',
          String(collectionFormData.active)
        );
        formData.append('merchandise_collection[restaurant_id]', String(restId));

        if (collectionFormData.imageFile) {
          formData.append('merchandise_collection[image]', collectionFormData.imageFile);
        }

        if (collectionFormData.id) {
          // -- Update existing collection --
          await handleUpdateCollection(collectionFormData.id, formData);
        } else {
          // -- Create new collection --
          const newCollection = await createCollection(
            collectionFormData.name,
            collectionFormData.description,
            restId,
            collectionFormData.active
          );
          if (newCollection) {
            toastUtils.success('Collection created successfully');
          }
        }

        setIsAddingCollection(false);
        await fetchCollections();
      });
    } catch (error) {
      console.error('Failed to create/update collection:', error);
      toastUtils.error('Failed to save collection.');
    }
  };

  // ================================
  //     EDIT EXISTING ITEM
  // ================================
  const handleEditItem = (item: any) => {
    // Check if it's truly one-size
    const isOneSize =
      item.variants?.length === 1 && item.variants[0].size === 'One Size';

    // Pick a default color from existing variants
    let defaultColor = 'Black';
    if (item.variants && item.variants.length > 0) {
      const colorCounts: Record<string, number> = {};
      item.variants.forEach((v: any) => {
        const c = v.color || 'Black';
        colorCounts[c] = (colorCounts[c] || 0) + 1;
      });
      let maxCount = 0;
      for (const [c, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count;
          defaultColor = c;
        }
      }
    }

    // Build out the variant form data
    const buildVariantForm = (v: any): VariantFormData => ({
      id: v.id,
      size: v.size,
      color: v.color || defaultColor,
      price_adjustment: v.price_adjustment || 0
    });

    setItemFormData({
      id: item.id,
      name: item.name,
      description: item.description || '',
      base_price: item.base_price,
      image_url: item.image_url || '',
      imageFile: null,
      second_image_url: item.second_image_url || '',
      secondImageFile: null,
      merchandise_collection_id: item.merchandise_collection_id,
      variants:
        item.variants && item.variants.length > 0
          ? item.variants.map((v: any) => buildVariantForm(v))
          : [
              {
                size: 'M',
                color: defaultColor,
                price_adjustment: 0
              }
            ],
      is_one_size: isOneSize,
      color: defaultColor,
      stock_status: item.stock_status || 'in_stock',
      status_note: item.status_note || '',
      enable_stock_tracking: !!item.enable_stock_tracking,
      stock_quantity: item.stock_quantity || 0,
      damaged_quantity: item.damaged_quantity || 0,
      low_stock_threshold: item.low_stock_threshold || 5,
      available_quantity: Math.max(0, (item.stock_quantity || 0) - (item.damaged_quantity || 0))
    });

    setIsAddingItem(true);
    setIsEditingItem(true);
  };

  // ================================
  //     DELETE ITEM
  // ================================
  const handleDeleteItem = async (itemId: number) => {
    if (
      window.confirm(
        'Are you sure you want to delete this item? This action cannot be undone.'
      )
    ) {
      try {
        await withLoading(async () => {
          await deleteMerchandiseItem(itemId);
          toastUtils.success('Item deleted successfully');
          await fetchMerchandiseItems();
        });
      } catch (error) {
        console.error('Failed to delete item:', error);
        toastUtils.error('Failed to delete item');
      }
    }
  };

  // =================================
  //  MOVE VARIANTS UP/DOWN
  // =================================
  const handleMoveVariantUp = (index: number) => {
    if (index === 0) return;
    const newVariants = [...itemFormData.variants];
    [newVariants[index - 1], newVariants[index]] = [
      newVariants[index],
      newVariants[index - 1]
    ];
    setItemFormData({ ...itemFormData, variants: newVariants });
  };

  const handleMoveVariantDown = (index: number) => {
    if (index === itemFormData.variants.length - 1) return;
    const newVariants = [...itemFormData.variants];
    [newVariants[index], newVariants[index + 1]] = [
      newVariants[index + 1],
      newVariants[index]
    ];
    setItemFormData({ ...itemFormData, variants: newVariants });
  };

  // =================================
  //       ADD/REMOVE VARIANT
  // =================================
  const handleAddSize = () => {
    const newVariants = [...itemFormData.variants];
    // Find a size not in use
    const usedSizes = new Set(newVariants.map((v) => v.size));
    const freeSize = availableSizes.find((s) => !usedSizes.has(s)) || 'M';

    newVariants.push({
      size: freeSize,
      color: itemFormData.color,
      price_adjustment: 0
    });
    setItemFormData({ ...itemFormData, variants: newVariants });
  };

  const handleRemoveSize = (index: number) => {
    if (itemFormData.variants.length <= 1) {
      toastUtils.error('Item must have at least one size.');
      return;
    }
    const newVariants = [...itemFormData.variants];
    newVariants.splice(index, 1);
    setItemFormData({ ...itemFormData, variants: newVariants });
  };

  // =================================
  //   ONE-SIZE TOGGLE
  // =================================
  const handleOneSizeToggle = (checked: boolean) => {
    if (checked) {
      // Switch all variants to one single variant
      setItemFormData({
        ...itemFormData,
        is_one_size: true,
        variants: [
          {
            size: 'One Size',
            color: itemFormData.color,
            price_adjustment: 0
          }
        ]
      });
    } else {
      // Revert to multiple sizes
      setItemFormData({
        ...itemFormData,
        is_one_size: false,
        variants: ['S', 'M', 'L', 'XL'].map((size) => ({
          size,
          color: itemFormData.color,
          price_adjustment: 0
        }))
      });
    }
  };

  // =================================
  //     CHANGE COLOR ACROSS VARIANTS
  // =================================
  const handleColorChange = (color: string) => {
    const newVariants = itemFormData.variants.map((v) => ({ ...v, color }));
    setItemFormData({ ...itemFormData, color, variants: newVariants });
  };

  // =================================
  //   HANDLE VARIANT FIELD CHANGES
  // =================================
  const handleVariantChange = (index: number, field: string, value: any) => {
    const newVariants = [...itemFormData.variants];
    const variant = { ...newVariants[index] };

    switch (field) {
      case 'price_adjustment': {
        variant.price_adjustment = parseFloat(value) || 0;
        break;
      }
      case 'size': {
        variant.size = value;
        break;
      }
      case 'color': {
        variant.color = value;
        break;
      }
      default:
        break;
    }

    newVariants[index] = variant;
    setItemFormData({ ...itemFormData, variants: newVariants });
  };

  // =================================
  //   SUBMIT (CREATE/UPDATE) ITEM
  // =================================
  const handleItemSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!itemFormData.name.trim()) {
      toastUtils.error('Item name is required.');
      return;
    }
    if (itemFormData.base_price <= 0) {
      toastUtils.error('Price must be greater than 0.');
      return;
    }
    if (itemFormData.variants.length === 0) {
      toastUtils.error('At least one size variant is required.');
      return;
    }

    try {
      await withLoading(async () => {
        // Prepare the form data for the main item
        const formData = new FormData();
        formData.append('merchandise_item[name]', itemFormData.name);
        formData.append('merchandise_item[description]', itemFormData.description);
        formData.append(
          'merchandise_item[base_price]',
          itemFormData.base_price.toString()
        );
        formData.append(
          'merchandise_item[merchandise_collection_id]',
          itemFormData.merchandise_collection_id.toString()
        );
        
        // Add inventory fields
        formData.append(
          'merchandise_item[stock_status]',
          itemFormData.stock_status
        );
        formData.append(
          'merchandise_item[enable_stock_tracking]',
          String(!!itemFormData.enable_stock_tracking)
        );
        
        if (itemFormData.status_note !== undefined) {
          formData.append('merchandise_item[status_note]', itemFormData.status_note || '');
        }
        
        if (itemFormData.low_stock_threshold !== undefined) {
          formData.append(
            'merchandise_item[low_stock_threshold]',
            String(itemFormData.low_stock_threshold)
          );
        }

        if (itemFormData.imageFile) {
          formData.append('merchandise_item[image]', itemFormData.imageFile);
        }
        if (itemFormData.secondImageFile) {
          formData.append(
            'merchandise_item[second_image]',
            itemFormData.secondImageFile
          );
        }

        let savedItem: any = null;

        // ---------- UPDATE ----------
        if (isEditingItem && itemFormData.id) {
          savedItem = await api.upload(
            `/merchandise_items/${itemFormData.id}`,
            formData,
            'PATCH'
          );
          if (savedItem) {
            // Identify variants still in the form
            const existingVariantIds = new Set(
              itemFormData.variants.filter((v) => v.id).map((v) => v.id)
            );

            // Fetch all current variants from DB
            const currentVariants = await api.get(
              `/merchandise_variants?merchandise_item_id=${itemFormData.id}`
            );
            if (Array.isArray(currentVariants)) {
              // Delete any that no longer exist in itemFormData
              const variantsToDelete = currentVariants.filter(
                (v: any) => v.id && !existingVariantIds.has(v.id)
              );
              for (const variant of variantsToDelete) {
                if (variant && typeof variant.id === 'number') {
                  await api.delete(`/merchandise_variants/${variant.id}`);
                }
              }
            }
            // Update or create each variant
            for (const v of itemFormData.variants) {
              if (v.id) {
                await api.patch(`/merchandise_variants/${v.id}`, {
                  merchandise_variant: {
                    size: v.size,
                    color: v.color,
                    price_adjustment: v.price_adjustment
                  }
                });
              } else {
                // Create new variant
                await api.post('/merchandise_variants', {
                  merchandise_variant: {
                    merchandise_item_id: itemFormData.id,
                    size: v.size,
                    color: v.color,
                    price_adjustment: v.price_adjustment
                  }
                });
              }
            }

            toastUtils.success('Item updated successfully');
          }
        } else {
          // ---------- CREATE ----------
          savedItem = await api.upload('/merchandise_items', formData);
          if (savedItem && typeof savedItem.id === 'number') {
            // Create all variants
            for (const v of itemFormData.variants) {
              await api.post('/merchandise_variants', {
                merchandise_variant: {
                  merchandise_item_id: savedItem.id,
                  size: v.size,
                  color: v.color,
                  price_adjustment: v.price_adjustment
                }
              });
            }
            toastUtils.success('Item created successfully');
          }
        }

        setIsAddingItem(false);
        setIsEditingItem(false);

        // Refresh item list
        await fetchMerchandiseItems();
      });
    } catch (error) {
      console.error('Failed to save item:', error);
      toastUtils.error('Failed to save item.');
    }
  };

  // ======================================
  //        RENDER LOADING/ERROR
  // ======================================
  if (loading && collections.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        An error occurred: {error}
      </div>
    );
  }

  // ======================================
  //              RENDER
  // ======================================
  return (
    <div className="p-4">
      {LoadingOverlayComponent /* Global Loading Overlay */ }

      {/* Page Header & "Add Collection" Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Merchandise Manager</h2>
          <p className="text-gray-600 text-sm">
            Manage merchandise collections, items, colors, and sizes.
          </p>
        </div>
        <button
          onClick={() => {
            setCollectionFormData({
              name: '',
              description: '',
              active: false,
              image_url: '',
              imageFile: null
            });
            setIsAddingCollection(true);
          }}
          className="bg-[#c1902f] text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Collection
        </button>
      </div>

      {/* Collection Tabs */}
      {collections.length > 0 ? (
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px space-x-8 overflow-x-auto">
              {/* "All Items" pseudo-tab */}
              <button
                onClick={() => {
                  setSelectedCollectionId(null);
                  fetchMerchandiseItems();
                }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  selectedCollectionId === null
                    ? 'border-[#c1902f] text-[#c1902f]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Items
              </button>

              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => {
                    setSelectedCollectionId(collection.id);
                    fetchMerchandiseItems();
                  }}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    selectedCollectionId === collection.id
                      ? 'border-[#c1902f] text-[#c1902f]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {collection.name}
                  {collection.active && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-lg mb-8">
          <p className="text-gray-500">
            No collections available. Create a collection to get started.
          </p>
        </div>
      )}

      {/* Add/Edit Collection Modal */}
      {isAddingCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6 animate-slideUp">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {collectionFormData.id ? 'Edit Collection' : 'Add New Collection'}
              </h3>
              <button
                onClick={() => setIsAddingCollection(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCollectionSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Collection Name <span className="text-red-500">*</span>
                  </label>
                  <Tooltip
                    content="The name of the merchandise collection (e.g. 'Summer Collection', 'T-Shirts')"
                    position="top"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
                <input
                  type="text"
                  value={collectionFormData.name}
                  onChange={(e) =>
                    setCollectionFormData({ ...collectionFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-md"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Tooltip
                    content="A brief description of the collection"
                    position="top"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
                <textarea
                  value={collectionFormData.description}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      description: e.target.value
                    })
                  }
                  className="w-full px-4 py-2 border rounded-md"
                  rows={3}
                />
              </div>

              {/* Active */}
              <div>
                <div className="flex items-center">
                  <label className="inline-flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={collectionFormData.active}
                      onChange={(e) =>
                        setCollectionFormData({
                          ...collectionFormData,
                          active: e.target.checked
                        })
                      }
                    />
                    <span>Set as active collection?</span>
                  </label>
                  <Tooltip
                    content="If checked, this collection will be the default one shown to customers"
                    position="top"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
              </div>

              {/* (Optional) Collection Image logic here if your API supports it */}
              {/* ... */}

              {/* Submit */}
              <div className="flex justify-end space-x-2 pt-6">
                <button
                  type="button"
                  onClick={() => setIsAddingCollection(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
                >
                  <Save className="h-5 w-5 mr-2" />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slideUp">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {isEditingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => setIsAddingItem(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleItemSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                  {/* Item Name */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <Tooltip
                        content="The name of the merchandise item"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <input
                      type="text"
                      value={itemFormData.name}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, name: e.target.value })
                      }
                      className="w-full px-4 py-2 border rounded-md"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <Tooltip
                        content="A brief description of the item"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <textarea
                      value={itemFormData.description}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, description: e.target.value })
                      }
                      className="w-full px-4 py-2 border rounded-md"
                      rows={3}
                    />
                  </div>

                  {/* Base Price */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Base Price <span className="text-red-500">*</span>
                      </label>
                      <Tooltip
                        content="The base price of the item in dollars"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemFormData.base_price}
                        onChange={(e) =>
                          setItemFormData({
                            ...itemFormData,
                            base_price: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-full pl-8 px-4 py-2 border rounded-md"
                        required
                      />
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Color
                      </label>
                      <Tooltip
                        content="The color of this item (applies to all sizes)"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <select
                      value={itemFormData.color}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-full px-4 py-2 border rounded-md"
                    >
                      {commonColors.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* One Size Toggle */}
                  <div>
                    <div className="flex items-center">
                      <label className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={itemFormData.is_one_size}
                          onChange={(e) => handleOneSizeToggle(e.target.checked)}
                          className="rounded"
                        />
                        <span>This is a one-size item (hat, accessory, etc.)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                  {/* Main Image */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Main Image
                      </label>
                      <Tooltip
                        content="Upload the primary image for this item"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <div className="mt-1 flex items-center">
                      {itemFormData.imageFile ? (
                        <div className="relative w-24 h-24 rounded-md overflow-hidden bg-gray-100 mr-4">
                          <OptimizedImage
                            src={URL.createObjectURL(itemFormData.imageFile)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            width="96"
                            height="96"
                            context="menuItem"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemFormData({ ...itemFormData, imageFile: null })
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : itemFormData.image_url ? (
                        <div className="relative w-24 h-24 rounded-md overflow-hidden bg-gray-100 mr-4">
                          <OptimizedImage
                            src={itemFormData.image_url}
                            alt="Current"
                            className="w-full h-full object-cover"
                            width="96"
                            height="96"
                            context="menuItem"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemFormData({ ...itemFormData, image_url: '' })
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center mr-4">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                        {itemFormData.imageFile || itemFormData.image_url
                          ? 'Change Image'
                          : 'Upload Image'}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setItemFormData({
                                ...itemFormData,
                                imageFile: file,
                                image_url: ''
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Secondary Image */}
                  <div>
                    <div className="flex items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Secondary Image
                      </label>
                      <Tooltip
                        content="Optionally upload a second/alternate image (e.g. back of shirt)"
                        position="top"
                        icon
                        iconClassName="ml-1 h-4 w-4"
                      />
                    </div>
                    <div className="mt-1 flex items-center">
                      {itemFormData.secondImageFile ? (
                        <div className="relative w-24 h-24 rounded-md overflow-hidden bg-gray-100 mr-4">
                          <OptimizedImage
                            src={URL.createObjectURL(itemFormData.secondImageFile)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            width="96"
                            height="96"
                            context="menuItem"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemFormData({ ...itemFormData, secondImageFile: null })
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : itemFormData.second_image_url ? (
                        <div className="relative w-24 h-24 rounded-md overflow-hidden bg-gray-100 mr-4">
                          <OptimizedImage
                            src={itemFormData.second_image_url}
                            alt="Current"
                            className="w-full h-full object-cover"
                            width="96"
                            height="96"
                            context="menuItem"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemFormData({ ...itemFormData, second_image_url: '' })
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center mr-4">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
                        {itemFormData.secondImageFile || itemFormData.second_image_url
                          ? 'Change Image'
                          : 'Upload Image'}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setItemFormData({
                                ...itemFormData,
                                secondImageFile: file,
                                second_image_url: ''
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory Status */}
              <div className="mt-4">
                <div className="flex items-center mb-2 border-b pb-2">
                  <h4 className="text-md font-semibold">
                    Inventory Status
                  </h4>
                  <Tooltip
                    content="Manage the current availability of this item based on your inventory."
                    position="right"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  {itemFormData.enable_stock_tracking ? (
                    // Inventory tracking is enabled - show auto status
                    <>
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Inventory-Controlled Status
                          </label>
                          <Tooltip
                            content="This status is automatically determined by available inventory."
                            position="top"
                            icon
                            iconClassName="ml-1 h-4 w-4"
                          />
                        </div>
                        <div className="py-2 px-3 border rounded-md bg-gray-50">
                          {(() => {
                            const availableQty = itemFormData.available_quantity || 0;
                            const threshold = itemFormData.low_stock_threshold || 5;
                            const status = itemFormData.stock_status;

                            let statusLabel = 'In Stock';
                            let statusColor = 'bg-green-500';

                            if (status === 'out_of_stock') {
                              statusLabel = 'Out of Stock';
                              statusColor = 'bg-red-500';
                            } else if (status === 'low_stock') {
                              statusLabel = 'Low Stock';
                              statusColor = 'bg-yellow-500';
                            }

                            return (
                              <>
                                <div className="flex items-center">
                                  <div
                                    className={`h-3 w-3 rounded-full mr-2 ${statusColor}`}
                                  />
                                  <span className="font-medium">{statusLabel}</span>
                                </div>
                                <div className="text-sm text-gray-600 mt-2">
                                  <div>Available: {availableQty} items</div>
                                  <div>Low Stock Threshold: {threshold} items</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Status is determined by inventory levels.
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            if (itemFormData.id) {
                              setSelectedItemForInventory({
                                ...itemFormData,
                                id: itemFormData.id.toString(),
                              });
                              setShowInventoryModal(true);
                            }
                          }}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center"
                          disabled={!itemFormData.id}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Manage Inventory
                        </button>
                      </div>
                      {/* Status Note */}
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Status Note (Optional)
                          </label>
                          <Tooltip
                            content="Add a note explaining the current status, e.g. supplier delay."
                            position="top"
                            icon
                            iconClassName="ml-1 h-4 w-4"
                          />
                        </div>
                        <textarea
                          value={itemFormData.status_note ?? ''}
                          onChange={(e) =>
                            setItemFormData({ ...itemFormData, status_note: e.target.value })
                          }
                          className="w-full px-4 py-2 border rounded-md"
                          rows={2}
                          placeholder="e.g. 'Using a temporary material due to delay.'"
                        />
                      </div>
                    </>
                  ) : (
                    // Manual status selection
                    <>
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Inventory Status
                          </label>
                          <Tooltip
                            content="Set the current availability if not tracking inventory."
                            position="top"
                            icon
                            iconClassName="ml-1 h-4 w-4"
                          />
                        </div>
                        <select
                          value={itemFormData.stock_status ?? 'in_stock'}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              stock_status: e.target.value as
                                | 'in_stock'
                                | 'out_of_stock'
                                | 'low_stock',
                            })
                          }
                          className="w-full px-4 py-2 border rounded-md"
                        >
                          <option value="in_stock">In Stock</option>
                          <option value="out_of_stock">Out of Stock</option>
                          <option value="low_stock">Low Stock</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          "Low Stock" shows a warning but still allows ordering.
                          "Out of Stock" fully disables ordering.
                        </p>

                        <button
                          type="button"
                          onClick={() => {
                            if (itemFormData.id) {
                              setSelectedItemForInventory({
                                ...itemFormData,
                                id: itemFormData.id.toString(),
                              });
                              setShowInventoryModal(true);
                            }
                          }}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center"
                          disabled={!itemFormData.id}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Enable Inventory Tracking
                        </button>
                      </div>

                      {/* Status Note */}
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Status Note (Optional)
                          </label>
                          <Tooltip
                            content="Add a note explaining the current status, e.g. supplier delay."
                            position="top"
                            icon
                            iconClassName="ml-1 h-4 w-4"
                          />
                        </div>
                        <textarea
                          value={itemFormData.status_note ?? ''}
                          onChange={(e) =>
                            setItemFormData({ ...itemFormData, status_note: e.target.value })
                          }
                          className="w-full px-4 py-2 border rounded-md"
                          rows={2}
                          placeholder="e.g. 'Using a temporary material due to delay.'"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Variants Section */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Sizes</h4>
                {!itemFormData.is_one_size && (
                  <button
                    type="button"
                    onClick={handleAddSize}
                    className="mb-3 inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Size
                  </button>
                )}

                <div className="space-y-3">
                  {itemFormData.variants.map((variant, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-md items-center"
                    >
                      {/* Size */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Size</label>
                        {itemFormData.is_one_size ? (
                          <input
                            type="text"
                            disabled
                            value="One Size"
                            className="w-full px-2 py-1 border rounded-md bg-gray-100"
                          />
                        ) : (
                          <select
                            value={variant.size}
                            onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                            className="w-full px-2 py-1 border rounded-md"
                          >
                            {availableSizes.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Price Adjustment */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Price Adjustment
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-500">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full pl-6 py-1 border rounded-md"
                            value={variant.price_adjustment}
                            onChange={(e) =>
                              handleVariantChange(index, 'price_adjustment', e.target.value)
                            }
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-center space-x-2">
                        {!itemFormData.is_one_size && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMoveVariantUp(index)}
                              disabled={index === 0}
                              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm flex items-center disabled:opacity-50"
                              title="Move Up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveVariantDown(index)}
                              disabled={index === itemFormData.variants.length - 1}
                              className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm flex items-center disabled:opacity-50"
                              title="Move Down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSize(index)}
                              className="px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm flex items-center"
                              title="Remove Size"
                            >
                              <MinusCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end space-x-2 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setIsEditingItem(false);
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {isEditingItem ? 'Save Changes' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items & Collection Settings */}
      {selectedCollectionId !== undefined && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {selectedCollectionId === null
                ? 'All Merchandise Items'
                : 'Collection Items'}
            </h3>
            <button
              onClick={() => {
                if (selectedCollectionId === null) {
                  toastUtils.error('Please select a collection first.');
                  return;
                }
                
                // Default single variant
                setItemFormData({
                  name: '',
                  description: '',
                  base_price: 0,
                  image_url: '',
                  imageFile: null,
                  second_image_url: '',
                  secondImageFile: null,
                  merchandise_collection_id: selectedCollectionId,
                  variants: [
                    {
                      size: 'M',
                      color: 'Black',
                      price_adjustment: 0
                    }
                  ],
                  is_one_size: false,
                  color: 'Black',
                  stock_status: 'in_stock',
                  status_note: '',
                  enable_stock_tracking: false,
                  stock_quantity: 0,
                  damaged_quantity: 0,
                  low_stock_threshold: 5
                });
                setIsAddingItem(true);
                setIsEditingItem(false);
              }}
              className="bg-[#c1902f] text-white px-3 py-1.5 rounded-md flex items-center text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          {merchandiseItems.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg mb-6">
              <p className="text-gray-500">
                No items in this collection. Add an item to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {merchandiseItems.map((item: any) => (
                <div key={item.id} className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-white p-4 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="h-12 w-12 bg-gray-200 rounded-md overflow-hidden mr-4">
                        {item.image_url ? (
                          <OptimizedImage
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            width="48"
                            height="48"
                            context="cart"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">
                          {item.name}
                          {selectedCollectionId === null && item.collection_name && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({item.collection_name})
                            </span>
                          )}
                        </h3>
                        <span className="text-gray-600">
                          ${item.base_price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Manage Inventory */}
                      <button
                        onClick={() => {
                          setSelectedItemForInventory(item);
                          setShowInventoryModal(true);
                        }}
                        className="text-green-600 hover:text-green-800"
                        title="Manage Inventory"
                      >
                        <Package className="h-5 w-5" />
                      </button>
                      {/* Edit Item */}
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Item"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      {/* Delete Item */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Collection Settings (only if a specific collection is selected) */}
          {selectedCollectionId && (
            <div className="mb-8">
              <button
                onClick={() => setShowCollectionSettings(!showCollectionSettings)}
                className="flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-200 rounded-t-lg shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Collection Settings
                  </h3>
                  {collections.find((c) => c.id === selectedCollectionId)?.active && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                      Active
                    </span>
                  )}
                </div>
                {showCollectionSettings ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {showCollectionSettings && (
                <div className="bg-white p-6 rounded-b-lg border border-gray-200 border-t-0 shadow-sm animate-fadeIn">
                  <div className="space-y-6">
                    {/* Active Toggle */}
                    <div>
                      {collections.find((c) => c.id === selectedCollectionId)?.active ? (
                        <div className="flex items-center text-green-600">
                          <Check className="h-5 w-5 mr-2" />
                          <span>This collection is currently active.</span>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={async () => {
                              if (
                                window.confirm(
                                  'Are you sure you want to set this collection as active?'
                                )
                              ) {
                                try {
                                  await withLoading(async () => {
                                    await setActiveCollection(selectedCollectionId);
                                    toastUtils.success('Collection set as active successfully');
                                  });
                                } catch (err) {
                                  console.error('Failed to set collection as active:', err);
                                  toastUtils.error('Failed to set collection as active');
                                }
                              }
                            }}
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Set as Active
                          </button>
                          <p className="text-sm text-gray-500 mt-2">
                            Make this the default collection shown to customers.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {/* Edit Collection Button */}
                      <button
                        onClick={() => {
                          const col = collections.find((c) => c.id === selectedCollectionId);
                          if (col) {
                            const extendedCol = col as any;
                            setCollectionFormData({
                              id: col.id,
                              name: col.name,
                              description: extendedCol.description || '',
                              active: col.active,
                              image_url: extendedCol.image_url || '',
                              imageFile: null
                            });
                            setIsAddingCollection(true);
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Collection
                      </button>

                      {/* Delete Collection Button */}
                      <button
                        onClick={async () => {
                          if (
                            window.confirm(
                              'Are you sure you want to delete this collection? ' +
                                'This will also delete all items in this collection and cannot be undone.'
                            )
                          ) {
                            try {
                              await withLoading(async () => {
                                if (selectedCollectionId !== null) {
                                  await deleteCollection(selectedCollectionId);
                                  toastUtils.success('Collection deleted successfully');

                                  // Reset to a different collection or All Items
                                  if (collections.length > 1) {
                                    const nextCol = collections.find(
                                      (c) => c.id !== selectedCollectionId
                                    );
                                    if (nextCol) {
                                      setSelectedCollectionId(nextCol.id);
                                      fetchMerchandiseItems();
                                    }
                                  } else {
                                    setSelectedCollectionId(null);
                                    fetchMerchandiseItems();
                                  }
                                }
                              });
                            } catch (err) {
                              console.error('Failed to delete collection:', err);
                              toastUtils.error('Failed to delete collection');
                            }
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Collection
                      </button>
                    </div>

                    <p className="text-sm text-gray-500 mt-2">
                      Deleting this collection will permanently remove all its items.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Inventory Modal */}
      {showInventoryModal && selectedItemForInventory && (
        <MerchandiseInventoryModal
          open={showInventoryModal}
          onClose={() => {
            setShowInventoryModal(false);
            setSelectedItemForInventory(null);
          }}
          merchandiseItem={selectedItemForInventory}
          onSave={async () => {
            // Refresh after saving inventory changes
            await fetchMerchandiseItems();
          }}
        />
      )}
    </div>
  );
};

export default MerchandiseManager;
export { MerchandiseManager };
