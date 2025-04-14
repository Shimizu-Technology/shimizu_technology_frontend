// src/ordering/components/admin/settings/LocationManager.tsx

import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash, Check, X, Edit, AlertTriangle } from 'lucide-react';
import { locationsApi } from '../../../../shared/api/endpoints/locations';
import { Location, LocationPayload } from '../../../../shared/types/Location';
import toastUtils from '../../../../shared/utils/toastUtils';

interface LocationManagerProps {
  restaurantId?: string;
}

export function LocationManager({ restaurantId }: LocationManagerProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  
  // Form state
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    phone_number: '',
    is_active: true,
    is_default: false
  });
  
  // Fetch locations on component mount
  useEffect(() => {
    fetchLocations();
  }, [restaurantId]);
  
  const fetchLocations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await locationsApi.getLocations();
      setLocations(data);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to load locations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const createdLocation = await locationsApi.createLocation(newLocation);
      setLocations(prev => [...prev, createdLocation]);
      setIsAddingLocation(false);
      setNewLocation({
        name: '',
        address: '',
        phone_number: '',
        is_active: true,
        is_default: false
      });
      toastUtils.success('Location added successfully!');
    } catch (err) {
      console.error('Error creating location:', err);
      toastUtils.error('Failed to create location. Please try again.');
    }
  };
  
  const handleUpdateLocation = async (locationId: number, updatedData: Partial<Location>) => {
    try {
      // Create a LocationPayload object from the updatedData
      const locationPayload: LocationPayload = {
        name: updatedData.name || '',
        address: updatedData.address || '',
        phone_number: updatedData.phone_number || '',
        is_active: updatedData.is_active,
        is_default: updatedData.is_default
      };
      
      const updatedLocation = await locationsApi.updateLocation(locationId, locationPayload);
      setLocations(prev => prev.map(loc => loc.id === locationId ? updatedLocation : loc));
      setEditingLocationId(null);
      toastUtils.success('Location updated successfully!');
      
      // If this location was set as default, update the UI to reflect that
      if (updatedData.is_default) {
        setLocations(prev => prev.map(loc => ({
          ...loc,
          is_default: loc.id === locationId
        })));
      }
    } catch (err) {
      console.error('Error updating location:', err);
      toastUtils.error('Failed to update location. Please try again.');
    }
  };
  
  const handleDeleteLocation = async (locationId: number) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }
    
    try {
      await locationsApi.deleteLocation(locationId);
      setLocations(prev => prev.filter(loc => loc.id !== locationId));
      toastUtils.success('Location deleted successfully!');
    } catch (err) {
      console.error('Error deleting location:', err);
      toastUtils.error('Failed to delete location. Please try again.');
    }
  };
  
  const handleMakeDefault = async (locationId: number) => {
    try {
      // Find the location to get its current data
      const location = locations.find(loc => loc.id === locationId);
      if (!location) {
        toastUtils.error('Location not found');
        return;
      }
      
      // Create a complete LocationPayload
      const locationPayload: LocationPayload = {
        name: location.name,
        address: location.address,
        phone_number: location.phone_number,
        is_default: true
      };
      
      await locationsApi.updateLocation(locationId, locationPayload);
      setLocations(prev => prev.map(loc => ({
        ...loc,
        is_default: loc.id === locationId
      })));
      toastUtils.success('Default location updated successfully!');
    } catch (err) {
      console.error('Error setting default location:', err);
      toastUtils.error('Failed to set default location. Please try again.');
    }
  };
  
  const handleToggleActive = async (locationId: number, currentStatus: boolean) => {
    try {
      // Find the location to get its current data
      const location = locations.find(loc => loc.id === locationId);
      if (!location) {
        toastUtils.error('Location not found');
        return;
      }
      
      // Create a complete LocationPayload
      const locationPayload: LocationPayload = {
        name: location.name,
        address: location.address,
        phone_number: location.phone_number,
        is_active: !currentStatus
      };
      
      const updatedLocation = await locationsApi.updateLocation(locationId, locationPayload);
      setLocations(prev => prev.map(loc => loc.id === locationId ? updatedLocation : loc));
      toastUtils.success(`Location ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (err) {
      console.error('Error toggling location status:', err);
      toastUtils.error('Failed to update location status. Please try again.');
    }
  };
  
  const startEditing = (location: Location) => {
    setEditingLocationId(location.id);
    setNewLocation({
      name: location.name,
      address: location.address,
      phone_number: location.phone_number || '',
      is_active: location.is_active,
      is_default: location.is_default
    });
  };
  
  const cancelEditing = () => {
    setEditingLocationId(null);
    setNewLocation({
      name: '',
      address: '',
      phone_number: '',
      is_active: true,
      is_default: false
    });
  };
  
  // Render loading state
  if (isLoading && locations.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-400">Loading locations...</div>
      </div>
    );
  }
  
  // Render error state
  if (error && locations.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-600">{error}</p>
        </div>
        <button 
          onClick={fetchLocations}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium">Location Management</h3>
          <p className="text-sm text-gray-500">Manage your restaurant's physical locations</p>
        </div>
        
        <button
          onClick={() => setIsAddingLocation(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0078d4] hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
          disabled={isAddingLocation}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </button>
      </div>
      
      {/* Add Location Form */}
      {isAddingLocation && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
          <h4 className="text-md font-medium mb-4">Add New Location</h4>
          <form onSubmit={handleAddLocation} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Location Name*
              </label>
              <input
                type="text"
                id="name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address*
              </label>
              <input
                type="text"
                id="address"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone_number"
                value={newLocation.phone_number}
                onChange={(e) => setNewLocation({ ...newLocation, phone_number: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={newLocation.is_active}
                onChange={(e) => setNewLocation({ ...newLocation, is_active: e.target.checked })}
                className="h-4 w-4 text-[#0078d4] focus:ring-[#0078d4] border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_default"
                checked={newLocation.is_default}
                onChange={(e) => setNewLocation({ ...newLocation, is_default: e.target.checked })}
                className="h-4 w-4 text-[#0078d4] focus:ring-[#0078d4] border-gray-300 rounded"
              />
              <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
                Default Location
              </label>
              {newLocation.is_default && (
                <span className="ml-2 text-xs text-gray-500">
                  (This will replace your current default location)
                </span>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setIsAddingLocation(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0078d4] hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
              >
                Add Location
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Locations List */}
      {locations.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {locations.map((location) => (
              <li key={location.id} className={`${!location.is_active ? 'bg-gray-50' : ''}`}>
                {editingLocationId === location.id ? (
                  // Edit mode
                  <div className="px-4 py-4 sm:px-6">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`edit-name-${location.id}`} className="block text-sm font-medium text-gray-700">
                          Location Name*
                        </label>
                        <input
                          type="text"
                          id={`edit-name-${location.id}`}
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-address-${location.id}`} className="block text-sm font-medium text-gray-700">
                          Address*
                        </label>
                        <input
                          type="text"
                          id={`edit-address-${location.id}`}
                          value={newLocation.address}
                          onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor={`edit-phone-${location.id}`} className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id={`edit-phone-${location.id}`}
                          value={newLocation.phone_number}
                          onChange={(e) => setNewLocation({ ...newLocation, phone_number: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#0078d4] focus:border-[#0078d4] sm:text-sm"
                        />
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`edit-active-${location.id}`}
                          checked={newLocation.is_active}
                          onChange={(e) => setNewLocation({ ...newLocation, is_active: e.target.checked })}
                          className="h-4 w-4 text-[#0078d4] focus:ring-[#0078d4] border-gray-300 rounded"
                        />
                        <label htmlFor={`edit-active-${location.id}`} className="ml-2 block text-sm text-gray-700">
                          Active
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`edit-default-${location.id}`}
                          checked={newLocation.is_default}
                          onChange={(e) => setNewLocation({ ...newLocation, is_default: e.target.checked })}
                          className="h-4 w-4 text-[#0078d4] focus:ring-[#0078d4] border-gray-300 rounded"
                          disabled={location.is_default}
                        />
                        <label htmlFor={`edit-default-${location.id}`} className="ml-2 block text-sm text-gray-700">
                          Default Location
                        </label>
                        {newLocation.is_default && !location.is_default && (
                          <span className="ml-2 text-xs text-gray-500">
                            (This will replace your current default location)
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-end space-x-3 pt-3">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateLocation(location.id, newLocation)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#0078d4] hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                        <p className="text-sm font-medium text-[#0078d4] truncate">
                          {location.name}
                          {location.is_default && (
                            <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Default
                            </span>
                          )}
                          {!location.is_active && (
                            <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Inactive
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {!location.is_default && (
                          <button
                            onClick={() => handleMakeDefault(location.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Make Default
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(location.id, location.is_active)}
                          className={`inline-flex items-center px-2.5 py-1.5 border shadow-sm text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4] ${
                            location.is_active
                              ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {location.is_active ? (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Activate
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => startEditing(location)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </button>
                        {!location.is_default && (
                          <button
                            onClick={() => handleDeleteLocation(location.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <Trash className="h-3 w-3 mr-1" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          {location.address}
                        </p>
                      </div>
                      {location.phone_number && (
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <p>{location.phone_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No locations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new location.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsAddingLocation(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#0078d4] hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0078d4]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationManager;
