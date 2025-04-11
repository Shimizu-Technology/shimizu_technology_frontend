# Order Notification System - Frontend Documentation

## Overview

The Order Notification System in the Hafaloha frontend provides real-time notifications for new orders and inventory changes. This document outlines the frontend implementation, focusing on WebSocket connections, notification handling, deduplication mechanisms, and fallback strategies.

## Core Components

### 1. WebSocketManager

The `WebSocketManager` is a singleton service that centralizes WebSocket connection management:

```typescript
// src/shared/services/WebSocketManager.ts
class WebSocketManager {
  private static instance: WebSocketManager;
  private handlers: Map<NotificationType, Set<NotificationHandler>> = new Map();
  private socket: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private notificationRegistry: NotificationRegistry = new NotificationRegistry();
  
  // ...methods for connection management and notification handling
}
```

Key responsibilities:
- Establishing and maintaining WebSocket connections
- Handling reconnection logic
- Registering notification handlers
- Processing incoming notifications
- Preventing duplicate notifications

### 2. NotificationStorageService

The `NotificationStorageService` manages notification persistence and synchronization:

```typescript
// src/shared/services/NotificationStorageService.ts
class NotificationStorageService {
  private static instance: NotificationStorageService;
  private notifications: Map<number, StoredNotification> = new Map();
  private pendingAcknowledgments: Set<number> = new Set();
  
  // ...methods for notification storage and synchronization
}
```

Key responsibilities:
- Storing notifications in local storage
- Tracking notification acknowledgment status
- Synchronizing with the server when connection is available
- Fetching missed notifications during offline periods

### 3. NotificationRegistry

The `NotificationRegistry` tracks displayed notifications to prevent duplicates:

```typescript
// Part of WebSocketManager.ts
class NotificationRegistry {
  private displayedNotifications: Set<string> = new Set();
  
  // Methods for tracking displayed notifications
  public markAsDisplayed(notification: Notification): void {
    const key = this.getNotificationKey(notification);
    this.displayedNotifications.add(key);
    this.cleanupOldEntries();
  }
  
  public hasBeenDisplayed(notification: Notification): boolean {
    const key = this.getNotificationKey(notification);
    return this.displayedNotifications.has(key);
  }
  
  // ...other methods
}
```

### 4. PollingManager

The `PollingManager` provides a fallback mechanism when WebSocket connections fail:

```typescript
// src/shared/services/PollingManager.ts
class PollingManager {
  private static instance: PollingManager;
  private pollingRegistry: Map<string, PollingRegistryEntry> = new Map();
  
  // ...methods for managing polling operations
}
```

Key responsibilities:
- Starting and stopping polling operations
- Coordinating with WebSocketManager to avoid redundant requests
- Executing API calls at specified intervals
- Handling responses and notifying registered handlers

## Connection Management

### WebSocket Connection Flow

1. **Initialization**:
   ```typescript
   // Initialize connection when app starts
   webSocketManager.connect(restaurantId, authToken);
   ```

2. **Connection States**:
   - `DISCONNECTED`: No active connection
   - `CONNECTING`: Attempting to establish connection
   - `CONNECTED`: Connection established
   - `RECONNECTING`: Attempting to reconnect after failure

3. **Reconnection Strategy**:
   ```typescript
   private reconnect(): void {
     if (this.reconnectAttempts >= this.maxReconnectAttempts) {
       this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
       return;
     }
     
     this.reconnectAttempts++;
     const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
     
     setTimeout(() => {
       this.setConnectionStatus(ConnectionStatus.RECONNECTING);
       this.connect(this.restaurantId, this.authToken);
     }, delay);
   }
   ```

4. **Connection Monitoring**:
   ```typescript
   private setupSocketEventHandlers(): void {
     if (!this.socket) return;
     
     this.socket.onopen = this.handleSocketOpen;
     this.socket.onclose = this.handleSocketClose;
     this.socket.onerror = this.handleSocketError;
     this.socket.onmessage = this.handleSocketMessage;
   }
   ```

## Notification Handling

### Registration Flow

Components register handlers for specific notification types:

```typescript
// In a component
useEffect(() => {
  // Register handler for order notifications
  const unregister = webSocketManager.registerHandler(
    NotificationType.ORDER,
    handleOrderNotification
  );
  
  // Cleanup on unmount
  return () => unregister();
}, []);
```

### Processing Flow

1. **Receive Message**:
   ```typescript
   private handleSocketMessage = (event: MessageEvent): void => {
     try {
       const data = JSON.parse(event.data);
       this.processMessage(data);
     } catch (error) {
       console.error('[WebSocketManager] Error processing message:', error);
     }
   };
   ```

2. **Process Notification**:
   ```typescript
   private processNotification(notification: Notification): void {
     // Check if this notification has already been displayed
     if (this.notificationRegistry.hasBeenDisplayed(notification)) {
       console.debug('[WebSocketManager] Skipping duplicate notification:', notification);
       return;
     }
     
     // Mark as displayed to prevent duplicates
     this.notificationRegistry.markAsDisplayed(notification);
     
     // Store in notification service
     notificationStorageService.addNotification(notification);
     
     // Notify handlers
     const notificationType = notification.notification_type as NotificationType;
     const handlers = this.handlers.get(notificationType) || new Set();
     
     handlers.forEach(handler => {
       try {
         handler(notification);
       } catch (error) {
         console.error('[WebSocketManager] Error in notification handler:', error);
       }
     });
   }
   ```

## Deduplication Mechanism

The frontend implements a multi-layered approach to prevent duplicate notifications:

