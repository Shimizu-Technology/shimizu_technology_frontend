// src/shared/components/ui/Tooltip.tsx

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import ReactDOM from 'react-dom';

// Global cache to store tooltip heights by content
const tooltipHeightCache = new Map<string, number>();

export interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  icon?: boolean;
  className?: string;
  iconClassName?: string;
  tooltipClassName?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  icon = false,
  className = '',
  iconClassName = '',
  tooltipClassName = '',
}) => {
  // Convert content to string for caching
  const contentKey = typeof content === 'string' ? content : JSON.stringify(content);
  
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(tooltipHeightCache.get(contentKey) || 0);
  const [isFirstRender, setIsFirstRender] = useState(true);
  
  // Calculate initial position before showing tooltip
  const calculatePosition = () => {
    if (!triggerRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280; // Max width of tooltip
    
    // Use cached height if available, otherwise use a smaller estimate for first render
    const estimatedHeight = tooltipHeight || (position === 'top' || position === 'bottom' ? 40 : 60);
    
    let top = 0;
    let left = 0;
    
    // Calculate position based on the trigger element's position in the viewport
    switch (position) {
      case 'top':
        top = triggerRect.top - estimatedHeight - 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (estimatedHeight / 2);
        left = triggerRect.right + 8;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (estimatedHeight / 2);
        left = triggerRect.left - tooltipWidth - 8;
        break;
    }
    
    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if needed
    if (left < 10) left = 10;
    if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
    
    // Adjust vertical position if needed
    if (top < 10) top = 10;
    if (top + estimatedHeight > viewportHeight - 10) top = viewportHeight - estimatedHeight - 10;
    
    return { top, left };
  };

  // Handle showing the tooltip
  const handleShowTooltip = () => {
    const position = calculatePosition();
    if (position) {
      setTooltipPosition(position);
      setIsVisible(true);
      setIsFirstRender(true);
    }
  };

  // Handle hiding the tooltip
  const handleHideTooltip = () => {
    setIsVisible(false);
    setTooltipPosition(null);
  };

  // Measure tooltip height after it's rendered and update cache
  useEffect(() => {
    if (isVisible && tooltipRef.current && tooltipPosition) {
      const height = tooltipRef.current.offsetHeight;
      
      // Update cache and state if height changed
      if (height !== tooltipHeight && height > 0) {
        tooltipHeightCache.set(contentKey, height);
        setTooltipHeight(height);
        
        // Only recalculate position on first render
        if (isFirstRender) {
          setIsFirstRender(false);
          // Recalculate position with actual height
          const newPosition = calculatePosition();
          if (newPosition) {
            setTooltipPosition(newPosition);
          }
        }
      }
    }
  }, [isVisible, tooltipHeight, position, contentKey, isFirstRender]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        triggerRef.current && 
        !tooltipRef.current.contains(event.target as Node) && 
        !triggerRef.current.contains(event.target as Node)
      ) {
        handleHideTooltip();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div 
      className={`inline-block relative ${className}`}
      ref={triggerRef}
      onMouseEnter={handleShowTooltip}
      onMouseLeave={handleHideTooltip}
      onClick={() => isVisible ? handleHideTooltip() : handleShowTooltip()}
    >
      {icon ? (
        <HelpCircle className={`h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors duration-200 ${iconClassName}`} />
      ) : (
        children
      )}
      
      {isVisible && tooltipPosition && ReactDOM.createPortal(
        <div
          ref={tooltipRef}
          className={`
            fixed z-[9999] px-4 py-3
            bg-gradient-to-b from-white to-gray-50 backdrop-blur-sm
            text-gray-700 text-xs font-normal
            rounded-lg shadow-md border border-gray-100
            whitespace-normal
            ${tooltipClassName}
          `}
          style={{ 
            opacity: 1,
            lineHeight: '1.5',
            letterSpacing: '0.01em',
            width: 'max-content',
            maxWidth: '280px',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
};
