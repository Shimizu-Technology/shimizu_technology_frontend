# PostHog Analytics Integration (Frontend)

This document outlines how PostHog analytics is integrated into the Hafaloha frontend application for tracking user behavior, feature usage, and system events.

## Overview

PostHog is an open-source product analytics platform that helps track user behavior across the application. The frontend integration uses the PostHog React SDK to track user interactions and page views.

## Configuration

### Environment Variables

The following environment variables are required for PostHog integration:

**.env.local:**
```
VITE_PUBLIC_POSTHOG_KEY=phc_8piCP7ZZfApADb2BGOB5zdAeV3Q1EsOptSpEcuZAHPF
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Components

### PostHogProvider

The `PostHogProvider` component initializes PostHog and provides context to child components.

- Located at: `src/shared/components/analytics/PostHogProvider.tsx`
- Wraps the entire application in `RootApp.tsx`
- Automatically identifies users when they log in
- Sets up restaurant context for group analytics

```tsx
// src/RootApp.tsx
import PostHogProvider from './shared/components/analytics/PostHogProvider';

export default function RootApp() {
  return (
    <PostHogProvider>
      <AuthProvider>
        <RestaurantProvider>
          {/* Rest of the application */}
        </RestaurantProvider>
      </AuthProvider>
    </PostHogProvider>
  );
}
```

### Analytics Utilities

The `analyticsUtils.ts` file provides helper functions for tracking events consistently across the application.

- Located at: `src/shared/utils/analyticsUtils.ts`
- Provides functions for tracking customer and admin events
- Includes predefined event names for common actions

```tsx
import { trackEvent, trackCustomerEvent, trackAdminEvent, EventNames } from '../../shared/utils/analyticsUtils';

// General event tracking
trackEvent('custom_event', { property: 'value' });

// Customer-specific event tracking
trackCustomerEvent(EventNames.ITEM_ADDED_TO_CART, { 
  item_id: '123',
  price: 10.99
});

// Admin-specific event tracking
trackAdminEvent(EventNames.ADMIN_MENU_ITEM_CREATED, {
  item_name: 'New Item',
  category: 'Appetizers'
});
```

## Usage Examples

### Tracking Page Views

Page views are automatically tracked by PostHog, but you can also manually track them:

```tsx
import { useEffect } from 'react';
import { trackEvent, EventNames } from '../../shared/utils/analyticsUtils';

function MenuPage() {
  useEffect(() => {
    trackEvent(EventNames.PAGE_VIEWED, {
      page_name: 'Menu',
      path: window.location.pathname
    });
  }, []);
  
  // Component implementation
}
```

### Tracking User Actions

Track user interactions with UI elements:

```tsx
import { trackCustomerEvent, EventNames } from '../../shared/utils/analyticsUtils';

function MenuItem({ item }) {
  const handleAddToCart = () => {
    // Add to cart logic
    
    // Track the event
    trackCustomerEvent(EventNames.ITEM_ADDED_TO_CART, {
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      category: item.category
    });
  };
  
  return (
    <div>
      <h3>{item.name}</h3>
      <p>${item.price}</p>
      <button onClick={handleAddToCart}>Add to Cart</button>
    </div>
  );
}
```

### Tracking Form Submissions

Track form submissions and their outcomes:

```tsx
import { trackEvent } from '../../shared/utils/analyticsUtils';

function CheckoutForm() {
  const handleSubmit = async (formData) => {
    try {
      // Submit form logic
      const result = await submitOrder(formData);
      
      // Track successful submission
      trackEvent('checkout.completed', {
        order_id: result.orderId,
        total: formData.total,
        payment_method: formData.paymentMethod
      });
    } catch (error) {
      // Track failed submission
      trackEvent('checkout.failed', {
        error: error.message,
        payment_method: formData.paymentMethod
      });
    }
  };
  
  // Form implementation
}
```

## Feature Flags

PostHog is also used for feature flags, allowing for gradual rollout of new features and A/B testing.

### Using Feature Flags

```tsx
import { useFeatureFlagEnabled } from 'posthog-js/react';

function NewFeatureComponent() {
  const isEnabled = useFeatureFlagEnabled('new-feature-flag');
  
  if (!isEnabled) {
    return null;
  }
  
  return (
    <div>
      {/* New feature implementation */}
    </div>
  );
}
```

### Using Multivariate Feature Flags (A/B Testing)

```tsx
import { useFeatureFlagVariantKey } from 'posthog-js/react';

function ButtonComponent() {
  const variant = useFeatureFlagVariantKey('button-color-test');
  
  let buttonColor = 'blue'; // default
  
  if (variant === 'variant-a') {
    buttonColor = 'green';
  } else if (variant === 'variant-b') {
    buttonColor = 'red';
  }
  
  return (
    <button style={{ backgroundColor: buttonColor }}>
      Click Me
    </button>
  );
}
```

## Best Practices

1. **Use Predefined Event Names**: Use the constants in `EventNames` to ensure consistency.

2. **Include Relevant Properties**: Add properties that will be useful for analysis:
   - User role/type
   - Item IDs and names
   - Categories
   - Prices/totals
   - Success/failure status

3. **Don't Track PII**: Avoid tracking personally identifiable information unless necessary.

4. **Track Errors**: Track errors to help identify issues:
   ```tsx
   try {
     // Code that might fail
   } catch (error) {
     trackEvent('error.occurred', {
       error_message: error.message,
       error_type: error.name,
       component: 'ComponentName'
     });
   }
   ```

5. **Group Related Events**: Use dot notation to group related events (e.g., `checkout.started`, `checkout.completed`).

## Debugging

To debug analytics in development:

1. Open the browser console
2. Look for PostHog debug logs
3. You can also use the PostHog debug toolbar by adding `?phc_debug=true` to the URL

## PostHog Dashboard

Access the PostHog dashboard at: https://us.i.posthog.com/
