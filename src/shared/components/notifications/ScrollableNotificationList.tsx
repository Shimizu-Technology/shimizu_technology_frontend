import React, { useRef, useEffect } from 'react';
import { isMobileDevice, isIPad } from '../../utils/deviceUtils';
import './ScrollableNotificationList.css';

interface ScrollableNotificationListProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

const ScrollableNotificationList: React.FC<ScrollableNotificationListProps> = ({
  children,
  maxHeight = '70vh', // Default to 70% of viewport height
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Apply device-specific adjustments
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // For iOS devices, ensure momentum scrolling is enabled
    if (isIPad() || (isMobileDevice() && /iPhone|iPod/.test(navigator.userAgent))) {
      // Use type assertion to handle webkit prefixed property
      (container.style as any)['-webkit-overflow-scrolling'] = 'touch';
    }
  }, []);

  // Add touch event handling for better mobile experience
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isMobileDevice()) return;
    
    let startY = 0;
    let startScrollTop = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].pageY;
      startScrollTop = container.scrollTop;
      
      // Prevent parent elements from scrolling
      if (container.scrollHeight > container.clientHeight) {
        e.stopPropagation();
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = startY - e.touches[0].pageY;
      container.scrollTop = startScrollTop + deltaY;
      
      // Prevent default only when we're at the boundaries to allow parent scrolling
      const isAtTop = container.scrollTop <= 0;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight;
      
      if (!(isAtTop && deltaY < 0) && !(isAtBottom && deltaY > 0)) {
        e.preventDefault();
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div 
      ref={scrollContainerRef}
      className={`scrollable-notification-list ${className}`}
      style={{
        overflowY: 'auto',
        maxHeight,
        // Use CSS class for WebkitOverflowScrolling instead of inline style
        msOverflowStyle: 'none' as any, // Hide scrollbar in IE/Edge
        scrollbarWidth: 'thin' as any, // Firefox
        padding: '1px', // Prevent margin collapse
      }}
    >
      {children}
    </div>
  );
};

export default ScrollableNotificationList;
