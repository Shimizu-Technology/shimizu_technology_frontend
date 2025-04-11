# Payment Processing System

The Hafaloha platform offers a flexible payment processing system with support for both PayPal and Stripe payment gateways. This document provides an overview of the payment system architecture in the frontend application.

## Overview

The payment system is designed to allow each restaurant to choose their preferred payment processor:

- **PayPal Advanced/Expanded Checkout**: Provides PayPal payments and credit/debit card processing through PayPal
- **Stripe Elements**: Provides credit/debit card processing through Stripe

Key features include:

- Dynamic selection between payment processors based on restaurant settings
- Consistent component API for both payment processors
- Test mode for development and testing without actual transactions
- Ref-based architecture for parent component control

## Architecture

### Component Structure

The payment system consists of these main components:

1. **PaymentSettings**: Admin UI for configuring payment gateway settings
2. **CheckoutPage**: Parent component that dynamically renders the appropriate payment processor
3. **PayPalCheckout**: Component for PayPal payment processing
4. **StripeCheckout**: Component for Stripe payment processing

### Component Flow

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ PaymentSettings│     │  CheckoutPage  │     │ Payment Backend│
└───────┬────────┘     └───────┬────────┘     └───────┬────────┘
        │                      │                      │
        │  Configure Payment   │                      │
        │  Processor & Settings│                      │
        │◄─────────────────────                       │
        │                      │                      │
        │                      │  Fetch Restaurant    │
        │                      │  Settings            │
        │                      │─────────────────────►│
        │                      │                      │
        │                      │  Return payment_     │
        │                      │  processor setting   │
        │                      │◄─────────────────────│
        │                      │                      │
┌───────┴────────┐     ┌───────┴────────┐     ┌───────┴────────┐
│ If payment_    │     │ If payment_    │     │                │
│ processor =    │     │ processor =    │     │                │
│ "paypal"       │     │ "stripe"       │     │                │
└───────┬────────┘     └───────┬────────┘     └────────────────┘
        │                      │                      
┌───────┴────────┐     ┌───────┴────────┐     
│ PayPalCheckout │     │ StripeCheckout │     
└────────────────┘     └────────────────┘     
```

### Unified Component API

Both payment components expose a consistent ref-based API:

```tsx
// Ref types for both components
export interface PayPalCheckoutRef {
  processPayment: () => Promise<boolean>;
}

export interface StripeCheckoutRef {
  processPayment: () => Promise<boolean>;
}

// Common props interface (simplified)
interface CommonCheckoutProps {
  amount: string;
  currency?: string;
  testMode: boolean;
  onPaymentSuccess: (details: PaymentSuccessDetails) => void;
  onPaymentError: (error: Error) => void;
}
```

This consistent API allows the CheckoutPage to work with either payment processor without needing to handle different implementations.

## Conditional Rendering

The CheckoutPage uses conditional rendering to show the appropriate payment component:

```tsx
const isStripe = restaurant?.admin_settings?.payment_gateway?.payment_processor === 'stripe';

return (
  <div className="payment-container">
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
    
    <button onClick={handleSubmitOrder}>Place Order</button>
  </div>
);
```

## Test Mode

Both payment processors support a test mode that simulates payments without processing actual transactions:

- Enabled through the admin settings interface
- Shows test payment forms with pre-filled data
- Simulates successful payments after a delay
- Prefixes transaction IDs with "TEST-"

This allows testing the complete order flow without making actual payments.

## Payment Processing Flow

1. User reviews their order in CheckoutPage
2. User clicks "Place Order" button
3. CheckoutPage calls `processPayment()` on the active payment component ref
4. Payment component handles the payment processing:
   - In test mode: Simulates a successful payment
   - In live mode: Processes the payment through the API
5. Payment component calls the appropriate callback based on the result:
   - Success: `onPaymentSuccess` with transaction details
   - Error: `onPaymentError` with the error information
6. CheckoutPage completes the order creation with the payment information

## Admin Configuration

Restaurant administrators can configure their payment settings through the admin interface:

1. Navigate to **Admin → Settings → Payment Gateway**
2. Select the preferred payment processor (PayPal or Stripe)
3. Enter the necessary credentials for the selected processor
4. Toggle test mode as needed for development or testing
5. Save the settings

These settings are stored in the restaurant's `admin_settings` field and retrieved whenever the checkout page is loaded.

## Implementation Details

### Shared Backend Communication

Both payment components communicate with the backend through shared API clients:

```tsx
// For PayPal
import { api } from '../../../shared/api/apiClient';
import { paypalApi } from '../../../shared/api/endpoints/paypal';

// For Stripe
import { api } from '../../../shared/api/apiClient';
import { stripeApi } from '../../../shared/api/endpoints/stripe';
```

### Ref-based Architecture

Both components use React refs and `useImperativeHandle` to expose their functionality to parent components:

```tsx
// Inside payment components
React.useImperativeHandle(ref, () => ({
  processPayment
}), [processPayment]);

// In parent component
const paymentRef = useRef<PaymentComponentRef>(null);

const handleSubmit = async () => {
  if (paymentRef.current) {
    const success = await paymentRef.current.processPayment();
    if (success) {
      // Handle successful payment
    }
  }
};
```

This architecture allows the parent component to control when payment processing begins, while the payment components handle the details of how payments are processed.

## Related Documentation

For detailed information about specific payment processors, see:

- [PayPal Integration Guide](./paypal_integration.md)
- [Stripe Integration Guide](./stripe_integration.md)
