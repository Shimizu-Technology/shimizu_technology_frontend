// src/shared/components/restaurant/RestaurantProvider.tsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRestaurantStore } from '../../store/restaurantStore';
import { websocketService } from '../../services/websocketService';

interface RestaurantProviderProps {
  children: React.ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const { fetchRestaurant: originalFetchRestaurant, restaurant } = useRestaurantStore();
  const [pollingActive, setPollingActive] = useState(false);
  const pollingIntervalRef = useRef<number | null>(null);
  const hasSubscribedRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  
  // Debounced version of fetchRestaurant to prevent multiple calls in quick succession
  const fetchRestaurant = useCallback(() => {
    const now = Date.now();
    // Only fetch if it's been at least 2 seconds since the last fetch
    if (now - lastFetchTimeRef.current > 2000) {
      lastFetchTimeRef.current = now;
      return originalFetchRestaurant();
    }
    return Promise.resolve();
  }, [originalFetchRestaurant]);
  
  // Initial data fetching setup - only runs once on mount
  useEffect(() => {
    console.debug('RestaurantProvider mounted, performing initial setup');
    
    // Initial fetch of restaurant data
    fetchRestaurant();
    
    // Only start polling if WebSocket is not connected
    if (!websocketService.isConnected()) {
      console.debug('WebSocket not connected, starting polling as fallback');
      startPollingFallback();
    } else {
      console.debug('WebSocket already connected, skipping polling fallback');
    }
    
    // Clean up when the component unmounts
    return () => {
      console.debug('RestaurantProvider unmounting, cleaning up resources');
      stopPollingFallback();
    };
  }, []); // Empty dependency array ensures this only runs once on mount
  
  // Track the restaurant ID to detect real changes
  const previousRestaurantIdRef = useRef<number | null>(null);
  
  // WebSocket subscription effect - separate from the polling effect
  useEffect(() => {
    // Check if we have a restaurant with an ID
    if (!restaurant?.id) {
      console.debug('No restaurant ID available yet, skipping WebSocket subscription');
      return;
    }
    
    // Check if the restaurant ID has changed
    if (previousRestaurantIdRef.current === restaurant.id) {
      console.debug(`Restaurant ID unchanged (${restaurant.id}), skipping redundant subscription logic`);
      return;
    }
    
    // Update the previous restaurant ID ref
    previousRestaurantIdRef.current = restaurant.id;
    
    // Check if WebSocket is connected
    if (!websocketService.isConnected()) {
      console.debug('WebSocket not connected, skipping subscription attempt');
      // Ensure polling is active as a fallback
      if (!pollingActive) {
        console.debug('Ensuring polling is active since WebSocket is not connected');
        startPollingFallback();
      }
      return;
    }
    
    // Avoid duplicate subscriptions
    if (hasSubscribedRef.current) {
      console.debug('Already subscribed to RestaurantChannel, skipping duplicate subscription');
      return;
    }
    
    const restaurantId = restaurant.id.toString();
    console.debug(`Attempting to subscribe to RestaurantChannel with ID: ${restaurantId}`);
    
    try {
      // Subscribe to the restaurant channel
      websocketService.subscribe({
        channel: 'RestaurantChannel',
        params: { restaurant_id: restaurantId },
        received: (data) => {
          // Handle restaurant updates
          if (data.type === 'restaurant_update') {
            console.debug('Received restaurant update via WebSocket:', data);
            // Refresh restaurant data when an update is received
            fetchRestaurant();
          } else {
            console.debug('Received unknown message type from RestaurantChannel:', data);
          }
        },
        connected: () => {
          console.debug('Connected to restaurant channel successfully');
          hasSubscribedRef.current = true;
          // Stop polling if it was active
          if (pollingActive) {
            console.debug('WebSocket channel connected, stopping polling fallback');
            stopPollingFallback();
          }
        },
        disconnected: () => {
          console.debug('Disconnected from restaurant channel');
          hasSubscribedRef.current = false;
          // Fall back to polling if WebSocket disconnects
          if (!pollingActive) {
            console.debug('Starting polling fallback due to channel disconnection');
            startPollingFallback();
          }
        },
        rejected: () => {
          console.debug('Restaurant channel subscription rejected');
          hasSubscribedRef.current = false;
          // Fall back to polling if WebSocket subscription is rejected
          if (!pollingActive) {
            console.debug('Starting polling fallback due to subscription rejection');
            startPollingFallback();
          }
        }
      });
    } catch (error) {
      console.error('Error connecting to WebSocket for restaurant updates:', error);
      hasSubscribedRef.current = false;
      // Fall back to polling if WebSocket connection fails
      if (!pollingActive) {
        console.debug('Starting polling fallback due to subscription error');
        startPollingFallback();
      }
    }
    
    // Clean up WebSocket subscription when the component unmounts or restaurant changes
    return () => {
      if (hasSubscribedRef.current) {
        try {
          console.debug('Unsubscribing from RestaurantChannel');
          websocketService.unsubscribe('RestaurantChannel');
          hasSubscribedRef.current = false;
        } catch (error) {
          console.error('Error unsubscribing from restaurant channel:', error);
        }
      }
    };
  }, [restaurant, fetchRestaurant]); // Only re-run when restaurant changes
  
