import React, { useState, useEffect } from 'react';
import toastUtils from '../../../../shared/utils/toastUtils';
import { api } from '../../../../shared/api/apiClient';
import { LoadingSpinner, SettingsHeader } from '../../../../shared/components/ui';
import { CreditCard, WalletCards } from 'lucide-react';
import { PaymentTester } from './PaymentTester';
import { brandColors } from '../../payment/PaymentBaseStyles';

// Simple Switch component since @headlessui/react might not be available
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

interface PaymentSettings {
  test_mode: boolean;
  payment_processor: 'paypal' | 'stripe';
  
  // PayPal fields
  client_id: string;
  client_secret: string;
  environment: 'sandbox' | 'production';
  paypal_webhook_id: string;
  paypal_webhook_secret: string;
  
  // Stripe fields
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
}

export function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    test_mode: true,
    payment_processor: 'paypal',
    client_id: '',
    client_secret: '',
    environment: 'sandbox',
    paypal_webhook_id: '',
    paypal_webhook_secret: '',
    publishable_key: '',
    secret_key: '',
    webhook_secret: ''
  });

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const response: any = await api.get('/admin/settings');
        
        // Extract payment gateway settings from admin_settings
        const paymentGateway = response.admin_settings?.payment_gateway || {};
        
        setSettings({
          test_mode: paymentGateway.test_mode !== false, // Default to true if not set
          payment_processor: paymentGateway.payment_processor || 'paypal', // Default to PayPal if not set
          client_id: paymentGateway.client_id || '',
          client_secret: paymentGateway.client_secret || '',
          environment: paymentGateway.environment || 'sandbox',
          paypal_webhook_id: paymentGateway.paypal_webhook_id || '',
          paypal_webhook_secret: paymentGateway.paypal_webhook_secret || '',
          publishable_key: paymentGateway.publishable_key || '',
          secret_key: paymentGateway.secret_key || '',
          webhook_secret: paymentGateway.webhook_secret || ''
        });
      } catch (error) {
        console.error('Failed to fetch payment settings:', error);
        toastUtils.error('Failed to load payment settings');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSettings();
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle test mode toggle
  const handleTestModeToggle = (enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      test_mode: enabled
    }));
  };

  // Handle payment processor toggle
  const handleProcessorChange = (processor: 'paypal' | 'stripe') => {
    setSettings(prev => ({
      ...prev,
      payment_processor: processor
    }));
  };

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Get current admin settings first
      const currentSettings: any = await api.get('/admin/settings');
      
      // Create the payload with the updated payment gateway settings
      // The 'restaurant' property is required by the backend controller
      const payload = {
        restaurant: {
          admin_settings: {
            // Preserve existing admin settings
            ...(currentSettings.admin_settings || {}),
            // Update payment gateway settings
            payment_gateway: {
              test_mode: settings.test_mode,
              payment_processor: settings.payment_processor,
              // Include PayPal settings
              client_id: settings.client_id,
              client_secret: settings.client_secret,
              environment: settings.environment,
              paypal_webhook_id: settings.paypal_webhook_id,
              paypal_webhook_secret: settings.paypal_webhook_secret,
              // Include Stripe settings
              publishable_key: settings.publishable_key,
              secret_key: settings.secret_key,
              webhook_secret: settings.webhook_secret
            }
          }
        }
      };
      
      await api.patch('/admin/settings', payload);
      toastUtils.success('Payment settings saved successfully');
    } catch (error) {
      console.error('Failed to save payment settings:', error);
      toastUtils.error('Failed to save payment settings');
    } finally {
      setSaving(false);
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
          title="Payment Gateway Settings"
          description="Configure your payment processing settings."
          icon={<CreditCard className="h-6 w-6" />}
        />
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        {/* Test Mode & Payment Processor Selection */}
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-medium">Test Mode</h3>
              <p className="text-sm text-gray-500">
                Enable test mode to allow orders without payment processing
              </p>
            </div>
            <Switch 
              checked={settings.test_mode}
              onChange={handleTestModeToggle}
              className={`${
                settings.test_mode ? 'bg-blue-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full`}
            >
              <span className="sr-only">Enable test mode</span>
            </Switch>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Payment Processor</h3>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                type="button"
                className={`flex-1 py-2 text-center ${
                  settings.payment_processor === 'paypal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleProcessorChange('paypal')}
              >
                PayPal
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-center ${
                  settings.payment_processor === 'stripe'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleProcessorChange('stripe')}
              >
                Stripe
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Payment Processor Specific Settings */}
      {settings.payment_processor === 'paypal' ? (
        /* PayPal Credentials */
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-4">PayPal Credentials</h3>
          
          <div className="space-y-4">
            {/* Environment Selection */}
            <div>
              <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-1">
                Environment
              </label>
              <select
                id="environment"
                name="environment"
                value={settings.environment}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="sandbox">Sandbox (Testing)</option>
                <option value="production">Production (Live)</option>
              </select>
            </div>
            
            {/* Client ID */}
            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                id="client_id"
                name="client_id"
                value={settings.client_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your PayPal Client ID"
              />
            </div>
            
            {/* Client Secret */}
            <div>
              <label htmlFor="client_secret" className="block text-sm font-medium text-gray-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                id="client_secret"
                name="client_secret"
                value={settings.client_secret}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your PayPal Client Secret"
              />
            </div>
            
            {/* PayPal Webhook ID */}
            <div>
              <label htmlFor="paypal_webhook_id" className="block text-sm font-medium text-gray-700 mb-1">
                Webhook ID
              </label>
              <input
                type="text"
                id="paypal_webhook_id"
                name="paypal_webhook_id"
                value={settings.paypal_webhook_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your PayPal Webhook ID"
              />
              <p className="mt-1 text-sm text-gray-500">
                The ID of the webhook you created in the PayPal Developer Dashboard
              </p>
            </div>
            
            {/* PayPal Webhook ID help text */}
            <p className="mt-1 text-sm text-gray-500">
              The ID of the webhook you created in the PayPal Developer Dashboard.
              This is used to verify webhook events from PayPal.
            </p>
          </div>

          {/* Help Text */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>How to get PayPal credentials:</strong>
            </p>
            <ol className="text-sm text-blue-700 list-decimal pl-5 mt-2">
              <li>Go to <a href="https://developer.paypal.com/dashboard/" target="_blank" rel="noopener noreferrer" className="underline">PayPal Developer Dashboard</a></li>
              <li>Log in with your PayPal Business account</li>
              <li>Navigate to "My Apps & Credentials"</li>
              <li>Create a new REST API app or select an existing one</li>
              <li>Copy the Client ID and Secret from the app credentials</li>
              <li>Make sure "Advanced (Expanded) Credit and Debit Card Payments" is enabled</li>
              <li>For webhooks, go to the Webhooks section in your app settings</li>
              <li>Create a webhook with URL: <code>https://your-api-domain.com/paypal/webhook</code></li>
              <li>Select all the payment and checkout event types</li>
              <li>After creating the webhook, copy the Webhook ID (shown in the webhook details)</li>
              <li>After creating the webhook, copy the Webhook ID for verification</li>
            </ol>
          </div>
        </div>
      ) : (
        /* Stripe Credentials */
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-4">Stripe Credentials</h3>
          
          <div className="space-y-4">
            {/* Publishable Key */}
            <div>
              <label htmlFor="publishable_key" className="block text-sm font-medium text-gray-700 mb-1">
                Publishable Key
              </label>
              <input
                type="text"
                id="publishable_key"
                name="publishable_key"
                value={settings.publishable_key}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Stripe Publishable Key"
              />
            </div>
            
            {/* Secret Key */}
            <div>
              <label htmlFor="secret_key" className="block text-sm font-medium text-gray-700 mb-1">
                Secret Key
              </label>
              <input
                type="password"
                id="secret_key"
                name="secret_key"
                value={settings.secret_key}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Stripe Secret Key"
              />
            </div>
            
            {/* Webhook Secret */}
            <div>
              <label htmlFor="webhook_secret" className="block text-sm font-medium text-gray-700 mb-1">
                Webhook Secret
              </label>
              <input
                type="password"
                id="webhook_secret"
                name="webhook_secret"
                value={settings.webhook_secret}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Stripe Webhook Secret"
              />
              <p className="mt-1 text-sm text-gray-500">
                Used to verify webhook events from Stripe
              </p>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>How to get Stripe credentials:</strong>
            </p>
            <ol className="text-sm text-blue-700 list-decimal pl-5 mt-2">
              <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a></li>
              <li>Log in to your Stripe account</li>
              <li>Navigate to Developers → API keys</li>
              <li>Copy the Publishable key and Secret key</li>
              <li>For the Webhook Secret, go to Developers → Webhooks</li>
              <li>Create an endpoint for your site and reveal the signing secret</li>
            </ol>
          </div>
        </div>
      )}
      
      {/* Test Mode Warning */}
      {settings.test_mode && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            <strong>Test Mode is enabled.</strong> Orders will be created without actual payment processing.
            This is useful for testing the ordering flow without real payments.
          </p>
        </div>
      )}
      
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
      
      {/* Payment Test Environment */}
      <div className="mt-8 pt-8 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <SettingsHeader 
            title="Payment Test Environment"
            description="Test your payment processing configuration."
            icon={<WalletCards className="h-6 w-6" />}
          />
        </div>
        
        <PaymentTester />
      </div>
    </div>
  );
}
