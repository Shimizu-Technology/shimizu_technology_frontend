import React, { useEffect, useState, useMemo } from 'react';
import { useMerchandiseStore } from '../store/merchandiseStore';
import { useOrderStore } from '../store/orderStore';
import { LoadingSpinner } from '../../shared/components/ui';
import { ShoppingCart, Filter, X, ArrowRight } from 'lucide-react';
import toastUtils from '../../shared/utils/toastUtils';
import FilterSidebar, { ActiveFilters } from './merchandise/FilterSidebar';
import QuickViewModal from './merchandise/QuickViewModal';
import { extractFilterOptions, filterMerchandiseItems, getDefaultActiveFilters } from '../utils/merchandiseUtils';
import { MerchandiseItem, MerchandiseVariant } from '../types/merchandise';

interface Collection {
  id: number;
  name: string;
  active: boolean;
  description?: string;
}

const MerchandisePage: React.FC = () => {
  const {
    collections,
    merchandiseItems,
    loading,
    error,
    fetchCollections,
    fetchMerchandiseItems
  } = useMerchandiseStore();

  const { addToCart } = useOrderStore();

  // State for selected collection
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  
  // State for selected variant
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(getDefaultActiveFilters());
  
  // Quick view modal states
  const [quickViewModalOpen, setQuickViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MerchandiseItem | null>(null);
  
  // Extract filter options from merchandise items
  const filterOptions = useMemo(
    () => extractFilterOptions(merchandiseItems),
    [merchandiseItems]
  );
  
  // Apply filters to merchandise items
  const filteredItems = useMemo(
    () => filterMerchandiseItems(merchandiseItems, activeFilters),
    [merchandiseItems, activeFilters]
  );
  
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      activeFilters.sizes.length > 0 ||
      activeFilters.colors.length > 0 ||
      activeFilters.priceRange !== null ||
      activeFilters.availability.length > 0
    );
  }, [activeFilters]);

  // Load collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Load items when a collection is selected
  useEffect(() => {
    if (collections.length > 0) {
      const activeCollection = collections.find(c => c.active) || collections[0];
      setSelectedCollectionId(activeCollection.id);
      fetchMerchandiseItems();
    }
  }, [collections, fetchMerchandiseItems]);

  // Handle collection change
  const handleCollectionChange = (collectionId: number) => {
    setSelectedCollectionId(collectionId);
    fetchMerchandiseItems();
  };

  // Handle variant selection
  const handleVariantSelection = (itemId: number, variantId: number) => {
    setSelectedVariants(prev => ({
      ...prev,
      [itemId]: variantId
    }));
  };
  
  // Handle filter changes
  const handleFilterChange = (newFilters: ActiveFilters) => {
    setActiveFilters(newFilters);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setActiveFilters(getDefaultActiveFilters());
  };

  // Add merchandise to cart
  const handleAddToCart = (item: MerchandiseItem, variant: MerchandiseVariant | undefined) => {
    const merchandiseItem = {
      id: item.id.toString(), // Convert to string for CartItem
      name: item.name,
      price: item.base_price + (variant?.price_adjustment || 0),
      image_url: item.image_url || '',
      quantity: 1,
      type: 'merchandise' as const,
      variant_id: variant?.id,
      variant_details: variant ? {
        size: variant.size || '',
        color: variant.color || ''
      } : null
    };

    addToCart(merchandiseItem);
    toastUtils.success(`Added ${item.name} to cart`);
  };

  if (loading && collections.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        An error occurred: {error}
      </div>
    );
  }

  // Get the current collection
  const currentCollection = collections.find(c => c.id === selectedCollectionId) as Collection | undefined;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Merchandise</h1>
      
      <div className="lg:grid lg:grid-cols-4 lg:gap-8">
        {/* Filter sidebar (desktop) */}
        <div className={`hidden lg:block lg:col-span-1 ${showFilters ? '' : 'lg:hidden'}`}>
          <FilterSidebar
            isOpen={true}
            onClose={() => setShowFilters(false)}
            filterOptions={filterOptions}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
          />
        </div>
      
        <div className={`${showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {/* Collection tabs */}
          {collections.length > 0 && (
            <div className="mb-8">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px space-x-8 overflow-x-auto">
                  {/* All Items tab */}
                  <button
                    onClick={() => {
                      setSelectedCollectionId(null);
                      fetchMerchandiseItems();
                    }}
                    className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                      ${selectedCollectionId === null
                        ? 'border-[#c1902f] text-[#c1902f]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    `}
                  >
                    All Items
                  </button>
                  
                  {/* Collection tabs */}
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleCollectionChange(collection.id)}
                      className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                        ${selectedCollectionId === collection.id
                          ? 'border-[#c1902f] text-[#c1902f]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                      `}
                    >
                      {collection.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}
          
          {/* Collection description and filter controls */}
          <div className="flex flex-wrap items-center justify-between mb-8">
            <div className="mb-4 md:mb-0 max-w-2xl">
              {selectedCollectionId === null ? (
                <p className="text-gray-600">Browse all merchandise items across all collections.</p>
              ) : currentCollection && (
                <p className="text-gray-600">{currentCollection.description || ''}</p>
              )}
            </div>
            
            {/* Filter controls */}
            <div className="flex items-center space-x-2">
              {/* Desktop filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="hidden lg:flex items-center space-x-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                {hasActiveFilters && (
                  <span className="ml-1 bg-[#c1902f] text-white h-5 w-5 flex items-center justify-center text-xs rounded-full">
                    {activeFilters.sizes.length + 
                     activeFilters.colors.length + 
                    (activeFilters.priceRange ? 1 : 0) + 
                    activeFilters.availability.length}
                  </span>
                )}
              </button>
              
              {/* Mobile filter button */}
              <button
                onClick={() => setShowFilters(true)}
                className="lg:hidden flex items-center space-x-2 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filter</span>
                {hasActiveFilters && (
                  <span className="ml-1 bg-[#c1902f] text-white h-5 w-5 flex items-center justify-center text-xs rounded-full">
                    {activeFilters.sizes.length + 
                     activeFilters.colors.length + 
                    (activeFilters.priceRange ? 1 : 0) + 
                    activeFilters.availability.length}
                  </span>
                )}
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="flex items-center py-2 px-4 text-[#c1902f] hover:bg-[#c1902f] hover:bg-opacity-10 rounded-md transition-colors"
                >
                  <X className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Clear</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm text-gray-600">Active filters:</span>
              
              
              {activeFilters.sizes.map(size => (
                <span key={size} className="px-2 py-1 text-xs bg-gray-100 rounded-full flex items-center">
                  Size: {size}
                  <button 
                    onClick={() => setActiveFilters({
                      ...activeFilters, 
                      sizes: activeFilters.sizes.filter(s => s !== size)
                    })}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              
              {activeFilters.colors.map(color => (
                <span key={color} className="px-2 py-1 text-xs bg-gray-100 rounded-full flex items-center">
                  Color: {color}
                  <button 
                    onClick={() => setActiveFilters({
                      ...activeFilters, 
                      colors: activeFilters.colors.filter(c => c !== color)
                    })}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              
              {activeFilters.priceRange && (
                <span className="px-2 py-1 text-xs bg-gray-100 rounded-full flex items-center">
                  Price: ${activeFilters.priceRange.min} - ${activeFilters.priceRange.max === Infinity ? '+' : activeFilters.priceRange.max}
                  <button 
                    onClick={() => setActiveFilters({...activeFilters, priceRange: null})}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {activeFilters.availability.map(status => (
                <span key={status} className="px-2 py-1 text-xs bg-gray-100 rounded-full flex items-center">
                  {status === 'in_stock' ? 'In Stock' : status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                  <button 
                    onClick={() => setActiveFilters({
                      ...activeFilters, 
                      availability: activeFilters.availability.filter(s => s !== status)
                    })}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              
              <button
                onClick={handleClearFilters}
                className="px-2 py-1 text-xs text-[#c1902f] hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
      
          {/* Merchandise items */}
          {filteredItems.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">
                {merchandiseItems.length === 0 
                  ? "No merchandise items available in this collection."
                  : "No items match the selected filters. Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredItems.map((item) => {
                // Get the selected variant or the first one
                const selectedVariantId = selectedVariants[item.id];
                const selectedVariant = item.variants?.find(v => v.id === selectedVariantId) || item.variants?.[0];
                
                // Calculate price with variant adjustment
                const displayPrice = item.base_price + (selectedVariant?.price_adjustment || 0);
                
                // Check if item is out of stock
                const isOutOfStock = item.stock_status === 'out_of_stock' || 
                                    (selectedVariant && selectedVariant.stock_quantity <= 0);
                
                return (
                  <div key={item.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    {/* Item image with hover effect */}
                    <div 
                      className="aspect-square bg-gray-100 relative group overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedItem(item);
                        setQuickViewModalOpen(true);
                      }}
                    >
                      {item.image_url ? (
                        <>
                          {/* Front image (always visible but fades out on hover if second image exists) */}
                          <img
                            src={item.image_url || ''}
                            alt={`${item.name} - front`}
                            className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                              item.second_image_url ? 'group-hover:opacity-0' : ''
                            }`}
                          />
                          
                          {/* Back image (if available, initially hidden, fades in on hover) */}
                          {item.second_image_url && (
                            <img
                              src={item.second_image_url || ''}
                              alt={`${item.name} - back`}
                              className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                          )}

                          {/* Quick view button (appears on hover) */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                              className="bg-white bg-opacity-90 text-gray-900 font-medium py-2 px-4 rounded-md shadow hover:bg-opacity-100 transform hover:-translate-y-1 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering parent click events
                                setSelectedItem(item);
                                setQuickViewModalOpen(true);
                              }}
                            >
                              Quick View
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No image
                        </div>
                      )}
                      
                      {/* Out of stock overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <span className="bg-red-500 text-white px-4 py-2 rounded-full font-bold uppercase text-sm">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Item details */}
                    <div className="p-4">
                      <h3 
                        className="font-semibold text-lg text-gray-900 hover:text-[#c1902f] cursor-pointer"
                        onClick={() => {
                          setSelectedItem(item);
                          setQuickViewModalOpen(true);
                        }}
                      >
                        {item.name}
                        {selectedCollectionId === null && (
                          <span className="ml-2 text-sm text-gray-500">
                            ({item.merchandise_collection_id})
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{item.description || ''}</p>
                      
                      {/* Price */}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-medium text-gray-900">${displayPrice.toFixed(2)}</span>
                        
                        {/* Stock status badge */}
                        {item.stock_status === 'low_stock' && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            Low Stock
                          </span>
                        )}
                      </div>
                      
                      {/* Size options */}
                      {item.variants && item.variants.length > 0 && (() => {
                        // Extract unique sizes and sort them
                        const sizes = Array.from(new Set(item.variants.map(v => v.size)));
                        const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
                        const sortedSizes = sizes.sort((a, b) => {
                          if (!a || !b) return 0;
                          return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
                        });
                        
                        return (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sortedSizes.map(size => {
                                if (!size) return null;
                                // Find all variants with this size
                                const sizeVariants = item.variants!.filter(v => v.size === size);
                                // Check if any variant with this size has stock
                                const hasStock = sizeVariants.some(v => v.stock_quantity > 0);
                                
                                return (
                                  <button
                                    key={size}
                                    onClick={() => {
                                      if (hasStock) {
                                        const firstInStock = sizeVariants.find(v => v.stock_quantity > 0) || sizeVariants[0];
                                        handleVariantSelection(item.id, firstInStock.id);
                                      }
                                    }}
                                    className={`
                                      w-8 h-8 flex items-center justify-center text-xs border
                                      ${selectedVariant?.size === size
                                        ? 'border-[#c1902f] bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                                      ${!hasStock ? 'opacity-50 cursor-not-allowed line-through' : ''}
                                    `}
                                    disabled={!hasStock || false}
                                  >
                                    {size}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Add to cart button */}
                      <button
                        onClick={() => handleAddToCart(item, selectedVariant)}
                        disabled={isOutOfStock || false}
                        className={`
                          mt-4 w-full flex items-center justify-center px-4 py-2 rounded-md
                          ${!isOutOfStock
                            ? 'bg-[#c1902f] text-white hover:bg-[#d4a43f]'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                          transition-colors duration-200
                        `}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* You May Also Like section - commented out per client request */}
          {/* 
          {filteredItems.length > 0 && (
            <div className="mt-16">
              <div className="border-b border-gray-200 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 pb-2">You May Also Like</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {(() => {
                  // Get IDs of currently displayed items
                  const currentItemIds = new Set(filteredItems.map(item => item.id));
                  // Filter out items that are already displayed
                  const otherItems = merchandiseItems.filter(item => !currentItemIds.has(item.id));
                  // If not enough other items, use the current ones
                  const itemsToShow = otherItems.length >= 4 
                    ? otherItems.slice(0, 4) 
                    : [...otherItems, ...filteredItems].slice(0, 4);
                    
                  return itemsToShow.map((item) => {
                    const displayPrice = item.base_price + (item.variants?.[0]?.price_adjustment || 0);
                    
                    return (
                      <div 
                        key={`related-${item.id}`} 
                        className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedItem(item);
                          setQuickViewModalOpen(true);
                        }}
                      >
                        <div className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              No image
                            </div>
                          )}
                        </div>
                        
                        <div className="p-3">
                          <h3 className="font-medium text-base text-gray-900 hover:text-[#c1902f] cursor-pointer">
                            {item.name}
                          </h3>
                          <p className="text-gray-900 text-base mt-1 font-medium">${displayPrice.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              
              <div className="mt-8 text-center">
                <button
                  onClick={() => setSelectedCollectionId(null)}
                  className="inline-flex items-center text-[#c1902f] font-medium hover:underline"
                >
                  View all products
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          */}
        </div>
      </div>
      
      {/* Filter sidebar (mobile) - visible only when filter button is clicked on mobile */}
      {showFilters && window.innerWidth < 1024 && (
        <FilterSidebar
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          filterOptions={filterOptions}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearFilters}
        />
      )}
      
      {/* Quick view modal */}
      <QuickViewModal
        isOpen={quickViewModalOpen}
        onClose={() => setQuickViewModalOpen(false)}
        item={selectedItem}
        addToCart={handleAddToCart}
      />
    </div>
  );
};

export default MerchandisePage;
