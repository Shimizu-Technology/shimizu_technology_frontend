# Staff Discount and House Account System

This document provides an overview of the frontend implementation of the Staff Discount and House Account system in Hafaloha.

## Overview

The Staff Discount and House Account system enables restaurant staff to:
- Create orders with automatic discounts (50% for on-duty staff, 30% for off-duty staff)
- Charge purchases to house accounts for later payroll deduction
- Track house account balances and transaction history
- Generate reports on staff discount usage

## Components

### StaffOrderModal

The `StaffOrderModal` component extends the standard order creation modal with staff-specific functionality:

- Toggle for enabling staff order mode
- Staff member selection dropdown
- Duty status toggle (on/off duty)
- House account payment option
- Automatic discount calculation
- Display of pre-discount and post-discount totals

```tsx
// src/ordering/components/admin/StaffOrderModal.tsx

// Staff order state
const [isStaffOrder, setIsStaffOrder] = useState(false);
const [staffMemberId, setStaffMemberId] = useState<number | null>(null);
const [staffOnDuty, setStaffOnDuty] = useState(false);
const [useHouseAccount, setUseHouseAccount] = useState(false);
const [createdByStaffId, setCreatedByStaffId] = useState<number | null>(null);
const [preDiscountTotal, setPreDiscountTotal] = useState(0);

// Calculate discounted total for staff orders
const orderTotal = useMemo(() => {
  if (isStaffOrder && staffMemberId) {
    // Apply staff discount based on duty status
    if (staffOnDuty) {
      // 50% discount for on-duty staff
      return rawTotal * 0.5;
    } else {
      // 30% discount for off-duty staff
      return rawTotal * 0.7;
    }
  }
  // No discount for regular orders
  return rawTotal;
}, [rawTotal, isStaffOrder, staffMemberId, staffOnDuty]);
```

### StaffOrderOptions

The `StaffOrderOptions` component provides the UI for selecting staff order parameters:

```tsx
// src/ordering/components/admin/StaffOrderOptions.tsx
export function StaffOrderOptions({
  isStaffOrder,
  staffMemberId,
  setStaffMemberId,
  staffOnDuty,
  setStaffOnDuty,
  useHouseAccount,
  setUseHouseAccount,
  setCreatedByStaffId
}: StaffOrderOptionsProps) {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const currentUser = useAuthStore(state => state.user);

  // Fetch staff members when component mounts
  useEffect(() => {
    if (isStaffOrder) {
      fetchStaffMembers();
    }
  }, [isStaffOrder]);

  // Staff member selection, duty status toggle, and house account option
  return (
    <div>
      {isStaffOrder && (
        <>
          {/* Staff Member Selection */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Staff Member
            </label>
            <MobileSelect
              options={staffMembers.map(staff => ({
                value: staff.id.toString(),
                label: `${staff.name} - ${staff.position}`
              }))}
              value={staffMemberId ? staffMemberId.toString() : ''}
              onChange={(value) => setStaffMemberId(value ? parseInt(value) : null)}
              placeholder="Select Staff Member"
            />
          </div>

          {/* Duty status and house account options */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="flex items-center">
              <input
                id="staff-on-duty"
                type="checkbox"
                checked={staffOnDuty}
                onChange={(e) => setStaffOnDuty(e.target.checked)}
              />
              <label htmlFor="staff-on-duty" className="ml-1 text-xs font-medium text-gray-900">
                On duty (50% off)
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="use-house-account"
                type="checkbox"
                checked={useHouseAccount}
                onChange={(e) => setUseHouseAccount(e.target.checked)}
                disabled={!selectedStaffMember}
              />
              <label htmlFor="use-house-account" className="ml-1 text-xs font-medium text-gray-900">
                Use House Account
              </label>
            </div>
          </div>

          {/* Display house account balance */}
          {selectedStaffMember && (
            <div className="text-xs text-gray-600 mb-2">
              Balance: ${selectedStaffMember.house_account_balance.toFixed(2)}
              {selectedStaffMember.house_account_balance > 0 && (
                <span className="text-yellow-600"> (deducted on payday)</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### OrderStore Integration

The Order Store has been extended to handle staff order parameters:

```typescript
// src/ordering/store/orderStore.ts
addOrder: async (
  items,
  total,
  specialInstructions,
  contactName,
  contactPhone,
  contactEmail,
  transactionId,
  paymentMethod = 'credit_card',
  vipCode,
  staffModal = false,
  paymentDetails = null
) => {
  // Extract staffOrderParams from paymentDetails if present
  const staffOrderParams = paymentDetails?.staffOrderParams || {};
  
  const payload = {
    order: {
      items: foodItems,
      merchandise_items: merchandiseItems,
      total,
      special_instructions: specialInstructions,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      transaction_id: transactionId,
      payment_method: paymentMethod,
      vip_code: vipCode,
      staff_modal: staffModal,
      payment_details: paymentDetails,
      // Include staff order parameters
      ...staffOrderParams
    },
  };
  
  // API call to create order
  const newOrder = await api.post<Order>('/orders', payload);
  
  return newOrder;
}
```

## Staff Management Interface

The admin dashboard includes a Staff Management interface for:

- Creating and editing staff member records
- Viewing house account balances
- Processing house account payments
- Viewing staff order history
- Generating staff discount reports

## Order Display

When viewing orders in the admin dashboard, staff orders are clearly marked with:

- Staff member name
- Duty status (on/off duty)
- Pre-discount total
- Discount amount
- Payment method (immediate or house account)

## Reports

The reporting section of the admin dashboard includes several staff-related reports:

### House Account Balance Report

Shows current balance for each staff member, with options to mark as paid for payroll processing.

### Staff Order History Report

Detailed list of all staff orders with filtering by date range and staff member, showing pre-discount total, discount amount, and final total.

### Discount Summary Report

Summarizes the total retail value of staff orders, total discounted value, and discount amount, with breakdown by staff member and duty status.

### House Account Activity Report

Shows all charges and payments for a staff member with running balance and ability to add manual adjustments.

## Authorization

The Staff Discount and House Account system integrates with Hafaloha's role-based access control system:

- **Admin users** can create and manage staff members, view all reports, and process house account payments
- **Staff users** can create staff orders but cannot manage staff members or process payments
- **Customer users** have no access to staff discount or house account features

## TypeScript Interfaces

```typescript
// Staff Member interface
interface StaffMember {
  id: number;
  name: string;
  position: string;
  house_account_balance: number;
  active: boolean;
  user_id?: number;
}

