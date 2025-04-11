// src/shared/components/ui/SkeletonLoader.tsx
import React from 'react';

interface SkeletonProps {
  className?: string;
}

// Base skeleton component with shimmer effect
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded relative overflow-hidden ${className}`}
    >
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

// Menu item skeleton for use in menu pages
export function MenuItemSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 animate-slideUp">
      {/* Image placeholder */}
      <Skeleton className="w-full h-48" />
      
      {/* Content area */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        
        {/* Price and button area */}
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// Grid of menu item skeletons
export function MenuItemSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
      {Array(count).fill(0).map((_, index) => (
        <MenuItemSkeleton key={index} />
      ))}
    </div>
  );
}

// Cart item skeleton
export function CartItemSkeleton() {
  return (
    <div className="flex items-start space-x-4 p-4 border-b border-gray-200 transition-all duration-300 animate-slideUp">
      {/* Image placeholder */}
      <Skeleton className="w-20 h-20 rounded-md flex-shrink-0" />
      
      <div className="flex-grow space-y-2">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />
        
        {/* Options/customizations */}
        <div className="space-y-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        
        {/* Price and quantity */}
        <div className="flex justify-between items-center pt-1">
          <Skeleton className="h-5 w-16" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Cart item skeleton list
export function CartSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-200">
      {Array(count).fill(0).map((_, index) => (
        <CartItemSkeleton key={index} />
      ))}
    </div>
  );
}

// Order history item skeleton
export function OrderHistorySkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 transition-all duration-300 animate-slideUp">
      {/* Order number and date */}
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      
      {/* Order items summary */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      
      {/* Status and total */}
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

// Order history list
export function OrderHistorySkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array(count).fill(0).map((_, index) => (
        <OrderHistorySkeleton key={index} />
      ))}
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 transition-all duration-300 animate-fadeIn">
      {/* Profile header */}
      <div className="flex items-center space-x-4 mb-6">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Profile fields */}
      <div className="space-y-4">
        {Array(4).fill(0).map((_, index) => (
          <div key={index} className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Table row skeleton for admin tables
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center p-3 border-b border-gray-200 transition-all duration-300">
      {Array(columns).fill(0).map((_, index) => {
        // Vary the widths to make it look more natural
        const width = index === 0 ? 'w-12' : ['w-1/6', 'w-1/4', 'w-1/3', 'w-1/5'][index % 4];
        return (
          <div key={index} className={`px-2 ${index === columns - 1 ? 'text-right' : ''}`}>
            <Skeleton className={`h-5 ${width}`} />
          </div>
        );
      })}
    </div>
  );
}

// Table skeleton for admin tables
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden transition-all duration-300">
      {/* Table header */}
      <div className="bg-gray-50 p-3 border-b border-gray-200">
        <div className="flex items-center">
          {Array(columns).fill(0).map((_, index) => (
            <div key={index} className={`px-2 ${index === columns - 1 ? 'text-right' : ''}`}>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Table rows */}
      <div>
        {Array(rows).fill(0).map((_, index) => (
          <TableRowSkeleton key={index} columns={columns} />
        ))}
      </div>
    </div>
  );
}

// Analytics card skeleton
export function AnalyticsCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 transition-all duration-300 animate-slideUp">
      {/* Card title */}
      <Skeleton className="h-5 w-32 mb-3" />
      
      {/* Main value */}
      <Skeleton className="h-10 w-24 mb-4" />
      
      {/* Chart or graph */}
      <Skeleton className="h-32 w-full rounded-md" />
    </div>
  );
}

// Analytics dashboard skeleton
export function AnalyticsDashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300">
      {Array(6).fill(0).map((_, index) => (
        <AnalyticsCardSkeleton key={index} />
      ))}
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-5 transition-all duration-300 animate-fadeIn">
      {/* Form title */}
      <Skeleton className="h-6 w-48 mb-2" />
      
      {/* Form fields */}
      {Array(fields).fill(0).map((_, index) => (
        <div key={index} className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      
      {/* Submit button */}
      <div className="pt-2">
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
