// src/shared/components/navigation/Footer.tsx

import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { useRestaurantStore } from '../../store/restaurantStore';
import { formatPhoneNumber } from '../../utils/formatters';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { restaurant } = useRestaurantStore();
  
  // No need to fetch restaurant data here as it's already being handled by RestaurantProvider
  // This prevents duplicate API calls

  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-bold text-[#0078d4] mb-4">Shimizu Technology</h2>
            <p className="text-gray-300 mb-4">
              A complete restaurant management system with online ordering, reservations,
              and customer relationship management in one integrated platform.
            </p>
            <div className="flex space-x-4">
              {restaurant?.facebook_url && (
                <a
                  href={restaurant.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-shimizu-blue"
                >
                  <Facebook />
                </a>
              )}
              {restaurant?.instagram_url && (
                <a
                  href={restaurant.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-shimizu-blue"
                >
                  <Instagram />
                </a>
              )}
              {restaurant?.twitter_url && (
                <a
                  href={restaurant.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-shimizu-blue"
                >
                  <Twitter />
                </a>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-300 hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/menu" className="text-gray-300 hover:text-white">
                  Menu
                </Link>
              </li>
              <li>
                <Link to="/reservations" className="text-gray-300 hover:text-white">
                  Reservations
                </Link>
              </li>
              <li>
                <Link to="/cart" className="text-gray-300 hover:text-white">
                  Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <address className="not-italic text-gray-300 space-y-2">
              <p>{restaurant?.address || "955 Pale San Vitores Rd"}</p>
              <p>Tamuning, Guam 96913</p>
              <p>Phone: {formatPhoneNumber(restaurant?.phone_number) || "+1 (671) 989-3444"}</p>
              <p>Email: {restaurant?.contact_email || "ShimizuTechnology@gmail.com"}</p>
            </address>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} Shimizu Technology. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
