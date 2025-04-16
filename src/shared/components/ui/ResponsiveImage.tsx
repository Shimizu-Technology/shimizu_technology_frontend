// src/shared/components/ui/ResponsiveImage.tsx
import React, { useState, useEffect, memo } from 'react';
import { getImgixImageUrl, ImgixImageOptions } from '../../utils/imageUtils';

interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'> {
  src: string | undefined | null; // Original source URL (e.g., from S3)
  widths: number[]; // Array of widths for srcset, e.g., [400, 800, 1200]
  sizes: string; // sizes attribute value, e.g., "(max-width: 600px) 90vw, 800px"
  alt: string;
  // Pass base Imgix options like fit, maybe default quality (q), auto
  imgixOptions?: Omit<ImgixImageOptions, 'width' | 'height'>;
  fallbackSrc?: string; // Local path for placeholder
  priority?: boolean; // For loading="eager" vs "lazy"
  fetchPriority?: 'high' | 'low' | 'auto'; // Browser resource loading priority
  isLCP?: boolean; // Is this a Largest Contentful Paint image
  preload?: boolean; // Should this image be preloaded in the head
}

/**
 * ResponsiveImage component that uses srcset and sizes attributes for optimal image loading
 * Leverages Imgix for on-the-fly image transformations
 */
const ResponsiveImage: React.FC<ResponsiveImageProps> = memo(({
  src: sourceUrl,
  widths,
  sizes,
  alt = '',
  imgixOptions = { auto: 'format,compress', fit: 'cover' }, // Default Imgix params
  fallbackSrc = '/placeholder-food.png', // Use a valid local placeholder
  priority = false,
  fetchPriority,
  isLCP = false,
  preload = false,
  ...imgProps // Pass other img attributes like className, style, etc.
}) => {
  // Set loading attribute based on priority or LCP status
  const loadingAttribute = priority || isLCP ? 'eager' : 'lazy';
  
  // If this is an LCP image, we want to make sure it loads with high priority
  const effectiveFetchPriority = isLCP ? 'high' : fetchPriority;

  // Handle missing source URL
  if (!sourceUrl || !widths || widths.length === 0) {
    console.log('ResponsiveImage: Missing src or widths, using fallback.');
    return (
      <img 
        src={fallbackSrc} 
        alt={alt} 
        loading={loadingAttribute}
        fetchPriority={fetchPriority}
        {...imgProps} 
      />
    );
  }

  // Ensure widths are sorted for predictable defaultSrc
  const sortedWidths = [...widths].sort((a, b) => a - b);

  // Generate srcset using getImgixImageUrl
  const srcset = sortedWidths
    .map(width => {
      // Pass the base options and the specific width for this source
      const url = getImgixImageUrl(sourceUrl, {
        ...imgixOptions,
        width: width,
        // Ensure fit is a valid value from the enum
        fit: (imgixOptions?.fit as ImgixImageOptions['fit']) || 'cover',
      });
      // Format: url widthDescriptor (e.g., "image.jpg?w=400 400w")
      return url ? `${url} ${width}w` : '';
    })
    .filter(Boolean) // Remove empty strings if URL generation failed
    .join(', ');

  // Generate a default src (usually the smallest size) for older browsers
  const defaultSrc = getImgixImageUrl(sourceUrl, {
    ...imgixOptions,
    width: sortedWidths[0], // Use the smallest width
    // Ensure fit is a valid value from the enum
    fit: (imgixOptions?.fit as ImgixImageOptions['fit']) || 'cover',
  });
  
  // Preload the image if specified
  useEffect(() => {
    if (preload && defaultSrc && srcset) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = defaultSrc;
      link.setAttribute('imagesrcset', srcset);
      link.setAttribute('imagesizes', sizes);
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [preload, defaultSrc, srcset, sizes]);

  // If essential URLs couldn't be generated, fallback
  if (!srcset || !defaultSrc) {
    console.warn('ResponsiveImage: Could not generate srcset or defaultSrc, using fallback.');
    return (
      <img 
        src={fallbackSrc} // Or maybe sourceUrl if preferred?
        alt={alt} 
        loading={loadingAttribute}
        fetchPriority={fetchPriority}
        {...imgProps} 
      />
    );
  }

  // State to track if the main image has loaded
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Generate a tiny placeholder image URL
  const placeholderSrc = getImgixImageUrl(sourceUrl, {
    ...imgixOptions,
    width: 20,
    blur: 15,
    quality: 30,
    // Ensure fit is a valid value from the enum
    fit: (imgixOptions?.fit as ImgixImageOptions['fit']) || 'cover',
  });

  return (
    <div className="relative overflow-hidden" style={{ width: '100%', height: '100%' }}>
      {/* Only show placeholder for non-LCP images to avoid competing with main image */}
      {placeholderSrc && !isLCP && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg"
          style={{
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.4s ease-in-out',
            filter: 'blur(8px)'
          }}
        />
      )}
      
      {/* Main image that fades in when loaded */}
      <img
        src={defaultSrc} // Base src
        srcSet={srcset}   // Responsive sources
        sizes={sizes}     // How image relates to viewport
        alt={alt}
        loading={loadingAttribute} // Handle lazy/eager loading
        decoding={isLCP ? 'sync' : 'async'} // Use sync decoding for LCP images
        className={`${imgProps.className || ''} relative z-10`}
        style={{
          ...imgProps.style,
          opacity: isLCP ? 1 : (isLoaded ? 1 : 0), // Always show LCP images immediately
          transition: isLCP ? 'none' : 'opacity 0.4s ease-in-out'
        }}
        {...(effectiveFetchPriority ? { fetchpriority: effectiveFetchPriority } : {})} // Add fetchpriority as a custom attribute
        onLoad={() => setIsLoaded(true)}
        // Simple onError fallback to placeholder
        onError={(e) => {
          console.error('Imgix image failed to load, falling back:', defaultSrc);
          // Prevent infinite loops if the fallback also fails
          if ((e.target as HTMLImageElement).src !== fallbackSrc) {
            (e.target as HTMLImageElement).src = fallbackSrc;
          }
          // Clear srcset/sizes to prevent browser trying them again
          (e.target as HTMLImageElement).srcset = '';
          (e.target as HTMLImageElement).sizes = '';
          // Still mark as loaded to hide the placeholder
          setIsLoaded(true);
        }}
        {...imgProps} // Spread remaining props (className, style, etc.)
      />
    </div>
  );
});

export default ResponsiveImage;
