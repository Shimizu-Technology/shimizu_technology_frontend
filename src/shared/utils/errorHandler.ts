// src/shared/utils/errorHandler.ts

/**
 * Handles API errors and returns a user-friendly error message
 * @param error The error object from the API call
 * @param fallbackMessage Optional fallback message if no specific error could be extracted
 * @returns A string with a user-friendly error message
 */
export const handleApiError = (error: any, fallbackMessage?: string): string => {
  if (error?.response?.data?.errors) {
    // Rails API typically returns errors in this format
    const errors = error.response.data.errors;
    if (Array.isArray(errors)) {
      return errors.join(', ');
    } else if (typeof errors === 'string') {
      return errors;
    } else if (typeof errors === 'object') {
      // Handle object of errors like { name: ["can't be blank"], ... }
      return Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
    }
  }
  
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return fallbackMessage || 'An unexpected error occurred';
};
