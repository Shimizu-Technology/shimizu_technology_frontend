import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterOptions {
  sizes: string[];
  colors: string[];
  priceRanges: {
    min: number;
    max: number;
  }[];
  availability: ('in_stock' | 'low_stock' | 'out_of_stock')[];
  categories?: string[];
}

export interface ActiveFilters {
  sizes: string[];
  colors: string[];
  priceRange: { min: number; max: number } | null;
  availability: ('in_stock' | 'low_stock' | 'out_of_stock')[];
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filterOptions: FilterOptions;
  activeFilters: ActiveFilters;
  onFilterChange: (newFilters: ActiveFilters) => void;
  onClearAll: () => void;
}

const FilterSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 py-4">
      <button
        className="w-full flex justify-between items-center mb-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-medium text-gray-900">{title}</h3>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
};

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen,
  onClose,
  filterOptions,
  activeFilters,
  onFilterChange,
  onClearAll,
}) => {
  // Helper functions to update individual filter types
  const toggleSize = (size: string) => {
    const newSizes = activeFilters.sizes.includes(size)
      ? activeFilters.sizes.filter(s => s !== size)
      : [...activeFilters.sizes, size];
    
    onFilterChange({
      ...activeFilters,
      sizes: newSizes
    });
  };

  const toggleColor = (color: string) => {
    const newColors = activeFilters.colors.includes(color)
      ? activeFilters.colors.filter(c => c !== color)
      : [...activeFilters.colors, color];
    
    onFilterChange({
      ...activeFilters,
      colors: newColors
    });
  };

  const setPriceRange = (range: { min: number; max: number } | null) => {
    onFilterChange({
      ...activeFilters,
      priceRange: range
    });
  };

  const toggleAvailability = (status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
    const newAvailability = activeFilters.availability.includes(status)
      ? activeFilters.availability.filter(s => s !== status)
      : [...activeFilters.availability, status];
    
    onFilterChange({
      ...activeFilters,
      availability: newAvailability
    });
  };


  // Get human-readable names for availability statuses
  const getAvailabilityLabel = (status: string) => {
    switch (status) {
      case 'in_stock': return 'In Stock';
      case 'low_stock': return 'Low Stock';
      case 'out_of_stock': return 'Out of Stock';
      default: return status;
    }
  };

  // Get human-readable price range
  const getPriceRangeLabel = (range: { min: number; max: number }) => {
    if (range.max === Infinity) {
      return `$${range.min}+`;
    }
    return `$${range.min} - $${range.max}`;
  };

  // Pre-defined color mapping for common colors
  const getColorDisplay = (color: string) => {
    const colorMap: Record<string, string> = {
      'White': '#FFFFFF',
      'Black': '#000000',
      'Red': '#FF0000',
      'Blue': '#0000FF',
      'Green': '#008000',
      'Yellow': '#FFFF00',
      'Purple': '#800080',
      'Orange': '#FFA500',
      'Pink': '#FFC0CB',
      'Brown': '#A52A2A',
      'Gray': '#808080',
      'Navy': '#000080',
      'Beige': '#F5F5DC',
      'Teal': '#008080',
      'Gold': '#FFD700',
      'Silver': '#C0C0C0',
      'Maroon': '#800000',
      'Olive': '#808000',
      'Lime': '#00FF00',
      'Coral': '#FF7F50',
      'Aqua': '#00FFFF',
      'Turquoise': '#40E0D0'
    };

    return colorMap[color] || color.toLowerCase();
  };

  return (
    <div 
      className={`fixed inset-0 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:inset-auto lg:z-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Backdrop (mobile only) */}
      <div 
        className={`absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="relative z-10 h-full bg-white p-6 overflow-y-auto w-80 max-w-full shadow-lg lg:shadow-none">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <button
          onClick={onClearAll}
          className="mb-4 text-sm text-[#c1902f] hover:text-[#d4a43f] transition-colors"
        >
          Clear All
        </button>
        
        {/* Size Filter */}
        <FilterSection title="Size">
          <div className="flex flex-wrap gap-2">
            {filterOptions.sizes.map(size => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`h-9 w-10 flex items-center justify-center text-sm border ${
                  activeFilters.sizes.includes(size)
                    ? 'border-[#c1902f] bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </FilterSection>
        
        {/* Color Filter */}
        <FilterSection title="Color">
          <div className="flex flex-wrap gap-3">
            {filterOptions.colors.map(color => {
              const colorStyle = getColorDisplay(color);
              // Add inner border for light colors
              const innerBorder = ['#FFFFFF', 'White', 'white', '#F5F5DC', 'Beige', 'beige', '#FFFF00', 'Yellow', 'yellow'].includes(color) ? 
                "inset 0 0 0 1px rgba(0,0,0,0.1)" : "none";
              
              return (
                <button
                  key={color}
                  onClick={() => toggleColor(color)}
                  className={`
                    p-0.5 border rounded-full
                    ${activeFilters.colors.includes(color)
                      ? 'border-[#c1902f] ring-2 ring-[#c1902f] ring-opacity-30'
                      : 'border-gray-300 hover:border-gray-500'}
                  `}
                  title={color}
                >
                  <span 
                    className="block h-7 w-7 rounded-full"
                    style={{ 
                      backgroundColor: colorStyle,
                      boxShadow: innerBorder
                    }}
                  />
                </button>
              );
            })}
          </div>
          
          {/* Selected colors */}
          {activeFilters.colors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {activeFilters.colors.map(color => (
                <span key={color} className="text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-1 flex items-center">
                  {color}
                  <button 
                    onClick={() => toggleColor(color)}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </FilterSection>
        
        {/* Price Range Filter */}
        <FilterSection title="Price">
          <div className="flex flex-col gap-2">
            {filterOptions.priceRanges.map((range, index) => (
              <button
                key={index}
                onClick={() => setPriceRange(
                  activeFilters.priceRange?.min === range.min && 
                  activeFilters.priceRange?.max === range.max 
                    ? null 
                    : range
                )}
                className={`py-2 px-3 text-sm border rounded text-left ${
                  activeFilters.priceRange?.min === range.min && 
                  activeFilters.priceRange?.max === range.max
                    ? 'border-[#c1902f] bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {getPriceRangeLabel(range)}
              </button>
            ))}
          </div>
          
          {/* Price slider (optional enhancement) */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>$0</span>
              <span>$100+</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="10"
              value={activeFilters.priceRange?.min || 0}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setPriceRange(value === 0 ? null : { min: value, max: Infinity });
              }}
              className="w-full accent-[#c1902f]" 
            />
          </div>
        </FilterSection>
        
        {/* Availability Filter */}
        <FilterSection title="Availability">
          <div className="flex flex-col gap-2">
            {filterOptions.availability.map(status => (
              <button
                key={status}
                onClick={() => toggleAvailability(status)}
                className={`py-2 px-3 text-sm border rounded text-left flex items-center ${
                  activeFilters.availability.includes(status)
                    ? 'border-[#c1902f] bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`h-3 w-3 rounded-full mr-2 ${
                  status === 'in_stock' ? 'bg-green-500' : 
                  status === 'low_stock' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
                {getAvailabilityLabel(status)}
              </button>
            ))}
          </div>
        </FilterSection>
        
        
        {/* Apply and reset buttons for mobile */}
        <div className="mt-6 flex space-x-3 lg:hidden">
          <button
            onClick={onClearAll}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
