import { create } from 'zustand';
import {
  Notification,
  getUnacknowledgedNotifications,
  acknowledgeNotification,
  acknowledgeAllNotifications,
  // getNotificationCount, // Commented out unused import
  getNotificationStats,
  takeActionOnNotification,
  RestockActionResponse
} from '../../shared/api/endpoints/notifications';
import { handleApiError } from '../../shared/utils/errorHandler';
import { useAuthStore } from './authStore';
import notificationStorageService from '../../shared/services/NotificationStorageService';
import { webSocketManager, NotificationType, ConnectionStatus } from '../../shared/services/WebSocketManager';

interface NotificationStoreState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  websocketConnected: boolean;
  pollingInterval: number | null;
  fetchInProgress: boolean;
  stats: {
    orderCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalCount: number;
    oldestNotificationDate: string | null;
  };

  // WebSocket methods
  startWebSocketConnection: () => void;
  stopWebSocketConnection: () => void;
  handleNewNotification: (notification: Notification) => void;
  
  // Polling methods (fallback)
  startNotificationPolling: () => void;
  stopNotificationPolling: () => void;

  // Actions
  fetchNotifications: (hours?: number, type?: string) => Promise<Notification[]>;
  acknowledgeOne: (id: number) => Promise<void>;
  acknowledgeAll: (type?: string) => Promise<number>;
  takeAction: (id: number, actionType: string, params: Record<string, any>) => Promise<RestockActionResponse | null>;
  fetchStats: () => Promise<void>;
  clearError: () => void;
  
  // Computed properties
  getStockAlerts: () => Notification[];
  hasUnacknowledgedNotifications: (type?: string) => boolean;
}

