// src/shared/api/endpoints/reports.ts

import { apiClient } from '../apiClient';

// Menu Item Report Types
export interface MenuItemReport {
  id: number;
  name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  average_price: number;
}

export interface CategoryReport {
  name: string;
  quantity_sold: number;
  revenue: number;
}

export interface MenuItemReportResponse {
  items: MenuItemReport[];
  categories: CategoryReport[];
}

// Payment Method Report Types
export interface PaymentMethodReport {
  payment_method: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface PaymentMethodReportResponse {
  payment_methods: PaymentMethodReport[];
  total_amount: number;
  total_count: number;
}

// VIP Customer Report Types
export interface VipCustomerReport {
  user_id: number | null;
  user_name: string;
  email: string;
  total_spent: number;
  order_count: number;
  first_order_date: string;
  last_order_date: string;
  average_order_value: number;
  items: {
    name: string;
    quantity: number;
  }[];
}

export interface VipReportSummary {
  total_vip_customers: number;
  total_orders: number;
  total_revenue: number;
  average_orders_per_vip: number;
  average_spend_per_vip: number;
  repeat_customer_rate: number;
}

export interface VipReportResponse {
  vip_customers: VipCustomerReport[];
  summary: VipReportSummary;
}

// API Functions
export const getMenuItemReport = (startDate: string, endDate: string) => {
  return apiClient.get<MenuItemReportResponse>('/admin/reports/menu_items', {
    params: { start_date: startDate, end_date: endDate }
  });
};

export const getPaymentMethodReport = (startDate: string, endDate: string) => {
  return apiClient.get<PaymentMethodReportResponse>('/admin/reports/payment_methods', {
    params: { start_date: startDate, end_date: endDate }
  });
};

export const getVipCustomerReport = (startDate: string, endDate: string) => {
  return apiClient.get<VipReportResponse>('/admin/reports/vip_customers', {
    params: { start_date: startDate, end_date: endDate }
  });
};