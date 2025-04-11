// src/shared/components/ui/LoadingSpinner.tsx
import React from 'react';
import { useRestaurantStore } from '../../store/restaurantStore';
import { useSiteSettingsStore } from '../../store/siteSettingsStore';
import fallbackSpinner from '../../assets/Hafaloha-Fat-Pua.png';

interface LoadingSpinnerProps {
  className?: string;
  showText?: boolean;
  text?: string;
}

export function LoadingSpinner({ className = '', showText = true, text = "Loading..." }: LoadingSpinnerProps) {
  // Get the restaurant from the store
  const restaurant = useRestaurantStore((state) => state.restaurant);
  
  // Grab the dynamic spinner URLs
  const siteSpinnerUrl = useSiteSettingsStore((state) => state.spinnerImageUrl);
  const restaurantSpinnerUrl = restaurant?.admin_settings?.spinner_image_url;
  
  // Priority: 1. Restaurant's spinner image, 2. Site settings spinner image, 3. Fallback image
  const finalSpinner = restaurantSpinnerUrl || siteSpinnerUrl || fallbackSpinner;

  return (
    <div className={`bg-gray-800 p-4 rounded flex flex-col items-center justify-center animate-fadeIn transition-all duration-300 ease-in-out ${className}`}>
      <div className="bg-white p-2 rounded mb-2">
        <img
          src={finalSpinner}
          alt="Loading..."
          className="h-16 w-16 animate-spin object-contain"
        />
      </div>
      {showText && (
        <p className="text-white font-medium">{text}</p>
      )}
    </div>
  );
}
