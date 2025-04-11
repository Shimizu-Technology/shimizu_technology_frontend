import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationCard from './NotificationCard';
import ScrollableNotificationList from './ScrollableNotificationList';
import useNotificationStore from '../../../ordering/store/notificationStore';
import { Notification } from '../../../shared/api/endpoints/notifications';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import toastUtils from '../../utils/toastUtils';
import { isMobileDevice, isIPad } from '../../utils/deviceUtils';

interface NotificationContainerProps {
  notificationType?: string;
  title?: string;
  maxDisplayed?: number;
  pollInterval?: number; // in milliseconds
  defaultHours?: number;
  onClose?: () => void;
  onView?: (notification: Notification) => void;
  className?: string;
  showAcknowledgeAll?: boolean;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notificationType,
  title = 'Notifications',
  maxDisplayed = 5,
  pollInterval = 60000, // 1 minute by default
  defaultHours = 24,
  onClose,
  onView,
  className = '',
  showAcknowledgeAll = true,
}) => {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    fetchNotifications,
    acknowledgeOne,
    acknowledgeAll,
    takeAction,
  } = useNotificationStore();
  
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  
  // Fetch notifications on mount and set up WebSocket connection
  useEffect(() => {
    const fetchData = async () => {
      await fetchNotifications(defaultHours, notificationType);
    };
    
    // Fetch immediately on mount
    fetchData();
    
    // Get WebSocket methods from the store
    const notificationStore = useNotificationStore.getState();
    
    // Start WebSocket connection
    notificationStore.startWebSocketConnection();
    
    // Clean up on unmount
    return () => {
      notificationStore.stopWebSocketConnection();
      notificationStore.stopNotificationPolling();
    };
  }, [fetchNotifications, defaultHours, notificationType]);
  
  // Filter and sort notifications when data changes
  useEffect(() => {
    // Ensure notifications is an array before processing
    if (!Array.isArray(notifications)) {
      console.warn('Expected notifications to be an array but got:', typeof notifications);
      setFilteredNotifications([]);
      return;
    }
    
    let filtered = [...notifications];
    
    // Apply type filter if specified
    if (notificationType) {
      filtered = filtered.filter(n => n.notification_type === notificationType);
    }
    
    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Limit to max display count
    filtered = filtered.slice(0, maxDisplayed);
    
    setFilteredNotifications(filtered);
  }, [notifications, notificationType, maxDisplayed]);
  
  // Handle viewing a notification (navigates to the appropriate page)
  const handleView = (notification: Notification) => {
    // Acknowledge the notification
    acknowledgeOne(notification.id);
    
    // If onView prop is provided, call it with the notification
    if (onView) {
      onView(notification);
    } else {
      // Otherwise navigate to the appropriate admin page
      navigate(notification.admin_path);
    }
    
    // Close the notification container if onClose is provided
    if (onClose) {
      onClose();
    }
  };
  
  // Handle dismissing a notification
  const handleDismiss = (notification: Notification) => {
    acknowledgeOne(notification.id);
  };
  
  // Handle acknowledging all notifications
  const handleAcknowledgeAll = async () => {
    const count = await acknowledgeAll(notificationType);
    console.log(`Acknowledged ${count} notifications`);
  };
  
  // Handle taking action on a notification
  const handleAction = async (notification: Notification, actionType: string, params: Record<string, any>) => {
    try {
      await takeAction(notification.id, actionType, params);
      toastUtils.success('Action completed successfully');
      
      // Refresh notifications
      fetchNotifications(defaultHours, notificationType);
    } catch (error) {
      console.error('Failed to take action:', error);
      toastUtils.error('Failed to complete action');
    }
  };
  
  return (
    <div className={`notification-container bg-white rounded-lg shadow-md p-4 ${className}`}>
      {/* Header with title and close button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#c1902f]"></div>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && filteredNotifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <CheckCircle size={32} className="mb-2 text-green-500" />
          <p className="text-center">No notifications to display.</p>
        </div>
      )}
      
      {/* Notification list with scrollable container */}
      {!loading && filteredNotifications.length > 0 && (
        <ScrollableNotificationList 
          maxHeight={isMobileDevice() ? '60vh' : isIPad() ? '65vh' : '70vh'}
          className="notification-list-container"
        >
          <div className="space-y-3">
            {filteredNotifications.map(notification => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onView={handleView}
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            ))}
          </div>
        </ScrollableNotificationList>
      )}
      
      {/* Acknowledge all button */}
      {showAcknowledgeAll && filteredNotifications.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleAcknowledgeAll}
            className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center"
          >
            <CheckCircle size={16} className="mr-2" />
            Acknowledge All
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationContainer;
