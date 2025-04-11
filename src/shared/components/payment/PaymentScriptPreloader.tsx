import { useEffect, useState, useRef } from 'react';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { initPaymentScript, preloadStripeScript } from '../../utils/PaymentScriptLoader';

/**
 * PaymentScriptPreloader
 *
 * This component aggressively preloads the appropriate payment script (Stripe or PayPal)
 * based on the restaurant's configured payment processor.
 *
 * It should be mounted early in the application lifecycle to ensure
 * payment scripts are loaded before they're needed.
 */
export function PaymentScriptPreloader() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restaurant = useRestaurantStore((state) => state.restaurant);
  const hasPreloaded = useRef(false);
  
  // Immediately preload Stripe script on component mount
  // This happens before we even know which payment processor is configured
  useEffect(() => {
    // Preload Stripe script immediately
    preloadStripeScript();
  }, []);

  // Once restaurant data is available, load the appropriate script
  useEffect(() => {
    // Skip if we've already attempted to load or if restaurant data isn't available yet
    if (isLoading || !restaurant || hasPreloaded.current) {
      return;
    }
    
    // Set hasPreloaded to true immediately to prevent multiple attempts
    hasPreloaded.current = true;

    const loadPaymentScript = async () => {
      try {
        setIsLoading(true);
        hasPreloaded.current = true;
        
        // Get payment gateway settings from restaurant
        const paymentGateway = restaurant.admin_settings?.payment_gateway || {};
        const paymentProcessor = paymentGateway.payment_processor || 'paypal';
        const testMode = paymentGateway.test_mode !== false;
        
        // Skip actual loading in test mode
        if (testMode) {
          console.log('Payment in test mode, skipping script loading');
          return;
        }
        
        // Initialize the appropriate payment script with high priority
        if (paymentProcessor === 'stripe') {
          await initPaymentScript('stripe');
          console.log('Stripe script preloaded successfully');
        } else if (paymentProcessor === 'paypal') {
          const clientId = paymentGateway.client_id as string;
          if (clientId) {
            await initPaymentScript('paypal', { clientId });
            console.log('PayPal script preloaded successfully');
          } else {
            console.warn('PayPal client ID not found, skipping script preload');
          }
        }
      } catch (err) {
        console.error('Error preloading payment script:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        hasPreloaded.current = false; // Reset so we can try again
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentScript();
  }, [restaurant, isLoading]);

  // This component doesn't render anything
  return null;
}