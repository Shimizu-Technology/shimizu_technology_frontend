// src/ordering/components/admin/OrderManager.tsx

import { useEffect, useState, useCallback, useRef } from 'react';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../../shared/auth';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';
import websocketService from '../../../shared/services/websocketService';
import { AdminEditOrderModal } from './AdminEditOrderModal';
import { SetEtaModal } from './SetEtaModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { SearchInput } from './SearchInput';
import { DateFilter, DateFilterOption } from './DateFilter';
import { CollapsibleOrderCard } from './CollapsibleOrderCard';
import { MultiSelectActionBar } from './MultiSelectActionBar';
import { StaffOrderModal } from './StaffOrderModal';
import { BulkInventoryActionDialog } from './BulkInventoryActionDialog';
import { RefundModal } from './RefundModal';
import { menuItemsApi } from '../../../shared/api/endpoints/menuItems';
import { orderPaymentsApi } from '../../../shared/api/endpoints/orderPayments';
import { orderPaymentOperationsApi } from '../../../shared/api/endpoints/orderPaymentOperations';
import { api } from '../../../shared/api';
import toastUtils from '../../../shared/utils/toastUtils';

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'confirmed' | 'refunded';

interface OrderManagerProps {
  selectedOrderId?: number | null;
  setSelectedOrderId?: (id: number | null) => void;
  restaurantId?: string;
}

