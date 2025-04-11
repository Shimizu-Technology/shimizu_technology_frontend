import React from 'react';

interface RefundItem {
  item: {
    name: string;
    quantity: number;
    price: number;
  };
  amount: number;
  reason: string;
}

interface PaymentSummaryAlertProps {
  originalTotal: number;
  newTotal: number;
  totalRefunded: number;
  totalStoreCredit: number;
  hasPendingPayments: boolean;
  refundItems?: RefundItem[];
  storeCreditItems?: RefundItem[];
}

export function PaymentSummaryAlert({
  originalTotal,
  newTotal,
  totalRefunded,
  totalStoreCredit,
  hasPendingPayments,
  refundItems = [],
  storeCreditItems = []
}: PaymentSummaryAlertProps) {
  const hasAdjustments = totalRefunded > 0 || totalStoreCredit > 0 || hasPendingPayments || Math.abs(originalTotal - newTotal) > 0.01;
  
  if (!hasAdjustments) return null;
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">
            Payment Changes Summary
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <ul className="list-disc pl-5 space-y-1">
              {Math.abs(originalTotal - newTotal) > 0.01 && (
                <li>Order total changed: ${originalTotal.toFixed(2)} → ${newTotal.toFixed(2)}</li>
              )}
              {totalRefunded > 0 && (
                <>
                  <li>Total to be refunded: ${totalRefunded.toFixed(2)}</li>
                  {refundItems && refundItems.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 mb-2 text-xs">
                      {refundItems.map((refund, idx) => (
                        <li key={idx} className="mb-1">
                          <span className="font-medium">{refund.item.name} × {refund.item.quantity}</span>
                          <span> (${refund.amount.toFixed(2)})</span>
                          {refund.reason && <div className="italic">Reason: {refund.reason}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {totalStoreCredit > 0 && (
                <>
                  <li>Total store credit to add: ${totalStoreCredit.toFixed(2)}</li>
                  {storeCreditItems && storeCreditItems.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 mb-2 text-xs">
                      {storeCreditItems.map((credit, idx) => (
                        <li key={idx} className="mb-1">
                          <span className="font-medium">{credit.item.name} × {credit.item.quantity}</span>
                          <span> (${credit.amount.toFixed(2)})</span>
                          {credit.reason && <div className="italic">Reason: {credit.reason}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {hasPendingPayments && (
                <li>New items requiring payment are added to this order</li>
              )}
            </ul>
          </div>
          <p className="mt-3 text-sm text-blue-700">
            These payment changes will be processed when you save the order.
          </p>
        </div>
      </div>
    </div>
  );
}
