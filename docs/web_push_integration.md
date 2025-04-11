# Web Push Notifications Integration Guide

This document provides guidance on how to use web push notifications in the Hafaloha application.

## Overview

Web push notifications allow the application to send notifications to users even when they are not actively using the application. This is particularly useful for notifying restaurant staff about new orders.

## Requirements

- **Browser Support**: Web push notifications are supported in most modern browsers, including Chrome, Firefox, Edge, and Safari (iOS 16.4+ only).
- **HTTPS**: Web push notifications require HTTPS in production.
- **Service Worker**: A service worker is required to handle push notifications.
- **VAPID Keys**: VAPID (Voluntary Application Server Identification) keys are required to authenticate the push service.

## iOS Limitations

Web push notifications on iOS have several limitations:

1. **iOS Version**: Web push notifications are only supported on iOS 16.4 and later.
2. **PWA Installation**: The web app must be installed to the home screen (Add to Home Screen) to receive push notifications.
3. **Browser Support**: 
   - Safari: Supported since iOS 16.4
   - Chrome: Supported since version 113 on iOS 16.4+
   - Firefox and other browsers: May have limited or no support
4. **Home Screen Requirement**: The web app must be launched from the home screen icon, not directly from the browser.

## Known Issues

### iOS Push Notification Subscription Failures

If you're experiencing issues subscribing to push notifications on iOS, here are some common causes and solutions:

1. **iOS Version**: Ensure you're using iOS 16.4 or later. You can check your iOS version in Settings > General > About.
2. **PWA Installation**: Make sure the app is installed to your home screen. In Safari, tap the Share button and select "Add to Home Screen".
3. **Launch from Home Screen**: After installing, close Safari and launch the app from the home screen icon.
4. **Notification Permission**: When prompted, allow notifications for the app.
5. **Browser Limitations**: If you're using Chrome, Firefox, or another browser on iOS, switch to Safari as these browsers don't support web push on iOS.

### Chrome on Android

Chrome on Android supports web push notifications, but there are some considerations:

1. **Battery Optimization**: Android may restrict background processes for battery optimization, which can affect push notification delivery.
2. **PWA Installation**: Installing the app as a PWA can improve notification reliability.

## Setup Instructions

### For Administrators

1. Go to Admin Dashboard > Settings > Notification Settings
2. Enable Web Push Notifications using the toggle
3. Click "Generate New Keys" to generate VAPID keys
4. Click "Save Settings" to save your changes

### For Users

1. Visit the Hafaloha website in a supported browser
2. For iOS: Use Safari and add the site to your home screen
3. Click "Subscribe this device" to enable push notifications
4. Allow notifications when prompted

## Troubleshooting

### Notifications Not Showing

1. **Check Browser Support**: Ensure you're using a supported browser.
2. **Check Permissions**: Make sure notifications are allowed for the site.
3. **Check Service Worker**: Ensure the service worker is registered and active.
4. **Check Subscription**: Verify that the device is subscribed to push notifications.

### iOS-Specific Issues

1. **"Failed to subscribe to push notifications" Error**:
   - Make sure the app is installed to your home screen
   - Launch the app from the home screen icon, not from the browser
   - Check if your iOS version is 16.4 or later
   - For Chrome on iOS, ensure you're using version 113 or later

2. **"There was an error setting up push notifications on your iOS device" Error**:
   - This is a generic error that can occur for various reasons
   - Try refreshing the page and subscribing again
   - Try uninstalling and reinstalling the PWA
   - Check if your iOS version is 16.4 or later

## Common Pitfalls and Solutions

### VAPID Key Format Issue

One of the most challenging issues with web push notifications is the format of VAPID keys. There are two different formats that need to be considered:

1. **Server-side VAPID key format**: The format used by the server to sign push messages
2. **Browser-side applicationServerKey format**: The format expected by browsers when subscribing to push notifications

The key difference is that browsers expect the applicationServerKey to include an uncompressed point format indicator byte (0x04) at the beginning, while the server-generated VAPID keys typically don't include this byte.

#### Symptoms of VAPID Key Format Issues

If you encounter the following error when trying to subscribe to push notifications:

