// src/ordering/componenets/location/PickupInfor.tsx
import { MapPin, Clock, Phone } from 'lucide-react';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { formatPhoneNumber } from '../../../shared/utils/formatters';

export function PickupInfo() {
  // No need to fetch restaurant data here as it's already being handled by RestaurantProvider
  const { restaurant } = useRestaurantStore();
  
  // Use custom pickup location if available, otherwise use regular address
  const hasCustomLocation = !!restaurant?.custom_pickup_location;
  const address = restaurant?.custom_pickup_location || restaurant?.address || "955 Pale San Vitores Rd, Tamuning, Guam 96913";
  const phoneNumber = formatPhoneNumber(restaurant?.phone_number) || "+1 (671) 989-3444";
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Pickup Information</h3>
      
      <div className="space-y-4">
        <div className="flex items-start">
          <MapPin className="h-5 w-5 text-[#c1902f] mt-1 mr-3" />
          <div>
            <p className="font-medium">{hasCustomLocation ? 'Special Pickup Location' : 'Location'}</p>
            <p className="text-gray-600">{address}</p>
            {hasCustomLocation && (
              <p className="text-amber-600 text-sm font-medium mt-1">
                Please note: This is not our usual address
              </p>
            )}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c1902f] hover:text-[#d4a43f] text-sm mt-1 inline-block"
            >
              View on Google Maps
            </a>
          </div>
        </div>

        <div className="flex items-start">
          <Clock className="h-5 w-5 text-[#c1902f] mt-1 mr-3" />
          <div>
            <p className="font-medium">Hours</p>
            <p className="text-gray-600">Open Daily: 11AM - 9PM</p>
            <p className="text-sm text-gray-500">
              Orders must be picked up during business hours
            </p>
          </div>
        </div>

        <div className="flex items-start">
          <Phone className="h-5 w-5 text-[#c1902f] mt-1 mr-3" />
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
    </div>
  );
}
