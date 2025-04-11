# Pushover Integration

This document describes the integration of Pushover notifications into the Hafaloha frontend application.

## Overview

Pushover is a service that makes it easy to get real-time notifications on your Android, iPhone, iPad, and Desktop devices. The Hafaloha application integrates with Pushover to send notifications to restaurant staff when new orders are placed, ensuring they're immediately aware of incoming orders even when not actively monitoring the admin dashboard.

## Features

- Real-time notifications for new orders
- High-priority notifications that bypass quiet hours
- Customizable notification sounds
- Support for both individual user keys and group keys (for notifying multiple staff members)
- Optional custom application tokens

## Implementation Details

### NotificationSettings Component

The `NotificationSettings` component in the admin dashboard allows restaurant administrators to configure Pushover notifications:

```tsx
// src/ordering/components/admin/settings/NotificationSettings.tsx
```

This component provides:

1. **Enable/Disable Toggle**: Turn Pushover notifications on or off
2. **User Key Input**: Enter the Pushover user key from the Pushover dashboard
3. **Group Key Input**: Optionally enter a group key for notifying multiple staff members
4. **App Token Input**: Optionally enter a custom application token
5. **Validate Key Button**: Test if the provided key is valid
6. **Send Test Notification Button**: Send a test notification to verify the integration

### Configuration Storage

Pushover settings are stored in the restaurant's `admin_settings` JSON field on the backend:

```json
{
  "notification_channels": {
    "orders": {
      "pushover": true
    }
  },
  "pushover": {
    "user_key": "user_key_from_pushover_dashboard",
    "group_key": "optional_group_key",
    "app_token": "optional_custom_app_token"
  }
}
```

### API Integration

The frontend communicates with the backend through these API endpoints:

1. **Validate Key**: `POST /admin/validate_pushover_key`
   - Checks if a user key or group key is valid
   - Parameters: `user_key`, `app_token` (optional)

2. **Test Notification**: `POST /admin/test_pushover`
   - Sends a test notification to verify the integration
   - Parameters: `user_key`, `message`, `title`, `priority`, `sound`, `app_token` (optional)

3. **Save Settings**: `PATCH /admin/settings`
   - Updates the restaurant's notification settings
   - Parameters: `admin_settings` containing the Pushover configuration

## Setup Instructions for Restaurants

1. **Create a Pushover Account**:
   - Go to [pushover.net](https://pushover.net) and create an account
   - Download the Pushover app on your device(s) from [pushover.net/clients](https://pushover.net/clients)

2. **Get Your User Key**:
   - Log in to your Pushover dashboard
   - Copy your User Key (30-character string)

3. **Configure in Hafaloha**:
   - Go to Admin Dashboard > Settings > Notifications
   - Enable Pushover notifications
   - Paste your User Key
   - Click "Validate Key" to ensure it's valid
   - Click "Send Test Notification" to verify the integration

4. **Optional: Group Notifications**:
   - For multiple staff members, create a delivery group in Pushover
   - Use the Group Key instead of (or in addition to) the User Key

5. **Optional: Custom Application**:
   - If you want to use your own Pushover application instead of the system default
   - Register an application on Pushover
   - Enter the App Token in the settings

## Troubleshooting

- **Validation Fails**: Ensure the user key or group key is correct and that you have an active Pushover subscription
- **Test Notification Fails**: Check that the Pushover service is available and that your device is connected to the internet
- **No Notifications for Orders**: Ensure that Pushover is enabled in the notification channels settings
- **Delayed Notifications**: Pushover typically delivers notifications within seconds, but network conditions can cause delays

## Security Considerations

- Pushover user keys and application tokens are stored securely in the database
- All communication with the Pushover API is done over HTTPS
- The application uses a default application token, but restaurants can use their own for additional security
