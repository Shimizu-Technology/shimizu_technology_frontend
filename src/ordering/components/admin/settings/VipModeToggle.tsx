// src/ordering/components/admin/settings/VipModeToggle.tsx

import React, { useState } from 'react';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import toastUtils from '../../../../shared/utils/toastUtils';
import { Lock } from 'lucide-react';

interface VipModeToggleProps {
  className?: string;
}

export const VipModeToggle: React.FC<VipModeToggleProps> = ({ className = '' }) => {
  const { restaurant, toggleVipMode } = useRestaurantStore();
  const [loading, setLoading] = useState(false);
  
  const isVipModeEnabled = restaurant?.vip_enabled || false;
  
  const handleToggle = async () => {
    if (!restaurant) return;
    
    setLoading(true);
    try {
      await toggleVipMode(!isVipModeEnabled);
      toastUtils.success(`VIP-only mode ${!isVipModeEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle VIP mode:', error);
      toastUtils.error('Failed to toggle VIP mode');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={`bg-white rounded-lg shadow transition-all duration-300 animate-fadeIn ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Lock className="h-6 w-6 text-[#c1902f] mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">VIP-Only Mode</h2>
          </div>
          
          <div className="flex items-center">
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                ${isVipModeEnabled ? 'bg-amber-600' : 'bg-gray-300'}
                transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out
                  ${isVipModeEnabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
            
            <span className="ml-2 text-sm font-medium text-gray-900">
              {isVipModeEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        <p className="text-sm text-gray-600">
          {isVipModeEnabled 
            ? 'Only customers with valid VIP codes can place orders' 
            : 'All customers can place orders'}
        </p>
      </div>
    </div>
  );
};
