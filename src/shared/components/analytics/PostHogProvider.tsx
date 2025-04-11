import React, { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as OriginalPostHogProvider } from 'posthog-js/react';
import { useAuthStore } from '../../auth';
import { useRestaurantStore } from '../../store/restaurantStore';

// Options for PostHog initialization
const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  disable_session_recording: false, // Enable session recording
  // Add safe localStorage handling for incognito mode
  persistence: "memory" as "memory", // Use memory persistence in incognito mode
  bootstrap: {
    distinctID: `anonymous-${Date.now()}`, // Generate a temporary ID
  },
};

// Check if we're likely in incognito mode
const isIncognitoMode = () => {
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return false;
  } catch (e) {
    return true;
  }
};

// Create wrapper component to handle restaurant context
const PostHogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use state to track if we've initialized safely
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Only use these hooks if we're not in incognito mode
  const authStore = !isIncognitoMode() ? useAuthStore() : { user: null };
  const restaurantStore = !isIncognitoMode() ? useRestaurantStore() : { restaurant: null };
  
  const { user } = authStore;
  const { restaurant } = restaurantStore;
  
  // Initialize PostHog safely
  useEffect(() => {
    try {
      // Mark as initialized
      setIsInitialized(true);
      
      // In incognito mode, use an anonymous ID
      const inIncognito = isIncognitoMode();
      if (inIncognito) {
        posthog.identify(`anonymous-${Date.now()}`);
        return; // Skip the rest in incognito mode
      }
      
      // Identify user when they log in
      if (user) {
        posthog.identify(
          user.id.toString(),
          {
            email: user.email,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            role: user.role,
            restaurant_id: user.restaurant_id,
            phone_verified: user.phone_verified
          }
        );
      }
      
      // Set up restaurant as a group when available
      if (restaurant) {
        posthog.group('restaurant', restaurant.id.toString(), {
          name: restaurant.name,
          address: restaurant.address,
          time_zone: restaurant.time_zone,
          vip_enabled: restaurant.vip_enabled
        });
      }
    } catch (error) {
      // Continue rendering the app even if PostHog fails
      // Continue rendering the app even if PostHog fails
    }
  }, [user, restaurant]);

  return (
    <OriginalPostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={posthogOptions}
    >
      {children}
    </OriginalPostHogProvider>
  );
};

export default PostHogProvider;
