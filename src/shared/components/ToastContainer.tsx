import React, { useEffect } from 'react';
import { Toaster, ToasterProps, toast } from 'react-hot-toast';
import toastUtils from '../utils/toastUtils';

/**
 * Enhanced Toast Container with improved toast management
 * 
 * This component wraps react-hot-toast's Toaster component and adds:
 * 1. Consistent styling across the application
 * 2. Automatic cleanup of stale toasts
 * 3. Click-to-dismiss functionality
 */
export const ToastContainer: React.FC<Partial<ToasterProps>> = (props) => {
  // Clean up any stale toasts when the component mounts
  useEffect(() => {
    // Perform an initial cleanup of any lingering toasts
    toastUtils.dismissAll();
    
    // Set up an interval to check for and dismiss stale toasts
    const cleanupInterval = setInterval(() => {
      // This helps prevent toast accumulation during high activity periods
      const toastElements = document.querySelectorAll('[role="status"]');
      if (toastElements.length > toastUtils.MAX_TOASTS) {
        toastUtils.dismissAll();
      }
    }, 10000); // Check every 10 seconds
    
    // Add click event listeners to make toasts dismissible by clicking
    const addClickListeners = () => {
      const toastElements = document.querySelectorAll('[role="status"]');
      toastElements.forEach(toast => {
        // Make toasts dismissible by clicking if they don't already have a click handler
        if (!toast.hasAttribute('data-click-handler-added')) {
          toast.setAttribute('data-click-handler-added', 'true');
          toast.addEventListener('click', () => {
            // Find the toast ID from the element's ID or data attribute
            const toastId = toast.id.replace('toast-', '') || toast.getAttribute('data-toastid');
            if (toastId) {
              // Use the imported toast library's dismiss function, not the DOM element
              window.requestAnimationFrame(() => {
                // Use the toast library's dismiss function
                toastUtils.dismiss(toastId);
              });
            } else {
              // If we can't find the specific ID, just dismiss all toasts
              window.requestAnimationFrame(() => {
                toastUtils.dismissAll();
              });
            }
          });
        }
      });
    };

    // Set up a mutation observer to watch for new toasts
    const observer = new MutationObserver(() => {
      setTimeout(addClickListeners, 100); // Small delay to ensure toast is fully rendered
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial check for existing toasts
    addClickListeners();
    
    return () => {
      clearInterval(cleanupInterval);
      observer.disconnect();
    };
  }, []);
  
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        // Global toast styling
        style: {
          maxWidth: '500px',
          // Make toasts look interactive
          cursor: 'pointer',
          // Add a subtle transition for swipe effect
          transition: 'all 0.3s ease-out',
        },
        // Global success toast styling
        success: {
          duration: toastUtils.DURATION.NORMAL,
        },
        // Global error toast styling
        error: {
          duration: toastUtils.DURATION.LONG,
        },
      }}
      // Limit the number of visible toasts
      containerStyle={{
        top: 40,
      }}
      // Add space between toasts
      gutter={8}
      {...props}
    />
  );
};

// Add CSS to enable swipe-to-dismiss
// This will be added to the document when the component is used
const addSwipeStyles = () => {
  // Check if the style has already been added
  if (document.getElementById('toast-swipe-styles')) return;
  
  const styleEl = document.createElement('style');
  styleEl.id = 'toast-swipe-styles';
  styleEl.innerHTML = `
    [role="status"] {
      touch-action: pan-x;
      transition: transform 0.2s ease-out !important;
    }
    
    [role="status"]:active {
      cursor: grabbing;
    }
    
    @media (pointer: coarse) {
      [role="status"] {
        animation: toast-swipe-hint 0.5s ease-out 0.5s;
      }
      
      @keyframes toast-swipe-hint {
        0% { transform: translateX(0); }
        20% { transform: translateX(-15px); }
        40% { transform: translateX(15px); }
        60% { transform: translateX(-5px); }
        80% { transform: translateX(5px); }
        100% { transform: translateX(0); }
      }
    }
  `;
  
  document.head.appendChild(styleEl);
};

// Add the swipe styles when this module is imported
if (typeof document !== 'undefined') {
  // Only run in browser environment
  addSwipeStyles();
}

export default ToastContainer;