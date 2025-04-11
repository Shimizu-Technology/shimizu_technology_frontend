// Using JSX requires the React import even if not directly referenced
// React is needed for JSX transformation even if not explicitly used
// @ts-ignore
import React from 'react';

/**
 * StripeFieldsSkeleton
 *
 * A skeleton UI component that mimics the appearance of Stripe payment fields
 * while they are loading. This improves perceived performance by showing
 * a placeholder immediately with consistent sizing to prevent layout shifts.
 */
export function StripeFieldsSkeleton() {
  return (
    <div className="stripe-skeleton animate-pulse w-full px-4 py-3 min-h-[200px] flex flex-col justify-center overflow-visible">
      {/* Loading message */}
      <div className="mb-4 text-center text-gray-600 text-sm">
        <p>Loading secure payment form...</p>
      </div>
      
      {/* Card number field skeleton */}
      <div className="mb-5">
        <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
        <div className="h-12 bg-gray-200 rounded-md w-full"></div>
      </div>
      
      {/* Expiry and CVC fields skeleton - side by side */}
      <div className="flex space-x-4 mb-5">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-12 bg-gray-200 rounded-md w-full"></div>
        </div>
        <div className="flex-1">
          <div className="h-4 w-16 bg-gray-200 rounded mb-2"></div>
          <div className="h-12 bg-gray-200 rounded-md w-full"></div>
        </div>
      </div>
      
      {/* Postal code field skeleton */}
      <div className="mb-4">
        <div className="h-4 w-28 bg-gray-200 rounded mb-2"></div>
        <div className="h-12 bg-gray-200 rounded-md w-full"></div>
      </div>
      
      {/* Animated loading indicator */}
      <div className="flex justify-center items-center mt-4">
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}