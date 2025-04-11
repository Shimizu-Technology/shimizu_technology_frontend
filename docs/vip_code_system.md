# VIP Code System - Frontend Implementation

This document provides detailed information about the frontend implementation of the VIP Code System in Hafaloha.

## Overview

The VIP Code System frontend provides a comprehensive interface for restaurant administrators to:

1. Generate and manage VIP access codes
2. Send VIP codes to customers via email
3. Track code usage and analytics
4. Toggle VIP-only mode for the restaurant
5. Allow customers to enter VIP codes during checkout

## Component Architecture

The VIP Code System is implemented through several React components:

### 1. VipCodesManager

The main component for managing VIP codes (`src/ordering/components/admin/settings/VipCodesManager.tsx`).

**Key Features:**
- Generate individual or group VIP codes
- View, filter, and search existing codes
- Edit code properties (name, usage limits, active status)
- Archive/unarchive codes
- Bulk actions for multiple codes
- Copy codes to clipboard
- View code usage analytics
- Send codes via email

**State Management:**
```typescript
// Main state variables
const [allVipCodes, setAllVipCodes] = useState<VipAccessCode[]>([]);
const [codeType, setCodeType] = useState<'individual' | 'group'>('individual');
const [formData, setFormData] = useState({
  count: 10,
  name: '',
  prefix: 'VIP',
  maxUses: '',
  limitedUses: false,
});
const [searchTerm, setSearchTerm] = useState('');
const [sortField, setSortField] = useState<'created_at' | 'name' | 'code' | 'current_uses'>('created_at');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
```

**Data Fetching:**
```typescript
// Function to fetch all VIP codes
const fetchVipCodes = async (showLoadingIndicator = true) => {
  if (!restaurant?.id) return;
  
  if (showLoadingIndicator) {
    setFetchingCodes(true);
  }
  
  try {
    const codes = await getVipCodes(undefined, { include_archived: true });
    setAllVipCodes(codes as VipAccessCode[]);
  } catch (error) {
    console.error('Error fetching VIP codes:', error);
    toast.error('Failed to load VIP codes');
  } finally {
    if (showLoadingIndicator) {
      setFetchingCodes(false);
    }
  }
};

// Function to silently refresh VIP codes without showing loading indicators
const refreshVipCodesSilently = async () => {
  await fetchVipCodes(false);
};
```

**Code Generation:**
```typescript
const handleGenerateCodes = async () => {
  if (!restaurant) return;
  
  setLoading(true);
  try {
    let newCodes;
    
    if (codeType === 'individual') {
      // Generate individual codes
      const params = {
        count: parseInt(formData.count.toString()),
        name: formData.name || 'Individual VIP',
        prefix: formData.prefix || undefined,
        max_uses: formData.limitedUses && formData.maxUses ? parseInt(formData.maxUses) : null,
      };
      
      newCodes = await generateIndividualCodes(params) as VipAccessCode[];
    } else {
      // Generate group code
      const params = {
        name: formData.name || 'Group VIP',
        prefix: formData.prefix || undefined,
        max_uses: formData.limitedUses && formData.maxUses ? parseInt(formData.maxUses) : null,
      };
      
      const groupCode = await generateGroupCode(params) as VipAccessCode;
      newCodes = [groupCode]; // Wrap single code in array for consistent handling
    }
    
    toast.success(`Generated ${codeType === 'individual' ? formData.count : 1} VIP code(s)`);
    
    // Refresh the codes list silently to ensure we have the latest data without showing loading indicators
    await refreshVipCodesSilently();
  } catch (error) {
    console.error('Error generating VIP codes:', error);
    toast.error('Failed to generate VIP codes');
  } finally {
    setLoading(false);
  }
};
```

### 2. VipCodeEmailModal

Modal component for sending VIP codes via email (`src/ordering/components/admin/settings/VipCodeEmailModal.tsx`).

**Key Features:**
- Send existing VIP codes to specified email addresses
- Generate new codes for each recipient
- Support for bulk sending to multiple recipients
- Batch processing for large email lists
- Custom email subject and message
- Preview of email content
- Tracking of recipient information for each code

**Props Interface:**
```typescript
interface VipCodeEmailModalProps {
  selectedCode: VipAccessCode | null;
  onClose: () => void;
  onCodesUpdated: () => void;
}
```

