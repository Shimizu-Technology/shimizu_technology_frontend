// src/ordering/components/admin/OrderPaymentHistory.tsx

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/apiClient';

interface RefundedItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface OrderPayment {
  id: number;
  payment_type: 'initial' | 'additional' | 'refund';
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  description?: string;
  transaction_id?: string;
  payment_details?: any;
  refunded_items?: RefundedItem[];
}

interface OrderPaymentHistoryProps {
  payments: OrderPayment[];
}

interface StaffMember {
  id: number;
  name: string;
  position: string;
  user_id: number;
}

interface User {
  id: number;
  name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export function OrderPaymentHistory({ payments }: OrderPaymentHistoryProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    // Fetch staff members to map IDs to names
    const fetchStaffMembers = async () => {
      try {
        const response = await apiClient.get('/staff_members');
        if (response.data && Array.isArray(response.data)) {
          setStaffMembers(response.data);
        } else if (response.data && Array.isArray(response.data.staff_members)) {
          setStaffMembers(response.data.staff_members);
        }
      } catch (error) {
        console.error('Error fetching staff members:', error);
      }
    };
    
    // Fetch users to map user IDs to names
    const fetchUsers = async () => {
      try {
        const response = await apiClient.get('/users');
        if (response && Array.isArray(response)) {
          setUsers(response);
        } else if (response && response.data && Array.isArray(response.data)) {
          setUsers(response.data);
        } else if (response && response.data && response.data.users && Array.isArray(response.data.users)) {
          setUsers(response.data.users);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    
    fetchStaffMembers();
    fetchUsers();
  }, []);
  // Calculate totals
  const totalPaid = payments
    .filter(p => p.payment_type !== 'refund')
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  
  const totalRefunded = payments
    .filter(p => p.payment_type === 'refund')
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  
  const netAmount = totalPaid - totalRefunded;

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Helper function to get payment type badge
  const getPaymentTypeBadge = (type: string) => {
    switch (type) {
      case 'initial':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Initial</span>;
      case 'additional':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Additional</span>;
      case 'refund':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Refund</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">{type}</span>;
    }
  };

  // Helper function to get payment status badge
  const getPaymentStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'succeeded':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Completed</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Pending</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Failed</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  // Helper function to format payment method
  const formatPaymentMethod = (method: string) => {
    switch (method.toLowerCase()) {
      case 'credit_card':
        return 'Credit Card';
      case 'paypal':
        return 'PayPal';
      case 'stripe':
        return 'Stripe';
      case 'cash':
        return 'Cash';
      case 'clover':
        return 'Clover';
      case 'revel':
        return 'Revel';
      case 'other':
        return 'Other';
      default:
        return method;
    }
  };

  // Helper function to get refunded items from either direct property or payment_details
  const getRefundedItems = (payment: OrderPayment): RefundedItem[] => {
    // First check if refunded_items is directly on the payment
    if (payment.refunded_items && Array.isArray(payment.refunded_items) && payment.refunded_items.length > 0) {
      return payment.refunded_items;
    }
    
    // Then check if it's in payment_details
    if (payment.payment_details && payment.payment_details.refunded_items && 
        Array.isArray(payment.payment_details.refunded_items) && 
        payment.payment_details.refunded_items.length > 0) {
      return payment.payment_details.refunded_items;
    }
    
    return [];
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Payment history table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => {
              const [showDetails, setShowDetails] = useState(false);
              const refundedItems = getRefundedItems(payment);
              
              return (
                <React.Fragment key={payment.id}>
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer ${payment.payment_type === 'refund' ? 'bg-red-50' : ''}`}
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getPaymentTypeBadge(payment.payment_type)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatPaymentMethod(payment.payment_method)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getPaymentStatusBadge(payment.status)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-right ${
                      payment.payment_type === 'refund' ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {payment.payment_type === 'refund' ? '-' : ''}${parseFloat(String(payment.amount)).toFixed(2)}
                    </td>
                  </tr>
                  
                  {/* Expandable details row */}
                  {showDetails && (
                    <tr className={payment.payment_type === 'refund' ? 'bg-red-50' : 'bg-gray-50'}>
                      <td colSpan={5} className="px-4 py-3 text-sm">
                        <div className="border-t border-gray-200 pt-2">
                          {payment.payment_type === 'refund' && (
                            <div className="mb-3 bg-red-50 p-2 rounded border border-red-100">
                              <div className="font-medium text-red-700 mb-1">Refund Details</div>
                              {payment.description && (
                                <div className="mb-2">
                                  <span className="font-medium">Reason:</span> {payment.description}
                                </div>
                              )}
                              
                              {/* Display refunded items */}
                              {refundedItems && refundedItems.length > 0 ? (
                                <div className="mb-2">
                                  <span className="font-medium">Refunded Items:</span>
                                  <ul className="mt-1 pl-5 list-disc">
                                    {refundedItems.map((item: RefundedItem, idx: number) => (
                                      <li key={idx} className="text-sm">
                                        {item.name} × {item.quantity} (${(item.price * item.quantity).toFixed(2)})
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <div className="text-sm text-red-600 italic">
                                  No specific items recorded for this refund
                                </div>
                              )}
                            </div>
                          )}
                          
                          {payment.transaction_id && (
                            <div className="mb-2">
                              <span className="font-medium">Transaction ID:</span> {payment.transaction_id}
                            </div>
                          )}
                          
                          {/* Display payment details in a user-friendly format */}
                          {payment.payment_details && (
                            <div className="mb-2">
                              <span className="font-medium">Additional Details:</span>
                              <div className="mt-1 text-sm">
                                {payment.payment_details.status && (
                                  <div><span className="font-medium">Status:</span> {payment.payment_details.status}</div>
                                )}
                                {payment.payment_details.test_mode && (
                                  <div><span className="font-medium">Test Mode:</span> Yes</div>
                                )}
                                {payment.payment_details.amount && (
                                  <div><span className="font-medium">Amount:</span> ${payment.payment_details.amount}</div>
                                )}
                                {payment.payment_details.payment_date && (
                                  <div><span className="font-medium">Payment Date:</span> {payment.payment_details.payment_date}</div>
                                )}
                                {payment.payment_details.transaction_id && (
                                  <div><span className="font-medium">Transaction ID:</span> {payment.payment_details.transaction_id}</div>
                                )}
                                {payment.payment_details.notes && (
                                  <div><span className="font-medium">Notes:</span> {payment.payment_details.notes}</div>
                                )}
                                {payment.payment_details.error_handled && (
                                  <div><span className="font-medium">Error Handled:</span> {payment.payment_details.error_handled}</div>
                                )}
                                {payment.payment_details.created_by_user_id && (
                                  <div>
                                    <span className="font-medium">Created By User:</span> {
                                      (() => {
                                        const userId = Number(payment.payment_details.created_by_user_id);
                                        const user = users.find(user => user.id === userId);
                                        return user ? `${user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name || user.email} (ID: ${userId})` : `ID: ${userId}`;
                                      })()
                                    }
                                  </div>
                                )}
                                {/* Display any other fields that might be in payment_details */}
                                {Object.entries(payment.payment_details)
                                  .filter(([key]) => !['status', 'test_mode', 'amount', 'payment_date', 'transaction_id', 'notes', 'error_handled', 'created_by_user_id'].includes(key))
                                  .map(([key, value]) => {
                                    // Special handling for staffOrderParams
                                    if (key === 'staffOrderParams' && typeof value === 'object' && value !== null) {
                                      return (
                                        <div key={key} className="mt-2">
                                          <span className="font-medium">Staff Order Parameters:</span>
                                          <div className="pl-4 mt-1 border-l-2 border-gray-200">
                                            {Object.entries(value).map(([paramKey, paramValue]) => {
                                              // Format staff member IDs to show names
                                              if (paramKey === 'staff_member_id' || paramKey === 'created_by_staff_id') {
                                                const staffId = Number(paramValue);
                                                const staffMember = staffMembers.find(staff => staff.id === staffId);
                                                return (
                                                  <div key={paramKey} className="text-sm">
                                                    <span className="font-medium">{paramKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> 
                                                    {staffMember ? `${staffMember.name} (ID: ${staffId})` : `ID: ${staffId}`}
                                                  </div>
                                                );
                                              }
                                              
                                              // Format user IDs to show names
                                              if (paramKey === 'created_by_user_id') {
                                                const userId = Number(paramValue);
                                                const user = users.find(user => user.id === userId);
                                                return (
                                                  <div key={paramKey} className="text-sm">
                                                    <span className="font-medium">Created By User:</span> 
                                                    {user ? `${user.name || user.email} (ID: ${userId})` : `ID: ${userId}`}
                                                  </div>
                                                );
                                              }
                                              
                                              // For other parameters
                                              return (
                                                <div key={paramKey} className="text-sm">
                                                  <span className="font-medium">{paramKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {String(paramValue)}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    }
                                    // For all other fields
                                    return (
                                      <div key={key}>
                                        <span className="font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {String(value)}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {/* If no payments, show a message */}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-sm text-center text-gray-500">
                  No payment records found.
                </td>
              </tr>
            )}
          </tbody>
          
          {/* Summary footer */}
          {payments.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                  Total Paid:
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                  ${totalPaid.toFixed(2)}
                </td>
              </tr>
              {totalRefunded > 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                    Total Refunded:
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                    -${totalRefunded.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  Net Amount:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                  ${netAmount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
