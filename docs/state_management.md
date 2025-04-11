# Frontend State Management

This document provides a comprehensive overview of the state management approach used in the Hafaloha frontend application.

## Overview

Hafaloha uses Zustand as its primary state management solution, complemented by React Query for server state management. This approach provides:

- **Simplicity**: Minimal boilerplate compared to Redux
- **Flexibility**: Easy integration with React hooks
- **Performance**: Efficient updates with minimal re-renders
- **TypeScript Support**: Strong typing for state and actions
- **Server State Separation**: Clear distinction between client and server state

## Zustand Stores

The application is organized into domain-specific stores that manage different aspects of the application state:

### Core Stores

1. **Auth Store**: Manages user authentication state
2. **Restaurant Store**: Manages the current restaurant context
3. **Site Settings Store**: Manages application-wide settings
4. **Notification Store**: Manages user notifications

### Feature-specific Stores

1. **Menu Store**: Manages menu items, categories, and active menu
2. **Order Store**: Manages cart and order state
3. **Merchandise Store**: Manages merchandise items, collections, and categories
4. **Reservation Store**: Manages reservation state and availability

## Store Implementation Pattern

All stores follow a consistent implementation pattern:

```tsx
// Example store pattern (src/ordering/store/menuStore.ts)
import create from 'zustand';
import { fetchMenuItems, fetchCategories } from '../../shared/api/endpoints/menuItems';
import { MenuItem, Category } from '../types/menu';

interface MenuState {
  // State properties
  items: MenuItem[];
  categories: Category[];
  activeCategory: number | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchItems: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  setActiveCategory: (categoryId: number | null) => void;
  updateItem: (id: number, data: Partial<MenuItem>) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  // Initial state
  items: [],
  categories: [],
  activeCategory: null,
  isLoading: false,
  error: null,
  
  // Actions
  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await fetchMenuItems();
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const categories = await fetchCategories();
      set({ categories, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  setActiveCategory: (categoryId) => {
    set({ activeCategory: categoryId });
  },
  
  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      // API call to update item
      await updateMenuItem(id, data);
      
      // Update local state
      const items = get().items.map(item => 
        item.id === id ? { ...item, ...data } : item
      );
      
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
```

## Auth Store

The Auth Store manages user authentication state and provides methods for login, logout, and token management:

```tsx
// src/shared/auth/authStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';
import { login, refreshToken, logout } from '../api/endpoints/auth';
import { User } from '../types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await login(email, password);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error.message,
            isLoading: false,
            isAuthenticated: false
          });
        }
      },
      
      logout: async () => {
        set({ isLoading: true });
        try {
          await logout();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error.message,
            isLoading: false
          });
        }
      },
      
      refreshToken: async () => {
        if (!get().token) return;
        
        set({ isLoading: true });
        try {
          const response = await refreshToken(get().token);
          set({
            token: response.token,
            isLoading: false
          });
        } catch (error) {
          // If token refresh fails, log the user out
          get().logout();
        }
      },
      
      setUser: (user) => {
        set({ user });
      }
    }),
    {
      name: 'auth-storage', // name of the item in localStorage
      getStorage: () => localStorage, // storage to use
      partialize: (state) => ({ user: state.user, token: state.token }), // only persist these fields
    }
  )
);
```

## Restaurant Store

The Restaurant Store manages the current restaurant context:

```tsx
// src/shared/store/restaurantStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchRestaurant, updateRestaurant } from '../api/endpoints/restaurants';
import { Restaurant } from '../types/restaurant';

interface RestaurantState {
  restaurant: Restaurant | null;
  isLoading: boolean;
  error: string | null;
  
  fetchRestaurant: (id: number) => Promise<void>;
  updateRestaurant: (data: Partial<Restaurant>) => Promise<void>;
  setRestaurant: (restaurant: Restaurant) => void;
}

export const useRestaurantStore = create<RestaurantState>(
  persist(
    (set, get) => ({
      restaurant: null,
      isLoading: false,
      error: null,
      
      fetchRestaurant: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const restaurant = await fetchRestaurant(id);
          set({ restaurant, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      updateRestaurant: async (data) => {
        if (!get().restaurant) return;
        
        set({ isLoading: true, error: null });
        try {
          const updatedRestaurant = await updateRestaurant(get().restaurant.id, data);
          set({ restaurant: updatedRestaurant, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      setRestaurant: (restaurant) => {
        set({ restaurant });
      }
    }),
    {
      name: 'restaurant-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({ restaurant: state.restaurant }),
    }
  )
);
```