1. **Notification Registry**: Tracks notifications that have been displayed
   ```typescript
   public hasBeenDisplayed(notification: Notification): boolean {
     const key = this.getNotificationKey(notification);
     return this.displayedNotifications.has(key);
   }
   
   private getNotificationKey(notification: Notification): string {
     // Create a unique key based on notification properties
     return `${notification.id}:${notification.notification_type}:${notification.resource_type}:${notification.resource_id}`;
   }
   ```

2. **Local Storage Tracking**: Persists notification state across page refreshes
   ```typescript
   public isAcknowledgedLocally(id: number): boolean {
     const notification = this.notifications.get(id);
     return notification ? (notification.acknowledgedLocally || notification.acknowledged) : false;
   }
   ```

3. **Server Synchronization**: Ensures consistent state with the backend
   ```typescript
   public async syncWithServer(): Promise<void> {
     // Sync local acknowledgments with server
     // ...
   }
   ```

## Fallback Polling Mechanism

When WebSocket connections fail, the system falls back to polling:

1. **WebSocket Status Check**:
   ```typescript
   private checkWebSocketStatus(): void {
     if (this.isWebSocketConnected() && this.pollingRegistry.size > 0) {
       console.debug(`[PollingManager] WebSocket is connected, stopping all polling operations`);
       this.stopAllPolling();
     }
   }
   ```

2. **Polling Execution**:
   ```typescript
   private async executePoll(pollingId: string): Promise<void> {
     const entry = this.pollingRegistry.get(pollingId);
     if (!entry) return;
     
     // Double-check WebSocket status before polling
     if (this.isWebSocketConnected()) {
       console.debug(`[PollingManager] WebSocket is connected, skipping poll`);
       return;
     }
     
     // Execute the appropriate polling request
     // ...
   }
   ```

3. **Automatic Transition**:
   - When WebSocket connects, polling automatically stops
   - When WebSocket disconnects, components can start polling

## Integration with UI Components

### Notification Display

```typescript
// In NotificationCenter.tsx
useEffect(() => {
  // Register for all notification types
  const unregisterOrder = webSocketManager.registerHandler(
    NotificationType.ORDER,
    handleNotification
  );
  
  const unregisterInventory = webSocketManager.registerHandler(
    NotificationType.INVENTORY,
    handleNotification
  );
  
  // Load existing notifications
  loadNotifications();
  
  return () => {
    unregisterOrder();
    unregisterInventory();
  };
}, []);

const handleNotification = (notification: Notification) => {
  // Update notification list
  setNotifications(prev => [notification, ...prev]);
  
  // Show toast notification
  showToast(notification);
};
```

### Order Dashboard Integration

```typescript
// In OrderDashboard.tsx
useEffect(() => {
  // Try WebSocket first
  const connected = webSocketManager.isConnected();
  
  if (connected) {
    // Register for order notifications via WebSocket
    const unregister = webSocketManager.registerHandler(
      NotificationType.ORDER,
      handleOrderUpdate
    );
    setUnregisterFn(() => unregister);
  } else {
    // Fall back to polling
    const pollingId = pollingManager.startPolling(
      PollingResourceType.ORDERS,
      handleOrdersPollingResponse
    );
    setPollingId(pollingId);
  }
  
  // Cleanup function
  return () => {
    if (unregisterFn) unregisterFn();
    if (pollingId) pollingManager.stopPolling(pollingId);
  };
}, []);
```

## Best Practices

1. **Always Check Connection Status**:
   ```typescript
   const isConnected = webSocketManager.isConnected();
   if (isConnected) {
     // Use WebSocket
   } else {
     // Fall back to polling
   }
   ```

2. **Handle Reconnection Events**:
   ```typescript
   webSocketManager.onConnectionStatusChange((status) => {
     if (status === ConnectionStatus.CONNECTED) {
       // Stop polling, WebSocket is available
       pollingManager.stopPolling(pollingId);
     } else if (status === ConnectionStatus.DISCONNECTED) {
       // Start polling as fallback
       startPolling();
     }
   });
   ```

3. **Prevent Memory Leaks**:
   ```typescript
   // Always unregister handlers when component unmounts
   useEffect(() => {
     const unregister = webSocketManager.registerHandler(type, handler);
     return () => unregister();
   }, []);
   ```

4. **Handle Offline Scenarios**:
   ```typescript
   // Use NotificationStorageService to persist notifications
   const notifications = notificationStorageService.getNotifications();
   
   // Sync when back online
   useEffect(() => {
     const handleOnline = () => {
       notificationStorageService.syncWithServer();
     };
     
     window.addEventListener('online', handleOnline);
     return () => window.removeEventListener('online', handleOnline);
   }, []);
   ```

## Troubleshooting

### Common Issues

1. **Missing Notifications**
   - Check WebSocket connection status
   - Verify handler registration
   - Check browser console for connection errors
   - Ensure notification types match between backend and frontend

2. **Duplicate Notifications**
   - Check NotificationRegistry implementation
   - Verify notification key generation logic
   - Look for multiple handler registrations

3. **Performance Issues**
   - Limit the number of stored notifications
   - Implement pagination for notification displays
   - Clear old notifications periodically

4. **Reconnection Problems**
   - Check network connectivity
   - Verify authentication token validity
   - Review reconnection logic and exponential backoff

## Testing

To ensure reliable notification delivery, test the following scenarios:

1. **Connection Scenarios**:
   - Initial connection establishment
   - Connection loss and automatic reconnection
   - Manual reconnection
   - Authentication expiration and renewal

2. **Notification Handling**:
   - Multiple notifications of the same type
   - Notifications with identical content
   - High volume of notifications
   - Notifications during offline periods

3. **Fallback Mechanism**:
   - Transition from WebSocket to polling
   - Transition from polling to WebSocket
   - Long-term polling operation
   - Polling during intermittent connectivity