```
InvalidAccessError: Failed to execute 'subscribe' on 'PushManager': The provided applicationServerKey is not valid.
```

This is likely due to a VAPID key format issue.

#### Our Solution

We implemented a solution in `webPushUtils.js` that:

1. Detects when a key is in the server format (86 characters, no 'B' prefix)
2. Adds the missing 0x04 byte to convert it to the browser-expected format
3. Properly handles the conversion to the Uint8Array format required by PushManager.subscribe()

```javascript
// Add the uncompressed point format indicator byte (0x04)
// This is required for the applicationServerKey to be valid
if (base64String.length === 86 && !base64String.startsWith('B')) {
  // First, decode the base64 string to get the raw bytes
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = atob(base64);
  
  // Create a new Uint8Array with space for the indicator byte
  const outputArray = new Uint8Array(rawData.length + 1);
  
  // Set the first byte to 0x04 (uncompressed point format)
  outputArray[0] = 4;
  
  // Copy the rest of the bytes
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i + 1] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}
```

This approach is more flexible than modifying the backend, as it:
- Doesn't require changes to the database schema
- Works with existing VAPID keys
- Handles different key formats gracefully

### Service Worker Configuration

1. **Event Handling**: It's crucial that your service worker's push event listener properly handles incoming push events. Always use `event.waitUntil()` to ensure the notification is displayed before the event terminates:

```javascript
self.addEventListener('push', function(e) {
  e.waitUntil(
    self.registration.showNotification(e.data.title, e.data)
  );
});
```

2. **Service Worker Registration**: Verify that your service worker is correctly registered and active. Without an active service worker, push notifications cannot function.

### Subscription Management

1. **Multiple Devices**: Users accessing your application from multiple devices or browsers can lead to multiple subscriptions. Implement a mechanism to manage these subscriptions effectively, possibly by associating each subscription with a user identifier in your backend. This ensures that notifications are sent to all relevant devices.

2. **Subscription Expiry**: Subscriptions can expire or become invalid over time. Implement proper error handling to detect and remove invalid subscriptions.

### Backend Integration

1. **VAPID Keys**: Ensure that your Rails backend is configured with the correct VAPID keys and that these keys are also used in your React frontend during the subscription process.

2. **Payload Encryption**: The payload sent from your backend must be properly encrypted using the subscription's public key. Libraries like web-push for Ruby can handle this encryption.

### Cross-Browser Compatibility

1. **Feature Detection**: Not all browsers support the Push API. Implement feature detection in your application to handle cases where the Push API is unavailable gracefully:

```javascript
if ('PushManager' in window) {
  // Push is supported
} else {
  // Fallback or notify the user
}
```

2. **Browser-Specific Behavior**: Be aware of differences in how browsers handle push notifications. For example, Chrome and Firefox might support features that Safari does not.

### Error Handling and Logging

1. **Verbose Logging**: Implement comprehensive logging on both the client and server sides to capture errors during the subscription process. This can provide insights into where the process might be failing.

2. **User Feedback**: Provide users with clear feedback if the subscription process fails, including possible reasons and steps to resolve the issue.

### Testing and Debugging

1. **Development Environment**: Ensure that your development environment closely mirrors production, especially concerning HTTPS, as service workers and push notifications require secure contexts.

2. **Real Device Testing**: Test the subscription process on actual devices, particularly those that users commonly use, to identify device-specific issues.

## Technical Implementation

The web push notification system consists of several components:

1. **Frontend**:
   - `webPushHelper.ts`: Utility functions for subscribing to push notifications
   - `serviceWorkerRegistration.ts`: Service worker registration
   - `service-worker.js`: Service worker implementation that handles push events

2. **Backend**:
   - `PushSubscriptionsController`: Manages push subscriptions
   - `Restaurant` model: Stores VAPID keys and push notification settings
   - `SendWebPushNotificationJob`: Background job for sending push notifications

## Testing

To test web push notifications:

1. Enable web push notifications in the admin settings
2. Subscribe a device to push notifications
3. Create a new order
4. Verify that a push notification is received on the subscribed device

## References

- [Web Push Notifications: Timely, Relevant, and Precise](https://developers.google.com/web/fundamentals/push-notifications)
- [Using the Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Using_the_Push_API)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid-02)