  // WebSocket connection status listener
  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      console.debug(`WebSocket connection changed: ${connected ? 'connected' : 'disconnected'}`);
      
      if (!connected) {
        // If WebSocket disconnects, reset the subscription flag and ensure polling is active
        if (hasSubscribedRef.current) {
          console.debug('WebSocket disconnected while subscribed, resetting subscription state');
          hasSubscribedRef.current = false;
        }
        
        // Only start polling if it's not already active
        if (!pollingActive) {
          console.debug('Starting polling fallback due to WebSocket disconnection');
          startPollingFallback();
        } else {
          console.debug('Polling already active, not starting again');
        }
      } else if (connected) {
        // If WebSocket connects
        if (restaurant?.id) {
          // If we have restaurant data, the subscription effect will handle subscribing
          // We don't need to do anything special here - the subscription effect will
          // detect the connection is available on its next run
          console.debug('WebSocket connected with restaurant data available');
          
          // Force the subscription effect to re-evaluate by updating the previousRestaurantIdRef
          // This is a more controlled way to trigger the subscription logic without causing an API call
          if (previousRestaurantIdRef.current === restaurant.id) {
            previousRestaurantIdRef.current = null; // Reset to force re-evaluation
          }
          
          // Don't stop polling yet - wait for the channel subscription to be confirmed
          // The channel's 'connected' callback will stop polling when the subscription is successful
          console.debug('WebSocket connected, waiting for channel subscription before stopping polling');
        } else {
          console.debug('WebSocket connected but no restaurant data yet, keeping polling active');
        }
      }
    };
    
    // Listen for WebSocket connection changes
    websocketService.onConnectionChange(handleConnectionChange);
    
    return () => {
      // Clean up the listener
      websocketService.offConnectionChange(handleConnectionChange);
    };
  }, [restaurant, pollingActive]); // Remove fetchRestaurant from dependencies to prevent unnecessary re-renders
  
  // Fallback polling functions using PollingManager instead of direct intervals
  const startPollingFallback = () => {
    // Don't start polling if it's already active or if WebSocket is connected and subscribed
    if (pollingActive || (websocketService.isConnected() && hasSubscribedRef.current)) {
      console.debug('Not starting polling: already active or WebSocket is connected and subscribed');
      return;
    }
    
    console.debug('Starting restaurant polling fallback via PollingManager');
    setPollingActive(true);
    
    // Clean up any existing interval (shouldn't be necessary but just to be safe)
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // We're not setting up a direct interval anymore - PollingManager will handle this
    // The actual polling will be managed by the WebSocketManager and PollingManager
  };
  
  const stopPollingFallback = () => {
    if (!pollingActive) {
      console.debug('Not stopping polling: already inactive');
      return;
    }
    
    console.debug('Stopping restaurant polling fallback');
    // No need to clear intervals as we're using PollingManager
    // Just update our state
    setPollingActive(false);
  };
  
  return <>{children}</>;
}
