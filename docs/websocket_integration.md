# WebSocket Integration

This document provides a comprehensive guide to the WebSocket implementation in the Hafaloha frontend application, which enables real-time updates for orders, inventory, and other critical data.

## Overview

The Hafaloha application uses WebSockets to provide real-time updates, replacing the previous polling-based approach. This offers several advantages:

- **Real-time Updates**: Instant notification of new orders and inventory changes
- **Reduced Server Load**: Fewer HTTP requests and overhead
- **Lower Latency**: No waiting for the next polling interval
- **Reduced Network Traffic**: Only sending data when there are actual changes
- **Better User Experience**: Immediate updates for admins managing orders

## Architecture

The WebSocket implementation follows a client-server architecture:

1. **Backend (Rails)**: Uses Action Cable for WebSocket support
2. **Frontend (React)**: Uses a custom WebSocket service to manage connections

## Frontend Implementation

### WebSocket Service

The core of the WebSocket implementation is the `WebSocketService` class located in `src/shared/services/websocketService.ts`. This service:

- Manages WebSocket connections
- Handles authentication
- Subscribes to channels
- Processes incoming messages
- Provides reconnection logic

```typescript
// src/shared/services/websocketService.ts
class WebSocketService {
  private socket: WebSocket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private restaurantId: string | null = null;
  private isActive: boolean = false;
  
  // Connect to the WebSocket server
  public connect(restaurantId: string | null = null): void {
    // Implementation details...
  }
  
  // Subscribe to channels
  private subscribe(): void {
    // Implementation details...
  }
  
  // Handle incoming messages
  private handleMessage(event: MessageEvent): void {
    // Implementation details...
  }
  
  // Reconnect logic
  private reconnect(): void {
    // Implementation details...
  }
  
  // Disconnect from the WebSocket server
  public disconnect(reason: string = 'Manual disconnect'): void {
    // Implementation details...
  }
}
```

### React Hook Integration

To make WebSocket integration easy for React components, a custom hook called `useWebSocket` is provided in `src/shared/hooks/useWebSocket.ts`. This hook:

- Manages WebSocket connection lifecycle
- Provides connection status
- Handles callbacks for different message types
- Offers automatic reconnection

```typescript
// src/shared/hooks/useWebSocket.ts
export function useWebSocket({
  autoConnect = true,
  onNewOrder,
  onOrderUpdated,
  onLowStock,
  onConnected,
  onDisconnected,
  onError
}: WebSocketHookOptions): WebSocketHookResult {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Implementation details...
  
  return { isConnected, error, connect, disconnect };
}
```

### Usage in Components

The WebSocket hook is used in components like the AdminDashboard to receive real-time updates:

```tsx
// src/ordering/components/admin/AdminDashboard.tsx
const { isConnected, error: wsError } = useWebSocket({
  autoConnect: USE_WEBSOCKETS && !!user && (user.role === 'admin' || user.role === 'super_admin'),
  onNewOrder: handleNewOrder,
  onLowStock: handleLowStock,
  onConnected: () => {
    console.debug('[WebSocket] Connected successfully', {
      user: user?.id,
      restaurant: user?.restaurant_id,
      role: user?.role
    });
    
    // Clear any existing polling interval when WebSocket connects
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  },
  onDisconnected: () => {
    console.debug('[WebSocket] Disconnected, may fall back to polling');
    
    // If WebSockets are still enabled but we got disconnected, attempt to reconnect
    if (USE_WEBSOCKETS && (user?.role === 'admin' || user?.role === 'super_admin')) {
      console.debug('[WebSocket] Will attempt to reconnect');
    }
  },
  onError: (err) => {
    console.error('[WebSocket] Error:', err);
  }
});
```

### Fallback to Polling

If WebSockets are unavailable or disconnected, the application falls back to polling:

```tsx
// Fallback to polling if WebSockets are disabled or disconnected
useEffect(() => {
  if (!USE_WEBSOCKETS || !isConnected) {
    if (!pollingIntervalRef.current) {
      console.debug('[Polling] Starting polling interval');
      pollingIntervalRef.current = setInterval(() => {
        fetchUnacknowledgedOrders();
        fetchNotifications(24, 'low_stock');
      }, POLLING_INTERVAL);
    }
  }
  
  return () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
}, [USE_WEBSOCKETS, isConnected, fetchUnacknowledgedOrders, fetchNotifications]);
```

## Authentication

WebSocket connections are authenticated using JWT tokens. The token is stored in localStorage and passed as a query parameter when establishing the WebSocket connection:

