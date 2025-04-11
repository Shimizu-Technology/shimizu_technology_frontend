// src/shared/services/PollingManager.ts

import { api } from '../../ordering/lib/api';
import webSocketManager from './WebSocketManager';

/**
 * Types of resources that can be polled
 */
export enum PollingResourceType {
  ORDERS = 'orders',
  INVENTORY = 'inventory',
  RESTAURANT = 'restaurant'
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
   * Check if WebSocket is connected and stop polling if it is
   */
  private checkWebSocketStatus(): void {
    if (this.isWebSocketConnected() && this.pollingRegistry.size > 0) {
      console.debug(`[PollingManager] WebSocket is connected, stopping all polling operations (${this.pollingRegistry.size} active)`);
      this.stopAllPolling();
    }
  }
  
  /**
   * Check if WebSocket is connected
   * @returns True if WebSocket is connected
   */
  private isWebSocketConnected(): boolean {
    return webSocketManager.isConnected();
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
    
    // Execute the first poll immediately
    this.executePoll(pollingId);
    
    // Set up the interval
    const interval = entry.options.interval || this.defaultIntervals.get(entry.type) || 30000;
    const intervalId = window.setInterval(() => {
      // Check if WebSocket is connected before polling
      if (this.isWebSocketConnected()) {
        console.debug(`[PollingManager] WebSocket is connected, stopping polling for ${entry.type}`);
        this.stopPolling(pollingId);
        return;
      }
      
      this.executePoll(pollingId);
    }, interval);
    
    // Update the registry entry
    entry.intervalId = intervalId;
    this.pollingRegistry.set(pollingId, entry);
  }
  
  /**
   * Execute a poll for a specific polling ID
   * @param pollingId The polling ID
   */
  private async executePoll(pollingId: string): Promise<void> {
    const entry = this.pollingRegistry.get(pollingId);
    if (!entry) return;
    
    // Double-check WebSocket status before polling
    if (this.isWebSocketConnected()) {
      console.debug(`[PollingManager] WebSocket is connected, skipping poll for ${entry.type}`);
      return;
    }
    
    console.debug(`[PollingManager] Executing poll for ${entry.type} with ID ${pollingId}`);
    
    try {
      // Update last poll time
      entry.lastPollTime = Date.now();
      this.pollingRegistry.set(pollingId, entry);
      
      // Execute the appropriate polling request based on type
      let data;
      switch (entry.type) {
        case PollingResourceType.ORDERS:
          data = await this.pollOrders(entry.options);
          break;
        case PollingResourceType.INVENTORY:
          data = await this.pollInventory(entry.options);
          break;
        case PollingResourceType.RESTAURANT:
          data = await this.pollRestaurant(entry.options);
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
    
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
    
    // Add source ID to identify this as a polling request
    queryParams.append('_sourceId', options.sourceId || 'polling');
    
    // Make the API request
    const response = await api.get(`/orders?${queryParams.toString()}`);
    return response;
  }
  
  /**
   * Poll for inventory
   * @param options The polling options
   * @returns The poll results
   */
  private async pollInventory(options: PollingOptions): Promise<any> {
    const { params = {} } = options;
    
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        queryParams.append(key, String(value));
      }
    });
    
    // Add source ID to identify this as a polling request
    queryParams.append('_sourceId', options.sourceId || 'polling');
    
    // Make the API request
    const response = await api.get(`/menu_items?${queryParams.toString()}`);
    return response;
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
    
    // Make the API request
    const response = await api.get(`/restaurants/${resourceId}`);
    return response;
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
