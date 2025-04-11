// src/ordering/utils/merchandiseUtils.ts
import { MerchandiseItem, MerchandiseVariant } from '../types/merchandise';
import { FilterOptions, ActiveFilters } from '../components/merchandise/FilterSidebar';

/**
 * Extract all available filter options from merchandise items
 */
export const extractFilterOptions = (items: MerchandiseItem[]): FilterOptions => {
  const sizes = new Set<string>();
  const colors = new Set<string>();
  
  // Track min and max prices to create price ranges
  let minPrice = Infinity;
  let maxPrice = 0;
  
  items.forEach(item => {
    // Track base price range
    minPrice = Math.min(minPrice, item.base_price);
    maxPrice = Math.max(maxPrice, item.base_price);
    
    
    // Extract unique colors and sizes from variants
    item.variants?.forEach(variant => {
      if (variant.size) sizes.add(variant.size);
      if (variant.color) colors.add(variant.color);
      
      // Calculate final price with adjustment for price ranges
      const variantPrice = item.base_price + variant.price_adjustment;
      minPrice = Math.min(minPrice, variantPrice);
      maxPrice = Math.max(maxPrice, variantPrice);
    });
  });
  
  // Create price ranges (e.g., $0-$25, $25-$50, $50-$100, $100+)
  const priceRanges = [];
  
  if (minPrice < maxPrice) {
    // Round to nearest $5 for clean ranges
    const roundedMin = Math.floor(minPrice / 5) * 5;
    const roundedMax = Math.ceil(maxPrice / 5) * 5;
    
    if (roundedMax <= 25) {
      // For lower price ranges, just do 0-max
      priceRanges.push({ min: 0, max: roundedMax });
    } else {
      // Standard price brackets
      priceRanges.push({ min: 0, max: 25 });
      
      if (roundedMax > 25) priceRanges.push({ min: 25, max: 50 });
      if (roundedMax > 50) priceRanges.push({ min: 50, max: 100 });
      if (roundedMax > 100) priceRanges.push({ min: 100, max: Infinity });
    }
  } else {
    // If all items have the same price, create a single range
    priceRanges.push({ min: 0, max: Math.ceil(maxPrice / 5) * 5 });
  }
  
  return {
    sizes: Array.from(sizes).sort((a, b) => {
      // Sort sizes in a logical order (XS, S, M, L, XL, XXL, etc.)
      const sizeOrder = { 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6, '4XL': 7, '5XL': 8 };
      return (sizeOrder[a as keyof typeof sizeOrder] ?? 99) - (sizeOrder[b as keyof typeof sizeOrder] ?? 99);
    }),
    colors: Array.from(colors).sort(),
    priceRanges,
    availability: ['in_stock', 'low_stock', 'out_of_stock']
  };
};

/**
 * Filter merchandise items based on active filters
 */
export const filterMerchandiseItems = (
  items: MerchandiseItem[],
  activeFilters: ActiveFilters
): MerchandiseItem[] => {
  return items.filter(item => {
    // Filter by availability
    if (activeFilters.availability.length > 0 && 
        !activeFilters.availability.includes(item.stock_status)) {
      return false;
    }
    
    // Filter by price range
    if (activeFilters.priceRange) {
      const { min, max } = activeFilters.priceRange;
      const price = item.base_price;
      
      // Check if any variant falls within the price range
      const anyVariantInRange = item.variants?.some(variant => {
        const finalPrice = price + variant.price_adjustment;
        return finalPrice >= min && (max === Infinity || finalPrice <= max);
      });
      
      // If base price not in range and no variants in range, filter out
      if (!(price >= min && (max === Infinity || price <= max)) && !anyVariantInRange) {
        return false;
      }
    }
    
    // Filter by size and color
    if (activeFilters.sizes.length > 0 || activeFilters.colors.length > 0) {
      // If item has no variants, filter it out if size or color filters are active
      if (!item.variants || item.variants.length === 0) {
        return false;
      }
      
      // Check if any variant matches all the active size and color filters
      const hasMatchingVariant = item.variants.some(variant => {
        // Check size filter
        const matchesSize = activeFilters.sizes.length === 0 || 
          (variant.size && activeFilters.sizes.includes(variant.size));
        
        // Check color filter
        const matchesColor = activeFilters.colors.length === 0 ||
          (variant.color && activeFilters.colors.includes(variant.color));
        
        return matchesSize && matchesColor;
      });
      
      if (!hasMatchingVariant) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Get default active filters (nothing selected)
 */
export const getDefaultActiveFilters = (): ActiveFilters => ({
  sizes: [],
  colors: [],
  priceRange: null,
  availability: []
});

/**
 * Get a specific variant based on selected size and color
 * 
 * @param item The merchandise item containing variants
 * @param selectedSize The selected size (optional)
 * @param selectedColor The selected color (optional)
 * @returns The matching variant or null if no match is found
 */
export const getSelectedVariant = (
  item: MerchandiseItem,
  selectedSize: string | null,
  selectedColor: string | null
): MerchandiseVariant | null => {
  // If no variants exist, return null
  if (!item.variants || item.variants.length === 0) {
    return null;
  }
  
  // If neither size nor color is selected, return null
  if (!selectedSize && !selectedColor) {
    return null;
  }
  
  // Find a variant that matches both the selected size and color
  const matchingVariant = item.variants.find(variant => {
    const sizeMatches = !selectedSize || variant.size === selectedSize;
    const colorMatches = !selectedColor || variant.color === selectedColor;
    return sizeMatches && colorMatches;
  });
  
  return matchingVariant || null;
};

/**
 * Calculate the final price for a merchandise item with optional variant
 * 
 * @param item The merchandise item
 * @param variant Optional variant that may affect the price
 * @returns The final price including any variant adjustments
 */
export const calculateFinalPrice = (
  item: MerchandiseItem,
  variant?: MerchandiseVariant | null
): number => {
  if (!variant) {
    return item.base_price;
  }
  
  return item.base_price + variant.price_adjustment;
};
