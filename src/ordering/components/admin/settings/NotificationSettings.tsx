import React, { useState, useEffect } from 'react';
import { api } from '../../../../shared/api/apiClient';
import toastUtils from '../../../../shared/utils/toastUtils';
import { LoadingSpinner, SettingsHeader } from '../../../../shared/components/ui';
import { Bell, MessageSquare, BellRing, Globe } from 'lucide-react';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import { 
  isPushNotificationSupported, 
  getNotificationPermissionStatus,
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  getPushSubscriptionStatus 
} from '../../../../shared/utils/webPushHelper';

// Simple Switch component
const Switch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ checked, onChange, className, children }) => {
  return (
    <button
      type="button"
      className={`${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      } relative inline-flex h-6 w-11 items-center rounded-full ${className || ''}`}
      onClick={() => onChange(!checked)}
    >
      {children}
      <span
        className={`${
          checked ? 'translate-x-6' : 'translate-x-1'
        } inline-block h-4 w-4 transform rounded-full bg-white transition`}
      />
    </button>
  );
};

interface NotificationSettings {
  // SMS settings
  sms_sender_id: string;
  
  // Notification channels
  notification_channels: {
    orders?: {
      sms?: boolean;
      email?: boolean;
      pushover?: boolean;
      web_push?: boolean;
    };
  };
  
  // Pushover settings
  pushover?: {
    user_key?: string;
    group_key?: string;
    app_token?: string;
  };
  
  // Web Push settings
  web_push?: {
    vapid_public_key?: string;
    vapid_private_key?: string;
  };
}

