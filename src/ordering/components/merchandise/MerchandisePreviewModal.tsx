// src/ordering/components/merchandise/MerchandisePreviewModal.tsx
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import toastUtils from '../../../shared/utils/toastUtils';
import { useOrderStore } from '../../store/orderStore';
import { MerchandiseItem, MerchandiseVariant } from '../../types/merchandise';
import { getSelectedVariant, calculateFinalPrice } from '../../utils/merchandiseUtils';
import OptimizedImage from '../../../shared/components/ui/OptimizedImage';

interface MerchandisePreviewModalProps {
  item: MerchandiseItem;
  onClose: () => void;
}

export function MerchandisePreviewModal({ item, onClose }: MerchandisePreviewModalProps) {
  const addToCart = useOrderStore((state) => state.addToCart);

  // State for variant selection
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MerchandiseVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  
  // State for image carousel
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Get all available images
  const allImages = [
    item.image_url,
    ...(item.second_image_url ? [item.second_image_url] : []),
    ...(item.additional_images || [])
  ].filter(Boolean);
  
  // Extract unique sizes and colors from variants
  const availableSizes = [...new Set(item.variants.map(v => v.size).filter((size): size is string => !!size))];
  const availableColors = [...new Set(item.variants.map(v => v.color).filter((color): color is string => !!color))];
  
  // Update selected variant when size or color changes
  useEffect(() => {
    const variant = getSelectedVariant(item, selectedSize, selectedColor);
    setSelectedVariant(variant);
  }, [selectedSize, selectedColor, item]);
  
  // Calculate final price
  const finalPrice = calculateFinalPrice(item, selectedVariant);
  
  // Check if the selected variant is in stock
  const isOutOfStock = selectedVariant 
    ? selectedVariant.stock_quantity <= 0
    : item.stock_status === 'out_of_stock';
  
  const isLowStock = selectedVariant
    ? selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= (selectedVariant.low_stock_threshold || 5)
    : item.stock_status === 'low_stock';
  
  // Handle image navigation
  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === allImages.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? allImages.length - 1 : prevIndex - 1
    );
  };
  
  // Handle add to cart
  const handleAddToCart = () => {
    if (isOutOfStock) {
      toastUtils.error('Sorry, this item is out of stock.');
      return;
    }
    
    // Check if we need a variant selection but none is selected
    if (item.variants.length > 0 && !selectedVariant) {
      if (availableSizes.length > 0 && !selectedSize) {
        toastUtils.error('Please select a size.');
        return;
      }
      
      if (availableColors.length > 0 && !selectedColor) {
        toastUtils.error('Please select a color.');
        return;
      }
    }
    
    const cartItem = {
      id: item.id,
      type: 'merchandise',
      name: item.name,
      price: finalPrice,
      image: item.image_url,
      quantity,
      variant_id: selectedVariant?.id
    } as any;
    
    // Only add size and color if they are selected
    if (selectedSize) {
      cartItem.size = selectedSize;
    }
    
    if (selectedColor) {
      cartItem.color = selectedColor;
    }
    
    addToCart(cartItem, quantity);
    
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-slideUp">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Image Carousel */}
          <div className="relative bg-gray-100 flex items-center justify-center h-[300px] md:h-[500px]">
            {allImages.length > 0 ? (
              <>
                <OptimizedImage
                  src={allImages[currentImageIndex]}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain"
                  width="600"
                  height="600"
                  context="featured"
                  fetchPriority="high"
                />
                
                {allImages.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 p-2 rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 text-gray-800"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="absolute right-2 p-2 rounded-full bg-white bg-opacity-70 hover:bg-opacity-100 text-gray-800"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    
                    {/* Thumbnail indicators */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                      {allImages.map((_, index) => (
                        <button
                          key={index}
                          className={`w-3 h-3 rounded-full ${
                            index === currentImageIndex
                              ? 'bg-[#c1902f]'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-gray-400">No image available</div>
            )}
          </div>
          
          {/* Right: Product Details */}
          <div className="p-6 flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.name}</h2>
            
            <p className="text-xl font-semibold text-[#c1902f] mb-4">
              ${finalPrice.toFixed(2)}
            </p>
            
            {item.description && (
              <p className="text-gray-600 mb-6">{item.description}</p>
            )}
            
            {/* Size Selection */}
            {availableSizes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Size</h3>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    // Check if this size is available in the selected color
                    const sizeAvailable = !selectedColor || 
                      item.variants.some(v => v.size === size && v.color === selectedColor && v.stock_quantity > 0);
                    
                    return (
                      <button
                        key={size}
                        className={`px-4 py-2 border rounded-md text-sm font-medium
                          ${selectedSize === size
                            ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                            : sizeAvailable
                              ? 'border-gray-300 hover:border-[#c1902f] text-gray-700'
                              : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                          }`}
                        onClick={() => {
                          if (sizeAvailable) {
                            setSelectedSize(size === selectedSize ? null : size);
                          }
                        }}
                        disabled={!sizeAvailable}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Color Selection */}
            {availableColors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Color</h3>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    // Check if this color is available in the selected size
                    const colorAvailable = !selectedSize || 
                      item.variants.some(v => v.color === color && v.size === selectedSize && v.stock_quantity > 0);
                    
                    return (
                      <button
                        key={color}
                        className={`px-4 py-2 border rounded-md text-sm font-medium
                          ${selectedColor === color
                            ? 'border-[#c1902f] bg-[#c1902f]/10 text-[#c1902f]'
                            : colorAvailable
                              ? 'border-gray-300 hover:border-[#c1902f] text-gray-700'
                              : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                          }`}
                        onClick={() => {
                          if (colorAvailable) {
                            setSelectedColor(color === selectedColor ? null : color);
                          }
                        }}
                        disabled={!colorAvailable}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Stock Status */}
            {isOutOfStock ? (
              <div className="mb-4 text-red-600 font-medium">Out of Stock</div>
            ) : isLowStock ? (
              <div className="mb-4 text-orange-500 font-medium">
                Low Stock - Order Soon
                {selectedVariant && (
                  <span className="ml-1">
                    ({selectedVariant.stock_quantity} left)
                  </span>
                )}
              </div>
            ) : (
              <div className="mb-4 text-green-600 font-medium">In Stock</div>
            )}
            
            {/* Quantity Selector */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Quantity</h3>
              <div className="flex items-center">
                <button
                  className="p-2 border border-gray-300 rounded-l-md hover:bg-gray-100"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="px-4 py-2 border-t border-b border-gray-300 min-w-[40px] text-center">
                  {quantity}
                </div>
                <button
                  className="p-2 border border-gray-300 rounded-r-md hover:bg-gray-100"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={isOutOfStock}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Add to Cart Button */}
            <button
              className={`w-full py-3 px-4 rounded-md font-medium text-white
                ${isOutOfStock
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#c1902f] hover:bg-[#d4a43f]'
                }`}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
            
            {/* Total Price */}
            <div className="mt-4 text-right">
              <span className="text-gray-600">Total: </span>
              <span className="font-semibold">${(finalPrice * quantity).toFixed(2)}</span>
            </div>
            
            {/* Note: Social media sharing links have been removed as requested */}
          </div>
        </div>
      </div>
    </div>
  );
}
