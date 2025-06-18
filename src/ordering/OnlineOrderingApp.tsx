// src/ordering/OnlineOrderingApp.tsx

import React, { useEffect, Suspense, useState } from 'react';
import { Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';

import { Hero } from './components/Hero';
import { MenuPage } from './components/MenuPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderConfirmation } from './components/OrderConfirmation';
import MerchandisePage from './components/MerchandisePage';
import AdminDashboard from './components/admin/AdminDashboard';
import { LoadingSpinner } from '../shared/components/ui';
import { LoginForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm, VerifyPhonePage } from '../shared/components/auth';
import { OrderHistory } from './components/profile/OrderHistory';
import { ProfilePage } from '../shared/components/profile';

import { useMenuStore } from './store/menuStore';
import { useCategoryStore } from './store/categoryStore';
import { useLoadingStore } from './store/loadingStore';
import { useAuthStore } from './store/authStore';
import { useMerchandiseStore } from './store/merchandiseStore';
import { MenuItem as MenuItemCard } from './components/MenuItem';
import { useSiteSettingsStore } from './store/siteSettingsStore'; // <-- IMPORTANT
import { useRestaurantStore } from '../shared/store/restaurantStore';
import { useMenuLayoutStore } from './store/menuLayoutStore';
import { validateRestaurantContext } from '../shared/utils/tenantUtils';
import type { MenuItem, MenuItemFilterParams } from './types/menu';

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
  const { initializeLayout } = useMenuLayoutStore();
  
  // State for featured items and loading state
  const [featuredItems, setFeaturedItems] = useState<MenuItem[]>([]);
  const [featuredItemsLoading, setFeaturedItemsLoading] = useState(false);

  // Initialize menu layout preferences based on restaurant settings
  useEffect(() => {
    if (restaurant?.id) {
      console.debug('OnlineOrderingApp: Initializing menu layout preferences');
      initializeLayout(restaurant.id);
    }
  }, [restaurant?.id, initializeLayout]);

  useEffect(() => {
    // Initialize WebSocket connection as soon as the app loads
    // Use silent mode during initial load to reduce console noise
    const isInitialLoad = !restaurant;
    if (validateRestaurantContext(restaurant, isInitialLoad)) {
      console.debug('OnlineOrderingApp: Initializing WebSocket connection for menu items');
      const { startMenuItemsWebSocket, stopInventoryPolling } = useMenuStore.getState();
      
      // Ensure any existing polling is stopped before starting WebSocket
      stopInventoryPolling();
      
      // Only initialize WebSocket if user is authenticated
      const user = useAuthStore.getState().user;
      const isAuthenticated = !!user;
      
      if (isAuthenticated) {
        // Initialize WebSocketManager with restaurant ID for proper tenant isolation
        import('../shared/services/WebSocketManager').then(({ default: webSocketManager }) => {
          if (restaurant && restaurant.id) {
            webSocketManager.initialize(restaurant.id.toString());
            startMenuItemsWebSocket();
          }
        });
      } else {
        console.debug('OnlineOrderingApp: Skipping WebSocket initialization for unauthenticated user');
      }
      
      // Prefetch all menu items data when the app initializes
      prefetchMenuData();
      
      // Double-check that polling is stopped after WebSocket connection
      setTimeout(() => {
        if (useMenuStore.getState().inventoryPollingInterval !== null) {
          console.debug('OnlineOrderingApp: Stopping lingering inventory polling after WebSocket connection');
          stopInventoryPolling();
        }
      }, 1000);
      
      return () => {
        console.debug('OnlineOrderingApp: Cleaning up WebSocket connection');
        stopInventoryPolling();
      };
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
      const { 
        fetchVisibleMenuItems, 
        fetchMenus, 
        fetchMenuItemsForAdmin 
      } = useMenuStore.getState();
      const { fetchCategoriesForMenu } = useCategoryStore.getState();
      const { user } = useAuthStore.getState();
      
      // Check if user has admin privileges
      const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
      
      // 1. Fetch menus first to get the current menu ID
      await fetchMenus();
      
      // 2. Get the current menu ID after fetching menus
      const { currentMenuId } = useMenuStore.getState();
      
      if (currentMenuId) {
        // 3. Fetch categories for the current menu
        await fetchCategoriesForMenu(currentMenuId, restaurant?.id);
        
        // 4. Prefetch data for customer-facing menu page
        console.debug('OnlineOrderingApp: Prefetching customer-facing menu data');
        
        // 4a. Prefetch "All Items" view (no category filter)
        await fetchVisibleMenuItems(undefined, restaurant?.id, false, false);
        
        // 4b. Get categories after they've been fetched
        const { categories } = useCategoryStore.getState();
        const menuCategories = categories.filter((cat: { menu_id: number; id: number; name: string }) => 
          cat.menu_id === currentMenuId
        );
        
        // 4c. Prefetch first few categories (limit to 3 to avoid too many requests)
        const categoriesToPrefetch = menuCategories.slice(0, 3);
        
        for (const category of categoriesToPrefetch) {
          console.debug(`OnlineOrderingApp: Prefetching customer data for category ${category.name}`);
          await fetchVisibleMenuItems(category.id, restaurant?.id, false, false);
        }
        
        // 5. Only prefetch admin data if the user has admin privileges
        if (isAdmin) {
          console.debug('OnlineOrderingApp: Prefetching admin menu data');
          
          // 5a. Prefetch admin "All Items" view with stock information
          const adminFilterParams: MenuItemFilterParams = {
            view_type: 'admin' as 'admin',
            include_stock: true,
            restaurant_id: restaurant?.id,
            menu_id: currentMenuId
          };
          
          await fetchMenuItemsForAdmin(adminFilterParams);
          
          // 5b. Prefetch first category for admin view
          if (categoriesToPrefetch.length > 0) {
            const firstCategory = categoriesToPrefetch[0];
            const adminCategoryParams = {
              ...adminFilterParams,
              category_id: firstCategory.id
            };
            
            console.debug(`OnlineOrderingApp: Prefetching admin data for category ${firstCategory.name}`);
            await fetchMenuItemsForAdmin(adminCategoryParams);
          }
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
      // Use silent mode during initial load to reduce console noise
      const isInitialLoad = !restaurant;
      if (!validateRestaurantContext(restaurant, isInitialLoad)) {
        // Only log warning if not in initial load
        if (!isInitialLoad) {
          console.warn('OnlineOrderingApp: Restaurant context missing, cannot fetch featured items');
        }
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

  // We no longer need to slice the featured items as we're showing all of them in the grid

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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shimizu-blue"></div>
                  </div>
                ) : featuredItems.length > 0 ? (
                  // Show Popular Items with an improved layout
                  <div className="animate-fadeIn">
                    <div className="flex items-center justify-between mb-8">
                      <div className="relative">
                        <h2 className="text-2xl sm:text-3xl font-display text-gray-900 relative z-10">
                          Popular Items
                        </h2>
                        <div className="absolute bottom-0 left-0 h-3 w-48 bg-shimizu-blue opacity-20 rounded-full"></div>
                      </div>
                      <Link 
                        to="/menu" 
                        className="text-sm font-medium text-shimizu-blue hover:text-shimizu-light-blue transition-colors flex items-center"
                      >
                        View All
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {featuredItems.map((item) => (
                        <div key={item.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden border border-gray-100 hover:border-gray-200">
                          <MenuItemCard item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Enhanced empty state with visual elements and better layout - Shimizu Technology version
                  <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto animate-fadeIn">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-8">
                        <div className="relative">
                          <h2 className="text-2xl sm:text-3xl font-display text-gray-900 relative z-10">
                            Explore Our Order Suite
                          </h2>
                          <div className="absolute bottom-0 left-0 h-3 w-48 bg-shimizu-blue opacity-20 rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center">
                          <div className="md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
                            <div className="bg-shimizu-blue bg-opacity-10 rounded-full p-4 w-16 h-16 mb-6 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-shimizu-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Authentic Japanese Cuisine</h3>
                            <p className="text-gray-600 mb-6">
                              Discover a variety of authentic Japanese dishes crafted with fresh ingredients and traditional techniques with a modern twist.
                            </p>
                            <div className="mt-2">
                              <Link
                                to="/menu"
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-shimizu-blue hover:bg-shimizu-light-blue transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                              >
                                View Full Menu
                              </Link>
                            </div>
                          </div>
                          <div className="md:w-1/2 bg-gray-50 p-6 md:p-0 flex items-center justify-center">
                            <div className="grid grid-cols-2 gap-3 p-6">
                              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                                <div className="w-8 h-8 bg-shimizu-blue bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-shimizu-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Signature Dishes</span>
                              </div>
                              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                                <div className="w-8 h-8 bg-shimizu-blue bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-shimizu-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Quick Order</span>
                              </div>
                              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                                <div className="w-8 h-8 bg-shimizu-blue bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-shimizu-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Easy Checkout</span>
                              </div>
                              <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                                <div className="w-8 h-8 bg-shimizu-blue bg-opacity-20 rounded-full flex items-center justify-center mb-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-shimizu-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-700">Seasonal Specials</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
