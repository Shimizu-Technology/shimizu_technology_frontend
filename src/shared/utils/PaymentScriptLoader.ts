/**
 * PaymentScriptLoader.ts
 * A utility for dynamically loading payment scripts (Stripe, PayPal) based on configuration
 */

// Track script loading status and promises
const scriptStatus: Record<string, 'loading' | 'loaded' | 'error' | undefined> = {};
const scriptPromises: Record<string, Promise<void>> = {};

// Cache for Stripe instances
const stripeInstances: Record<string, any> = {};

// Constants
const STRIPE_SCRIPT_URL = 'https://js.stripe.com/v3/';
const STRIPE_SCRIPT_ID = 'stripe-js';

/**
 * Load a script dynamically with high priority
 * @param src Script source URL
 * @param id Optional ID for the script tag
 * @returns Promise that resolves when the script is loaded
 */
function loadScript(src: string, id?: string): Promise<void> {
  // Return cached promise if script is already loading
  if (src in scriptPromises) {
    return scriptPromises[src];
  }

  const promise = new Promise<void>((resolve, reject) => {
    // Check if script is already loaded
    if (scriptStatus[src] === 'loaded') {
      resolve();
      return;
    }

    // Mark as loading
    scriptStatus[src] = 'loading';

    // Create script element with high priority
    const script = document.createElement('script');
    script.src = src;
    script.id = id || `script-${Date.now()}`;
    
    // Set high priority attributes
    script.async = false; // Load synchronously for higher priority
    script.setAttribute('fetchpriority', 'high');
    script.setAttribute('importance', 'high');

    // Set up load and error handlers
    script.onload = () => {
      scriptStatus[src] = 'loaded';
      resolve();
    };

    script.onerror = () => {
      scriptStatus[src] = 'error';
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      delete scriptPromises[src];
      reject(new Error(`Failed to load script: ${src}`));
    };

    // Add to document head for faster loading (instead of body)
    document.head.appendChild(script);
  });

  // Cache the promise
  scriptPromises[src] = promise;
  return promise;
}

/**
 * Preload Stripe.js script with resource hints
 * This should be called as early as possible
 */
export function preloadStripeScript(): void {
  // Skip if already loaded or preloaded
  if (scriptStatus[STRIPE_SCRIPT_URL] || document.getElementById('stripe-preload')) {
    return;
  }

  // Add preload link
  const preloadLink = document.createElement('link');
  preloadLink.rel = 'preload';
  preloadLink.as = 'script';
  preloadLink.href = STRIPE_SCRIPT_URL;
  preloadLink.id = 'stripe-preload';
  preloadLink.crossOrigin = 'anonymous';
  document.head.appendChild(preloadLink);

  // Also add DNS prefetch
  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = 'https://js.stripe.com';
  document.head.appendChild(dnsPrefetch);
}

/**
 * Load Stripe.js script with optimized loading
 * @returns Promise that resolves when Stripe.js is loaded
 */
export async function loadStripeScript(): Promise<void> {
  try {
    console.log('PaymentScriptLoader: loadStripeScript called');
    
    // Check if Stripe is already available
    if ((window as any).Stripe) {
      console.log('PaymentScriptLoader: Stripe already available in window, skipping load');
      return;
    }
    
    // Preload first (no-op if already preloaded)
    console.log('PaymentScriptLoader: Preloading Stripe script');
    preloadStripeScript();
    
    // Then load the script
    console.log('PaymentScriptLoader: Loading Stripe script');
    await loadScript(STRIPE_SCRIPT_URL, STRIPE_SCRIPT_ID);
    console.log('PaymentScriptLoader: Stripe script loaded successfully');
  } catch (error) {
    console.error('PaymentScriptLoader: Error loading Stripe script:', error);
    throw error;
  }
}

/**
 * Load PayPal script with optimized loading
 * @param clientId PayPal client ID
 * @returns Promise that resolves when PayPal script is loaded
 */
export async function loadPayPalScript(clientId: string): Promise<void> {
  try {
    // Check if PayPal is already available
    if ((window as any).paypal) {
      return;
    }
    
    const paypalScriptUrl = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons,card-fields`;
    await loadScript(paypalScriptUrl, 'paypal-js');
  } catch (error) {
    console.error('Error loading PayPal script:', error);
    throw error;
  }
}

/**
 * Initialize the appropriate payment script based on the payment processor
 * @param paymentProcessor The configured payment processor ('stripe' or 'paypal')
 * @param config Configuration options (clientId for PayPal)
 * @returns Promise that resolves when the script is loaded
 */
export async function initPaymentScript(
  paymentProcessor: 'stripe' | 'paypal',
  config?: { clientId?: string }
): Promise<void> {
  try {
    if (paymentProcessor === 'stripe') {
      await loadStripeScript();
    } else if (paymentProcessor === 'paypal' && config?.clientId) {
      await loadPayPalScript(config.clientId);
    } else {
      throw new Error(`Invalid payment processor or missing configuration: ${paymentProcessor}`);
    }
  } catch (error) {
    console.error('Error initializing payment script:', error);
    throw error;
  }
}

/**
 * Get the Stripe instance with caching
 * @param publishableKey Stripe publishable key
 * @returns Stripe instance
 */
export function getStripe(publishableKey: string): any {
  console.log('PaymentScriptLoader: getStripe called with key:', publishableKey ? publishableKey.substring(0, 5) + '...' : 'missing');
  
  if (!publishableKey) {
    console.error('PaymentScriptLoader: Stripe publishable key is missing');
    throw new Error('Stripe publishable key is required');
  }
  
  if (!(window as any).Stripe) {
    console.error('PaymentScriptLoader: Stripe.js not loaded');
    throw new Error('Stripe.js not loaded');
  }
  
  // Return cached instance if available
  if (stripeInstances[publishableKey]) {
    console.log('PaymentScriptLoader: Returning cached Stripe instance');
    return stripeInstances[publishableKey];
  }
  
  try {
    // Create and cache new instance
    console.log('PaymentScriptLoader: Creating new Stripe instance');
    const stripeInstance = (window as any).Stripe(publishableKey);
    stripeInstances[publishableKey] = stripeInstance;
    console.log('PaymentScriptLoader: Stripe instance created successfully');
    return stripeInstance;
  } catch (error) {
    console.error('PaymentScriptLoader: Error creating Stripe instance:', error);
    throw error;
  }
}

// Immediately preload Stripe script when this module is imported
// This ensures the script starts loading as early as possible
if (typeof window !== 'undefined') {
  preloadStripeScript();
}