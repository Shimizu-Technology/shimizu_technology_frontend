import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/apiClient';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';
import { useAuthStore } from '../../../shared/auth';

interface StaffMember {
  id: number;
  name: string;
  position: string;
  house_account_balance: number;
  active: boolean;
}

interface StaffOrderOptionsProps {
  isStaffOrder: boolean;
  setIsStaffOrder: (value: boolean) => void;
  staffMemberId: number | null;
  setStaffMemberId: (value: number | null) => void;
  staffOnDuty: boolean;
  setStaffOnDuty: (value: boolean) => void;
  useHouseAccount: boolean;
  setUseHouseAccount: (value: boolean) => void;
  createdByStaffId: number | null;
  setCreatedByStaffId: (value: number | null) => void;
}

export function StaffOrderOptions({
  isStaffOrder,
  // setIsStaffOrder is unused but kept in props for compatibility
  staffMemberId,
  setStaffMemberId,
  staffOnDuty,
  setStaffOnDuty,
  useHouseAccount,
  setUseHouseAccount,
  // createdByStaffId is unused but kept in props for compatibility
  setCreatedByStaffId
}: StaffOrderOptionsProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useAuthStore(state => state.user);

  // Fetch staff members when component mounts
  useEffect(() => {
    if (isStaffOrder) {
      fetchStaffMembers();
    }
  }, [isStaffOrder]);

  const fetchStaffMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/staff_members?active=true');
      // Ensure response.data is an array
      if (Array.isArray(response.data)) {
        setStaffMembers(response.data);
      } else if (response.data && typeof response.data === 'object') {
        // If it's an object with staff members inside
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
      setError(err.message || 'Failed to load staff members');
      console.error('Error fetching staff members:', err);
      setStaffMembers([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset staff order options when isStaffOrder is toggled off
  useEffect(() => {
    if (!isStaffOrder) {
      setStaffMemberId(null);
      setStaffOnDuty(false);
      setUseHouseAccount(false);
      setCreatedByStaffId(null);
    }
  }, [isStaffOrder, setStaffMemberId, setStaffOnDuty, setUseHouseAccount, setCreatedByStaffId]);

  // Get the selected staff member
  const selectedStaffMember = staffMemberId 
    ? staffMembers.find(staff => staff.id === staffMemberId) 
    : null;
    
  // House account should be available regardless of balance
  // since it's a credit system that gets deducted from paychecks
  const canUseHouseAccount = !!selectedStaffMember;

  return (
    <div>
      {/* Staff Order checkbox is now moved to the OrderPanel component */}

      {isStaffOrder && (
        <>
          {/* Staff Member Selection */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Staff Member
            </label>
            <MobileSelect
              options={Array.isArray(staffMembers) && staffMembers.length > 0 
                ? staffMembers.map(staff => ({
                    value: staff.id.toString(),
                    label: `${staff.name} - ${staff.position}`
                  }))
                : [{ value: '', label: 'No staff members available' }]
              }
              value={staffMemberId ? staffMemberId.toString() : ''}
              onChange={(value) => setStaffMemberId(value ? parseInt(value) : null)}
              placeholder="Select Staff Member"
              className="text-xs"
            />
            {loading && <p className="text-xs text-gray-500 mt-1">Loading...</p>}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Two-column layout for checkboxes */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Staff On Duty */}
            <div className="flex items-center">
              <input
                id="staff-on-duty"
                type="checkbox"
                checked={staffOnDuty}
                onChange={(e) => setStaffOnDuty(e.target.checked)}
                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="staff-on-duty" className="ml-1 text-xs font-medium text-gray-900">
                On duty (50% off)
              </label>
            </div>

            {/* Use House Account */}
            <div className="flex items-center">
              <input
                id="use-house-account"
                type="checkbox"
                checked={useHouseAccount}
                onChange={(e) => setUseHouseAccount(e.target.checked)}
                disabled={!canUseHouseAccount}
                className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <label 
                htmlFor="use-house-account" 
                className={`ml-1 text-xs font-medium ${canUseHouseAccount ? 'text-gray-900' : 'text-gray-400'}`}
              >
                Use House Account
              </label>
            </div>
          </div>

          {selectedStaffMember && (
            <div className="text-xs text-gray-600 mb-2">
              Balance: ${selectedStaffMember.house_account_balance.toFixed(2)}
              {selectedStaffMember.house_account_balance > 0 && (
                <span className="text-yellow-600"> (deducted on payday)</span>
              )}
            </div>
          )}

          {/* Created By Staff */}
          <div className="mb-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Order Created By
            </label>
            <div className="flex items-center px-2 py-1 bg-gray-100 border border-gray-300 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-gray-700">
                {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Current User'}
              </span>
              {/* Note: This staff member's ID will be used as createdByStaffId */}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
