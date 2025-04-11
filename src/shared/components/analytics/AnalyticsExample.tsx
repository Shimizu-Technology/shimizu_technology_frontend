import React, { useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import { 
  trackEvent, 
  trackCustomerEvent, 
  trackAdminEvent, 
  EventNames 
} from '../../utils/analyticsUtils';

/**
 * This is an example component demonstrating how to use PostHog analytics
 * in the Hafaloha application. This component is for demonstration purposes only
 * and is not meant to be used in production.
 */
const AnalyticsExample: React.FC = () => {
  // Get the PostHog instance directly if needed
  const posthog = usePostHog();
  
  // Track page view on component mount
  useEffect(() => {
    trackEvent(EventNames.PAGE_VIEWED, {
      page_name: 'Analytics Example',
      path: window.location.pathname
    });
  }, []);
  
  // Example of tracking a customer event
  const handleCustomerAction = () => {
    trackCustomerEvent(EventNames.ITEM_VIEWED, {
      item_id: '123',
      item_name: 'Example Item',
      category: 'Examples'
    });
    
    alert('Customer event tracked!');
  };
  
  // Example of tracking an admin event
  const handleAdminAction = () => {
    trackAdminEvent(EventNames.ADMIN_SETTING_CHANGED, {
      setting_name: 'example_setting',
      old_value: false,
      new_value: true
    });
    
    alert('Admin event tracked!');
  };
  
  // Example of tracking a custom event
  const handleCustomEvent = () => {
    trackEvent('custom.example.event', {
      custom_property: 'custom value',
      timestamp: new Date().toISOString()
    });
    
    alert('Custom event tracked!');
  };
  
  // Example of using feature flags
  const handleCheckFeatureFlag = () => {
    const isEnabled = posthog?.isFeatureEnabled('example-flag');
    
    alert(`Feature flag 'example-flag' is ${isEnabled ? 'enabled' : 'disabled'}`);
  };
  
  // Example of tracking an error
  const handleSimulateError = () => {
    try {
      // Simulate an error
      throw new Error('Example error');
    } catch (error) {
      if (error instanceof Error) {
        trackEvent('error.occurred', {
          error_message: error.message,
          error_type: error.name,
          component: 'AnalyticsExample'
        });
        
        alert(`Error tracked: ${error.message}`);
      }
    }
  };
  
  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">PostHog Analytics Examples</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Customer Events</h3>
          <button 
            onClick={handleCustomerAction}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Track Customer Event
          </button>
        </div>
        
        <div>
          <h3 className="font-semibold">Admin Events</h3>
          <button 
            onClick={handleAdminAction}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Track Admin Event
          </button>
        </div>
        
        <div>
          <h3 className="font-semibold">Custom Events</h3>
          <button 
            onClick={handleCustomEvent}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Track Custom Event
          </button>
        </div>
        
        <div>
          <h3 className="font-semibold">Feature Flags</h3>
          <button 
            onClick={handleCheckFeatureFlag}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Check Feature Flag
          </button>
        </div>
        
        <div>
          <h3 className="font-semibold">Error Tracking</h3>
          <button 
            onClick={handleSimulateError}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Simulate Error
          </button>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
        <p>
          <strong>Note:</strong> This component is for demonstration purposes only. 
          Check the browser console to see the events being tracked.
        </p>
        <p className="mt-2">
          For more information, see the documentation at:
          <br />
          <code className="text-xs">docs/analytics_integration.md</code>
        </p>
      </div>
    </div>
  );
};

export default AnalyticsExample;
