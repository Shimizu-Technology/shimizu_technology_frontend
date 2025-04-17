// src/shared/components/typography/MenuItemText.tsx
import React from 'react';
import TextContent from './TextContent';

interface MenuItemTextProps {
  title: string;
  description?: string;
  price: number;
  badges?: Array<{
    text: string;
    type: 'featured' | 'seasonal' | 'lowStock' | 'outOfStock' | 'unavailableOptions';
  }>;
  className?: string;
  compact?: boolean;
}

/**
 * MenuItemText component for displaying menu item text content with consistent styling
 * This component is optimized for text-focused menu layouts
 */
export const MenuItemText: React.FC<MenuItemTextProps> = ({
  title,
  description,
  price,
  badges = [],
  className = '',
  compact = false,
}) => {
  // Map badge types to Tailwind classes
  const badgeClasses = {
    featured: 'bg-amber-100 text-amber-800',
    seasonal: 'bg-green-100 text-green-800',
    lowStock: 'bg-orange-100 text-orange-800',
    outOfStock: 'bg-red-100 text-red-800',
    unavailableOptions: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between">
        {/* Title */}
        <div className="flex-1 mr-2">
          <TextContent
            text={title}
            fontSize={compact ? 'base' : 'lg'}
            fontWeight="semibold"
            color="primary"
            maxLines={2}
          />
        </div>
        
        {/* Price */}
        <div className="text-base font-medium text-gray-900">
          ${price.toFixed(2)}
        </div>
      </div>
      
      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap mt-1 gap-1">
          {badges.map((badge, index) => (
            <span
              key={index}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClasses[badge.type]}`}
            >
              {badge.text}
            </span>
          ))}
        </div>
      )}
      
      {/* Description */}
      {description && (
        <div className="mt-2">
          <TextContent
            text={description}
            fontSize="sm"
            color="muted"
            maxLines={compact ? 2 : 3}
            expandable={!compact}
            lineHeight="relaxed"
          />
        </div>
      )}
    </div>
  );
};

export default MenuItemText;
