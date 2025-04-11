import React, { useEffect, useRef } from 'react';

interface PayPalPaymentButtonProps {
  amount: string;
  currency?: string;
  onPaymentSuccess?: (details: {
    status: string;
    transaction_id: string;
    amount: string;
    currency?: string;
  }) => void;
  onPaymentError?: (error: Error) => void;
  onPaymentCancel?: () => void;
  className?: string;
}

export function PayPalPaymentButton({
  amount,
  currency = 'USD',
  onPaymentSuccess,
  onPaymentError,
  onPaymentCancel,
  className
}: PayPalPaymentButtonProps) {
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const buttonInstance = useRef<any>(null);

  useEffect(() => {
    // Wait for PayPal SDK to be loaded
    if (!window.paypal || !paypalButtonRef.current) {
      return;
    }

    // Clean up any existing button
    if (buttonInstance.current) {
      try {
        buttonInstance.current.close();
      } catch (error) {
        console.error('Error closing PayPal button:', error);
      }
      buttonInstance.current = null;
    }

    try {
      // Create the PayPal button
      buttonInstance.current = window.paypal.Buttons({
        // Button style
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        
        // Create order
        createOrder: async () => {
          try {
            // Call backend to create a PayPal order
            const response = await fetch('/paypal/create_order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                amount,
                currency
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create PayPal order');
            }
            
            const data = await response.json();
            return data.orderId;
          } catch (error) {
            console.error('Error creating PayPal order:', error);
            throw error;
          }
        },
        
        // Handle approval
        onApprove: async (data: PayPalApproveData) => {
          try {
            // Call backend to capture the payment
            const response = await fetch('/paypal/capture_order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderID: data.orderID }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to capture PayPal payment');
            }
            
            const captureData = await response.json();
            
            if (onPaymentSuccess) {
              onPaymentSuccess({
                status: captureData.status,
                transaction_id: captureData.transaction_id,
                amount: captureData.amount,
                currency: captureData.currency
              });
            }
            
            return captureData;
          } catch (error) {
            console.error('Error capturing PayPal payment:', error);
            if (onPaymentError) {
              onPaymentError(error instanceof Error ? error : new Error(String(error)));
            }
            throw error;
          }
        },
        
        // Handle errors
        onError: (err: any) => {
          console.error('PayPal error:', err);
          if (onPaymentError) {
            onPaymentError(err instanceof Error ? err : new Error(String(err)));
          }
        },
        
        // Handle cancellation
        onCancel: () => {
          console.log('Payment cancelled by user');
          if (onPaymentCancel) {
            onPaymentCancel();
          }
        }
      });
      
      // Render the button
      buttonInstance.current.render(paypalButtonRef.current);
    } catch (error) {
      console.error('Error rendering PayPal button:', error);
      if (onPaymentError) {
        onPaymentError(error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    // Cleanup function
    return () => {
      if (buttonInstance.current) {
        try {
          buttonInstance.current.close();
        } catch (error) {
          console.error('Error closing PayPal button:', error);
        }
      }
    };
  }, [amount, currency, onPaymentSuccess, onPaymentError, onPaymentCancel]);

  return (
    <div 
      ref={paypalButtonRef}
      className={className}
      data-amount={amount}
      data-currency={currency}
    />
  );
}
