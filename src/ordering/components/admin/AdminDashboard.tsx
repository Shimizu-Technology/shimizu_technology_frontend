// src/ordering/components/admin/AdminDashboard.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
// These components are used in the JSX but TypeScript doesn't detect it
/* eslint-disable @typescript-eslint/no-unused-vars */
import { MenuManager } from './MenuManager';
import { OrderManager } from './OrderManager';
import { PromoManager } from './PromoManager';
import { AnalyticsManager } from './AnalyticsManager';
import { SettingsManager } from './SettingsManager';
import MerchandiseManager from './MerchandiseManager';
import { StaffManagement } from './StaffManagement';
import RestaurantSelector from './RestaurantSelector';
import NotificationContainer from '../../../shared/components/notifications/NotificationContainer';
/* eslint-enable @typescript-eslint/no-unused-vars */

import notificationStore from '../../store/notificationStore';

// Add global type declaration for our toast tracking
declare global {
  interface Window {
    orderToastIds?: {
      [orderId: string]: string[];
    };
  }
}

import {
  BarChart2,
  ShoppingBag,
  LayoutGrid,
  Tag,
  Sliders,
  X as XIcon,
  ShoppingCart,
  // Bell, // Commented out - not currently using stock notifications
  Package,
  Users
} from 'lucide-react';
import AcknowledgeAllButton from '../../../shared/components/notifications/AcknowledgeAllButton';
import { api } from '../../lib/api';
import toastUtils from '../../../shared/utils/toastUtils';
import { useAuthStore } from '../../store/authStore';
import webSocketManager from '../../../shared/services/WebSocketManager';
import { Navigate } from 'react-router-dom';
import useNotificationStore from '../../store/notificationStore';
import { Order } from '../../types/order';
import { MenuItem } from '../../types/menu';
import { useMenuStore } from '../../store/menuStore';
import { useOrderStore } from '../../store/orderStore';
import { calculateAvailableQuantity } from '../../utils/inventoryUtils';
import useWebSocket from '../../../shared/hooks/useWebSocket';

type Tab = 'analytics' | 'orders' | 'menu' | 'promos' | 'settings' | 'merchandise' | 'staff';

