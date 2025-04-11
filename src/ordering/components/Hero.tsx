// src/ordering/components/Hero.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ReservationModal } from './reservation/ReservationModal';

import { useRestaurantStore } from '../../shared/store/restaurantStore';
import { useSiteSettingsStore } from '../store/siteSettingsStore';
// TODO: Replace with Shimizu-specific hero image once available
import fallbackHero from '../assets/hafaloha_hero.webp';
import OptimizedImage from '../../shared/components/ui/OptimizedImage';

export function Hero() {
  const [showReservationModal, setShowReservationModal] = useState(false);

  // Get the restaurant from the store
  const restaurant = useRestaurantStore((state) => state.restaurant);
  
  // Pull the dynamic heroImageUrl from the restaurant's admin_settings or fall back to the site settings
  const siteHeroImageUrl = useSiteSettingsStore((state) => state.heroImageUrl);
  const restaurantHeroImageUrl = restaurant?.admin_settings?.hero_image_url;
  
  // Priority: 1. Restaurant's hero image, 2. Site settings hero image, 3. Fallback image
  const backgroundImage = restaurantHeroImageUrl || siteHeroImageUrl || fallbackHero;

  return (
    <div className="relative bg-gray-900">
      <div className="absolute inset-0">
        <OptimizedImage
          className="w-full h-full object-cover"
          src={backgroundImage}
          alt="Restaurant backdrop"
          width="1920"
          height="1080"
          priority={true}
          fetchPriority="high"
          context="hero"
        />
        <div className="absolute inset-0 bg-gray-900 opacity-75" />
      </div>

      <div className="relative max-w-7xl mx-auto py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
          Modern Restaurant Management System
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-3xl">
          A complete solution for restaurants to manage orders, reservations,
          and customer relationships in one place
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            to="/menu"
            className="inline-flex items-center justify-center px-6 py-3
                       border border-transparent text-base font-medium rounded-md 
                       text-gray-900 bg-shimizu-blue
                       hover:bg-shimizu-light-blue transition-colors duration-150"
          >
            Order Now
          </Link>
          {/* Book Your Table button temporarily hidden
          <button
            onClick={() => setShowReservationModal(true)}
            className="inline-flex items-center justify-center px-6 py-3
                       border-2 border-shimizu-blue
                       text-base font-medium rounded-md text-white
                       hover:bg-shimizu-blue transition-colors duration-150"
          >
            Book Your Table
          </button>
          */}
        </div>
      </div>

      {/* Reservation Modal */}
      <ReservationModal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
      />
    </div>
  );
}
