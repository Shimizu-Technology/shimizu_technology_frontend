// src/ordering/components/admin/OrderDetailsModal.tsx
import { OrderPaymentHistory } from './OrderPaymentHistory';

interface OrderDetailsModalProps {
  order: any;
  onClose: () => void;
}

export function OrderDetailsModal({
  order,
  onClose
}: OrderDetailsModalProps) {
  const isRefunded = order.status === 'refunded';
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-md max-w-lg w-full p-4 relative animate-slideUp">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Close</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Order #{order.id}</h3>
          {isRefunded && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Refunded
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Placed: {new Date(order.createdAt).toLocaleString()}
        </p>
        
        {/* Order Creator Information */}
        <div className="text-xs text-gray-500 mb-3">
          {order.created_by_user_id && (
            <p>Created by User: {order.created_by_user_name || `ID: ${order.created_by_user_id}`}</p>
          )}
          {order.created_by_staff_id && (
            <p>Created by Staff: {order.created_by_staff_name || `ID: ${order.created_by_staff_id}`}</p>
          )}
          {!order.created_by_user_id && !order.created_by_staff_id && (
            <p>Created by: Customer</p>
          )}
        </div>

        <p className="font-medium mb-2 text-sm">Items:</p>
        <div className="space-y-2 mb-4">
          {order.items.map((item: any, idx: number) => {
            // Generate a unique key using item properties
            const itemKey = `${item.id}-${idx}-${JSON.stringify(item.customizations || {})}`;
            
            return (
              <div key={itemKey} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">
                    {item.name} × {item.quantity}
                  </p>
                  {/* Display customizations if they exist */}
                  {item.customizations && (
                    <div className="text-xs text-gray-500">
                      {Array.isArray(item.customizations) ? (
                        // Handle array format customizations
                        item.customizations.map((custom: any, cidx: number) => (
                          <p key={`${itemKey}-c-${cidx}`}>
                            {custom.option_name}
                            {custom.price > 0 && ` (+$${custom.price.toFixed(2)})`}
                          </p>
                        ))
                      ) : (
                        // Handle object format customizations
                        Object.entries(item.customizations).map(([group, options]: [string, any], cidx: number) => (
                          <p key={`${itemKey}-c-${cidx}`}>
                            <span className="font-medium">{group}:</span> {Array.isArray(options) ? options.join(', ') : options}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-600">Notes: {item.notes}</p>
                  )}
                </div>
                <p>${Number(item.price * item.quantity).toFixed(2)}</p>
              </div>
            );
          })}
        </div>

        {/* Payment History Section */}
        {order.order_payments && order.order_payments.length > 0 && (
          <div className="mt-4 mb-4 border-t border-gray-200 pt-3">
            <h4 className="font-medium mb-2 text-sm">Payment History:</h4>
            <OrderPaymentHistory payments={order.order_payments} />
          </div>
        )}

        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between items-center mb-3">
            <p className="font-medium">
              Total: ${Number(order.total || 0).toFixed(2)}
            </p>
            {isRefunded && (
              <p className="text-sm text-gray-600">
                This order has been fully refunded.
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#c1902f] text-white text-sm rounded hover:bg-[#d4a43f]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
