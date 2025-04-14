// src/ordering/components/location/PickupInfo.tsx
import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, Phone } from 'lucide-react';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { formatPhoneNumber } from '../../../shared/utils/formatters';
import { locationsApi } from '../../../shared/api/endpoints/locations';
import { Location } from '../../../shared/types/Location';

interface PickupInfoProps {
  locationId?: number | null;
}

export function PickupInfo({ locationId }: PickupInfoProps = {}) {
  const { restaurant } = useRestaurantStore();
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousLocationId = useRef<number | null | undefined>(null);
  
  // Fetch location details if locationId is provided
  useEffect(() => {
    if (locationId) {
      // Only start transition if the locationId has changed
      if (previousLocationId.current !== locationId) {
        setIsTransitioning(true);
        setIsLoading(true);
        setError(null);
        
        // Small delay before fetching to allow for smooth transition
        const transitionTimer = setTimeout(() => {
          locationsApi.getLocation(locationId)
            .then(locationData => {
              setLocation(locationData);
            })
            .catch(err => {
              console.error('Error fetching location details:', err);
              setError('Failed to load location details');
            })
            .finally(() => {
              setIsLoading(false);
              // Add a small delay before ending the transition to ensure smooth animation
              setTimeout(() => {
                setIsTransitioning(false);
              }, 150);
            });
        }, 150);
        
        previousLocationId.current = locationId;
        return () => clearTimeout(transitionTimer);
      }
    } else {
      // Reset location if locationId is null
      setLocation(null);
      previousLocationId.current = null;
    }
  }, [locationId]);
  
  // Use location info if available, otherwise fall back to restaurant info
  const hasCustomLocation = !!restaurant?.custom_pickup_location;
  const address = location?.address || restaurant?.custom_pickup_location || restaurant?.address || "955 Pale San Vitores Rd, Tamuning, Guam 96913";
  const phoneNumber = formatPhoneNumber(location?.phone_number || restaurant?.phone_number) || "+1 (671) 989-3444";
  const locationTitle = location ? location.name : (hasCustomLocation ? 'Special Pickup Location' : 'Location');
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="bg-white p-2 rounded-lg border border-gray-200">
      {/* Add transition classes */}
      <div className={`transition-opacity duration-300 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {isLoading ? (
        <div className="py-4 text-center text-gray-500">Loading location information...</div>
      ) : error ? (
        <div className="py-4 text-center text-red-500">{error}</div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-[#0078d4] mt-1 mr-3" />
              <div>
                <p className="font-medium">{locationTitle}</p>
                <p className="text-gray-600">{address}</p>
                {hasCustomLocation && !location && (
                  <p className="text-amber-600 text-sm font-medium mt-1">
                    Please note: This is not our usual address
                  </p>
                )}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0078d4] hover:text-[#50a3d9] text-sm mt-1 inline-block"
                >
                  View on Google Maps
                </a>
              </div>
            </div>

            <div className="flex items-start">
              <Clock className="h-5 w-5 text-[#0078d4] mt-1 mr-3" />
              <div>
                <p className="font-medium">Hours</p>
                <p className="text-gray-600">Open Daily: 11AM - 9PM</p>
                <p className="text-sm text-gray-500">
                  Orders must be picked up during business hours
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Phone className="h-5 w-5 text-[#0078d4] mt-1 mr-3" />
              <div>
                <p className="font-medium">Contact</p>
                <p className="text-gray-600">{phoneNumber}</p>
                <p className="text-sm text-gray-500">
                  Call us if you need to modify your order
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h4 className="font-medium mb-2">Pickup Instructions</h4>
            <ol className="list-decimal list-inside text-gray-600 space-y-2">
              <li>Park in the designated pickup spots</li>
              <li>Come inside and show your order number at the counter</li>
              <li>Your order will be ready at the time indicated</li>
            </ol>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