## Site Settings Store

The Site Settings Store manages application-wide settings:

```tsx
// src/ordering/store/siteSettingsStore.ts
import create from 'zustand';
import { fetchSiteSettings, updateSiteSettings } from '../../shared/api/endpoints/siteSettings';
import { SiteSettings } from '../types/siteSettings';

interface SiteSettingsState {
  settings: SiteSettings | null;
  isLoading: boolean;
  error: string | null;
  
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<SiteSettings>) => Promise<void>;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,
  
  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await fetchSiteSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  updateSettings: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const updatedSettings = await updateSiteSettings(data);
      set({ settings: updatedSettings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
```

## Notification Store

The Notification Store manages user notifications:

```tsx
// src/ordering/store/notificationStore.ts
import create from 'zustand';
import { fetchNotifications, markAsRead } from '../../shared/api/endpoints/notifications';
import { Notification } from '../types/notification';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  
  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await fetchNotifications();
      const unreadCount = notifications.filter(n => !n.read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  markAsRead: async (id) => {
    try {
      await markAsRead(id);
      
      const notifications = get().notifications.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      );
      
      const unreadCount = notifications.filter(n => !n.read).length;
      set({ notifications, unreadCount });
    } catch (error) {
      set({ error: error.message });
    }
  },
  
  markAllAsRead: async () => {
    try {
      await Promise.all(
        get().notifications
          .filter(n => !n.read)
          .map(n => markAsRead(n.id))
      );
      
      const notifications = get().notifications.map(notification => ({
        ...notification,
        read: true
      }));
      
      set({ notifications, unreadCount: 0 });
    } catch (error) {
      set({ error: error.message });
    }
  },
  
  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications];
    const unreadCount = notifications.filter(n => !n.read).length;
    set({ notifications, unreadCount });
  }
}));
```

## Order Store

The Order Store manages cart and order state:

```tsx
// src/ordering/store/orderStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  createOrder, 
  fetchOrders, 
  fetchOrderById 
} from '../../shared/api/endpoints/orders';
import { Order, CartItem, OrderStatus } from '../types/order';

interface OrderState {
  // Cart state
  cartItems: CartItem[];
  cartTotal: number;
  
  // Orders state
  orders: Order[];
  currentOrder: Order | null;
  isLoading: boolean;
  error: string | null;
  
  // Cart actions
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: number) => void;
  updateCartItemQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  
  // Order actions
  createOrder: (orderData: Partial<Order>) => Promise<Order>;
  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: number) => Promise<void>;
}

export const useOrderStore = create<OrderState>(
  persist(
    (set, get) => ({
      // Initial cart state
      cartItems: [],
      cartTotal: 0,
      
      // Initial orders state
      orders: [],
      currentOrder: null,
      isLoading: false,
      error: null,
      
      // Cart actions
      addToCart: (item) => {
        const cartItems = [...get().cartItems];
        const existingItemIndex = cartItems.findIndex(
          i => i.id === item.id && 
               JSON.stringify(i.options) === JSON.stringify(item.options)
        );
        
        if (existingItemIndex >= 0) {
          // Update quantity if item already exists
          cartItems[existingItemIndex].quantity += item.quantity;
        } else {
          // Add new item
          cartItems.push(item);
        }
        
        const cartTotal = cartItems.reduce(
          (total, item) => total + (item.price * item.quantity), 
          0
        );
        
        set({ cartItems, cartTotal });
      },
      
      removeFromCart: (itemId) => {
        const cartItems = get().cartItems.filter(item => item.id !== itemId);
        const cartTotal = cartItems.reduce(
          (total, item) => total + (item.price * item.quantity), 
          0
        );
        
        set({ cartItems, cartTotal });
      },
      
      updateCartItemQuantity: (itemId, quantity) => {
        const cartItems = get().cartItems.map(item => 
          item.id === itemId ? { ...item, quantity } : item
        );
        
        const cartTotal = cartItems.reduce(
          (total, item) => total + (item.price * item.quantity), 
          0
        );
        
        set({ cartItems, cartTotal });
      },
      
      clearCart: () => {
        set({ cartItems: [], cartTotal: 0 });
      },
      
      // Order actions
      createOrder: async (orderData) => {
        set({ isLoading: true, error: null });
        try {
          const order = await createOrder({
            ...orderData,
            items: get().cartItems
          });
          
          // Clear cart after successful order
          get().clearCart();
          
          // Update orders list
          const orders = [order, ...get().orders];
          set({ orders, currentOrder: order, isLoading: false });
          
          return order;
        } catch (error) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },
      
      fetchOrders: async () => {
        set({ isLoading: true, error: null });
        try {
          const orders = await fetchOrders();
          set({ orders, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      fetchOrderById: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const order = await fetchOrderById(id);
          set({ currentOrder: order, isLoading: false });
        } catch (error) {
          set({ error: error.message, isLoading: false });
        }
      }
    }),
    {
      name: 'order-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({ cartItems: state.cartItems, cartTotal: state.cartTotal }),
    }
  )
);
```

