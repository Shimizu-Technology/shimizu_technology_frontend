import { api } from '../apiClient';

// Define the Notification interface
export interface Notification {
  id: number;
  title: string;
  body: string;
  notification_type: string; // 'order', 'low_stock', 'out_of_stock', etc.
  resource_type: string; // 'Order', 'MerchandiseVariant', etc.
  resource_id: number;
  admin_path: string; // Frontend path to view the resource
  acknowledged: boolean;
  created_at: string;
  updated_at: string;
  metadata?: {
    [key: string]: any;
    variant_id?: number;
    item_id?: number;
    color?: string;
    size?: string;
    stock_quantity?: number;
    threshold?: number;
    order_id?: number;
    customer_name?: string;
    total?: number;
  };
}

// Get all unacknowledged notifications
interface NotificationsResponse {
  notifications: Notification[];
}

export const getUnacknowledgedNotifications = async (
  type?: string,
  hours?: number
): Promise<Notification[]> => {
  const params: Record<string, string | number> = {};
  if (hours) {
    params.hours = hours;
  }
  if (type) {
    params.type = type;
  }
  const response = await api.get<NotificationsResponse>('/notifications/unacknowledged', params);
  return response.notifications || [];
};

// Acknowledge a single notification
export const acknowledgeNotification = async (id: number): Promise<void> => {
  return api.post(`/notifications/${id}/acknowledge`);
};

// Acknowledge all notifications (optionally by type)
export const acknowledgeAllNotifications = async (type?: string): Promise<{ acknowledged_count: number }> => {
  const params: Record<string, string> = {};
  if (type) {
    params.type = type;
  }
  return api.post('/notifications/acknowledge_all', params);
};

// Interface for the response from take_action for restock actions
export interface RestockActionResponse {
  success: boolean;
  message: string;
  notification: Notification;
  variant: {
    id: number;
    stock_quantity: number;
    size: string;
    color: string;
    stock_status: string;
    stock_history?: any[];
    [key: string]: any;
  };
}

// Take an action on a notification (e.g., restock a low stock item)
export const takeActionOnNotification = async (
  id: number,
  actionType: string,
  // Additional parameters specific to the action type
  actionParams: Record<string, any> = {}
): Promise<RestockActionResponse> => {
  return api.post(`/notifications/${id}/take_action`, {
    action_type: actionType,
    ...actionParams
  });
};

// Get notification count
export const getNotificationCount = async (type?: string): Promise<{ count: number }> => {
  const params: Record<string, string> = {};
  if (type) {
    params.type = type;
  }
  return api.get('/notifications/count', params);
};

// Get notification statistics
export const getNotificationStats = async (): Promise<{
  order_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_count: number;
  oldest_notification_date: string | null;
}> => {
  return api.get('/notifications/stats');
};
