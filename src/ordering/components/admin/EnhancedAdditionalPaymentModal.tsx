import React, { useState, useEffect, useRef } from 'react';
import { orderPaymentOperationsApi } from '../../../shared/api/endpoints/orderPaymentOperations';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { StripeCheckout, StripeCheckoutRef } from '../../components/payment/StripeCheckout';
import { PayPalCheckout, PayPalCheckoutRef } from '../../components/payment/PayPalCheckout';

interface PaymentItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface EnhancedAdditionalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | number;
  paymentItems: PaymentItem[];
  onPaymentCompleted: () => void;
}

export function EnhancedAdditionalPaymentModal({
  isOpen,
  onClose,
  orderId,
  paymentItems,
  onPaymentCompleted,
}: EnhancedAdditionalPaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'cash' | 'payment_link' | 'clover' | 'revel' | 'other' | 'stripe_reader' | 'stripe' | 'paypal'>('credit_card');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [paymentLinkSent, setPaymentLinkSent] = useState(false);
  const [paymentLinkSentMessage, setPaymentLinkSentMessage] = useState('');
  const [showStripeForm, setShowStripeForm] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  
  // Manual payment details
  const [transactionId, setTransactionId] = useState('');
  // Set default payment date to today
  const today = new Date().toISOString().split('T')[0];
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNotes, setPaymentNotes] = useState('');
  // Cash register functionality
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Payment processor refs
  const stripeRef = useRef<StripeCheckoutRef>(null);
  const paypalRef = useRef<PayPalCheckoutRef>(null);
  
  // Get restaurant settings for payment configuration
  const restaurant = useRestaurantStore((state) => state.restaurant);
  const paymentGateway = restaurant?.admin_settings?.payment_gateway || {};
  const paymentProcessor = paymentGateway.payment_processor || 'paypal';
  const testMode = paymentGateway.test_mode !== false;
  
  // Calculate total from items
  const total = paymentItems.reduce(
    (sum, item) => sum + parseFloat(String(item.price)) * parseInt(String(item.quantity)),
    0
  );
  
  // Update cashReceived when total changes
  useEffect(() => {
    setCashReceived(total);
  }, [total]);
  
  useEffect(() => {
    // In a real implementation, we would fetch the order data from an API endpoint
    // For this implementation, we'll simulate this by assuming we have the customer info
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        // In a real implementation, this would be something like:
        // const response = await orderPaymentsApi.getOrderByID(orderId);
        
        // Instead, we'll simulate this with mock data
        const mockOrderData = {
          contact_email: 'customer@example.com',
          contact_phone: '+1234567890'
        };
        
        setOrderData(mockOrderData);
        
        // Pre-fill customer info if available
        if (mockOrderData.contact_email) {
          setCustomerEmail(mockOrderData.contact_email);
        }
        if (mockOrderData.contact_phone) {
          setCustomerPhone(mockOrderData.contact_phone);
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  const handleCreditCardPayment = async () => {
    setIsLoading(true);
    setPaymentError(null);
    try {
      // Create payment details with the correct payment method
      const paymentDetails = {
        payment_method: 'credit_card', // Always use 'credit_card' for credit card payments
        processor: paymentProcessor === 'stripe' ? 'stripe' : 'paypal',
        payment_date: today,
        status: 'pending'
      };

      // Convert orderId to number if it's a string
      const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;

      // Prepare common items mapping
      const itemsMapping = paymentItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      if (paymentProcessor === 'stripe' && stripeRef.current) {
        // Process with Stripe
        const success = await stripeRef.current.processPayment();
        if (!success) {
          setPaymentError('Payment processing failed. Please try again.');
        }
      } else if (paypalRef.current) {
        // Process with PayPal
        const success = await paypalRef.current.processPayment();
        if (!success) {
          setPaymentError('Payment processing failed. Please try again.');
        }
      } else {
        // Fallback to showing the Stripe form placeholder if no payment processor is configured
        setShowStripeForm(true);
      }
    } catch (error) {
      console.error('Error setting up credit card payment:', error);
      setPaymentError('Failed to set up credit card payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCashPayment = async () => {
    // Validate that cash received is sufficient
    if (cashReceived < total) {
      setPaymentError('Cash received must be at least equal to the order total');
      return;
    }
    
    setIsLoading(true);
    setPaymentError(null);
    try {
      // Convert orderId to number if it's a string
      const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
      
      // Calculate change
      const changeDue = cashReceived - total;
      
      // Generate a unique transaction ID
      const transactionId = `cash_${Date.now()}`;
      
      // Create payment details object with the specific payment method
      // IMPORTANT: Always use 'cash' as the payment method for cash payments
      const paymentDetails = {
        payment_method: 'cash', // This must be 'cash' for cash payments
        transaction_id: transactionId,
        payment_date: new Date().toISOString().split('T')[0],
        notes: `Cash payment - Received: $${cashReceived.toFixed(2)}, Change: $${changeDue.toFixed(2)}`,
        cash_received: cashReceived,
        change_due: changeDue,
        status: 'paid'
      };
      
      // Log the transaction details
      console.log('Processing cash payment for order:', orderId, {
        payment_method: 'cash',
        amount: total,
        items: paymentItems,
        cash_received: cashReceived,
        change_due: changeDue,
        payment_details: paymentDetails
      });
      
      // Prepare common items mapping to avoid repetition
      const itemsMapping = paymentItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));
      
      // Use the processAdditionalPayment endpoint with consistent structure
      const response = await orderPaymentOperationsApi.processAdditionalPayment(numericOrderId, {
        payment_method: 'cash', // This must be 'cash' for cash payments
        items: itemsMapping,
        payment_details: paymentDetails,
        order_payment: {
          payment_method: 'cash', // This must be 'cash' for cash payments
          payment_details: paymentDetails
        }
      });
      
      console.log('Cash payment processed successfully:', response.data);
      
      // Show change due to the user
      if (changeDue > 0) {
        // In a real implementation, you would show a toast or alert
        console.log(`Change due: $${changeDue.toFixed(2)}`);
      }
      
      // Mark payment as successful
      setPaymentSuccessful(true);
      setTimeout(() => {
        onPaymentCompleted();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error processing cash payment:', error);
      setPaymentError('Failed to process cash payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual payments (Stripe Reader, Clover, Revel, Other)
  const handleManualPayment = async () => {
    setIsLoading(true);
    setPaymentError(null);
    try {
      // Validate required fields
      if (!paymentDate) {
        setPaymentError('Payment date is required');
        return;
      }
      
      // Generate a unique transaction ID if one wasn't provided
      const finalTransactionId = transactionId || `${paymentMethod}_${Date.now()}`;
      
      // Create payment details object with the specific payment method
      // IMPORTANT: Always preserve the original payment method selected by the user
      const paymentDetails = {
        payment_method: paymentMethod, // Use the exact payment method selected by the user
        transaction_id: finalTransactionId,
        payment_date: paymentDate,
        notes: paymentNotes || `Payment processed via ${paymentMethod}`
      };
      
      // Convert orderId to number if it's a string
      const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
      
      // Prepare common items mapping to avoid repetition
      const itemsMapping = paymentItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));
      
      try {
        // Call the API to process the payment with a consistent structure
        await orderPaymentOperationsApi.processAdditionalPayment(numericOrderId, {
          payment_method: paymentMethod, // This must match the selected payment method
          items: itemsMapping,
          payment_details: {
            ...paymentDetails,
            status: 'succeeded'
          },
          order_payment: {
            payment_method: paymentMethod, // This is critical - must match the payment method
            payment_details: {
              ...paymentDetails,
              status: 'succeeded'
            }
          }
        });
        
        // Log detailed payment information for debugging
        console.log(`Successfully processed ${paymentMethod} payment for order:`, orderId, {
          payment_method: paymentMethod,
          amount: total,
          items: paymentItems,
          transaction_id: finalTransactionId,
          payment_details: paymentDetails
        });
        
        // Payment successful
        setPaymentSuccessful(true);
        setTimeout(() => {
          onPaymentCompleted();
          onClose();
        }, 2000);
      } catch (apiError) {
        console.error(`API error processing ${paymentMethod} payment:`, apiError);
        setPaymentError(`Failed to process ${paymentMethod} payment. Please try again.`);
        return;
      }
    } catch (error) {
      console.error(`Error processing ${paymentMethod} payment:`, error);
      setPaymentError(`Failed to process ${paymentMethod} payment. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPaymentLink = async () => {
    if (!customerEmail && !customerPhone) {
      setPaymentError('Please provide either an email or phone number to send the payment link.');
      return;
    }
    
    setIsLoading(true);
    setPaymentError(null);
    try {
      // Convert orderId to number if it's a string
      const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
      
      // Prepare common items mapping to avoid repetition
      const itemsMapping = paymentItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        // Include optional fields if available
        description: (item as any).description,
        image: (item as any).image
      }));
      
      // Generate and send payment link
      const response = await orderPaymentOperationsApi.generatePaymentLink(numericOrderId, {
        email: customerEmail,
        phone: customerPhone,
        items: itemsMapping
      });
      
      // After generating the link, we'll store the payment method information
      // This will be used when marking the payment as completed
      // IMPORTANT: Always use 'payment_link' as the payment method for payment links
      console.log('Payment link generated with payment method: payment_link');
      
      // Get the payment link URL from the response
      const responseData = response.data;
      const paymentLinkUrl = responseData.payment_link_url;
      
      // Display the payment link URL and mark as sent
      setPaymentLinkUrl(paymentLinkUrl);
      setPaymentLinkSent(true);
      
      // Show appropriate message based on where the link was sent
      let sentToMessage = '';
      if (customerEmail && customerPhone) {
        sentToMessage = `The payment link has been sent to ${customerEmail} and ${customerPhone}.`;
      } else if (customerEmail) {
        sentToMessage = `The payment link has been sent to ${customerEmail}.`;
      } else if (customerPhone) {
        sentToMessage = `The payment link has been sent to ${customerPhone}.`;
      }
      
      if (sentToMessage) {
        setPaymentLinkSentMessage(sentToMessage);
      }
    } catch (error) {
      console.error('Error creating payment link:', error);
      setPaymentError('Failed to create payment link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for payment success (aligned with StaffOrderModal)
  const handlePaymentSuccess = (details: {
    status: string;
    transaction_id: string;
    amount: string;
    currency?: string;
    payment_method?: string; // Method reported by the payment component
    payment_intent_id?: string;
    payment_details?: any; // Optional: Detailed object from payment component
  }) => {
    // Payment succeeded
    setPaymentSuccessful(true);
    
    // Log the payment success details received from the component
    console.log('Payment success details received:', {
      ...details,
      selectedPaymentMethod: paymentMethod // Log the method selected in this modal
    });
    
    // Extract paymentIntentId if available
    const paymentIntentId = details.payment_intent_id || details.transaction_id;
    
    try {
      // Process the completion with the backend
      // Pass the transaction_id, amount, paymentIntentId, and crucially,
      // pass the payment_details object if it was provided by the component.
      processSuccessfulPayment(
        details.transaction_id,
        details.amount,
        paymentIntentId,
        details.payment_details // Pass this along if available
      );
      
      // Show success message
      console.log('Payment processed successfully with transaction ID:', details.transaction_id);
      
      setTimeout(() => {
        onPaymentCompleted();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentError(`Payment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPaymentSuccessful(false);
    }
  };

  // Handler for payment errors
  const handlePaymentError = (error: Error) => {
    console.error('Payment failed:', error);
    setPaymentError(`Payment failed: ${error.message}`);
  };
  
  // Process successful payment with the backend (aligned with StaffOrderModal logic)
  const processSuccessfulPayment = async (
    transactionId: string,
    amount: string,
    paymentIntentId?: string,
    receivedPaymentDetails?: any
  ) => {
    try {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        throw new Error(`Invalid amount: ${amount}`);
      }
      
      const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
      
      // Determine the actual payment method based on the type of payment
      let actualPaymentMethod = paymentMethod;
      let processor = undefined;
      
      // Special handling for credit card payments
      if (paymentMethod === 'credit_card') {
        actualPaymentMethod = 'credit_card'; // Always use 'credit_card' for card payments
        processor = paymentProcessor === 'stripe' ? 'stripe' : 'paypal';
      } else if (paymentMethod === 'stripe_reader') {
        actualPaymentMethod = 'stripe_reader'; // Preserve stripe_reader as its own method
        processor = 'stripe';
      }
      
      // Build payment details object
      const paymentDetails = {
        payment_method: actualPaymentMethod, // Use the determined payment method
        transaction_id: transactionId,
        payment_date: today,
        notes: paymentMethod === 'credit_card'
          ? `Payment processed via ${processor}`
          : `Payment processed via ${actualPaymentMethod}`,
        processor: processor,
        status: 'succeeded',
        payment_intent_id: paymentIntentId,
        ...receivedPaymentDetails // Allow overriding with received details
      };
      
      // Log the transaction details for debugging/tracking purposes
      console.log('Processing successful payment:', {
        transactionId: paymentDetails.transaction_id,
        paymentIntentId: paymentDetails.payment_intent_id,
        amount: numericAmount,
        method: actualPaymentMethod,
        processor: paymentDetails.processor || 'none',
        constructedPaymentDetails: paymentDetails
      });
      
      // Prepare common items mapping
      const itemsMapping = paymentItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }));
      
      // Call the API with consistent payment method and details
      await orderPaymentOperationsApi.processAdditionalPayment(numericOrderId, {
        payment_method: paymentDetails.payment_method, // Use the payment method from payment details
        items: itemsMapping,
        payment_details: paymentDetails,
        order_payment: {
          payment_method: paymentDetails.payment_method, // Must match the payment_details.payment_method
          payment_details: paymentDetails
        }
      });
      
      console.log(`${actualPaymentMethod} payment processed successfully with backend.`);
    } catch (error) {
      console.error('Error processing payment with backend:', error);
      // We don't set payment error here since the payment was successful with the processor
      // but we log the error for debugging
    }
  };
  
  // Legacy handler for the mock Stripe form
  const handleStripePaymentCompleted = (result: { paymentIntent?: any; error?: any }) => {
    if (result.error) {
      // Show error to customer
      setPaymentError(result.error.message);
    } else if (result.paymentIntent) {
      // Generate a transaction ID
      const transactionId = 'mock_' + Date.now().toString();
      
      // Create payment details with the correct payment method
      const paymentDetails = {
        payment_method: 'credit_card', // Always use 'credit_card' for credit card payments
        transaction_id: transactionId,
        payment_date: today,
        processor: 'stripe', // Specify the processor
        status: 'succeeded',
        payment_method_details: {
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242'
          }
        }
      };
      
      // Payment succeeded - include payment method information and details
      handlePaymentSuccess({
        status: 'succeeded',
        transaction_id: transactionId,
        amount: total.toFixed(2),
        currency: 'USD',
        payment_method: 'credit_card', // Explicitly set payment_method
        payment_details: paymentDetails // Pass the complete payment details
      });
      
      // Log the payment for debugging
      console.log('Mock Stripe payment completed:', {
        transactionId,
        amount: total,
        method: 'credit_card',
        processor: 'stripe',
        paymentDetails
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md md:max-w-2xl mx-auto animate-slideUp max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - fixed position instead of sticky for better iPad compatibility */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white z-10">
          <h3 className="text-lg font-medium text-gray-900">
            {paymentSuccessful ? 'Payment Successful' : 'Process Additional Payment'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - make it scrollable */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {paymentSuccessful ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Payment Processed Successfully</h4>
              <p className="text-gray-600">The additional payment has been processed successfully.</p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Items Requiring Payment</h4>
                <div className="bg-gray-50 rounded-md p-3 space-y-3">
                  {paymentItems.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-gray-500 text-sm ml-2">x{item.quantity}</span>
                      </div>
                      <span className="text-gray-900">${(parseFloat(String(item.price)) * parseInt(String(item.quantity))).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center font-medium">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              {!showStripeForm && !paymentLinkSent && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'credit_card'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('credit_card')}
                    >
                      Credit Card
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'stripe_reader'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('stripe_reader')}
                    >
                      Stripe Reader
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'cash'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'payment_link'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('payment_link')}
                    >
                      Send Link
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'clover'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('clover')}
                    >
                      Clover
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'revel'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('revel')}
                    >
                      Revel
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === 'other'
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setPaymentMethod('other')}
                    >
                      Other
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Payment Panel (Stripe Reader, Clover, Revel, Other) */}
              {['stripe_reader', 'clover', 'revel', 'other'].includes(paymentMethod) && !paymentLinkSent && (
                <div className="border border-gray-200 rounded-md p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    {paymentMethod === 'stripe_reader'
                      ? 'Stripe Card Reader'
                      : paymentMethod === 'clover'
                        ? 'Clover'
                        : paymentMethod === 'revel'
                          ? 'Revel'
                          : 'Other'} Payment Details
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction ID/Reference Number (optional)
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        placeholder="Enter transaction ID or reference number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                        value={paymentDate}
                        onChange={e => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        placeholder="Enter any additional payment notes"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Link Form */}
              {paymentMethod === 'payment_link' && !paymentLinkSent && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Email (optional)
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Phone (optional)
                    </label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+1234567890"
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    Please provide at least one contact method to send the payment link.
                  </p>
                </div>
              )}

              {/* Payment Link Sent */}
              {paymentLinkSent && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-green-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Payment Link Sent</h3>
                      <div className="mt-2 text-sm text-green-700">
                        {paymentLinkSentMessage ? (
                          <p className="mb-2">{paymentLinkSentMessage}</p>
                        ) : (
                          <p>
                            A payment link has been sent to the customer. They can use this link to complete
                            the payment:
                          </p>
                        )}
                        <div className="mt-2 bg-white p-2 rounded border border-gray-200 break-all">
                          <a
                            href={paymentLinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {paymentLinkUrl}
                          </a>
                        </div>
                        <p className="mt-2">
                          You can close this modal and mark the items as paid once the customer completes the
                          payment, or leave it open to track payment status.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash Payment Panel */}
              {paymentMethod === 'cash' && !paymentLinkSent && (
                <div className="border border-gray-200 rounded-md p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Cash Payment</h4>
                  <div className="space-y-4">
                    {/* Order Total Display */}
                    <div className="flex justify-between items-center font-medium bg-gray-50 p-3 rounded-md">
                      <span>Order Total:</span>
                      <span className="text-lg text-[#c1902f]">${total.toFixed(2)}</span>
                    </div>
                    
                    {/* Cash Received Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cash Received
                      </label>
                      
                      {/* Quick denomination buttons */}
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[5, 10, 20, 50, 100].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setCashReceived(amount)}
                            className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                              ${cashReceived === amount
                                ? 'bg-[#c1902f] text-white border-[#c1902f]'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            ${amount}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCashReceived(Math.ceil(total))}
                          className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                            ${cashReceived === Math.ceil(total)
                              ? 'bg-[#c1902f] text-white border-[#c1902f]'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          ${Math.ceil(total)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashReceived(total)}
                          className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                            ${cashReceived === total
                              ? 'bg-[#c1902f] text-white border-[#c1902f]'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          Exact
                        </button>
                      </div>
                      
                      {/* Custom amount input */}
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={cashReceived}
                          onChange={e => setCashReceived(parseFloat(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                          placeholder="Other amount"
                        />
                      </div>
                    </div>
                    
                    {/* Change Calculation (only shown if cashReceived > total) */}
                    {cashReceived > total && (
                      <div className="bg-green-50 border border-green-100 rounded-md p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Change Due:</span>
                          <span className="text-lg font-bold text-green-700">
                            ${(cashReceived - total).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Real Payment Integration */}
              {paymentMethod === 'credit_card' && !paymentLinkSent && !showStripeForm && (
                <div className="border border-gray-200 rounded-md p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Credit Card Payment</h4>
                  
                  {/* Conditionally render Stripe or PayPal components based on restaurant settings */}
                  {paymentProcessor === 'stripe' ? (
                    <StripeCheckout
                      ref={stripeRef}
                      amount={total.toString()} 
                      publishableKey={(paymentGateway.publishable_key as string) || ""}
                      currency="USD"
                      testMode={testMode}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
                    />
                  ) : (
                    <PayPalCheckout 
                      ref={paypalRef}
                      amount={total.toString()} 
                      clientId={(paymentGateway.client_id as string) || "sandbox_client_id"}
                      currency="USD"
                      testMode={testMode}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
                    />
                  )}
                </div>
              )}
              
              {/* Fallback Stripe Form Placeholder (only shown if no proper integration) */}
              {showStripeForm && (
                <div className="border border-gray-200 rounded-md p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Credit Card Details</h4>
                  {/* In a real implementation, you would embed your Stripe Elements form here */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                      <div className="h-10 bg-gray-100 rounded-md"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                        <div className="h-10 bg-gray-100 rounded-md"></div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                        <div className="h-10 bg-gray-100 rounded-md"></div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name on Card</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                        placeholder="John Smith"
                      />
                    </div>
                    {testMode ? (
                      <div className="p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-700 mt-2">
                        <strong>Test Mode:</strong> No real payment will be processed.
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        This would be connected to your Stripe integration in production.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{paymentError}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - fixed position instead of sticky for better iPad compatibility */}
        {!paymentSuccessful && (
          <div className="px-6 py-4 border-t border-gray-200 flex flex-row-reverse bg-white z-10">
            {!showStripeForm && !paymentLinkSent && (
              <>
                {paymentMethod === 'credit_card' && (
                  <button
                    type="button"
                    onClick={handleCreditCardPayment}
                    disabled={isLoading}
                    className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
                  >
                    {isLoading ? 'Processing...' : 'Process Card Payment'}
                  </button>
                )}
                {paymentMethod === 'cash' && (
                  <button
                    type="button"
                    onClick={handleCashPayment}
                    disabled={isLoading || cashReceived < total}
                    className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Complete Cash Payment'}
                  </button>
                )}
                {['stripe_reader', 'clover', 'revel', 'other'].includes(paymentMethod) && (
                  <button
                    type="button"
                    onClick={handleManualPayment}
                    disabled={isLoading || !paymentDate}
                    className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : `Complete ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} Payment`}
                  </button>
                )}
                {paymentMethod === 'payment_link' && (
                  <button
                    type="button"
                    onClick={handleSendPaymentLink}
                    disabled={isLoading || (!customerEmail && !customerPhone)}
                    className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Sending...' : 'Send Payment Link'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="mr-3 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
                >
                  Cancel
                </button>
              </>
            )}

            {showStripeForm && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    // Mock successful payment for demo purposes with payment method info
                    handleStripePaymentCompleted({
                      paymentIntent: {
                        status: 'succeeded',
                        payment_method: 'credit_card',
                        payment_method_details: {
                          type: 'card',
                          card: {
                            brand: 'visa',
                            last4: '4242'
                          }
                        }
                      }
                    });
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
                >
                  {isLoading ? 'Processing...' : 'Pay Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStripeForm(false)}
                  className="mr-3 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f]"
                >
                  Back
                </button>
              </>
            )}

            {paymentLinkSent && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    // Mark the payment as completed with the correct payment method
                    const numericOrderId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
                    const transactionId = `payment_link_${Date.now()}`;
                    
                    // Create payment details object with consistent structure
                    const paymentDetails = {
                      payment_method: 'payment_link', // Always use 'payment_link' for payment links
                      transaction_id: transactionId,
                      payment_date: today,
                      notes: `Payment link completed: ${paymentLinkUrl}`,
                      status: 'succeeded'
                    };
                    
                    // Prepare common items mapping to avoid repetition
                    const itemsMapping = paymentItems.map(item => ({
                      id: item.id,
                      name: item.name,
                      quantity: item.quantity,
                      price: item.price
                    }));
                    
                    // Process the payment with the API using consistent structure
                    await orderPaymentOperationsApi.processAdditionalPayment(numericOrderId, {
                      payment_method: 'payment_link', // This must be 'payment_link'
                      items: itemsMapping,
                      payment_details: paymentDetails,
                      order_payment: {
                        payment_method: 'payment_link', // This is critical - must match the payment method
                        payment_details: paymentDetails
                      }
                    });
                    
                    // Mark as paid for the purpose of this UI flow
                    onPaymentCompleted();
                    onClose();
                  } catch (error) {
                    console.error('Error marking payment link as paid:', error);
                    setPaymentError('Failed to mark payment as paid. Please try again.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="px-4 py-2 bg-[#c1902f] text-white rounded-md text-sm font-medium hover:bg-[#d4a43f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#c1902f] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Mark as Paid & Close'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
