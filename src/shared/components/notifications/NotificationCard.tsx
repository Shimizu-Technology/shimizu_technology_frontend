import React, { useState } from 'react';
import { Notification } from '../../api/endpoints/notifications';
import { formatDistanceToNow } from 'date-fns';
import { 
  ShoppingBag, Box, AlertCircle, Eye, X, ExternalLink, 
  CheckCircle, Plus, RefreshCw 
} from 'lucide-react';

interface NotificationCardProps {
  notification: Notification;
  onView: (notification: Notification) => void;
  onDismiss: (notification: Notification) => void;
  onAction?: (notification: Notification, actionType: string, params: Record<string, any>) => Promise<void>;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onView,
  onDismiss,
  onAction,
}) => {
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  
  // Determine notification age
  const createdAt = new Date(notification.created_at);
  const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });
  
  // Check if this is a low stock notification where quick restock is applicable
  const isLowStockNotification = notification.notification_type === 'low_stock' && 
    notification.resource_type === 'MerchandiseVariant';
    
  // Handle restock action
  const handleRestock = async () => {
    if (!onAction) return;
    
    try {
      setIsLoading(true);
      await onAction(notification, 'restock', { quantity: restockQuantity });
      setIsRestockModalOpen(false);
    } catch (error) {
      console.error('Failed to restock item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Choose icon and colors based on notification type
  const getIconAndColor = () => {
    switch (notification.notification_type) {
      case 'order':
        return {
          Icon: ShoppingBag,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          iconColor: 'text-blue-600',
        };
      case 'low_stock':
        return {
          Icon: AlertCircle,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'out_of_stock':
        return {
          Icon: Box,
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      default:
        return {
          Icon: CheckCircle,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const { Icon, bgColor, textColor, iconColor } = getIconAndColor();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow transition-shadow duration-200">
      <div className="flex items-start">
        {/* Notification icon */}
        <div className={`${bgColor} p-2 rounded-lg mr-3 flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{notification.title}</h4>
            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{timeAgo}</span>
          </div>
          <p className="mt-1 text-xs text-gray-700">{notification.body}</p>

          {/* Action buttons */}
          <div className="mt-2 flex space-x-2">
            <button
              onClick={() => onView(notification)}
              className="flex items-center px-2.5 py-1 text-xs font-medium rounded-md 
                bg-[#c1902f] text-white hover:bg-[#d4a43f] transition-colors"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </button>
            
            {/* Restock button for low stock notifications */}
            {isLowStockNotification && onAction && (
              <button
                onClick={() => setIsRestockModalOpen(true)}
                className="flex items-center px-2.5 py-1 text-xs font-medium rounded-md 
                  bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Restock
              </button>
            )}
            
            <button
              onClick={() => onDismiss(notification)}
              className="flex items-center px-2.5 py-1 text-xs font-medium rounded-md 
                bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Dismiss
            </button>
          </div>
          
          {/* Restock Modal */}
          {isRestockModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                          Restock Item
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            How many items would you like to add to the current stock?
                          </p>
                          
                          <div className="mt-4">
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                              Quantity to Add
                            </label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                              <input
                                type="number"
                                name="quantity"
                                id="quantity"
                                min="1"
                                value={restockQuantity}
                                onChange={(e) => setRestockQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                                placeholder="10"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button 
                      type="button" 
                      onClick={handleRestock}
                      disabled={isLoading}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#c1902f] text-base font-medium text-white hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f] sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : 'Restock'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsRestockModalOpen(false)}
                      disabled={isLoading}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCard;
