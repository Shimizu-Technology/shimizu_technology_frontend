import React, { useState, useEffect } from 'react';

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * CachedImage component for optimized image loading
 * - Uses browser caching
 * - Supports lazy loading
 * - Shows a loading placeholder
 * - Handles errors gracefully
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  onLoad,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);
    
    // Try to get from cache first
    const cachedImage = localStorage.getItem(`img_cache_${src}`);
    if (cachedImage) {
      setImageSrc(cachedImage);
      setIsLoading(false);
      onLoad?.();
      return;
    }

    // If not in cache, load it
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      
      // Cache the image URL (not the actual image data)
      try {
        localStorage.setItem(`img_cache_${src}`, src);
      } catch (e) {
        // Handle localStorage errors (e.g., quota exceeded)
        console.warn('Failed to cache image URL:', e);
      }
      
      onLoad?.();
    };
    
    img.onerror = () => {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    };
  }, [src, onLoad, onError]);

  // Generate srcset for responsive images if width is provided
  const generateSrcSet = () => {
    if (!width) return undefined;
    
    // Create srcset for 1x, 2x, and 3x pixel densities
    return `${src} 1x, ${src} 2x, ${src} 3x`;
  };

  // Placeholder while loading
  if (isLoading) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        aria-label={`Loading ${alt}`}
      />
    );
  }

  // Error fallback
  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center text-gray-400 ${className}`}
        style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : '100%' }}
        aria-label={`Failed to load ${alt}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
    );
  }

  // Actual image
  return (
    <img
      src={imageSrc || ''}
      srcSet={generateSrcSet()}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
    />
  );
};

export default CachedImage;
