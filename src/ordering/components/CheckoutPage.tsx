// src/ordering/components/CheckoutPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, User } from 'lucide-react';
import toastUtils from '../../shared/utils/toastUtils';

import { useAuthStore } from '../store/authStore';
import { usePromoStore } from '../store/promoStore';
import { useOrderStore } from '../store/orderStore';
import { LoadingSpinner } from '../../shared/components/ui';
import { FormSkeleton } from '../../shared/components/ui/SkeletonLoader';
import { useRestaurantStore } from '../../shared/store/restaurantStore';
import { validateVipCode } from '../../shared/api/endpoints/vipAccess';
import { PickupInfo } from './location/PickupInfo';
import { VipCodeInput } from './VipCodeInput';
import { PayPalCheckout, PayPalCheckoutRef } from './payment/PayPalCheckout';
import { StripeCheckout, StripeCheckoutRef } from './payment/StripeCheckout';

interface CheckoutFormData {
  name: string;
  email: string;
  phone: string;
  specialInstructions: string;
  promoCode: string;
  vipCode: string;
}

/**
 * Allows a plus sign, then 3 or 4 digits for "area code," then exactly 7 more digits.
 * e.g. +16711234567 or +17025551234 or +9251234567
 */
function isValidPhone(phoneStr: string) {
  return /^\+\d{3,4}\d{7}$/.test(phoneStr);
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const cartItems = useOrderStore((state) => state.cartItems);
  const addOrder = useOrderStore((state) => state.addOrder);
  const loading = useOrderStore((state) => state.loading);

  const { validatePromoCode, applyDiscount } = usePromoStore();
  const rawTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const initialFormData: CheckoutFormData = {
    name: user ? `${user.first_name} ${user.last_name}` : '',
    email: user?.email || '',
    phone: user?.phone || '', // if user has phone => use it, else blank => +1671 later
    specialInstructions: '',
    promoCode: '',
    vipCode: '',
  };

  const restaurant = useRestaurantStore((state) => state.restaurant);
  const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState(rawTotal);
  const [vipCodeValid, setVipCodeValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  
  // Refs for payment components
  const paypalRef = useRef<PayPalCheckoutRef>(null);
  const stripeRef = useRef<StripeCheckoutRef>(null);

  // If phone is blank => prefill +1671
  useEffect(() => {
    if (formData.phone.trim() === '') {
      setFormData((prev) => ({ ...prev, phone: '+1671' }));
    }
  }, []);

  // If user changes (logs in/out), update name/email/phone
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone: user.phone || '+1671',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        name: '',
        email: '',
        phone: '+1671',
      }));
    }
  }, [user]);

  // Update final total whenever cart items change
  useEffect(() => {
    setFinalTotal(rawTotal);
    // Reset applied promo when cart changes
    setAppliedPromo(null);
  }, [rawTotal]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleApplyPromo() {
    const isValid = validatePromoCode(formData.promoCode);
    if (isValid) {
      try {
        // Get the discounted total and update state - handle the Promise properly
        const discountedTotal = await applyDiscount(rawTotal, formData.promoCode);
        setFinalTotal(discountedTotal);
        setAppliedPromo(formData.promoCode);
        toastUtils.success(`Promo code ${formData.promoCode} applied!`);
      } catch (error) {
        console.error('Error applying discount:', error);
        toastUtils.error('Failed to apply promo code. Please try again.');
      }
    } else {
      toastUtils.error('Invalid or expired promo code');
    }
  }

  const handleVipCodeChange = (code: string, valid: boolean) => {
    setFormData((prev) => ({ ...prev, vipCode: code }));
    setVipCodeValid(valid);
  };

  // Handler for when payment completes successfully
  const handlePaymentSuccess = (details: {
    status: string;
    transaction_id: string;
    amount: string;
    currency?: string;
    payment_method?: string;
    payment_intent_id?: string;
  }) => {
    setPaymentProcessing(false);
    setPaymentProcessed(true);
    setPaymentTransactionId(details.transaction_id);
    
    // Get the payment processor from restaurant settings
    const paymentProcessor = restaurant?.admin_settings?.payment_gateway?.payment_processor || 'paypal';
    
    // Create payment details object with all relevant information
    const paymentDetails = {
      status: details.status,
      payment_method: paymentProcessor === 'stripe' ? 'stripe' : 'paypal',
      transaction_id: details.transaction_id,
      payment_date: new Date().toISOString().split('T')[0],
      payment_intent_id: details.payment_intent_id || details.transaction_id,
      processor: paymentProcessor,
      notes: `Payment processed via ${paymentProcessor === 'stripe' ? 'Stripe' : 'PayPal'}`
    };
    
    // Submit the order with the transaction ID and payment details
    submitOrder(details.transaction_id, paymentDetails);
  };

  // Handler for payment errors
  const handlePaymentError = (error: Error) => {
    console.error('Payment failed:', error);
    toastUtils.error(`Payment failed: ${error.message}`);
    setPaymentProcessing(false);
    setIsSubmitting(false);
  };

  async function submitOrder(transactionId: string, paymentDetails?: any) {
    try {
      // Check if any item needs 24-hr notice
      const hasAny24hrItem = cartItems.some(
        (it) => (it.advance_notice_hours ?? 0) >= 24
      );

      const finalPhone = formData.phone.trim();
      if (!isValidPhone(finalPhone)) {
        toastUtils.error(
          'Phone must be + (3 or 4 digit area code) + 7 digits, e.g. +16711234567'
        );
        setIsSubmitting(false);
        return;
      }

      // Determine the actual payment method based on the processor or use the one from payment details
      const paymentProcessor = restaurant?.admin_settings?.payment_gateway?.payment_processor || 'paypal';
      let actualPaymentMethod = 'credit_card';
      
      // Use the correct payment method based on the processor or payment details
      if (paymentDetails?.payment_method) {
        actualPaymentMethod = paymentDetails.payment_method;
      } else if (paymentProcessor === 'stripe') {
        actualPaymentMethod = 'stripe';
      } else if (paymentProcessor === 'paypal') {
        actualPaymentMethod = 'paypal';
      }
      
      // Use transaction ID as the payment_method_nonce since that's
      // what the API expects from the previous implementation
      const newOrder = await addOrder(
        cartItems,
        finalTotal,
        formData.specialInstructions,
        formData.name,
        finalPhone,
        formData.email,
        transactionId, // Use the transaction ID as the payment method nonce
        actualPaymentMethod, // Use the correct payment method based on the processor
        formData.vipCode,
        false, // Not a staff order
        paymentDetails // Include detailed payment information
      );

      toastUtils.success('Order placed successfully!');

      const estimatedTime = hasAny24hrItem ? '24 hours' : '20–25 min';
      navigate('/order-confirmation', {
        state: {
          orderId: newOrder.id || '12345',
          total: finalTotal,
          estimatedTime,
          hasAny24hrItem,
        },
      });
    } catch (err: any) {
      console.error('Failed to create order:', err);
      toastUtils.error('Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Check for VIP-only mode and attempt to validate code if not already validated
      if (restaurant?.vip_only_checkout && !vipCodeValid && formData.vipCode.trim()) {
        let validationToast = null;
        try {
          validationToast = toastUtils.loading('Validating VIP code...');
          const validationResult = await validateVipCode(restaurant.id, formData.vipCode);
          validationToast.dismiss();
          
          if (!validationResult.valid) {
            toastUtils.error(validationResult.message || 'Invalid VIP code');
            setIsSubmitting(false);
            return;
          }
          
          // Code is valid, update state and continue
          setVipCodeValid(true);
          toastUtils.success('VIP code validated successfully!');
        } catch (error) {
          if (validationToast) validationToast.dismiss();
          toastUtils.error('Failed to validate VIP code');
          setIsSubmitting(false);
          return;
        }
      } else if (restaurant?.vip_only_checkout && !vipCodeValid) {
        // No VIP code entered
        toastUtils.error('Please enter a valid VIP code to continue');
        setIsSubmitting(false);
        return;
      }

      // If payment already processed (unlikely in normal flow), just submit the order
      if (paymentProcessed && paymentTransactionId) {
        // Create basic payment details for already processed payments
        const paymentProcessor = restaurant?.admin_settings?.payment_gateway?.payment_processor || 'paypal';
        const paymentDetails = {
          status: 'succeeded',
          payment_method: paymentProcessor === 'stripe' ? 'stripe' : 'paypal',
          transaction_id: paymentTransactionId,
          payment_date: new Date().toISOString().split('T')[0],
          processor: paymentProcessor,
          notes: `Payment processed via ${paymentProcessor === 'stripe' ? 'Stripe' : 'PayPal'}`
        };
        
        await submitOrder(paymentTransactionId, paymentDetails);
        return;
      }

      // Process payment based on selected payment processor
      const isStripe = restaurant?.admin_settings?.payment_gateway?.payment_processor === 'stripe';
      
      // Set payment processing state to true to show the overlay
      setPaymentProcessing(true);
      
      if (isStripe && stripeRef.current) {
        // Process with Stripe
        const success = await stripeRef.current.processPayment();
        if (!success) {
          setPaymentProcessing(false);
          setIsSubmitting(false);
        }
      } else if (paypalRef.current) {
        // Process with PayPal
        const success = await paypalRef.current.processPayment();
        if (!success) {
          setPaymentProcessing(false);
          setIsSubmitting(false);
        }
      } else {
        // No payment processor available
        toastUtils.error('Payment processing is not available');
        setPaymentProcessing(false);
        setIsSubmitting(false);
      }
      
    } catch (err: any) {
      console.error('Failed during checkout process:', err);
      toastUtils.error('Failed to process checkout. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Full-screen overlay for payment processing */}
      {paymentProcessing && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <LoadingSpinner text="Processing Payment" className="mb-2" />
          </div>
        </div>
      )}
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* LEFT: The form */}
        <div className="lg:col-span-7">
          {loading ? (
            <div className="animate-fadeIn transition-opacity duration-300">
              <FormSkeleton fields={6} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              <div className="space-y-4">
                {/* NAME */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <User className="inline-block w-4 h-4 mr-2" />
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md
                      focus:ring-[#c1902f] focus:border-[#c1902f]"
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <Mail className="inline-block w-4 h-4 mr-2" />
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md
                      focus:ring-[#c1902f] focus:border-[#c1902f]"
                  />
                </div>

                {/* PHONE */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    <Phone className="inline-block w-4 h-4 mr-2" />
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+1671"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md
                      focus:ring-[#c1902f] focus:border-[#c1902f]"
                  />
                </div>
              </div>
            </div>

            {/* VIP Code Input (only appears when restaurant is in VIP-only mode) */}
            {restaurant?.vip_only_checkout && (
              <VipCodeInput onChange={handleVipCodeChange} />
            )}

            {/* Payment Information - only show if not VIP-only mode OR if VIP code is valid */}
            {(!restaurant?.vip_only_checkout || vipCodeValid) && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Payment Information</h2>
                
                {/* Conditionally render PayPal or Stripe checkout based on payment processor setting */}
                {restaurant?.admin_settings?.payment_gateway?.payment_processor === 'stripe' ? (
                  <StripeCheckout
                    ref={stripeRef}
                    amount={finalTotal.toString()}
                    publishableKey={(restaurant?.admin_settings?.payment_gateway?.publishable_key as string) || ""}
                    currency="USD"
                    testMode={restaurant?.admin_settings?.payment_gateway?.test_mode ?? true}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                  />
                ) : (
                  // Default to PayPal if not specified or if set to 'paypal'
                  <PayPalCheckout
                    ref={paypalRef}
                    amount={finalTotal.toString()}
                    clientId={(restaurant?.admin_settings?.payment_gateway?.client_id as string) || "sandbox_client_id"}
                    currency="USD"
                    testMode={restaurant?.admin_settings?.payment_gateway?.test_mode ?? true}
                    onPaymentSuccess={handlePaymentSuccess}
                    onPaymentError={handlePaymentError}
                  />
                )}
              </div>
            )}

            {/* Special Instructions */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Special Instructions</h2>
              <textarea
                name="specialInstructions"
                value={formData.specialInstructions}
                onChange={handleInputChange}
                placeholder="Any special requests or notes for your order?"
                className="w-full px-4 py-2 border border-gray-300 rounded-md
                  focus:ring-[#c1902f] focus:border-[#c1902f]"
                rows={3}
              />
            </div>

            {/* Promo + Total + Submit */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4">
                <label
                  htmlFor="promoCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Promo Code
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="promoCode"
                    name="promoCode"
                    value={formData.promoCode}
                    onChange={handleInputChange}
                    placeholder="Enter promo code"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md
                      focus:ring-[#c1902f] focus:border-[#c1902f]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-4 py-2 bg-gray-100 text-gray-700
                      rounded-md hover:bg-gray-200"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-medium">Total</span>
                <div className="text-right">
                  {appliedPromo && (
                    <span className="block text-sm text-gray-500 line-through">
                      ${rawTotal.toFixed(2)}
                    </span>
                  )}
                  <span className="text-2xl font-bold">
                    ${finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (restaurant?.vip_only_checkout && !vipCodeValid)}
                className={`w-full bg-[#c1902f] text-white py-3 px-4
                  rounded-md hover:bg-[#d4a43f] transition-colors duration-200
                  ${(isSubmitting || (restaurant?.vip_only_checkout && !vipCodeValid)) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Processing...' : (restaurant?.vip_only_checkout && !vipCodeValid) ? 'Validate VIP Code First' : 'Place Order'}
              </button>
            </div>
          </form>
          )}
        </div>

        {/* RIGHT COLUMN => Order Summary and Pickup Info */}
        <div className="lg:col-span-5 mt-8 lg:mt-0">
          {/* Cart Items Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            {cartItems.length === 0 ? (
              <p className="text-gray-500">Your cart is empty</p>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <img
                      src={item.image || '/placeholder-food.jpg'}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      {item.customizations && Object.keys(item.customizations).length > 0 && (
                        <p className="text-xs text-gray-500">
                          {Object.entries(item.customizations)
                            .map(([group, options]) => `${options.join(', ')}`)
                            .join('; ')}
                        </p>
                      )}
                    </div>
                    <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Pickup Info */}
          <PickupInfo />
        </div>
      </div>
    </div>
  );
}
