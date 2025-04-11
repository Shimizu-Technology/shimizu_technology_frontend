// src/ordering/components/admin/MenuManager.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, BookOpen, Package, Eye, EyeOff, Copy } from 'lucide-react';
import toastUtils from '../../../shared/utils/toastUtils';
import { useMenuStore } from '../../store/menuStore';
import type { MenuItem } from '../../types/menu';
import { useCategoryStore } from '../../store/categoryStore'; // to fetch real categories
import { api, uploadMenuItemImage } from '../../lib/api';
import { useLoadingOverlay } from '../../../shared/components/ui/LoadingOverlay';
import { Tooltip } from '../../../shared/components/ui';
import { deriveStockStatus, calculateAvailableQuantity } from '../../utils/inventoryUtils';
import OptimizedImage from '../../../shared/components/ui/OptimizedImage';
import useIntersectionObserver from '../../../shared/hooks/useIntersectionObserver';

// Import the Inventory Modal
import ItemInventoryModal from './ItemInventoryModal';
// Import the updated OptionGroupsModal (no "required" field)
import OptionGroupsModal from './OptionGroupsModal';

// Import the CopyMenuItemModal component
import { CopyMenuItemModal } from './CopyMenuItemModal';

// LazyMenuManagerImage component for lazy-loaded images in the admin menu manager
interface LazyMenuManagerImageProps {
  image: string | undefined | null;
  name: string;
}

