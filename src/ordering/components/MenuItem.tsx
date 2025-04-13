// src/ordering/components/MenuItem.tsx

import { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { CustomizationModal } from './CustomizationModal';
import type { MenuItem as MenuItemType } from '../types/menu';
import { deriveStockStatus, calculateAvailableQuantity } from '../utils/inventoryUtils';
import OptimizedImage from '../../shared/components/ui/OptimizedImage';
import useIntersectionObserver from '../../shared/hooks/useIntersectionObserver';

// LazyMenuItemImage component for lazy-loaded images
interface LazyMenuItemImageProps {
  image: string | undefined | null;
  name: string;
  featured?: boolean;
}

function LazyMenuItemImage({ image, name, featured }: LazyMenuItemImageProps) {
  const [ref, isVisible] = useIntersectionObserver({
    rootMargin: '200px', // Load images 200px before they enter the viewport
    triggerOnce: true // Only trigger once
  });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="w-full h-48 bg-gray-100">
      {isVisible ? (
        <OptimizedImage
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          width="400"
          height="192"
          priority={featured} // Priority loading for featured items
          fetchPriority={featured ? 'high' : 'auto'} // High priority for featured items
          context={featured ? 'featured' : 'menuItem'}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

// Helper function to format available days for display
function formatAvailableDays(days?: (number | string)[]): string {
  if (!days || days.length === 0) return 'Every day';
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Convert all values to numbers for consistent handling
  const daysAsNumbers = days.map(day => 
    typeof day === 'string' ? parseInt(day, 10) : day
  );
  
  if (daysAsNumbers.length === 1) {
    return `${dayNames[daysAsNumbers[0]]}s only`;
  } else if (daysAsNumbers.length === 7) {
    return 'Every day';
  } else if (daysAsNumbers.length > 3) {
    // If more than 3 days, show which days it's NOT available
    const excludedDays = dayNames
      .filter((_, index) => !daysAsNumbers.includes(index))
      .map(day => day.substring(0, 3));
    return `Not available on ${excludedDays.join(', ')}`;
  } else {
    // Show the days it IS available
    return daysAsNumbers.map(day => dayNames[day].substring(0, 3)).join(', ');
  }
}

interface MenuItemProps {
  item: MenuItemType;
  // index is optional and used by parent components for keying
  index?: number;
}

export function MenuItem({ item }: MenuItemProps) {
  const addToCart = useOrderStore((state) => state.addToCart);

  const [showCustomization, setShowCustomization] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);

  // Check status using utility function for consistency
  const stockStatus = deriveStockStatus(item);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  // Calculate available quantity (used in low stock badge display and display it in the UI)
  const availableQuantity = calculateAvailableQuantity(item);
  
  // Check if the item has required option groups with all options unavailable
  const hasUnavailableRequiredOptions = item.has_required_unavailable_options === true;

  function handleQuickAdd() {
    if (isOutOfStock) {
      alert('Sorry, this item is out of stock.');
      return;
    }
    
    if (hasUnavailableRequiredOptions) {
      alert('Sorry, this item is currently unavailable due to required customization options being out of stock.');
      return;
    }
    // For quick add, quantity=1 and no customizations
    addToCart(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        customizations: [],
        image: item.image, // Include the image property
      },
      1
    );
    setButtonClicked(true);
    setTimeout(() => setButtonClicked(false), 300);
  }

  function handleOpenCustomization() {
    if (isOutOfStock) {
      alert('Sorry, this item is out of stock.');
      return;
    }
    
    if (hasUnavailableRequiredOptions) {
      alert('Sorry, this item is currently unavailable due to required customization options being out of stock.');
      return;
    }
    
    setShowCustomization(true);
  }

  // If item is seasonal => show promo_label or fallback "Limited Time"
  const specialLabel = item.seasonal
    ? (item as any).promo_label?.trim() || 'Limited Time'
    : null;

  // Format available_until as "February 17, 2025," etc.
  let formattedUntil = '';
  if (item.seasonal && item.available_until) {
    try {
      const parsed = new Date(item.available_until);
      if (!isNaN(parsed.getTime())) {
        formattedUntil = parsed.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      formattedUntil = item.available_until;
    }
  }

  return (
    <>
      <div
        className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col min-h-[380px] animate-fadeIn
          ${isOutOfStock || hasUnavailableRequiredOptions ? 'opacity-70' : ''}
        `}
      >
        <LazyMenuItemImage 
          image={item.image}
          name={item.name}
          featured={item.featured}
        />

        <div className="p-4 flex flex-col flex-1">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{item.description}</p>

            {/* Stock Status Badges */}
            {isOutOfStock && (
              <div className="mt-2 inline-block bg-gray-500 text-white text-xs font-bold rounded-full px-2 py-1">
                Out of Stock
              </div>
            )}
            {isLowStock && (
              <div className="mt-2 inline-block bg-orange-400 text-white text-xs font-bold rounded-full px-2 py-1">
                Low Stock {availableQuantity > 0 && ` (${availableQuantity} left)`}
              </div>
            )}
            {hasUnavailableRequiredOptions && (
              <div className="mt-2 inline-block bg-orange-500 text-white text-xs font-bold rounded-full px-2 py-1 group relative">
                <span className="flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  <span>Unavailable Options</span>
                </span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  This item has required options that are currently unavailable
                </div>
              </div>
            )}

            {/* Seasonal & availability notices */}
            {item.advance_notice_hours != null && item.advance_notice_hours >= 24 && (
              <p className="mt-1 text-sm text-red-600">
                Requires 24 hours notice
              </p>
            )}
            {specialLabel && (
              <div className="mt-2 inline-block bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1">
                {specialLabel}
              </div>
            )}
            {/* Day-specific availability */}
            {item.available_days && item.available_days.length > 0 && item.available_days.length < 7 && (
              <div className="mt-2 inline-block bg-purple-500 text-white text-xs font-bold rounded-full px-2 py-1 ml-1">
                {formatAvailableDays(item.available_days)}
              </div>
            )}
            {formattedUntil && (
              <p className="text-xs text-gray-600 mt-1">
                Available until {formattedUntil}
              </p>
            )}

            {/* If there's a status_note from the back end */}
            {item.status_note?.trim() && (
              <p className="mt-1 text-xs italic text-gray-700">
                {item.status_note}
              </p>
            )}
          </div>

          <div className="mt-auto pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-lg font-semibold text-gray-900">
              ${item.price.toFixed(2)}
            </span>

            {item.option_groups && item.option_groups.length > 0 ? (
              <button
                onClick={handleOpenCustomization}
                disabled={isOutOfStock}
                className={`w-full md:w-auto flex items-center justify-center px-4 py-2
                  border border-transparent rounded-md shadow-sm text-sm font-medium
                  text-white ${
                    isOutOfStock
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#0078d4] hover:bg-[#50a3d9]'
                  }
                `}
              >
                <Plus className="h-5 w-5 mr-2" />
                {isOutOfStock ? 'Unavailable' : 'Customize'}
              </button>
            ) : (
              <button
                onClick={handleQuickAdd}
                disabled={isOutOfStock}
                className={`w-full md:w-auto flex items-center justify-center px-4 py-2
                  rounded-md shadow-sm text-sm font-medium text-white
                  transition-transform
                  ${
                    isOutOfStock
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#0078d4] hover:bg-[#50a3d9]'
                  }
                  ${buttonClicked ? 'animate-bounce' : ''}
                `}
              >
                <Plus className="h-5 w-5 mr-2" />
                {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* If user chooses "Customize," show the modal */}
      {showCustomization && (
        <CustomizationModal
          item={item}
          onClose={() => setShowCustomization(false)}
        />
      )}
    </>
  );
}
