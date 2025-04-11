// src/shared/components/ui/OptimizedImage.tsx
import React from 'react';
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
}

/**
 * OptimizedImage component that uses Imgix and responsive images
 * for optimal image loading and performance
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src: sourceUrl,
  fallbackSrc = '/placeholder-food.png',
  alt = '',
  priority = false,
  fetchPriority,
  imgixOptions: explicitImgixOptions, // Renamed to avoid clash
  context,
  widths: explicitWidths,
  sizes: explicitSizes,
  ...imgProps // Pass down className, style etc.
}) => {
  // Determine responsive widths based on context or explicit prop
  let responsiveWidths: number[];
  if (explicitWidths) {
    responsiveWidths = explicitWidths;
  } else if (context) {
    switch (context) {
      case 'menuItem': responsiveWidths = [200, 400, 600]; break;
      case 'hero': responsiveWidths = [768, 1280, 1920, 2400]; break; // Added larger size
      case 'cart': responsiveWidths = [100, 200]; break; // Simplified cart
      case 'featured': responsiveWidths = [300, 600, 900, 1200]; break;
      default: responsiveWidths = [400, 800, 1200]; // Default set
    }
  } else {
    responsiveWidths = [400, 800, 1200]; // Fallback default
  }
  
  // Determine sizes attribute based on context or explicit prop
  let sizes: string;
  if (explicitSizes) {
    sizes = explicitSizes;
  } else if (context) {
    switch (context) {
      case 'menuItem': sizes = '(max-width: 500px) 90vw, (max-width: 768px) 45vw, 300px'; break; // Example sizes
      case 'hero': sizes = '100vw'; break; // Hero usually full width
      case 'cart': sizes = '100px'; break; // Fixed small size
      case 'featured': sizes = '(max-width: 768px) 90vw, 600px'; break; // Example sizes
      default: sizes = '(max-width: 768px) 90vw, 50vw'; // Default sizes
    }
  } else {
    sizes = '(max-width: 768px) 90vw, 50vw'; // Fallback default sizes
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
            quality: 85,
            dpr: 2,
            ...explicitImgixOptions
          };
          
          // Build query string from options
          const params = new URLSearchParams();
          Object.entries(imgixOptions).forEach(([key, value]) => {
            if (value !== undefined) params.append(key, String(value));
          });
          
          // Set width and height based on the display size (doubled for retina)
          params.append('w', '200');
          params.append('h', '200');
          
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
        width={imgProps.width || 100} // Use provided width or default
        height={imgProps.height || 100} // Use provided height or default
        loading="eager" // Load cart images eagerly since they're important on mobile
        {...(fetchPriority ? { fetchpriority: fetchPriority } : { fetchpriority: 'high' })} // Prioritize cart images
        onError={(e) => { if ((e.target as HTMLImageElement).src !== fallbackSrc) { (e.target as HTMLImageElement).src = fallbackSrc; }}}
        {...imgProps}
      />
    );
  }
  
  // Default base Imgix options
  const baseImgixOptions: Omit<ImgixImageOptions, 'width' | 'height'> = {
    auto: 'format,compress', // Default optimization
    fit: 'cover',             // Default fit
    quality: 75,              // Default quality
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
      {...imgProps} // Pass down className, style etc.
    />
  );
};

export default OptimizedImage;
