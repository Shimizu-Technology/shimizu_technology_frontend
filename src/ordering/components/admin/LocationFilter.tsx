// src/ordering/components/admin/LocationFilter.tsx

import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { locationsApi } from '../../../shared/api/endpoints/locations';
import { Location } from '../../../shared/types/Location';
import toastUtils from '../../../shared/utils/toastUtils';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';

interface LocationFilterProps {
  selectedLocationId: number | null;
  onLocationChange: (locationId: number | null) => void;
  className?: string;
}

export function LocationFilter({ selectedLocationId, onLocationChange, className = '' }: LocationFilterProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch locations on component mount
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const locationData = await locationsApi.getLocations();
      setLocations(locationData);
      
      // If there's only one location and it's selected, make sure it's set
      if (locationData.length === 1 && !selectedLocationId) {
        onLocationChange(locationData[0].id);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to load locations');
      toastUtils.error('Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  };

  // If there's only one location, don't show the filter
  if (locations.length <= 1 && !isLoading) {
    return null;
  }

  // Find the currently selected location object for displaying details
  const selectedLocation = selectedLocationId 
    ? locations.find(loc => loc.id === selectedLocationId)
    : null;

  // Convert locations to options format for MobileSelect
  const locationOptions = [
    { value: '', label: 'All Locations' },
    ...locations.map(location => ({
      value: location.id.toString(),
      label: `${location.name}${location.is_default ? ' (Default)' : ''}`
    }))
  ];

  return (
    <div className={`relative ${className}`}>
      <label htmlFor="location-filter" className="text-sm font-medium text-gray-700 mb-1 flex items-center">
        <MapPin className="h-4 w-4 mr-1" />
        Filter by Location
        {selectedLocationId && (
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 bg-opacity-20 text-green-800">
            Active Filter
          </span>
        )}
      </label>
      <div className="relative">
        <MobileSelect
          options={locationOptions}
          value={selectedLocationId ? selectedLocationId.toString() : ''}
          onChange={(value) => onLocationChange(value ? Number(value) : null)}
          placeholder="Select a location"
          className="w-full h-12 shadow-sm border-gray-300 rounded-md"
        />
        {isLoading && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
          </div>
        )}
      </div>
      {selectedLocation && (
        <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded-md text-xs text-green-700">
          <p className="font-medium">{selectedLocation.name}</p>
          <p className="mt-1">{selectedLocation.address}</p>
          <p>{selectedLocation.phone_number}</p>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default LocationFilter;