// House Account Transaction interface
interface HouseAccountTransaction {
  id: number;
  staff_member_id: number;
  order_id?: number;
  amount: number;
  transaction_type: 'order' | 'payment' | 'adjustment' | 'charge';
  description: string;
  reference?: string;
  created_by_id?: number;
  created_at: string;
  updated_at: string;
  
  // Computed properties from API
  staff_member_name?: string;
  order_number?: number;
  created_by_name?: string;
  created_at_formatted?: string;
  amount_formatted?: string;
  transaction_type_formatted?: string;
}

// Staff Order Parameters
interface StaffOrderParams {
  is_staff_order: boolean;
  staff_member_id?: number;
  staff_on_duty?: boolean;
  use_house_account?: boolean;
  created_by_staff_id?: number;
  pre_discount_total?: number;
}
```

## Best Practices

1. **Staff Order Creation**:
   - Always use the `StaffOrderOptions` component for consistent staff order creation
   - Verify staff member identity before creating orders on their behalf
   - Double-check duty status to ensure correct discount is applied

2. **House Account Usage**:
   - Inform staff members when charging to their house account
   - Provide clear receipt or confirmation of house account charges
   - Regularly review house account balances with staff

3. **Reporting**:
   - Generate and review staff discount reports regularly
   - Process house account payments in a timely manner
   - Document any manual adjustments with clear descriptions

## Troubleshooting

### Common Issues

1. **Staff Discount Not Applied**:
   - Ensure `isStaffOrder` is set to true
   - Verify a valid staff member is selected
   - Check that staff discount parameters are properly passed to the API

2. **House Account Not Charged**:
   - Confirm `useHouseAccount` is checked
   - Verify the staff member exists and is active
   - Check that the order was successfully created

3. **Staff Member Not Found**:
   - Ensure the staff member API endpoint is correctly configured
   - Verify the staff member is active in the system
   - Check network requests for API errors

4. **Incorrect Discount Amount**:
   - Verify the duty status is correctly set
   - Check the calculation in the `orderTotal` useMemo
   - Confirm the backend is applying the correct discount rate
