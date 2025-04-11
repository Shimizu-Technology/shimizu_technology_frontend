// src/ordering/components/admin/reports/VipCustomerReport.tsx
import React, { useState, useMemo } from 'react';
import { VipCustomerReport as VipCustomerReportType, VipReportSummary } from '../../../../shared/api';
import * as XLSX from 'xlsx';

interface VipCustomerReportProps {
  vipCustomers: VipCustomerReportType[];
  summary: VipReportSummary;
}

export function VipCustomerReport({ vipCustomers, summary }: VipCustomerReportProps) {
  // State for sorting
  const [sortField, setSortField] = useState<'user_name' | 'total_spent' | 'order_count'>('total_spent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle sort click
  const handleSortClick = (field: 'user_name' | 'total_spent' | 'order_count') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sorted VIP customers
  const sortedVipCustomers = useMemo(() => {
    return [...vipCustomers].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'user_name') {
        comparison = a.user_name.localeCompare(b.user_name);
      } else if (sortField === 'total_spent') {
        comparison = Number(a.total_spent) - Number(b.total_spent);
      } else if (sortField === 'order_count') {
        comparison = Number(a.order_count) - Number(b.order_count);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [vipCustomers, sortField, sortDirection]);

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Export to Excel function
  const exportToExcel = () => {
    if (vipCustomers.length === 0) {
      alert('No data to export');
      return;
    }

    // Format summary data for export
    const summaryData = [
      { 'Metric': 'Total VIP Customers', 'Value': summary.total_vip_customers },
      { 'Metric': 'Total Orders', 'Value': summary.total_orders },
      { 'Metric': 'Total Revenue', 'Value': `$${Number(summary.total_revenue).toFixed(2)}` },
      { 'Metric': 'Average Orders per VIP', 'Value': Number(summary.average_orders_per_vip).toFixed(1) },
      { 'Metric': 'Average Spend per VIP', 'Value': `$${Number(summary.average_spend_per_vip).toFixed(2)}` },
      { 'Metric': 'Repeat Customer Rate', 'Value': `${(Number(summary.repeat_customer_rate) * 100).toFixed(0)}%` }
    ];

    // Format customer data for export
    const customerData = sortedVipCustomers.map(customer => {
      // Get top 3 items
      const topItems = customer.items
        .sort((a, b) => Number(b.quantity) - Number(a.quantity))
        .slice(0, 3)
        .map(item => `${item.name} (${item.quantity})`)
        .join(', ');

      return {
        'Customer': customer.user_name,
        'Email': customer.email,
        'Total Spent': `$${Number(customer.total_spent).toFixed(2)}`,
        'Orders': Number(customer.order_count),
        'Avg. Order Value': `$${Number(customer.average_order_value).toFixed(2)}`,
        'First Order': formatDate(customer.first_order_date),
        'Most Ordered Items': topItems
      };
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add summary sheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Add customers sheet
    const customerSheet = XLSX.utils.json_to_sheet(customerData);
    XLSX.utils.book_append_sheet(wb, customerSheet, 'VIP Customers');

    // Write file
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `VIP_Customer_Report_${now}.xlsx`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">VIP Customer Analysis</h3>
        
        {/* Export button */}
        {vipCustomers.length > 0 && (
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
          >
            <span className="mr-1">Export to Excel</span>
          </button>
        )}
      </div>
      
      {vipCustomers.length > 0 ? (
        <>
          {/* Summary statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Total VIP Customers</div>
              <div className="text-2xl font-bold">{summary.total_vip_customers}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Average Orders per VIP</div>
              <div className="text-2xl font-bold">{Number(summary.average_orders_per_vip).toFixed(1)}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">Repeat Customer Rate</div>
              <div className="text-2xl font-bold">{(summary.repeat_customer_rate * 100).toFixed(0)}%</div>
            </div>
          </div>
          
          {/* Customer table */}
          <h4 className="font-semibold text-lg mb-2">VIP Customer Details</h4>
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-sm border border-gray-200">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-4 py-2 text-left font-semibold cursor-pointer"
                    onClick={() => handleSortClick('user_name')}
                  >
                    Customer {sortField === 'user_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-4 py-2 text-right font-semibold cursor-pointer"
                    onClick={() => handleSortClick('total_spent')}
                  >
                    Total Spent {sortField === 'total_spent' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="px-4 py-2 text-right font-semibold cursor-pointer"
                    onClick={() => handleSortClick('order_count')}
                  >
                    Orders {sortField === 'order_count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">Avg. Order Value</th>
                  <th className="px-4 py-2 text-left font-semibold">Most Ordered Items</th>
                </tr>
              </thead>
              <tbody>
                {sortedVipCustomers.map((customer, idx) => (
                  <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div>{customer.user_name}</div>
                      <div className="text-xs text-gray-500">{customer.email}</div>
                      <div className="text-xs text-gray-500">
                        First order: {formatDate(customer.first_order_date)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">${Number(customer.total_spent).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{Number(customer.order_count)}</td>
                    <td className="px-4 py-2 text-right">${Number(customer.average_order_value).toFixed(2)}</td>
                    <td className="px-4 py-2">
                      {customer.items
                        .sort((a, b) => Number(b.quantity) - Number(a.quantity))
                        .slice(0, 3)
                        .map((item, i) => (
                          <div key={i} className="text-sm">
                            {item.name} <span className="text-gray-500">({item.quantity})</span>
                          </div>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-gray-500">No VIP customer data available for this period.</p>
      )}
    </div>
  );
}