**Email Sending:**
```typescript
const handleSendEmails = async () => {
  if (!emailList.length) {
    toast.error('Please add at least one email address');
    return;
  }
  
  setSending(true);
  try {
    let response;
    
    if (generateNewCodes) {
      // Generate new codes for each recipient
      response = await sendVipCodesWithNewCodes({
        email_list: emailList,
        name: formData.name || 'VIP Code',
        prefix: formData.prefix || undefined,
        max_uses: formData.limitedUses ? parseInt(formData.maxUses) : null,
        subject: formData.subject,
        message: formData.message,
        batch_size: 50 // Process in batches of 50
      });
    } else if (selectedCode) {
      // Send the selected code to all recipients
      response = await sendVipCodes({
        email_list: emailList,
        code_ids: [selectedCode.id],
        subject: formData.subject,
        message: formData.message,
        batch_size: 50 // Process in batches of 50
      });
    } else if (selectedCodes.length) {
      // Send selected codes to recipients
      response = await sendVipCodes({
        email_list: emailList,
        code_ids: selectedCodes,
        subject: formData.subject,
        message: formData.message,
        batch_size: 50 // Process in batches of 50
      });
    } else {
      toast.error('No VIP codes selected');
      setSending(false);
      return;
    }
    
    toast.success(`VIP codes queued for sending to ${emailList.length} recipient(s)`);
    
    // Notify parent component that codes have been updated
    onCodesUpdated();
    onClose();
  } catch (error) {
    console.error('Error sending VIP codes:', error);
    toast.error('Failed to send VIP codes');
  } finally {
    setSending(false);
  }
};
```

### 3. VipCodeUsageModal

Modal component for viewing VIP code usage analytics (`src/ordering/components/admin/settings/VipCodeUsageModal.tsx`).

**Key Features:**
- Detailed usage statistics for a specific VIP code
- List of recipients who received the code
- Usage history with timestamps
- Associated order information
- Usage trends visualization

**Props Interface:**
```typescript
interface VipCodeUsageModalProps {
  codeId: number;
  onClose: () => void;
}
```

**Data Structure:**
```typescript
interface Recipient {
  email: string;
  sent_at: string;
}

interface CodeUsageData {
  code: {
    id: number;
    code: string;
    name: string;
    max_uses: number | null;
    current_uses: number;
    expires_at: string | null;
    is_active: boolean;
    group_id?: string;
    archived?: boolean;
  };
  usage_count: number;
  recipients: Recipient[];
  orders: Order[];
}
```

**Usage Data Fetching:**
```typescript
const fetchCodeUsage = async () => {
  setLoading(true);
  try {
    const usageData = await getVipCodeUsage(codeId);
    setUsageData(usageData);
    
    // Also fetch the code details
    const codeDetails = await getVipCode(codeId);
    setCodeDetails(codeDetails);
  } catch (error) {
    console.error('Error fetching VIP code usage:', error);
    toast.error('Failed to load VIP code usage data');
  } finally {
    setLoading(false);
  }
};
```

### 4. VipEventSettings

Component for managing VIP mode settings (`src/ordering/components/admin/settings/VipEventSettings.tsx`).

**Key Features:**
- Toggle VIP-only mode for the restaurant
- Configure VIP mode settings
- Set custom messages for non-VIP users

**State Management:**
```typescript
const [vipModeEnabled, setVipModeEnabled] = useState(false);
const [vipSettings, setVipSettings] = useState({
  message: 'This restaurant is currently only accepting orders from VIP customers. Please enter your VIP code to continue.',
  redirect_url: '',
});
```

**Settings Update:**
```typescript
const handleSaveSettings = async () => {
  setSaving(true);
  try {
    await updateVipSettings({
      vip_mode_enabled: vipModeEnabled,
      vip_mode_message: vipSettings.message,
      vip_mode_redirect_url: vipSettings.redirect_url,
    });
    
    toast.success('VIP settings updated successfully');
  } catch (error) {
    console.error('Error updating VIP settings:', error);
    toast.error('Failed to update VIP settings');
  } finally {
    setSaving(false);
  }
};
```

### 5. VipModeToggle

Simple toggle component for quickly enabling/disabling VIP mode (`src/ordering/components/admin/settings/VipModeToggle.tsx`).

**Key Features:**
- Quick toggle for VIP-only mode
- Visual indicator of current status
- Confirmation dialog for mode changes

**Props Interface:**
```typescript
interface VipModeToggleProps {
  isEnabled: boolean;
  onChange: (enabled: boolean) => void;
  loading?: boolean;
}
```

### 6. VipCodeInput

Component for customers to enter VIP codes during checkout (`src/ordering/components/VipCodeInput.tsx`).

**Key Features:**
- Input field for VIP code entry
- Validation of entered codes
- Success/error feedback
- Integration with checkout flow

**Code Validation:**
```typescript
const handleValidateCode = async () => {
  if (!code.trim()) {
    setError('Please enter a VIP code');
    return;
  }
  
  setValidating(true);
  try {
    const response = await validateVipCode(code.trim());
    
    if (response.valid) {
      setValidCode(response.code);
      setError('');
      onCodeValidated(response.code);
      toast.success('VIP code validated successfully');
    } else {
      setValidCode(null);
      setError(response.message || 'Invalid VIP code');
      onCodeValidated(null);
    }
  } catch (error) {
    console.error('Error validating VIP code:', error);
    setValidCode(null);
    setError('Failed to validate VIP code');
    onCodeValidated(null);
  } finally {
    setValidating(false);
  }
};
```

