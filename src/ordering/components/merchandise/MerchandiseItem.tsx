// src/ordering/components/merchandise/MerchandiseItem.tsx
import React, { useState } from 'react';
import { useOrderStore } from '../../store/orderStore';
import { MerchandiseItem as MerchandiseItemType } from '../../types/merchandise';
import { MerchandisePreviewModal } from './MerchandisePreviewModal';
import { calculateFinalPrice } from '../../utils/merchandiseUtils';
import OptimizedImage from '../../../shared/components/ui/OptimizedImage';
import useIntersectionObserver from '../../../shared/hooks/useIntersectionObserver';

// LazyMerchandiseImage component for lazy-loaded images with hover effect
interface LazyMerchandiseImageProps {
  primaryImage: string | undefined | null;
  secondaryImage?: string | undefined | null;
  name: string;
  isHovered: boolean;
}

function LazyMerchandiseImage({ primaryImage, secondaryImage, name, isHovered }: LazyMerchandiseImageProps) {
  const [ref, isVisible] = useIntersectionObserver({
    rootMargin: '200px', // Load images 200px before they enter the viewport
    triggerOnce: true // Only trigger once
  });

  // Determine which image to show based on hover state
  const imageToShow = isHovered && secondaryImage ? secondaryImage : primaryImage;

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="w-full h-full bg-gray-100">
      {isVisible ? (
        <OptimizedImage
          src={imageToShow}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          width="400"
          height="400"
          context="featured"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

interface MerchandiseItemProps {
  item: MerchandiseItemType;
}

export function MerchandiseItem({ item }: MerchandiseItemProps) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const addToCart = useOrderStore((state) => state.addToCart);
  
  // Determine if this item has variants that require selection
  const hasVariants = item.variants.length > 0;
  
  // Determine if the item is out of stock
  const isOutOfStock = item.stock_status === 'out_of_stock';
  
  // Determine if the item is low in stock
  const isLowStock = item.stock_status === 'low_stock';
  
  // Handle quick add to cart (for items without variants)
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOutOfStock) {
      return;
    }
    
    if (hasVariants) {
      // If it has variants, open the modal instead
      setShowPreviewModal(true);
      return;
    }
    
    // Calculate the final price using the utility function
    const price = calculateFinalPrice(item);
    
    // Add the item to the cart
    addToCart(
      {
        id: item.id,
        type: 'merchandise',
        name: item.name,
        price: price,
        image: item.image_url,
        quantity: 1
      } as any,
      1
    );
  };
  
  return (
    <>
      <div 
        className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setShowPreviewModal(true)}
      >
        {/* Image with hover effect */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <LazyMerchandiseImage 
            primaryImage={item.image_url}
            secondaryImage={item.second_image_url}
            name={item.name}
            isHovered={isHovered}
          />
          
          {/* Stock status badge */}
          {isOutOfStock && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
              Out of Stock
            </div>
          )}
          
          {isLowStock && !isOutOfStock && (
            <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
              Low Stock
            </div>
          )}
          
          {/* Quick action buttons */}
          <div className="absolute inset-0 flex items-end justify-center p-4 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              className={`w-full py-2 rounded-md font-medium text-sm text-white
                ${isOutOfStock
                  ? 'bg-gray-400 cursor-not-allowed'
                  : hasVariants
                    ? 'bg-[#c1902f] hover:bg-[#d4a43f]'
                    : 'bg-[#c1902f] hover:bg-[#d4a43f]'
                }`}
              onClick={handleQuickAdd}
              disabled={isOutOfStock}
            >
              {isOutOfStock 
                ? 'Out of Stock' 
                : hasVariants 
                  ? 'Select Options' 
                  : 'Quick Add'}
            </button>
          </div>
        </div>
        
        {/* Item details */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
          <p className="mt-1 text-sm font-medium text-[#c1902f]">
            ${calculateFinalPrice(item).toFixed(2)}
          </p>
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreviewModal && (
        <MerchandisePreviewModal
          item={item}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  );
}
