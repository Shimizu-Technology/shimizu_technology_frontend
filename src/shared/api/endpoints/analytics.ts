// src/shared/api/endpoints/analytics.ts

import { api } from '../apiClient';

// Types for analytics responses
export interface CustomerOrderItem {
  name: string;
  quantity: number;
}

export interface CustomerOrderReport {
  user_id: number | null;
  user_name: string;
  total_spent: number;
  order_count: number;
  items: CustomerOrderItem[];
}

export interface CustomerOrdersResponse {
  results: CustomerOrderReport[];
}

export interface RevenueTrendItem {
  label: string;
  revenue: number;
}

export interface RevenueTrendResponse {
  data: RevenueTrendItem[];
}

export interface TopItem {
  item_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface TopItemsResponse {
  top_items: TopItem[];
}

export interface IncomeStatementRow {
  month: string;
  revenue: number;
}

export interface IncomeStatementResponse {
  income_statement: IncomeStatementRow[];
}

export interface UserSignupItem {
  date: string;
  count: number;
}

export interface UserSignupsResponse {
  signups: UserSignupItem[];
}

export interface HeatmapDataPoint {
  day: number;
  hour: number;
  value: number;
}

export interface UserActivityHeatmapResponse {
  day_names: string[];
  heatmap: HeatmapDataPoint[];
}

/**
 * Get customer orders report
 */
export const getCustomerOrdersReport = async (startDate: string, endDate: string): Promise<CustomerOrdersResponse> => {
  return api.get<CustomerOrdersResponse>('/admin/analytics/customer_orders', { start: startDate, end: endDate });
};

/**
 * Get revenue trend
 */
export const getRevenueTrend = async (interval: string, startDate: string, endDate: string): Promise<RevenueTrendResponse> => {
  return api.get<RevenueTrendResponse>('/admin/analytics/revenue_trend', { interval, start: startDate, end: endDate });
};

/**
 * Get top items
 */
export const getTopItems = async (limit: number, startDate: string, endDate: string): Promise<TopItemsResponse> => {
  return api.get<TopItemsResponse>('/admin/analytics/top_items', { limit, start: startDate, end: endDate });
};

/**
 * Get income statement
 */
export const getIncomeStatement = async (year: number): Promise<IncomeStatementResponse> => {
  return api.get<IncomeStatementResponse>('/admin/analytics/income_statement', { year });
};

/**
 * Get user signups per day
 */
export const getUserSignups = async (startDate: string, endDate: string): Promise<UserSignupsResponse> => {
  return api.get<UserSignupsResponse>('/admin/analytics/user_signups', { start: startDate, end: endDate });
};

/**
 * Get user activity heatmap data (by day of week and hour)
 */
export const getUserActivityHeatmap = async (startDate: string, endDate: string): Promise<UserActivityHeatmapResponse> => {
  return api.get<UserActivityHeatmapResponse>('/admin/analytics/user_activity_heatmap', { start: startDate, end: endDate });
};
