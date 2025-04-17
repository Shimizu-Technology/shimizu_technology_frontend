// src/shared/components/badges/MenuItemBadge.tsx
import React from 'react';

export type BadgeType = 
  | 'featured' 
  | 'seasonal' 
  | 'popular' 
  | 'new' 
  | 'chef-special' 
  | 'limited' 
  | 'low-stock' 
  | 'out-of-stock';

interface MenuItemBadgeProps {
  type: BadgeType;
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Badge component for displaying special item indicators
 * Used to highlight featured, seasonal, popular items, etc.
 */
export const MenuItemBadge: React.FC<MenuItemBadgeProps> = ({
  type,
  text,
  className = '',
  size = 'md',
}) => {
  // Map badge types to styles
  const badgeStyles = {
    'featured': {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-200',
      defaultText: 'Featured'
    },
    'seasonal': {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      defaultText: 'Seasonal'
    },
    'popular': {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      defaultText: 'Popular'
    },
    'new': {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      defaultText: 'New'
    },
    'chef-special': {
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      defaultText: 'Chef\'s Special'
    },
    'limited': {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-200',
      defaultText: 'Limited Time'
    },
    'low-stock': {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      defaultText: 'Low Stock'
    },
    'out-of-stock': {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      defaultText: 'Out of Stock'
    }
  };

  // Map size to padding and text size
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base'
  };

  const { bg, text: textColor, border, defaultText } = badgeStyles[type];
  const displayText = text || defaultText;
  const sizeStyle = sizeStyles[size];

  return (
    <span
      className={`
        inline-flex items-center rounded-full
        font-medium ${bg} ${textColor} ${border} border
        ${sizeStyle} ${className}
      `}
    >
      {displayText}
    </span>
  );
};

/**
 * Component for displaying multiple badges
 */
interface MenuItemBadgesListProps {
  badges: Array<{
    type: BadgeType;
    text?: string;
  }>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MenuItemBadgesList: React.FC<MenuItemBadgesListProps> = ({
  badges,
  size = 'md',
  className = '',
}) => {
  if (!badges.length) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((badge, index) => (
        <MenuItemBadge
          key={`${badge.type}-${index}`}
          type={badge.type}
          text={badge.text}
          size={size}
        />
      ))}
    </div>
  );
};

export default MenuItemBadgesList;
