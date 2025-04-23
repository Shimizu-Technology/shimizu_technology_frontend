  // src/ordering/components/admin/AnalyticsManager.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  api,
  getCustomerOrdersReport,
  getRevenueTrend,
  getTopItems,
  getIncomeStatement,
  getUserSignups,
  getUserActivityHeatmap,
  getMenuItemReport,
  getPaymentMethodReport,
  getVipCustomerReport,
  CustomerOrderItem,
  CustomerOrderReport,
  RevenueTrendItem,
  TopItem,
  IncomeStatementRow,
  UserSignupItem,
  HeatmapDataPoint,
  MenuItemReport,
  CategoryReport,
  PaymentMethodReport as PaymentMethodReportType,
  VipCustomerReport as VipCustomerReportType,
  VipReportSummary
} from '../../../shared/api';
import { MenuItemPerformance } from './reports/MenuItemPerformance';
import { PaymentMethodReport } from './reports/PaymentMethodReport';
import { VipCustomerReport } from './reports/VipCustomerReport';

// ------------------- Types -------------------
type SortColumn = 'user_name' | 'total_spent' | 'order_count';
type SortDirection = 'asc' | 'desc';

// For date-range presets
type PresetRange = '1m' | '3m' | '6m' | '1y' | 'all' | null;

// For time frame selection
type TimeFrame = '30min' | 'hour' | 'day' | 'week' | 'month';

// For quick time presets
type TimePreset = '30min' | '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | 'custom';

