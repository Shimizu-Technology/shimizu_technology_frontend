// src/ordering/components/MenuItem.tsx

import { useState, memo, Fragment } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { useRestaurantStore } from '../../shared/store/restaurantStore';
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
  isFirstVisible?: boolean; // Flag to identify the first visible item (potential LCP)
  index?: number; // Item index for prioritization
  restaurantFallbackSrc?: string; // Restaurant-specific fallback image
}

const LazyMenuItemImage = memo(function LazyMenuItemImage({ 
  image, 
  name, 
  featured, 
  isFirstVisible = false,
  index = 0,
  restaurantFallbackSrc
}: LazyMenuItemImageProps) {
  const [ref, isVisible] = useIntersectionObserver({
    rootMargin: '300px', // Increased from 200px to load images earlier
    triggerOnce: true, // Only trigger once
    threshold: 0.1 // Trigger when 10% of the element is visible
  });

  // Determine if this image is critical for LCP
  // First 6 items or featured items are considered important
  const isImportantForLCP = isFirstVisible || featured || index < 6;
  
  // Width and height are now handled by the context in OptimizedImage

  return (
    <div 
      ref={ref as React.RefObject<HTMLDivElement>} 
      className="w-full h-48 bg-gray-100 overflow-hidden"
      style={{ contain: 'paint layout' }} // Add content-visibility optimization
    >
      {isVisible ? (
        <OptimizedImage
          src={image}
          alt={name}
          context="menuItem"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          priority={isImportantForLCP}
          isLCP={isFirstVisible}
          restaurantFallbackSrc={restaurantFallbackSrc}
        />
      ) : (
        <div 
          className="w-full h-full bg-gray-200 animate-pulse" 
          style={{ 
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
      )}
      {featured && (
        <div className="absolute top-2 right-2 bg-shimizu-blue/10 text-shimizu-blue text-xs font-medium rounded-md px-2 py-0.5 shadow-sm">
          Featured
        </div>
      )}
    </div>
  );
});

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
  layout?: 'gallery' | 'list';
}

export const MenuItem = memo(function MenuItem({ item, index = 0, layout = 'gallery' }: MenuItemProps) {
  const addToCart = useOrderStore((state) => state.addToCart);
  const restaurant = useRestaurantStore((state) => state.restaurant);

  const [showCustomization, setShowCustomization] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  
  // Check status using utility function for consistency
  const stockStatus = deriveStockStatus(item);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  // Calculate available quantity (used in low stock badge display and display it in the UI)
  const availableQuantity = calculateAvailableQuantity(item);
  
  // Check if this item has required option groups with all options unavailable
  const hasUnavailableRequiredOptions = item.has_required_unavailable_options === true;
  
  // Check if this item has customization options
  // Since we're now fetching complete data with option_groups, we can simply check if option_groups exists and has items
  const hasCustomizations = Boolean(item.option_groups && item.option_groups.length > 0);

  function handleQuickAdd() {
    if (isOutOfStock) {
      alert('Sorry, this item is out of stock.');
      return;
    }
    
    if (hasUnavailableRequiredOptions) {
      alert('Sorry, this item has required options that are currently unavailable.');
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
      alert('Sorry, this item has required options that are currently unavailable.');
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
    <Fragment>
      {layout === 'gallery' ? (
        // Gallery view layout - Enhanced design
        <div
          className={`bg-white rounded-lg shadow-sm hover:shadow-md overflow-hidden flex flex-col min-h-[380px] animate-fadeIn
            border border-gray-100 hover:border-gray-200 transition-all duration-300
            ${isOutOfStock || hasUnavailableRequiredOptions ? 'opacity-70' : ''}`
          }
        >
          <LazyMenuItemImage 
            image={item.image}
            name={item.name}
            featured={item.featured}
            isFirstVisible={index === 0}
            index={index}
            restaurantFallbackSrc={restaurant?.admin_settings?.fallback_image_url}
          />

          <div className="p-5 flex flex-col flex-1">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-shimizu-blue transition-colors">{item.name}</h3>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.description}</p>

              {/* Badges and notices */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {/* Special notices like 24 hours */}
                {item.advance_notice_hours && item.advance_notice_hours > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Requires {item.advance_notice_hours} hours notice
                  </span>
                ) : null}
                
                {/* Featured badge is now only shown on the image */}
                
                {/* Seasonal badge */}
                {item.seasonal ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {specialLabel || 'Seasonal'}
                  </span>
                ) : null}
                
                {/* Stock status badges */}
                {isLowStock ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    Only {availableQuantity} left
                  </span>
                ) : null}
                
                {isOutOfStock ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Out of Stock
                  </span>
                ) : null}

                {/* Unavailable required options badge */}
                {hasUnavailableRequiredOptions ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 group relative">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>Unavailable Options</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      This item has required options that are currently unavailable
                    </div>
                  </span>
                ) : null}
                
                {/* Day-specific availability */}
                {item.available_days && item.available_days.length > 0 && item.available_days.length < 7 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {formatAvailableDays(item.available_days)}
                  </span>
                ) : null}
              </div>
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
              <span className="text-lg font-semibold text-shimizu-blue">
                ${item.price.toFixed(2)}
              </span>
              {hasCustomizations ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCustomization();
                  }}
                  className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent
                             text-sm font-medium rounded-md shadow-sm text-white bg-shimizu-blue hover:bg-shimizu-light-blue
                             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-shimizu-blue
                             transform hover:-translate-y-0.5 transition-all duration-200"
                  disabled={isOutOfStock || hasUnavailableRequiredOptions}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {isOutOfStock ? 'Unavailable' : 'Customize'}
                </button>
              ) : (
                <button
                  onClick={handleQuickAdd}
                  disabled={isOutOfStock || hasUnavailableRequiredOptions}
                  className={`w-full md:w-auto flex items-center justify-center px-4 py-2
                    rounded-md shadow-sm text-sm font-medium text-white
                    transition-transform
                    ${isOutOfStock || hasUnavailableRequiredOptions
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-shimizu-blue hover:bg-shimizu-light-blue'
                    }
                    ${buttonClicked ? 'animate-bounce' : ''}
                  `}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {isOutOfStock ? 'Unavailable' : 'Add'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // List view layout
        <div
          className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-row animate-fadeIn
            ${isOutOfStock || hasUnavailableRequiredOptions ? 'opacity-70' : ''}
          `}
        >
          <div className="w-1/3 max-w-[160px]">
            <LazyMenuItemImage 
              image={item.image}
              name={item.name}
              featured={item.featured}
              isFirstVisible={index === 0}
              index={index}
              restaurantFallbackSrc={restaurant?.admin_settings?.fallback_image_url}
            />
          </div>
          
          <div className="p-4 flex flex-col flex-1">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>

              {/* Badges and notices - condensed for list view */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {/* Special notices like 24 hours */}
                {item.advance_notice_hours && item.advance_notice_hours > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Requires {item.advance_notice_hours} hours notice
                  </span>
                ) : null}
                
                {/* Featured badge is now only shown on the image */}
                
                {/* Seasonal badge */}
                {item.seasonal ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-shimizu-blue/10 text-shimizu-blue">
                    {specialLabel || 'Seasonal'}
                  </span>
                ) : null}
                
                {/* Stock status badges */}
                {isLowStock ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    Only {availableQuantity} left
                  </span>
                ) : null}
                
                {isOutOfStock ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Out of Stock
                  </span>
                ) : null}

                {/* Unavailable required options badge */}
                {hasUnavailableRequiredOptions ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 group relative">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>Unavailable Options</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      This item has required options that are currently unavailable
                    </div>
                  </span>
                ) : null}
                
                {/* Day-specific availability */}
                {item.available_days && item.available_days.length > 0 && item.available_days.length < 7 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {formatAvailableDays(item.available_days)}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Price and Add to Cart button */}
            <div className="mt-2 pt-2 flex justify-between items-center">
              <div className="text-lg font-bold">${item.price.toFixed(2)}</div>
              
              {hasCustomizations ? (
                <button
                  onClick={handleOpenCustomization}
                  disabled={isOutOfStock || hasUnavailableRequiredOptions}
                  className={`
                    flex-1 flex items-center justify-center px-4 py-2 rounded-md
                    ${isOutOfStock || hasUnavailableRequiredOptions ? 'bg-gray-400' : 'bg-shimizu-blue hover:bg-shimizu-light-blue'}
                    text-white font-medium
                    transition-colors duration-200 ease-in-out shadow-sm hover:shadow
                    ${isOutOfStock || hasUnavailableRequiredOptions ? 'cursor-not-allowed' : ''}
                  `}
                  aria-label="Customize item"
                >
                  <span className="flex items-center">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Customize
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleQuickAdd}
                  disabled={isOutOfStock || hasUnavailableRequiredOptions}
                  className={`
                    flex-1 flex items-center justify-center px-4 py-2 rounded-md
                    ${isOutOfStock || hasUnavailableRequiredOptions ? 'bg-gray-400' : 'bg-shimizu-blue hover:bg-shimizu-light-blue'}
                    text-white font-medium
                    transition-colors duration-200 ease-in-out shadow-sm hover:shadow
                    ${buttonClicked ? 'animate-pulse' : ''}
                    ${isOutOfStock || hasUnavailableRequiredOptions ? 'cursor-not-allowed' : ''}
                  `}
                  aria-label="Add to cart"
                >
                  <span className="flex items-center">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* If user chooses "Customize," show the modal */}
      {showCustomization && (
        <CustomizationModal
          item={item}
          onClose={() => setShowCustomization(false)}
        />
      )}
    </Fragment>
  );
});

export default MenuItem;
