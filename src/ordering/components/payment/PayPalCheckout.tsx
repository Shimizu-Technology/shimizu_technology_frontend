import React, { useState, useCallback, useRef } from 'react';
import { LoadingSpinner } from '../../../shared/components/ui';
import { PayPalSDKLoader } from './PayPalSDKLoader';
import { PayPalCardFields } from './PayPalCardFields';
import { PayPalPaymentButton } from './PayPalPaymentButton';

interface PayPalCheckoutProps {
  amount: string;
  clientId: string;
  currency?: string;
  onPaymentSuccess?: (details: {
    status: string;
    transaction_id: string;
    amount: string;
    currency?: string;
  }) => void;
  onPaymentError?: (error: Error) => void;
  onPaymentCancel?: () => void;
  testMode?: boolean;
}

// Create a ref type for accessing the component from parent
export interface PayPalCheckoutRef {
  processPayment: () => Promise<boolean>;
}

export const PayPalCheckout = React.forwardRef<PayPalCheckoutRef, PayPalCheckoutProps>((props, ref) => {
  const {
    amount,
    clientId,
    currency = 'USD',
    onPaymentSuccess,
    onPaymentError,
    onPaymentCancel,
    testMode = false
  } = props;

  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [cardFieldsValid, setCardFieldsValid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card'>('card');
  const [processing, setProcessing] = useState(false);
  
  // Store reference to the PayPal button instance
  const paypalButtonRef = useRef<any>(null);

  // Handle the card fields validation state
  const handleCardFieldsValidityChange = useCallback((isValid: boolean) => {
    setCardFieldsValid(isValid);
  }, []);

  // Handle SDK loading completion
  const handleSdkLoaded = useCallback(() => {
    setSdkLoaded(true);
  }, []);

  // Handle payment errors
  const handlePaymentError = useCallback((error: Error) => {
    setProcessing(false);
    if (onPaymentError) {
      onPaymentError(error);
    }
    return false;
  }, [onPaymentError]);

  // Handle payment success
  const handlePaymentSuccess = useCallback((details: {
    status: string;
    transaction_id: string;
    amount: string;
    currency?: string;
  }) => {
    setProcessing(false);
    if (onPaymentSuccess) {
      onPaymentSuccess(details);
    }
    return true;
  }, [onPaymentSuccess]);

  // Process payment function - exposed to parent via ref
  const processPayment = async (): Promise<boolean> => {
    if (processing) return false;
    setProcessing(true);
    
    // Test mode payment processing
    if (testMode) {
      // Simulate a processing delay
      return new Promise(resolve => {
        setTimeout(() => {
          if (onPaymentSuccess) {
            onPaymentSuccess({
              status: 'COMPLETED',
              transaction_id: `TEST-${Date.now()}`,
              amount,
              currency
            });
          }
          setProcessing(false);
          resolve(true);
        }, 1500);
      });
    }
    
    // For PayPal method, we need to click the PayPal button programmatically
    if (paymentMethod === 'paypal') {
      if (paypalButtonRef.current && typeof paypalButtonRef.current.click === 'function') {
        try {
          paypalButtonRef.current.click();
          return true; // This doesn't guarantee success, but indicates we started the process
        } catch (error) {
          console.error('Failed to click PayPal button:', error);
          handlePaymentError(new Error('Failed to initiate PayPal payment'));
          return false;
        }
      } else {
        handlePaymentError(new Error('PayPal button not available'));
        return false;
      }
    }
    
    // For card method, we process directly
    if (paymentMethod === 'card' && cardFieldsValid) {
      try {
        // Create order first
        const orderResponse = await fetch('/paypal/create_order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            amount,
            currency
          }),
        });
        
        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          throw new Error(errorData.error || 'Failed to create PayPal order');
        }
        
        const orderData = await orderResponse.json();
        const orderId = orderData.orderId;
        
        // Now capture the order
        const captureResponse = await fetch('/paypal/capture_order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orderID: orderId }),
        });
        
        if (!captureResponse.ok) {
          const errorData = await captureResponse.json();
          throw new Error(errorData.error || 'Failed to capture PayPal payment');
        }
        
        const captureData = await captureResponse.json();
        
        handlePaymentSuccess({
          status: captureData.status,
          transaction_id: captureData.transaction_id,
          amount: captureData.amount,
          currency: captureData.currency
        });
        
        return true;
      } catch (error) {
        handlePaymentError(error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    }
    
    setProcessing(false);
    return false;
  };
  
  // Expose the processPayment method to parent component
  React.useImperativeHandle(ref, () => ({
    processPayment
  }), [processPayment]);

  // Payment method selector
  const renderPaymentMethodSelector = () => (
    <div className="mb-6">
      <div className="flex border rounded-lg overflow-hidden">
        <button
          type="button"
          className={`flex-1 py-2 text-center ${
            paymentMethod === 'paypal'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setPaymentMethod('paypal')}
        >
          PayPal
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-center ${
            paymentMethod === 'card'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setPaymentMethod('card')}
        >
          Credit/Debit Card
        </button>
      </div>
    </div>
  );

  // Test mode indicator banner or missing client ID warning
  const statusBanner = (() => {
    if (testMode) {
      return (
        <div className="p-2 mb-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
          <span className="inline-flex items-center bg-yellow-100 text-yellow-800 font-semibold px-2 py-1 rounded mr-2">
            TEST MODE
          </span>
          <span className="text-yellow-700">Payments will be simulated without processing real cards.</span>
        </div>
      );
    }
    
    if (!clientId) {
      return (
        <div className="p-2 mb-4 bg-red-50 border border-red-200 rounded-md text-sm">
          <span className="inline-flex items-center bg-red-100 text-red-800 font-semibold px-2 py-1 rounded mr-2">
            CONFIGURATION ERROR
          </span>
          <span className="text-red-700">PayPal client ID is not configured. Please set up PayPal in admin settings.</span>
        </div>
      );
    }
    
    return null;
  })();

  return (
    <PayPalSDKLoader
      clientId={clientId}
      currency={currency}
      components={['buttons', 'card-fields']}
      onLoaded={handleSdkLoaded}
      onError={handlePaymentError}
      testMode={testMode}
    >
      {statusBanner}
      
      {sdkLoaded ? (
        <div className="mt-4">
          {renderPaymentMethodSelector()}
          
          {paymentMethod === 'paypal' ? (
            <div className="mb-4">
              <p className="text-gray-700 mb-3">
                Click the PayPal button below to complete your payment.
              </p>
              <div className="paypal-button-container" style={{ minHeight: '45px' }}>
                {/* PayPal button container */}
                <div ref={paypalButtonRef}>
                  <PayPalPaymentButton
                    amount={amount}
                    currency={currency}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                    onPaymentCancel={onPaymentCancel}
                    className="w-full"
                  />
                </div>
              </div>
              
              {/* In test mode, show a fake PayPal button UI */}
              {testMode && (
                <div className="border border-blue-500 rounded p-4 text-center bg-blue-50">
                  <img 
                    src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" 
                    alt="PayPal" 
                    className="h-6 mx-auto mb-2"
                  />
                  <p className="text-sm text-blue-700">PayPal payment will be simulated</p>
                </div>
              )}
              
              {/* Processing indicator removed in favor of full-screen overlay */}
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-gray-700 mb-3">
                Enter your card details to complete your payment.
              </p>
              
              {testMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Number
                    </label>
                    <input 
                      type="text"
                      defaultValue="4111 1111 1111 1111"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      placeholder="4111 1111 1111 1111 (Test Card)"
                      readOnly
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiration Date
                      </label>
                      <input
                        type="text"
                        defaultValue="12/25"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        placeholder="MM/YY"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CVV
                      </label>
                      <input
                        type="text"
                        defaultValue="123"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        placeholder="123"
                        readOnly
                      />
                    </div>
                  </div>
                  
                  <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-700 mt-2">
                    <strong>Test Mode:</strong> In test mode, any card details will be accepted.
                  </div>
                </div>
              ) : (
                <PayPalCardFields 
                  onCardFieldsReady={handleCardFieldsValidityChange}
                  onError={handlePaymentError}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
          <span className="ml-3">Loading payment options...</span>
        </div>
      )}
    </PayPalSDKLoader>
  );
});

// Add display name for better debugging
PayPalCheckout.displayName = 'PayPalCheckout';
