// src/shared/config.ts

// Environment variables
export const config = {
  // API base URL
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  // Default restaurant ID (for Shimizu Technology)
  restaurantId: import.meta.env.VITE_RESTAURANT_ID || '2',
  
  // Other environment variables can be added here
};
