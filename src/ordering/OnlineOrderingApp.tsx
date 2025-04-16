// src/ordering/OnlineOrderingApp.tsx

import React, { useEffect, Suspense, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { Hero } from './components/Hero';
import { MenuPage } from './components/MenuPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderConfirmation } from './components/OrderConfirmation';
import MerchandisePage from './components/MerchandisePage';
import AdminDashboard from './components/admin/AdminDashboard';
import { LoadingSpinner } from '../shared/components/ui';
import { LoyaltyTeaser } from './components/loyalty/LoyaltyTeaser';
import { LoginForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm, VerifyPhonePage } from '../shared/components/auth';
import { OrderHistory } from './components/profile/OrderHistory';
import { ProfilePage } from '../shared/components/profile';

import { useMenuStore } from './store/menuStore';
import { useCategoryStore } from './store/categoryStore';
import { useLoadingStore } from './store/loadingStore';
import { useMerchandiseStore } from './store/merchandiseStore';
import { MenuItem as MenuItemCard } from './components/MenuItem';
import { useSiteSettingsStore } from './store/siteSettingsStore'; // <-- IMPORTANT
import { useRestaurantStore } from '../shared/store/restaurantStore';
import { validateRestaurantContext } from '../shared/utils/tenantUtils';
import { MenuItem } from './types/menu';

import { ProtectedRoute, AnonymousRoute, PhoneVerificationRoute } from '../shared';

function OrderingLayout() {
  const loadingCount = useLoadingStore((state) => state.loadingCount);
  const [showSpinner, setShowSpinner] = React.useState(false);
  const [timerId, setTimerId] = React.useState<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (loadingCount > 0) {
      // Start a short timer so spinner doesn't show if loading is very quick
      if (!timerId) {
        const id = setTimeout(() => {
          setShowSpinner(true);
          setTimerId(null);
        }, 700);
        setTimerId(id);
      }
    } else {
      // No more loading → clear timer and hide spinner
      if (timerId) {
        clearTimeout(timerId);
        setTimerId(null);
      }
      setShowSpinner(false);
    }
  }, [loadingCount, timerId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      <main className="flex-grow tropical-pattern">
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      {showSpinner && (
        <div
          className="
            fixed top-0 left-0 w-screen h-screen
            bg-black bg-opacity-40 
            flex items-center justify-center
            z-[9999999]
          "
        >
          <div className="bg-gray-800 p-6 rounded shadow-lg flex flex-col items-center">
            <LoadingSpinner />
            <p className="mt-3 text-white font-semibold">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnlineOrderingApp() {
  const { fetchFeaturedItems } = useMenuStore();
  const { fetchSiteSettings } = useSiteSettingsStore(); // <-- destructure the store method
  const { fetchCollections } = useMerchandiseStore();
  const { restaurant } = useRestaurantStore();
  
  // State for featured items and loading state
  const [featuredItems, setFeaturedItems] = useState<MenuItem[]>([]);
  const [featuredItemsLoading, setFeaturedItemsLoading] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection as soon as the app loads
    if (validateRestaurantContext(restaurant)) {
      console.debug('OnlineOrderingApp: Initializing WebSocket connection for menu items');
      const { startMenuItemsWebSocket } = useMenuStore.getState();
      startMenuItemsWebSocket();
      
      // Prefetch all menu items data when the app initializes
      prefetchMenuData();
    }
  }, [restaurant]);
  
  // Function to prefetch menu data at app initialization
  const prefetchMenuData = async () => {
    if (!validateRestaurantContext(restaurant)) {
      console.warn('OnlineOrderingApp: Restaurant context missing, cannot prefetch menu data');
      return;
    }
    
    try {
      console.debug('OnlineOrderingApp: Prefetching menu data at app initialization');
      
      // Get menu store methods
      const { fetchVisibleMenuItems, fetchMenus } = useMenuStore.getState();
      const { fetchCategoriesForMenu } = useCategoryStore.getState();
      
      // 1. Fetch menus first to get the current menu ID
      await fetchMenus();
      
      // 2. Get the current menu ID after fetching menus
      const { currentMenuId } = useMenuStore.getState();
      
      if (currentMenuId) {
        // 3. Fetch categories for the current menu
        await fetchCategoriesForMenu(currentMenuId, restaurant?.id);
        
        // 4. Prefetch "All Items" view (no category filter)
        console.debug('OnlineOrderingApp: Prefetching "All Items" view');
        await fetchVisibleMenuItems(undefined, restaurant?.id, false, false);
        
        // 5. Get categories after they've been fetched
        const { categories } = useCategoryStore.getState();
        const menuCategories = categories.filter((cat: { menu_id: number; id: number; name: string }) => cat.menu_id === currentMenuId);
        
        // 6. Prefetch first few categories (limit to 3 to avoid too many requests)
        const categoriesToPrefetch = menuCategories.slice(0, 3);
        
        for (const category of categoriesToPrefetch) {
          console.debug(`OnlineOrderingApp: Prefetching data for category ${category.name}`);
          await fetchVisibleMenuItems(category.id, restaurant?.id, false, false);
        }
        
        console.debug('OnlineOrderingApp: Menu data prefetching complete');
      }
    } catch (error) {
      console.error('Error prefetching menu data:', error);
    }
  };

  useEffect(() => {
    // Load featured items with optimized backend filtering
    const loadFeaturedItems = async () => {
      // Validate restaurant context for tenant isolation
      if (!validateRestaurantContext(restaurant)) {
        console.warn('OnlineOrderingApp: Restaurant context missing, cannot fetch featured items');
        return;
      }
      
      setFeaturedItemsLoading(true);
      try {
        // Use optimized backend filtering instead of loading all items
        // Pass the restaurant ID if available, otherwise the utility will try to get it from localStorage
        const items = await fetchFeaturedItems(restaurant?.id);
        setFeaturedItems(items);
      } catch (error) {
        console.error('Error fetching featured items:', error);
      } finally {
        setFeaturedItemsLoading(false);
      }
    };
    
    loadFeaturedItems();
    fetchSiteSettings();     // load hero/spinner image URLs
    fetchCollections();      // load merchandise collections
  }, [fetchFeaturedItems, fetchSiteSettings, fetchCollections, restaurant]);

  // Take only the first 4 featured items for display
  const featuredSlice = featuredItems.slice(0, 4);

  return (
    <Routes>
      <Route element={<OrderingLayout />}>
        {/* index => "/" => hero & popular items */}
        <Route
          index
          element={
            <>
              <Hero />
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {featuredItemsLoading ? (
                  // Show loading spinner while featured items are loading
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1902f]"></div>
                  </div>
                ) : featuredItems.length > 0 ? (
                  // Show Popular Items with heading outside the grid
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-display text-gray-900 mb-8">
                      Popular Items
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          {featuredSlice.map((item) => (
                            <MenuItemCard key={item.id} item={item} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <LoyaltyTeaser />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Center the Loyalty Teaser when no featured items exist
                  <div className="max-w-md mx-auto">
                    <LoyaltyTeaser />
                  </div>
                )}
              </div>
            </>
          }
        />

        {/* /menu => the MenuPage */}
        <Route path="menu" element={<MenuPage />} />
        
        {/* /merchandise => the MerchandisePage */}
        <Route path="merchandise" element={<MerchandisePage />} />

        {/* /cart => Cart */}
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation" element={<OrderConfirmation />} />

        {/* Admin only => /admin */}
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Auth */}
        <Route path="login" element={
          <AnonymousRoute>
            <LoginForm />
          </AnonymousRoute>
        } />
        <Route path="signup" element={
          <AnonymousRoute>
            <SignUpForm />
          </AnonymousRoute>
        } />
        <Route path="forgot-password" element={
          <AnonymousRoute>
            <ForgotPasswordForm />
          </AnonymousRoute>
        } />
        <Route path="reset-password" element={<ResetPasswordForm />} />

        {/* Phone verification */}
        <Route path="verify-phone" element={
          <PhoneVerificationRoute>
            <VerifyPhonePage />
          </PhoneVerificationRoute>
        } />

        {/* Protected user pages => /orders, /profile */}
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <OrderHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* If unknown => redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
