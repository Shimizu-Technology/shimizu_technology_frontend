import React from 'react';

interface StockManagementDashboardProps {
  restaurantId?: string;
}

const StockManagementDashboard: React.FC<StockManagementDashboardProps> = ({ restaurantId }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Stock Management</h2>
      <p className="text-gray-500">
        Stock management has been simplified. You can now manage stock quantities directly 
        when editing merchandise items and their variants.
      </p>
    </div>
  );
};

export default StockManagementDashboard;
