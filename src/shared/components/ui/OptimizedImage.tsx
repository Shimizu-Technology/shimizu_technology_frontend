// src/shared/components/ui/OptimizedImage.tsx
import React, { memo } from 'react';
import ResponsiveImage from './ResponsiveImage';
import { ImgixImageOptions } from '../../utils/imageUtils';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | undefined | null;
  // Allow overriding Imgix options like fit, quality, auto
  imgixOptions?: Omit<ImgixImageOptions, 'width' | 'height'>;
  // Context helps determine default sizes/widths
  context?: 'menuItem' | 'hero' | 'cart' | 'featured';
  // Allow explicitly setting widths/sizes if context isn't enough
  widths?: number[];
  sizes?: string;
  alt?: string;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  fallbackSrc?: string;
  // For LCP optimization
  isLCP?: boolean;
  preload?: boolean;
}

/**
 * OptimizedImage component that uses Imgix and responsive images
 * for optimal image loading and performance
 */
const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src: sourceUrl,
  fallbackSrc = '/placeholder-food.png',
  alt = '',
  priority = false,
  fetchPriority,
  imgixOptions: explicitImgixOptions, // Renamed to avoid clash
  context,
  widths: explicitWidths,
  sizes: explicitSizes,
  isLCP = false,
  preload = false,
  ...imgProps // Pass down className, style etc.
}) => {
  // Determine responsive widths based on context or explicit prop
  let responsiveWidths: number[];
  if (explicitWidths) {
    responsiveWidths = explicitWidths;
  } else if (context) {
    switch (context) {
      // Optimize menu item images - reduce sizes for better performance
      case 'menuItem': responsiveWidths = [160, 320, 480]; break;
      case 'hero': responsiveWidths = [768, 1280, 1920]; break;
      case 'cart': responsiveWidths = [80, 160]; break; // Further reduced cart images
      case 'featured': responsiveWidths = [240, 480, 720]; break; // Reduced featured sizes
      default: responsiveWidths = [320, 640, 960]; // Reduced default sizes
    }
  } else {
    responsiveWidths = [320, 640, 960]; // Reduced fallback default
  }
  
  // If this is an LCP image, prioritize it
  if (isLCP) {
    priority = true;
    fetchPriority = 'high';
  }
  
  // Determine sizes attribute based on context or explicit prop
  let sizes: string;
  if (explicitSizes) {
    sizes = explicitSizes;
  } else if (context) {
    switch (context) {
      // More precise sizing for menu items to avoid loading unnecessarily large images
      case 'menuItem': sizes = '(max-width: 500px) 90vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 25vw'; break;
      case 'hero': sizes = '100vw'; break; // Hero usually full width
      case 'cart': sizes = '80px'; break; // Reduced fixed size
      case 'featured': sizes = '(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 33vw'; break;
      default: sizes = '(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 33vw'; // More precise default
    }
  } else {
    sizes = '(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 33vw'; // More precise fallback
  }
  
  // Special case for 'cart' context where fixed size might be better than responsive
  if (context === 'cart') {
    // Get optimized URL from Imgix if available
    let optimizedUrl = sourceUrl || fallbackSrc;
    
    // Try to apply Imgix transformations directly to the URL if it's a valid URL
    if (sourceUrl && typeof sourceUrl === 'string') {
      try {
        // Get imgix domain from env
        const imgixDomain = import.meta.env.VITE_IMGIX_DOMAIN;
        
        if (imgixDomain) {
          // Extract the path from the source URL
          const urlObj = new URL(sourceUrl);
          const path = urlObj.pathname;
          
          // Create Imgix URL with optimizations
          const imgixOptions = {
            auto: 'format,compress',
            fit: 'clip', // Use clip instead of crop to preserve the entire image
            quality: 75, // Reduced quality for cart images
            dpr: window.devicePixelRatio || 2,
            ...explicitImgixOptions
          };
          
          // Build query string from options
          const params = new URLSearchParams();
          Object.entries(imgixOptions).forEach(([key, value]) => {
            if (value !== undefined) params.append(key, String(value));
          });
          
          // Set width and height based on the display size (doubled for retina)
          params.append('w', '160'); // Reduced from 200
          params.append('h', '160'); // Reduced from 200
          
          // Construct the final Imgix URL
          optimizedUrl = `https://${imgixDomain}${path}?${params.toString()}`;
        }
      } catch (e) {
        // If URL parsing fails, fall back to original URL
        console.warn('Failed to create Imgix URL:', e);
      }
    }
    
    return (
      <img
        src={optimizedUrl}
        alt={alt}
        width={imgProps.width || 80} // Reduced from 100
        height={imgProps.height || 80} // Reduced from 100
        loading="lazy" // Changed to lazy for cart images
        decoding="async"
        {...(fetchPriority ? { fetchpriority: fetchPriority } : {})} // Only add if specified
        onError={(e) => { if ((e.target as HTMLImageElement).src !== fallbackSrc) { (e.target as HTMLImageElement).src = fallbackSrc; }}}
        {...imgProps}
      />
    );
  }
  
  // Default base Imgix options
  const baseImgixOptions: Omit<ImgixImageOptions, 'width' | 'height'> = {
    auto: 'format,compress', // Default optimization
    fit: 'cover',             // Default fit
    quality: context === 'featured' || isLCP ? 80 : 70, // Higher quality for featured/LCP images, lower for others
    dpr: window.devicePixelRatio || 2, // Respect device pixel ratio
    ...explicitImgixOptions,  // Allow user overrides
  };

  // Use ResponsiveImage component for optimized, responsive images
  return (
    <ResponsiveImage
      src={sourceUrl}
      widths={responsiveWidths}
      sizes={sizes}
      alt={alt}
      imgixOptions={baseImgixOptions}
      fallbackSrc={fallbackSrc}
      priority={priority}
      fetchPriority={fetchPriority}
      preload={preload}
      isLCP={isLCP}
      {...imgProps} // Pass down className, style etc.
    />
  );
});

export default OptimizedImage;
