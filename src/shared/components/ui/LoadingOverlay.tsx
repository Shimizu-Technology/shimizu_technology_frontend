// src/shared/components/ui/LoadingOverlay.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function LoadingOverlay({ isOpen }: LoadingOverlayProps) {
  // Don't render anything if not open
  if (!isOpen) return null;

  // Create a portal to render the overlay at the document body level
  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="loading-overlay"
    >
      <LoadingSpinner />
    </div>,
    document.body
  );
}

/**
 * Hook to show a loading overlay for the duration of an async operation
 * @param asyncFn The async function to execute while showing the loading overlay
 * @returns A function that will show the loading overlay while executing the async function
 * 
 * @example
 * const withLoading = useLoadingOverlay();
 * 
 * // Later in your code
 * const handleSubmit = async () => {
 *   await withLoading(async () => {
 *     // Your async code here
 *     await saveData();
 *   });
 * };
 */
export function useLoadingOverlay() {
  const [isLoading, setIsLoading] = React.useState(false);

  const withLoading = async <T,>(asyncFn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    try {
      return await asyncFn();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    withLoading,
    LoadingOverlayComponent: <LoadingOverlay isOpen={isLoading} />
  };
}
