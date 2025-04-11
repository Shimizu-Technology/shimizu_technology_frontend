// src/ordering/components/admin/StaffManagement.tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/apiClient';
import toastUtils from '../../../shared/utils/toastUtils';
import { StaffReports } from './StaffReports';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';

interface StaffMember {
  id: number;
  name: string;
  position: string;
  user_id: number | null;
  house_account_balance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Transaction {
  id: number;
  staff_member_id: number;
  order_id: number | null;
  amount: number;
  transaction_type: string;
  description: string;
  reference: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

export function StaffManagement() {
  const [activeTab, setActiveTab] = useState<'management' | 'reports'>('management');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);
  const [showTransactions, setShowTransactions] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    user_id: '',
    active: true
  });

  // Transaction form state
  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    transaction_type: 'adjustment',
    description: '',
    reference: '',
    action_type: 'charge' // 'charge' or 'payment'
  });

  // Fetch staff members and users
  useEffect(() => {
    fetchStaffMembers();
    fetchUsers();
  }, []);

  const fetchStaffMembers = async () => {
    setLoading(true);
    setError(null);
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
          setError('Unexpected API response format');
        }
      } else {
        console.error('Invalid response data:', response.data);
        setStaffMembers([]);
        setError('Invalid API response');
      }
    } catch (err: any) {
      console.error('Error fetching staff members:', err);
      setError(err.message || 'Failed to fetch staff members');
      toastUtils.error('Failed to fetch staff members');
      setStaffMembers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for the dropdown
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get users who aren't already assigned to staff members and aren't customers
      // Using exclude_customers=true as a custom parameter that can be implemented on the backend
      const response = await apiClient.get('/users?available_for_staff=true&exclude_role=customer');

      // Ensure response.data is an array or has a users property
      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else if (response.data && typeof response.data === 'object') {
        // If it's an object with users inside
        if (Array.isArray(response.data.users)) {
          setUsers(response.data.users);
        } else {
          console.error('Unexpected users response format:', response.data);
          setUsers([]);
        }
      } else {
        console.error('Invalid users response data:', response.data);
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toastUtils.error('Failed to fetch available users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch transactions for a staff member
  const fetchTransactions = async (staffMemberId: number) => {
    setLoadingTransactions(true);
    try {
      const response = await apiClient.get(`/staff_members/${staffMemberId}/transactions`);

      // Ensure transactions is always an array
      if (Array.isArray(response.data)) {
        setTransactions(response.data);
      } else if (response.data && typeof response.data === 'object' && Array.isArray(response.data.transactions)) {
        // If the API returns an object with a transactions property
        setTransactions(response.data.transactions);
      } else {
        console.error('Unexpected transactions response format:', response.data);
        setTransactions([]);
      }

      setShowTransactions(staffMemberId);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      toastUtils.error('Failed to fetch transactions');
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle transaction form input changes
  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTransactionForm(prev => ({ ...prev, [name]: value }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      position: '',
      user_id: '',
      active: true
    });
    setEditingStaffMember(null);
  };

  // Reset transaction form
  const resetTransactionForm = () => {
    setTransactionForm({
      amount: '',
      transaction_type: 'adjustment',
      description: '',
      reference: '',
      action_type: 'charge' // Default to charge
    });
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        user_id: formData.user_id ? parseInt(formData.user_id) : null
      };

      if (editingStaffMember) {
        // Update existing staff member
        await apiClient.put(`/staff_members/${editingStaffMember.id}`, payload);
        toastUtils.success('Staff member updated successfully');
      } else {
        // Create new staff member
        await apiClient.post('/staff_members', payload);
        toastUtils.success('Staff member created successfully');
      }

      // Refresh staff members list
      fetchStaffMembers();
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Error saving staff member:', err);
      toastUtils.error(err.response?.data?.error || 'Failed to save staff member');
    }
  };

  // Submit transaction form
  const handleTransactionSubmit = async (e: React.FormEvent, staffMemberId: number) => {
    e.preventDefault();

    try {
      // Determine the appropriate transaction type and amount based on action type
      const actionType = transactionForm.action_type;
      let transactionType = 'charge'; // Now using 'charge' which is supported by the backend
      let amount = parseFloat(transactionForm.amount);
      let description = transactionForm.description;
      
      // If this is a payment, use the payment type and make amount negative
      if (actionType === 'payment') {
        transactionType = 'payment';
        // Ensure amount is positive in the UI but sent as negative for payments
        amount = Math.abs(amount) * -1;
        description = description || 'Payment received';
      } else {
        // For charges, ensure amount is positive
        amount = Math.abs(amount);
        description = description || 'Charge added';
      }

      // Nest the transaction data under a 'transaction' key as required by the backend
      // Remove action_type as it's not permitted by the backend
      const { action_type, ...transactionData } = transactionForm;
      const payload = {
        transaction: {
          ...transactionData,
          transaction_type: transactionType,
          description: description,
          amount: amount
        }
      };

      await apiClient.post(`/staff_members/${staffMemberId}/transactions`, payload);
      toastUtils.success('Transaction added successfully');

      // Refresh transactions and staff members list
      fetchTransactions(staffMemberId);
      fetchStaffMembers();
      resetTransactionForm();
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      toastUtils.error(err.response?.data?.error || 'Failed to add transaction');
    }
  };

  // Edit staff member
  const handleEdit = async (staffMember: StaffMember) => {
    setFormData({
      name: staffMember.name,
      position: staffMember.position,
      user_id: staffMember.user_id?.toString() || '',
      active: staffMember.active
    });
    setEditingStaffMember(staffMember);
    setShowAddForm(true);

    // When editing, we need to fetch all available users plus the one already assigned to this staff member
    if (staffMember.user_id) {
      setLoadingUsers(true);
      try {
        // Get available users plus the specific user assigned to this staff member
        const response = await apiClient.get(`/users?available_for_staff=true&exclude_role=customer&include_user_id=${staffMember.user_id}`);
        if (response.data && response.data.users) {
          setUsers(response.data.users);
        } else if (Array.isArray(response.data)) {
          setUsers(response.data);
        }
      } catch (err) {
        console.error('Error fetching users for edit:', err);
        toastUtils.error('Failed to fetch users');
        // Fallback to just getting the specific user
        try {
          const userResponse = await apiClient.get(`/users/${staffMember.user_id}`);
          if (userResponse.data) {
            setUsers([userResponse.data]);
          }
        } catch (innerErr) {
          console.error('Error fetching specific user:', innerErr);
          setUsers([]);
        }
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  // Toggle staff member active status
  const toggleActive = async (staffMember: StaffMember) => {
    try {
      await apiClient.put(`/staff_members/${staffMember.id}`, {
        active: !staffMember.active
      });
      toastUtils.success(`Staff member ${staffMember.active ? 'deactivated' : 'activated'} successfully`);
      fetchStaffMembers();
    } catch (err: any) {
      console.error('Error toggling staff member status:', err);
      toastUtils.error('Failed to update staff member status');
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
        {activeTab === 'management' && (
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#a67b28] transition-colors"
          >
            {showAddForm ? 'Cancel' : 'Add Staff Member'}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('management')}
            className={`py-2 px-4 font-medium ${
              activeTab === 'management'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Staff Members
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-4 font-medium ${
              activeTab === 'reports'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Reports
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'management' ? (
        <div>
          {/* Add/Edit Form */}
          {showAddForm && (
        <div className="bg-white p-4 rounded-md shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingStaffMember ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link to User (Optional)
                </label>
                <MobileSelect
                  options={[
                    { value: '', label: 'Select a user (optional)' },
                    ...users.map(user => ({
                      value: user.id.toString(),
                      label: `${user.first_name || ''} ${user.last_name || ''}${user.email ? ` (${user.email})` : ''}${user.role ? ` - ${user.role}` : ''}`
                    }))
                  ]}
                  value={formData.user_id}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, user_id: value }));
                  }}
                  placeholder="Select a user (optional)"
                />
                {loadingUsers && <p className="text-sm text-gray-500 mt-1">Loading users...</p>}
                {users.length === 0 && !loadingUsers && (
                  <p className="text-sm text-gray-500 mt-1">
                    {editingStaffMember?.user_id ?
                      "No available users found. The current user assignment will be maintained." :
                      "No available users found. All users may already be assigned to staff members."}
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <div className="relative flex items-center group">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 flex items-center">
                    Active
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 w-64 z-10">
                      Only active staff members can receive discounts (50% on-duty, 30% off-duty), appear in staff selection dropdowns, and use their house accounts.
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#a67b28] transition-colors"
              >
                {editingStaffMember ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
          )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
          )}

          {/* Staff Members List */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#c1902f]"></div>
            </div>
          ) : (
            <div className="bg-white rounded-md shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        House Account Balance
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
                    {!Array.isArray(staffMembers) || staffMembers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No staff members found
                        </td>
                      </tr>
                    ) : (
                      staffMembers.map(staffMember => (
                        <tr key={staffMember.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{staffMember.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{staffMember.position}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${staffMember.house_account_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ${Math.abs(staffMember.house_account_balance).toFixed(2)}
                              {staffMember.house_account_balance > 0 ? ' (owed)' : staffMember.house_account_balance < 0 ? ' (credit)' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              staffMember.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {staffMember.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleEdit(staffMember)}
                              className="text-indigo-600 hover:text-indigo-900 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleActive(staffMember)}
                              className={`${
                                staffMember.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                              } mr-3`}
                            >
                              {staffMember.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                if (showTransactions === staffMember.id) {
                                  setShowTransactions(null);
                                } else {
                                  fetchTransactions(staffMember.id);
                                }
                              }}
                              className="text-[#c1902f] hover:text-[#a67b28]"
                            >
                              {showTransactions === staffMember.id ? 'Hide Transactions' : 'View Transactions'}
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
        </div>
      ) : (
        <StaffReports />
      )}

      {/* Transactions Section */}
      {showTransactions !== null && (
        <div className="mt-8 bg-white rounded-md shadow-md p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Transactions for {staffMembers.find(sm => sm.id === showTransactions)?.name}
            </h2>
            <button
              onClick={() => setShowTransactions(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          {/* Add Transaction Form */}
          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <h3 className="text-lg font-medium mb-3">Add Transaction</h3>
            <form onSubmit={(e) => handleTransactionSubmit(e, showTransactions)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Type
                  </label>
                  <div className="flex space-x-4 mb-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="action_type"
                        value="charge"
                        checked={transactionForm.action_type === 'charge'}
                        onChange={handleTransactionInputChange}
                        className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Add Charge</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="action_type"
                        value="payment"
                        checked={transactionForm.action_type === 'payment'}
                        onChange={handleTransactionInputChange}
                        className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Receive Payment</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={transactionForm.amount}
                    onChange={handleTransactionInputChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                    required
                    placeholder={transactionForm.action_type === 'payment' ? "Payment amount" : "Charge amount"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {transactionForm.action_type === 'payment' 
                      ? "Amount to be paid toward the account" 
                      : "Amount to be charged to the account"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={transactionForm.reference}
                    onChange={handleTransactionInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                    placeholder="e.g., Payroll 04/15/2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={transactionForm.description}
                    onChange={handleTransactionInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#c1902f]"
                    rows={1}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={resetTransactionForm}
                  className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#a67b28] transition-colors"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>

          {/* Transactions List */}
          {loadingTransactions ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#c1902f]"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    Array.isArray(transactions) && transactions.length > 0 ? (
                      transactions.map(transaction => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              transaction.transaction_type === 'order' ? 'bg-blue-100 text-blue-800' :
                              transaction.transaction_type === 'payment' ? 'bg-green-100 text-green-800' :
                              transaction.transaction_type === 'payroll' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${transaction.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ${Math.abs(transaction.amount).toFixed(2)}
                              {transaction.amount > 0 ? ' (charge)' : ' (payment)'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{transaction.description}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{transaction.reference}</div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No transactions found for this staff member.
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