const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [] as Notification[],
  loading: false,
  error: null,
  websocketConnected: false,
  pollingInterval: null,
  fetchInProgress: false,
  stats: {
    orderCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalCount: 0,
    oldestNotificationDate: null,
  },
  
  // ---------------------------------------------------------
  // WebSocket Methods
  // ---------------------------------------------------------
  startWebSocketConnection: () => {
    // First stop any existing connections or polling
    get().stopWebSocketConnection();
    get().stopNotificationPolling();
    
    const user = useAuthStore.getState().user;
    if (!user?.restaurant_id) {
      console.error('[NotificationStore] Cannot start WebSocket connection: No restaurant ID');
      return;
    }
    
    // Check if already connected
    if (get().websocketConnected) {
      console.debug('[NotificationStore] WebSocket already connected, skipping initialization');
      return;
    }
    
    console.debug('[NotificationStore] Initializing WebSocket connection for restaurant:', user.restaurant_id);
    
    // Initialize the WebSocketManager
    webSocketManager.initialize(user.restaurant_id);
    
    // Register handlers for notifications
    webSocketManager.registerHandler(NotificationType.NEW_ORDER, (order) => {
      console.log('[ORDER_DEBUG] NotificationStore received new order notification:', order);
      
      // Convert order to notification format if needed
      const notification = typeof order.id === 'undefined' ? order : {
        id: order.id,
        title: `New Order #${order.order_number || order.id}`,
        body: `New order from ${order.customer_name || 'Customer'}`,
        notification_type: 'order',
        resource_type: 'Order',
        resource_id: order.id,
        admin_path: `/admin/orders/${order.id}`,
        acknowledged: false,
        created_at: order.created_at || new Date().toISOString(),
        updated_at: order.updated_at || new Date().toISOString(),
        metadata: {
          order_id: order.id,
          customer_name: order.customer_name,
          total: order.total
        }
      };
      
      console.log('[ORDER_DEBUG] Converted order to notification format:', notification);
      
      // Process the notification
      console.log('[ORDER_DEBUG] Calling handleNewNotification for order:', order.id);
      get().handleNewNotification(notification as Notification);
    });
    
    webSocketManager.registerHandler(NotificationType.LOW_STOCK, (item) => {
      console.debug('[NotificationStore] Received low stock notification:', item);
      
      // Convert item to notification format if needed
      const notification = typeof item.id === 'undefined' ? item : {
        id: item.id,
        title: `Low Stock Alert`,
        body: `${item.name || 'Item'} is running low on stock`,
        notification_type: 'low_stock',
        resource_type: 'MerchandiseVariant',
        resource_id: item.id,
        admin_path: `/admin/inventory/${item.id}`,
        acknowledged: false,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        metadata: {
          variant_id: item.id,
          item_id: item.merchandise_id,
          stock_quantity: item.stock_quantity,
          threshold: item.threshold
        }
      };
      
      // Process the notification
      get().handleNewNotification(notification as Notification);
    });
    
    // Register status handler
    webSocketManager.registerStatusHandler((status) => {
      const isConnected = status === ConnectionStatus.CONNECTED;
      
      // If connection status has changed, update our state
      if (isConnected !== get().websocketConnected) {
        console.debug(`[NotificationStore] WebSocket connection status changed: ${status}`);
        set({ websocketConnected: isConnected });
        
        // If disconnected, start polling
        if (!isConnected && !get().pollingInterval) {
          console.debug('[NotificationStore] WebSocket disconnected, starting polling');
          get().startNotificationPolling();
        }
        // If connected, stop polling
        else if (isConnected && get().pollingInterval) {
          console.debug('[NotificationStore] WebSocket connected, stopping polling');
          get().stopNotificationPolling();
        }
        
        // If connected, fetch missed notifications
        if (isConnected) {
          notificationStorageService.fetchMissedNotifications().then(missedNotifications => {
            console.debug(`[NotificationStore] Fetched ${missedNotifications.length} missed notifications`);
            
            // Process each missed notification
            missedNotifications.forEach(notification => {
              if (!notification.acknowledged && !notification.acknowledgedLocally) {
                get().handleNewNotification(notification as Notification);
              }
            });
          });
        }
      }
    });
  },
  
  stopWebSocketConnection: () => {
    console.debug('[NotificationStore] Stopping WebSocket connection');
    
    // Unregister handlers from WebSocketManager
    webSocketManager.unregisterHandler(NotificationType.NEW_ORDER, get().handleNewNotification);
    webSocketManager.unregisterHandler(NotificationType.LOW_STOCK, get().handleNewNotification);
    
    // Update connection status
    set({ websocketConnected: false });
  },
  
  handleNewNotification: (notification: Notification) => {
    if (!notification || !notification.id) {
      console.error('[ORDER_DEBUG] handleNewNotification received invalid notification:', notification);
      return;
    }
    
    console.log('[ORDER_DEBUG] handleNewNotification processing notification:', {
      id: notification.id,
      type: notification.notification_type,
      resourceType: notification.resource_type,
      resourceId: notification.resource_id,
      title: notification.title
    });
    
    // Check if we already have this notification
    const existingNotificationIndex = get().notifications.findIndex(n => n.id === notification.id);
    
    if (existingNotificationIndex !== -1) {
      console.log(`[ORDER_DEBUG] Notification ${notification.id} already exists in store, skipping`);
      return;
    }
    
    console.log(`[ORDER_DEBUG] Adding new notification ${notification.id} to store`);
    
    // Add the new notification to the store
    set(state => {
      const newState = {
        notifications: [notification, ...state.notifications],
        // Update stats
        stats: {
          ...state.stats,
          totalCount: state.stats.totalCount + 1,
          // Update specific counters based on notification type
          orderCount: notification.notification_type === 'order' ? state.stats.orderCount + 1 : state.stats.orderCount,
          lowStockCount: notification.notification_type === 'low_stock' ? state.stats.lowStockCount + 1 : state.stats.lowStockCount,
          outOfStockCount: notification.notification_type === 'out_of_stock' ? state.stats.outOfStockCount + 1 : state.stats.outOfStockCount,
        }
      };
      
      console.log('[ORDER_DEBUG] Updated notification store state:', {
        notificationCount: newState.notifications.length,
        stats: newState.stats
      });
      
      return newState;
    });
  },
  
  // ---------------------------------------------------------
  // Polling Methods (Fallback)
  // ---------------------------------------------------------
  startNotificationPolling: () => {
    // First stop any existing polling
    get().stopNotificationPolling();
    
    // Don't start polling if WebSocket is connected
    if (get().websocketConnected) {
      console.debug('[NotificationStore] WebSocket connected, not starting polling');
      return;
    }
    
    // Log that we're falling back to polling
    console.debug('[NotificationStore] Starting polling for notifications (WebSocket fallback)');
    
    // Start a new polling interval
    const intervalId = window.setInterval(async () => {
      // Double-check WebSocket status before polling
      if (get().websocketConnected) {
        console.debug('[NotificationStore] WebSocket now connected, stopping polling');
        get().stopNotificationPolling();
        return;
      }
      
      console.debug('[NotificationStore] Polling for notifications');
      await get().fetchNotifications();
      await get().fetchStats();
    }, 30000); // Poll every 30 seconds
    
    // Store the interval ID so we can clear it later
    set({ pollingInterval: intervalId });
  },
  
  stopNotificationPolling: () => {
    const { pollingInterval } = get();
    
    if (pollingInterval !== null) {
      window.clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },
  
  fetchNotifications: async (hours = 24, type?: string) => {
    // Prevent duplicate fetch calls
    if (get().fetchInProgress) {
      console.debug('[NotificationStore] Fetch already in progress, skipping duplicate call');
      return get().notifications;
    }
    
    try {
      set({ loading: true, error: null, fetchInProgress: true });
      
      console.debug('[NotificationStore] Fetching notifications with params:', { type, hours });
      
      // First, try to get notifications from the storage service
      let storedNotifications = notificationStorageService.getNotifications({ 
        onlyUnacknowledged: true,
        type
      });
      
      console.debug('[NotificationStore] Stored notifications:', {
        count: storedNotifications.length,
        notifications: storedNotifications
      });
      
      // If we need to refresh from server or we don't have enough stored notifications,
      // fetch from the API and update our storage
      const serverNotifications = await getUnacknowledgedNotifications(type, hours);
      
      console.debug('[NotificationStore] Server notifications response:', {
        isArray: Array.isArray(serverNotifications),
        type: typeof serverNotifications,
        value: serverNotifications,
        keys: serverNotifications ? Object.keys(serverNotifications) : null
      });
      
      // Ensure notifications is always an array
      const safeServerNotifications = Array.isArray(serverNotifications) ? serverNotifications : [];
      
      if (!Array.isArray(serverNotifications)) {
        console.warn('API returned non-array notifications:', {
          type: typeof serverNotifications,
          value: serverNotifications,
          keys: serverNotifications ? Object.keys(serverNotifications) : null
        });
      }
      
      // Store the fetched notifications
      safeServerNotifications.forEach(notification => {
        notificationStorageService.addNotification(notification, {
          syncedWithServer: true
        });
      });
      
      // Use the server notifications for the UI
      set({ notifications: safeServerNotifications, loading: false });
      return safeServerNotifications;
    } catch (error) {
      const errorMessage = handleApiError(error, 'Failed to fetch notifications');
      set({ error: errorMessage, loading: false, notifications: [] });
      
      // If server fetch fails, fall back to stored notifications
      const storedNotifications = notificationStorageService.getNotifications({ 
        onlyUnacknowledged: true,
        type
      });
      
      if (storedNotifications.length > 0) {
        console.debug('Falling back to stored notifications:', {
          count: storedNotifications.length
        });
        set({ notifications: storedNotifications as Notification[], loading: false });
        return storedNotifications as Notification[];
      }
      
      return [];
    }
  },

  acknowledgeOne: async (id: number) => {
    try {
      // First, mark the notification as acknowledged in our local storage
      notificationStorageService.acknowledgeNotification(id);
      
      // Then, try to acknowledge on the server
      try {
        await acknowledgeNotification(id);
      } catch (serverError) {
        // If server acknowledgment fails, the NotificationStorageService will retry later
        console.warn(`[NotificationStore] Server acknowledgment failed for notification ${id}, will retry later:`, serverError);
      }
      
      // Update local state
      set(state => {
        // Safety check to ensure notifications is an array
        if (!Array.isArray(state.notifications)) {
          console.warn('Expected notifications to be an array but got:', typeof state.notifications);
          return {
            ...state,
            error: 'Invalid notifications data structure'
          };
        }
        
        return {
          notifications: state.notifications.filter(n => n.id !== id),
          stats: {
            ...state.stats,
            totalCount: Math.max(0, state.stats.totalCount - 1),
            // Decrement the appropriate counter based on notification type
            orderCount: state.notifications.find(n => n.id === id && n.notification_type === 'order')
              ? Math.max(0, state.stats.orderCount - 1)
              : state.stats.orderCount,
            lowStockCount: state.notifications.find(n => n.id === id && n.notification_type === 'low_stock')
              ? Math.max(0, state.stats.lowStockCount - 1)
              : state.stats.lowStockCount,
            outOfStockCount: state.notifications.find(n => n.id === id && n.notification_type === 'out_of_stock')
              ? Math.max(0, state.stats.outOfStockCount - 1)
              : state.stats.outOfStockCount,
          }
        };
      });
    } catch (error) {
      const errorMessage = handleApiError(error, 'Failed to acknowledge notification');
      set({ error: errorMessage });
    }
  },

  acknowledgeAll: async (type?: string) => {
    try {
      const { acknowledged_count } = await acknowledgeAllNotifications(type);
      
      // Update local state
      set(state => {
        // Safety check to ensure notifications is an array
        if (!Array.isArray(state.notifications)) {
          console.warn('Expected notifications to be an array but got:', typeof state.notifications);
          return {
            ...state,
            error: 'Invalid notifications data structure'
          };
        }
        
        // If type is specified, filter out only notifications of that type
        const updatedNotifications = type
          ? state.notifications.filter(n => n.notification_type !== type)
          : [];
          
        // Update stats based on what was acknowledged
        const newStats = { ...state.stats };
        
        if (type) {
          // If a specific type was acknowledged, reduce that counter
          switch (type) {
            case 'order':
              newStats.orderCount = 0;
              break;
            case 'low_stock':
              newStats.lowStockCount = 0;
              break;
            case 'out_of_stock':
              newStats.outOfStockCount = 0;
              break;
          }
        } else {
          // If all were acknowledged, reset all counters
          newStats.orderCount = 0;
          newStats.lowStockCount = 0;
          newStats.outOfStockCount = 0;
        }
        
        newStats.totalCount = newStats.orderCount + newStats.lowStockCount + newStats.outOfStockCount;
        
        return {
          notifications: updatedNotifications,
          stats: newStats
        };
      });
      
      return acknowledged_count;
    } catch (error) {
      const errorMessage = handleApiError(error, 'Failed to acknowledge all notifications');
      set({ error: errorMessage });
      return 0;
    }
  },
  
  takeAction: async (id: number, actionType: string, params: Record<string, any> = {}) => {
    try {
      set({ loading: true, error: null });
      const response = await takeActionOnNotification(id, actionType, params);
      
      // For restock actions, the notification will be acknowledged automatically
      // So we should remove it from the local state
      set(state => {
        // Safety check to ensure notifications is an array
        if (!Array.isArray(state.notifications)) {
          console.warn('Expected notifications to be an array but got:', typeof state.notifications);
          return {
            ...state,
            loading: false,
            error: 'Invalid notifications data structure'
          };
        }
        
        return {
          loading: false,
          notifications: state.notifications.filter(n => n.id !== id),
          stats: {
            ...state.stats,
            totalCount: Math.max(0, state.stats.totalCount - 1),
            // If this was a low stock notification, reduce that counter
            lowStockCount: state.notifications.find(n => n.id === id && n.notification_type === 'low_stock')
              ? Math.max(0, state.stats.lowStockCount - 1)
              : state.stats.lowStockCount,
          }
        };
      });
      
      return response;
    } catch (error) {
      const errorMessage = handleApiError(error, 'Failed to take action on notification');
      set({ error: errorMessage, loading: false });
      return null;
    }
  },

  fetchStats: async () => {
    try {
      set({ loading: true, error: null });
      const stats = await getNotificationStats();
      set({
        stats: {
          orderCount: stats.order_count,
          lowStockCount: stats.low_stock_count,
          outOfStockCount: stats.out_of_stock_count,
          totalCount: stats.total_count,
          oldestNotificationDate: stats.oldest_notification_date
        },
        loading: false
      });
    } catch (error) {
      const errorMessage = handleApiError(error, 'Failed to fetch notification stats');
      set({ error: errorMessage, loading: false });
    }
  },

  clearError: () => set({ error: null }),
  
  // Get all merchandise stock-related notifications
  getStockAlerts: () => {
    const { notifications } = get();
    // Add safety check to ensure notifications is an array before filtering
    if (!Array.isArray(notifications)) {
      console.warn('Expected notifications to be an array but got:', typeof notifications);
      return [];
    }
    return notifications.filter(n => 
      n.notification_type === 'low_stock' || 
      n.notification_type === 'out_of_stock' ||
      n.notification_type === 'persistent_low_stock'
    );
  },
  
  // Check if there are any unacknowledged notifications of a given type
  hasUnacknowledgedNotifications: (type?: string) => {
    const { notifications } = get();
    // Add safety check to ensure notifications is an array before using array methods
    if (!Array.isArray(notifications)) {
      console.warn('Expected notifications to be an array but got:', typeof notifications);
      return false;
    }
    if (type) {
      return notifications.some(n => n.notification_type === type);
    }
    return notifications.length > 0;
  }
}));

export default useNotificationStore;