## Custom Hooks for Store Access

To simplify store access and provide additional functionality, custom hooks are created for each store:

```tsx
// src/ordering/hooks/useMenu.ts
import { useEffect } from 'react';
import { useMenuStore } from '../store/menuStore';

export const useMenu = (categoryId?: number) => {
  const {
    items,
    categories,
    activeCategory,
    isLoading,
    error,
    fetchItems,
    fetchCategories,
    setActiveCategory
  } = useMenuStore();
  
  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [fetchItems, fetchCategories]);
  
  useEffect(() => {
    if (categoryId) {
      setActiveCategory(categoryId);
    }
  }, [categoryId, setActiveCategory]);
  
  // Filter items by active category
  const filteredItems = activeCategory
    ? items.filter(item => item.category_id === activeCategory)
    : items;
  
  return {
    items: filteredItems,
    categories,
    activeCategory,
    isLoading,
    error,
    setActiveCategory
  };
};
```

## React Query for Server State

For server state management, React Query is used to handle data fetching, caching, and synchronization:

```tsx
// src/shared/hooks/useMenuItems.ts
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  fetchMenuItems, 
  fetchMenuItem, 
  updateMenuItem 
} from '../api/endpoints/menuItems';

export const useMenuItems = (categoryId?: number) => {
  return useQuery(
    ['menuItems', { categoryId }],
    () => fetchMenuItems(categoryId),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true
    }
  );
};

export const useMenuItem = (id: number) => {
  return useQuery(
    ['menuItem', id],
    () => fetchMenuItem(id),
    {
      staleTime: 5 * 60 * 1000,
      enabled: !!id
    }
  );
};

export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: number; data: any }) => updateMenuItem(id, data),
    {
      onSuccess: (updatedItem) => {
        // Update the cache for the individual item
        queryClient.setQueryData(['menuItem', updatedItem.id], updatedItem);
        
        // Update the item in the menuItems list
        queryClient.setQueriesData(['menuItems'], (oldData: any) => {
          if (!oldData) return oldData;
          
          return oldData.map((item: any) => 
            item.id === updatedItem.id ? updatedItem : item
          );
        });
      }
    }
  );
};
```

## Integration with Components

Stores and hooks are integrated with components:

```tsx
// src/ordering/components/MenuPage.tsx
import React from 'react';
import { useMenu } from '../hooks/useMenu';
import { useParams } from 'react-router-dom';
import MenuItem from './MenuItem';
import CategoryFilter from './CategoryFilter';
import LoadingSpinner from '../../shared/components/ui/LoadingSpinner';
import ErrorMessage from '../../shared/components/ui/ErrorMessage';

const MenuPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId?: string }>();
  const { 
    items, 
    categories, 
    activeCategory, 
    isLoading, 
    error, 
    setActiveCategory 
  } = useMenu(categoryId ? parseInt(categoryId) : undefined);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return <ErrorMessage message={error} />;
  }
  
  return (
    <div className="menu-page">
      <h1>Our Menu</h1>
      
      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />
      
      <div className="menu-items-grid">
        {items.map(item => (
          <MenuItem key={item.id} item={item} />
        ))}
        
        {items.length === 0 && (
          <p className="no-items-message">
            No menu items found in this category.
          </p>
        )}
      </div>
    </div>
  );
};

export default MenuPage;
```

## Store Composition

For complex features, multiple stores can be composed together:

```tsx
// src/ordering/components/checkout/CheckoutPage.tsx
import React, { useState } from 'react';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../../shared/auth/authStore';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { usePromoCodeStore } from '../../store/promoCodeStore';
import { useStoreCredit } from '../../hooks/useStoreCredit';
import CheckoutForm from './CheckoutForm';
import OrderSummary from './OrderSummary';
import PaymentMethods from './PaymentMethods';

const CheckoutPage: React.FC = () => {
  const { cartItems, cartTotal, createOrder } = useOrderStore();
  const { user, isAuthenticated } = useAuthStore();
  const { restaurant } = useRestaurantStore();
  const { applyPromoCode, activePromoCode, discount } = usePromoCodeStore();
  const { storeCredit, applyStoreCredit } = useStoreCredit();
  
  const [paymentMethod, setPaymentMethod] = useState<string>('credit_card');
  const [contactInfo, setContactInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  
  const handleCheckout = async () => {
    try {
      const order = await createOrder({
        contact_name: contactInfo.name,
        contact_email: contactInfo.email,
        contact_phone: contactInfo.phone,
        payment_method: paymentMethod,
        promo_code_id: activePromoCode?.id,
        store_credit_amount: storeCredit.appliedAmount,
        restaurant_id: restaurant?.id
      });
      
      // Redirect to order confirmation page
      window.location.href = `/order-confirmation/${order.id}`;
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  };
  
  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      
      <div className="checkout-container">
        <div className="checkout-form-container">
          <CheckoutForm
            contactInfo={contactInfo}
            setContactInfo={setContactInfo}
            isAuthenticated={isAuthenticated}
          />
          
          <PaymentMethods
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            storeCredit={storeCredit}
            onApplyStoreCredit={applyStoreCredit}
          />
        </div>
        
        <OrderSummary
          items={cartItems}
          subtotal={cartTotal}
          discount={discount}
          storeCreditAmount={storeCredit.appliedAmount}
          promoCode={activePromoCode}
          onApplyPromoCode={applyPromoCode}
          onCheckout={handleCheckout}
        />
      </div>
    </div>
  );
};

export default CheckoutPage;
```

## State Persistence

Zustand's persist middleware is used to persist state across page reloads:

```tsx
// Example of persisted state
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface PersistentState {
  value: string;
  setValue: (value: string) => void;
}

export const usePersistentStore = create<PersistentState>(
  persist(
    (set) => ({
      value: '',
      setValue: (value) => set({ value })
    }),
    {
      name: 'persistent-storage', // localStorage key
      getStorage: () => localStorage, // storage to use
      partialize: (state) => ({ value: state.value }), // only persist these fields
    }
  )
);
```

## State Debugging

For debugging state, the Zustand devtools middleware can be used:

```tsx
// Example of devtools integration
import create from 'zustand';
import { devtools } from 'zustand/middleware';

interface DebugState {
  count: number;
  increment: () => void;
}

export const useDebugStore = create<DebugState>(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }))
    }),
    {
      name: 'Debug Store', // name in Redux DevTools
    }
  )
);
```

## Best Practices

When working with state management in Hafaloha, follow these best practices:

1. **Use the Right Tool for the Job**:
   - Use Zustand for client state that needs to be shared across components
   - Use React Query for server state (data fetching, caching, synchronization)
   - Use React's useState for component-local state

2. **Keep Stores Focused**:
   - Each store should manage a specific domain of the application
   - Avoid creating a single monolithic store

3. **Normalize State**:
   - Avoid deeply nested state structures
   - Use normalized state for collections of items

4. **Minimize State Updates**:
   - Only update what has changed
   - Use selectors to access specific parts of the state

5. **Handle Async Operations Consistently**:
   - Always set loading and error states
   - Use try/catch blocks for error handling

6. **Persist Only What's Necessary**:
   - Only persist state that needs to survive page reloads
   - Use the partialize option to exclude sensitive or temporary data

7. **Use TypeScript**:
   - Define clear interfaces for state and actions
   - Leverage TypeScript to catch errors at compile time

## Troubleshooting

Common issues and their solutions:

1. **State Not Updating**: Ensure you're using the setter functions from the store, not modifying state directly.

2. **Component Not Re-rendering**: Check if you're selecting the specific state slice that's changing.

3. **Persisted State Issues**: Clear localStorage if you've made significant changes to the store structure.

4. **Type Errors**: Ensure your TypeScript interfaces are up to date with the actual state structure.

5. **Performance Issues**: Use selectors to minimize re-renders and only access the state you need.

## Future Enhancements

Planned enhancements for state management:

1. **Middleware for Analytics**: Track state changes for analytics purposes
2. **Optimistic Updates**: Implement optimistic updates for better UX
3. **State Synchronization**: Sync state across tabs/windows
4. **State Validation**: Validate state changes against schemas
5. **State Migration**: Handle state migrations for breaking changes