export function OrderManager({ selectedOrderId, setSelectedOrderId, restaurantId }: OrderManagerProps) {
  // Get user role from auth store
  const { isSuperAdmin, isAdmin, isStaff, user } = useAuthStore();
  
  const {
    orders,
    fetchOrders,
    fetchOrdersQuietly,    // For background polling
    // updateOrderStatus, // Not used with server-side pagination
    updateOrderStatusQuietly,
    updateOrderData,
    loading,
    error
  } = useOrderStore();

  // which order is selected for the "details" modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // which "tab" we are viewing
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('pending');

  // sort direction (true = newest first, false = oldest first)
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  
  // search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // date filter - default to today
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('today');
  
  // staff filter for admin users
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<Array<{id: string, name: string, type: 'staff' | 'user'}>>([]);
  
  // user filter for admin users - keeping state but not using in UI
  const [userFilter] = useState<string | null>(null);
  
  // pagination transition states
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [previousOrders, setPreviousOrders] = useState<any[]>([]);
  // Initialize custom date range to today's date in Guam timezone
  const todayInGuam = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Guam' }));
  const [customStartDate, setCustomStartDate] = useState<Date>(todayInGuam);
  const [customEndDate, setCustomEndDate] = useState<Date>(todayInGuam);
  
  // expanded order cards
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  // selected orders for batch actions
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  
  // new orders highlighting (for newly arrived orders during polling)
  const [newOrders, setNewOrders] = useState<Set<string>>(new Set());

  // for the "Set ETA" modal
  const [showEtaModal, setShowEtaModal] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(5);
  const [orderToPrep, setOrderToPrep] = useState<any | null>(null);

  // for the "Edit Order" modal
  const [editingOrder, setEditingOrder] = useState<any | null>(null);

  // for the "Staff Order" modal (POS)
  const [showStaffOrderModal, setShowStaffOrderModal] = useState(false);
  
  // for the "Refund" modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<any | null>(null);

  // for mobile menu (if you have a contextual menu or dropdown) - not used with server-side pagination
  // const [showOrderActions, setShowOrderActions] = useState<number | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;

  // Auto-refresh interval in ms (used by WebSocket fallback)
  // const POLLING_INTERVAL = 30000; // 30 seconds - now handled by orderStore

  // Are we in the middle of refreshing data (quietly)?
  // const [isRefreshing, setIsRefreshing] = useState(false); // Not needed with server-side pagination

  // If we are updating an order’s status, block certain UI interactions
  const [isStatusUpdateInProgress, setIsStatusUpdateInProgress] = useState(false);

  // For temporarily highlighting a specific order row
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  
  //
  // NEW: State for inventory-based cancellation flow
  //
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
  const [batchOrdersToCancel, setBatchOrdersToCancel] = useState<any[]>([]);
  const [isBatchCancel, setIsBatchCancel] = useState(false);

  // ----------------------------------
  // Fetch Staff Members for Admin Filter
  // ----------------------------------
  useEffect(() => {
    // Only fetch staff members if user is admin or super admin
    if (isSuperAdmin() || isAdmin()) {
      const fetchStaffMembers = async () => {
        try {
          // Fetch only staff and admin users who have created orders
          const response = await api.get('/orders/creators');
          
          // Define interfaces for type safety
          interface StaffOption {
            id: string; // This will be in the format 'user_123'
            name: string;
            type: 'user';
            role: string;
          }
          
          // Check if response is an array
          if (response && Array.isArray(response)) {
            // The response is already formatted correctly
            setStaffMembers(response as StaffOption[]);

          } else {
            console.error('Unexpected response format from /orders/creators');
          }
        } catch (error) {
          console.error('Failed to fetch order creators:', error);
        }
      };
      
      fetchStaffMembers();
    }
  }, [isSuperAdmin, isAdmin]);
  
  // User filter removed as requested - search bar is used instead
  
  // State for showing only online orders (customer orders)
  const [onlineOrdersOnly, setOnlineOrdersOnly] = useState<boolean>(false);
  
  // Handle toggling the online orders filter
  const handleToggleOnlineOrders = useCallback(() => {
    setOnlineOrdersOnly(prevState => {
      const newState = !prevState;
      // Only clear staff filter if turning on online orders
      if (newState) {
        setStaffFilter(null);
      }
      // Reset to first page
      setCurrentPage(1);
      return newState;
    });
  }, [setStaffFilter, setCurrentPage]);
  
  // Set current staff member ID for staff users
  const [currentStaffMemberId, setCurrentStaffMemberId] = useState<string | null>(null);
  
  // Get current staff member ID for staff users
  useEffect(() => {
    if (isStaff() && user) {
      const fetchCurrentStaffMember = async () => {
        try {
          // Fetch the staff member record for the current user
          const response: any = await api.get(`/staff_members`, {
            params: { user_id: user.id }
          });
          
          let staffMemberData = null;
          // Handle different response formats
          if (response) {
            if (response.data && response.data.staff_members && response.data.staff_members.length > 0) {
              // New format with pagination
              staffMemberData = response.data.staff_members[0];
            } else if (Array.isArray(response) && response.length > 0) {
              // Old format without pagination
              staffMemberData = response[0];
            } else if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              // Another possible format
              staffMemberData = response.data[0];
            }
          }
          
          if (staffMemberData && staffMemberData.id) {
            // Staff record found for current user
            setCurrentStaffMemberId(staffMemberData.id.toString());
          }
        } catch (error) {
          console.error('Failed to fetch current staff member:', error);
        }
      };
      
      fetchCurrentStaffMember();
    }
  }, [isStaff, user]);
  
  // ----------------------------------
  // Date / Search / Filter
  // ----------------------------------
  // Helper function to create dates in Guam timezone (UTC+10)
  const createGuamDate = useCallback((year?: number, month?: number, day?: number, hours: number = 0, minutes: number = 0, seconds: number = 0) => {
    try {
      // Create a new date object
      const date = new Date();
      
      // Convert to Guam timezone
      const guamOffset = 10 * 60; // UTC+10 in minutes
      const localOffset = date.getTimezoneOffset();
      const totalOffset = localOffset + guamOffset;
      
      // Adjust the date to Guam timezone
      date.setMinutes(date.getMinutes() + totalOffset);
      
      // Set the provided values
      if (year !== undefined) date.setFullYear(year);
      if (month !== undefined) date.setMonth(month);
      if (day !== undefined) date.setDate(day);
      date.setHours(hours, minutes, seconds, 0);
      
      return date;
    } catch (error) {
      console.error('Error creating Guam date:', error);
      // Return current date as fallback
      return new Date();
    }
  }, []);
  
  const getDateRange = useCallback(() => {
    try {
      // Get current date in Guam timezone
      const now = new Date();
      const guamDate = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Guam' }));
      
      // Extract date components
      const year = guamDate.getFullYear();
      const month = guamDate.getMonth();
      const date = guamDate.getDate();
      const dayOfWeek = guamDate.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Create today's start and end
      const today = new Date(year, month, date, 0, 0, 0);
      const todayEnd = new Date(year, month, date, 23, 59, 59);
      
      // Create yesterday's start and end
      const yesterday = new Date(year, month, date - 1, 0, 0, 0);
      const yesterdayEnd = new Date(year, month, date - 1, 23, 59, 59);
      
      // Calculate this week's start (Sunday)
      const weekStart = new Date(year, month, date - dayOfWeek, 0, 0, 0);
      
      // Calculate last week's start and end
      // Start: Sunday of previous week
      const lastWeekStart = new Date(year, month, date - dayOfWeek - 7, 0, 0, 0);
      // End: Saturday of previous week
      const lastWeekEnd = new Date(year, month, date - dayOfWeek - 1, 23, 59, 59);
      
      // Get first day of month
      const monthStart = new Date(year, month, 1, 0, 0, 0);

      // Handle different date filter options
      switch (dateFilter) {
        case 'today':
          // For today, use today at 00:00:00 to today at 23:59:59
          return { start: today, end: todayEnd };
        case 'yesterday':
          // For yesterday, use yesterday at 00:00:00 to yesterday at 23:59:59
          return { start: yesterday, end: yesterdayEnd };
        case 'thisWeek':
          // For this week, use week start at 00:00:00 to today at 23:59:59
          return { start: weekStart, end: todayEnd };
        case 'lastWeek':
          // For last week, use last week start at 00:00:00 to last week end at 23:59:59
          return { start: lastWeekStart, end: lastWeekEnd };
        case 'thisMonth':
          // For this month, use month start at 00:00:00 to today at 23:59:59
          return { start: monthStart, end: todayEnd };
        case 'custom':
          // For custom range, use the custom dates with proper time boundaries
          return { 
            start: customStartDate || today, 
            end: customEndDate || todayEnd 
          };
        default:
          // Default to today
          return { start: today, end: todayEnd };
      }
    } catch (error) {
      console.error('Error calculating date range:', error);
      // Fallback to a safe default - today
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start: startOfToday, end: endOfToday };
    }
  }, [dateFilter, customStartDate, customEndDate]);

  // Store a reference to the last page change timestamp to prevent race conditions
  const lastPageChangeRef = useRef<number>(0);

  // Define a function to fetch orders with current parameters
  // IMPORTANT: We DO NOT include currentPage in the dependency array to avoid stale closures
  const fetchOrdersWithParams = useCallback((requestId?: number, pageOverride?: number) => {
    const { start, end } = getDateRange();
    
    // Use direct API call to ensure we get the right page
    const { fetchOrders } = useOrderStore.getState();
    
    // Use the pageOverride if provided, otherwise use currentPage from state
    // This prevents stale closures from using outdated page numbers
    const pageToFetch = pageOverride !== undefined ? pageOverride : currentPage;
    
    // If this is a page change (pageOverride is provided), save current orders for smooth transition
    if (pageOverride !== undefined && orders.length > 0) {
      setPreviousOrders(orders);
      setIsPageChanging(true);
    }
    
    // Fetching orders with pagination and filters
    
    // Create a unique source ID for tracking this request
    const sourceId = requestId ? `page-change-${requestId}` : `page-change-${Date.now()}`;
    
    // Get current store state to log
    // Store state available for debugging if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const currentStoreState = useOrderStore.getState();
    // Preparing to fetch with current store metadata
    
    // Make the API request with explicit parameters
    // Add staff filter parameter for admin users
    const params: any = {
      page: pageToFetch, // Use the captured page parameter
      perPage: ordersPerPage,
      status: selectedStatus !== 'all' ? selectedStatus : null,
      sortBy: 'created_at',
      sortDirection: sortNewestFirst ? 'desc' : 'asc',
      // Send the full ISO string with timezone information
      // This ensures proper date boundaries are respected
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      searchQuery: searchQuery || null,
      restaurantId: restaurantId || null,
      _sourceId: sourceId // Add a unique ID to track this request
    };
    
    // Debug log for date range parameters
    console.log('Date Range Debug:', {
      dateFilter,
      customStartDate: customStartDate?.toISOString(),
      customEndDate: customEndDate?.toISOString(),
      calculatedStart: start.toISOString(),
      calculatedEnd: end.toISOString(),
      currentDateInGuam: new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Guam' })).toISOString()
    });
    
    // Handle different user roles
    if (isSuperAdmin() || isAdmin()) {
      // Always use the staff orders endpoint for admin users
      params.endpoint = 'staff';
      
      if (onlineOrdersOnly) {
        // Admin filtering for online orders only (customer orders)
        params.online_orders_only = 'true';
        // Explicitly clear other filter parameters to avoid conflicts
        delete params.staff_member_id;
        delete params.user_id;
        delete params.include_online_orders;
      } else if (staffFilter) {
        // Admin filtering by specific staff member
        params.staff_member_id = staffFilter;
        // Ensure online orders filter is off
        delete params.online_orders_only;
      } else if (userFilter) {
        // Admin filtering by specific user
        params.user_id = userFilter;
        // Include online orders with user orders if requested
        params.include_online_orders = 'true';
        // Ensure online orders filter is off
        delete params.online_orders_only;
      }
    } else if (isStaff() && currentStaffMemberId) {
      // Staff users - backend policy will filter to show only their created orders and customer orders
      // We don't need to add any specific parameters as the backend policy handles this
      // Staff user viewing orders - backend policy will filter appropriately
    }
    
    // Log the parameters being sent to the API

    
    fetchOrders(params);
    
    // Log the request ID for debugging

    // API request sent for order pagination
    
    return sourceId; // Return the source ID for potential future reference
  }, [/* deliberately NOT including currentPage to avoid stale closures */
      ordersPerPage, selectedStatus, sortNewestFirst, getDateRange, searchQuery, restaurantId, staffFilter, onlineOrdersOnly, isSuperAdmin, isAdmin]);

  // Fetch orders quietly with current filter parameters (for background updates)
  const fetchOrdersWithParamsQuietly = useCallback(() => {
    const { start, end } = getDateRange();
    
    // Log the current page to help with debugging
    // Fetching orders quietly with current pagination parameters
    
    // Get the function directly from the store to avoid stale references
    const { fetchOrdersQuietly } = useOrderStore.getState();
    
    // Create a unique source ID for tracking this request
    const sourceId = `quiet-update-${Date.now()}`;
    
    // Add staff filter parameter for admin users
    const params: any = {
      page: currentPage,
      perPage: ordersPerPage,
      status: selectedStatus !== 'all' ? selectedStatus : null,
      sortBy: 'created_at',
      sortDirection: sortNewestFirst ? 'desc' : 'asc',
      // Send the full ISO string with timezone information
      // This ensures proper date boundaries are respected
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      searchQuery: searchQuery || null,
      restaurantId: restaurantId || null,
      _sourceId: sourceId // Add a unique ID to track this request
    };
    
    // Handle different user roles
    if (isSuperAdmin() || isAdmin()) {
      // Always use the staff orders endpoint for admin users
      params.endpoint = 'staff';
      
      if (onlineOrdersOnly) {
        // Admin filtering for online orders only (customer orders)
        params.online_orders_only = 'true';
        // Explicitly clear other filter parameters to avoid conflicts
        delete params.staff_member_id;
        delete params.user_id;
        delete params.include_online_orders;
      } else if (staffFilter) {
        // Admin filtering by specific staff member
        params.staff_member_id = staffFilter;
        // Ensure online orders filter is off
        delete params.online_orders_only;
      } else if (userFilter) {
        // Admin filtering by specific user
        params.user_id = userFilter;
        // Include online orders with user orders if requested
        params.include_online_orders = 'true';
        // Ensure online orders filter is off
        delete params.online_orders_only;
      }
    } else if (isStaff() && currentStaffMemberId) {
      // Staff users - backend policy will filter to show only their created orders and customer orders
      // We don't need to add any specific parameters as the backend policy handles this
      // Staff user viewing orders - backend policy will filter appropriately
    }
    
    fetchOrdersQuietly(params);
    
    // Log the request ID for debugging
    // Quiet API request sent
  }, [
    currentPage,
    ordersPerPage,
    selectedStatus,
    sortNewestFirst,
    getDateRange,
    searchQuery,
    restaurantId,
    currentStaffMemberId,
    staffFilter,
    userFilter,
    onlineOrdersOnly,
    isSuperAdmin,
    isAdmin
  ]);

  // ----------------------------------
  // Setup WebSocket connection - only on component mount
  // ----------------------------------
  useEffect(() => {
    // Track current order IDs to detect new ones
    const currentOrderIds = new Set(orders.map((o) => o.id));
    
    // Get store functions directly to avoid stale references
    const { startWebSocketConnection, stopWebSocketConnection, stopOrderPolling } = useOrderStore.getState();
    
    // Setting up WebSocket connection on component mount
    
    // Explicitly stop any existing polling to ensure WebSockets are prioritized
    stopOrderPolling();
    
    // Initialize WebSocket connection with current pagination settings
    const initializeWebSocket = () => {
      // First, always stop polling to ensure WebSockets are prioritized
      stopOrderPolling();
      
      // Only start WebSocket connection if not already connected
      // This prevents conflicts with AdminDashboard which also establishes connections
      const { websocketConnected } = useOrderStore.getState();
      if (!websocketConnected) {
        // Starting WebSocket connection
        // Start WebSocket connection
        // The WebSocket service will get pagination parameters from the store's metadata
        startWebSocketConnection();
        
        // Double-check polling is stopped after WebSocket connection attempt
        setTimeout(() => stopOrderPolling(), 500);
      } else {
        // WebSocket already connected
        // Even if already connected, we can update the pagination state in the orderStore
        // The orderStore will handle updating the WebSocket service with current pagination
      }
    };
    
    // Initialize WebSocket on component mount
    initializeWebSocket();
    
    // Handle new orders from WebSocket or polling
    const unsubscribeFromStore = useOrderStore.subscribe((state) => {
      // Check WebSocket status on each store update and ensure polling is stopped if connected
      if (state.websocketConnected && state.pollingInterval !== null) {
        // WebSocket connected, stopping polling
        stopOrderPolling();
      }
      
      const storeOrders = state.orders;
      const newOrderIds = storeOrders
        .filter((o) => !currentOrderIds.has(o.id))
        .map((o) => o.id);

      // Check if metadata has changed unexpectedly (possible WebSocket issue)
      if (state.metadata && state.metadata.total_pages > 100) {
        console.warn(`[OrderManager:Pagination] ⚠️ Detected suspicious metadata update: total_pages=${state.metadata.total_pages}, total_count=${state.metadata.total_count}`);
        console.warn('[OrderManager:Pagination] This may be caused by a WebSocket update affecting pagination metadata');
        
        // Force a refresh of the current page to get correct metadata
        // Forcing refresh to restore correct pagination metadata
        fetchOrdersWithParams(Date.now(), currentPage);
        return;
      }

      if (newOrderIds.length > 0) {
        // Mark them as new
        setNewOrders((prev) => {
          const updated = new Set(prev);
          newOrderIds.forEach((id) => updated.add(id));
          return updated;
        });

        // Update the known IDs
        newOrderIds.forEach((id) => currentOrderIds.add(id));

        // Clear highlight after 30s
        setTimeout(() => {
          setNewOrders((prev) => {
            const updated = new Set(prev);
            newOrderIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 30000);
      }
    });
    
    // Pause WebSocket if the tab is hidden and switch to polling
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopWebSocketConnection();
      } else {
        // First stop any polling that might be running
        stopOrderPolling();
        // Refresh once, then start WebSocket again
        fetchOrdersWithParamsQuietly();
        // Short delay to ensure the fetch completes before WebSocket reconnects
        setTimeout(() => {
          initializeWebSocket();
        }, 300);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check WebSocket status every 30 seconds to ensure polling is stopped if WebSocket is connected
    const websocketCheckInterval = setInterval(() => {
      const { websocketConnected, pollingInterval } = useOrderStore.getState();
      if (websocketConnected && pollingInterval !== null) {
        // Periodic check: stopping polling as WebSocket is connected
        stopOrderPolling();
      }
    }, 30000);

    return () => {
      // Clean up all intervals and event listeners
      clearInterval(websocketCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribeFromStore();
      
      // Don't disconnect WebSocket when changing pages - only when component unmounts completely
      // This prevents the WebSocket connection from being repeatedly closed and reopened
      if (document.visibilityState !== 'visible') {
        // Stopping WebSocket connection on component unmount
        stopWebSocketConnection();
      }
      stopOrderPolling();
      unsubscribeFromStore();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Only run on component mount and unmount
  


  // Effect to fetch orders when page or filters change
  useEffect(() => {
    // Filter or page changed, updating view
    
    // Record the timestamp of this page change to prevent race conditions
    const changeTimestamp = Date.now();
    // Previous timestamp for tracking request timing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const previousTimestamp = lastPageChangeRef.current;
    lastPageChangeRef.current = changeTimestamp;
    
    // Page change timestamp updated
    
    // Capture the current page value to ensure we use the correct page in the API call
    // This prevents issues with stale closures
    const capturedPage = currentPage;
    // Captured page value for pagination
    
    // Update the store's metadata to ensure WebSocket uses correct page
    // This is critical for ensuring pagination works correctly
    // Previous metadata for comparison during debugging
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const previousMetadata = { ...useOrderStore.getState().metadata };
    useOrderStore.setState(state => ({
      metadata: {
        ...state.metadata,
        page: capturedPage,
        per_page: ordersPerPage
      },
      _lastFetchRequestId: changeTimestamp // Use timestamp as request ID to track this specific request
    }));
    
    // Updated store metadata for pagination
    
    // Notify WebSocket service about pagination change
    // This ensures that any real-time updates will be for the correct page
    const { websocketConnected } = useOrderStore.getState();
    if (websocketConnected) {
      // Notifying WebSocket service about page change
      // The OrderChannel subscription will be updated with the new page number
      // This is handled internally by the WebSocket service
    } else {
      // WebSocket not connected, skipping notification
    }
    
    // Add a small delay to allow React to complete its rendering cycle
    // This helps prevent multiple rapid API calls
    // Setting timeout for fetch with delay
    const timeoutId = setTimeout(() => {
      // Only fetch if this is still the most recent page change
      if (lastPageChangeRef.current === changeTimestamp) {
        // Fetching orders after delay
        // Pass the captured page to ensure we fetch the correct page
        fetchOrdersWithParams(changeTimestamp, capturedPage);
      } else {
        // Skipping fetch after delay - timestamp is no longer current
      }
    }, 50);
    
    return () => {
      // Cleanup - clearing timeout for fetch
      clearTimeout(timeoutId);
    };
  }, [currentPage, ordersPerPage, selectedStatus, sortNewestFirst, dateFilter, searchQuery, fetchOrdersWithParams]);
  
  // Additional effect to force update WebSocket pagination params when page changes
  useEffect(() => {
    // This effect only handles page changes to ensure WebSocket has the correct page
    // Page changed, updating view
    
    // Update WebSocket pagination parameters directly
    const { websocketConnected } = useOrderStore.getState();
    if (websocketConnected) {
      // Explicitly updating WebSocket pagination params
      // Use the imported websocketService instead of require
      websocketService.updatePaginationParams({
        page: currentPage,
        perPage: ordersPerPage
      });
      
      // Force a refresh of the current page to ensure we have correct data and metadata
      // This prevents WebSocket updates from causing pagination issues
      // Forcing refresh to ensure correct data for new page
      fetchOrdersWithParams(Date.now(), currentPage);
    }
  }, [currentPage, ordersPerPage, fetchOrdersWithParams]);
  


  // ----------------------------------
  // Collapsible / Multi-select logic
  // ----------------------------------
  const toggleOrderExpand = useCallback((orderId: string) => {
    setExpandedOrders((prev) => {
      const updated = new Set(prev);
      if (updated.has(orderId)) updated.delete(orderId);
      else updated.add(orderId);
      return updated;
    });
  }, []);

  const toggleOrderSelection = useCallback((orderId: string, selected: boolean) => {
    setSelectedOrders((prev) => {
      const updated = new Set(prev);
      if (selected) updated.add(orderId);
      else updated.delete(orderId);
      return updated;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  // ----------------------------------
  // Single + Batch Cancelation with Inventory
  // ----------------------------------

  /**
   * Single-order flow: Confirm with user, then show BulkInventoryActionDialog
   * to handle inventory for any tracked items, then finalize cancellation.
   */
  const handleCancelOrder = useCallback((order: any) => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      setOrderToCancel(order);
      setIsBatchCancel(false);
      setShowInventoryDialog(true); // shows BulkInventoryActionDialog
    }
  }, []);

  /**
   * Batch cancel flow: gather the orders, show BulkInventoryActionDialog
   */
  const handleBatchMarkAsCancelled = useCallback(() => {
    const ordersToCancel = orders.filter((o) => selectedOrders.has(o.id));
    if (ordersToCancel.length > 0) {
      setBatchOrdersToCancel(ordersToCancel);
      setIsBatchCancel(true);
      setShowInventoryDialog(true);
    }
  }, [orders, selectedOrders]);

  /**
   * Called when BulkInventoryActionDialog is done (Confirm & Continue).
   * Processes each item action (damaged or not) and calls updateOrderStatusQuietly.
   * Also handles payment actions (refund, store credit, etc.) if specified.
   */
  const processInventoryActionsAndCancel = async (inventoryActions: any[]) => {
    setIsStatusUpdateInProgress(true);
    try {
      // Processing inventory actions
      
      // Group actions by order ID for payment processing
      const actionsByOrder = new Map<string | number, any[]>();
      
      // 1) Process each inventory action
      for (const action of inventoryActions) {
        // Group by order ID for payment processing
        const orderId = action.orderId || orderToCancel?.id || '';
        if (!actionsByOrder.has(orderId)) {
          actionsByOrder.set(orderId, []);
        }
        actionsByOrder.get(orderId)?.push(action);
        
        // Skip inventory processing for placeholder items (itemId = 0)
        if (action.itemId === 0) {
          // Skipping inventory processing for placeholder item
          continue;
        }
        
        // Process inventory action
        if (action.action === 'mark_as_damaged') {
          // Mark items as damaged - use the orderId from the action
          // (which comes from the specific order the item belongs to)
          // Marking item as damaged
          await menuItemsApi.markAsDamaged(action.itemId, {
            quantity: action.quantity,
            reason: action.reason || 'Damaged during order cancellation',
            order_id: orderId
          });
        } else if (action.action === 'return_to_inventory') {
          // Explicitly return items to inventory by increasing stock
          // Returning item to inventory
          // Get current item details
          const menuItem = await menuItemsApi.getById(action.itemId);
          
          // Calculate new stock level after returning items
          const newStockLevel = (menuItem.stock_quantity || 0) + action.quantity;
          
          // Update stock level with explicit API call
          await menuItemsApi.updateStock(action.itemId, {
            stock_quantity: newStockLevel,
            reason_type: 'return',
            reason_details: `Items returned from cancelled Order #${orderId}`
          });
        }
      }

      // 2) Process payment actions for each order
      if (inventoryActions.length > 0) {
        const paymentAction = inventoryActions[0].paymentAction;
        const paymentReason = inventoryActions[0].paymentReason || 'Order cancelled';
        
        if (paymentAction && paymentAction !== 'no_action') {
          // Process each order's payment
          for (const [orderId, actions] of actionsByOrder.entries()) {
            // Get the order object
            const orderObj = isBatchCancel 
              ? batchOrdersToCancel.find(o => o.id === orderId)
              : orderToCancel;
              
            if (!orderObj) continue;
            
            // Calculate total refund amount for this order
            const refundItems = actions.map(action => ({
              id: action.itemId,
              name: action.name || 'Item',
              quantity: action.quantity,
              price: action.price || 0
            }));
            
            // Process based on payment action type
            switch (paymentAction) {
              case 'refund':
                try {
                  await orderPaymentOperationsApi.createPartialRefund(Number(orderId), {
                    amount: orderObj.total, // Full order amount for cancellation
                    reason: paymentReason,
                    items: refundItems,
                    refunded_items: refundItems
                  });
                  // Refund processed successfully
                } catch (error) {
                  console.error(`Error processing refund for order ${orderId}:`, error);
                  toastUtils.error(`Failed to process refund for order #${orderId}`);
                }
                break;
                
              case 'store_credit':
                try {
                  await orderPaymentOperationsApi.addStoreCredit(Number(orderId), {
                    amount: orderObj.total, // Full order amount for cancellation
                    reason: paymentReason,
                    email: orderObj.contact_email
                  });

                } catch (error) {
                  console.error(`Error adding store credit for order ${orderId}:`, error);
                  toastUtils.error(`Failed to add store credit for order #${orderId}`);
                }
                break;
                
              case 'adjust_total':
                try {
                  await orderPaymentOperationsApi.adjustOrderTotal(Number(orderId), {
                    new_total: 0, // Set to 0 for cancellation
                    reason: paymentReason
                  });

                } catch (error) {
                  console.error(`Error adjusting total for order ${orderId}:`, error);
                  toastUtils.error(`Failed to adjust total for order #${orderId}`);
                }
                break;
            }
          }
        }
      }

      // 3) Cancel the orders
      if (isBatchCancel) {
        // For batch
        for (const ord of batchOrdersToCancel) {
          await updateOrderStatusQuietly(ord.id, 'cancelled');
        }
        clearSelections();
      } else if (orderToCancel) {
        // For single
        await updateOrderStatusQuietly(orderToCancel.id, 'cancelled');
      }

      // 4) Reset state
      setBatchOrdersToCancel([]);
      setOrderToCancel(null);
      setIsBatchCancel(false);
      setShowInventoryDialog(false);

    } catch (error) {
      console.error('Error processing inventory actions:', error);
      toastUtils.error('Failed to process inventory changes');
    } finally {
      setIsStatusUpdateInProgress(false);
    }
  };

  // ----------------------------------
  // Other batch actions (ready/completed)
  // ----------------------------------
  const handleBatchMarkAsReady = useCallback(async () => {
    setIsStatusUpdateInProgress(true);
    try {
      for (const orderId of selectedOrders) {
        await updateOrderStatusQuietly(orderId, 'ready');
      }
      clearSelections();
    } finally {
      setIsStatusUpdateInProgress(false);
    }
  }, [selectedOrders, updateOrderStatusQuietly, clearSelections]);

  const handleBatchMarkAsCompleted = useCallback(async () => {
    setIsStatusUpdateInProgress(true);
    try {
      for (const orderId of selectedOrders) {
        await updateOrderStatusQuietly(orderId, 'completed');
      }
      clearSelections();
    } finally {
      setIsStatusUpdateInProgress(false);
    }
  }, [selectedOrders, updateOrderStatusQuietly, clearSelections]);

  // Server-side search is now handled by the API



  // Get orders directly from store - server handles filtering, sorting, and pagination
  const currentOrders = orders;
  
  // Get metadata from store
  const { metadata } = useOrderStore();
  // const totalOrders = metadata.total_count; // Not directly used in the component
  const totalPages = metadata.total_pages;
  
  // Add a useEffect to log when orders change and verify page synchronization
  useEffect(() => {
    console.debug(`[OrderManager:Pagination] Orders updated, count: ${orders.length}, current page: ${currentPage}`);
    console.debug(`[OrderManager:Pagination] Store metadata: ${JSON.stringify(metadata)}`);
    console.debug(`[OrderManager:Pagination] Calculated totalPages: ${totalPages}`);
    
    // Verify page synchronization
    if (metadata.page !== currentPage) {
      console.warn(`[OrderManager:Pagination] ⚠️ PAGE MISMATCH: Store metadata page (${metadata.page}) does not match component state (${currentPage})`);
    }
    
    // Reset page changing state when orders are updated
    if (isPageChanging && orders.length > 0) {
      // Small delay to allow for smooth transition
      setTimeout(() => {
        setIsPageChanging(false);
        setPreviousOrders([]);
      }, 300);
    }
  }, [orders, currentPage, metadata, totalPages, isPageChanging]);

  // When filters change, reset to page 1 and fetch orders
  useEffect(() => {
    console.debug('[OrderManager] Filters changed, resetting to page 1');
    
    // Stop any ongoing polling to prevent race conditions
    const { stopOrderPolling } = useOrderStore.getState();
    stopOrderPolling();
    
    // Generate a unique timestamp for this filter change to prevent race conditions
    const filterChangeTimestamp = Date.now();
    lastPageChangeRef.current = filterChangeTimestamp;
    
    // Reset to page 1
    setCurrentPage(1);
    
    // Reset the request tracking ID to ensure we start fresh
    useOrderStore.setState(state => ({
      metadata: {
        ...state.metadata,
        page: 1, // Force page 1
        per_page: ordersPerPage
      },
      _lastFetchRequestId: filterChangeTimestamp // Use timestamp as request ID
    }));
    
    // Check if WebSocket is connected
    const { websocketConnected } = useOrderStore.getState();
    if (websocketConnected) {
      console.debug('[OrderManager] Notifying WebSocket about filter change and page reset');
      // The metadata update above will ensure WebSocket has the correct page number
    }
    
    // We need to wait for the next render cycle when currentPage is updated to 1
    const timeoutId = setTimeout(() => {
      // Only fetch if this is still the most recent filter change
      if (lastPageChangeRef.current === filterChangeTimestamp) {
        console.debug('[OrderManager] Fetching orders after filter change');
        fetchOrdersWithParams(filterChangeTimestamp);
        
        // Check if we need to restart polling (only if WebSocket is not connected)
        setTimeout(() => {
          const { startOrderPolling, websocketConnected } = useOrderStore.getState();
          if (!websocketConnected) {
            console.debug('[OrderManager] Restarting polling after filter change (WebSocket not connected)');
            startOrderPolling();
          } else {
            console.debug('[OrderManager] WebSocket is connected, not starting polling after filter change');
          }
        }, 500);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedStatus, sortNewestFirst, searchQuery, dateFilter, onlineOrdersOnly, fetchOrdersWithParams, ordersPerPage]);

  // If the parent sets a selectedOrderId => expand that order
  // (And scroll to it if it's in the list)
  useEffect(() => {
    if (selectedOrderId && !isStatusUpdateInProgress) {
      // Show it
      setSelectedStatus('all');
      setSearchQuery('');
      
      // Fetch the order details if needed
      const found = orders.find((o) => Number(o.id) === selectedOrderId);
      
      if (found) {
        // Expand
        setExpandedOrders((prev) => {
          const updated = new Set(prev);
          updated.add(found.id);
          return updated;
        });

        // Highlight
        setHighlightedOrderId(found.id);
        setTimeout(() => {
          setHighlightedOrderId(null);
        }, 5000);

        // Scroll to it
        setTimeout(() => {
          const elem = document.getElementById(`order-${found.id}`);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      } else {
        // If the order is not in the current page, we need to search for it
        // Reset filters and fetch all orders to find it
        fetchOrders({
          page: 1,
          perPage: 100, // Fetch more orders to increase chance of finding it
          searchQuery: String(selectedOrderId)
        });
      }
    }
  }, [
    selectedOrderId,
    orders,
    isStatusUpdateInProgress,
    fetchOrders
  ]);

  // For the "view details" modal
  function closeModal() {
    setSelectedOrder(null);
    if (setSelectedOrderId) {
      setSelectedOrderId(null);
    }
  }

  // For setting an order to "preparing" with an ETA
  async function handleConfirmEta() {
    if (!orderToPrep) {
      setShowEtaModal(false);
      return;
    }

    // Calculate pickup time
    let pickupTime: string;
    if (requiresAdvanceNotice(orderToPrep)) {
      const [hourStr, minuteStr] = String(etaMinutes).split('.');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr || '0', 10) === 3 ? 30 : 0;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);
      pickupTime = tomorrow.toISOString();
    } else {
      pickupTime = new Date(Date.now() + Number(etaMinutes) * 60_000).toISOString();
    }

    setIsStatusUpdateInProgress(true);
    await updateOrderStatusQuietly(orderToPrep.id, 'preparing', pickupTime);
    setIsStatusUpdateInProgress(false);

    setShowEtaModal(false);
    setEtaMinutes(5);
    setOrderToPrep(null);
  }

  // color badges
  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      confirmed: 'bg-purple-100 text-purple-800',
      refunded: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Check if an order requires 24-hour notice
  const requiresAdvanceNotice = (order: any) => {
    return order.requires_advance_notice === true;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'No pickup time set';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? 'No pickup time set' : d.toLocaleString();
  };

  // Called when admin finishes editing the order in the AdminEditOrderModal
  async function handleSaveEdit(updatedData: any) {
    await updateOrderData(updatedData.id, updatedData);
    setEditingOrder(null);
  }

  // These functions are called directly in the JSX

  // Single-order action buttons for CollapsibleOrderCard
  const renderOrderActions = (order: any) => {
    // Check if order is refunded
    const isRefunded = order.status === 'refunded';
    
    // Calculate net amount and refund info for display
    const netAmount = Number(order.total || 0) - (order.total_refunded || 0);
    const refundInfo = isRefunded ? (
      <div className="text-sm">
        <span className="font-medium">
          {'Fully Refunded'}
        </span>
        {order.total_refunded > 0 && (
          <span className="ml-1">
            (${order.total_refunded?.toFixed(2) || '0.00'})
          </span>
        )}
      </div>
    ) : null;
    
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          {isRefunded ? (
            <p className="font-medium text-sm">
              <span className="line-through text-gray-400 mr-2">
                ${Number(order.total || 0).toFixed(2)}
              </span>
              <span>
                ${netAmount.toFixed(2)}
              </span>
            </p>
          ) : (
            <p className="font-medium text-sm">
              Total: ${Number(order.total || 0).toFixed(2)}
            </p>
          )}
          {refundInfo}
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          {/* Only show workflow buttons if not refunded */}
          {!isRefunded && (
            <>
              {order.status === 'pending' && (
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 min-w-[120px] flex-grow sm:flex-grow-0"
                  onClick={() => {
                    setOrderToPrep(order);
                    if (requiresAdvanceNotice(order)) {
                      setEtaMinutes(10.0); // default for next-day
                    } else {
                      setEtaMinutes(5);
                    }
                    setShowEtaModal(true);
                  }}
                >
                  Start Preparing
                </button>
              )}

              {order.status === 'preparing' && (
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 min-w-[120px] flex-grow sm:flex-grow-0"
                  onClick={() => {
                    setIsStatusUpdateInProgress(true);
                    updateOrderStatusQuietly(order.id, 'ready')
                      .finally(() => setIsStatusUpdateInProgress(false));
                  }}
                >
                  Mark as Ready
                </button>
              )}

              {order.status === 'ready' && (
                <button
                  className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-gray-600 min-w-[120px] flex-grow sm:flex-grow-0"
                  onClick={() => {
                    setIsStatusUpdateInProgress(true);
                    updateOrderStatusQuietly(order.id, 'completed')
                      .finally(() => setIsStatusUpdateInProgress(false));
                  }}
                >
                  Complete
                </button>
              )}
              
              {/* Refund button removed - users should use the AdminEditOrderModal for refunds */}
              
              {/* Cancel button (with inventory handling) */}
              {(order.status === 'pending' || order.status === 'preparing') && (
                <button
                  className="p-2 text-red-400 hover:text-red-600 rounded-md"
                  onClick={() => handleCancelOrder(order)}
                  aria-label="Cancel order"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
          
          {/* Edit button - always available */}
          <button
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            onClick={() => setEditingOrder(order)}
            aria-label="Edit order"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 
                  00-2 2v11a2 2 0 
                  002 2h11a2 2 0 
                  002-2v-5m-1.414-9.414a2 
                  2 0 112.828 2.828L11.828 
                  15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Header section */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-gray-600 text-sm">Manage and track customer orders</p>
        </div>
        <button
          onClick={() => setShowStaffOrderModal(true)}
          className="px-4 py-2 bg-[#c1902f] text-white rounded-md font-medium hover:bg-[#a97c28] focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50 flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
               viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Create Staff Order</span>
        </button>
      </div>

      {/* Top Filters (Date, Search, Sort) */}
      <div className="mb-6 space-y-4">
        {/* Main Filter Row */}
        <div className="flex flex-col space-y-4">
          {/* First Row - Staff Filter and Online Orders Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Staff Filter - Only visible to admin and super_admin */}
            {(isSuperAdmin() || isAdmin()) && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Filter</label>
                <MobileSelect
                  options={[
                    { value: '', label: `All Staff ${staffMembers.length ? `(${staffMembers.length})` : '(Loading...)'}` },
                    ...staffMembers.map(staff => ({
                      value: staff.id, // The id already includes the 'user_' prefix from the backend
                      label: staff.name
                    }))
                  ]}
                  value={staffFilter || ''}
                  onChange={(value) => {
                    setStaffFilter(value === '' ? null : value);
                    // Only clear online orders filter if a staff member is selected
                    if (value !== '') {
                      setOnlineOrdersOnly(false);
                    }
                    setCurrentPage(1); // Reset to first page when changing filter
                  }}
                  className="w-full h-12 shadow-sm border-gray-300 rounded-md"
                  placeholder="Select staff member"
                />
              </div>
            )}
            
            {/* Online Orders Only Button */}
            {(isSuperAdmin() || isAdmin()) && (
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Online Orders</label>
                <button
                  onClick={handleToggleOnlineOrders}
                  className={`w-full py-2 px-4 border rounded-md text-sm font-medium transition-colors duration-200 h-12 shadow-sm ${onlineOrdersOnly 
                    ? 'bg-[#c1902f] text-white border-[#c1902f]' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'}`}
                  aria-pressed={onlineOrdersOnly}
                >
                  {onlineOrdersOnly ? '✓ Showing Online Orders Only' : 'Show Online Orders Only'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Second Row - Date Filter, Search, and Sort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Filter */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <DateFilter
              selectedOption={dateFilter}
              onOptionChange={setDateFilter}
              startDate={customStartDate}
              endDate={customEndDate}
              onDateRangeChange={(start, end) => {
                setCustomStartDate(start);
                setCustomEndDate(end);
              }}
              className="w-full h-12 shadow-sm border-gray-300 rounded-md"
            />
          </div>

          {/* Search */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Orders</label>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by order #, name, email, or phone"
              className="w-full h-12 shadow-sm border-gray-300 rounded-md"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Orders</label>
            <MobileSelect
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' }
              ]}
              value={sortNewestFirst ? 'newest' : 'oldest'}
              onChange={(value) => setSortNewestFirst(value === 'newest')}
              className="w-full h-12 shadow-sm border-gray-300 rounded-md"
            />
          </div>

          {/* We're removing the order count from here and moving it above the status filter buttons */}
        </div>

        {/* Staff message explaining what orders they can see */}
      {isStaff() && !isSuperAdmin() && !isAdmin() && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            You are viewing orders you created and orders placed by customers.
          </p>
        </div>
      )}
      
      {/* Order count display and filter section header */}
      <div className="flex justify-between items-center mt-6 mb-3 border-b border-gray-200 pb-2">
        <div className="flex items-center">
          <div className="text-lg font-medium text-gray-800">
            Orders
          </div>
          <div className="ml-2 px-2.5 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
            {metadata.total_count}
          </div>
        </div>
      </div>
      
      {/* Status filter buttons */}
        <div className="relative mt-2">
          <div className="flex flex-nowrap space-x-2 overflow-x-auto py-1 px-1 scrollbar-hide -mx-1 pb-2 -mb-1 snap-x touch-pan-x">
            <button
              onClick={() => {
                setSelectedStatus('all');
                if (setSelectedOrderId) setSelectedOrderId(null);
              }}
              className={`
                whitespace-nowrap px-6 py-3 rounded-md text-sm font-medium min-w-[100px] flex-shrink-0 snap-start transition-colors duration-200 shadow-sm border
                ${selectedStatus === 'all'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                }
              `}
            >
              All Orders
            </button>
            {(['pending', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  if (setSelectedOrderId) setSelectedOrderId(null);
                }}
                className={`
                  whitespace-nowrap px-6 py-3 rounded-md text-sm font-medium min-w-[100px] flex-shrink-0 snap-start transition-colors duration-200 shadow-sm border
                  ${selectedStatus === status
                    ? 'bg-[#c1902f] text-white border-[#c1902f]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }
                `}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders list or loading */}
      <div className="pb-16">
        {loading ? (
          // Show skeletons
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse animate-fadeIn"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex justify-between items-center p-3 border-b border-gray-100">
                  <div>
                    <div className="h-5 w-32 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded"></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                    <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="mb-4">
                    <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <div className="h-4 w-40 bg-gray-200 rounded"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                      </div>
                      <div className="flex justify-between">
                        <div className="h-4 w-36 bg-gray-200 rounded"></div>
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="h-3 w-48 bg-gray-200 rounded"></div>
                    <div className="h-3 w-40 bg-gray-200 rounded"></div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                    <div className="h-8 w-24 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : metadata.total_count === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-gray-500">No orders found matching your filters</p>
          </div>
        ) : (
          <div>
            {/* CollapsibleOrderCard list with smooth transitions */}
            <div className="space-y-4 mb-6 relative">
              {/* Show previous orders during page transition for smoother experience */}
              {isPageChanging && previousOrders.length > 0 && (
                <div className="absolute inset-0 z-10 transition-opacity duration-300" 
                     style={{ opacity: isPageChanging ? 0.3 : 0 }}>
                  {previousOrders.map((order, index) => (
                    <div key={`previous-${order.id}-${index}`} className="mb-4">
                      <CollapsibleOrderCard
                        order={order}
                        isExpanded={expandedOrders.has(order.id)}
                        onToggleExpand={() => toggleOrderExpand(order.id)}
                        isNew={newOrders.has(order.id)}
                        isSelected={selectedOrders.has(order.id)}
                        isHighlighted={highlightedOrderId === order.id}
                        onSelectChange={(sel) => toggleOrderSelection(order.id, sel)}
                        renderActions={() => renderOrderActions(order)}
                        getStatusBadgeColor={getStatusBadgeColor}
                        formatDate={formatDate}
                        requiresAdvanceNotice={requiresAdvanceNotice}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Current orders with fade-in effect */}
              <div className={`transition-opacity duration-300 ${isPageChanging ? 'opacity-0' : 'opacity-100'}`}>
                {currentOrders.map((order) => (
                  <div key={`order-${order.id}-${order.updated_at}`} className="mb-4">
                    <CollapsibleOrderCard
                      order={order}
                      isExpanded={expandedOrders.has(order.id)}
                      onToggleExpand={() => toggleOrderExpand(order.id)}
                      isNew={newOrders.has(order.id)}
                      isSelected={selectedOrders.has(order.id)}
                      isHighlighted={highlightedOrderId === order.id}
                      onSelectChange={(sel) => toggleOrderSelection(order.id, sel)}
                      renderActions={() => renderOrderActions(order)}
                      getStatusBadgeColor={getStatusBadgeColor}
                      formatDate={formatDate}
                      requiresAdvanceNotice={requiresAdvanceNotice}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6 pb-4">
                <button
                  onClick={() => {
                    // Prevent multiple rapid clicks
                    const now = Date.now();
                    const timeSinceLastChange = now - lastPageChangeRef.current;
                    if (timeSinceLastChange < 300) {
                      console.debug(`[OrderManager:Pagination] Ignoring rapid page change click - only ${timeSinceLastChange}ms since last change`);
                      return;
                    }
                    
                    // Save current orders for smooth transition
                    if (orders.length > 0) {
                      setPreviousOrders(orders);
                      setIsPageChanging(true);
                    }
                    
                    // Calculate the new page number
                    const newPage = Math.max(currentPage - 1, 1);


                    
                    // Generate a unique timestamp for this page change
                    const pageChangeTimestamp = now;
                    lastPageChangeRef.current = pageChangeTimestamp;
                    
                    // Immediately update store metadata to ensure consistency
                    // This helps prevent race conditions with the useEffect
                    useOrderStore.setState(state => ({
                      metadata: {
                        ...state.metadata,
                        page: newPage
                      },
                      _lastFetchRequestId: pageChangeTimestamp
                    }));
                    
                    // Update the page state - the useEffect will handle the API call

                    setCurrentPage(newPage);
                  }}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  aria-label="Previous page"
                >
                  Previous
                </button>

                {/* Page buttons (desktop) */}
                <div className="hidden sm:flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => {
                        // Prevent multiple rapid clicks
                        const now = Date.now();
                        const timeSinceLastChange = now - lastPageChangeRef.current;
                        if (timeSinceLastChange < 300) {
                          console.debug(`[OrderManager:Pagination] Ignoring rapid page change click - only ${timeSinceLastChange}ms since last change`);
                          return;
                        }
                        
                        // Save current orders for smooth transition
                        if (orders.length > 0) {
                          setPreviousOrders(orders);
                          setIsPageChanging(true);
                        }
                        


                        
                        // Generate a unique timestamp for this page change
                        const pageChangeTimestamp = now;
                        lastPageChangeRef.current = pageChangeTimestamp;
                        
                        // Immediately update store metadata to ensure consistency
                        // This helps prevent race conditions with the useEffect
                        useOrderStore.setState(state => ({
                          metadata: {
                            ...state.metadata,
                            page: page
                          },
                          _lastFetchRequestId: pageChangeTimestamp
                        }));
                        
                        // Update the page state - the useEffect will handle the API call

                        setCurrentPage(page);
                      }}
                      className={`w-10 h-10 flex items-center justify-center rounded-md text-sm font-medium ${
                        currentPage === page
                          ? 'bg-[#c1902f] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-label={`Page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {/* Mobile page indicator */}
                <div className="sm:hidden flex items-center px-3">
                  <span className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>

                <button
                  onClick={() => {
                    // Prevent multiple rapid clicks
                    const now = Date.now();
                    const timeSinceLastChange = now - lastPageChangeRef.current;
                    if (timeSinceLastChange < 300) {
                      console.debug(`[OrderManager:Pagination] Ignoring rapid page change click - only ${timeSinceLastChange}ms since last change`);
                      return;
                    }
                    
                    // Save current orders for smooth transition
                    if (orders.length > 0) {
                      setPreviousOrders(orders);
                      setIsPageChanging(true);
                    }
                    
                    // Calculate the new page number
                    const newPage = Math.min(currentPage + 1, totalPages);



                    
                    // Generate a unique timestamp for this page change
                    const pageChangeTimestamp = now;
                    lastPageChangeRef.current = pageChangeTimestamp;
                    
                    // Immediately update store metadata to ensure consistency
                    // This helps prevent race conditions with the useEffect
                    useOrderStore.setState(state => ({
                      metadata: {
                        ...state.metadata,
                        page: newPage
                      },
                      _lastFetchRequestId: pageChangeTimestamp
                    }));
                    
                    // Update the page state - the useEffect will handle the API call

                    setCurrentPage(newPage);
                  }}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multi-select action bar */}
      {selectedOrders.size > 0 && (
        <MultiSelectActionBar
          selectedCount={selectedOrders.size}
          onClearSelection={clearSelections}
          onMarkAsReady={handleBatchMarkAsReady}
          onMarkAsCompleted={handleBatchMarkAsCompleted}
          onMarkAsCancelled={handleBatchMarkAsCancelled} // now uses the new inventory logic
          isProcessing={isStatusUpdateInProgress}
        />
      )}

      {/* Modals and Overlays */}
      {/* 1) Details modal */}
      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={closeModal} />
      )}

      {/* 2) "Set ETA" modal */}
      {showEtaModal && orderToPrep && (
        <SetEtaModal
          order={orderToPrep}
          etaMinutes={etaMinutes}
          setEtaMinutes={setEtaMinutes}
          onClose={() => {
            setShowEtaModal(false);
            setOrderToPrep(null);
          }}
          onConfirm={handleConfirmEta}
        />
      )}

      {/* 3) "Edit Order" modal */}
      {editingOrder && (
        <AdminEditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* 4) Staff Order Modal (POS) */}
      {showStaffOrderModal && (
        <StaffOrderModal
          onClose={() => setShowStaffOrderModal(false)}
          onOrderCreated={(orderId) => {
            setShowStaffOrderModal(false);
            // Refresh orders
            fetchOrders();
            if (setSelectedOrderId) {
              setSelectedOrderId(Number(orderId));
            }
            toastUtils.success(`Staff order #${orderId} created successfully!`);
          }}
          restaurantId={restaurantId}
        />
      )}

      {/* 5) Inventory Action Dialog for cancels (single or batch) */}
      {showInventoryDialog && (
        <BulkInventoryActionDialog
          order={isBatchCancel ? batchOrdersToCancel : orderToCancel}
          onClose={() => {
            setShowInventoryDialog(false);
            setOrderToCancel(null);
            setBatchOrdersToCancel([]);
            setIsBatchCancel(false);
          }}
          onConfirm={processInventoryActionsAndCancel}
          isBatch={isBatchCancel}
        />
      )}

      {/* 6) Refund Modal */}
      {showRefundModal && orderToRefund && (
        <RefundModal
          isOpen={showRefundModal}
          orderId={Number(orderToRefund.id)}
          maxRefundable={Number(orderToRefund.total || 0) - (orderToRefund.total_refunded || 0)}
          onClose={() => {
            setShowRefundModal(false);
            setOrderToRefund(null);
          }}
          onRefundCreated={async () => {
            try {
              setIsStatusUpdateInProgress(true);
              
              // Get the refund amount to determine if it's a full or partial refund
              const result = await orderPaymentsApi.getPayments(orderToRefund.id);
              const { total_paid, total_refunded } = result.data;
              
              // Check if this is a full refund (all money returned)
              const isFullRefund = Math.abs(total_paid - total_refunded) < 0.01;
              
              // Update the order status based on refund type
              if (isFullRefund) {
                await updateOrderStatusQuietly(orderToRefund.id, 'refunded');
              } else if (total_refunded > 0) {
                // Keep original status and apply refund without changing status
                // Only change to refunded if all items were refunded
              }
              
              // Refresh orders to get the updated data
              await fetchOrders();
              
              // Close the modal
              setShowRefundModal(false);
              setOrderToRefund(null);
              
              // Show success message
              toastUtils.success('Refund processed successfully');
            } catch (error) {
              console.error('Error processing refund:', error);
              toastUtils.error('Failed to update order status after refund.');
            } finally {
              setIsStatusUpdateInProgress(false);
            }
          }}
        />
      )}
    </div>
  );
}
