import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ShoppingCart, Facebook, Twitter, Share2, XCircle } from 'lucide-react';
import { MerchandiseItem, MerchandiseVariant } from '../../types/merchandise';
import toastUtils from '../../../shared/utils/toastUtils';

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MerchandiseItem | null;
  addToCart: (item: any, variant: any) => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({
  isOpen,
  onClose,
  item,
  addToCart
}) => {
  const [selectedVariant, setSelectedVariant] = useState<MerchandiseVariant | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Reset state when the modal opens with a new item
  useEffect(() => {
    if (item && isOpen) {
      setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
      setCurrentImageIndex(0);
      setQuantity(1);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  // For the simplified model, we use image_url and second_image_url
  const allImages = [
    item.image_url, 
    item.second_image_url
  ].filter(Boolean);
  
  // Calculate price with variant adjustment
  const displayPrice = item.base_price + (selectedVariant?.price_adjustment || 0);
  
  // Check if item is out of stock
  const isOutOfStock = item.stock_status === 'out_of_stock' || 
                      (selectedVariant && selectedVariant.stock_quantity <= 0);

  // Handle previous/next image navigation
  const handlePreviousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? allImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === allImages.length - 1 ? 0 : prev + 1
    );
  };

  // Handle add to cart with selected quantity
  const handleAddToCart = () => {
    if (isOutOfStock) return;
    
    // Create a merged item with the quantity
    const cartItem = {
      ...item,
      quantity
    };
    
    addToCart(cartItem, selectedVariant);
    toastUtils.success(`Added ${quantity} ${item.name} to cart`);
    onClose();
  };
  
  // Handle buy now
  const handleBuyNow = () => {
    if (isOutOfStock) return;
    
    // Create a merged item with the quantity
    const cartItem = {
      ...item,
      quantity
    };
    
    addToCart(cartItem, selectedVariant);
    // Redirect to checkout would happen here in a real implementation
    toastUtils.success(`Added ${quantity} ${item.name} to cart - proceeding to checkout`);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - more prominent */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-md"
          aria-label="Close"
        >
          <XCircle className="h-8 w-8" />
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Product images section */}
          <div className="relative bg-gray-100 aspect-square">
            {/* Main image */}
            {allImages.length > 0 ? (
              <img
                src={allImages[currentImageIndex]}
                alt={`${item.name} - view ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image available
              </div>
            )}
            
            {/* Image navigation arrows - only shown if more than one image */}
            {allImages.length > 1 ? (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-1 hover:bg-opacity-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-75 rounded-full p-1 hover:bg-opacity-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
            
            {/* Image indicator dots - only shown if more than one image */}
            {allImages.length > 1 ? (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                {allImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 w-2 rounded-full ${
                      currentImageIndex === index 
                        ? 'bg-[#c1902f]' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            ) : null}
            
            {/* Thumbnail images - only shown if more than one image */}
            {allImages.length > 1 ? (
              <div className="absolute bottom-10 left-0 right-0 flex justify-center space-x-2 px-4">
                <div className="flex space-x-2 overflow-x-auto p-2 bg-white bg-opacity-75 rounded-lg">
                  {allImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-12 h-12 rounded border-2 ${
                        currentImageIndex === index 
                          ? 'border-[#c1902f]' 
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img 
                        src={image} 
                        alt={`${index === 0 ? 'Front' : 'Back'}`}
                        className="w-full h-full object-cover" 
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          
          {/* Product details section */}
          <div className="p-6 overflow-y-auto max-h-[90vh] md:max-h-[unset]">
            <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
            
            {/* Category name if available */}
            {item.category_name && (
              <p className="text-sm text-gray-500 mt-1">
                Category: {item.category_name}
              </p>
            )}
            
            {/* Price */}
            <div className="mt-4 flex items-center">
              <span className="text-xl font-semibold text-gray-900">
                ${displayPrice.toFixed(2)}
              </span>
              
              {/* Stock status */}
              {isOutOfStock ? (
                <span className="ml-4 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  Out of Stock
                </span>
              ) : item.stock_status === 'low_stock' ? (
                <span className="ml-4 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                  Low Stock
                </span>
              ) : (
                <span className="ml-4 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  In Stock
                </span>
              )}
            </div>
            
            {/* Description */}
            {item.description && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900">Description</h3>
                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
              </div>
            )}
            
            {/* Size Selection */}
            {item.variants && item.variants.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  SIZE
                </h3>
                
                {/* Extract unique sizes and sort them */}
                {(() => {
                  const sizes = Array.from(new Set(item.variants.map(v => v.size).filter(Boolean) as string[]));
                  const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
                  const sortedSizes = sizes.sort((a, b) => {
                    return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
                  });
                  
                  // Group variants by size for easier selection
                  const variantsBySize: Record<string, MerchandiseVariant[]> = {};
                  item.variants.forEach(v => {
                    if (v.size) {
                      if (!variantsBySize[v.size]) {
                        variantsBySize[v.size] = [];
                      }
                      variantsBySize[v.size].push(v);
                    }
                  });
                  
                  // Find the currently selected size
                  const selectedSize = selectedVariant?.size || '';
                  
                  return (
                    <div className="flex flex-wrap gap-2">
                      {sortedSizes.map(size => {
                        // Check if any variant with this size is in stock
                        const variants = variantsBySize[size] || [];
                        const hasInStockVariant = variants.some(v => v.stock_quantity > 0);
                        
                        return (
                          <button
                            key={size}
                            onClick={() => {
                              // Select the first in-stock variant with this size
                              if (hasInStockVariant) {
                                const firstInStock = variants.find(v => v.stock_quantity > 0) || variants[0];
                                setSelectedVariant(firstInStock);
                              }
                            }}
                            className={`
                              h-10 w-12 flex items-center justify-center border text-sm font-medium
                              ${selectedSize === size
                                ? 'border-[#c1902f] bg-[#c1902f] bg-opacity-10 text-[#c1902f]'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                              ${!hasInStockVariant ? 'opacity-50 cursor-not-allowed line-through' : ''}
                            `}
                            disabled={!hasInStockVariant || false}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
            
            {/* Color Selection - if multiple colors for the selected size */}
            {(() => {
              if (!selectedVariant || !item.variants) return null;
              
              // Find all available colors for the selected size
              const sizeVariants = item.variants.filter(v => v.size === selectedVariant.size && v.color);
              if (sizeVariants.length <= 1) return null;
              
              return (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Color
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {sizeVariants.map(variant => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`
                          p-1 border rounded-full
                          ${selectedVariant.id === variant.id
                            ? 'border-[#c1902f] ring-2 ring-[#c1902f] ring-opacity-30'
                            : 'border-gray-300 hover:border-gray-400'}
                          ${variant.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                          disabled={variant.stock_quantity <= 0 || false}
                        title={variant.color}
                      >
                        <div 
                          className="h-8 w-8 rounded-full"
                          style={{ 
                            backgroundColor: variant.color ? variant.color.toLowerCase() : '#cccccc',
                            // For white color, add a subtle shadow
                            boxShadow: variant.color && variant.color.toLowerCase() === 'white' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  
                  {/* Display selected color name */}
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {selectedVariant.color || 'Default'}
                    {selectedVariant.price_adjustment > 0 && ` (+$${selectedVariant.price_adjustment.toFixed(2)})`}
                    {selectedVariant.price_adjustment < 0 && ` (-$${Math.abs(selectedVariant.price_adjustment).toFixed(2)})`}
                  </p>
                </div>
              );
            })()}
            
            {/* Quantity selector - improved */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Quantity
              </h3>
              <div className="flex items-center border border-gray-300 rounded-md w-32">
                <button
                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 hover:bg-gray-100 transition-colors"
                  disabled={(quantity <= 1 || isOutOfStock) || false}
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max={selectedVariant?.stock_quantity || 99}
                  value={quantity}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value) || 1;
                    const maxValue = selectedVariant?.stock_quantity || 99;
                    setQuantity(Math.min(Math.max(1, newValue), maxValue));
                  }}
                  className="w-full text-center py-2 border-0 focus:outline-none focus:ring-0"
                  disabled={isOutOfStock || false}
                />
                <button
                  onClick={() => {
                    const maxValue = selectedVariant?.stock_quantity || 99;
                    setQuantity(prev => Math.min(prev + 1, maxValue));
                  }}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 hover:bg-gray-100 transition-colors"
                  disabled={isOutOfStock || (selectedVariant && quantity >= selectedVariant.stock_quantity) || false}
                >
                  +
                </button>
              </div>
              
              {/* Show max quantity available */}
              {selectedVariant && selectedVariant.stock_quantity > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {quantity >= selectedVariant.stock_quantity 
                    ? 'Maximum quantity selected' 
                    : `Up to ${selectedVariant.stock_quantity} available`}
                </p>
              )}
            </div>
            
            {/* Stock status indicator */}
            {selectedVariant && selectedVariant.stock_quantity <= 3 && selectedVariant.stock_quantity > 0 && (
              <div className="mt-4 flex items-center text-yellow-700">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
                <span className="text-sm">Low stock - {selectedVariant.stock_quantity} item{selectedVariant.stock_quantity !== 1 ? 's' : ''} left</span>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || false}
                className={`
                  w-full flex items-center justify-center px-4 py-3 rounded-md border
                  ${!isOutOfStock
                    ? 'border-[#c1902f] bg-white text-[#c1902f] hover:bg-[#c1902f] hover:bg-opacity-10'
                    : 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed'}
                  transition-colors duration-200
                `}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {isOutOfStock ? 'Out of Stock' : `Add ${quantity > 1 ? quantity : ''} to Cart`}
              </button>
              
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock || false}
                className={`
                  w-full flex items-center justify-center px-4 py-3 rounded-md
                  ${!isOutOfStock
                    ? 'bg-[#c1902f] text-white hover:bg-[#d4a43f]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                  transition-colors duration-200
                `}
              >
                {isOutOfStock ? 'Out of Stock' : 'Buy it now'}
              </button>
            </div>
            
            {/* Pickup information */}
            <div className="mt-6 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Pickup available at Shimizu Technology (Tokyo)</p>
                  <p className="mt-1 text-xs text-gray-500">Usually ready in 2 hours</p>
                  <button className="mt-1 text-xs text-[#0078d4] hover:text-[#50a3d9] underline">
                    View store information
                  </button>
                </div>
              </div>
            </div>
            
            {/* Additional information */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Product Details
              </h3>
              <ul className="text-sm text-gray-600 space-y-2">
                {selectedVariant && (
                  <li>Size: {selectedVariant.size}</li>
                )}
                {selectedVariant && (
                  <li>Color: {selectedVariant.color}</li>
                )}
                <li>SKU: {item.id}</li>
                {item.variants && item.variants.length > 0 && (
                  <li>Available Sizes: {Array.from(new Set(item.variants.map(v => v.size).filter(Boolean) as string[])).join(', ')}</li>
                )}
                {item.variants && item.variants.length > 0 && (
                  <li>Available Colors: {Array.from(new Set(item.variants.map(v => v.color).filter(Boolean) as string[])).join(', ')}</li>
                )}
              </ul>
            </div>
            
            {/* Social sharing */}
            <div className="mt-6 border-t border-gray-200 pt-6 flex items-center">
              <span className="text-sm text-gray-600 mr-4">Share:</span>
              <div className="flex space-x-4">
                <button className="text-gray-500 hover:text-gray-700">
                  <Facebook className="h-5 w-5" />
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <Twitter className="h-5 w-5" />
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;
