// src/shared/services/PollingManager.ts

import { api } from '../../ordering/lib/api';
import webSocketManager from './WebSocketManager';

/**
 * Types of resources that can be polled
 */
export enum PollingResourceType {
  ORDERS = 'orders',
  INVENTORY = 'inventory',
  RESTAURANT = 'restaurant',
  MENU_ITEMS = 'menu_items'
}

/**
 * Interface for polling handler
 */
export interface PollingHandler {
  (data: any): void;
}

/**
 * Interface for polling options
 */
export interface PollingOptions {
  interval?: number;
  resourceId?: string | number;
  params?: Record<string, any>;
  sourceId?: string;
  silent?: boolean; // Whether to show loading indicators
}

/**
 * Interface for polling registry entry
 */
interface PollingRegistryEntry {
  id: string;
  type: PollingResourceType;
  intervalId: number | null;
  lastPollTime: number;
  options: PollingOptions;
  handler: PollingHandler;
}

/**
 * PollingManager - A centralized service for managing polling operations
 * and coordinating with WebSocket connections.
 */
class PollingManager {
  private static instance: PollingManager;
  private pollingRegistry: Map<string, PollingRegistryEntry> = new Map();
  private defaultIntervals: Map<PollingResourceType, number> = new Map();
  
  // Private constructor to enforce singleton pattern
  private constructor() {
    // Set default polling intervals (in milliseconds)
    this.defaultIntervals.set(PollingResourceType.ORDERS, 30000); // 30 seconds
    this.defaultIntervals.set(PollingResourceType.INVENTORY, 60000); // 1 minute
    this.defaultIntervals.set(PollingResourceType.RESTAURANT, 60000); // 1 minute
    
    // Set up periodic check to ensure we're not polling when WebSocket is connected
    setInterval(() => this.checkWebSocketStatus(), 10000); // Check every 10 seconds
  }
  
