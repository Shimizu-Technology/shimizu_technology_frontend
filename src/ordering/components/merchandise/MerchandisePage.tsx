// src/ordering/components/merchandise/MerchandisePage.tsx
import React, { useEffect, useState } from 'react';
import { useMerchandiseStore } from '../../store/merchandiseStore';
import { MerchandiseItem } from './MerchandiseItem';
import { Filter, SlidersHorizontal, X } from 'lucide-react';

export function MerchandisePage() {
  const { 
    merchandiseItems, 
    categories, 
    collections,
    fetchMerchandiseItems, 
    fetchCategories,
    fetchCollections,
    loading, 
    error 
  } = useMerchandiseStore();
  
  // State for filters
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch data on mount
  useEffect(() => {
    fetchMerchandiseItems();
    fetchCategories();
    fetchCollections();
  }, [fetchMerchandiseItems, fetchCategories, fetchCollections]);
  
  // Extract all available sizes and colors from all items
  const allSizes = new Set<string>();
  const allColors = new Set<string>();
  
  merchandiseItems.forEach(item => {
    item.variants.forEach(variant => {
      if (variant.size) allSizes.add(variant.size);
      if (variant.color) allColors.add(variant.color);
    });
  });
  
  // Apply filters to items
  const filteredItems = merchandiseItems.filter(item => {
    // Category filter
    if (selectedCategory !== null && item.category_id !== selectedCategory) {
      return false;
    }
    
    // Size filter
    if (selectedSizes.size > 0) {
      const itemHasSelectedSize = item.variants.some(variant => 
        variant.size && selectedSizes.has(variant.size)
      );
      if (!itemHasSelectedSize) return false;
    }
    
    // Color filter
    if (selectedColors.size > 0) {
      const itemHasSelectedColor = item.variants.some(variant => 
        variant.color && selectedColors.has(variant.color)
      );
      if (!itemHasSelectedColor) return false;
    }
    
    return true;
  });
  
  // Toggle a size filter
  const toggleSize = (size: string) => {
    setSelectedSizes(prev => {
      const newSizes = new Set(prev);
      if (newSizes.has(size)) {
        newSizes.delete(size);
      } else {
        newSizes.add(size);
      }
      return newSizes;
    });
  };
  
  // Toggle a color filter
  const toggleColor = (color: string) => {
    setSelectedColors(prev => {
      const newColors = new Set(prev);
      if (newColors.has(color)) {
        newColors.delete(color);
      } else {
        newColors.add(color);
      }
      return newColors;
    });
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedSizes(new Set());
    setSelectedColors(new Set());
  };
  
  // Check if any filters are active
  const hasActiveFilters = selectedCategory !== null || selectedSizes.size > 0 || selectedColors.size > 0;
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shop Merchandise</h1>
      
      {/* Mobile filter button */}
      <div className="lg:hidden mb-4">
        <button
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 bg-[#c1902f] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {(selectedCategory !== null ? 1 : 0) + selectedSizes.size + selectedColors.size}
            </span>
          )}
        </button>
      </div>
      
      <div className="lg:grid lg:grid-cols-4 lg:gap-8">
        {/* Filters - Desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-20 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Filters</h2>
              {hasActiveFilters && (
                <button
                  className="text-sm text-[#c1902f] hover:text-[#d4a43f]"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              )}
            </div>
            
            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Categories</h3>
                <div className="space-y-2">
                  {categories.map(category => (
                    <div key={category.id} className="flex items-center">
                      <input
                        id={`category-${category.id}`}
                        type="radio"
                        name="category"
                        checked={selectedCategory === category.id}
                        onChange={() => setSelectedCategory(
                          selectedCategory === category.id ? null : category.id
                        )}
                        className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300"
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="ml-2 text-sm text-gray-700"
                      >
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Sizes */}
            {allSizes.size > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Sizes</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(allSizes).map(size => (
                    <button
                      key={size}
                      className={`px-3 py-1 text-sm border rounded-md
                        ${selectedSizes.has(size)
                          ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                          : 'border-gray-300 text-gray-700 hover:border-[#c1902f]'
                        }`}
                      onClick={() => toggleSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Colors */}
            {allColors.size > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Colors</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(allColors).map(color => (
                    <button
                      key={color}
                      className={`px-3 py-1 text-sm border rounded-md
                        ${selectedColors.has(color)
                          ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                          : 'border-gray-300 text-gray-700 hover:border-[#c1902f]'
                        }`}
                      onClick={() => toggleColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Mobile Filters Drawer */}
        {showFilters && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowFilters(false)} />
            <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-xl p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                <button
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {hasActiveFilters && (
                <button
                  className="mb-4 text-sm text-[#c1902f] hover:text-[#d4a43f]"
                  onClick={clearFilters}
                >
                  Clear all filters
                </button>
              )}
              
              {/* Categories */}
              {categories.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Categories</h3>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <div key={category.id} className="flex items-center">
                        <input
                          id={`mobile-category-${category.id}`}
                          type="radio"
                          name="mobile-category"
                          checked={selectedCategory === category.id}
                          onChange={() => setSelectedCategory(
                            selectedCategory === category.id ? null : category.id
                          )}
                          className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300"
                        />
                        <label
                          htmlFor={`mobile-category-${category.id}`}
                          className="ml-2 text-sm text-gray-700"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sizes */}
              {allSizes.size > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Sizes</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(allSizes).map(size => (
                      <button
                        key={size}
                        className={`px-3 py-1 text-sm border rounded-md
                          ${selectedSizes.has(size)
                            ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                            : 'border-gray-300 text-gray-700 hover:border-[#c1902f]'
                          }`}
                        onClick={() => toggleSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Colors */}
              {allColors.size > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Colors</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(allColors).map(color => (
                      <button
                        key={color}
                        className={`px-3 py-1 text-sm border rounded-md
                          ${selectedColors.has(color)
                            ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                            : 'border-gray-300 text-gray-700 hover:border-[#c1902f]'
                          }`}
                        onClick={() => toggleColor(color)}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                className="w-full py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
                onClick={() => setShowFilters(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
        
        {/* Product Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 aspect-square rounded-lg mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-500">Try adjusting your filters</p>
              {hasActiveFilters && (
                <button
                  className="mt-4 px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f]"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => (
                <MerchandiseItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
