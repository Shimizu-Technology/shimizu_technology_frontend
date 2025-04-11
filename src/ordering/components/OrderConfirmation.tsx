// src/ordering/components/OrderConfirmation.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export function OrderConfirmation() {
  // Grab data from location state
  const { state } = useLocation() as {
    state?: {
      orderId?: string;
      total?: number;
      hasAny24hrItem?: boolean;
    };
  };

  const orderId = state?.orderId || 'N/A';
  const total = state?.total ?? 0;
  const hasAny24hrItem = !!state?.hasAny24hrItem;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-xl mx-auto text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Thank You for Your Order!
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Your order #{orderId} has been received and is currently pending.
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {hasAny24hrItem && (
            <p className="text-red-600 mb-4 font-semibold">
              Heads up: one or more items in your order requires 24 hours notice!
            </p>
          )}

          <p className="text-gray-600 mb-4">
            We’ll send you an ETA as soon as the staff begins preparing your order.
          </p>
          <p className="text-gray-600 mb-4">
            Please show your order number when picking up.
          </p>

          <div className="border-t pt-4">
            <p className="text-lg font-medium">
              Total Paid: ${total.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="space-x-4">
          <Link
            to="/menu"
            className="inline-flex items-center px-6 py-3 border border-transparent
                       text-base font-medium rounded-md text-white bg-[#c1902f]
                       hover:bg-[#d4a43f]"
          >
            Order More
          </Link>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-[#c1902f]
                       text-base font-medium rounded-md text-[#c1902f]
                       hover:bg-gray-50"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