  /**
   * Get the singleton instance of PollingManager
   */
  public static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }
  
  /**
   * Start polling for a specific resource
   * @param type The resource type to poll
   * @param handler The handler function to call with the poll results
   * @param options Additional polling options
   * @returns The polling ID
   */
  public startPolling(
    type: PollingResourceType,
    handler: PollingHandler,
    options: PollingOptions = {}
  ): string {
    // Check if WebSocket is connected for this resource type
    if (this.isWebSocketConnected()) {
      console.debug(`[PollingManager] WebSocket is connected, not starting polling for ${type}`);
      return '';
    }
    
    // Generate a unique ID for this polling operation
    const pollingId = this.generatePollingId(type, options);
    
    // Check if we're already polling this resource
    if (this.pollingRegistry.has(pollingId)) {
      console.debug(`[PollingManager] Already polling ${type} with ID ${pollingId}`);
      return pollingId;
    }
    
    // Get the polling interval
    const interval = options.interval || this.defaultIntervals.get(type) || 30000;
    
    console.debug(`[PollingManager] Starting polling for ${type} with interval ${interval}ms`);
    
    // Create the polling registry entry
    const entry: PollingRegistryEntry = {
      id: pollingId,
      type,
      intervalId: null,
      lastPollTime: 0,
      options,
      handler
    };
    
    // Add to registry
    this.pollingRegistry.set(pollingId, entry);
    
    // Start the polling interval
    this.startPollingInterval(pollingId);
    
    return pollingId;
  }
  
  /**
   * Stop polling for a specific resource
   * @param pollingId The polling ID to stop
   */
  public stopPolling(pollingId: string): void {
    const entry = this.pollingRegistry.get(pollingId);
    if (!entry) {
      console.debug(`[PollingManager] No polling found with ID ${pollingId}`);
      return;
    }
    
    // Clear the interval
    if (entry.intervalId !== null) {
      clearInterval(entry.intervalId);
      entry.intervalId = null;
    }
    
    console.debug(`[PollingManager] Stopped polling for ${entry.type} with ID ${pollingId}`);
    
    // Remove from registry
    this.pollingRegistry.delete(pollingId);
  }
  
  /**
   * Stop all polling operations
   */
  public stopAllPolling(): void {
    console.debug(`[PollingManager] Stopping all polling operations (${this.pollingRegistry.size} active)`);
    
    this.pollingRegistry.forEach((entry, id) => {
      if (entry.intervalId !== null) {
        clearInterval(entry.intervalId);
      }
    });
    
    this.pollingRegistry.clear();
  }
  
  /**
   * Check if WebSocket is connected and manage polling accordingly
   */
  private checkWebSocketStatus(): void {
    const isConnected = this.isWebSocketConnected();
    const hasActivePolling = this.hasActivePolling();
    
    // Log the current status for debugging
    console.debug(`[PollingManager] WebSocket status check: connected=${isConnected}, activePolling=${hasActivePolling}, registrySize=${this.pollingRegistry.size}`);
    
    if (isConnected && hasActivePolling) {
      console.debug(`[PollingManager] WebSocket is connected, pausing all polling operations (${this.pollingRegistry.size} active)`);
      // Instead of stopping, we'll just pause by clearing the intervals
      this.pauseAllPolling();
    } else if (!isConnected && !hasActivePolling && this.pollingRegistry.size > 0) {
      console.debug(`[PollingManager] WebSocket is disconnected, resuming all polling operations (${this.pollingRegistry.size} registered)`);
      // If WebSocket is disconnected, make sure polling is active for registered resources
      this.resumeAllPolling();
    }
  }
  
  /**
   * Check if there are any active polling operations
   * @returns True if there are active polling operations
   */
  private hasActivePolling(): boolean {
    let activeCount = 0;
    this.pollingRegistry.forEach(entry => {
      if (entry.intervalId !== null) {
        activeCount++;
      }
    });
    return activeCount > 0;
  }
  
  /**
   * Pause all polling operations without removing them from the registry
   * This allows us to resume polling if WebSocket disconnects
   */
  private pauseAllPolling(): void {
    this.pollingRegistry.forEach((entry, id) => {
      if (entry.intervalId !== null) {
        clearInterval(entry.intervalId);
        entry.intervalId = null;
        this.pollingRegistry.set(id, entry);
      }
    });
  }
  
  /**
   * Resume all polling operations that were previously paused
   */
  private resumeAllPolling(): void {
    this.pollingRegistry.forEach((entry, id) => {
      if (entry.intervalId === null) {
        this.startPollingInterval(id);
      }
    });
  }
  
  /**
   * Check if WebSocket is connected
   * @returns True if WebSocket is connected
   */
  private isWebSocketConnected(): boolean {
    const isConnected = webSocketManager.isConnected();
    
    // Add a timestamp to the log to help track connection status over time
    const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.sss
    console.debug(`[PollingManager] [${timestamp}] WebSocket connection status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    return isConnected;
  }
  
  /**
   * Generate a unique ID for a polling operation
   * @param type The resource type
   * @param options The polling options
   * @returns A unique ID string
   */
  private generatePollingId(type: PollingResourceType, options: PollingOptions): string {
    const resourceId = options.resourceId ? `_${options.resourceId}` : '';
    return `${type}${resourceId}`;
  }
  
  /**
   * Start the polling interval for a specific polling ID
   * @param pollingId The polling ID
   */
  private startPollingInterval(pollingId: string): void {
    const entry = this.pollingRegistry.get(pollingId);
    if (!entry) return;
    
    // If WebSocket is connected, don't start polling
    if (this.isWebSocketConnected()) {
      console.debug(`[PollingManager] WebSocket is connected, not starting polling for ${entry.type}`);
      return;
    }
    
    // Execute the first poll immediately but only if WebSocket is not connected
    this.executePoll(pollingId, true); // true = silent mode (no loading indicators)
    
    // Set up the interval
    const interval = entry.options.interval || this.defaultIntervals.get(entry.type) || 30000;
    const intervalId = window.setInterval(() => {
      // Check if WebSocket is connected before polling
      if (this.isWebSocketConnected()) {
        console.debug(`[PollingManager] WebSocket is connected, pausing polling for ${entry.type}`);
        // Just clear the interval but keep the entry in the registry
        if (entry.intervalId !== null) {
          clearInterval(entry.intervalId);
          entry.intervalId = null;
          this.pollingRegistry.set(pollingId, entry);
        }
        return;
      }
      
      // Execute poll in silent mode (no loading indicators)
      this.executePoll(pollingId, true);
    }, interval);
    
    // Update the registry entry
    entry.intervalId = intervalId;
    this.pollingRegistry.set(pollingId, entry);
  }
  
  /**
   * Execute a poll for a specific polling ID
   * @param pollingId The polling ID
   * @param silent If true, don't show loading indicators
   */
  private async executePoll(pollingId: string, silent: boolean = false): Promise<void> {
    const entry = this.pollingRegistry.get(pollingId);
    if (!entry) return;
    
    // Double-check WebSocket status before polling
    if (this.isWebSocketConnected()) {
      console.debug(`[PollingManager] WebSocket is connected, skipping poll for ${entry.type}`);
      return;
    }
    
    console.debug(`[PollingManager] Executing poll for ${entry.type} with ID ${pollingId} (silent: ${silent})`);
    
    try {
      // Update last poll time
      entry.lastPollTime = Date.now();
      this.pollingRegistry.set(pollingId, entry);
      
      // Add silent flag to options to prevent loading indicators
      const pollOptions = {
        ...entry.options,
        silent: silent
      };
      
      // Execute the appropriate polling request based on type
      let data;
      switch (entry.type) {
        case PollingResourceType.ORDERS:
          data = await this.pollOrders(pollOptions);
          break;
        case PollingResourceType.INVENTORY:
          data = await this.pollInventory(pollOptions);
          break;
        case PollingResourceType.RESTAURANT:
          data = await this.pollRestaurant(pollOptions);
          break;
        default:
          console.error(`[PollingManager] Unknown polling type: ${entry.type}`);
          return;
      }
      
      // Call the handler with the data
      if (data) {
        entry.handler(data);
      }
    } catch (error) {
      console.error(`[PollingManager] Error polling ${entry.type} with ID ${pollingId}:`, error);
    }
  }
  
  /**
   * Poll for orders
   * @param options The polling options
   * @returns The poll results
   */
  private async pollOrders(options: PollingOptions): Promise<any> {
    const { params = {} } = options;
    
    // Create params object with source ID
    const apiParams = {
      ...params,
      _sourceId: options.sourceId || 'polling'
    };
    
    try {
      // Use the updated API with silent option
      const response = await api.get(
        '/orders',
        apiParams,
        { silent: true } // Always use silent mode for polling
      );
      return response;
    } catch (error) {
      console.error('[PollingManager] Error polling orders:', error);
      return null;
    }
  }
  
  /**
   * Poll for inventory
   * @param options The polling options
   * @returns The poll results
   */
  private async pollInventory(options: PollingOptions): Promise<any> {
    const { params = {} } = options;
    
    // Create params object with source ID
    const apiParams = {
      ...params,
      _sourceId: options.sourceId || 'polling'
    };
    
    try {
      // Use the updated API with silent option
      const response = await api.get(
        '/menu_items',
        apiParams,
        { silent: true } // Always use silent mode for polling
      );
      return response;
    } catch (error) {
      console.error('[PollingManager] Error polling inventory:', error);
      return null;
    }
  }
  
  /**
   * Poll for restaurant
   * @param options The polling options
   * @returns The poll results
   */
  private async pollRestaurant(options: PollingOptions): Promise<any> {
    const { resourceId } = options;
    
    if (!resourceId) {
      console.error('[PollingManager] No restaurant ID provided for restaurant polling');
      return null;
    }
    
    // Use the updated API with silent option
    try {
      // Make the API request with silent flag
      const response = await api.get(
        `/restaurants/${resourceId}`,
        { _sourceId: options.sourceId || 'polling' },
        { silent: true } // Always use silent mode for polling
      );
      return response;
    } catch (error) {
      console.error(`[PollingManager] Error polling restaurant ${resourceId}:`, error);
      return null;
    }
  }
  
  /**
   * Get the status of a polling operation
   * @param pollingId The polling ID
   * @returns The polling status
   */
  public getPollingStatus(pollingId: string): { active: boolean; lastPollTime: number } {
    const entry = this.pollingRegistry.get(pollingId);
    if (!entry) {
      return { active: false, lastPollTime: 0 };
    }
    
    return {
      active: entry.intervalId !== null,
      lastPollTime: entry.lastPollTime
    };
  }
  
  /**
   * Get all active polling operations
   * @returns A map of polling IDs to polling types
   */
  public getActivePolling(): Map<string, PollingResourceType> {
    const activePolling = new Map<string, PollingResourceType>();
    
    this.pollingRegistry.forEach((entry, id) => {
      if (entry.intervalId !== null) {
        activePolling.set(id, entry.type);
      }
    });
    
    return activePolling;
  }
}

// Export the singleton instance
export const pollingManager = PollingManager.getInstance();

export default pollingManager;