// ------------------- Helper to sort reports -------------------
function sortReports(
  data: CustomerOrderReport[],
  column: SortColumn,
  direction: SortDirection
) {
  const copy = [...data];
  copy.sort((a, b) => {
    let valA: string | number = '';
    let valB: string | number = '';

    if (column === 'user_name') {
      valA = a.user_name.toLowerCase();
      valB = b.user_name.toLowerCase();
    } else if (column === 'total_spent') {
      valA = a.total_spent;
      valB = b.total_spent;
    } else if (column === 'order_count') {
      valA = a.order_count;
      valB = b.order_count;
    }

    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  return copy;
}

// ------------------- Main Component -------------------
interface AnalyticsManagerProps {
  restaurantId?: string;
}

export function AnalyticsManager({ restaurantId }: AnalyticsManagerProps) {
  // Mobile/tablet responsive detection
  const isMobile = useMediaQuery({ maxWidth: 640 });
  const isTablet = useMediaQuery({ minWidth: 641, maxWidth: 1024 });
  // ----- 1) Date Range States + Preset -----
  // Default to today's date for both start and end
  // Create a date object that's explicitly in Guam timezone
  const todayInGuam = new Date(new Date().toLocaleString('en-US', { timeZone: 'Pacific/Guam' }));

  // Format dates in YYYY-MM-DD format in Guam timezone (UTC+10)
  const formatDateForGuam = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(formatDateForGuam(todayInGuam));
  const [endDate, setEndDate] = useState(formatDateForGuam(todayInGuam));
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>(null);
  
  // Time inputs for specific time ranges
  const [startTime, setStartTime] = useState('08:00'); // Default to 8:00 AM
  const [endTime, setEndTime] = useState('23:59');     // Default to 11:59 PM
  const [useTimeFilter, setUseTimeFilter] = useState(true);  // Enable by default for better UX
  
  // Time frame states
  const [timeGranularity, setTimeGranularity] = useState<TimeFrame>('day'); // Default to day view
  const [timePreset, setTimePreset] = useState<TimePreset>('custom'); // Default to custom
  
  // For time-sensitive queries (with time component)
  const [startDateWithTime, setStartDateWithTime] = useState<string | null>(null);
  const [endDateWithTime, setEndDateWithTime] = useState<string | null>(null);

  // Manually changing date => reset preset
  function handleChangeStartDate(value: string) {
    setStartDate(value);
    setSelectedPreset(null);
  }
  function handleChangeEndDate(value: string) {
    setEndDate(value);
    setSelectedPreset(null);
  }
  
  // Handle time input changes
  function handleChangeStartTime(value: string) {
    setStartTime(value);
    setTimePreset('custom');
    setUseTimeFilter(true);
  }
  function handleChangeEndTime(value: string) {
    setEndTime(value);
    setTimePreset('custom');
    setUseTimeFilter(true);
  }
  
  // Toggle time filter
  function toggleTimeFilter(value: boolean) {
    setUseTimeFilter(value);
    if (value) {
      setTimePreset('custom');
    }
  }
  
  // Apply common business hour presets
  function applyBusinessHourPreset(preset: string) {
    setUseTimeFilter(true);
    setTimePreset('custom');
    setSelectedPreset(null);
    
    // Set the same date for both start and end
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    
    // Set time based on preset
    switch(preset) {
      case 'morning':
        setStartTime('08:00');
        setEndTime('12:00');
        break;
      case 'lunch':
        setStartTime('12:00');
        setEndTime('14:00');
        break;
      case 'afternoon':
        setStartTime('14:00');
        setEndTime('17:00');
        break;
      case 'evening':
        setStartTime('17:00');
        setEndTime('21:00');
        break;
      case 'full_day':
        setStartTime('08:00');
        setEndTime('23:59');
        break;
    }
  }

  // Preset date range logic
  function setPresetRange(preset: Exclude<PresetRange, null>) {
    const now = new Date();
    let start = new Date();

    switch (preset) {
      case '1m':
        start.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        start.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        start.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        start = new Date('1970-01-01');
        break;
    }
    // Format dates for Guam timezone
    setStartDate(formatDateForGuam(start));
    setEndDate(formatDateForGuam(now));
    setSelectedPreset(preset);
    
    // Reset time preset to custom when using date presets
    setTimePreset('custom');
  }
  
  // Apply time preset logic
  function applyTimePreset(preset: TimePreset) {
    const now = new Date();
    let start = new Date();
    let granularity: TimeFrame = 'day'; // Default granularity
    
    switch (preset) {
      case '30min':
        start = new Date(now.getTime() - 30 * 60 * 1000);
        granularity = '30min';
        break;
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        granularity = '30min';
        break;
      case '3h':
        start = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        granularity = '30min';
        break;
      case '6h':
        start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        granularity = 'hour';
        break;
      case '12h':
        start = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        granularity = 'hour';
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        granularity = 'hour';
        break;
      case '7d':
        start.setDate(now.getDate() - 7);
        granularity = 'day';
        break;
      case 'custom':
        // Don't change dates for custom, just update the preset state
        return setTimePreset('custom');
    }
    
    // Update states with dates formatted for Guam timezone
    setStartDate(formatDateForGuam(start));
    setEndDate(formatDateForGuam(now));
    setTimeGranularity(granularity);
    setTimePreset(preset);
    setSelectedPreset(null); // Reset date preset when using time presets
    
    // For hour/minute level presets, we need to include the time component
    if (['30min', '1h', '3h', '6h', '12h', '24h'].includes(preset)) {
      // Format with time component for API, ensuring timezone is preserved
      // Convert to ISO string but adjust for Guam timezone (UTC+10)
      const formatDateTimeForGuam = (date: Date): string => {
        // Create a formatter that explicitly uses Guam timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Pacific/Guam'
        });
        
        const parts = formatter.formatToParts(date);
        const dateParts: Record<string, string> = {};
        
        parts.forEach(part => {
          if (part.type !== 'literal') {
            dateParts[part.type] = part.value;
          }
        });
        
        // Format as YYYY-MM-DDThh:mm:ss
        return `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
      };
      
      const startWithTime = formatDateTimeForGuam(start);
      const endWithTime = formatDateTimeForGuam(now);
      
      // Store full datetime for these short timeframes
      setStartDateWithTime(startWithTime);
      setEndDateWithTime(endWithTime);
    } else {
      // Clear time components for longer timeframes
      setStartDateWithTime(null);
      setEndDateWithTime(null);
    }
  }

  // ----- 2) Analytics States -----
  const [ordersData, setOrdersData] = useState<CustomerOrderReport[]>([]);
  const [guestSortCol, setGuestSortCol] = useState<SortColumn>('user_name');
  const [guestSortDir, setGuestSortDir] = useState<SortDirection>('asc');
  const [regSortCol, setRegSortCol] = useState<SortColumn>('user_name');
  const [regSortDir, setRegSortDir] = useState<SortDirection>('asc');

  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendItem[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementRow[]>([]);
  const [userSignups, setUserSignups] = useState<UserSignupItem[]>([]);
  const [activityHeatmap, setActivityHeatmap] = useState<HeatmapDataPoint[]>([]);
  const [dayNames, setDayNames] = useState<string[]>([]);
  
  // VIP Reports States
  const [menuItems, setMenuItems] = useState<MenuItemReport[]>([]);
  const [categories, setCategories] = useState<CategoryReport[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodReportType[]>([]);
  const [paymentTotals, setPaymentTotals] = useState({ amount: 0, count: 0 });
  const [vipCustomers, setVipCustomers] = useState<VipCustomerReportType[]>([]);
  const [vipSummary, setVipSummary] = useState<VipReportSummary>({
    total_vip_customers: 0,
    total_orders: 0,
    total_revenue: 0,
    average_orders_per_vip: 0,
    average_spend_per_vip: 0,
    repeat_customer_rate: 0
  });

  // ----- 3) Derived: Guest vs Registered -----
  const guestRows = useMemo(() => {
    const guests = ordersData.filter((r) => r.user_id === null);
    return sortReports(guests, guestSortCol, guestSortDir);
  }, [ordersData, guestSortCol, guestSortDir]);

  const registeredRows = useMemo(() => {
    const regs = ordersData.filter((r) => r.user_id !== null);
    return sortReports(regs, regSortCol, regSortDir);
  }, [ordersData, regSortCol, regSortDir]);

  // ----- 4) Load Analytics -----
  async function loadAnalytics() {
    try {
      let apiStartDate: string;
      let apiEndDate: string;
      
      // Determine which date format to use based on filters
      if (['30min', '1h', '3h', '6h', '12h', '24h'].includes(timePreset)) {
        // For short time presets, use the datetime with time component
        // These already have the correct Guam timezone formatting from applyTimePreset
        apiStartDate = startDateWithTime || startDate;
        apiEndDate = endDateWithTime || endDate;
      } else if (useTimeFilter) {
        // For custom time filter, combine date and time with explicit Guam timezone indicator
        // This ensures the backend knows we're sending Guam time
        apiStartDate = `${startDate}T${startTime}:00+10:00`;
        apiEndDate = `${endDate}T${endTime}:00+10:00`;
      } else {
        // Otherwise use just the date - these are already formatted for Guam
        apiStartDate = startDate;
        apiEndDate = endDate;
      }
      
      // 1) Customer Orders
      const custRes = await getCustomerOrdersReport(apiStartDate, apiEndDate);
      setOrdersData(custRes.results || []);

      // 2) Revenue Trend with selected time granularity
      const revTrend = await getRevenueTrend(timeGranularity, apiStartDate, apiEndDate);
      setRevenueTrend(revTrend.data || []);

      // 3) Top Items => limit=5
      const topRes = await getTopItems(5, apiStartDate, apiEndDate);
      setTopItems(topRes.top_items || []);

      // 4) Income Statement => by year
      const incRes = await getIncomeStatement(year);
      setIncomeStatement(incRes.income_statement || []);

      // 5) User Signups => by day
      const signupsRes = await getUserSignups(apiStartDate, apiEndDate);
      setUserSignups(signupsRes.signups || []);

      // 6) User Activity Heatmap
      const heatmapRes = await getUserActivityHeatmap(apiStartDate, apiEndDate);
      setActivityHeatmap(heatmapRes.heatmap || []);
      setDayNames(heatmapRes.day_names || []);
      
      // 7) Menu Item Performance Report
      const menuItemRes = await getMenuItemReport(apiStartDate, apiEndDate);
      setMenuItems(menuItemRes.data.items || []);
      setCategories(menuItemRes.data.categories || []);
      
      // 8) Payment Method Report
      const paymentMethodRes = await getPaymentMethodReport(apiStartDate, apiEndDate);
      setPaymentMethods(paymentMethodRes.data.payment_methods || []);
      setPaymentTotals({
        amount: paymentMethodRes.data.total_amount || 0,
        count: paymentMethodRes.data.total_count || 0
      });
      
      // 9) VIP Customer Report
      const vipRes = await getVipCustomerReport(apiStartDate, apiEndDate);
      setVipCustomers(vipRes.data.vip_customers || []);
      setVipSummary(vipRes.data.summary || {
        total_vip_customers: 0,
        total_orders: 0,
        total_revenue: 0,
        average_orders_per_vip: 0,
        average_spend_per_vip: 0,
        repeat_customer_rate: 0
      });

    } catch (err) {
      console.error('Failed to load analytics:', err);
      alert('Failed to load analytics. Check console for details.');
    }
  }

  // ----- 5) On Mount: Load default data -----
  React.useEffect(() => {
    // On first mount, fetch with the default date range
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- 6) Export Functions -----
  function exportOrdersToExcel() {
    if (ordersData.length === 0) {
      alert('No data to export');
      return;
    }

    // Summaries
    const guestSummary = guestRows.map((r) => ({
      Customer: r.user_name,
      'Total Spent': r.total_spent,
      'Order Count': r.order_count,
      'Total Items': r.items.reduce((sum, i) => sum + i.quantity, 0),
    }));
    const regSummary = registeredRows.map((r) => ({
      Customer: r.user_name,
      'Total Spent': r.total_spent,
      'Order Count': r.order_count,
      'Total Items': r.items.reduce((sum, i) => sum + i.quantity, 0),
    }));

    // Details
    const guestDetails: Array<Record<string, any>> = [];
    guestRows.forEach((r) => {
      r.items.forEach((itm) => {
        guestDetails.push({
          Customer: r.user_name,
          'Item Name': itm.name,
          Quantity: itm.quantity,
        });
      });
    });
    const regDetails: Array<Record<string, any>> = [];
    registeredRows.forEach((r) => {
      r.items.forEach((itm) => {
        regDetails.push({
          Customer: r.user_name,
          'Item Name': itm.name,
          Quantity: itm.quantity,
        });
      });
    });

    // Construct workbook
    const wb = XLSX.utils.book_new();
    // Summary sheet
    {
      const data: any[] = [];
      data.push(...guestSummary);
      data.push({});
      data.push(...regSummary);

      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, 'Summary');
    }
    // Details sheet
    {
      const data2: any[] = [];
      data2.push(...guestDetails);
      data2.push({});
      data2.push(...regDetails);

      const sheet2 = XLSX.utils.json_to_sheet(data2);
      XLSX.utils.book_append_sheet(wb, sheet2, 'Details');
    }

    // Include time in filename if time filter is enabled
    const filename = useTimeFilter
      ? `CustomerOrders_${startDate}T${startTime}_to_${endDate}T${endTime}.xlsx`
      : `CustomerOrders_${startDate}_to_${endDate}.xlsx`;
    
    XLSX.writeFile(wb, filename);
  }

  // Export all reports to a single Excel file
  function exportAllReports() {
    // Check if we have data to export
    const hasData = ordersData.length > 0 ||
                   revenueTrend.length > 0 ||
                   topItems.length > 0 ||
                   incomeStatement.length > 0 ||
                   userSignups.length > 0 ||
                   menuItems.length > 0 ||
                   paymentMethods.length > 0 ||
                   vipCustomers.length > 0;
    
    if (!hasData) {
      alert('No data to export');
      return;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add customer orders data
    if (ordersData.length > 0) {
      // Summaries
      const guestSummary = guestRows.map((r) => ({
        Customer: r.user_name,
        'Total Spent': r.total_spent,
        'Order Count': r.order_count,
        'Total Items': r.items.reduce((sum, i) => sum + i.quantity, 0),
      }));
      const regSummary = registeredRows.map((r) => ({
        Customer: r.user_name,
        'Total Spent': r.total_spent,
        'Order Count': r.order_count,
        'Total Items': r.items.reduce((sum, i) => sum + i.quantity, 0),
      }));

      // Details
      const guestDetails: Array<Record<string, any>> = [];
      guestRows.forEach((r) => {
        r.items.forEach((itm) => {
          guestDetails.push({
            Customer: r.user_name,
            'Item Name': itm.name,
            Quantity: itm.quantity,
          });
        });
      });
      const regDetails: Array<Record<string, any>> = [];
      registeredRows.forEach((r) => {
        r.items.forEach((itm) => {
          regDetails.push({
            Customer: r.user_name,
            'Item Name': itm.name,
            Quantity: itm.quantity,
          });
        });
      });

      // Add customer orders summary sheet
      const data: any[] = [];
      data.push(...guestSummary);
      data.push({});
      data.push(...regSummary);
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, 'Customer Orders');

      // Add customer orders details sheet
      const data2: any[] = [];
      data2.push(...guestDetails);
      data2.push({});
      data2.push(...regDetails);
      const sheet2 = XLSX.utils.json_to_sheet(data2);
      XLSX.utils.book_append_sheet(wb, sheet2, 'Order Details');
    }

    // Add revenue trend data
    if (revenueTrend.length > 0) {
      const revenueData = revenueTrend.map(item => ({
        'Date': item.label,
        'Revenue': `$${item.revenue.toFixed(2)}`
      }));
      const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
      XLSX.utils.book_append_sheet(wb, revenueSheet, 'Revenue Trend');
    }

    // Add top items data
    if (topItems.length > 0) {
      const topItemsData = topItems.map(item => ({
        'Item': item.item_name,
        'Quantity Sold': item.quantity_sold,
        'Revenue': `$${item.revenue.toFixed(2)}`
      }));
      const topItemsSheet = XLSX.utils.json_to_sheet(topItemsData);
      XLSX.utils.book_append_sheet(wb, topItemsSheet, 'Top Items');
    }

    // Add income statement data
    if (incomeStatement.length > 0) {
      const incomeData = incomeStatement.map(row => ({
        'Month': row.month,
        'Revenue': `$${row.revenue.toFixed(2)}`
      }));
      const incomeSheet = XLSX.utils.json_to_sheet(incomeData);
      XLSX.utils.book_append_sheet(wb, incomeSheet, 'Income Statement');
    }

    // Add user signups data
    if (userSignups.length > 0) {
      const signupsData = userSignups.map(item => ({
        'Date': item.date,
        'New Users': item.count
      }));
      const signupsSheet = XLSX.utils.json_to_sheet(signupsData);
      XLSX.utils.book_append_sheet(wb, signupsSheet, 'User Signups');
    }

    // Add menu items data
    if (menuItems.length > 0) {
      // Format menu item data
      const itemData = menuItems.map(item => ({
        'Item': item.name,
        'Category': item.category,
        'Quantity Sold': item.quantity_sold,
        'Revenue': `$${Number(item.revenue).toFixed(2)}`,
        'Avg. Price': `$${item.average_price ? Number(item.average_price).toFixed(2) : '0.00'}`
      }));

      // Format category data
      const categoryData = categories.map(cat => ({
        'Category': cat.name,
        'Items Sold': cat.quantity_sold,
        'Revenue': `$${Number(cat.revenue).toFixed(2)}`
      }));

      // Add menu items sheet
      const itemSheet = XLSX.utils.json_to_sheet(itemData);
      XLSX.utils.book_append_sheet(wb, itemSheet, 'Menu Items');

      // Add categories sheet
      const catSheet = XLSX.utils.json_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(wb, catSheet, 'Categories');
    }

    // Add payment methods data
    if (paymentMethods.length > 0) {
      // Format payment method data
      const paymentData = paymentMethods
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .map(method => ({
          'Payment Method': method.payment_method
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          'Count': method.count,
          'Amount': `$${Number(method.amount).toFixed(2)}`,
          'Percentage': `${Number(method.percentage).toFixed(2)}%`
        }));

      // Add total row
      paymentData.push({
        'Payment Method': 'Total',
        'Count': paymentTotals.count,
        'Amount': `$${Number(paymentTotals.amount).toFixed(2)}`,
        'Percentage': '100%'
      });

      // Add payment methods sheet
      const paymentSheet = XLSX.utils.json_to_sheet(paymentData);
      XLSX.utils.book_append_sheet(wb, paymentSheet, 'Payment Methods');
    }

    // Add VIP customers data
    if (vipCustomers.length > 0) {
      // Format summary data
      const summaryData = [
        { 'Metric': 'Total VIP Customers', 'Value': vipSummary.total_vip_customers },
        { 'Metric': 'Total Orders', 'Value': vipSummary.total_orders },
        { 'Metric': 'Total Revenue', 'Value': `$${Number(vipSummary.total_revenue).toFixed(2)}` },
        { 'Metric': 'Average Orders per VIP', 'Value': Number(vipSummary.average_orders_per_vip).toFixed(1) },
        { 'Metric': 'Average Spend per VIP', 'Value': `$${Number(vipSummary.average_spend_per_vip).toFixed(2)}` },
        { 'Metric': 'Repeat Customer Rate', 'Value': `${(Number(vipSummary.repeat_customer_rate) * 100).toFixed(0)}%` }
      ];

      // Format customer data
      const customerData = vipCustomers.map(customer => {
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
          'First Order': new Date(customer.first_order_date).toLocaleDateString(),
          'Most Ordered Items': topItems
        };
      });

      // Add VIP summary sheet
      const vipSummarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, vipSummarySheet, 'VIP Summary');

      // Add VIP customers sheet
      const vipCustomerSheet = XLSX.utils.json_to_sheet(customerData);
      XLSX.utils.book_append_sheet(wb, vipCustomerSheet, 'VIP Customers');
    }

    // Write file
    // Include time in filename if time filter is enabled
    const filename = useTimeFilter
      ? `ShimizuTech_Reports_${startDate}T${startTime}_to_${endDate}T${endTime}.xlsx`
      : `ShimizuTech_Reports_${startDate}_to_${endDate}.xlsx`;
    
    XLSX.writeFile(wb, filename);
  }

  // ----- 7) Render -----
  return (
    <div className="p-2 sm:p-4">
      {/* Header section */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h2>
        <p className="text-gray-600 text-xs sm:text-sm">View and analyze customer data and sales trends</p>
      </div>

      {/* 
        ============================================
        (A) Date Range + Preset Buttons + Load 
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 animate-fadeIn">
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-3">Analytics Date Range</h3>

        {/* Quick Time Presets */}
        <div className="mb-3 sm:mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quick Time Presets
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Recent */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">Recent</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => applyTimePreset('30min')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '30min' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  30 Min
                </button>
                <button
                  onClick={() => applyTimePreset('1h')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '1h' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  1 Hour
                </button>
                <button
                  onClick={() => applyTimePreset('3h')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '3h' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  3 Hours
                </button>
              </div>
            </div>
            
            {/* Today/Yesterday */}
            <div className="flex flex-col mt-2 sm:mt-0">
              <span className="text-xs text-gray-500 mb-1">Today/Yesterday</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => applyTimePreset('6h')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '6h' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  6 Hours
                </button>
                <button
                  onClick={() => applyTimePreset('12h')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '12h' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  12 Hours
                </button>
                <button
                  onClick={() => applyTimePreset('24h')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '24h' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  24 Hours
                </button>
              </div>
            </div>
            
            {/* Longer Period */}
            <div className="flex flex-col mt-2 sm:mt-0">
              <span className="text-xs text-gray-500 mb-1">Longer Period</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => applyTimePreset('7d')}
                  className={`px-2 py-1 text-xs rounded ${timePreset === '7d' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  7 Days
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enable Time Filter Checkbox */}
        <div className="mb-2">
          <label className="flex items-center text-sm font-medium text-blue-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useTimeFilter}
              onChange={(e) => toggleTimeFilter(e.target.checked)}
              className="mr-2 h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            Enable Specific Time Range Filter
          </label>
        </div>
        
        {/* Business Hours Presets - only show when time filter is enabled */}
        {useTimeFilter && (
          <div className="mb-3 sm:mb-4 ml-0 sm:ml-7">
            <div className="text-xs text-gray-500 mb-1">Common Business Hours</div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => applyBusinessHourPreset('morning')}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 mb-1"
              >
                Morning (8am-12pm)
              </button>
              <button
                onClick={() => applyBusinessHourPreset('lunch')}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 mb-1"
              >
                Lunch (12pm-2pm)
              </button>
              <button
                onClick={() => applyBusinessHourPreset('afternoon')}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 mb-1"
              >
                Afternoon (2pm-5pm)
              </button>
              <button
                onClick={() => applyBusinessHourPreset('evening')}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 mb-1"
              >
                Evening (5pm-9pm)
              </button>
              <button
                onClick={() => applyBusinessHourPreset('full_day')}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 mb-1"
              >
                Full Day (8am-12am)
              </button>
            </div>
          </div>
        )}
        
        {/* Manual Date Range */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          {/* Start Date and Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date {useTimeFilter ? '& Time' : ''}
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  handleChangeStartDate(e.target.value);
                  setTimePreset('custom');
                }}
                className="border rounded px-3 py-1 w-44"
              />
              {useTimeFilter && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleChangeStartTime(e.target.value)}
                  className="border rounded px-3 py-1 w-32"
                  placeholder="08:00 AM"
                />
              )}
            </div>
          </div>

          {/* End Date and Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date {useTimeFilter ? '& Time' : ''}
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  handleChangeEndDate(e.target.value);
                  setTimePreset('custom');
                }}
                className="border rounded px-3 py-1 w-44"
              />
              {useTimeFilter && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleChangeEndTime(e.target.value)}
                  className="border rounded px-3 py-1 w-32"
                  placeholder="11:59 PM"
                />
              )}
            </div>
          </div>
          
          {/* Data Granularity Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Granularity
            </label>
            <select
              value={timeGranularity}
              onChange={(e) => setTimeGranularity(e.target.value as TimeFrame)}
              className="border rounded px-3 py-1 w-44"
            >
              <option value="30min">30 Minutes</option>
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>

        {/* Preset Range Buttons */}
        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          {( ['1m','3m','6m','1y','all'] as const ).map((preset) => {
            const isSelected = selectedPreset === preset;
            return (
              <button
                key={preset}
                onClick={() => setPresetRange(preset)}
                className={
                  isSelected
                    ? 'px-3 py-1 bg-blue-500 text-white rounded'
                    : 'px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200'
                }
              >
                {preset === '1m' && 'Last 1 Month'}
                {preset === '3m' && 'Last 3 Months'}
                {preset === '6m' && 'Last 6 Months'}
                {preset === '1y' && 'Last 1 Year'}
                {preset === 'all' && 'All Time'}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {/* "Load Analytics" button */}
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-[#0078d4] text-white rounded hover:bg-[#005a9e]"
          >
            Load Analytics
          </button>
          
          {/* "Export All Reports" button - only show if we have data */}
          {(ordersData.length > 0 ||
            revenueTrend.length > 0 ||
            topItems.length > 0 ||
            incomeStatement.length > 0 ||
            userSignups.length > 0 ||
            menuItems.length > 0 ||
            paymentMethods.length > 0 ||
            vipCustomers.length > 0) && (
            <button
              onClick={exportAllReports}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
            >
              <span>Export All Reports</span>
            </button>
          )}
        </div>
      </div>

      {/* 
        ============================================
        (B) Customer Orders (with Export to Excel)
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-xl font-bold mb-4">Customer Orders</h3>

        {/* Export button if data is present */}
        {ordersData.length > 0 && (
          <button
            onClick={exportOrdersToExcel}
            className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export to Excel
          </button>
        )}

        {/* Guest Orders */}
        {guestRows.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-base sm:text-lg mb-2">Guest Orders</h4>
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="table-auto w-full text-xs sm:text-sm border border-gray-200 whitespace-nowrap min-w-[500px]">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (guestSortCol === 'user_name') {
                          setGuestSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setGuestSortCol('user_name');
                          setGuestSortDir('asc');
                        }
                      }}
                    >
                      Customer
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (guestSortCol === 'total_spent') {
                          setGuestSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setGuestSortCol('total_spent');
                          setGuestSortDir('asc');
                        }
                      }}
                    >
                      Total Spent
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (guestSortCol === 'order_count') {
                          setGuestSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setGuestSortCol('order_count');
                          setGuestSortDir('asc');
                        }
                      }}
                    >
                      Orders
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {guestRows.map((g, idx) => (
                    <tr 
                      key={idx} 
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2">{g.user_name}</td>
                      <td className="px-4 py-2">${g.total_spent.toFixed(2)}</td>
                      <td className="px-4 py-2">{g.order_count}</td>
                      <td className="px-4 py-2">
                        {g.items.map((itm, i2) => (
                          <div key={i2}>
                            {itm.name}{' '}
                            <span className="text-gray-600">x {itm.quantity}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Registered Users */}
        {registeredRows.length > 0 && (
          <div>
            <h4 className="font-semibold text-base sm:text-lg mb-2">Registered Users</h4>
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="table-auto w-full text-xs sm:text-sm border border-gray-200 whitespace-nowrap min-w-[500px]">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (regSortCol === 'user_name') {
                          setRegSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setRegSortCol('user_name');
                          setRegSortDir('asc');
                        }
                      }}
                    >
                      Customer
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (regSortCol === 'total_spent') {
                          setRegSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setRegSortCol('total_spent');
                          setRegSortDir('asc');
                        }
                      }}
                    >
                      Total Spent
                    </th>
                    <th
                      className="px-4 py-2 text-left font-semibold cursor-pointer"
                      onClick={() => {
                        if (regSortCol === 'order_count') {
                          setRegSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setRegSortCol('order_count');
                          setRegSortDir('asc');
                        }
                      }}
                    >
                      Orders
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Items
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registeredRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2">{r.user_name}</td>
                      <td className="px-4 py-2">${r.total_spent.toFixed(2)}</td>
                      <td className="px-4 py-2">{r.order_count}</td>
                      <td className="px-4 py-2">
                        {r.items.map((itm, i2) => (
                          <div key={i2}>
                            {itm.name}{' '}
                            <span className="text-gray-600">x {itm.quantity}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* If no orders at all */}
        {!ordersData.length && (
          <p className="text-gray-500 mt-2">
            No orders found for this range.
          </p>
        )}
      </div>

      {/* 
        ============================================
        (C) Revenue Trend 
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-xl font-bold mb-4">Revenue Trend</h3>
        {revenueTrend.length > 0 ? (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500">No revenue data in this range.</p>
        )}
      </div>

      {/* 
        ============================================
        (D) Top Items
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-xl font-bold mb-4">Top Items</h3>
        {topItems.length > 0 ? (
          <div className="flex flex-col space-y-2">
            {topItems.map((t, i) => (
              <div
                key={i}
                className="flex justify-between items-center bg-gray-50 rounded p-2"
              >
                <div className="text-gray-700 font-medium">
                  {t.item_name}
                </div>
                <div className="text-sm text-gray-600">
                  {t.quantity_sold} sold, ${t.revenue.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No item sales in this range.</p>
        )}
      </div>

      {/* 
        ============================================
        (E) Income Statement => Year
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-xl font-bold mb-4">Income Statement (Yearly)</h3>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm font-medium">Year:</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-1 w-24"
          />
        </div>

        {incomeStatement.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-auto w-full text-sm border border-gray-200">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Month</th>
                  <th className="px-4 py-2 text-left font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {incomeStatement.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">{row.month}</td>
                    <td className="px-4 py-2">${row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No data for year {year}.</p>
        )}
      </div>

      {/* 
        ============================================
        (F) User Signups => Daily
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-xl font-bold mb-4">User Signups</h3>
        {userSignups.length > 0 ? (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userSignups} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#4CAF50"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="New Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500">No user signup data in this range.</p>
        )}
      </div>

      {/* 
        ============================================
        (G) User Activity Heatmap
        ============================================
      */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-xl font-bold mb-4">User Activity Heatmap</h3>
        {activityHeatmap.length > 0 ? (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              This heatmap shows when users are most active, based on order data. 
              Darker colors indicate higher activity. Times are shown in Guam time (UTC+10).
            </p>
            
            {/* Create a structured grid for the heatmap */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead>
                  <tr>
                    <th className="w-24 border border-gray-200 bg-gray-50"></th>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      // Convert to 12-hour format with AM/PM
                      const hour12 = hour === 0 ? '12 AM' : 
                                    hour < 12 ? `${hour} AM` : 
                                    hour === 12 ? '12 PM' : 
                                    `${hour - 12} PM`;
                      
                      return (
                        <th 
                          key={hour} 
                          className="w-12 h-10 text-center text-xs py-2 font-medium text-gray-600 border border-gray-200 bg-gray-50"
                        >
                          {hour12}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dayNames.map((dayName, dayIndex) => {
                    return (
                      <tr key={dayIndex} className={dayIndex % 2 === 0 ? 'bg-gray-50/30' : ''}>
                        {/* Day label */}
                        <td className="w-24 py-3 px-4 text-sm font-medium text-gray-700 border border-gray-200">
                          {dayName}
                        </td>
                        
                        {/* Hour cells */}
                        {Array.from({ length: 24 }).map((_, hour) => {
                          // Convert from Guam time back to UTC for data lookup
                          const utcHour = (hour - 10 + 24) % 24;
                          
                          // Find data for this day and hour
                          const cellData = activityHeatmap.find(
                            item => item.day === dayIndex && item.hour === utcHour
                          );
                          
                          // Get the value or default to 0
                          const value = cellData?.value || 0;
                          
                          // Calculate color intensity
                          const maxValue = Math.max(...activityHeatmap.map(d => d.value), 1);
                          const intensity = maxValue > 0 ? (value / maxValue) : 0;
                          
                          // Generate background color
                          const bgColor = value > 0 
                            ? `rgba(193, 144, 47, ${Math.max(0.15, intensity)})`
                            : '';
                          
                          // Format for tooltip
                          const hour12 = hour === 0 ? '12 AM' : 
                                        hour < 12 ? `${hour} AM` : 
                                        hour === 12 ? '12 PM' : 
                                        `${hour - 12} PM`;
                          
                          return (
                            <td 
                              key={hour}
                              className="w-12 h-12 text-center border border-gray-200"
                              style={{ backgroundColor: bgColor }}
                              title={`${dayName} ${hour12} - ${value} orders`}
                            >
                              {value > 0 ? value : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center justify-end">
              <div className="text-sm text-gray-700 mr-3">Activity Level:</div>
              <div className="flex rounded-md overflow-hidden">
                <div className="w-8 h-6" style={{ backgroundColor: 'rgba(193, 144, 47, 0.15)' }}></div>
                <div className="w-8 h-6" style={{ backgroundColor: 'rgba(193, 144, 47, 0.3)' }}></div>
                <div className="w-8 h-6" style={{ backgroundColor: 'rgba(193, 144, 47, 0.5)' }}></div>
                <div className="w-8 h-6" style={{ backgroundColor: 'rgba(193, 144, 47, 0.7)' }}></div>
                <div className="w-8 h-6" style={{ backgroundColor: 'rgba(193, 144, 47, 0.9)' }}></div>
              </div>
              <div className="flex text-sm text-gray-700 ml-2">
                <span>Low</span>
                <span className="ml-24">High</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No activity data in this range.</p>
        )}
      </div>

      {/*
        ============================================
        (H) Menu Item Performance
        ============================================
      */}
      <MenuItemPerformance
        menuItems={menuItems}
        categories={categories}
      />

      {/*
        ============================================
        (I) Payment Method Report
        ============================================
      */}
      <PaymentMethodReport
        paymentMethods={paymentMethods}
        totalAmount={paymentTotals.amount}
        totalCount={paymentTotals.count}
      />

      {/*
        ============================================
        (J) VIP Customer Report
        ============================================
      */}
      <VipCustomerReport
        vipCustomers={vipCustomers}
        summary={vipSummary}
      />
    </div>
  );
}