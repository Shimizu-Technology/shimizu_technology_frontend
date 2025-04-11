// src/ordering/components/admin/reports/PaymentMethodReport.tsx
import React from 'react';
import { PaymentMethodReport as PaymentMethodReportType } from '../../../../shared/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

// Colors for the pie chart
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#A4DE6C'];

interface PaymentMethodReportProps {
  paymentMethods: PaymentMethodReportType[];
  totalAmount: number;
  totalCount: number;
}

export function PaymentMethodReport({ paymentMethods, totalAmount, totalCount }: PaymentMethodReportProps) {
  // Format payment method name for display
  const formatMethodName = (method: string) => {
    return method
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Export to Excel function
  const exportToExcel = () => {
    if (paymentMethods.length === 0) {
      alert('No data to export');
      return;
    }

    // Format payment method data for export
    const paymentData = paymentMethods
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .map(method => ({
        'Payment Method': formatMethodName(method.payment_method),
        'Count': method.count,
        'Amount': `$${Number(method.amount).toFixed(2)}`,
        'Percentage': `${Number(method.percentage).toFixed(2)}%`
      }));

    // Add total row
    paymentData.push({
      'Payment Method': 'Total',
      'Count': totalCount,
      'Amount': `$${Number(totalAmount).toFixed(2)}`,
      'Percentage': '100%'
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add payment methods sheet
    const sheet = XLSX.utils.json_to_sheet(paymentData);
    XLSX.utils.book_append_sheet(wb, sheet, 'Payment Methods');

    // Write file
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Payment_Methods_${now}.xlsx`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Payment Method Breakdown</h3>
        
        {/* Export button */}
        {paymentMethods.length > 0 && (
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
          >
            <span className="mr-1">Export to Excel</span>
          </button>
        )}
      </div>
      
      {paymentMethods.length > 0 ? (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="table-auto w-full text-sm border border-gray-200">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Payment Method</th>
                  <th className="px-4 py-2 text-right font-semibold">Count</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-right font-semibold">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods
                  .sort((a, b) => Number(b.amount) - Number(a.amount))
                  .map((method, idx) => (
                    <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-2 capitalize">
                        {formatMethodName(method.payment_method)}
                      </td>
                      <td className="px-4 py-2 text-right">{method.count}</td>
                      <td className="px-4 py-2 text-right">${Number(method.amount).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{Number(method.percentage).toFixed(2)}%</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-semibold">{totalCount}</td>
                  <td className="px-4 py-2 text-right font-semibold">${Number(totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          {/* Pie chart visualization */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethods.map(method => ({
                    ...method,
                    amount: Number(method.amount)
                  }))}
                  dataKey="amount"
                  nameKey="payment_method"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={({name, percent}) => `${formatMethodName(name)} ${(percent * 100).toFixed(0)}%`}
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend formatter={(value) => formatMethodName(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="text-gray-500">No payment method data available.</p>
      )}
    </div>
  );
}