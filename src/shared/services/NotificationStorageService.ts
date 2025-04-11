// src/shared/services/NotificationStorageService.ts

import { Notification } from '../api/endpoints/notifications';

/**
 * Interface for a stored notification with additional metadata
 */
export interface StoredNotification extends Notification {
  displayTimestamp?: number;
  acknowledgedLocally?: boolean;
  syncedWithServer?: boolean;
  retryCount?: number;
}

/**
 * NotificationStorageService - A centralized service for managing notification storage
 * and synchronization with the server.
 */
class NotificationStorageService {
  private static instance: NotificationStorageService;
  private notifications: Map<number, StoredNotification> = new Map();
  private pendingAcknowledgments: Set<number> = new Set();
  private lastSyncTimestamp: number = 0;
  private syncInProgress: boolean = false;
  private maxRetryCount: number = 3;
  private storageKey: string = 'shimizu_notifications';
  private pendingAcknowledgmentsKey: string = 'shimizu_pending_acknowledgments';
  private lastSyncKey: string = 'shimizu_last_notification_sync';
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.loadFromLocalStorage();
    
    // Set up auto-sync interval (every 5 minutes)
    setInterval(() => this.syncWithServer(), 5 * 60 * 1000);
    
    // Listen for online events to sync when connection is restored
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkOnline);
    }
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): NotificationStorageService {
    if (!NotificationStorageService.instance) {
      NotificationStorageService.instance = new NotificationStorageService();
    }
    return NotificationStorageService.instance;
  }
  
  /**
   * Handle network coming back online
   */
  private handleNetworkOnline = () => {
    console.debug('[NotificationStorageService] Network online, syncing notifications');
    this.syncWithServer();
  }
  
  /**
   * Load notifications from local storage
   */
  private loadFromLocalStorage(): void {
    try {
      // Load stored notifications
      const storedNotifications = localStorage.getItem(this.storageKey);
      if (storedNotifications) {
        const parsedNotifications = JSON.parse(storedNotifications) as StoredNotification[];
        parsedNotifications.forEach(notification => {
          this.notifications.set(notification.id, notification);
        });
      }
      
      // Load pending acknowledgments
      const storedPendingAcks = localStorage.getItem(this.pendingAcknowledgmentsKey);
      if (storedPendingAcks) {
        const parsedPendingAcks = JSON.parse(storedPendingAcks) as number[];
        parsedPendingAcks.forEach(id => {
          this.pendingAcknowledgments.add(id);
        });
      }
      
      // Load last sync timestamp
      const storedLastSync = localStorage.getItem(this.lastSyncKey);
      if (storedLastSync) {
        this.lastSyncTimestamp = parseInt(storedLastSync, 10);
      }
      
      console.debug('[NotificationStorageService] Loaded from local storage', {
        notificationCount: this.notifications.size,
        pendingAcknowledgments: this.pendingAcknowledgments.size,
        lastSync: new Date(this.lastSyncTimestamp).toISOString()
      });
    } catch (error) {
      console.error('[NotificationStorageService] Error loading from local storage:', error);
      // Reset storage in case of corruption
      this.notifications.clear();
      this.pendingAcknowledgments.clear();
      this.lastSyncTimestamp = 0;
      this.saveToLocalStorage();
    }
  }
  
  /**
   * Save notifications to local storage
   */
  private saveToLocalStorage(): void {
    try {
      // Save notifications
      const notificationsArray = Array.from(this.notifications.values());
      localStorage.setItem(this.storageKey, JSON.stringify(notificationsArray));
      
      // Save pending acknowledgments
      const pendingAcksArray = Array.from(this.pendingAcknowledgments);
      localStorage.setItem(this.pendingAcknowledgmentsKey, JSON.stringify(pendingAcksArray));
      
      // Save last sync timestamp
      localStorage.setItem(this.lastSyncKey, this.lastSyncTimestamp.toString());
    } catch (error) {
      console.error('[NotificationStorageService] Error saving to local storage:', error);
    }
  }
  
  /**
   * Add a notification to storage
   * @param notification The notification to store
   * @param options Optional parameters for storing the notification
   */
  public addNotification(
    notification: Notification,
    options: {
      displayTimestamp?: number;
      acknowledgedLocally?: boolean;
      syncedWithServer?: boolean;
    } = {}
  ): void {
    const storedNotification: StoredNotification = {
      ...notification,
      displayTimestamp: options.displayTimestamp || Date.now(),
      acknowledgedLocally: options.acknowledgedLocally || false,
      syncedWithServer: options.syncedWithServer || false,
      retryCount: 0
    };
    
    this.notifications.set(notification.id, storedNotification);
    this.saveToLocalStorage();
  }
  
  /**
   * Get all stored notifications
   * @param options Optional filtering options
   */
  public getNotifications(options: {
    onlyUnacknowledged?: boolean;
    type?: string;
    since?: number;
  } = {}): StoredNotification[] {
    const notifications = Array.from(this.notifications.values());
    
    return notifications.filter(notification => {
      // Filter by acknowledgment status if specified
      if (options.onlyUnacknowledged && 
          (notification.acknowledgedLocally || notification.acknowledged)) {
        return false;
      }
      
      // Filter by type if specified
      if (options.type && notification.notification_type !== options.type) {
        return false;
      }
      
      // Filter by timestamp if specified
      if (options.since && notification.displayTimestamp &&
          notification.displayTimestamp < options.since) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Mark a notification as acknowledged locally
   * @param id The notification ID to acknowledge
   */
  public acknowledgeNotification(id: number): void {
    const notification = this.notifications.get(id);
    
    if (notification) {
      // Update the notification
      notification.acknowledgedLocally = true;
      this.notifications.set(id, notification);
      
      // Add to pending acknowledgments for server sync
      this.pendingAcknowledgments.add(id);
      
      // Save changes
      this.saveToLocalStorage();
      
      // Try to sync with server
      this.syncWithServer();
    }
  }
  
  /**
   * Sync pending acknowledgments with the server
   */
  public async syncWithServer(): Promise<void> {
    // Prevent multiple syncs from running simultaneously
    if (this.syncInProgress || this.pendingAcknowledgments.size === 0) {
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      // Get all pending acknowledgments
      const pendingAcks = Array.from(this.pendingAcknowledgments);
      
      // Process each pending acknowledgment
      for (const id of pendingAcks) {
        try {
          // Import dynamically to avoid circular dependencies
          const { acknowledgeNotification } = await import('../api/endpoints/notifications');
          
          // Send acknowledgment to server
          await acknowledgeNotification(id);
          
          // Update notification and remove from pending list
          const notification = this.notifications.get(id);
          if (notification) {
            notification.syncedWithServer = true;
            notification.acknowledged = true;
            this.notifications.set(id, notification);
          }
          
          this.pendingAcknowledgments.delete(id);
        } catch (error) {
          console.error(`[NotificationStorageService] Error acknowledging notification ${id}:`, error);
          
          // Increment retry count
          const notification = this.notifications.get(id);
          if (notification) {
            notification.retryCount = (notification.retryCount || 0) + 1;
            
            // If we've exceeded max retries, remove from pending list
            if (notification.retryCount >= this.maxRetryCount) {
              console.warn(`[NotificationStorageService] Max retries exceeded for notification ${id}, removing from pending list`);
              this.pendingAcknowledgments.delete(id);
            }
            
            this.notifications.set(id, notification);
          }
        }
      }
      
      // Update last sync timestamp
      this.lastSyncTimestamp = Date.now();
      
      // Save changes
      this.saveToLocalStorage();
    } catch (error) {
      console.error('[NotificationStorageService] Error syncing with server:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Fetch missed notifications from the server
   * @param since Optional timestamp to fetch notifications since
   */
  public async fetchMissedNotifications(since?: number): Promise<StoredNotification[]> {
    try {
      // Import dynamically to avoid circular dependencies
      const { getUnacknowledgedNotifications } = await import('../api/endpoints/notifications');
      
      // Calculate hours since last sync (or use default of 24 hours)
      const sinceDatetime = since || this.lastSyncTimestamp;
      const hoursSince = sinceDatetime ? 
        Math.ceil((Date.now() - sinceDatetime) / (1000 * 60 * 60)) : 24;
      
      // Fetch unacknowledged notifications from server
      const notifications = await getUnacknowledgedNotifications(undefined, hoursSince);
      
      // Process and store each notification
      notifications.forEach(notification => {
        // Check if we already have this notification
        const existingNotification = this.notifications.get(notification.id);
        
        if (!existingNotification) {
          // This is a new notification
          this.addNotification(notification, {
            syncedWithServer: true
          });
        } else if (!existingNotification.syncedWithServer) {
          // Update existing notification with server data
          this.notifications.set(notification.id, {
            ...notification,
            displayTimestamp: existingNotification.displayTimestamp,
            acknowledgedLocally: existingNotification.acknowledgedLocally,
            syncedWithServer: true,
            retryCount: existingNotification.retryCount
          });
        }
      });
      
      // Save changes
      this.saveToLocalStorage();
      
      // Update last sync timestamp
      this.lastSyncTimestamp = Date.now();
      this.saveToLocalStorage();
      
      return this.getNotifications({ onlyUnacknowledged: true });
    } catch (error) {
      console.error('[NotificationStorageService] Error fetching missed notifications:', error);
      return [];
    }
  }
  
  /**
   * Check if a notification has been acknowledged locally
   * @param id The notification ID to check
   */
  public isAcknowledgedLocally(id: number): boolean {
    const notification = this.notifications.get(id);
    return notification ? (notification.acknowledgedLocally || notification.acknowledged) : false;
  }
  
  /**
   * Clear old notifications (older than the specified days)
   * @param days Number of days to keep notifications for
   */
  public clearOldNotifications(days: number = 7): void {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Find notifications to remove
    const notificationsToRemove: number[] = [];
    
    this.notifications.forEach((notification, id) => {
      // Only remove acknowledged notifications that are older than the cutoff
      if ((notification.acknowledgedLocally || notification.acknowledged) && 
          notification.displayTimestamp && notification.displayTimestamp < cutoffTime) {
        notificationsToRemove.push(id);
      }
    });
    
    // Remove the notifications
    notificationsToRemove.forEach(id => {
      this.notifications.delete(id);
      this.pendingAcknowledgments.delete(id);
    });
    
    if (notificationsToRemove.length > 0) {
      console.debug(`[NotificationStorageService] Cleared ${notificationsToRemove.length} old notifications`);
      this.saveToLocalStorage();
    }
  }
  
  /**
   * Clean up resources when the service is no longer needed
   */
  public cleanup(): void {
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline);
    }
  }
}

// Export the singleton instance
export const notificationStorageService = NotificationStorageService.getInstance();

export default notificationStorageService;
