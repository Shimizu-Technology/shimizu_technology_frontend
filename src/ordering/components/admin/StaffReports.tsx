// src/ordering/components/admin/StaffReports.tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/apiClient';
import toastUtils from '../../../shared/utils/toastUtils';

interface StaffMember {
  id: number;
  name: string;
  position: string;
  house_account_balance: number;
  active: boolean;
}

interface StaffOrder {
  id: number;
  staff_member_id: number;
  staff_member_name: string;
  staff_on_duty: boolean;
  pre_discount_total: number;
  total: number;
  discount_amount: number;
  discount_percentage: number;
  use_house_account: boolean;
  created_at: string;
}

interface DiscountSummary {
  total_retail_value: number;
  total_discounted_value: number;
  total_discount_amount: number;
  by_staff_member: {
    staff_id: number;
    staff_name: string;
    on_duty_count: number;
    off_duty_count: number;
    on_duty_discount: number;
    off_duty_discount: number;
    total_discount: number;
  }[];
}

export function StaffReports() {
  const [activeReport, setActiveReport] = useState<'orders' | 'balances' | 'discounts'>('orders');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    to: new Date().toISOString().split('T')[0] // today
  });
  const [staffOrders, setStaffOrders] = useState<StaffOrder[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [discountSummary, setDiscountSummary] = useState<DiscountSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'all'>('all');

  // Fetch staff members
  useEffect(() => {
    fetchStaffMembers();
  }, []);

  // Fetch report data when parameters change
  useEffect(() => {
    if (activeReport === 'orders') {
      fetchStaffOrders();
    } else if (activeReport === 'discounts') {
      fetchDiscountSummary();
    }
  }, [activeReport, dateRange, selectedStaffId]);

  const fetchStaffMembers = async () => {
    try {
      const response = await apiClient.get('/staff_members');
      // Ensure response.data is an array
      if (Array.isArray(response.data)) {
        setStaffMembers(response.data);
      } else if (response.data && typeof response.data === 'object') {
        // If it's an object with staff_members inside
        if (Array.isArray(response.data.staff_members)) {
          setStaffMembers(response.data.staff_members);
        } else {
          // Log the response structure for debugging
          console.error('Unexpected response format:', response.data);
          setStaffMembers([]);
          toastUtils.error('Unexpected API response format');
        }
      } else {
        console.error('Invalid response data:', response.data);
        setStaffMembers([]);
        toastUtils.error('Invalid API response');
      }
    } catch (err: any) {
      console.error('Error fetching staff members:', err);
      toastUtils.error('Failed to fetch staff members');
      setStaffMembers([]);
    }
  };

  const fetchStaffOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
        ...(selectedStaffId !== 'all' && { staff_member_id: selectedStaffId.toString() })
      });
      
      const response = await apiClient.get(`/reports/staff_orders?${params.toString()}`);
      // Handle different response formats
      if (Array.isArray(response.data)) {
        setStaffOrders(response.data);
      } else if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.staff_orders)) {
          setStaffOrders(response.data.staff_orders);
        } else if (Array.isArray(response.data.orders)) {
          // Handle the actual response format from the backend
          setStaffOrders(response.data.orders);
        } else {
          console.error('Unexpected staff orders response format:', response.data);
          setStaffOrders([]);
          setError('Unexpected API response format');
        }
      } else {
        console.error('Invalid staff orders response data:', response.data);
        setStaffOrders([]);
        setError('Invalid API response');
      }
    } catch (err: any) {
      console.error('Error fetching staff orders:', err);
      setError(err.message || 'Failed to fetch staff orders');
      toastUtils.error('Failed to fetch staff orders');
      setStaffOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscountSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
        ...(selectedStaffId !== 'all' && { staff_member_id: selectedStaffId.toString() })
      });
      
      const response = await apiClient.get(`/reports/discount_summary?${params.toString()}`);
      // Handle different response formats
      if (response.data && typeof response.data === 'object') {
        let summaryData;
        
        if (response.data.discount_summary) {
          summaryData = response.data.discount_summary;
        } else {
          // If it's already in the expected format
          summaryData = response.data;
        }
        
        // Ensure all numeric values are properly converted to numbers
        const processedData = {
          ...summaryData,
          total_retail_value: Number(summaryData.total_retail_value || 0),
          total_discounted_value: Number(summaryData.total_discounted_value || 0),
          total_discount_amount: Number(summaryData.total_discount_amount || 0),
          discount_percentage: Number(summaryData.discount_percentage || 0),
          by_staff_member: Array.isArray(summaryData.by_staff_member) 
            ? summaryData.by_staff_member.map((staff: any) => ({
                ...staff,
                on_duty_discount: Number(staff.on_duty_discount || 0),
                off_duty_discount: Number(staff.off_duty_discount || 0),
                total_discount: Number(staff.total_discount || 0),
                on_duty_count: Number(staff.on_duty_count || 0),
                off_duty_count: Number(staff.off_duty_count || 0)
              }))
            : []
        };
        
        setDiscountSummary(processedData);
      } else {
        console.error('Invalid discount summary response data:', response.data);
        setDiscountSummary(null);
        setError('Invalid API response');
      }
    } catch (err: any) {
      console.error('Error fetching discount summary:', err);
      setError(err.message || 'Failed to fetch discount summary');
      toastUtils.error('Failed to fetch discount summary');
      setDiscountSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const handleExportCSV = async () => {
    try {
      let endpoint = '';
      let filename = '';
      
      if (activeReport === 'orders') {
        endpoint = '/reports/staff_orders/export';
        filename = 'staff_orders.csv';
      } else if (activeReport === 'balances') {
        endpoint = '/reports/house_account_balances/export';
        filename = 'house_account_balances.csv';
      } else if (activeReport === 'discounts') {
        endpoint = '/reports/discount_summary/export';
        filename = 'discount_summary.csv';
      }
      
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
        ...(selectedStaffId !== 'all' && { staff_member_id: selectedStaffId.toString() })
      });
      
      const response = await apiClient.get(`${endpoint}?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toastUtils.success('Export successful');
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      toastUtils.error('Failed to export CSV');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Staff Reports</h1>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#a67b28] transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="mb-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveReport('orders')}
            className={`py-2 px-4 font-medium ${
              activeReport === 'orders'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Staff Order History
          </button>
          <button
            onClick={() => setActiveReport('balances')}
            className={`py-2 px-4 font-medium ${
              activeReport === 'balances'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            House Account Balances
          </button>
          <button
            onClick={() => setActiveReport('discounts')}
            className={`py-2 px-4 font-medium ${
              activeReport === 'discounts'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Discount Summary
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-md shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              name="from"
              value={dateRange.from}
              onChange={handleDateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              name="to"
              value={dateRange.to}
              onChange={handleDateChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Member
            </label>
            <select
              value={selectedStaffId === 'all' ? 'all' : selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
            >
              <option value="all">All Staff Members</option>
              {staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#c1902f]"></div>
        </div>
      ) : (
        <>
          {/* Staff Order History */}
          {activeReport === 'orders' && (
            <div className="bg-white rounded-md shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duty Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pre-Discount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discount Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discount Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Final Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staffOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                          No staff orders found for the selected period
                        </td>
                      </tr>
                    ) : (
                      staffOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(order.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {order.staff_member_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.staff_on_duty ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.staff_on_duty ? 'On Duty' : 'Off Duty'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              ${order.pre_discount_total.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              ${order.discount_amount.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.staff_on_duty ? '50%' : '30%'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              ${order.total.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.use_house_account ? 'House Account' : 'Immediate'}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* House Account Balances */}
          {activeReport === 'balances' && (
            <div className="bg-white rounded-md shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff Member
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staffMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No staff members found
                        </td>
                      </tr>
                    ) : (
                      staffMembers.map((staff) => (
                        <tr key={staff.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{staff.position}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${
                              staff.house_account_balance > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${Math.abs(staff.house_account_balance).toFixed(2)}
                              {staff.house_account_balance > 0 ? ' (owed)' : staff.house_account_balance < 0 ? ' (credit)' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              staff.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {staff.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => window.location.href = `#/admin/staff?id=${staff.id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Discount Summary */}
          {activeReport === 'discounts' && discountSummary && (
            <div className="space-y-6">
              <div className="bg-white rounded-md shadow-md p-4">
                <h2 className="text-xl font-semibold mb-4">Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-md group relative cursor-help">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-500">Original Price (Before Discount)</div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${(discountSummary.total_retail_value || 0).toFixed(2)}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition duration-300 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-800 text-white text-xs rounded w-64 mb-2 shadow-lg">
                      The full price that would have been charged to regular customers (no staff discount).
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md group relative cursor-help">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-500">Amount Paid (After Discount)</div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${(discountSummary.total_discounted_value || 0).toFixed(2)}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition duration-300 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-800 text-white text-xs rounded w-64 mb-2 shadow-lg">
                      The actual amount paid by staff members after applying the staff discount (50% for on-duty, 30% for off-duty).
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md group relative cursor-help">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-500">Discount Savings</div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-[#c1902f]">
                      ${(discountSummary.total_discount_amount || 0).toFixed(2)}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition duration-300 absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-800 text-white text-xs rounded w-64 mb-2 shadow-lg">
                      The total amount saved through staff discounts (Original Price - Amount Paid).
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 italic">
                  <span className="font-medium">Note:</span> Hover over each card for more details. Staff discounts are 50% for on-duty staff and 30% for off-duty staff.
                </div>
              </div>

              <div className="bg-white rounded-md shadow-md overflow-hidden">
                <h2 className="text-xl font-semibold p-4 border-b border-gray-200">
                  Breakdown by Staff Member
                </h2>
                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
                  This table shows the discount breakdown for each staff member, including the number of orders and discount amounts for both on-duty (50% discount) and off-duty (30% discount) orders.
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Staff Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          On Duty Orders
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Off Duty Orders
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          On Duty Savings (50%)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Off Duty Savings (30%)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Savings
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {!discountSummary.by_staff_member || discountSummary.by_staff_member.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                            No discount data found for the selected period
                          </td>
                        </tr>
                      ) : (
                        discountSummary.by_staff_member.map((staff) => (
                          <tr key={staff.staff_id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {staff.staff_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{staff.on_duty_count}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{staff.off_duty_count}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                ${(staff.on_duty_discount || 0).toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                ${(staff.off_duty_discount || 0).toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-[#c1902f]">
                                ${(staff.total_discount || 0).toFixed(2)}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
