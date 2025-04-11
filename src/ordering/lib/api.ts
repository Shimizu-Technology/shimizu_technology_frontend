// src/ordering/lib/api.ts
// This is a proxy file that forwards all API requests to the shared API

import { 
  api as sharedApi, 
  getCustomerOrdersReport, 
  getRevenueTrend, 
  getTopItems, 
  getIncomeStatement,
  uploadMenuItemImage, // Re-export this from shared API
  uploadFile,
  objectToFormData,
  saveMenuItemWithImage
} from '../../shared/api';

// Create an extended API object with analytics functions
export const api = {
  ...sharedApi,
  getCustomerOrdersReport,
  getRevenueTrend,
  getTopItems,
  getIncomeStatement
};

// Re-export these utility functions
export { 
  uploadMenuItemImage, 
  uploadFile,
  objectToFormData,
  saveMenuItemWithImage
};
