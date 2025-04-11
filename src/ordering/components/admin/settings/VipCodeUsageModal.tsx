// src/ordering/components/admin/settings/VipCodeUsageModal.tsx

import React, { useState, useEffect } from 'react';
import toastUtils from '../../../../shared/utils/toastUtils';
import { X, ShoppingBag, User, Calendar, DollarSign } from 'lucide-react';
import { getCodeUsage } from '../../../../shared/api/endpoints/vipCodes';
import { LoadingSpinner } from '../../../../shared/components/ui/LoadingSpinner';

interface VipCodeUsageModalProps {
  codeId: number;
  onClose: () => void;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  id: number;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  user: {
    id: number;
    name: string;
  } | null;
  items: OrderItem[];
}

interface Recipient {
  email: string;
  sent_at: string;
}

interface CodeUsageData {
  code: {
    id: number;
    code: string;
    name: string;
    max_uses: number | null;
    current_uses: number;
    expires_at: string | null;
    is_active: boolean;
    group_id?: string;
    archived?: boolean;
  };
  usage_count: number;
  recipients: Recipient[];
  orders: Order[];
}

export const VipCodeUsageModal: React.FC<VipCodeUsageModalProps> = ({ codeId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<CodeUsageData | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);

  useEffect(() => {
    const fetchUsageData = async () => {
      setLoading(true);
      try {
        const data = await getCodeUsage(codeId);
        setUsageData(data as CodeUsageData);
      } catch (error) {
        console.error('Error fetching VIP code usage data:', error);
        toastUtils.error('Failed to load VIP code usage data');
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, [codeId]);

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn p-4">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 w-6 bg-gray-200 rounded-full animate-pulse"></div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg mb-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-5 w-24 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-grow space-y-4">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
          
          {Array.from({ length: 3 }).map((_, index) => (
            <div 
              key={`skeleton-order-${index}`} 
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-50 p-4 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!usageData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn p-4">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">VIP Code Usage Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg mb-4 transition-all duration-300 animate-fadeIn">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Code</p>
              <p className="font-semibold">{usageData.code.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-semibold">{usageData.code.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-semibold">{usageData.code.group_id ? 'Group' : 'Individual'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Usage</p>
              <p className="font-semibold">{usageData.usage_count} / {usageData.code.max_uses || '∞'}</p>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-auto">
          {/* Recipients Section */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-2">Recipients ({usageData.recipients?.length || 0})</h3>
            {!usageData.recipients || usageData.recipients.length === 0 ? (
              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                <p>No recipient information available for this VIP code.</p>
              </div>
            ) : (
              <>
                {/* Mobile card view for small screens */}
                <div className="md:hidden space-y-2">
                  {usageData.recipients.map((recipient, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <div className="font-medium break-all">{recipient.email}</div>
                      <div className="text-sm text-gray-500 mt-1">Sent: {formatDate(recipient.sent_at)}</div>
                    </div>
                  ))}
                </div>
                
                {/* Table view for larger screens */}
                <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usageData.recipients.map((recipient, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3">{recipient.email}</td>
                          <td className="px-4 py-3">{formatDate(recipient.sent_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Orders Section */}
          {usageData.orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag size={48} className="mx-auto mb-2 opacity-30" />
              <p>No orders have been placed using this VIP code yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Orders ({usageData.orders.length})</h3>
              
              {usageData.orders.map(order => (
                <div 
                  key={order.id} 
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div 
                    className="bg-gray-50 p-4 cursor-pointer"
                    onClick={() => toggleOrderExpand(order.id)}
                  >
                    {/* Mobile layout */}
                    <div className="md:hidden">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Order #{order.id}</span>
                        <div className="font-semibold">{formatCurrency(order.total)}</div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Desktop layout */}
                    <div className="hidden md:flex md:justify-between md:items-center">
                      <div className="flex items-center space-x-4">
                        <span className="font-medium">Order #{order.id}</span>
                        <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="font-semibold">{formatCurrency(order.total)}</div>
                    </div>
                  </div>
                  
                  {expandedOrders.includes(order.id) && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Customer Information - Mobile optimized */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="font-medium flex items-center mb-2">
                            <User size={16} className="mr-2" /> Customer Information
                          </h4>
                          <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Name:</span> 
                              <span className="font-medium break-all">{order.customer_name}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Email:</span> 
                              <span className="font-medium break-all">{order.customer_email}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Phone:</span> 
                              <span className="font-medium">{order.customer_phone}</span>
                            </div>
                            {order.user && (
                              <div className="flex flex-col sm:flex-row sm:justify-between">
                                <span className="text-gray-500 sm:w-24">Account:</span> 
                                <span className="font-medium">{order.user.name} (ID: {order.user.id})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Order Details - Mobile optimized */}
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="font-medium flex items-center mb-2">
                            <Calendar size={16} className="mr-2" /> Order Details
                          </h4>
                          <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Date:</span> 
                              <span className="font-medium">{formatDate(order.created_at)}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Status:</span> 
                              <span className="font-medium">{order.status}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-between">
                              <span className="text-gray-500 sm:w-24">Total:</span> 
                              <span className="font-medium">{formatCurrency(order.total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <h4 className="font-medium flex items-center mb-2">
                        <ShoppingBag size={16} className="mr-2" /> Items
                      </h4>
                      
                      {/* Mobile card view for small screens */}
                      <div className="md:hidden space-y-3">
                        {order.items.map((item, index) => (
                          <div 
                            key={index} 
                            className="border rounded-lg p-3"
                          >
                            <div className="font-medium">{item.name}</div>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                              <div>
                                <span className="text-gray-500">Qty:</span> {item.quantity}
                              </div>
                              <div>
                                <span className="text-gray-500">Price:</span> {formatCurrency(item.price)}
                              </div>
                              <div>
                                <span className="text-gray-500">Total:</span> {formatCurrency(item.total)}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center mt-2">
                          <span className="font-medium">Order Total:</span>
                          <span className="font-bold">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                      
                      {/* Table view for larger screens */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {order.items.map((item, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2">{item.name}</td>
                                <td className="px-4 py-2">{item.quantity}</td>
                                <td className="px-4 py-2">{formatCurrency(item.price)}</td>
                                <td className="px-4 py-2">{formatCurrency(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50">
                              <td colSpan={3} className="px-4 py-2 text-right font-medium">Order Total:</td>
                              <td className="px-4 py-2 font-bold">{formatCurrency(order.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
