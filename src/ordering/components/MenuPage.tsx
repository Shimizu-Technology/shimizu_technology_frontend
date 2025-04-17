// src/ordering/components/MenuPage.tsx

import { useState, useEffect, useMemo, useRef } from 'react';
import { MenuItem as MenuItemCard } from './MenuItem';
import { useMenuStore } from '../store/menuStore';
import { useCategoryStore } from '../store/categoryStore';
import { useRestaurantStore } from '../../shared/store/restaurantStore';
import { useMenuLayoutStore } from '../store/menuLayoutStore';
import { validateRestaurantContext, logTenantIsolationWarning } from '../../shared/utils/tenantUtils';
import { MenuItem } from '../types/menu';
import LayoutToggle from './layouts/LayoutToggle';
import ListView from './layouts/ListView';

export function MenuPage() {
  const { fetchVisibleMenuItems, fetchMenus, error, currentMenuId } = useMenuStore();
  const { categories, fetchCategoriesForMenu } = useCategoryStore();
  const { restaurant } = useRestaurantStore();
  const { layoutType } = useMenuLayoutStore();
  
  // State for menu items and loading state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Reference to track if data has been loaded at least once
  const initialLoadComplete = useRef(false);

  // For category filter
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Additional flags for filtering
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showSeasonalOnly, setShowSeasonalOnly] = useState(false);

  // First useEffect to fetch menus and set currentMenuId
  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  // WebSocket connection is now initialized at the app level in OnlineOrderingApp
  // This improves performance by ensuring real-time updates are available immediately

  // Separate useEffect to fetch categories when menu changes
  useEffect(() => {
    const loadCategories = async () => {
      // Validate restaurant context for tenant isolation
      // Use silent mode during initial load to reduce console noise
      const isInitialLoad = !restaurant;
      if (!validateRestaurantContext(restaurant, isInitialLoad) || !currentMenuId) {
        return;
      }
      
      try {
        // Fetch categories for the current menu
        await fetchCategoriesForMenu(currentMenuId, restaurant?.id);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    loadCategories();
  }, [fetchCategoriesForMenu, currentMenuId, restaurant]);
  
  // Use a ref to track the last data refresh time to prevent too frequent updates
  const lastRefreshTime = useRef<number>(Date.now());
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between visible refreshes
  
  // Reference to track categories that have been prefetched
  const prefetchedCategories = useRef<Set<number | null>>(new Set([null])); // Start with 'All Items' (null) prefetched
  
  // Filter categories to only show those for the current menu
  const activeCategories = useMemo(() => {
    return currentMenuId ? categories.filter(cat => cat.menu_id === currentMenuId) : [];
  }, [categories, currentMenuId]);
  
  // Separate useEffect to fetch menu items with backend filtering
  useEffect(() => {
    // Function to prefetch adjacent categories
    const prefetchAdjacentCategories = async () => {
      if (!validateRestaurantContext(restaurant)) return;
      
      // Get the current category index
      const allCategoryIds = [null, ...activeCategories.map(cat => cat.id)];
      const currentIndex = allCategoryIds.findIndex(id => id === selectedCategoryId);
      
      // Determine which adjacent categories to prefetch
      const categoriesToPrefetch: (number | null)[] = [];
      
      // Add the next category if it exists
      if (currentIndex < allCategoryIds.length - 1) {
        categoriesToPrefetch.push(allCategoryIds[currentIndex + 1]);
      }
      
      // Add the previous category if it exists
      if (currentIndex > 0) {
        categoriesToPrefetch.push(allCategoryIds[currentIndex - 1]);
      }
      
      // Prefetch data for adjacent categories in the background
      for (const categoryId of categoriesToPrefetch) {
        // Skip if already prefetched
        if (prefetchedCategories.current.has(categoryId)) continue;
        
        console.debug(`MenuPage: Prefetching data for category ${categoryId === null ? 'All Items' : categoryId}`);
        
        try {
          await fetchVisibleMenuItems(
            categoryId || undefined,
            restaurant?.id,
            showFeaturedOnly,
            showSeasonalOnly
          );
          
          // Mark as prefetched
          prefetchedCategories.current.add(categoryId);
        } catch (error) {
          console.error(`Error prefetching data for category ${categoryId}:`, error);
        }
      }
    };
    
    const loadMenuItems = async (forceShowLoading = false) => {
      // Validate restaurant context for tenant isolation
      // Use silent mode during initial load to reduce console noise
      const isInitialLoad = !restaurant;
      if (!validateRestaurantContext(restaurant, isInitialLoad)) {
        // Only log detailed warning if not in initial load
        if (!isInitialLoad) {
          logTenantIsolationWarning('MenuPage', 'Restaurant context missing, cannot fetch menu items');
        }
        return;
      }
      
      // Only show loading indicator if this is a user-initiated refresh or first load
      const shouldShowLoading = forceShowLoading || !initialLoadComplete.current;
      
      if (shouldShowLoading) {
        console.debug('MenuPage: Loading menu items with visible indicator');
        setLoading(true);
      } else {
        console.debug('MenuPage: Background refresh of menu items');
      }
      
      try {
        // Call the enhanced method with all filter parameters
        // The backend will now handle all filtering including featured and seasonal
        const items = await fetchVisibleMenuItems(
          selectedCategoryId || undefined, 
          restaurant?.id,
          showFeaturedOnly,
          showSeasonalOnly
        );
        
        // Mark this category as prefetched
        prefetchedCategories.current.add(selectedCategoryId);
        
        // Check if data has actually changed before updating state
        const hasDataChanged = JSON.stringify(items) !== JSON.stringify(menuItems);
        
        // Only update the UI if data changed and enough time has passed since last update
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime.current;
        
        if (hasDataChanged && (shouldShowLoading || timeSinceLastRefresh > MIN_REFRESH_INTERVAL)) {
          console.debug('MenuPage: Data changed, updating UI');
          setMenuItems(items);
          lastRefreshTime.current = now;
        } else if (hasDataChanged) {
          console.debug('MenuPage: Data changed but skipping UI update (too soon)');
        } else {
          console.debug('MenuPage: No data changes detected');
        }
        
        // If this is the first load, mark as complete
        if (!initialLoadComplete.current && items.length > 0) {
          initialLoadComplete.current = true;
          
          // After initial load, prefetch data for adjacent categories
          prefetchAdjacentCategories();
        }
      } catch (error) {
        console.error('Error fetching menu items:', error);
      } finally {
        if (shouldShowLoading) {
          setLoading(false);
        }
      }
    };
    
    // Check if WebSocket is connected before loading items
    const { websocketConnected } = useMenuStore.getState();
    
    if (websocketConnected) {
      console.debug('MenuPage: WebSocket connected, checking if data needs to be loaded');
      // If this category hasn't been prefetched yet, load it even with WebSocket connected
      if (!prefetchedCategories.current.has(selectedCategoryId)) {
        console.debug(`MenuPage: Category ${selectedCategoryId === null ? 'All Items' : selectedCategoryId} not prefetched, loading data`);
        loadMenuItems(true);
      } else if (!initialLoadComplete.current) {
        // Still need to show loading indicator until WebSocket provides data
        setLoading(true);
        // Set a timeout to hide loading indicator if WebSocket doesn't deliver data quickly
        const loadingTimeout = setTimeout(() => {
          if (loading) {
            console.debug('MenuPage: WebSocket data taking too long, falling back to API');
            loadMenuItems(true);
          }
        }, 3000); // Wait 3 seconds for WebSocket data before falling back
        
        return () => clearTimeout(loadingTimeout);
      }
    } else {
      // WebSocket not connected, fall back to API call
      console.debug('MenuPage: WebSocket not connected, using API fallback');
      loadMenuItems(true);
    }
    
    // Create a cleanup function to handle component unmounting
    return () => {
      console.debug('MenuPage: Cleaning up menu items effect');
    };
    
    // Only trigger refetch when filters or restaurant context changes
    // The polling will handle regular updates
  }, [fetchVisibleMenuItems, restaurant, selectedCategoryId, showFeaturedOnly, showSeasonalOnly, activeCategories]);

  // No need for frontend filtering anymore as we're using backend filtering

  // Memoize the selected category description to avoid redundant lookups
  const selectedCategoryDescription = useMemo(() => {
    return selectedCategoryId
      ? activeCategories.find(cat => cat.id === selectedCategoryId)?.description
      : null;
  }, [selectedCategoryId, activeCategories]);

  // Toggling filters
  function handleToggleFeatured(checked: boolean) {
    // If turning on "featured", turn off "seasonal"
    if (checked) {
      setShowSeasonalOnly(false);
    }
    setShowFeaturedOnly(checked);
  }
  function handleToggleSeasonal(checked: boolean) {
    // If turning on "seasonal", turn off "featured"
    if (checked) {
      setShowFeaturedOnly(false);
    }
    setShowSeasonalOnly(checked);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
        Our Menu
      </h1>

      {error && <p className="text-red-600">{error}</p>}

      {/* Horizontally scrollable categories */}
      <div className="mb-3">
        <div className="flex flex-nowrap space-x-3 overflow-x-auto py-2">
          {/* "All Items" button */}
          <button
            className={`
              flex-shrink-0 px-4 py-2 rounded-md
              ${selectedCategoryId === null 
                ? 'bg-[#0078d4] text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            `}
            onClick={() => setSelectedCategoryId(null)}
          >
            All Items
          </button>

          {/* Category buttons */}
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              className={`
                flex-shrink-0 px-4 py-2 rounded-md
                ${selectedCategoryId === cat.id
                  ? 'bg-[#0078d4] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
              `}
              onClick={() => setSelectedCategoryId(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Category Description - Only shown when a category is selected */}
      {selectedCategoryId && selectedCategoryDescription && (
        <div className="animate-fadeIn transition-all duration-300 mb-6">
          <div className="bg-white/80 backdrop-blur-sm border-l-2 border-[#0078d4]/70 rounded-lg px-4 py-3 sm:p-4 shadow-sm">
            <p className="text-gray-600 font-normal leading-relaxed text-sm sm:text-base">
              {selectedCategoryDescription}
            </p>
          </div>
        </div>
      )}

      {/* Layout Toggle and Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
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
        
        {/* Layout Toggle */}
        <LayoutToggle className="ml-auto" />
      </div>

      {/* Menu Items Grid with min-height to prevent layout shift */}
      <div className="min-h-[300px] transition-opacity duration-300 ease-in-out">
        {loading ? (
          // Show loading spinner while menu items are loading
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1902f]"></div>
          </div>
        ) : (
          <div className="animate-fadeIn transition-opacity duration-300">
            {menuItems.length > 0 ? (
              layoutType === 'gallery' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {menuItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <ListView 
                  menuItems={menuItems}
                  loading={false}
                  selectedCategoryId={selectedCategoryId}
                  showFeaturedOnly={showFeaturedOnly}
                  showSeasonalOnly={showSeasonalOnly}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
                <p className="text-gray-500 max-w-md">
                  {selectedCategoryId 
                    ? "There are no items in this category for the current menu." 
                    : "The current menu doesn't have any items yet."}
                </p>
                {(showFeaturedOnly || showSeasonalOnly) && (
                  <p className="text-gray-500 mt-2">
                    Try removing the filters to see more items.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MenuPage;
