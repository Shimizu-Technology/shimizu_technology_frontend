// src/shared/components/typography/TextContent.tsx
import React, { useState } from 'react';

interface TextContentProps {
  text: string;
  maxLines?: number;
  className?: string;
  expandable?: boolean;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'warning';
  lineHeight?: 'tight' | 'normal' | 'relaxed';
}

/**
 * TextContent component for displaying text with consistent styling and optional truncation
 * This component is optimized for text-heavy layouts
 */
export const TextContent: React.FC<TextContentProps> = ({
  text,
  maxLines = 0,
  className = '',
  expandable = false,
  fontSize = 'base',
  fontWeight = 'normal',
  color = 'primary',
  lineHeight = 'normal',
}) => {
  const [expanded, setExpanded] = useState(false);

  // Map fontSize to Tailwind classes
  const fontSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  // Map fontWeight to Tailwind classes
  const fontWeightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // Map color to Tailwind classes
  const colorClasses = {
    primary: 'text-gray-900',
    secondary: 'text-gray-700',
    muted: 'text-gray-500',
    error: 'text-red-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
  };

  // Map lineHeight to Tailwind classes
  const lineHeightClasses = {
    tight: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  };

  // Determine if text should be truncated
  const shouldTruncate = maxLines > 0 && !expanded;

  // Generate the appropriate class for line clamping
  const getLineClampClass = () => {
    if (!shouldTruncate) return '';
    
    // Tailwind supports line-clamp-1 through line-clamp-6
    if (maxLines <= 6) return `line-clamp-${maxLines}`;
    
    // For more than 6 lines, we'll use a custom style
    return 'overflow-hidden';
  };

  // Combine all the classes
  const combinedClasses = `
    ${fontSizeClasses[fontSize]}
    ${fontWeightClasses[fontWeight]}
    ${colorClasses[color]}
    ${lineHeightClasses[lineHeight]}
    ${getLineClampClass()}
    ${className}
  `;

  // Custom style for more than 6 lines
  const customStyle = maxLines > 6 && shouldTruncate
    ? { maxHeight: `${maxLines * 1.5}em`, overflow: 'hidden' }
    : {};

  return (
    <div className="relative">
      <p className={combinedClasses} style={customStyle}>
        {text}
      </p>
      
      {/* Show "Read more" button if text is truncated and expandable */}
      {expandable && maxLines > 0 && text.length > 100 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-sm font-medium text-[#0078d4] hover:text-[#50a3d9] transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default TextContent;
