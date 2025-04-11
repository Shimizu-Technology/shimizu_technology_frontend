import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

interface AllowedOriginsSettingsProps {
  onSaved?: () => void;
}

export default function AllowedOriginsSettings({ onSaved }: AllowedOriginsSettingsProps) {
  const [origins, setOrigins] = useState<string[]>([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    fetchAllowedOrigins();
  }, []);

  const fetchAllowedOrigins = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/restaurant/allowed_origins');
      setOrigins(response.allowed_origins || []);
    } catch (err: any) {
      setError(`Failed to load allowed origins: ${err.message}`);
      console.error('Error fetching allowed origins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addOrigin = async () => {
    if (!newOrigin || origins.includes(newOrigin)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedOrigins = [...origins, newOrigin];
      await api.post('/admin/restaurant/allowed_origins', {
        allowed_origins: updatedOrigins
      });
      
      setOrigins(updatedOrigins);
      setNewOrigin('');
      setSuccessMessage('Origin added successfully');
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(`Failed to add origin: ${err.message}`);
      console.error('Error adding origin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const removeOrigin = async (originToRemove: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedOrigins = origins.filter(origin => origin !== originToRemove);
      await api.post('/admin/restaurant/allowed_origins', {
        allowed_origins: updatedOrigins
      });
      
      setOrigins(updatedOrigins);
      setSuccessMessage('Origin removed successfully');
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(`Failed to remove origin: ${err.message}`);
      console.error('Error removing origin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || user.restaurant_id === undefined) {
    return <div className="p-4 bg-red-100 text-red-700 rounded">You need to be logged in with a restaurant account to manage allowed origins.</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Allowed Frontend Origins</h2>
      <p className="text-gray-600 mb-4">
        Add the URLs of frontend applications that are allowed to access this restaurant's data.
        For example: <code className="bg-gray-100 px-1">https://myrestaurant.com</code>
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-medium mb-2">Current Allowed Origins:</h3>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : origins.length === 0 ? (
          <p className="text-gray-500">No origins configured yet.</p>
        ) : (
          <ul className="border rounded divide-y">
            {origins.map((origin, index) => (
              <li key={index} className="flex justify-between items-center p-3">
                <span className="font-mono">{origin}</span>
                <button
                  onClick={() => removeOrigin(origin)}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newOrigin}
          onChange={(e) => setNewOrigin(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 border rounded p-2"
          disabled={isLoading}
        />
        <button
          onClick={addOrigin}
          disabled={isLoading || !newOrigin}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Add Origin
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>
          <strong>Note:</strong> Origins should include the protocol (http:// or https://) 
          and may include a port number if needed.
        </p>
        <p className="mt-1">
          Examples:
        </p>
        <ul className="list-disc ml-5 mt-1">
          <li>https://myrestaurant.com</li>
          <li>http://localhost:3000</li>
          <li>https://staging.myrestaurant.com</li>
        </ul>
      </div>
    </div>
  );
}
