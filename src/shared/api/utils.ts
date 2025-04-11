// src/shared/api/utils.ts
// Centralized utility functions for API operations

import { api } from './apiClient';

/**
 * Generic file upload utility that handles the creation of FormData
 * Can be used for any file upload in the application
 */
export const uploadFile = async (
  endpoint: string,
  file: File,
  fieldName: string = 'image',
  additionalData: Record<string, any> = {},
  method: 'POST' | 'PATCH' = 'POST'
) => {
  const formData = new FormData();
  
  // Add the file
  formData.append(fieldName, file);
  
  // Add additional data with proper nesting
  Object.entries(additionalData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        formData.append(`${key}[]`, String(item));
      });
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });
  
  return api.upload(endpoint, formData, method);
};

/**
 * Formats a nested object into FormData with proper Rails-style parameter naming
 * For use with multipart/form-data requests
 */
export const objectToFormData = (
  obj: Record<string, any>,
  parentKey?: string,
  formData: FormData = new FormData()
): FormData => {
  Object.entries(obj).forEach(([key, value]) => {
    const formKey = parentKey ? `${parentKey}[${key}]` : key;
    
    if (value instanceof File) {
      formData.append(formKey, value);
    } else if (value === null || value === undefined) {
      // Skip null and undefined values
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null && !(item instanceof File)) {
          objectToFormData(item, `${formKey}[${index}]`, formData);
        } else if (item !== null && item !== undefined) {
          formData.append(`${formKey}[]`, String(item));
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      objectToFormData(value, formKey, formData);
    } else {
      formData.append(formKey, String(value));
    }
  });
  
  return formData;
};
