// src/shared/hooks/useWebSocket.ts

import { useEffect, useState, useCallback, useRef } from 'react';
import webSocketManager, { NotificationType, NotificationHandler } from '../services/WebSocketManager';
import { useAuthStore } from '../../ordering/store/authStore';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onNewOrder?: NotificationHandler;
  onOrderUpdated?: NotificationHandler;
  onLowStock?: NotificationHandler;
  onError?: (error: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface UseWebSocketResult {
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketResult => {
  const { user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a connect function that can be called from the component
  const connect = useCallback(() => {
    console.debug('[WebSocket] Attempting connection', {
      hasUser: !!user,
      restaurantId: user?.restaurant_id,
      isCleaningUp: isCleaningUp.current,
      isConnected: isConnected
    });

    if (!user?.restaurant_id) {
      const error = new Error('No restaurant ID available');
      console.error('[WebSocket] Connection failed:', error.message);
      setError(error);
      return;
    }
    
    // Initialize the WebSocketManager
    webSocketManager.initialize(user.restaurant_id);
    
    // Register handlers for notifications
    if (options.onNewOrder) {
      webSocketManager.registerHandler(NotificationType.NEW_ORDER, options.onNewOrder);
    }
    
    if (options.onOrderUpdated) {
      webSocketManager.registerHandler(NotificationType.ORDER_UPDATED, options.onOrderUpdated);
    }
    
    if (options.onLowStock) {
      webSocketManager.registerHandler(NotificationType.LOW_STOCK, options.onLowStock);
    }
    
    // Update connection status
    setIsConnected(true);
    setError(null);
    if (options.onConnected) options.onConnected();
  }, [
    user?.restaurant_id,
    options.onNewOrder,
    options.onOrderUpdated,
    options.onLowStock,
    options.onError,
    options.onConnected,
    options.onDisconnected
  ]);

  // Create a disconnect function that can be called from the component
  const disconnect = useCallback((source: string = 'manual') => {
    if (isConnected) {
      console.debug('[WebSocket] Disconnecting', { source });
      
      // Unregister handlers
      if (options.onNewOrder) {
        webSocketManager.unregisterHandler(NotificationType.NEW_ORDER, options.onNewOrder);
      }
      
      if (options.onOrderUpdated) {
        webSocketManager.unregisterHandler(NotificationType.ORDER_UPDATED, options.onOrderUpdated);
      }
      
      if (options.onLowStock) {
        webSocketManager.unregisterHandler(NotificationType.LOW_STOCK, options.onLowStock);
      }
      
      // We don't actually disconnect the WebSocketManager here, as other components might be using it
      // We just unregister our handlers and update our local state
      setIsConnected(false);
    }
  }, [isConnected, options.onNewOrder, options.onOrderUpdated, options.onLowStock]);

  // Ref to track if we're in cleanup phase
  const isCleaningUp = useRef(false);

  // Connect to WebSocket when the component mounts if autoConnect is true
  useEffect(() => {
    // Skip if we're cleaning up
    if (isCleaningUp.current) {
      return;
    }

    // Only connect if we have a user with a restaurant_id and autoConnect is not explicitly false
    if (options.autoConnect !== false && user?.restaurant_id && !isConnected) {
      console.debug('[WebSocket] Connection criteria met', {
        autoConnect: options.autoConnect,
        restaurantId: user.restaurant_id,
        isConnected,
        userId: user.id,
        userRole: user.role
      });
      
      // Force a connection attempt immediately
      console.debug('[WebSocket] Initiating immediate connection');
      connect();
      
      // Check connection status after a short delay
      const connectionCheckTimer = setTimeout(() => {
        if (!isCleaningUp.current) {
          const isWsConnected = webSocketManager.isConnected();
          console.debug('[WebSocket] Connection check:', { isWsConnected });
          
          // Update our local state based on the WebSocketManager's state
          setIsConnected(isWsConnected);
          
          // If not connected, try again
          if (!isWsConnected) {
            console.debug('[WebSocket] Connection not established, retrying...');
            connect();
          }
        }
      }, 2000);
      
      return () => {
        clearTimeout(connectionCheckTimer);
      };
    } else {
      console.debug('[WebSocket] Connection criteria NOT met', {
        autoConnect: options.autoConnect,
        hasUser: !!user,
        hasRestaurantId: !!user?.restaurant_id,
        isConnected
      });
    }
  }, [connect, options.autoConnect, user?.restaurant_id, isConnected]);
  
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      isCleaningUp.current = true;
      if (isConnected) {
        console.debug('[WebSocket] Cleaning up connection');
        disconnect('cleanup');
      }
    };
  }, [disconnect, isConnected]);

  return {
    isConnected,
    error,
    connect,
    disconnect
  };
};

export default useWebSocket;