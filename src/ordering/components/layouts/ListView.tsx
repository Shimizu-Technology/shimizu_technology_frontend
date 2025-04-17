// src/ordering/components/layouts/ListView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MenuItem } from '../../types/menu';
import { Plus, Coffee, Pizza, Salad, Sandwich, Utensils, Dessert, Wine } from 'lucide-react';
import { useOrderStore } from '../../store/orderStore';
import { CustomizationModal } from '../CustomizationModal';
import { deriveStockStatus, calculateAvailableQuantity } from '../../utils/inventoryUtils';
import OptimizedImage from '../../../shared/components/ui/OptimizedImage';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';

// Import our dietary icons component
import { DietaryIconsList, type DietaryType } from '../../../shared/components/icons/DietaryIcons';

interface ListViewProps {
  menuItems: MenuItem[];
  loading: boolean;
  selectedCategoryId: number | null;
  showFeaturedOnly: boolean;
  showSeasonalOnly: boolean;
}

/**
 * ListView component displays menu items in a compact, text-focused layout
 * This layout is optimized for menus with few or no images
 * Enhanced with modern styling and improved mobile responsiveness
 */
export const ListView: React.FC<ListViewProps> = ({
  menuItems,
  loading,
  selectedCategoryId,
  showFeaturedOnly,
  showSeasonalOnly
}) => {
  // Reference for the container
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="transition-opacity duration-300 ease-in-out" ref={containerRef}>
      {loading ? (
        // Show loading spinner while menu items are loading
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0078d4]"></div>
        </div>
      ) : (
        <div className="animate-fadeIn transition-opacity duration-300">
          {menuItems.length > 0 ? (
            // Regular rendering without virtualized list
            <div className="mt-3 flex flex-col space-y-4">
              {menuItems.map((item) => (
                <ListViewItem key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-gray-100 rounded-full p-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
              <p className="text-gray-500 max-w-md">
                {selectedCategoryId 
                  ? "There are no items in this category for the current menu." 
                  : "The current menu doesn't have any items yet."}
              </p>
              {(showFeaturedOnly || showSeasonalOnly) && (
                <p className="text-gray-500 mt-2">
                  Try removing the filters to see more items.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Individual list item component
const ListViewItem: React.FC<{ item: MenuItem }> = ({ item }) => {
  const addToCart = useOrderStore((state) => state.addToCart);
  const [showCustomization, setShowCustomization] = useState(false);
  const [buttonClicked, setButtonClicked] = useState(false);
  const { restaurant } = useRestaurantStore();
  
  // We'll always load images in list view for consistency
  useEffect(() => {
    // This effect is kept for future optimizations if needed
    // Currently, we're always showing images in list view
  }, []);
  
  // Check status using utility function for consistency
  const stockStatus = deriveStockStatus(item);
  const isOutOfStock = stockStatus === 'out_of_stock';
  const isLowStock = stockStatus === 'low_stock';
  const availableQuantity = calculateAvailableQuantity(item);
  
  // Check if this item has required option groups with all options unavailable
  const hasUnavailableRequiredOptions = item.has_required_unavailable_options === true;
  
  // Check if item has a custom image or is using the default placeholder
  const isPlaceholderImage = (
    !item.image || 
    item.image.includes('default-placeholder') || 
    item.image.includes('placeholder') || 
    item.image.includes('shimizu.png') || 
    item.image.includes('default.') || 
    item.image.includes('no-image')
  );
  const hasCustomImage = item.image && !isPlaceholderImage;
  
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
        image: item.image,
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

  // Format available days for display
  const formattedDays = item.available_days && item.available_days.length > 0
    ? formatAvailableDays(item.available_days)
    : null;

  // Get primary color based on restaurant
  const getPrimaryColor = () => {
    return restaurant?.id === 2 ? '#0078d4' : '#c1902f';
  };
  
  // Get category icon based on category ID or name
  const getCategoryIcon = () => {
    // Default icon
    let Icon = Utensils;
    
    // We could use category IDs for more precise icon mapping in the future
    // We could have a mapping of category IDs to icons, but for now we'll use a simpler approach
    // Get category name from the item description or name as fallback
    const itemText = (item.description || item.name || '').toLowerCase();
    
    if (itemText.includes('drink') || itemText.includes('beverage') || itemText.includes('coffee') || itemText.includes('tea')) {
      Icon = Coffee;
    } else if (itemText.includes('pizza') || itemText.includes('pie')) {
      Icon = Pizza;
    } else if (itemText.includes('salad') || itemText.includes('vegetable') || itemText.includes('greens')) {
      Icon = Salad;
    } else if (itemText.includes('sandwich') || itemText.includes('burger') || itemText.includes('wrap')) {
      Icon = Sandwich;
    } else if (itemText.includes('dessert') || itemText.includes('sweet') || itemText.includes('cake') || itemText.includes('ice cream')) {
      Icon = Dessert;
    } else if (itemText.includes('wine') || itemText.includes('alcohol') || itemText.includes('beer') || itemText.includes('cocktail')) {
      Icon = Wine;
    }
    
    return Icon;
  };
  
  const CategoryIcon = getCategoryIcon();
  const primaryColor = getPrimaryColor();

  // We're now using inline badges instead of the badge array

  // Extract dietary preferences (this would be more robust with actual data from the API)
  const dietaryTypes: DietaryType[] = [];
  
  if (item.vegetarian) {
    dietaryTypes.push('vegetarian');
  }
  
  if (item.vegan) {
    dietaryTypes.push('vegan');
  }
  
  if (item.gluten_free) {
    dietaryTypes.push('glutenFree');
  }
  
  if (item.dairy_free) {
    dietaryTypes.push('dairyFree');
  }
  
  if (item.nut_free) {
    dietaryTypes.push('nutFree');
  }
  
  if (item.spicy) {
    dietaryTypes.push('spicy');
  }

  return (
    <React.Fragment>
      <div 
        className={`bg-white rounded-lg shadow-sm hover:shadow overflow-hidden animate-fadeIn transition-all duration-300 touch-manipulation border border-gray-100 hover:border-gray-200 group relative ${isOutOfStock || hasUnavailableRequiredOptions ? 'opacity-70' : ''}`}
      >
        {/* Responsive layout that adapts to mobile and desktop */}
        <div className="flex flex-row relative overflow-hidden sm:h-[120px]"> 
          {/* Image area - either real image or placeholder icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 relative m-2 sm:m-0">
            {hasCustomImage ? (
              <>
                <OptimizedImage
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-md sm:rounded-none"
                  width="112"
                  height="112"
                  context="menuItem"
                  loading="lazy"
                  fetchPriority="low"
                  preload={false}
                />
                {/* Price tag overlay on image - hidden on mobile, shown on larger screens */}
                <div className="hidden sm:block absolute bottom-0 right-0 bg-white bg-opacity-90 px-2 py-1 text-sm font-medium text-gray-900 rounded-tl-md shadow-sm">
                  ${item.price.toFixed(2)}
                </div>
              </>
            ) : (
              <>
                {/* Placeholder with category icon for items without custom images */}
                <div 
                  className="w-full h-full flex items-center justify-center shadow-sm overflow-hidden rounded-md sm:rounded-none" 
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}30)`,
                    border: `1px solid ${primaryColor}20`
                  }}
                >
                  <CategoryIcon size={24} style={{ color: primaryColor }} />
                </div>
                {/* Price tag overlay on placeholder - hidden on mobile, shown on larger screens */}
                <div className="hidden sm:block absolute bottom-0 right-0 bg-white bg-opacity-90 px-2 py-1 text-sm font-medium text-gray-900 rounded-tl-md shadow-sm">
                  ${item.price.toFixed(2)}
                </div>
              </>
            )}
          </div>
          
          {/* Content area */}
          <div className="flex-1 p-2 sm:p-3 md:p-4 overflow-hidden pr-[70px] sm:pr-[90px]"> 
            <div className="flex flex-col h-full justify-between"> 
              <div>
                {/* Title and price row */}
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 mr-2 leading-tight">{item.name}</h3>
                  {/* Price shown on all screen sizes, positioned inline with title */}
                  <span className="text-sm sm:text-base font-medium text-gray-900 whitespace-nowrap">${item.price.toFixed(2)}</span>
                </div>
                
                {/* Description with strict character truncation */}
                {item.description && (
                  <div className="mt-1 max-h-[36px] overflow-hidden">
                    <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">
                      {item.description.length > 80 
                        ? `${item.description.substring(0, 80)}...` 
                        : item.description
                      }
                    </p>
                  </div>
                )}
              </div>
              
              {/* Badges container with horizontal scrolling on mobile */}
              <div className="flex flex-nowrap sm:flex-wrap gap-1.5 mb-2 mt-2 overflow-x-auto pb-1 hide-scrollbar">
                {/* Special notices like 24 hours */}
                {item.advance_notice_hours && item.advance_notice_hours > 0 ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {item.advance_notice_hours}h notice
                  </span>
                ) : null}
                
                {/* Featured badge */}
                {item.featured ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Featured
                  </span>
                ) : null}
                
                {/* Seasonal badge */}
                {item.seasonal ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {specialLabel || 'Seasonal'}
                  </span>
                ) : null}
                
                {/* Stock status badges */}
                {isLowStock ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    Only {availableQuantity} left
                  </span>
                ) : null}
                
                {isOutOfStock ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Out of Stock
                  </span>
                ) : null}
                
                {/* Available days badge */}
                {formattedDays ? (
                  <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {formattedDays}
                  </span>
                ) : null}
              </div>
              
              {/* Dietary icons - only shown if there's enough space */}
              {dietaryTypes.length > 0 && (
                <div className="hidden sm:block mt-1">
                  <DietaryIconsList 
                    types={dietaryTypes} 
                    size="sm"
                    className="flex-wrap" 
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Fixed position button - absolutely positioned in the bottom right */}
          <div className="absolute bottom-3 right-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (item.option_groups && item.option_groups.length > 0) {
                  handleOpenCustomization();
                } else {
                  handleQuickAdd();
                }
              }}
              className={`
                flex items-center justify-center px-2 py-1 sm:px-3 sm:py-1.5 rounded-md
                ${isOutOfStock || hasUnavailableRequiredOptions ? 'bg-gray-400' : 'bg-[#0078d4] hover:bg-[#50a3d9]'}
                text-white
                transition-all duration-200 ease-in-out
                text-xs font-medium shadow-sm hover:shadow
                min-w-[60px] sm:min-w-[80px] min-h-[28px] sm:min-h-[32px]
                ${buttonClicked ? 'animate-pulse' : ''}
                ${isOutOfStock || hasUnavailableRequiredOptions ? 'cursor-not-allowed' : ''}
              `}
              disabled={isOutOfStock || hasUnavailableRequiredOptions}
              aria-label={item.option_groups && item.option_groups.length > 0 ? "Customize item" : "Add to cart"}
            >
              {item.option_groups && item.option_groups.length > 0 ? (
                <span className="flex items-center">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span>Customize</span>
                </span>
              ) : (
                <span className="flex items-center">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Add
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Customization modal */}
      {showCustomization && (
        <CustomizationModal
          item={item}
          onClose={() => setShowCustomization(false)}
        />
      )}
    </React.Fragment>
  );
};

// Helper function to format available days for display
function formatAvailableDays(days?: (number | string)[]): string {
  if (!days || days.length === 0) return '';
  
  // Short day names for display
  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Convert day numbers to short names
  const formattedDays = days.map(day => {
    const dayNum = typeof day === 'string' ? parseInt(day, 10) : day;
    return shortDayNames[dayNum % 7];
  });
  
  // If all days are available, return "All days"
  if (formattedDays.length === 7) return 'All days';
  
  // If weekdays only
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (weekdays.every(day => formattedDays.includes(day)) && 
      !formattedDays.includes('Sun') && 
      !formattedDays.includes('Sat')) {
    return 'Weekdays';
  }
  
  // If weekends only
  if (formattedDays.length === 2 && 
      formattedDays.includes('Sun') && 
      formattedDays.includes('Sat')) {
    return 'Weekends';
  }
  
  // Otherwise, join with commas
  return formattedDays.join(', ');
}

export default ListView;
