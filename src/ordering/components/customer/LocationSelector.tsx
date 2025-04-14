import React, { useState, useEffect } from 'react';
import { Location } from '../../../shared/types/Location';
import { locationsApi } from '../../../shared/api/endpoints/locations';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';

interface LocationSelectorProps {
  onLocationChange: (locationId: number) => void;
  initialLocationId?: number;
  restaurantId?: number;
  showOnlyActive?: boolean;
  className?: string;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onLocationChange,
  initialLocationId,
  showOnlyActive = true,
  className = '',
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | undefined>(initialLocationId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    // Update selected location if initialLocationId changes
    if (initialLocationId && initialLocationId !== selectedLocationId) {
      setSelectedLocationId(initialLocationId);
    }
  }, [initialLocationId]);

  const fetchLocations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Only fetch active locations if showOnlyActive is true
      const params = showOnlyActive ? { active: true } : undefined;
      const locationsList = await locationsApi.getLocations(params);
      setLocations(locationsList);
      
      // If we have locations but no selection yet, select the default one
      if (locationsList.length > 0 && !selectedLocationId) {
        // Find the default location or use the first one
        const defaultLocation = locationsList.find(loc => loc.is_default) || locationsList[0];
        setSelectedLocationId(defaultLocation.id);
        onLocationChange(defaultLocation.id);
      }
    } catch (err: any) {
      setError(`Failed to load locations: ${err.message}`);
      console.error('Error fetching locations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationChange = (value: string) => {
    const newLocationId = parseInt(value, 10);
    setSelectedLocationId(newLocationId);
    onLocationChange(newLocationId);
  };

  // If we have exactly one location, make sure it's selected and don't render the picker
  if (locations.length === 1) {
    // Only set the location ID if it's not already set
    if (locations[0].id !== selectedLocationId) {
      setSelectedLocationId(locations[0].id);
      onLocationChange(locations[0].id);
    }
    // Don't render the picker for single location
    return null;
  }
  
  // Don't render the component if there are no locations
  if (locations.length === 0) {
    return null;
  }

  return (
    <div className={`location-selector ${className}`}>
      {error && (
        <div className="mb-2 p-2 text-sm bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-500 sm:text-sm">
          Loading locations...
        </div>
      ) : (
        <MobileSelect
          label="Select Location"
          options={locations.map(location => ({
            value: location.id.toString(),
            label: location.name
          }))}
          value={selectedLocationId?.toString() || ''}
          onChange={handleLocationChange}
          placeholder="Select a location"
          className="location-mobile-select"
        />
      )}
      
      {/* We've removed the location details from here as they're now shown in the PickupInfo component */}
    </div>
  );
};

export default LocationSelector;
