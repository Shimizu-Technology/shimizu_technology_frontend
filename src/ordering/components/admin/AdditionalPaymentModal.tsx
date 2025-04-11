// src/ordering/components/admin/AdditionalPaymentModal.tsx

import React, { useState } from 'react';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';

interface PaymentItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface AdditionalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  paymentItems: PaymentItem[];
  onPaymentCompleted: () => void;
}

export function AdditionalPaymentModal({
  isOpen,
  onClose,
  orderId,
  paymentItems,
  onPaymentCompleted,
}: AdditionalPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'cash'>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Calculate total amount
  const totalAmount = paymentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    try {
      // In a real implementation, this would create a payment intent and then
      // show a payment form (Stripe, PayPal, etc.) to the user
      await orderPaymentsApi.createAdditionalPayment(orderId, {
        items: paymentItems,
      });

      // For this demo, we'll just simulate a successful payment
      setTimeout(() => {
        setIsProcessing(false);
        setSuccess(true);
        
        // After 1.5 seconds, close the modal and notify parent
        setTimeout(() => {
          onPaymentCompleted();
        }, 1500);
      }, 1000);
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to process payment. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-headline"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg
                  className="h-6 w-6 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-headline">
                  Process Additional Payment
                </h3>
                <div className="mt-4">
                  {success ? (
                    <div className="bg-green-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-green-400"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-green-800">Payment Successful</h3>
                          <div className="mt-2 text-sm text-green-700">
                            <p>The payment has been processed successfully.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      {/* Items list */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Items to Pay</h4>
                        <div className="bg-gray-50 rounded-md p-3">
                          <ul className="divide-y divide-gray-200">
                            {paymentItems.map((item, index) => (
                              <li key={index} className="py-2 flex justify-between">
                                <div className="text-sm text-gray-700">
                                  {item.name} x {item.quantity}
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
                            <div className="text-sm font-medium text-gray-700">Total</div>
                            <div className="text-sm font-bold text-gray-900">${totalAmount.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Payment method */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method
                        </label>
                        <div className="flex space-x-4">
                          <div className="flex items-center">
                            <input
                              id="payment-credit-card"
                              name="payment-method"
                              type="radio"
                              checked={paymentMethod === 'credit_card'}
                              onChange={() => setPaymentMethod('credit_card')}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <label
                              htmlFor="payment-credit-card"
                              className="ml-2 block text-sm text-gray-700"
                            >
                              Credit Card
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="payment-cash"
                              name="payment-method"
                              type="radio"
                              checked={paymentMethod === 'cash'}
                              onChange={() => setPaymentMethod('cash')}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <label htmlFor="payment-cash" className="ml-2 block text-sm text-gray-700">
                              Cash
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Credit card form would go here in a real implementation */}
                      {paymentMethod === 'credit_card' && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-500 italic">
                            In a real implementation, a credit card form would be displayed here.
                          </p>
                        </div>
                      )}

                      {error && (
                        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm ${
                            isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                        >
                          {isProcessing ? 'Processing...' : 'Process Payment'}
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          disabled={isProcessing}
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