export function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'not-supported' | 'not-subscribed' | 'loading'>('loading');
  const [settings, setSettings] = useState<NotificationSettings>({
    sms_sender_id: '',
    notification_channels: {
      orders: {
        sms: true,
        email: true,
        pushover: false,
        web_push: false
      }
    },
    pushover: {
      user_key: '',
      group_key: '',
      app_token: ''
    },
    web_push: {
      vapid_public_key: '',
      vapid_private_key: ''
    }
  });

  // Check push subscription status
  useEffect(() => {
    async function checkPushStatus() {
      if (settings.notification_channels.orders?.web_push) {
        setPushStatus('loading');
        const status = await getPushSubscriptionStatus();
        setPushStatus(status);
      }
    }
    
    if (!loading) {
      checkPushStatus();
    }
  }, [settings.notification_channels.orders?.web_push, loading]);

  // Handle subscribing to push notifications
  const handleSubscribeToPush = async () => {
    try {
      setSubscribing(true);
      const success = await subscribeToPushNotifications();
      if (success) {
        toastUtils.success('Successfully subscribed to push notifications');
        setPushStatus('granted');
      } else {
        toastUtils.error('Failed to subscribe to push notifications');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toastUtils.error('Failed to subscribe to push notifications');
    } finally {
      setSubscribing(false);
    }
  };

  // Handle unsubscribing from push notifications
  const handleUnsubscribeFromPush = async () => {
    try {
      setUnsubscribing(true);
      const success = await unsubscribeFromPushNotifications();
      if (success) {
        toastUtils.success('Successfully unsubscribed from push notifications');
        setPushStatus('not-subscribed');
      } else {
        toastUtils.error('Failed to unsubscribe from push notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toastUtils.error('Failed to unsubscribe from push notifications');
    } finally {
      setUnsubscribing(false);
    }
  };

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const response: any = await api.get('/admin/settings');
        
        // Extract notification settings from admin_settings
        const adminSettings = response.admin_settings || {};
        
        // Initialize settings with defaults
        const newSettings: NotificationSettings = {
          sms_sender_id: adminSettings.sms_sender_id || '',
          notification_channels: adminSettings.notification_channels || {
            orders: {
              sms: true,
              email: true,
              pushover: false,
              web_push: false
            }
          },
          pushover: {
            user_key: '',
            group_key: '',
            app_token: ''
          },
          web_push: {
            vapid_public_key: adminSettings.web_push?.vapid_public_key || '',
            vapid_private_key: adminSettings.web_push?.vapid_private_key || ''
          }
        };
        
        // Handle both old and new Pushover settings structure
        if (adminSettings.pushover) {
          // New structure (JSONB)
          newSettings.pushover = {
            user_key: adminSettings.pushover.user_key || '',
            group_key: adminSettings.pushover.group_key || '',
            app_token: adminSettings.pushover.app_token || ''
          };
        } else if (response.pushover_user_key || response.pushover_group_key || response.pushover_app_token) {
          // Old structure (separate columns)
          newSettings.pushover = {
            user_key: response.pushover_user_key || '',
            group_key: response.pushover_group_key || '',
            app_token: response.pushover_app_token || ''
          };
        }
        
        setSettings(newSettings);
      } catch (error) {
        console.error('Failed to fetch notification settings:', error);
        toastUtils.error('Failed to load notification settings');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSettings();
  }, []);

  // Handle input changes for Pushover settings
  const handlePushoverInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name.replace('pushover_', ''); // Convert pushover_user_key to user_key
    
    setSettings(prev => ({
      ...prev,
      pushover: {
        ...prev.pushover,
        [fieldName]: value
      }
    }));
  };

  // Handle input changes for other settings
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('pushover_')) {
      handlePushoverInputChange(e);
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle notification channel toggle
  const handleChannelToggle = (channel: 'sms' | 'email' | 'pushover' | 'web_push', enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      notification_channels: {
        ...prev.notification_channels,
        orders: {
          ...prev.notification_channels.orders,
          [channel]: enabled
        }
      }
    }));
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Get current admin settings first
      const currentSettings: any = await api.get('/admin/settings');
      
      // Create the payload with the updated notification settings
      const payload = {
        restaurant: {
          admin_settings: {
            // Preserve existing admin settings
            ...(currentSettings.admin_settings || {}),
            // Update SMS sender ID
            sms_sender_id: settings.sms_sender_id,
            // Update notification channels
            notification_channels: settings.notification_channels,
            // Update Pushover settings
            pushover: settings.pushover,
            // Update Web Push settings
            web_push: settings.web_push
          }
        }
      };
      
      await api.patch('/admin/settings', payload);
      toastUtils.success('Notification settings saved successfully');
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toastUtils.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  // Test Pushover notification
  const testPushover = async () => {
    try {
      setTesting(true);
      
      // Use the user key or group key, whichever is available
      const userKey = settings.pushover?.group_key || settings.pushover?.user_key;
      
      if (!userKey) {
        toastUtils.error('Please enter a Pushover user key or group key');
        return;
      }
      
      const response: any = await api.post('/admin/test_pushover', {
        user_key: userKey,
        app_token: settings.pushover?.app_token || undefined,
        message: 'This is a test notification from Shimizu Technology',
        title: 'Test Notification',
        priority: 0,
        sound: 'pushover'
      });
      
      if (response.status === 'success') {
        toastUtils.success('Test notification sent successfully');
      } else {
        toastUtils.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toastUtils.error('Failed to send test notification');
    } finally {
      setTesting(false);
    }
  };

  // Validate Pushover key
  const validatePushoverKey = async () => {
    try {
      setValidating(true);
      
      // Use the user key or group key, whichever is available
      const userKey = settings.pushover?.group_key || settings.pushover?.user_key;
      
      if (!userKey) {
        toastUtils.error('Please enter a Pushover user key or group key');
        return;
      }
      
      const response: any = await api.post('/admin/validate_pushover_key', {
        user_key: userKey,
        app_token: settings.pushover?.app_token || undefined
      });
      
      if (response.valid) {
        toastUtils.success('Pushover key is valid');
      } else {
        toastUtils.error('Pushover key is invalid');
      }
    } catch (error) {
      console.error('Failed to validate Pushover key:', error);
      toastUtils.error('Failed to validate Pushover key');
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <SettingsHeader 
          title="Notification Settings"
          description="Configure how you receive notifications about orders and other events."
          icon={<Bell className="h-6 w-6" />}
        />
      </div>
      
      {/* SMS Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium">SMS Notifications</h3>
            <p className="text-sm text-gray-500">
              Configure SMS notifications for orders
            </p>
          </div>
          <Switch 
            checked={settings.notification_channels.orders?.sms === true}
            onChange={(enabled) => handleChannelToggle('sms', enabled)}
          >
            <span className="sr-only">Enable SMS notifications</span>
          </Switch>
        </div>
        
        {settings.notification_channels.orders?.sms && (
          <div className="mt-4">
            <label htmlFor="sms_sender_id" className="block text-sm font-medium text-gray-700 mb-1">
              SMS Sender ID
            </label>
            <input
              type="text"
              id="sms_sender_id"
              name="sms_sender_id"
              value={settings.sms_sender_id}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your SMS sender ID (max 11 characters)"
              maxLength={11}
            />
            <p className="mt-1 text-sm text-gray-500">
              This is the name that will appear as the sender of SMS messages. Maximum 11 characters.
              If left blank, your restaurant name will be used (truncated if necessary).
            </p>
          </div>
        )}
      </div>
      
      {/* Email Notifications */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Email Notifications</h3>
            <p className="text-sm text-gray-500">
              Configure email notifications for orders
            </p>
          </div>
          <Switch 
            checked={settings.notification_channels.orders?.email !== false}
            onChange={(enabled) => handleChannelToggle('email', enabled)}
          >
            <span className="sr-only">Enable email notifications</span>
          </Switch>
        </div>
      </div>
      
      {/* Pushover Notifications */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium">Pushover Notifications</h3>
            <p className="text-sm text-gray-500">
              Configure Pushover notifications for real-time alerts on your devices
            </p>
          </div>
          <Switch 
            checked={settings.notification_channels.orders?.pushover === true}
            onChange={(enabled) => handleChannelToggle('pushover', enabled)}
          >
            <span className="sr-only">Enable Pushover notifications</span>
          </Switch>
        </div>
        
        {settings.notification_channels.orders?.pushover && (
          <div className="space-y-4 mt-4">
            {/* User Key */}
            <div>
              <label htmlFor="pushover_user_key" className="block text-sm font-medium text-gray-700 mb-1">
                User Key
              </label>
              <input
                type="text"
                id="pushover_user_key"
                name="pushover_user_key"
                value={settings.pushover?.user_key || ''}
                onChange={handlePushoverInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Pushover user key"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your Pushover user key from the Pushover dashboard
              </p>
            </div>
            
            {/* Group Key */}
            <div>
              <label htmlFor="pushover_group_key" className="block text-sm font-medium text-gray-700 mb-1">
                Group Key (Optional)
              </label>
              <input
                type="text"
                id="pushover_group_key"
                name="pushover_group_key"
                value={settings.pushover?.group_key || ''}
                onChange={handlePushoverInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Pushover group key (optional)"
              />
              <p className="mt-1 text-sm text-gray-500">
                If you want to send notifications to multiple staff members, use a group key instead of a user key
              </p>
            </div>
            
            {/* App Token */}
            <div>
              <label htmlFor="pushover_app_token" className="block text-sm font-medium text-gray-700 mb-1">
                App Token (Optional)
              </label>
              <input
                type="text"
                id="pushover_app_token"
                name="pushover_app_token"
                value={settings.pushover?.app_token || ''}
                onChange={handlePushoverInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your custom Pushover app token (optional)"
              />
              <p className="mt-1 text-sm text-gray-500">
                Only fill this if you're using your own Pushover application instead of the system default
              </p>
            </div>
            
            {/* Test and Validate Buttons */}
            <div className="flex space-x-4 mt-4">
              <button
                type="button"
                onClick={validatePushoverKey}
                disabled={validating}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {validating ? (
                  <>
                    <span className="inline-block mr-2">
                      <LoadingSpinner showText={false} className="h-4 w-4" />
                    </span>
                    Validating...
                  </>
                ) : (
                  'Validate Key'
                )}
              </button>
              
              <button
                type="button"
                onClick={testPushover}
                disabled={testing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <span className="inline-block mr-2">
                      <LoadingSpinner showText={false} className="h-4 w-4" />
                    </span>
                    Sending...
                  </>
                ) : (
                  'Send Test Notification'
                )}
              </button>
            </div>
            
            {/* Help Text */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>How to set up Pushover:</strong>
              </p>
              <ol className="text-sm text-blue-700 list-decimal pl-5 mt-2">
                <li>Download the Pushover app on your device(s) from <a href="https://pushover.net/clients" target="_blank" rel="noopener noreferrer" className="underline">pushover.net/clients</a></li>
                <li>Create an account on Pushover if you don't have one</li>
                <li>Log in to your account on <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="underline">pushover.net</a></li>
                <li>Copy your User Key from the dashboard</li>
                <li>Paste it in the User Key field above</li>
                <li>For group notifications, create a group in Pushover and use the Group Key instead</li>
                <li>Click "Validate Key" to ensure your key is valid</li>
                <li>Click "Send Test Notification" to test the integration</li>
              </ol>
            </div>
          </div>
        )}
      </div>
      
      {/* Web Push Notifications */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium">Web Push Notifications</h3>
            <p className="text-sm text-gray-500">
              Enable browser notifications for orders directly in the web browser
            </p>
          </div>
          <Switch 
            checked={settings.notification_channels.orders?.web_push === true}
            onChange={(enabled) => handleChannelToggle('web_push', enabled)}
          >
            <span className="sr-only">Enable Web Push notifications</span>
          </Switch>
        </div>
        
        {settings.notification_channels.orders?.web_push && (
          <div className="space-y-4 mt-4">
            {/* VAPID Keys */}
            <div className="p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium mb-2">VAPID Keys</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public Key
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={settings.web_push?.vapid_public_key || ''}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Private Key
                  </label>
                  <div className="flex items-center">
                    <input
                      type="password"
                      value={settings.web_push?.vapid_private_key || ''}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Get the restaurant ID from the store
                        const restaurant = useRestaurantStore.getState().restaurant;
                        const restaurantId = restaurant?.id;
                        
                        if (!restaurantId) {
                          console.error('Restaurant ID not found');
                          toastUtils.error('Restaurant ID not found');
                          return;
                        }
                        
                        const response: any = await api.post(`/admin/generate_web_push_keys?restaurant_id=${restaurantId}`);
                        if (response.status === 'success') {
                          setSettings(prev => ({
                            ...prev,
                            web_push: {
                              vapid_public_key: response.public_key,
                              vapid_private_key: response.private_key
                            }
                          }));
                          toastUtils.success('VAPID keys generated successfully');
                        } else {
                          toastUtils.error('Failed to generate VAPID keys');
                        }
                      } catch (error) {
                        console.error('Failed to generate VAPID keys:', error);
                        toastUtils.error('Failed to generate VAPID keys');
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Generate New Keys
                  </button>
                  <p className="mt-1 text-xs text-gray-500">
                    Note: Generating new keys will invalidate existing subscriptions.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Subscription status and buttons */}
            <div className="p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium mb-2">Device Subscription Status</h4>
              
              {!isPushNotificationSupported() ? (
                <p className="text-sm text-red-600">
                  Your browser doesn't support push notifications.
                </p>
              ) : pushStatus === 'loading' ? (
                <p className="text-sm text-gray-500">
                  Checking subscription status...
                </p>
              ) : pushStatus === 'denied' ? (
                <p className="text-sm text-red-600">
                  Notifications are blocked for this site. Please enable notifications in your browser settings.
                </p>
              ) : pushStatus === 'not-supported' ? (
                <p className="text-sm text-red-600">
                  Your browser doesn't support push notifications.
                </p>
              ) : pushStatus === 'granted' ? (
                <div>
                  <p className="text-sm text-green-600 mb-2">
                    This device is subscribed to notifications.
                  </p>
                  <button
                    type="button"
                    onClick={handleUnsubscribeFromPush}
                    disabled={unsubscribing}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    {unsubscribing ? (
                      <>
                        <span className="inline-block mr-2">
                          <LoadingSpinner showText={false} className="h-3 w-3" />
                        </span>
                        Unsubscribing...
                      </>
                    ) : (
                      'Unsubscribe this device'
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    This device is not subscribed to notifications.
                  </p>
                  <button
                    type="button"
                    onClick={handleSubscribeToPush}
                    disabled={subscribing}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {subscribing ? (
                      <>
                        <span className="inline-block mr-2">
                          <LoadingSpinner showText={false} className="h-3 w-3" />
                        </span>
                        Subscribing...
                      </>
                    ) : (
                      'Subscribe this device'
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* Help Text */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>How Web Push Notifications Work:</strong>
              </p>
              <ol className="text-sm text-blue-700 list-decimal pl-5 mt-2">
                <li>Enable Web Push using the toggle above</li>
                <li>Click "Subscribe this device" on each device where you want to receive notifications</li>
                <li>For iPads, you must add the site to your home screen in Safari first</li>
                <li>New order notifications will appear as desktop/mobile notifications, even when the browser is closed</li>
                <li>Clicking on a notification will take you directly to the order</li>
              </ol>
            </div>
          </div>
        )}
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="inline-block mr-2">
                <LoadingSpinner showText={false} className="h-4 w-4" />
              </span>
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </div>
  );
}