function LazyMenuManagerImage({ image, name }: LazyMenuManagerImageProps) {
  const [ref, isVisible] = useIntersectionObserver({
    rootMargin: '200px', // Load images 200px before they enter the viewport
    triggerOnce: true // Only trigger once
  });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="w-full h-48 bg-gray-100">
      {isVisible ? (
        <OptimizedImage
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          width="400"
          height="192"
          context="menuItem"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

/**
 * Local form data for creating/updating a menu item.
 * We use numeric category_ids to keep it simple.
 */
interface MenuItemFormData {
  id?: number;
  name: string;
  description: string;
  price: string;
  cost_to_make: string;
  category_ids: number[]; // numeric category IDs

  menu_id?: number;
  image: string;
  imageFile?: File | null;  // handle new image uploads
  advance_notice_hours: number;
  seasonal: boolean;
  available_from?: string | null;
  available_until?: string | null;
  promo_label?: string | null;
  featured: boolean;
  stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';
  status_note?: string | null;
  
  // Day-specific availability (0-6, where 0 is Sunday)
  available_days?: (number | string)[];
  
  // Inventory tracking fields
  enable_stock_tracking?: boolean;
  stock_quantity?: number;
  damaged_quantity?: number;
  low_stock_threshold?: number;
  available_quantity?: number; // Computed: stock_quantity - damaged_quantity
}

/**
 * Option group interface for menu items
 * Kept for future use and type consistency with backend models
 * @deprecated Currently not used directly but maintained for API compatibility
 */
interface OptionGroup {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  position: number;
  options: OptionRow[];
}

interface OptionRow {
  id: number;
  name: string;
  additional_price: number;
  position: number;
  /**
   * We now allow pre-selected options in the admin UI
   */
  is_preselected?: boolean;
}

/** Helper to format a date for display. */
function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return dateStr; // fallback if invalid
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface MenuManagerProps {
  restaurantId?: string;
  selectedMenuItemId?: string | null;
  openInventoryForItem?: string | null;
  onInventoryModalClose?: () => void;
}

export function MenuManager({
  restaurantId,
  selectedMenuItemId,
  openInventoryForItem,
  onInventoryModalClose
}: MenuManagerProps) {
  const {
    menus,
    menuItems,
    currentMenuId,
    fetchMenus,
    fetchAllMenuItemsForAdmin,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    setActiveMenu,
    startMenuItemsWebSocket,
    stopInventoryPolling
  } = useMenuStore();

  const { categories, fetchCategoriesForMenu } = useCategoryStore();

  // The currently selected menu ID for filtering
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  
  // The currently selected category ID for filtering
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Menu selector toggle state - closed by default
  const [menuSelectorOpen, setMenuSelectorOpen] = useState(false);
  
  // Copy menu item modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [itemToCopy, setItemToCopy] = useState<MenuItem | null>(null);

  // Additional filter checkboxes
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showSeasonalOnly, setShowSeasonalOnly] = useState(false);
  
  // Visibility filter - default to showing active (non-hidden) items
  const [visibilityFilter, setVisibilityFilter] = useState<'active' | 'hidden' | 'all'>('active');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemFormData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // For managing option groups
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [optionsModalItem, setOptionsModalItem] = useState<MenuItem | null>(null);

  // Inventory modal state
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryModalItem, setInventoryModalItem] = useState<MenuItem | null>(null);
  
  // For item-specific polling when editing
  const [editItemPollingActive, setEditItemPollingActive] = useState(false);

  // On mount => fetch items (admin) + categories + menus and start WebSocket connection
  useEffect(() => {
    fetchAllMenuItemsForAdmin();
    fetchMenus();
    
    // Start WebSocket connection for real-time menu item updates instead of polling
    const restaurantId = localStorage.getItem('restaurantId');
    if (restaurantId) {
      console.debug('[MenuManager] Starting WebSocket connection for menu items');
      // Explicitly stop any existing polling before starting WebSocket
      stopInventoryPolling();
      useMenuStore.getState().startMenuItemsWebSocket();
      
      // Double-check that polling is stopped after WebSocket connection
      setTimeout(() => {
        if (useMenuStore.getState().inventoryPollingInterval !== null) {
          console.debug('[MenuManager] Stopping lingering inventory polling after WebSocket connection');
          stopInventoryPolling();
        }
      }, 1000);
    } else {
      console.debug('[MenuManager] No restaurant ID available, will connect to WebSocket when available');
    }
    
    // Clean up when the component unmounts
    return () => {
      console.debug('[MenuManager] Component unmounting, stopping inventory polling');
      stopInventoryPolling();
    };
  }, [
    fetchAllMenuItemsForAdmin,
    fetchMenus,
    stopInventoryPolling
  ]);
  
  // Handle selectedMenuItemId from props (for opening edit modal from e.g. notifications)
  useEffect(() => {
    if (selectedMenuItemId) {
      const item = menuItems.find((mi) => mi.id === selectedMenuItemId);
      if (item) {
        // Make sure we're using WebSockets and not polling
        if (useMenuStore.getState().inventoryPollingInterval !== null) {
          console.debug(`[MenuManager] Stopping inventory polling before editing item ${selectedMenuItemId}`);
          stopInventoryPolling();
        }
        handleEdit(item);
      }
    }
  }, [selectedMenuItemId, menuItems, stopInventoryPolling]);
  
  // Handle openInventoryForItem from props (for opening inventory modal from notifications)
  useEffect(() => {
    if (openInventoryForItem) {
      const item = menuItems.find((mi) => mi.id === openInventoryForItem);
      if (item) {
        // Make sure we're using WebSockets and not polling
        if (useMenuStore.getState().inventoryPollingInterval !== null) {
          console.debug(`[MenuManager] Stopping inventory polling before managing inventory for item ${openInventoryForItem}`);
          stopInventoryPolling();
        }
        handleManageInventory(item);
      }
    }
  }, [openInventoryForItem, menuItems, stopInventoryPolling]);

  // Set the current menu as the default selected menu
  useEffect(() => {
    if (currentMenuId && !selectedMenuId) {
      setSelectedMenuId(currentMenuId);
      setMenuSelectorOpen(false);
    }
  }, [currentMenuId, selectedMenuId]);

  // Refresh menu items when selected menu changes
  useEffect(() => {
    if (selectedMenuId) {
      fetchAllMenuItemsForAdmin();
      // Fetch categories specific to the selected menu
      fetchCategoriesForMenu(selectedMenuId, restaurantId ? Number(restaurantId) : undefined);
    }
  }, [selectedMenuId, restaurantId, fetchAllMenuItemsForAdmin, fetchCategoriesForMenu]);

  // Filter categories by selected menu
  const filteredCategories = useMemo(() => {
    if (!selectedMenuId || !categories?.length) return [];
    return categories.filter(cat => cat.menu_id === selectedMenuId);
  }, [categories, selectedMenuId]);

  // Filter the items in memory
  const filteredItems = useMemo(() => {
    let list = menuItems;

    // Filter by menu if selected
    if (selectedMenuId) {
      list = list.filter(item => Number(item.menu_id) === selectedMenuId);
    }

    // If a category is selected, only show items that have that category
    if (selectedCategory && categories?.length) {
      list = list.filter(item => item.category_ids?.includes(selectedCategory));
    }
    
    // Apply visibility filter
    if (visibilityFilter === 'active') {
      list = list.filter(item => !item.hidden);
    } else if (visibilityFilter === 'hidden') {
      list = list.filter(item => item.hidden);
    }
    // 'all' shows everything, so no filtering needed
    
    if (showFeaturedOnly) {
      list = list.filter(item => item.featured);
    }
    if (showSeasonalOnly) {
      list = list.filter(item => item.seasonal);
    }
    return list;
  }, [
    menuItems,
    selectedMenuId,
    selectedCategory,
    visibilityFilter,
    showFeaturedOnly,
    showSeasonalOnly
  ]);

  // Default form data for a new item
  const initialFormData: MenuItemFormData = {
    name: '',
    description: '',
    price: '0',
    cost_to_make: '0',
    category_ids: [],
    image: '',
    imageFile: null,
    menu_id: selectedMenuId || 1,
    advance_notice_hours: 0,
    seasonal: false,
    available_from: null,
    available_until: null,
    promo_label: 'Limited Time',
    featured: false,
    stock_status: 'in_stock',
    status_note: '',
    available_days: [],
    enable_stock_tracking: false,
    stock_quantity: 0,
    damaged_quantity: 0,
    low_stock_threshold: 10,
    available_quantity: 0,
  };

  /** Refresh data after inventory changes (e.g. from the Inventory Modal) */
  const refreshAfterInventoryChanges = () => {
    fetchAllMenuItemsForAdmin();
  };

  /** Utility: enforce max 4 featured items. */
  function canFeatureThisItem(formData: MenuItemFormData): boolean {
    if (!formData.featured) return true;

    const isCurrentlyFeatured = menuItems.find(
      (m) => Number(m.id) === formData.id
    )?.featured;

    // If it was already featured, that remains allowed
    if (isCurrentlyFeatured) return true;

    // Otherwise, count how many are currently featured
    const currentlyFeaturedCount = menuItems.filter(m => m.featured).length;
    if (currentlyFeaturedCount >= 4) {
      toastUtils.error('You can only have 4 featured items at a time.');
      return false;
    }
    return true;
  }

  /** Handle editing an existing item => fill form data. */
  const handleEdit = (item: MenuItem) => {
    // Calculate available quantity
    const stockQty = item.stock_quantity || 0;
    const damagedQty = item.damaged_quantity || 0;
    const availableQty = Math.max(0, stockQty - damagedQty);
    
    // Convert available_days to numbers if they're strings
    const availableDays = item.available_days
      ? item.available_days.map(day => typeof day === 'string' ? Number(day) : day)
      : [];
    
    // Reset unsaved changes flag when opening the edit modal
    setHasUnsavedChanges(false);
    
    setEditingItem({
      id: Number(item.id),
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      cost_to_make: (item.cost_to_make ?? 0).toString(),
      category_ids: item.category_ids || [],
      image: item.image || '',
      imageFile: null,
      menu_id: (item as any).menu_id || selectedMenuId || 1,
      advance_notice_hours: item.advance_notice_hours ?? 0,
      seasonal: !!item.seasonal,
      available_from: item.available_from || null,
      available_until: item.available_until || null,
      promo_label: item.promo_label?.trim() || 'Limited Time',
      featured: !!item.featured,
      stock_status:
        item.stock_status === 'limited'
          ? 'low_stock'
          : (item.stock_status as 'in_stock' | 'out_of_stock' | 'low_stock'),
      status_note: item.status_note || '',
      available_days: availableDays,
      enable_stock_tracking: !!item.enable_stock_tracking,
      stock_quantity: stockQty,
      damaged_quantity: damagedQty,
      low_stock_threshold: item.low_stock_threshold || 10,
      available_quantity: availableQty,
    });
    setIsEditing(true);
    
    // Start polling for this specific item's inventory updates if tracking is on
    if (item.enable_stock_tracking) {
      setEditItemPollingActive(true);
      // Use WebSocket for real-time updates instead of polling
      startMenuItemsWebSocket();
    }
  };

  /** Handle adding a new item => blank form. */
  const handleAdd = () => {
    // Reset unsaved changes flag when opening the edit modal
    setHasUnsavedChanges(false);
    setEditingItem({
      ...initialFormData,
      menu_id: selectedMenuId || 1
    });
    setIsEditing(true);
  };

  /** Delete item. */
  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteMenuItem(id);
    }
  };

  /** Manage option groups => show the modal. */
  const handleManageOptions = (item: MenuItem) => {
    setOptionsModalItem(item);
    setOptionsModalOpen(true);
  };
  const handleCloseOptionsModal = () => {
    setOptionsModalOpen(false);
    setOptionsModalItem(null);
  };

  // Update the editingItem if inventory changed while the edit form is open
  useEffect(() => {
    if (isEditing && editingItem && editingItem.id && editItemPollingActive) {
      const editingItemId = editingItem.id;
      const updatedItem = menuItems.find((mi) => Number(mi.id) === editingItemId);
      
      if (updatedItem) {
        const stockQty = updatedItem.stock_quantity || 0;
        const damagedQty = updatedItem.damaged_quantity || 0;
        const availableQty = Math.max(0, stockQty - damagedQty);
        const threshold = updatedItem.low_stock_threshold || 10;
        
        // Only update if something actually changed
        if (
          stockQty !== editingItem.stock_quantity ||
          damagedQty !== editingItem.damaged_quantity ||
          threshold !== editingItem.low_stock_threshold ||
          updatedItem.stock_status !== editingItem.stock_status ||
          !!updatedItem.enable_stock_tracking !== editingItem.enable_stock_tracking
        ) {
          setEditingItem((prevItem) => {
            if (!prevItem) return prevItem;
            return {
              ...prevItem,
              enable_stock_tracking: !!updatedItem.enable_stock_tracking,
              stock_quantity: stockQty,
              damaged_quantity: damagedQty,
              low_stock_threshold: threshold,
              available_quantity: availableQty,
              stock_status: updatedItem.stock_status as 'in_stock' | 'out_of_stock' | 'low_stock',
            };
          });
        }
      }
    }
  }, [menuItems, isEditing, editItemPollingActive, editingItem]);

  /** Manage inventory => show the modal and ensure WebSocket connection. */
  const handleManageInventory = (item: MenuItem) => {
    // First ensure any existing polling is stopped
    stopInventoryPolling();
    
    // Make sure WebSocket connection is active
    const { websocketConnected } = useMenuStore.getState();
    if (!websocketConnected) {
      console.debug(`[MenuManager] Starting WebSocket connection for inventory updates`);
      useMenuStore.getState().startMenuItemsWebSocket();
    } else {
      console.debug(`[MenuManager] WebSocket already connected for inventory updates`);
    }
    
    setInventoryModalItem(item);
    setInventoryModalOpen(true);
  };
  const handleCloseInventoryModal = () => {
    setInventoryModalOpen(false);
    const itemBeforeClosing = inventoryModalItem;
    setInventoryModalItem(null);

    // Ensure polling is stopped when modal is closed
    if (useMenuStore.getState().inventoryPollingInterval !== null) {
      console.debug('[MenuManager] Stopping inventory polling on modal close');
      stopInventoryPolling();
    }

    // If the parent component needs to reset e.g. "openInventoryForItem"
    if (onInventoryModalClose) {
      onInventoryModalClose();
    }
    
    // Force a refresh to get updated inventory/tracking data using WebSocket if possible
    if (useMenuStore.getState().websocketConnected) {
      console.debug('[MenuManager] Using WebSocket for inventory refresh');
      // The WebSocket will handle updates, but we'll fetch once to ensure we have the latest data
      fetchAllMenuItemsForAdmin();
    } else {
      console.debug('[MenuManager] Using API call for inventory refresh');
      fetchAllMenuItemsForAdmin();
    }
  };

  // Use our loading overlay hook
  const { withLoading, LoadingOverlayComponent } = useLoadingOverlay();

  /** Toggles for "Featured only" + "Seasonal only" filters. */
  function handleToggleFeatured(checked: boolean) {
    if (checked) setShowSeasonalOnly(false);
    setShowFeaturedOnly(checked);
  }
  function handleToggleSeasonal(checked: boolean) {
    if (checked) setShowFeaturedOnly(false);
    setShowSeasonalOnly(checked);
  }

  /** Mark a menu as active. */
  const handleSetActiveMenu = async (id: number) => {
    await setActiveMenu(id);
    await fetchAllMenuItemsForAdmin();
  };

  /** Submit the form => create/update item. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    // Enforce up to 4 featured
    if (!canFeatureThisItem(editingItem)) return;
    
    // Validate at least one category
    if (editingItem.category_ids.length === 0) {
      toastUtils.error('Please select at least one category for this menu item.');
      return;
    }

    // If seasonal but no label => default "Limited Time"
    let finalLabel = editingItem.promo_label?.trim() || '';
    if (editingItem.seasonal && !finalLabel) {
      finalLabel = 'Limited Time';
    }
    
    // Determine final stock status
    // Only use derived status when inventory tracking is enabled
    let finalStockStatus = editingItem.enable_stock_tracking
      ? deriveStockStatus(editingItem as any)
      : editingItem.stock_status;

    // Save the current available_days before submitting
    const currentAvailableDays = editingItem.available_days || [];

    try {
      await withLoading(async () => {
        let updatedItem: any;
        
        if (editingItem.id) {
          // Updating existing item
          const { id, imageFile, available_quantity, ...rest } = editingItem;
          
          // Ensure available_days is an array of numbers
          const submittedDays = Array.isArray(editingItem.available_days)
            ? editingItem.available_days.map(day => Number(day))
            : [];
          
          const payload = {
            ...rest,
            price: parseFloat(editingItem.price) || 0,
            cost_to_make: parseFloat(editingItem.cost_to_make) || 0,
            promo_label: finalLabel,
            stock_status: finalStockStatus,
            available_days: submittedDays
          };
          updatedItem = await updateMenuItem(String(id), payload);

          // If there's a new image file, upload it now
          if (imageFile instanceof File) {
            await uploadMenuItemImage(String(id), imageFile);
            // Fetch new data with updated image
            updatedItem = await api.get(`/menu_items/${id}`);
          }

          // Process available_days from the API response
          let processedDays: number[] = [];
          
          // First try to use the API response
          if (updatedItem && updatedItem.available_days && Array.isArray(updatedItem.available_days)) {
            // Ensure all values are numbers
            processedDays = updatedItem.available_days.map((day: any) => Number(day));
          }
          // If empty or missing, use our saved currentAvailableDays
          else if (currentAvailableDays && currentAvailableDays.length > 0) {
            processedDays = currentAvailableDays.map((day: any) => Number(day));
          }

          // Update the local form state with the newly fetched data
          if (updatedItem) {
            setEditingItem({
              id: Number(updatedItem.id),
              name: updatedItem.name,
              description: updatedItem.description,
              price: updatedItem.price.toString(),
              cost_to_make: (updatedItem.cost_to_make ?? 0).toString(),
              category_ids: updatedItem.category_ids || [],
              image: updatedItem.image_url || updatedItem.image || '',
              imageFile: null,
              menu_id: updatedItem.menu_id || selectedMenuId || 1,
              advance_notice_hours: updatedItem.advance_notice_hours ?? 0,
              seasonal: !!updatedItem.seasonal,
              available_from: updatedItem.available_from || null,
              available_until: updatedItem.available_until || null,
              promo_label: updatedItem.promo_label?.trim() || 'Limited Time',
              featured: !!updatedItem.featured,
              stock_status:
                updatedItem.stock_status === 'limited'
                  ? 'low_stock'
                  : (updatedItem.stock_status as 'in_stock' | 'out_of_stock' | 'low_stock'),
              status_note: updatedItem.status_note || '',
              available_days: processedDays, // Use our processed array
              enable_stock_tracking: updatedItem.enable_stock_tracking,
              stock_quantity: updatedItem.stock_quantity || 0,
              damaged_quantity: updatedItem.damaged_quantity || 0,
              low_stock_threshold: updatedItem.low_stock_threshold || 10,
              available_quantity: Math.max(
                0,
                (updatedItem.stock_quantity || 0) - (updatedItem.damaged_quantity || 0)
              ),
            });
            
            // Show success toast for updated item
            toastUtils.success('Menu item updated successfully!');
            
            // Reset unsaved changes flag
            setHasUnsavedChanges(false);
          }
        } else {
          // Creating new
          const { imageFile, available_quantity, ...rest } = editingItem;
          
          // Ensure available_days is an array of numbers
          const availableDays = Array.isArray(editingItem.available_days)
            ? editingItem.available_days.map(day => Number(day))
            : [];
          
          const payload = {
            ...rest,
            price: parseFloat(editingItem.price) || 0,
            cost_to_make: parseFloat(editingItem.cost_to_make) || 0,
            promo_label: finalLabel,
            stock_status: finalStockStatus,
            available_days: availableDays
          };
          updatedItem = await addMenuItem(payload);

          // If there's a new image file, upload it
          if (updatedItem && updatedItem.id && imageFile instanceof File) {
            await uploadMenuItemImage(updatedItem.id, imageFile);
            updatedItem = await api.get(`/menu_items/${updatedItem.id}`);
          }

          // Show success toast for new item
          toastUtils.success('Menu item created successfully!');
          
          // Close the form after creating a new item
          setIsEditing(false);
          setEditingItem(null);
          setHasUnsavedChanges(false);
        }
      });
    } catch (err) {
      console.error('Failed to save menu item:', err);
    } finally {
      // Refresh items after any change
      fetchAllMenuItemsForAdmin();
    }
  };

  /** Helper to format available days for display. */
  function formatAvailableDays(days?: (number | string)[]): string {
    if (!days || days.length === 0) return 'Every day';
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Convert all values to numbers for consistent handling
    const daysAsNumbers = days.map(day => 
      typeof day === 'string' ? parseInt(day, 10) : day
    );
    
    if (daysAsNumbers.length === 1) {
      return `${dayNames[daysAsNumbers[0]]}s only`;
    } else if (daysAsNumbers.length === 7) {
      return 'Every day';
    } else if (daysAsNumbers.length > 3) {
      // If more than 3 days, show which days it's NOT available
      const excludedDays = dayNames
        .filter((_, index) => !daysAsNumbers.includes(index))
        .map(day => day.substring(0, 3));
      return `Not available on ${excludedDays.join(', ')}`;
    } else {
      // Show the days it IS available
      return daysAsNumbers.map(day => dayNames[day].substring(0, 3)).join(', ');
    }
  }

  /** Helper badge component for small labels. */
  function Badge({
    children,
    bgColor = 'bg-gray-500',
    textColor = 'text-white',
  }: {
    children: React.ReactNode;
    bgColor?: string;
    textColor?: string;
  }) {
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold mr-1 mt-1 ${bgColor} ${textColor}`}
      >
        {children}
      </span>
    );
  }

  return (
    <div className="p-4">
      {/* Loading overlay when isLoading = true */}
      {LoadingOverlayComponent}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Menu Management</h2>
        <p className="text-gray-600 text-sm">Manage menu items, categories, and options</p>
      </div>

      {/* Menu Selection + Add Item */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          {/* Current Menu Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center mb-4 sm:mb-0">
            <div className="relative inline-block w-full sm:w-64 z-10">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Current Menu</h3>
              
              <button
                onClick={() => setMenuSelectorOpen(!menuSelectorOpen)}
                className="w-full flex items-center justify-between bg-white text-gray-800 hover:bg-gray-50
                           px-3 py-2 rounded-md border border-gray-200 shadow-sm transition-all duration-150
                           focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50"
                aria-expanded={menuSelectorOpen}
                aria-controls="menu-selector-dropdown"
              >
                <div className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-2 text-[#c1902f]" />
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {selectedMenuId
                      ? menus.find((m) => m.id === selectedMenuId)?.name || 'Select Menu'
                      : 'Select Menu'}
                  </span>
                  {selectedMenuId && selectedMenuId === currentMenuId && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </div>
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ease-in-out ${
                    menuSelectorOpen ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown */}
              <div
                id="menu-selector-dropdown"
                className={`absolute w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden transition-all duration-200 ease-in-out
                            ${menuSelectorOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
                style={{ transformOrigin: 'top' }}
              >
                <div className="py-1 max-h-60 overflow-y-auto">
                  {menus.map((menu) => (
                    <button
                      key={menu.id}
                      onClick={async () => {
                        setSelectedMenuId(menu.id);
                        setMenuSelectorOpen(false);
                        await fetchAllMenuItemsForAdmin();
                      }}
                      className={`
                        w-full text-left px-3 py-2 text-sm flex items-center justify-between
                        transition-colors duration-150
                        ${selectedMenuId === menu.id
                          ? 'bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                          : 'text-gray-700 hover:bg-gray-50'}
                      `}
                    >
                      <div className="flex items-center">
                        <BookOpen
                          className={`h-4 w-4 mr-2 flex-shrink-0 ${
                            selectedMenuId === menu.id ? 'text-[#c1902f]' : 'text-gray-400'
                          }`}
                        />
                        <span className="truncate">{menu.name}</span>
                      </div>
                      {menu.id === currentMenuId && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-800 flex-shrink-0">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Set Active Menu Button */}
            {selectedMenuId && selectedMenuId !== currentMenuId && (
              <button
                onClick={() => handleSetActiveMenu(selectedMenuId)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center mt-2 sm:mt-6 sm:ml-4"
              >
                <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Set as active
              </button>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Add Item Button */}
            {/* Add Item Button */}
            <button
              onClick={handleAdd}
              className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
              disabled={!selectedMenuId}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* We'll replace the Menu Copy Mode with individual copy buttons on each card */}

      {/* Category Filter */}
      <div className="mb-3">
        <div className="flex flex-nowrap space-x-3 overflow-x-auto py-2">
          {/* 'All Categories' */}
          <button
            className={
              !selectedCategory
                ? 'whitespace-nowrap px-4 py-2 rounded-md bg-[#c1902f] text-white'
                : 'whitespace-nowrap px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
            onClick={() => setSelectedCategory(null)}
          >
            All Categories
          </button>

          {/* Real categories from the store - filtered by selected menu */}
          {filteredCategories?.length ? (
            filteredCategories.map((cat) => (
              <button
                key={cat.id}
                className={
                  selectedCategory === cat.id
                    ? 'whitespace-nowrap px-4 py-2 rounded-md bg-[#c1902f] text-white'
                    : 'whitespace-nowrap px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))
          ) : null}
        </div>
      </div>
      
      {/* Category Description - Only shown when a category is selected */}
      {selectedCategory && (
        <div className="animate-fadeIn transition-all duration-300 mb-4">
          {categories.find(cat => cat.id === selectedCategory)?.description && (
            <div className="bg-white/80 backdrop-blur-sm border-l-2 border-[#c1902f]/70 rounded-lg px-4 py-3 sm:p-4 shadow-sm mb-4">
              <p className="text-gray-600 font-normal leading-relaxed text-sm sm:text-base">
                {categories.find(cat => cat.id === selectedCategory)?.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visibility Filter Tabs */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg p-1 bg-gray-100 mb-4">
          <button 
            className={`px-4 py-2 rounded-md ${visibilityFilter === 'active' ? 'bg-white shadow-sm' : ''}`}
            onClick={() => setVisibilityFilter('active')}>
            Active Items
          </button>
          <button 
            className={`px-4 py-2 rounded-md ${visibilityFilter === 'hidden' ? 'bg-white shadow-sm' : ''}`}
            onClick={() => setVisibilityFilter('hidden')}>
            Hidden Items
          </button>
          <button 
            className={`px-4 py-2 rounded-md ${visibilityFilter === 'all' ? 'bg-white shadow-sm' : ''}`}
            onClick={() => setVisibilityFilter('all')}>
            All Items
          </button>
        </div>
      </div>

      {/* Additional Filters (Featured / Seasonal) */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showFeaturedOnly}
            onChange={(e) => handleToggleFeatured(e.target.checked)}
          />
          <span>Featured Items</span>
        </label>

        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showSeasonalOnly}
            onChange={(e) => handleToggleSeasonal(e.target.checked)}
          />
          <span>Seasonal Items</span>
        </label>
      </div>

      {/* Items Grid or Empty State */}
      {!selectedMenuId ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-lg shadow-md animate-fadeIn">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <BookOpen className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Menu</h3>
          <p className="text-gray-500 max-w-md">
            Please select a menu from the options above to view and manage its items.
          </p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const fromDate = formatDate(item.available_from);
            const untilDate = formatDate(item.available_until);

            // If seasonal, show a small date info line
            let dateInfo: React.ReactNode = null;
            if (item.seasonal && (fromDate || untilDate)) {
              dateInfo = (
                <p className="text-xs text-gray-600 mt-2">
                  <span className="font-semibold">Starts:</span> {fromDate || '—'}
                  <span className="mx-1 text-gray-400">•</span>
                  <span className="font-semibold">Ends:</span> {untilDate || '—'}
                </p>
              );
            }

            return (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col animate-fadeIn"
              >
                <LazyMenuManagerImage 
                  image={item.image}
                  name={item.name}
                />
                <div className="p-4 flex flex-col flex-1">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>

                    <div className="mt-2 flex flex-wrap">
                      {/* Badges for stock/featured/seasonal/etc. */}
                      {/* Hidden badge */}
                      {item.hidden && (
                        <Badge bgColor="bg-gray-800">Hidden</Badge>
                      )}
                      {/* 1) If item is "out_of_stock" but not tracking, show "Out of Stock" */}
                      {item.stock_status === 'out_of_stock' && !item.enable_stock_tracking && (
                        <Badge bgColor="bg-gray-600">Out of Stock</Badge>
                      )}
                      {/* 2) If item is "low_stock" but not tracking, show "Low Stock" */}
                      {item.stock_status === 'low_stock' && !item.enable_stock_tracking && (
                        <Badge bgColor="bg-orange-500">Low Stock</Badge>
                      )}
                      {/* 3) If item requires 24hr notice */}
                      {(item.advance_notice_hours ?? 0) >= 24 && (
                        <Badge bgColor="bg-red-600">24hr Notice</Badge>
                      )}
                      {/* 4) Seasonal items */}
                      {item.seasonal && (
                        <Badge bgColor="bg-red-500">
                          {item.promo_label?.trim() || 'Limited Time'}
                        </Badge>
                      )}
                      {/* 5) Featured */}
                      {item.featured && (
                        <Badge bgColor="bg-yellow-500">Featured</Badge>
                      )}
                      {/* 6) If inventory tracking is enabled */}
                      {item.enable_stock_tracking && (
                        <Badge bgColor="bg-blue-500">Inventory Tracked</Badge>
                      )}
                      {/* 7) If tracking is enabled, show dynamic stock badges */}
                      {item.enable_stock_tracking && deriveStockStatus(item) === 'low_stock' && (
                        <Badge bgColor="bg-orange-500">
                          Low Stock ({calculateAvailableQuantity(item)} left)
                        </Badge>
                      )}
                      {item.enable_stock_tracking && deriveStockStatus(item) === 'out_of_stock' && (
                        <Badge bgColor="bg-gray-600">Out of Stock</Badge>
                      )}
                      {/* 8) Day-specific availability */}
                      {item.available_days && item.available_days.length > 0 && item.available_days.length < 7 && (
                        <Badge bgColor="bg-purple-500">
                          {formatAvailableDays(item.available_days)}
                        </Badge>
                      )}
                    </div>

                    {/* Optional status note */}
                    {item.status_note?.trim() && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {item.status_note}
                      </p>
                    )}

                    {/* Seasonal date range info */}
                    {dateInfo}
                  </div>

                  {/* Bottom row with price + actions */}
                  <div className="mt-auto pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg font-semibold">
                        ${Number(item.price).toFixed(2)}
                      </span>

                      {/* Edit Item */}
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-gray-600 hover:text-[#c1902f]"
                        title="Edit Item"
                      >
                        <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
{/* Manage Inventory */}
<button
  onClick={() => handleManageInventory(item)}
  className="p-2 text-gray-600 hover:text-blue-600"
  title="Manage Inventory"
>
  <Package className="h-4 w-4 sm:h-5 sm:w-5" />
</button>

                      {/* Copy to Another Menu */}
                      <button
                        onClick={() => {
                          setItemToCopy(item);
                          setCopyModalOpen(true);
                        }}
                        className="p-2 text-gray-600 hover:text-purple-600"
                        title="Copy to Another Menu"
                      >
                        <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>

                      {/* Toggle Visibility */}
                      <button
                        onClick={() => {
                          const { toggleMenuItemVisibility } = useMenuStore.getState();
                          toggleMenuItemVisibility(item.id);
                          toastUtils.success(item.hidden ? 'Item is now visible on menu' : 'Item hidden from menu');
                        }}
                        className={`p-2 ${item.hidden ? 'text-gray-400 hover:text-blue-600' : 'text-blue-600 hover:text-blue-800'}`}
                        title={item.hidden ? "Show on menu" : "Hide from menu"}
                      >
                        {item.hidden ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </button>

                      {/* Delete Item */}
                      <button
                        onClick={() => {
                          if (typeof item.id === 'string') {
                            const numId = parseInt(item.id, 10);
                            if (!Number.isNaN(numId)) handleDelete(numId);
                          } else {
                            handleDelete(item.id as number);
                          }
                        }}
                        className="p-2 text-gray-600 hover:text-red-600"
                        title="Delete Item"
                      >
                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Empty state when there are no items for the current filters
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-lg shadow-md">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
          <p className="text-gray-500 max-w-md">
            {selectedCategory
              ? "There are no items in this category for the current menu."
              : "The current menu doesn't have any items yet."}
          </p>
          {(showFeaturedOnly || showSeasonalOnly) && (
            <p className="text-gray-500 mt-2">
              Try removing the filters to see more items.
            </p>
          )}
          <button
            onClick={handleAdd}
            className="mt-6 inline-flex items-center justify-center px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Your First Item
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isEditing && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-md sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slideUp">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {editingItem.id ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => {
                  // Check for unsaved changes
                  if (hasUnsavedChanges) {
                    if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                      return; // User canceled, don't close
                    }
                  }
                  
                  // Stop item-specific polling if we were doing so
                  if (editItemPollingActive) {
                    stopInventoryPolling();
                    setEditItemPollingActive(false);
                    // No longer tracking polledItemId
                  }
                  setIsEditing(false);
                  setEditingItem(null);
                  setHasUnsavedChanges(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* BASIC INFO */}
              <div>
                <div className="flex items-center mb-2 border-b pb-2">
                  <h4 className="text-md font-semibold">Basic Info</h4>
                  <Tooltip
                    content="Enter the essential information about this menu item."
                    position="right"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>

                {/* Name & Description */}
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Tooltip
                      content="The name of the dish as it will appear on the menu."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => {
                      setHasUnsavedChanges(true);
                      setEditingItem({ ...editingItem, name: e.target.value });
                    }}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <Tooltip
                      content="A brief description of the dish, including key ingredients or preparation methods."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <textarea
                    value={editingItem.description}
                    onChange={(e) => {
                      setHasUnsavedChanges(true);
                      setEditingItem({ ...editingItem, description: e.target.value });
                    }}
                    className="w-full px-4 py-2 border rounded-md"
                    rows={2}
                  />
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Price
                    </label>
                    <Tooltip
                      content="The base price of the item in dollars. Additional charges may apply for options."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.price}
                    onChange={(e) => {
                      setHasUnsavedChanges(true);
                      // Ensure we're always working with a string
                      const newValue = e.target.value;
                      setEditingItem({
                        ...editingItem,
                        price: newValue,
                      });
                    }}
                    onFocus={(e) => {
                      // Select all text when focused to make it easier to replace
                      e.target.select();
                    }}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                  />
                </div>

                {/* Cost to Make */}
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Cost to Make
                    </label>
                    <Tooltip
                      content="The cost to produce this item. Used for profit calculations and reporting."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.cost_to_make}
                    onChange={(e) => {
                      setHasUnsavedChanges(true);
                      // Ensure we're always working with a string
                      const newValue = e.target.value;
                      setEditingItem({
                        ...editingItem,
                        cost_to_make: newValue,
                      });
                    }}
                    onFocus={(e) => {
                      // Select all text when focused to make it easier to replace
                      e.target.select();
                    }}
                    className="w-full px-4 py-2 border rounded-md"
                  />
                </div>
              </div>

              {/* MULTI-CATEGORY CHECKBOXES */}
              <div>
                <div className="flex items-center mb-2 border-b pb-2">
                  <h4 className="text-md font-semibold">Categories</h4>
                  <Tooltip
                    content="Assign this item to one or more categories. Items can appear in multiple sections."
                    position="right"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  (Select one or more categories)
                </p>
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat) => {
                    const checked = editingItem.category_ids.includes(cat.id);
                    return (
                      <label key={cat.id} className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingItem((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  category_ids: [...prev.category_ids, cat.id],
                                };
                              });
                            } else {
                              setEditingItem((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  category_ids: prev.category_ids.filter((c) => c !== cat.id),
                                };
                              });
                            }
                          }}
                        />
                        <span>{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* AVAILABILITY */}
              <div>
                <div className="flex items-center mb-2 border-b pb-2">
                  <h4 className="text-md font-semibold">Availability</h4>
                  <Tooltip
                    content="Control when this item is available and whether it requires advance notice."
                    position="right"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>

                {/* 24-hour Notice + Featured toggles */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center">
                    <label className="inline-flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingItem.advance_notice_hours >= 24}
                        onChange={(e) => {
                          const newVal = e.target.checked ? 24 : 0;
                          setEditingItem({ ...editingItem, advance_notice_hours: newVal });
                        }}
                      />
                      <span>Requires 24-hour notice?</span>
                    </label>
                    <Tooltip
                      content="Enable for items needing at least 24hr preparation time."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center">
                    <label className="inline-flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingItem.featured}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, featured: e.target.checked })
                        }
                      />
                      <span>Featured?</span>
                    </label>
                    <Tooltip
                      content="Featured items appear in a highlighted section (limit 4)."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                </div>

                {/* Seasonal */}
                <div className="mt-4">
                  <div className="flex items-center">
                    <label className="inline-flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingItem.seasonal}
                        onChange={(e) => {
                          const turnedOn = e.target.checked;
                          setEditingItem((prev) => {
                            if (!prev) return prev;
                            
                            let newLabel = prev.promo_label;
                            if (turnedOn && (!newLabel || !newLabel.trim())) {
                              newLabel = 'Limited Time';
                            }
                            return {
                              ...prev,
                              seasonal: turnedOn,
                              available_from: turnedOn ? prev.available_from : null,
                              available_until: turnedOn ? prev.available_until : null,
                              promo_label: newLabel,
                            };
                          });
                        }}
                      />
                      <span>Time-based availability? (Seasonal)</span>
                    </label>
                    <Tooltip
                      content="Use for seasonal items or limited-time promotions."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    If checked, item is only available between the specified dates.
                  </p>
                </div>

                {/* Date range if seasonal */}
                {editingItem.seasonal && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Available From
                      </label>
                      <input
                        type="date"
                        value={editingItem.available_from ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            available_from: e.target.value || null,
                          })
                        }
                        className="w-full px-4 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Available Until
                      </label>
                      <input
                        type="date"
                        value={editingItem.available_until ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            available_until: e.target.value || null,
                          })
                        }
                        className="w-full px-4 py-2 border rounded-md"
                      />
                    </div>
                  </div>
                )}

                {/* Promo Label */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Label (e.g. "Valentine's Special")
                  </label>
                  <input
                    type="text"
                    value={editingItem.promo_label ?? ''}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, promo_label: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-md"
                    placeholder="e.g. 'Valentine's Special'"
                  />
                </div>

                {/* Day-specific availability */}
                <div className="mt-4">
                  <div className="flex items-center">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Day-Specific Availability
                    </label>
                    <Tooltip
                      content="Restrict this item to specific days of the week."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Select days when this item is available. Leave all unchecked to make available every day.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                      <label key={day} className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={Array.isArray(editingItem.available_days) && 
                            editingItem.available_days.map(day => Number(day)).includes(index)}
                          onChange={(e) => {
                            // Always convert to numbers to ensure consistent handling
                            const currentDays = Array.isArray(editingItem.available_days) 
                              ? editingItem.available_days.map(day => Number(day)) 
                              : [];
                            
                            let newDays;
                            if (e.target.checked) {
                              // Add the day if checked
                              newDays = [...currentDays, index];
                            } else {
                              // Remove the day if unchecked
                              newDays = currentDays.filter(d => d !== index);
                            }
                            
                            // Update the state with the new days
                            setEditingItem({
                              ...editingItem,
                              available_days: newDays
                            });
                          }}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* INVENTORY STATUS */}
              <div>
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
                  {editingItem.enable_stock_tracking ? (
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
                            const availableQty = calculateAvailableQuantity(editingItem as any);
                            const threshold = editingItem.low_stock_threshold || 10;
                            const status = deriveStockStatus(editingItem as any);

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
                            if (editingItem.id) {
                              handleManageInventory({
                                ...editingItem,
                                id: editingItem.id.toString(),
                              } as unknown as MenuItem);
                            }
                          }}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center"
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
                          value={editingItem.status_note ?? ''}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, status_note: e.target.value })
                          }
                          className="w-full px-4 py-2 border rounded-md"
                          rows={2}
                          placeholder="e.g. 'Using a temporary sauce due to delay.'"
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
                          value={editingItem.stock_status ?? 'in_stock'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
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
                            if (editingItem.id) {
                              handleManageInventory({
                                ...editingItem,
                                id: editingItem.id.toString(),
                              } as unknown as MenuItem);
                            }
                          }}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center"
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
                          value={editingItem.status_note ?? ''}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, status_note: e.target.value })
                          }
                          className="w-full px-4 py-2 border rounded-md"
                          rows={2}
                          placeholder="e.g. 'Using a temporary sauce due to delay.'"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* IMAGES */}
              <div>
                <div className="flex items-center mb-2 border-b pb-2">
                  <h4 className="text-md font-semibold">Images</h4>
                  <Tooltip
                    content="Upload an image of this menu item."
                    position="right"
                    icon
                    iconClassName="ml-1 h-4 w-4"
                  />
                </div>
                <div>
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Image Upload
                    </label>
                    <Tooltip
                      content="Recommended size: ~800x600px, JPG or PNG."
                      position="top"
                      icon
                      iconClassName="ml-1 h-4 w-4"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setEditingItem({ ...editingItem, imageFile: e.target.files[0] });
                      }
                    }}
                    className="w-full px-2 py-2 border rounded-md"
                  />
                  {/* Existing image preview */}
                  {editingItem.image && !editingItem.imageFile && (
                    <div className="mt-2">
                      <img
                        src={editingItem.image}
                        alt="Existing"
                        className="h-10 w-10 object-cover rounded"
                      />
                    </div>
                  )}
                  {/* New file preview */}
                  {editingItem.imageFile && (
                    <div className="mt-2">
                      <img
                        src={URL.createObjectURL(editingItem.imageFile)}
                        alt="Preview"
                        className="h-10 w-10 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* MANAGE OPTIONS (only if editing existing) */}
              {editingItem.id && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingItem.id) {
                        handleManageOptions({
                          ...editingItem,
                          id: editingItem.id.toString(),
                          category_ids: editingItem.category_ids,
                        } as unknown as MenuItem);
                      }
                    }}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Manage Options
                  </button>
                </div>
              )}

              {/* Submit / Cancel */}
              <div className="flex justify-end space-x-2 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    // Check for unsaved changes
                    if (hasUnsavedChanges) {
                      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                        return; // User canceled, don't close
                      }
                    }
                    
                    if (editItemPollingActive) {
                      stopInventoryPolling();
                      setEditItemPollingActive(false);
                      // No longer need to reset polledItemId
                    }
                    setIsEditing(false);
                    setEditingItem(null);
                    setHasUnsavedChanges(false);
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Options Modal */}
      {optionsModalOpen && optionsModalItem && (
        <OptionGroupsModal item={optionsModalItem} onClose={handleCloseOptionsModal} />
      )}

      {/* Inventory Modal */}
      {inventoryModalOpen && inventoryModalItem && (
        <ItemInventoryModal
          open={inventoryModalOpen}
          menuItem={inventoryModalItem}
          onClose={handleCloseInventoryModal}
          onSave={refreshAfterInventoryChanges}
          onEnableTrackingChange={(enabled) => {
            // If we're currently editing the same item in the background, sync
            if (
              editingItem &&
              editingItem.id &&
              inventoryModalItem.id === String(editingItem.id)
            ) {
              let newStockStatus = editingItem.stock_status;
              if (enabled) {
                const stockQty = inventoryModalItem.stock_quantity || 0;
                const damagedQty = inventoryModalItem.damaged_quantity || 0;
                const availableQty = Math.max(0, stockQty - damagedQty);
                const threshold = inventoryModalItem.low_stock_threshold || 10;
                if (availableQty <= 0) {
                  newStockStatus = 'out_of_stock';
                } else if (availableQty <= threshold) {
                  newStockStatus = 'low_stock';
                } else {
                  newStockStatus = 'in_stock';
                }
              }
              setEditingItem((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  enable_stock_tracking: enabled,
                  stock_status: newStockStatus
                };
              });
            }
          }}
        />
      )}
      
      {/* Copy Menu Item Modal */}
      {copyModalOpen && itemToCopy && (
        <CopyMenuItemModal
          item={itemToCopy}
          menus={menus}
          isOpen={copyModalOpen}
          onClose={() => {
            setCopyModalOpen(false);
            setItemToCopy(null);
            // Refresh menu items to show the newly copied item
            fetchAllMenuItemsForAdmin();
          }}
        />
      )}
    </div>
  );
}