export function AdminDashboard() {
  const { user } = useAuthStore();
  const authStore = useAuthStore();
  const [currentRestaurantId, setCurrentRestaurantId] = useState<string | undefined>(
    user?.restaurant_id
  );
  
  // Direct role check as a fallback
  const directRoleCheck = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'staff';
  
  // Redirect if user doesn't have access - use direct role check as a fallback
  const hasAccess = user && (directRoleCheck || authStore.isSuperAdmin() || authStore.isAdmin() || authStore.isStaff());
  
  // Check if user is staff only (not admin or super_admin)
  const isStaffOnly = user && authStore.isStaff() && !authStore.isAdmin() && !authStore.isSuperAdmin();
  
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  // List of tabs with role-based access controls
  const tabs = [
    // Analytics - visible to admin and super_admin only
    ...(authStore.isSuperAdmin() || authStore.isAdmin() ? [{ id: 'analytics', label: 'Analytics', icon: BarChart2 }] : []),
    // Orders - visible to all admin roles (including staff)
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    // Menu - visible to admin and super_admin only
    ...(authStore.isSuperAdmin() || authStore.isAdmin() ? [{ id: 'menu', label: 'Menu', icon: LayoutGrid }] : []),
    // Merchandise - visible to admin and super_admin only
    ...(authStore.isSuperAdmin() || authStore.isAdmin() ? [{ id: 'merchandise', label: 'Merchandise', icon: ShoppingCart }] : []),
    // Promos - visible to admin and super_admin only
    ...(authStore.isSuperAdmin() || authStore.isAdmin() ? [{ id: 'promos', label: 'Promos', icon: Tag }] : []),
    // Staff - visible to admin and super_admin only
    ...(authStore.isSuperAdmin() || authStore.isAdmin() ? [{ id: 'staff', label: 'Staff', icon: Users }] : []),
    // Settings - visible to admin and super_admin
    ...((authStore.isSuperAdmin() || authStore.isAdmin()) ? [{ id: 'settings', label: 'Settings', icon: Sliders }] : []),
  ] as const;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // For staff users, always default to orders tab
    if (isStaffOnly) {
      return 'orders';
    }
    
    // For admin/super_admin, check stored preference
    const stored = localStorage.getItem('adminTab');
    if (stored && ['analytics','orders','menu','merchandise','promos','staff','settings'].includes(stored)) {
      // Check if the user has access to the stored tab
      if (
        (stored === 'analytics' && (authStore.isSuperAdmin() || authStore.isAdmin())) ||
        (stored === 'orders') ||
        (stored === 'menu' && (authStore.isSuperAdmin() || authStore.isAdmin())) ||
        (stored === 'merchandise' && (authStore.isSuperAdmin() || authStore.isAdmin())) ||
        (stored === 'promos' && (authStore.isSuperAdmin() || authStore.isAdmin())) ||
        (stored === 'staff' && (authStore.isSuperAdmin() || authStore.isAdmin())) ||
        (stored === 'settings' && (authStore.isSuperAdmin() || authStore.isAdmin()))
      ) {
        return stored as Tab;
      }
    }
    // Default to orders for staff, analytics for admin/super_admin
    return authStore.isStaff() ? 'orders' : 'analytics';
  });

  function handleTabClick(id: Tab) {
    // If switching to orders tab, reset the selectedOrderId to prevent auto-opening the modal
    if (id === 'orders') {
      setSelectedOrderId(null);
    }
    
    setActiveTab(id);
    localStorage.setItem('adminTab', id);
  }

  // For order modal
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  
  // Constants for configuration
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const POLLING_INTERVAL = 5000; // 5 seconds - could be moved to a config file or environment variable
  const USE_WEBSOCKETS = true; // Enable WebSockets with polling fallback
  const WEBSOCKET_DEBUG = true; // Enable detailed WebSocket logging
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // WebSocket configuration for debugging
  // USE_WEBSOCKETS: true, WEBSOCKET_DEBUG: true


  // Polling for new orders - track the highest order ID we've seen
  // Note: We no longer use localStorage to persist this value between sessions
  // because the server now handles first-time users and cache clears by tracking
  // global acknowledgment timestamps
  const [lastOrderId, setLastOrderId] = useState<number>(0);

  // Track unacknowledged orders
  const [unacknowledgedOrders, setUnacknowledgedOrders] = useState<Order[]>([]);
  
  // Stock notification states
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // Stock notification state - commented out as not currently in use
  // const [showStockNotifications, setShowStockNotifications] = useState(false);
  // const [stockAlertCount, setStockAlertCount] = useState(0);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // Commented out getStockAlerts as stock notifications are not currently in use
  const { /* getStockAlerts, */ fetchNotifications } = useNotificationStore();
  const { menuItems } = useMenuStore();
  
  // Track acknowledged low stock items with their quantities to avoid showing the same notification repeatedly
  const [acknowledgedLowStockItems, setAcknowledgedLowStockItems] = useState<Record<string, number>>(() => {
    const stored = localStorage.getItem('acknowledgedLowStockItems');
    return stored ? JSON.parse(stored) : {};
  });
  
  // For editing menu item and inventory management
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const [openInventoryForItem, setOpenInventoryForItem] = useState<string | null>(null);
  
  // Loading and success states for acknowledge all button
  const [isAcknowledgingAll, setIsAcknowledgingAll] = useState(false);
  const [acknowledgeSuccess, setAcknowledgeSuccess] = useState(false);

  // Function to acknowledge an order via the API
  const acknowledgeOrder = async (orderId: number) => {
    // Starting acknowledgment process for order
    try {
      // First, dismiss all toast notifications for this order
      dismissAllToastsForOrder(orderId);
      
      // Find the notification ID associated with this order
      const notification = notificationStore.getState().notifications.find(
        (n: any) => n.notification_type === 'order' && n.data?.id === orderId
      );
      
      if (notification) {
        // Found notification ID for order
        
        // Acknowledge the notification in the store
        try {
          await notificationStore.getState().acknowledgeOne(notification.id);
          // Successfully acknowledged notification in store
        } catch (notificationError) {
          console.error(`[ORDER_DEBUG] Error acknowledging notification in store:`, notificationError);
        }
      } else {
        // No notification found for order in notification store
      }
      
      // Call the API to acknowledge the order
      await api.post(`/orders/${orderId}/acknowledge`);
      // Order acknowledged via API
      
      // Remove from unacknowledged orders list
      setUnacknowledgedOrders(prev => {
        const newList = prev.filter(order => Number(order.id) !== orderId);
        // Updated unacknowledged orders list, removed order
        return newList;
      });
      
      // Ensure the WebSocketManager knows this notification has been handled
      webSocketManager.markNotificationAsDisplayed(`order_${orderId}`);
      // Marked notification as displayed in WebSocketManager
    } catch (err) {
      console.error(`[ORDER_DEBUG] Failed to acknowledge order ${orderId}:`, err);
    }
  };
  
  // Helper function to dismiss all toast notifications for a specific order
  const dismissAllToastsForOrder = (orderId: number) => {
    // Dismissing all toasts for order
    
    // First try to dismiss using the global toast ID map
    if (window.orderToastIds && window.orderToastIds[orderId]) {
      const toastIds = window.orderToastIds[orderId];
      // Found toast IDs for order
      
      toastIds.forEach(id => {
        try {
          toastUtils.dismiss(id);
          // Dismissed toast with ID: ${id}
        } catch (error) {
          console.error(`[ORDER_DEBUG] Error dismissing toast with ID ${id}:`, error);
        }
      });
      
      // Clear the toast IDs for this order
      delete window.orderToastIds[orderId];
    } else {
      // No stored toast IDs found for order ${orderId}
    }
    
    // As a fallback, also try to find and remove any toast elements in the DOM with this order ID
    const existingToasts = document.querySelectorAll(`[data-order-id="${orderId}"]`);
    if (existingToasts.length > 0) {
      // Found ${existingToasts.length} toast elements in DOM for order ${orderId}
      
      // For each toast element, find its parent toast container and dismiss it
      existingToasts.forEach(toastElement => {
        try {
          // Find the closest toast container which should have a data-id attribute
          let container = toastElement.closest('[data-id]');
          if (container && container.getAttribute('data-id')) {
            const toastId = container.getAttribute('data-id') || '';
            if (toastId) {
              toastUtils.dismiss(toastId);
              // Dismissed toast with DOM ID: ${toastId}
            }
          } else {
            // Could not find toast container for element
          }
        } catch (error) {
          console.error(`[ORDER_DEBUG] Error dismissing toast from DOM:`, error);
        }
      });
    }
    
    // Finally, call dismissAll as a last resort if we still have toasts
    const remainingToasts = document.querySelectorAll(`[data-order-id="${orderId}"]`);
    if (remainingToasts.length > 0) {
      // Still found ${remainingToasts.length} toasts after targeted dismissal, calling dismissAll
      toastUtils.dismissAll();
    }
  };
  
  // Function to dismiss a specific notification and acknowledge the order in the backend
  // This prevents it from reappearing on page refresh by properly acknowledging it
  const dismissNotification = async (orderId: number, toastId: string) => {
    // Dismissing and acknowledging notification for order ${orderId} with toast ID ${toastId}
    
    try {
      // First dismiss the specific toast from the UI
      toastUtils.dismiss(toastId);
      
      // Mark this notification as displayed in WebSocketManager
      webSocketManager.markNotificationAsDisplayed(`order_${orderId}`);
      
      // Find and acknowledge the notification in the notification store if it exists
      const notification = notificationStore.getState().notifications.find(
        (n: any) => n.notification_type === 'order' && n.data?.id === orderId
      );
      
      if (notification) {
        // Acknowledging notification ${notification.id} in store
        try {
          await notificationStore.getState().acknowledgeOne(notification.id);
        } catch (err) {
          console.error(`[ORDER_DEBUG] Error acknowledging notification in store:`, err);
        }
      }
      
      // IMPORTANT: Call the API to acknowledge the order in the backend
      // Acknowledging order ${orderId} in backend
      await api.post(`/orders/${orderId}/acknowledge`);
      
      // Remove from unacknowledged orders list
      setUnacknowledgedOrders(prev => {
        const newList = prev.filter(order => Number(order.id) !== orderId);
        // Updated unacknowledged orders list, removed order
        return newList;
      });
      
      // Successfully acknowledged order ${orderId} in backend
    } catch (error) {
      console.error(`[ORDER_DEBUG] Error acknowledging order ${orderId}:`, error);
      toastUtils.error(`Failed to acknowledge order ${orderId}`);
    }
  };
  
  // Function to acknowledge all unacknowledged orders
  const acknowledgeAllOrders = async () => {
    if (isAcknowledgingAll || unacknowledgedOrders.length === 0) return; // Prevent multiple clicks or empty acknowledgments
    
    try {
      setIsAcknowledgingAll(true);
      // Acknowledging all ${unacknowledgedOrders.length} unacknowledged orders
      
      // Create a copy of the current unacknowledged orders
      const ordersToAcknowledge = [...unacknowledgedOrders];
      
      // First dismiss all toast notifications for all unacknowledged orders
      // Using our improved dismissAllToastsForOrder function
      ordersToAcknowledge.forEach(order => {
        dismissAllToastsForOrder(Number(order.id));
      });
      
      // Create an array of promises to acknowledge each order
      const acknowledgePromises = ordersToAcknowledge.map(order => {
        return api.post(`/orders/${order.id}/acknowledge`)
          .then(() => {
            // Successfully acknowledged order ${order.id}
            // Mark this notification as displayed in WebSocketManager
            webSocketManager.markNotificationAsDisplayed(`order_${order.id}`);
            return order.id;
          })
          .catch(err => {
            console.error(`[ORDER_DEBUG] Failed to acknowledge order ${order.id}:`, err);
            return null;
          });
      });
      
      // Wait for all acknowledgments to complete
      const results = await Promise.all(acknowledgePromises);
      
      // Filter out any failed acknowledgments
      const successfulAcknowledgments = results.filter(id => id !== null);
      // Successfully acknowledged ${successfulAcknowledgments.length} out of ${ordersToAcknowledge.length} orders
      
      // Clear the unacknowledged orders list
      setUnacknowledgedOrders([]);
      
      // Show success state
      setAcknowledgeSuccess(true);
      setTimeout(() => setAcknowledgeSuccess(false), 2000);
      
      // Show success toast
      toastUtils.success(`${successfulAcknowledgments.length} orders acknowledged`);
    } catch (err) {
      console.error('[ORDER_DEBUG] Failed to acknowledge all orders:', err);
      toastUtils.error('Failed to acknowledge all orders');
    } finally {
      setIsAcknowledgingAll(false);
    }
  };

  // Function to display order notification with improved handling and deduplication
  const displayOrderNotification = useCallback((order: Order) => {
    // Starting displayOrderNotification for order
    
    // Skip displaying notification if the order has already been acknowledged globally
    if (order.global_last_acknowledged_at) {
      // Skipping already acknowledged order: ${order.id}
      return;
    }
    
    // Generate a unique notification ID for deduplication
    const notificationId = `order_${order.id}`;
    
    // First check if this order has already been acknowledged in our system
    if (webSocketManager.hasNotificationBeenDisplayed(notificationId)) {
      // Skipping already displayed notification for order: ${order.id}
      return;
    }
    
    // Also check if we've already displayed this notification in the DOM
    // This prevents duplicate notifications from appearing even if they come from different sources
    const existingToasts = document.querySelectorAll(`[data-order-id="${order.id}"]`);
    if (existingToasts.length > 0) {
      // Toast already exists in DOM for order: ${order.id}
      // Register this notification to prevent future duplicates
      webSocketManager.markNotificationAsDisplayed(notificationId);
      return;
    }

    // Displaying notification for order: ${order.id} with status: ${order.status}, items: ${order.items?.length}
    
    // Register this notification with the WebSocketManager to prevent duplicates
    webSocketManager.markNotificationAsDisplayed(notificationId);
    
    // Check if toastUtils is available
    if (!toastUtils) {
      console.error(`[ORDER_DEBUG] toastUtils is not available:`, toastUtils);
      return;
    }
    
    // Handle both snake_case and camelCase date formats
    const createdAtStr = new Date(order.created_at || order.createdAt || Date.now()).toLocaleString();
    // Using the item count for logging purposes
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const itemCount = order.items?.length || 0;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Order ${order.id} has ${itemCount} items
    const totalPrice = (order.total ?? 0).toFixed(2);
    const contactName = (order as any).contact_name || 'N/A';

    // Get status badge color
    const getStatusBadgeColor = (status: string) => {
      const colors = {
        pending: 'bg-yellow-100 text-yellow-800',
        preparing: 'bg-blue-100 text-blue-800',
        ready: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-800',
        cancelled: 'bg-red-100 text-red-800',
        confirmed: 'bg-purple-100 text-purple-800',
      };
      return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };
    
    // Format item names for display (limit to 2 items with "and X more")
    const formatItemNames = (items: any[]) => {
      // Formatting item names for order ${order.id}
      if (!items || items.length === 0) return 'No items';
      
      const truncateName = (name: string, maxLength: number = 20) => {
        return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
      };
      
      if (items.length === 1) return truncateName(items[0].name);
      if (items.length === 2) return `${truncateName(items[0].name, 15)} and ${truncateName(items[1].name, 15)}`;
      return `${truncateName(items[0].name, 15)} and ${items.length - 1} more`;
    };

    // Register this notification with the WebSocketManager to prevent future duplicates
    webSocketManager.markNotificationAsDisplayed(notificationId);
    
    // Generate a unique toast ID that includes a timestamp to prevent collisions
    // This is different from the notification ID used for deduplication
    // Store this ID in a global map so we can dismiss it later
    const toastId = `order_${order.id}_${Date.now()}`;
    
    // Store the toast ID in a global map for later dismissal
    if (!window.orderToastIds) {
      window.orderToastIds = {};
    }
    
    // Add this toast ID to the list of toasts for this order
    if (!window.orderToastIds[order.id]) {
      window.orderToastIds[order.id] = [];
    }
    window.orderToastIds[order.id].push(toastId);
    
    // Generated unique toast ID: ${toastId}, stored in global map
    
    // Create the notification with a guaranteed unique toast ID
    // About to call toastUtils.custom for order: ${order.id}
    try {
      toastUtils.custom((t) => (
      <div
        className={`relative bg-white rounded-xl shadow-lg p-4 border border-gray-100 animate-slideUp transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ width: '350px', maxWidth: '95vw' }}
        data-order-id={order.id}
      >
        {/* Close button */}
        <button
          onClick={() => {
            // Dismissing notification with ID: ${toastId}
            try {
              toastUtils.dismiss(toastId);
              // Successfully dismissed notification: ${toastId}
            } catch (dismissError) {
              console.error(`[ORDER_DEBUG] Error dismissing notification: ${toastId}`, dismissError);
            }
            acknowledgeOrder(Number(order.id));
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {/* Header with icon, order number and status */}
        <div className="flex items-start mb-3">
          <div className="bg-[#c1902f] bg-opacity-10 p-2 rounded-lg mr-3 flex-shrink-0">
            <ShoppingBag className="h-5 w-5 text-[#c1902f]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 truncate pr-2 w-full">
                New Order #{order.id}
              </h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{createdAtStr}</p>
          </div>
        </div>

        {/* Order details */}
        <div className="space-y-3 mb-3">
          {/* Items preview */}
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-500">ITEMS</span>
              <span className="text-xs font-medium">${totalPrice}</span>
            </div>
            <p className="text-sm font-medium text-gray-800 truncate">
              {formatItemNames(order.items)}
            </p>
          </div>
          
          {/* Customer info */}
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-blue-700 font-medium text-sm">
                {contactName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate w-full">{contactName}</p>
              <p className="text-xs text-gray-500 truncate">Customer</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => {
              // Viewing order: ${order.id}
              
              // Dismiss notification and mark it as displayed to prevent it from reappearing
              dismissNotification(Number(order.id), toastId);
              
              // Use a Promise to ensure sequential execution for navigation
              Promise.resolve()
                .then(() => {
                  if (activeTab !== 'orders') {
                    // Switching to orders tab from ${activeTab}
                    setActiveTab('orders');
                    // Wait for tab switch
                    return new Promise(resolve => setTimeout(resolve, 100));
                  }
                })
                .then(() => {
                  // Clearing selected order ID before setting new one
                  setSelectedOrderId(null);
                  // Wait for state clear
                  return new Promise(resolve => setTimeout(resolve, 50));
                })
                .then(() => {
                  // Setting selected order ID to ${order.id}
                  setSelectedOrderId(Number(order.id));
                })
                .catch(error => {
                  console.error(`[ORDER_DEBUG] Error during view order navigation:`, error);
                });
            }}
            className="flex-1 bg-[#c1902f] text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-[#d4a43f] transition-colors shadow-sm"
          >
            View Order
          </button>
          <button
            onClick={() => {
              // Dismissing single notification for order: ${order.id}
              
              // Dismiss notification and mark it as displayed to prevent it from reappearing
              dismissNotification(Number(order.id), toastId);
            }}
            className="w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      id: toastId,
      position: 'top-right',
      // Ensure notifications stack instead of replacing each other
      style: {
        marginBottom: '1rem'
      }
    });
    // Successfully created toast notification with ID: ${toastId}
    } catch (error) {
      console.error(`[ORDER_DEBUG] Error creating toast notification for order ${order.id}:`, error);
    }
  }, [activeTab, acknowledgeOrder]);

  // Function to acknowledge a low stock item
  const acknowledgeLowStockItem = useCallback((itemId: string, currentQty: number) => {
    const updatedItems = { ...acknowledgedLowStockItems, [itemId]: currentQty };
    setAcknowledgedLowStockItems(updatedItems);
    localStorage.setItem('acknowledgedLowStockItems', JSON.stringify(updatedItems));
  }, [acknowledgedLowStockItems]);
  
  // Function to display low stock notification - memoized to prevent infinite loops
  const displayLowStockNotification = useCallback((item: MenuItem) => {
    const availableQty = calculateAvailableQuantity(item);
    
    toastUtils.custom((t) => (
      <div
              className={`relative bg-white rounded-xl shadow-md p-4 border border-gray-100 animate-slideUp transition-all duration-300 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ width: '350px', maxWidth: '95vw' }}
            >
        {/* Close button */}
        <button
          onClick={() => {
            toastUtils.dismiss(`low_stock_${item.id}`);
            acknowledgeLowStockItem(item.id, availableQty);
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {/* Simple header with icon and item name */}
        <div className="flex items-center pb-2">
          <div className="text-orange-500 mr-2">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-gray-900 truncate w-full">
              {item.name} <span className="text-orange-500 font-normal">Low Stock</span>
              <span className="ml-2 text-orange-600 font-medium">{availableQty}</span>
            </p>
          </div>
        </div>

        {/* Action buttons - styled like the order notification */}
        <div className="pt-2 flex space-x-2">
          <button
            onClick={() => {
              toastUtils.dismiss(`low_stock_${item.id}`);
              acknowledgeLowStockItem(item.id, availableQty);
              setActiveTab('menu');
              setOpenInventoryForItem(item.id);
            }}
            className="flex-1 bg-[#c1902f] text-white px-3 py-2 rounded-lg font-medium text-sm hover:bg-[#d4a43f] transition-colors shadow-sm"
          >
            Manage
          </button>
          <button
            onClick={() => {
              toastUtils.dismiss(`low_stock_${item.id}`);
              acknowledgeLowStockItem(item.id, availableQty);
            }}
            className="w-24 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      id: `low_stock_${item.id}`,
    });
  }, [calculateAvailableQuantity, acknowledgeLowStockItem, setActiveTab, setOpenInventoryForItem]);
  
  // WebSocket integration for real-time updates with improved handling
  const handleNewOrder = useCallback((order: Order) => {
    // Processing new order via WebSocket
    // Order info for debugging purposes
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const orderInfo = {
      isStaffCreated: order.staff_created,
      isAcknowledged: !!order.global_last_acknowledged_at,
      currentLastOrderId: lastOrderId
    };
    /* eslint-enable @typescript-eslint/no-unused-vars */
    
    // Skip staff-created orders and already acknowledged orders
    if (order.staff_created || order.global_last_acknowledged_at) {
      // Skipping notification for staff-created or acknowledged order
      return;
    }
    
    // Force update the orders in the store to ensure UI updates
    useOrderStore.getState().handleNewOrder(order);
    
    // Explicitly refresh the order list to ensure immediate UI update
    // This is critical to make new orders appear in the OrderManager component
    const orderStore = useOrderStore.getState();
    const currentMetadata = orderStore.metadata;
    // Explicitly refreshing order list for new order
    orderStore.fetchOrdersQuietly({
      page: currentMetadata.page,
      perPage: currentMetadata.per_page,
      _sourceId: 'websocket_new_order_refresh'
    });
    
    // Update the last order ID if needed
    if (Number(order.id) > lastOrderId) {
      // Updating lastOrderId
      // Update info for debugging purposes
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const updateInfo = {
        previous: lastOrderId,
        new: Number(order.id)
      };
      /* eslint-enable @typescript-eslint/no-unused-vars */
      setLastOrderId(Number(order.id));
    }
    
    // Add to unacknowledged orders if not already present
    setUnacknowledgedOrders(prev => {
      // Check if order is already in the list
      const exists = prev.some(o => Number(o.id) === Number(order.id));
      if (exists) {
        // Order already in unacknowledged list
        return prev;
      }
      // Adding order to unacknowledged list
      return [...prev, order];
    });
    
    // Ensure notification is displayed with a slight delay to prevent race conditions
    // Setting timeout to display notification for order: ${order.id}
    setTimeout(() => {
      // Timeout completed, now displaying notification for order: ${order.id}
      displayOrderNotification(order);
    }, 100);
  }, [lastOrderId, displayOrderNotification]);
  
  const handleLowStock = useCallback((item: MenuItem) => {
    // Received low stock alert
    
    const availableQty = calculateAvailableQuantity(item);
    const acknowledgedQty = acknowledgedLowStockItems[item.id];
    
    // Show notification if:
    // 1. Item has never been acknowledged, or
    // 2. Current quantity is lower than when it was last acknowledged
    if (acknowledgedQty === undefined || availableQty < acknowledgedQty) {
      displayLowStockNotification(item);
    }
  }, [acknowledgedLowStockItems, calculateAvailableQuantity, displayLowStockNotification]);
  
  // Initialize WebSocket connection
  const { isConnected, error: wsError, connect: connectWebSocket } = useWebSocket({
    autoConnect: USE_WEBSOCKETS && !!user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'staff'),
    onNewOrder: handleNewOrder,
    onLowStock: handleLowStock,
    onConnected: () => {
      // WebSocket connected successfully - will handle real-time order notifications
      // WebSocket connection details: userId: ${user?.id}, restaurantId: ${user?.restaurant_id}
      // WebSocket: Connected successfully - user: ${user?.id}, restaurant: ${user?.restaurant_id}, role: ${user?.role}
      
      // Clear any existing polling interval when WebSocket connects
      if (pollingIntervalRef.current) {
        // WebSocket: Clearing existing polling interval
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Initial fetch when connected
      fetchNotifications(24, 'low_stock');
      
      // Ensure we're subscribed to the order channel
      if (user?.restaurant_id) {
        // WebSocket: Ensuring order WebSocket connection is active on connect
        // Force restart the order store WebSocket connection
        useOrderStore.getState().stopWebSocketConnection();
        setTimeout(() => {
          useOrderStore.getState().startWebSocketConnection();
        }, 100);
      }
    },
    onDisconnected: () => {
      // WebSocket: Disconnected, may fall back to polling - user: ${user?.id}, restaurant: ${user?.restaurant_id}
      
      // If WebSockets are still enabled but we got disconnected, attempt to reconnect
      if (USE_WEBSOCKETS && (user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'staff')) {
        // WebSocket: Will attempt to reconnect
      }
    },
    onError: (err) => {
      console.error('[WebSocket] Error:', err, {
        user: user?.id,
        restaurant: user?.restaurant_id,
        errorType: err?.name,
        errorMessage: err?.message,
        useWebsockets: USE_WEBSOCKETS,
        isPolling: !!pollingIntervalRef.current
      });
    }
  });

  // Log WebSocket status changes
  useEffect(() => {
    // WebSocket: Connection status changed - connected: ${isConnected}, error: ${wsError?.message}
  }, [isConnected, wsError]);
  
  // Add effect for stock notifications (fallback to polling if WebSockets fail)
  useEffect(() => {
    // Only run for admin users
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'staff')) {
      return;
    }
    
    // Fetch stock notifications on component mount
    fetchNotifications(24, 'low_stock');
    
    // Set up polling interval for stock notifications if WebSockets are disabled
    let interval: NodeJS.Timeout | null = null;
    
    if (!USE_WEBSOCKETS) {
      interval = setInterval(() => {
        // Polling: Fetching stock notifications
        fetchNotifications(24, 'low_stock');
      }, POLLING_INTERVAL * 2); // Poll at a slower rate than orders
    } else if (isConnected) {
      // WebSocket: Connected, disabling polling
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    
    return () => {
      if (interval) {
        // Polling: Cleaning up polling interval
        clearInterval(interval);
      }
    };
  }, [fetchNotifications, user, isConnected]);
  
  // Stock alert count update - commented out as not currently in use
  /*
  useEffect(() => {
    const stockAlerts = getStockAlerts();
    // Ensure stockAlerts is an array before accessing length
    setStockAlertCount(Array.isArray(stockAlerts) ? stockAlerts.length : 0);
  }, [getStockAlerts]);
  */
  
  
  // Handle stock notification view - commented out as not currently in use
  /*
  const handleStockNotificationView = (notification: any) => {
    // Navigate to the menu tab
    setActiveTab('menu');
    
    // If the notification has an item ID, open the inventory modal for it
    if (notification.item_id) {
      setOpenInventoryForItem(notification.item_id);
    }
    
    // Close notification panel
    setShowStockNotifications(false);
  };
  */
  
  // Single WebSocket connection management with improved connection handling
  useEffect(() => {
    // Only run for admin users
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'staff')) {
      // WebSocket: Skipping connection - not an admin user
      return;
    }
    
    let wsCleanupTimeout: NodeJS.Timeout;
    let wsCheckInterval: NodeJS.Timeout;
    
    const initializeWebSocket = () => {
      if (USE_WEBSOCKETS && user?.restaurant_id) {
        // WebSocket: Initializing connection for user: ${user.id}, restaurant: ${user.restaurant_id}, role: ${user.role}
        
        // First, ensure any polling is stopped
        if (pollingIntervalRef.current) {
          // WebSocket: Clearing existing polling interval before WebSocket connection
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Check if WebSocket is already connected
        const { websocketConnected } = useOrderStore.getState();
        
        if (websocketConnected) {
          // WebSocket: Connection already established, skipping initialization
          return;
        }
        
        // Wait for cleanup before establishing new connections
        wsCleanupTimeout = setTimeout(() => {
          // Establishing new WebSocket connections
          // First connect to the restaurant channel
          connectWebSocket();
          
          // Then connect to the order channel
          // The orderStore will check if it's already connected
          useOrderStore.getState().startWebSocketConnection();
          
          // Double-check that polling is stopped after WebSocket connection
          setTimeout(() => {
            if (pollingIntervalRef.current) {
              // WebSocket: Clearing polling interval after WebSocket connection
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }, 1000);
        }, 500);
      }
    };
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Set up an interval to periodically check WebSocket status and restart if needed
    // Use a longer interval to reduce the frequency of checks
    wsCheckInterval = setInterval(() => {
      // Only check if WebSockets should be enabled
      if (USE_WEBSOCKETS && user?.restaurant_id) {
        const { websocketConnected } = useOrderStore.getState();
        const localWebSocketConnected = isConnected;
        
        // Only log if there's a change in connection status
        const lastConnectionStatus = connectionStatusRef.current;
        const currentConnectionStatus = { local: localWebSocketConnected, order: websocketConnected };
        
        // Check if status has changed
        if (lastConnectionStatus.local !== currentConnectionStatus.local || 
            lastConnectionStatus.order !== currentConnectionStatus.order) {
          // WebSocket: Connection status changed - local: ${localWebSocketConnected}, orderStore: ${websocketConnected}
          
          // Update the connection status ref
          connectionStatusRef.current = currentConnectionStatus;
        }
        
        // If WebSocket should be connected but isn't, try to reconnect
        // Only attempt reconnection if both connections are down to prevent race conditions
        if (!websocketConnected && !localWebSocketConnected && !reconnectingRef.current) {
          // WebSocket: Both connections lost, attempting to reconnect
          reconnectingRef.current = true;
          
          // Use a timeout to prevent immediate reconnection attempts
          setTimeout(() => {
            initializeWebSocket();
            reconnectingRef.current = false;
          }, 2000);
        }
        
        // If WebSocket is connected but polling is still running, stop polling
        if ((websocketConnected || localWebSocketConnected) && pollingIntervalRef.current) {
          // WebSocket: WebSocket connected but polling still active - stopping polling
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 60000); // Check every 60 seconds instead of 30 to reduce frequency
    
    // Cleanup function
    return () => {
      // Cleaning up WebSocket connections
      if (wsCleanupTimeout) {
        clearTimeout(wsCleanupTimeout);
      }
      if (wsCheckInterval) {
        clearInterval(wsCheckInterval);
      }
      // Only disconnect if component is unmounting
      if (document.visibilityState !== 'hidden') {
        useOrderStore.getState().stopWebSocketConnection();
      }
    };
  }, [user, USE_WEBSOCKETS, isConnected]);
  
  // Effect to check for low stock items and display notifications
  useEffect(() => {
    // Only run for admin users
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'staff')) {
      return;
    }
    
    // Check for low stock items
    const lowStockItems = menuItems.filter(item => {
      if (!item.enable_stock_tracking) return false;
      
      const availableQty = calculateAvailableQuantity(item);
      const threshold = item.low_stock_threshold || 10;
      
      return availableQty > 0 && availableQty <= threshold;
    });
    
    // Display notifications for low stock items that haven't been acknowledged
    // or where the quantity has decreased since last acknowledgment
    lowStockItems.forEach(item => {
      const availableQty = calculateAvailableQuantity(item);
      const acknowledgedQty = acknowledgedLowStockItems[item.id];
      
      // Show notification if:
      // 1. Item has never been acknowledged, or
      // 2. Current quantity is lower than when it was last acknowledged
      if (acknowledgedQty === undefined || availableQty < acknowledgedQty) {
        displayLowStockNotification(item);
      }
    });
  }, [menuItems, acknowledgedLowStockItems, user, calculateAvailableQuantity, displayLowStockNotification]);

// SIMPLIFIED POLLING IMPLEMENTATION WITH WEBSOCKET PRIORITY
// Use a ref to track if the component is mounted and to store the polling interval
const mountedRef = useRef(false);
const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
// Track when we last checked WebSocket status to avoid excessive checks
const lastWebSocketCheckRef = useRef<number>(Date.now());
// Track the current connection status to avoid unnecessary logs
const connectionStatusRef = useRef<{local: boolean, order: boolean}>({local: false, order: false});
// Track if we're currently attempting to reconnect to prevent multiple reconnection attempts
const reconnectingRef = useRef<boolean>(false);
// Track if we're currently fetching notifications to prevent duplicate requests
const fetchingNotificationsRef = useRef<boolean>(false);

// This effect runs once on mount to check for unacknowledged orders
useEffect(() => {
  // Skip if not an admin or staff user
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'staff')) {
    return;
  }

  // Even if WebSockets are enabled and connected, still do an initial check
  // to make sure we don't miss any orders that came in before we connected
  // AdminDashboard: Performing initial order check on mount
  
  // Clear any existing polling interval
  if (pollingIntervalRef.current) {
    // WebSocket: Clearing existing polling interval on mount
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
  }

  // Mark as mounted
  mountedRef.current = true;
  
  // Function to check for unacknowledged orders
  const checkForUnacknowledgedOrders = async () => {
    if (!mountedRef.current) return;
    
    // Prevent duplicate API calls
    if (fetchingNotificationsRef.current) {
      // AdminDashboard: Already fetching notifications, skipping duplicate call
      return;
    }
    
    // Check WebSocket status before making API calls
    const orderStoreWebSocketConnected = useOrderStore.getState().websocketConnected;
    if (USE_WEBSOCKETS && (isConnected || orderStoreWebSocketConnected)) {
      // AdminDashboard: WebSocket connected, skipping polling for orders
      return;
    }
    
    try {
      fetchingNotificationsRef.current = true;
      // AdminDashboard: Checking for unacknowledged orders...
      
      // Get unacknowledged orders from the last 24 hours
      const url = `/orders/unacknowledged?hours=24`;
      const fetchedOrders: Order[] = await api.get(url);
      
      if (!mountedRef.current) {
        fetchingNotificationsRef.current = false;
        return;
      }
      
      // AdminDashboard: Unacknowledged orders: ${fetchedOrders.length}
      
      // Filter out staff-created orders and orders that have already been acknowledged globally
      const nonStaffOrders = fetchedOrders.filter(order =>
        !order.staff_created && !order.global_last_acknowledged_at
      );
      
      // Update unacknowledged orders state with only non-staff orders that haven't been acknowledged globally
      setUnacknowledgedOrders(nonStaffOrders);
      
      // Display notifications for unacknowledged orders (already filtered)
      nonStaffOrders.forEach(order => {
        // AdminDashboard: Displaying notification for order: ${order.id}
        displayOrderNotification(order);
      });
      
      // Update lastOrderId if needed
      if (fetchedOrders.length > 0) {
        const maxId = Math.max(...fetchedOrders.map((o) => Number(o.id)));
        if (maxId > lastOrderId) {
          setLastOrderId(maxId);
        }
      }
      
      // Add a delay before allowing another fetch
      setTimeout(() => {
        fetchingNotificationsRef.current = false;
      }, 5000); // 5 second cooldown between fetches
    } catch (err) {
      console.error('[AdminDashboard] Failed to check for unacknowledged orders:', err);
      fetchingNotificationsRef.current = false;
    }
  };
  
  // Only check for unacknowledged orders if WebSockets are not enabled or not connected
  if (!USE_WEBSOCKETS || !isConnected) {
    checkForUnacknowledgedOrders();
  }
  
  // Clean up function
  return () => {
    mountedRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isConnected]); // Add isConnected to dependencies

// Simplified polling setup - only used when WebSockets are not available
useEffect(() => {
  // Get the WebSocket connection status directly from orderStore
  const orderStoreWebSocketConnected = useOrderStore.getState().websocketConnected;
  
  // Update connection status ref
  connectionStatusRef.current = {
    local: isConnected,
    order: orderStoreWebSocketConnected
  };
  
  // Log current WebSocket status for debugging (only on initial setup)
  // AdminDashboard: WebSocket status check - local: ${isConnected}, orderStore: ${orderStoreWebSocketConnected}
  
  // Skip if not an admin user or if WebSockets are working
  if (!user ||
      (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'staff') ||
      (USE_WEBSOCKETS && (isConnected || orderStoreWebSocketConnected))) {
    // If WebSockets are connected, clear any existing polling interval
    if (USE_WEBSOCKETS && (isConnected || orderStoreWebSocketConnected) && pollingIntervalRef.current) {
      // Polling: WebSocket is connected, clearing polling interval
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    return;
  }
  
  // Only set up polling if we don't already have an interval
  if (pollingIntervalRef.current) {
    // Polling: Polling interval already exists, skipping setup
    return;
  }

  // Polling: Setting up polling fallback - WebSockets: ${USE_WEBSOCKETS}, connected: ${isConnected}
  
  // Function to check for new orders
  const checkForNewOrders = async () => {
    // Prevent duplicate API calls
    if (fetchingNotificationsRef.current) {
      // AdminDashboard: Already fetching notifications, skipping duplicate call
      return;
    }
    
    // Get the latest WebSocket connection status from orderStore
    const currentOrderStoreWebSocketConnected = useOrderStore.getState().websocketConnected;
    
    // Update last check timestamp
    lastWebSocketCheckRef.current = Date.now();
    
    // Double-check WebSocket status before polling
    if (USE_WEBSOCKETS && (isConnected || currentOrderStoreWebSocketConnected)) {
      // Polling: WebSocket is connected, skipping polling
      
      // If polling interval exists but WebSockets are connected, clear the interval
      if (pollingIntervalRef.current) {
        // Polling: WebSocket is connected, clearing polling interval
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // If WebSocket is connected but we're still in this function, something might be wrong
      // Force reconnect the WebSocket to ensure it's working properly, but only if it's been a while
      if (Date.now() - lastWebSocketCheckRef.current > 120000 && !reconnectingRef.current) { // Only force reconnect if it's been more than 2 minutes
        // WebSocket: Force reconnecting WebSocket to ensure proper connection
        reconnectingRef.current = true;
        
        setTimeout(() => {
          if (isConnected) {
            // Reconnect local WebSocket
            connectWebSocket();
          }
          if (currentOrderStoreWebSocketConnected) {
            // Reconnect order store WebSocket
            useOrderStore.getState().stopWebSocketConnection();
            setTimeout(() => useOrderStore.getState().startWebSocketConnection(), 1000);
          }
          reconnectingRef.current = false;
        }, 2000);
      }
      
      return;
    }
    
    if (!mountedRef.current) return;
    
    try {
      fetchingNotificationsRef.current = true;
      // Polling: Checking for new orders since ID: ${lastOrderId}
      
      const url = `/orders/new_since/${lastOrderId}`;
      const newOrders: Order[] = await api.get(url);
      
      if (!mountedRef.current) {
        fetchingNotificationsRef.current = false;
        return;
      }
      
      if (newOrders.length > 0) {
        // Filter out staff-created orders and orders that have already been acknowledged globally
        const nonStaffOrders = newOrders.filter(order =>
          !order.staff_created && !order.global_last_acknowledged_at
        );
        
        // Display notifications for non-staff orders that haven't been acknowledged globally
        nonStaffOrders.forEach((order) => {
          displayOrderNotification(order);
        });
        
        // Add non-staff orders to unacknowledged orders
        setUnacknowledgedOrders(prev => [...prev, ...nonStaffOrders]);
        
        const maxId = Math.max(...newOrders.map((o) => Number(o.id)));
        setLastOrderId(maxId);
      }
      
      // Add a delay before allowing another fetch
      setTimeout(() => {
        fetchingNotificationsRef.current = false;
      }, 5000); // 5 second cooldown between fetches
    } catch (err) {
      console.error('[AdminDashboard] Failed to poll new orders:', err);
      fetchingNotificationsRef.current = false;
    }
  };
  
  // Clear any existing interval
  if (pollingIntervalRef.current) {
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
  }
  
  // Only set up polling if WebSockets are disabled or not connected
  // AdminDashboard: Setting up polling for new orders - WebSockets: ${USE_WEBSOCKETS}, connected: ${isConnected}
  
  // Use a longer polling interval to reduce server load
  pollingIntervalRef.current = setInterval(checkForNewOrders, POLLING_INTERVAL * 2);
  
  // Clean up function
  return () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    // Reset fetching flag on unmount
    fetchingNotificationsRef.current = false;
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [lastOrderId, isConnected, USE_WEBSOCKETS]); // Add USE_WEBSOCKETS to dependencies

  return (
    <div className="min-h-screen bg-gray-50 relative">
  {/* Acknowledge All button using the new component */}
  <AcknowledgeAllButton
    count={unacknowledgedOrders.length}
    isLoading={isAcknowledgingAll}
    onClick={acknowledgeAllOrders}
    showSuccess={acknowledgeSuccess}
    type="order"
  />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isStaffOnly ? 'Order Management Dashboard' : 'Admin Dashboard'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {isStaffOnly 
                  ? 'Create, view, and manage customer orders' 
                  : 'Manage orders, menu items, promotions, and more'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Stock notification bell and panel - commented out as not currently in use */}
              
              {/* Restaurant selector - only for super admins */}
              {user?.role === 'super_admin' && (
                <div className="mt-4 md:mt-0 md:ml-4 w-full md:w-64">
                  <RestaurantSelector 
                    onRestaurantChange={(restaurantId) => {
                      setCurrentRestaurantId(restaurantId);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          {/* Tab navigation */}
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px" role="tablist">
              {/* For staff users, simplify the UI by only showing the Orders tab */}
              {isStaffOnly ? (
                <div className="flex-shrink-0 whitespace-nowrap px-4 py-4 border-b-2 border-[#c1902f] text-center font-medium text-sm text-[#c1902f]">
                  <div className="flex items-center">
                    <ShoppingBag className="h-5 w-5 mx-auto mb-1" />
                    Order Management
                  </div>
                </div>
              ) : (
                // Regular tab navigation for admin/super_admin users
                tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabClick(id as Tab)}
                    className={`
                      flex-shrink-0 whitespace-nowrap px-4 py-4 border-b-2
                      text-center font-medium text-sm
                      ${
                        activeTab === id
                          ? 'border-[#c1902f] text-[#c1902f]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    {label}
                  </button>
                ))
              )}
            </nav>
          </div>

          {/* Tab content */}
          <div className="p-4 relative overflow-hidden">
            <div className={`transition-opacity duration-300 ${activeTab === 'analytics' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'analytics' && <AnalyticsManager restaurantId={currentRestaurantId} />}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'orders' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'orders' && (
                <OrderManager
                  selectedOrderId={selectedOrderId}
                  setSelectedOrderId={setSelectedOrderId}
                  restaurantId={currentRestaurantId}
                />
              )}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'menu' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'menu' && (
                <MenuManager 
                  restaurantId={currentRestaurantId} 
                  selectedMenuItemId={selectedMenuItemId}
                  openInventoryForItem={openInventoryForItem}
                  onInventoryModalClose={() => setOpenInventoryForItem(null)}
                />
              )}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'promos' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'promos' && <PromoManager restaurantId={currentRestaurantId} />}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'merchandise' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'merchandise' && <MerchandiseManager />}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'staff' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'staff' && <StaffManagement />}
            </div>
            
            <div className={`transition-opacity duration-300 ${activeTab === 'settings' ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
              {activeTab === 'settings' && <SettingsManager restaurantId={currentRestaurantId} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