## API Integration

The VIP Code System frontend integrates with the backend through several API endpoints defined in `src/shared/api/endpoints/vipCodes.ts`:

### 1. Code Management

```typescript
// Get all VIP codes
export const getVipCodes = async (restaurantId?: number, options?: { include_archived?: boolean }) => {
  const params = new URLSearchParams();
  if (options?.include_archived) {
    params.append('include_archived', 'true');
  }
  
  const url = `/vip/codes${params.toString() ? `?${params.toString()}` : ''}`;
  return api.get(url, { restaurant_id: restaurantId });
};

// Generate individual VIP codes
export const generateIndividualCodes = async (params: {
  count: number;
  name: string;
  prefix?: string;
  max_uses?: number | null;
}) => {
  return api.post('/vip/codes/individual', params);
};

// Generate a group VIP code
export const generateGroupCode = async (params: {
  name: string;
  prefix?: string;
  max_uses?: number | null;
}) => {
  return api.post('/vip/codes/group', params);
};
```

### 2. Code Operations

```typescript
// Update a VIP code
export const updateVipCode = async (id: number, data: {
  name?: string;
  max_uses?: number | null;
  is_active?: boolean;
}) => {
  return api.patch(`/vip/codes/${id}`, data);
};

// Deactivate a VIP code
export const deactivateVipCode = async (id: number) => {
  return api.post(`/vip/codes/${id}/deactivate`);
};

// Reactivate a VIP code
export const reactivateVipCode = async (id: number) => {
  return api.post(`/vip/codes/${id}/reactivate`);
};

// Archive a VIP code
export const archiveVipCode = async (id: number) => {
  return api.post(`/vip/codes/${id}/archive`);
};

// Unarchive a VIP code
export const unarchiveVipCode = async (id: number) => {
  return api.post(`/vip/codes/${id}/unarchive`);
};

// Get code usage data including recipient information
export const getCodeUsage = async (id: number) => {
  return api.get(`/vip/codes/${id}/usage`);
};
```

### 3. Email Functionality

```typescript
// Send existing VIP codes via email
export const sendVipCodes = async (params: {
  email_list: string[];
  code_ids: number[];
  subject?: string;
  message?: string;
  batch_size?: number;
}) => {
  return api.post('/vip/codes/send', params);
};

// Generate and send new VIP codes via email
export const sendVipCodesWithNewCodes = async (params: {
  email_list: string[];
  name: string;
  prefix?: string;
  max_uses?: number | null;
  subject?: string;
  message?: string;
  batch_size?: number;
}) => {
  return api.post('/vip/codes/bulk_send', params);
};
```

### 4. Customer-Facing Functionality

```typescript
// Validate a VIP code (without using it)
export const validateVipCode = async (code: string) => {
  return api.post('/vip/validate', { code });
};

// Use a VIP code
export const useVipCode = async (code: string, orderId?: number) => {
  const params: any = { code };
  if (orderId) {
    params.order_id = orderId;
  }
  return api.post('/vip/use', params);
};
```

## Recipient Tracking

The VIP Code System now includes recipient tracking functionality, which allows administrators to see which email addresses received which VIP codes. This is implemented through:

1. A new `vip_code_recipients` table in the database that stores the relationship between VIP codes and recipient email addresses
2. Updated email sending functionality that records recipient information when sending codes
3. Enhanced VIP code usage modal that displays recipient information

### Recipient Data Structure

```typescript
interface Recipient {
  email: string;
  sent_at: string;
}
```

### Recipient Display in VipCodeUsageModal

```tsx
{/* Recipients Section */}
<div className="mb-6">
  <h3 className="font-semibold text-lg mb-2">Recipients ({usageData.recipients?.length || 0})</h3>
  {!usageData.recipients || usageData.recipients.length === 0 ? (
    <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
      <p>No recipient information available for this VIP code.</p>
    </div>
  ) : (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {usageData.recipients.map((recipient, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 whitespace-nowrap">{recipient.email}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(recipient.sent_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
```

## Performance Optimizations

The VIP Code System includes several performance optimizations:

### 1. Silent Data Refreshing

The system implements a silent refresh mechanism that updates data without triggering loading indicators:

```typescript
// Function to silently refresh VIP codes without showing loading indicators
const refreshVipCodesSilently = async () => {
  await fetchVipCodes(false);
};
```

This prevents UI "shake" when refreshing data after operations like generating codes or sending emails.

### 2. Efficient Filtering and Sorting

Filtering and sorting operations are performed client-side using memoization to prevent unnecessary re-renders:

```typescript
// Filter by archived status, search term, and sort
const filteredAndSortedCodes = useMemo(() => {
  // First filter by archived status
  let filtered = allVipCodes;
  if (!showArchived) {
    filtered = filtered.filter(code => !code.archived);
  }
  
  // Then filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(code => 
      code.name.toLowerCase().includes(term) || 
      code.code.toLowerCase().includes(term)
    );
  }
  
  // Then sort
  return [...filtered].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'code':
        comparison = a.code.localeCompare(b.code);
        break;
      case 'current_uses':
        comparison = a.current_uses - b.current_uses;
        break;
      case 'created_at':
      default:
        comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}, [allVipCodes, showArchived, searchTerm, sortField, sortDirection]);
```

### 3. Batch Processing for Email Sending

When sending VIP codes to a large number of recipients, the system uses batch processing to prevent overwhelming the server:

```typescript
// Send VIP codes in batches
export const sendVipCodes = async (params: {
  email_list: string[];
  code_ids: number[];
  subject?: string;
  message?: string;
  batch_size?: number; // Default is 50
}) => {
  return api.post('/vip/codes/send', params);
};
```

The backend processes these batches asynchronously using background jobs.

### 4. Optimistic UI Updates

After operations like deactivating or archiving a code, the UI is updated optimistically before the server response:

```typescript
// Update the local state optimistically
setAllVipCodes(prev => 
  prev.map(code => 
    code.id === id ? { ...code, is_active: false } : code
  )
);
```

This provides immediate feedback to the user while the server operation completes in the background.

## User Experience Considerations

### 1. Loading States

The system implements various loading states to provide feedback during operations:

```typescript
// Global loading state for major operations
const [loading, setLoading] = useState(false);

// Specific loading state for fetching codes
const [fetchingCodes, setFetchingCodes] = useState(false);

// Loading state for bulk actions
const [bulkActionLoading, setBulkActionLoading] = useState(false);
```

These states are used to display appropriate loading indicators and disable buttons during operations.

### 2. Toast Notifications

The system uses toast notifications to provide feedback on operation results:

```typescript
// Success notification
toast.success(`Generated ${codeType === 'individual' ? formData.count : 1} VIP code(s)`);

// Error notification
toast.error('Failed to generate VIP codes');
```

### 3. Confirmation Dialogs

Important operations like deactivating or archiving codes require confirmation:

```typescript
// Confirmation dialog before deactivating a code
if (!confirm('Are you sure you want to deactivate this VIP code?')) return;
```

### 4. Clipboard Integration

The system integrates with the clipboard API to allow copying codes:

```typescript
const copyToClipboard = (code: string, id: number) => {
  navigator.clipboard.writeText(code);
  setCopiedCode(id);
  toast.success('Code copied to clipboard');
  
  // Reset the copied state after 2 seconds
  setTimeout(() => {
    setCopiedCode(null);
  }, 2000);
};
```

### 5. Mobile Responsiveness

All components are designed to be responsive and work well on mobile devices:

```tsx
// Responsive grid layout
<div className="grid md:grid-cols-2 gap-4">
  {/* Form fields */}
</div>

// Responsive table with horizontal scrolling
<div className="overflow-x-auto -mx-6 px-6">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

## Integration with Checkout Flow

The VIP Code System integrates with the checkout flow through the `VipCodeInput` component:

1. When VIP mode is enabled, customers must enter a valid VIP code to proceed with checkout
2. The entered code is validated using the `/vip/validate` endpoint
3. If valid, the code is associated with the order
4. When the order is confirmed, the code usage is incremented using the `/vip/use` endpoint

```tsx
// In CheckoutPage.tsx
const [vipCode, setVipCode] = useState<VipCode | null>(null);

const handleVipCodeValidated = (code: VipCode | null) => {
  setVipCode(code);
  if (code) {
    // Update order data with VIP code
    setOrderData(prev => ({
      ...prev,
      vip_code: code.code
    }));
  } else {
    // Remove VIP code from order data
    setOrderData(prev => {
      const newData = { ...prev };
      delete newData.vip_code;
      return newData;
    });
  }
};

// Render VIP code input if VIP mode is enabled
{siteSettings?.vip_mode_enabled && (
  <VipCodeInput
    onCodeValidated={handleVipCodeValidated}
    validCode={vipCode}
  />
)}
```

## Conclusion

The VIP Code System frontend provides a comprehensive and user-friendly interface for managing VIP access codes. It integrates seamlessly with the backend API and provides a smooth user experience for both administrators and customers. The new recipient tracking functionality enhances the system by allowing administrators to see which email addresses received which VIP codes, making it easier to manage and track VIP code distribution.

For more information about the backend implementation, see the [VIP Code System Backend Documentation](../hafaloha_api/docs/vip_code_system.md).
