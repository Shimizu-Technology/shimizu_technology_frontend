// src/ordering/components/profile/OrderHistory.tsx
import React, { useEffect, useState } from 'react';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import { Clock, ShoppingBag, Filter, Calendar } from 'lucide-react';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';
import { OrderHistorySkeletonList } from '../../../shared/components/ui/SkeletonLoader';
import { Order } from '../../types/order';

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

// Extended order type to handle the properties we're using that might not be in the base type
interface ExtendedOrder extends Omit<Order, 'id'> {
  id: string;
  userId?: number;
  estimatedPickupTime?: string;
  special_instructions?: string;
  specialInstructions?: string;
}

// Extended order item type to handle customizations
interface ExtendedOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: string[];
  notes?: string;
  customizations?: Record<string, string[]>;
}

export function OrderHistory() {
  const { user } = useAuthStore();
  const { getOrderHistory, fetchOrders, loading } = useOrderStore();

  // State for sorting and filtering
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 5;

  useEffect(() => {
    // Load orders from the backend on mount
    fetchOrders();
  }, [fetchOrders]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sortOption]);

  if (!user) return null;

  const orders = getOrderHistory(Number(user.id)) as ExtendedOrder[];

  // Sort orders based on selected option
  const sortedOrders = [...orders].sort((a, b) => {
    switch (sortOption) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'highest':
        return b.total - a.total;
      case 'lowest':
        return a.total - b.total;
      default:
        return 0;
    }
  });

  // Filter orders by status
  const filteredOrders = statusFilter === 'all' 
    ? sortedOrders 
    : sortedOrders.filter(order => order.status === statusFilter);
    
  // Calculate pagination
  const totalOrders = filteredOrders.length;
  const totalPages = Math.ceil(totalOrders / ordersPerPage);
  
  // Get current page of orders
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      confirmed: 'bg-purple-100 text-purple-800',
    };
    return colors[status as keyof typeof colors] || 'bg-yellow-100 text-yellow-800';
  };

  // Format date for better display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Order History</h2>
        <p className="text-sm text-gray-600">View and track your past orders</p>
      </div>

      {/* Filters and controls - mobile optimized */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          {/* Sort dropdown */}
          <div className="w-full sm:w-auto">
            <MobileSelect
              options={[
                { value: 'newest', label: 'Sort: Newest First' },
                { value: 'oldest', label: 'Sort: Oldest First' },
                { value: 'highest', label: 'Sort: Highest Total' },
                { value: 'lowest', label: 'Sort: Lowest Total' }
              ]}
              value={sortOption}
              onChange={(value) => setSortOption(value as SortOption)}
            />
          </div>
          
          {/* Order count */}
          <div className="text-sm text-gray-500 font-medium">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
          </div>
        </div>

        {/* Filter toggle button */}
        <button 
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="flex items-center text-sm font-medium text-gray-700 hover:text-[#c1902f] transition-colors"
        >
          <Filter className="h-4 w-4 mr-2" />
          {isFilterExpanded ? 'Hide Filters' : 'Show Filters'}
        </button>

        {/* Expandable filter section */}
        {isFilterExpanded && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Status</h3>
            
            {/* Status filter buttons - horizontal scrolling with improved mobile styling */}
            <div className="relative">
              {/* Scrollable container */}
              <div className="flex flex-nowrap space-x-2 overflow-x-auto py-1 px-1 scrollbar-hide -mx-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`
                    whitespace-nowrap px-4 py-2 rounded-md text-xs font-medium min-w-[80px] flex-shrink-0
                    ${statusFilter === 'all'
                      ? 'bg-[#c1902f] text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  All Orders
                </button>
                {(['pending', 'preparing', 'ready', 'completed', 'cancelled'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`
                      whitespace-nowrap px-4 py-2 rounded-md text-xs font-medium min-w-[80px] flex-shrink-0
                      ${statusFilter === status
                        ? 'bg-[#c1902f] text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="animate-fadeIn transition-opacity duration-300">
          <OrderHistorySkeletonList count={3} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600 font-medium">No orders yet</p>
          <p className="text-sm text-gray-500 mt-2">Your order history will appear here once you place an order</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <Filter className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-gray-600">No orders match your current filters</p>
          <button 
            onClick={() => {
              setStatusFilter('all');
              setSortOption('newest');
            }}
            className="mt-3 text-sm text-[#c1902f] hover:underline font-medium"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          <div className="space-y-4 mb-6">
            {currentOrders.map(order => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Order header */}
                <div className="flex justify-between items-start p-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-base font-medium text-gray-900">Order #{order.id}</h3>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(order.status)}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>

                {/* Order items */}
                <div className="p-4 border-b border-gray-100">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Items</h4>
                  <div className="space-y-3">
                    {order.items.map((item, index) => {
                      const extendedItem = item as ExtendedOrderItem;
                      return (
                        <div key={index} className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{item.name} × {item.quantity}</p>
                            {extendedItem.customizations &&
                              Object.entries(extendedItem.customizations).map(([key, values]) => (
                                <p key={key} className="text-xs text-gray-600">
                                  {key}: {values.join(', ')}
                                </p>
                              ))}
                            {item.notes && (
                              <p className="text-xs text-gray-600">Note: {item.notes}</p>
                            )}
                          </div>
                          <span className="text-sm font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order footer */}
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex items-center text-xs text-gray-600">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      Pickup: {new Date(order.estimatedPickupTime || order.pickup_time || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <p className="text-base font-medium">Total: ${order.total.toFixed(2)}</p>
                  </div>

                  {(order.specialInstructions || order.special_instructions) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-700 font-medium">Special Instructions:</p>
                      <p className="mt-1 text-sm text-gray-600">{order.specialInstructions || order.special_instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-6 pb-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md text-sm ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>
              
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm ${
                      currentPage === page
                        ? 'bg-[#c1902f] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-md text-sm ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderHistory;
