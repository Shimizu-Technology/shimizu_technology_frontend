# Stripe Integration Guide

This document explains how to set up and use Stripe for payment processing in the Hafaloha frontend.

## Overview

Hafaloha can use Stripe for payment processing through the Stripe Elements integration. This provides:

1. Secure credit/debit card payments
2. Responsive and customizable payment forms
3. PCI compliance management
4. Test mode for development and testing

## Component Architecture

The Stripe integration consists of these key components:

1. **StripeCheckout**: Main payment component that handles Stripe initialization and payment processing
2. **PaymentSettings**: Admin settings component for configuring Stripe credentials
3. **CheckoutPage**: Page that conditionally renders PayPal or Stripe based on restaurant settings

## Using the StripeCheckout Component

The `StripeCheckout` component is designed to be a drop-in payment solution that can be controlled by parent components:

```tsx
import { StripeCheckout, StripeCheckoutRef } from './payment/StripeCheckout';
import { useRef } from 'react';

function PaymentForm() {
  const stripeRef = useRef<StripeCheckoutRef>(null);
  
  const handlePaymentSubmit = async () => {
    if (stripeRef.current) {
      const success = await stripeRef.current.processPayment();
      if (success) {
        // Payment successful
      }
    }
  };
  
  return (
    <div>
      <StripeCheckout 
        ref={stripeRef}
        amount="100.00"
        publishableKey="pk_test_..."
        currency="USD"
        testMode={false}
        onPaymentSuccess={handleSuccess}
        onPaymentError={handleError}
      />
      
      <button onClick={handlePaymentSubmit}>Pay Now</button>
    </div>
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `amount` | string | Amount to charge (e.g., "100.00") |
| `currency` | string | Currency code (default: "USD") |
| `publishableKey` | string | Stripe publishable key from settings |
| `testMode` | boolean | Enable test mode without actual payments |
| `onPaymentSuccess` | function | Callback when payment succeeds |
| `onPaymentError` | function | Callback when payment fails |

### Ref Methods

The component exposes a ref with the following methods:

| Method | Return | Description |
|--------|--------|-------------|
| `processPayment()` | Promise\<boolean\> | Process the payment and return success status |

## Test Mode

When `testMode` is set to `true`:

- No actual Stripe API calls are made
- A simulated payment form is displayed
- Payment success is simulated after a short delay
- Transaction IDs are prefixed with "TEST-"

This is useful for testing the order flow without processing real payments.

## Integration with CheckoutPage

The `CheckoutPage` component determines which payment processor to use based on restaurant settings:

```tsx
const isStripe = restaurant?.admin_settings?.payment_gateway?.payment_processor === 'stripe';

{isStripe ? (
  <StripeCheckout 
    ref={stripeRef}
    amount={finalTotal.toString()} 
    publishableKey={restaurant?.admin_settings?.payment_gateway?.publishable_key || ""}
    currency="USD"
    testMode={restaurant?.admin_settings?.payment_gateway?.test_mode ?? true}
    onPaymentSuccess={handlePaymentSuccess}
    onPaymentError={handlePaymentError}
  />
) : (
  <PayPalCheckout 
    ref={paypalRef}
    amount={finalTotal.toString()} 
    clientId={restaurant?.admin_settings?.payment_gateway?.client_id || ""}
    currency="USD"
    testMode={restaurant?.admin_settings?.payment_gateway?.test_mode ?? true}
    onPaymentSuccess={handlePaymentSuccess}
    onPaymentError={handlePaymentError}
  />
)}
```

## Configuration in Admin Settings

To configure Stripe in the admin dashboard:

1. Navigate to **Admin → Settings → Payment Gateway**
2. Select **Stripe** as the payment processor
3. Enter your **Publishable Key**, **Secret Key**, and **Webhook Secret**
4. Toggle **Test Mode** as needed
5. Save your settings

## Implementation Details

### Stripe Elements Integration

The component uses Stripe Elements for secure payment processing:

```tsx
// Initialize Stripe Elements
useEffect(() => {
  if (elementsInitialized.current || !stripe || !clientSecret) {
    return;
  }
  
  const elementsInstance = stripe.elements({
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#c1902f',
      },
    },
  });
  setElements(elementsInstance);
}, [stripe, clientSecret]);

// Process payment
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: window.location.origin + '/order-confirmation',
  },
  redirect: 'if_required',
});
```

### Dynamic Script Loading

The component dynamically loads the Stripe.js script when needed:

```tsx
const script = document.createElement('script');
script.src = 'https://js.stripe.com/v3/';
script.async = true;
script.onload = () => {
  setStripe((window as any).Stripe(publishableKey));
  setLoading(false);
};
document.body.appendChild(script);
```

## Troubleshooting

### Common Issues

1. **Stripe Elements not appearing**:
   - Check that `publishableKey` is valid and correctly formatted
   - Ensure the script loaded successfully (check console for errors)
   - Verify that `testMode` is disabled if you want to see actual Stripe Elements

2. **Payment processing errors**:
   - Check browser console for detailed error messages
   - Verify that the amount is valid and greater than zero
   - Ensure the Stripe account is properly set up

3. **Component not rendering properly**:
   - Make sure Stripe.js has loaded correctly
   - Check that you're providing all required props
   - Verify React refs are properly set up

## Testing

For testing with Stripe's test environment:

1. Use test API keys (starting with `pk_test_`)
2. Use these test card numbers:
   - Visa: `4242 4242 4242 4242`
   - Mastercard: `5555 5555 5555 4444`
   - Amex: `3782 822463 10005`
3. Use any future expiration date
4. Use any 3-digit CVV (4-digit for Amex)
5. Use any billing address with a valid zip/postal code

## Related Documentation

- [Hafaloha Payment Processing Overview](../docs/payment_processing.md)
- [PayPal Integration Guide](./paypal_integration.md)
- [Stripe Official Documentation](https://stripe.com/docs/stripe-js/react)
