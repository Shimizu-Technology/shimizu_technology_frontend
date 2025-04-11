import React, { useState, useRef } from 'react';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import { PayPalCheckout, PayPalCheckoutRef } from '../../payment/PayPalCheckout';
import { StripeCheckout, StripeCheckoutRef } from '../../payment/StripeCheckout';
import { LoadingSpinner } from '../../../../shared/components/ui';
import { Tab } from '@headlessui/react';
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import toastUtils from '../../../../shared/utils/toastUtils';

interface PaymentTestResult {
  processor: string;
  success: boolean;
  transaction_id?: string;
  error?: string;
  timestamp: string;
}

export function PaymentTester() {
  const { restaurant } = useRestaurantStore();
  const [amount, setAmount] = useState('5.00');
  const [loading, setLoading] = useState(false);
  const [currentProcessor, setCurrentProcessor] = useState<'stripe' | 'paypal'>('paypal');
  const [testResults, setTestResults] = useState<PaymentTestResult[]>([]);
  
  // Refs for payment components
  const paypalRef = useRef<PayPalCheckoutRef>(null);
  const stripeRef = useRef<StripeCheckoutRef>(null);

  // Get the payment settings from restaurant store
  const paymentSettings = restaurant?.admin_settings?.payment_gateway || {};
  
  const handlePaymentSuccess = (processor: string, details: { 
    status: string;
    transaction_id: string;
    amount: string;
  }) => {
    const result: PaymentTestResult = {
      processor,
      success: true,
      transaction_id: details.transaction_id,
      timestamp: new Date().toISOString()
    };
    
    setTestResults(prev => [result, ...prev]);
    toastUtils.success(`${processor} test payment successful!`);
    setLoading(false);
  };
  
  const handlePaymentError = (processor: string, error: Error) => {
    const result: PaymentTestResult = {
      processor,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    setTestResults(prev => [result, ...prev]);
    toastUtils.error(`${processor} test payment failed: ${error.message}`);
    setLoading(false);
  };
  
  const processPayPalPayment = async () => {
    if (!paypalRef.current) {
      toastUtils.error('PayPal component not initialized');
      return;
    }
    
    setLoading(true);
    setCurrentProcessor('paypal');
    try {
      const success = await paypalRef.current.processPayment();
      if (!success) {
        // This usually means user cancelled or component handled it internally
        setLoading(false);
      }
    } catch (error) {
      handlePaymentError('PayPal', error instanceof Error ? error : new Error('Unknown PayPal error'));
    }
  };
  
  const processStripePayment = async () => {
    if (!stripeRef.current) {
      toastUtils.error('Stripe component not initialized');
      return;
    }
    
    setLoading(true);
    setCurrentProcessor('stripe');
    try {
      const success = await stripeRef.current.processPayment();
      if (!success) {
        // This usually means user cancelled or component handled it internally
        setLoading(false);
      }
    } catch (error) {
      handlePaymentError('Stripe', error instanceof Error ? error : new Error('Unknown Stripe error'));
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Payment Test Environment</h3>
      <p className="text-gray-600 mb-6">
        Test your payment configuration with both PayPal and Stripe. All payments are processed in test mode.
      </p>
      
      {/* Test amount input */}
      <div className="mb-6">
        <label htmlFor="test-amount" className="block text-sm font-medium text-gray-700 mb-1">
          Test Amount
        </label>
        <div className="relative rounded-md shadow-sm max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="text"
            name="test-amount"
            id="test-amount"
            className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">USD</span>
          </div>
        </div>
      </div>
      
      {/* Payment processor tabs */}
      <Tab.Group>
        <Tab.List className="flex p-1 space-x-1 bg-gray-100 rounded-xl">
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${
                selected
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-700 hover:bg-white hover:text-blue-600'
              }`
            }
          >
            PayPal
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${
                selected
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-700 hover:bg-white hover:text-blue-600'
              }`
            }
          >
            Stripe
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${
                selected
                  ? 'bg-white shadow text-blue-700'
                  : 'text-gray-700 hover:bg-white hover:text-blue-600'
              }`
            }
          >
            Test Results
          </Tab>
        </Tab.List>
        
        <Tab.Panels className="mt-4">
          {/* PayPal Panel */}
          <Tab.Panel className="p-4 bg-gray-50 rounded-lg">
            {paymentSettings.client_id ? (
              <>
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900">PayPal Test Payment</h4>
                  <p className="text-sm text-gray-600">
                    Process a test payment using PayPal to verify your integration.
                  </p>
                </div>
                
                <div className="p-4 bg-white rounded-lg shadow-sm mb-4">
                  <PayPalCheckout
                    ref={paypalRef}
                    amount={amount}
                    clientId={paymentSettings.client_id as string}
                    testMode={true}
                    onPaymentSuccess={(details) => handlePaymentSuccess('PayPal', details)}
                    onPaymentError={(error) => handlePaymentError('PayPal', error)}
                  />
                </div>
                
                <button
                  onClick={processPayPalPayment}
                  disabled={loading && currentProcessor === 'paypal'}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
                >
                  {loading && currentProcessor === 'paypal' ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner showText={false} className="h-5 w-5 mr-2" />
                      Processing...
                    </span>
                  ) : (
                    'Process PayPal Test Payment'
                  )}
                </button>
              </>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-700 font-medium">PayPal not configured</p>
                    <p className="text-sm text-yellow-600 mt-1">
                      Please add your PayPal credentials in the Payment Settings tab to test PayPal payments.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Tab.Panel>
          
          {/* Stripe Panel */}
          <Tab.Panel className="p-4 bg-gray-50 rounded-lg">
            {paymentSettings.publishable_key ? (
              <>
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900">Stripe Test Payment</h4>
                  <p className="text-sm text-gray-600">
                    Process a test payment using Stripe to verify your integration.
                  </p>
                </div>
                
                <div className="p-4 bg-white rounded-lg shadow-sm mb-4">
                  <StripeCheckout
                    ref={stripeRef}
                    amount={amount}
                    publishableKey={paymentSettings.publishable_key as string}
                    testMode={true}
                    onPaymentSuccess={(details) => handlePaymentSuccess('Stripe', details)}
                    onPaymentError={(error) => handlePaymentError('Stripe', error)}
                  />
                </div>
                
                <button
                  onClick={processStripePayment}
                  disabled={loading && currentProcessor === 'stripe'}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
                >
                  {loading && currentProcessor === 'stripe' ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner showText={false} className="h-5 w-5 mr-2" />
                      Processing...
                    </span>
                  ) : (
                    'Process Stripe Test Payment'
                  )}
                </button>
              </>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-700 font-medium">Stripe not configured</p>
                    <p className="text-sm text-yellow-600 mt-1">
                      Please add your Stripe credentials in the Payment Settings tab to test Stripe payments.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Tab.Panel>
          
          {/* Test Results Panel */}
          <Tab.Panel className="p-4 bg-gray-50 rounded-lg">
            <div className="mb-4">
              <h4 className="font-medium text-gray-900">Test Payment Results</h4>
              <p className="text-sm text-gray-600">
                Review the results of your test payment attempts.
              </p>
            </div>
            
            {testResults.length === 0 ? (
              <div className="p-4 bg-gray-100 border border-gray-200 rounded-md text-center text-gray-500">
                No test payments have been processed yet.
              </div>
            ) : (
              <div className="overflow-hidden border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Processor
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {testResults.map((result, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.processor}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {result.success ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle className="h-3.5 w-3.5 mr-1" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {result.success 
                            ? `Transaction ID: ${result.transaction_id}` 
                            : `Error: ${result.error}`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(result.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {testResults.length > 0 && (
              <button
                onClick={() => setTestResults([])}
                className="mt-4 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear Results
              </button>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
