/**
 * Toast utility functions to ensure consistent behavior across the application
 */
import toast from 'react-hot-toast';
import type { Toast, ToastOptions } from 'react-hot-toast';
import type { ReactNode } from 'react';

// Default durations
const DURATION = {
  SHORT: 3000,
  NORMAL: 5000,
  LONG: 8000,
  INFINITE: Infinity
};

// Maximum number of toasts to show at once
const MAX_TOASTS = 5;

// Track active toasts to prevent accumulation
let activeToasts: string[] = [];

// Default options applied to all toasts
const defaultOptions: ToastOptions = {
  // Enable click-to-dismiss by default
  // Note: react-hot-toast supports click-to-dismiss via the toast.dismiss() function
  // We'll implement swipe-to-dismiss in a separate component
  duration: DURATION.NORMAL
};

/**
 * Manages toast creation to prevent accumulation
 * @param createToast Function that creates the actual toast
 * @returns The toast ID
 */
const manageToast = (createToast: () => string): string => {
  // If we have too many toasts, remove the oldest ones
  if (activeToasts.length >= MAX_TOASTS) {
    const oldestToasts = activeToasts.slice(0, activeToasts.length - MAX_TOASTS + 1);
    oldestToasts.forEach(id => toast.dismiss(id));
    activeToasts = activeToasts.filter(id => !oldestToasts.includes(id));
  }
  
  // Create the toast and track it
  const id = createToast();
  activeToasts.push(id);
  
  // Set up cleanup when toast is dismissed
  setTimeout(() => {
    activeToasts = activeToasts.filter(toastId => toastId !== id);
  }, DURATION.LONG + 1000); // Add buffer time to ensure cleanup happens after toast is gone
  
  return id;
};

/**
 * Show a success toast with consistent styling and duration
 * @param message The message to display
 * @param options Optional toast options
 * @returns The toast ID
 */
export const showSuccess = (message: string, options?: ToastOptions): string => {
  return manageToast(() =>
    toast.success(message, {
      ...defaultOptions,
      duration: DURATION.NORMAL,
      ...options
    })
  );
};

/**
 * Show an error toast with consistent styling and duration
 * @param message The message to display
 * @param options Optional toast options
 * @returns The toast ID
 */
export const showError = (message: string, options?: ToastOptions): string => {
  return manageToast(() =>
    toast.error(message, {
      ...defaultOptions,
      duration: DURATION.LONG, // Errors stay a bit longer
      ...options
    })
  );
};

/**
 * Show a loading toast with proper cleanup
 * @param message The message to display
 * @param options Optional toast options
 * @returns A function to dismiss the toast and optionally show a result
 */
export const showLoading = (message: string, options?: ToastOptions) => {
  const toastId = manageToast(() =>
    toast.loading(message, {
      ...defaultOptions,
      duration: DURATION.LONG, // Loading toasts stay longer by default
      ...options
    })
  );
  
  // Return a function to dismiss this toast and optionally show a result
  return {
    dismiss: () => {
      toast.dismiss(toastId);
      activeToasts = activeToasts.filter(id => id !== toastId);
    },
    success: (successMessage: string, successOptions?: ToastOptions) => {
      toast.dismiss(toastId);
      activeToasts = activeToasts.filter(id => id !== toastId);
      return showSuccess(successMessage, successOptions);
    },
    error: (errorMessage: string, errorOptions?: ToastOptions) => {
      toast.dismiss(toastId);
      activeToasts = activeToasts.filter(id => id !== toastId);
      return showError(errorMessage, errorOptions);
    }
  };
};

/**
 * Show a custom toast with proper duration
 * @param render The render function for the custom toast
 * @param options Optional toast options
 * @returns The toast ID
 */
export const showCustom = (
  render: (t: Toast) => JSX.Element,
  options?: ToastOptions
): string => {
  return manageToast(() =>
    toast.custom(render, {
      ...defaultOptions,
      duration: options?.duration || DURATION.NORMAL,
      ...options
    })
  );
};

/**
 * Dismiss all toasts
 */
export const dismissAll = () => {
  toast.dismiss();
  activeToasts = [];
};

/**
 * Manually dismiss a specific toast by ID
 * @param id The toast ID to dismiss
 */
export const dismiss = (id: string) => {
  toast.dismiss(id);
  activeToasts = activeToasts.filter(toastId => toastId !== id);
};

export default {
  success: showSuccess,
  error: showError,
  loading: showLoading,
  custom: showCustom,
  dismiss,
  dismissAll,
  DURATION,
  // Expose the maximum number of toasts for configuration
  MAX_TOASTS
};
