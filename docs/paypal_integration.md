# PayPal Integration Guide

This document explains how to set up and use PayPal's Advanced/Expanded Checkout in the Hafaloha system.

## Overview

Hafaloha uses PayPal's Advanced (Expanded) Credit and Debit Card Payments for payment processing. This integration includes:

1. Direct PayPal payments
2. Credit/debit card payments processed through PayPal
3. Test mode for development and testing

## Backend Configuration

### PayPal API Credentials

To use PayPal's services, you need to obtain API credentials:

1. Log into your [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a REST API app to get your Client ID and Secret
3. Make sure "Advanced (Expanded) Credit and Debit Card Payments" is enabled
   - In Sandbox environment, this is typically enabled by default

### Configuring the Application

1. Configure your PayPal credentials in the Admin Dashboard:
   - Go to Admin → Settings → Payment Gateway
   - Enter your Client ID and Client Secret
   - Enter your Webhook Secret (for webhook verification)
   - Select the environment (Sandbox or Production)
   - Toggle Test Mode as needed

2. Save your settings

## Webhook Integration

Hafaloha uses PayPal webhooks to receive real-time notifications about payment events. This ensures that your order statuses stay in sync with PayPal's payment processing.

### Setting Up Webhooks

1. Log into your [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Navigate to your app settings
3. Click on "Webhooks" in the left sidebar
4. Click "Add Webhook"
5. Enter your webhook URL:
   - For production: `https://your-api-domain.com/paypal/webhook`
   - For development/testing: Use a service like ngrok to expose your local server
6. Select the following event types:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CHECKOUT.ORDER.APPROVED`
   - `CHECKOUT.ORDER.COMPLETED`
   - `CHECKOUT.ORDER.DECLINED`
   - `PAYMENT.REFUND.COMPLETED`
   - `PAYMENT.REFUND.FAILED`
   - `CUSTOMER.DISPUTE.CREATED`
   - `CUSTOMER.DISPUTE.RESOLVED`
   - `CUSTOMER.DISPUTE.UPDATED`
7. Click "Save"
8. Copy the Webhook ID and Webhook Secret
9. Enter the Webhook Secret in the Admin Dashboard under Payment Gateway settings

### How Webhooks Work

1. When a payment event occurs (e.g., a payment is completed), PayPal sends a notification to your webhook URL
2. The system verifies the webhook signature using your webhook secret
3. Based on the event type, the system updates the order status accordingly
4. This ensures that your order statuses are always in sync with PayPal's payment processing

## Test Mode vs. Production Mode

### Test Mode

When Test Mode is enabled:
- No real payments are processed
- The system shows a simulated PayPal payment button
- Test transactions are logged with a "TEST-" prefix
- Useful for testing the ordering flow without actual payments

### Production Mode

When Test Mode is disabled and valid PayPal credentials are provided:
- Real payments are processed through PayPal
- Customers can use PayPal accounts or credit/debit cards
- All transactions are recorded and can be tracked in your PayPal Business account

## Troubleshooting

### Common Issues

1. **Payment button not appearing:**
   - Check that your Client ID is valid
   - Verify that Test Mode is disabled if you want to use real PayPal buttons
   - Check browser console for any JavaScript errors

2. **API errors:**
   - Verify credentials are correct
   - Ensure your PayPal account has Advanced Card Payments enabled
   - Check server logs for detailed error messages

3. **3D Secure challenges not appearing:**
   - This is normal in test mode
   - In production, 3D Secure challenges will appear based on the card issuer's requirements

### Server Error Codes

- `400`: Bad request - check the payment amount and currency
- `401`: Unauthorized - check your Client ID and Secret
- `403`: Forbidden - your account may not have permission for certain operations
- `500`: Server error - check the server logs for details

## Testing

Use the following test cards for sandbox testing:

- Visa: `4111111111111111`
- Mastercard: `5555555555554444`
- Amex: `378282246310005`

Use any future expiration date and any 3-digit CVV (4-digit for Amex).

## Support

For additional help:
- [PayPal Developer Documentation](https://developer.paypal.com/docs/checkout/advanced/)
- Contact the Hafaloha development team
