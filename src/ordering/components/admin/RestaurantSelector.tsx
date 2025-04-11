import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface Restaurant {
  id: string;
  name: string;
}

interface RestaurantSelectorProps {
  onRestaurantChange?: (restaurantId: string) => void;
}

export default function RestaurantSelector({ onRestaurantChange }: RestaurantSelectorProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    // Set the initial selected restaurant to the user's restaurant_id if available
    if (user?.restaurant_id && !selectedRestaurantId) {
      setSelectedRestaurantId(user.restaurant_id);
    }
  }, [user, selectedRestaurantId]);

  const fetchRestaurants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Restaurant[]>('/admin/restaurants');
      const restaurantList = Array.isArray(response) ? response : [];
      setRestaurants(restaurantList);
      
      // If we have restaurants and no selection yet, select the first one
      if (restaurantList.length > 0 && !selectedRestaurantId) {
        const initialRestaurantId = user?.restaurant_id || restaurantList[0].id;
        setSelectedRestaurantId(initialRestaurantId);
        if (onRestaurantChange) {
          onRestaurantChange(initialRestaurantId);
        }
      }
    } catch (err: any) {
      setError(`Failed to load restaurants: ${err.message}`);
      console.error('Error fetching restaurants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestaurantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRestaurantId = e.target.value;
    setSelectedRestaurantId(newRestaurantId);
    if (onRestaurantChange) {
      onRestaurantChange(newRestaurantId);
    }
  };

  // Only show the selector if the user has access to multiple restaurants
  if (restaurants.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4">
      <label htmlFor="restaurant-selector" className="block text-sm font-medium text-gray-700 mb-1">
        Select Restaurant
      </label>
      
      {error && (
        <div className="mb-2 p-2 text-sm bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <select
        id="restaurant-selector"
        value={selectedRestaurantId}
        onChange={handleRestaurantChange}
        disabled={isLoading}
        className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        {isLoading ? (
          <option>Loading restaurants...</option>
        ) : (
          restaurants.map(restaurant => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))
        )}
      </select>
      
      <p className="mt-1 text-xs text-gray-500">
        Switching restaurants will change the context for all operations.
      </p>
    </div>
  );
}
