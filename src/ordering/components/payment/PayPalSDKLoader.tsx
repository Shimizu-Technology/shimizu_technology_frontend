import React, { useEffect, useState } from 'react';

interface PayPalSDKLoaderProps {
  clientId: string;
  currency?: string;
  components?: string[];
  onLoaded?: () => void;
  onError?: (error: Error) => void;
  testMode?: boolean;
  children: React.ReactNode;
}

export function PayPalSDKLoader({
  clientId,
  currency = 'USD',
  components = ['buttons', 'card-fields', 'hosted-fields'],
  onLoaded,
  onError,
  testMode = false,
  children
}: PayPalSDKLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Skip actual loading in test mode
    if (testMode) {
      setLoaded(true);
      if (onLoaded) onLoaded();
      return;
    }

    // Check if PayPal SDK is already loaded
    if (window.paypal) {
      setLoaded(true);
      if (onLoaded) onLoaded();
      return;
    }

    // Check if client ID is provided
    if (!clientId) {
      const missingClientIdError = new Error('PayPal client ID is not configured. Please set up PayPal in admin settings.');
      setError(missingClientIdError);
      if (onError) onError(missingClientIdError);
      return;
    }

    // Construct the script URL with query parameters
    const script = document.createElement('script');
    const componentsParam = components.join(',');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&components=${componentsParam}`;
    script.async = true;
    
    // Set up event handlers
    script.onload = () => {
      setLoaded(true);
      if (onLoaded) onLoaded();
    };
    
    script.onerror = () => {
      const loadError = new Error('Failed to load PayPal SDK');
      setError(loadError);
      if (onError) onError(loadError);
    };
    
    // Add the script to the document
    document.body.appendChild(script);
    
    // Clean up function
    return () => {
      // Only remove the script if we added it
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [clientId, currency, components, onLoaded, onError, testMode]);

  // If there's an error, show an error message
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <p className="font-medium">Error loading PayPal</p>
        <p className="text-sm mt-1">{error.message}</p>
        <p className="text-sm mt-2">Please try refreshing the page or contact support if the problem persists.</p>
      </div>
    );
  }

  // Return children regardless of loading state
  // This allows the parent component to handle the loading state
  return <>{children}</>;
}

// The Window interface with paypal property is already defined in src/types/paypal.d.ts
