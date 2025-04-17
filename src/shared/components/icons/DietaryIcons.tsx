// src/shared/components/icons/DietaryIcons.tsx
import React from 'react';

export type DietaryType = 'vegetarian' | 'vegan' | 'glutenFree' | 'dairyFree' | 'nutFree' | 'spicy';

interface DietaryIconProps {
  type: DietaryType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

/**
 * Component for displaying dietary preference icons
 * Uses simple SVG icons with optional labels
 */
export const DietaryIcon: React.FC<DietaryIconProps> = ({
  type,
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  // Map size to dimensions
  const sizeMap = {
    sm: { size: 16, className: 'text-xs' },
    md: { size: 20, className: 'text-sm' },
    lg: { size: 24, className: 'text-base' },
  };

  // Map dietary types to colors and labels
  const dietaryInfo = {
    vegetarian: { color: '#22c55e', label: 'Vegetarian', title: 'Vegetarian' },
    vegan: { color: '#16a34a', label: 'Vegan', title: 'Vegan' },
    glutenFree: { color: '#ca8a04', label: 'Gluten-Free', title: 'Gluten-Free' },
    dairyFree: { color: '#0ea5e9', label: 'Dairy-Free', title: 'Dairy-Free' },
    nutFree: { color: '#9a3412', label: 'Nut-Free', title: 'Nut-Free' },
    spicy: { color: '#dc2626', label: 'Spicy', title: 'Spicy' },
  };

  // SVG paths for each dietary type
  const iconPaths = {
    vegetarian: (
      <path d="M7 2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm2.45 0A3.49 3.49 0 0 1 8 5.5a3.49 3.49 0 0 1-1.45 3 8.99 8.99 0 0 1 4.9 4.55A9 9 0 0 1 20 13.5V11a8 8 0 0 0-10.55-7.6zM3 7.5a7 7 0 0 0-2.79 5.5H5.5V9.25A4.47 4.47 0 0 1 3 7.5zM13.5 9.25V13H20A7 7 0 0 0 13.5 9.25z" />
    ),
    vegan: (
      <path d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-9 3a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    ),
    glutenFree: (
      <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z" />
    ),
    dairyFree: (
      <path d="M3 3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5v-2H4v-1h4v-2H4v-1h4V9H4V8h4V6H4V5h4V3H3zm14 0a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5v-2h4v-1h-4v-2h4v-1h-4V9h4V8h-4V6h4V5h-4V3h5z" />
    ),
    nutFree: (
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
    ),
    spicy: (
      <path d="M10 2a.75.75 0 0 1 .75.75v.258a33.186 33.186 0 0 1 6.668.83.75.75 0 0 1-.336 1.461 31.28 31.28 0 0 0-1.103-.232l1.702 7.545a.75.75 0 0 1-.387.832A4.981 4.981 0 0 1 15 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 0 1-.387-.832l1.77-7.849a31.743 31.743 0 0 0-3.339-.192v11.93a.75.75 0 0 1-1.5 0V4.749c-1.14.032-2.271.103-3.339.192l1.77 7.85a.75.75 0 0 1-.387.83A4.981 4.981 0 0 1 5 14a4.98 4.98 0 0 1-2.294-.556.75.75 0 0 1-.387-.832l1.702-7.545c-.37.07-.738.144-1.103.232a.75.75 0 0 1-.336-1.461 33.184 33.184 0 0 1 6.668-.83V2.75A.75.75 0 0 1 10 2z" />
    ),
  };

  const { color, label, title } = dietaryInfo[type];
  const { size: iconSize, className: sizeClassName } = sizeMap[size];

  return (
    <div className={`inline-flex items-center ${className}`} title={title}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 20 20"
        fill={color}
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {iconPaths[type]}
      </svg>
      
      {showLabel && (
        <span className={`ml-1 ${sizeClassName} font-medium`} style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
};

/**
 * Component for displaying multiple dietary icons
 */
interface DietaryIconsListProps {
  types: DietaryType[];
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export const DietaryIconsList: React.FC<DietaryIconsListProps> = ({
  types,
  size = 'md',
  showLabels = false,
  className = '',
}) => {
  if (!types.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {types.map((type) => (
        <DietaryIcon
          key={type}
          type={type}
          size={size}
          showLabel={showLabels}
        />
      ))}
    </div>
  );
};

export default DietaryIconsList;