```typescript
// Get token from localStorage or global state
const token = localStorage.getItem('auth_token') || 
              localStorage.getItem('token') ||
              (window.authStore?.getState()?.token) || '';

// Add token to WebSocket URL
const wsUrl = `${protocol}//${host}/cable?token=${cleanToken}&restaurant_id=${this.restaurantId}`;
```

## Message Handling

The WebSocket service processes different message types and routes them to the appropriate callbacks:

```typescript
private handleMessage(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data);
    
    // Handle different message types
    if (data.type === 'ping' || data.type === 'pong') {
      // Handle ping/pong messages
      return;
    }
    
    if (data.type === 'welcome') {
      // Handle welcome message
      return;
    }
    
    if (data.type === 'confirm_subscription') {
      // Handle subscription confirmation
      return;
    }
    
    // Handle actual data messages
    if (data.message) {
      const message = data.message;
      
      if (message.type === 'new_order' && this.callbacks.onNewOrder) {
        this.callbacks.onNewOrder(message.order);
      } else if (message.type === 'order_updated' && this.callbacks.onOrderUpdated) {
        this.callbacks.onOrderUpdated(message.order);
      } else if (message.type === 'low_stock' && this.callbacks.onLowStock) {
        this.callbacks.onLowStock(message.item);
      }
    }
  } catch (error) {
    this.log('error', 'Error handling WebSocket message', { error });
  }
}
```

## Reconnection Strategy

The WebSocket service implements an exponential backoff strategy for reconnection:

```typescript
private reconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    this.log('warn', 'Maximum reconnection attempts reached, giving up');
    return;
  }
  
  // Calculate delay with exponential backoff
  const delay = Math.min(
    this.maxReconnectDelay,
    this.minReconnectDelay * Math.pow(1.5, this.reconnectAttempts)
  );
  
  this.log('info', `Scheduling reconnection attempt in ${delay}ms`, {
    attempt: this.reconnectAttempts + 1,
    maxAttempts: this.maxReconnectAttempts
  });
  
  this.reconnectTimer = setTimeout(() => {
    this.reconnectAttempts++;
    this.connect(this.restaurantId);
  }, delay);
}
```

## Recent Fixes and Improvements

### WebSocket Stability

Several key issues were resolved to ensure stable WebSocket connections:

1. **Authentication Token Format**: Updated the `authStore` to store the token under both `token` and `auth_token` keys for compatibility.

2. **Unused Event Parameters**: Removed unused event parameters in event handlers to fix lint errors.

3. **Improved Error Handling**: Added better error handling and logging for connection issues.

4. **Backend Connection Fixes**: Fixed issues in the backend connection handling, including the `disconnect` method and EventMachine timer usage.

### Inventory Management Integration

The WebSocket implementation has been enhanced to better support inventory management:

1. **Damaged Item Handling**: Updated the system to correctly track damaged items without affecting stock quantities, ensuring accurate inventory management.

2. **Available Quantity Display**: Modified the frontend to display available quantities as `stock_quantity - damaged_quantity`, providing a more accurate view of inventory status.

3. **Low Stock Notifications**: Enhanced the WebSocket integration to receive and display low stock notifications in real-time, including the available quantity in the notification.

4. **Restaurant ID Resolution**: Improved the backend's ability to determine the correct restaurant ID for different types of models, ensuring broadcasts reach the right clients.

### Menu Item Availability

Fixed an issue with the menu item's available days not being cleared when all days are deselected in the UI. The controller now properly handles the case when no days are selected by setting `available_days` to an empty array, making the item available every day.

## Troubleshooting

### Common Issues and Solutions

1. **Connection Authentication Failures**:
   - Check that the token is being properly passed in the WebSocket URL
   - Verify the token format and expiration
   - Ensure the user has the correct permissions

2. **Message Not Received**:
   - Verify the channel subscription is active
   - Check that the broadcast is targeting the correct channel
   - Ensure the message format matches what the client expects

3. **Connection Drops**:
   - Check the reconnection logic is working properly
   - Look for network issues or proxies that might be terminating idle connections
   - Ensure the backend is properly configured for WebSockets

### Debugging

The WebSocket service includes extensive logging to help with debugging:

```typescript
private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const connectionDuration = this.connectionStartTime
    ? `[${Math.round((Date.now() - this.connectionStartTime) / 1000)}s]`
    : '[Not connected]';
  const socketState = this.socket ?
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] :
    'NULL';
  
  console[level](
    `[WebSocket] ${timestamp} ${connectionDuration} [${socketState}] ${message}`,
    data || {}
  );
}
```

## Future Improvements

1. **Additional Channels**: Implement additional channels for menu updates, user notifications, and other real-time features.

2. **Heartbeat Mechanism**: Add a heartbeat mechanism to keep connections alive and detect disconnections more quickly.

3. **Offline Support**: Implement offline support with message queuing for when the connection is lost.

4. **Connection Status UI**: Add a UI indicator for WebSocket connection status to improve user experience.

5. **Replace All Polling**: Gradually replace all polling-based updates with WebSocket notifications for a more efficient application.
