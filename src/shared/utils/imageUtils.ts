// src/shared/utils/imageUtils.ts

/**
 * Interface for Imgix transformation options
 */
export interface ImgixImageOptions {
  width?: number;       // w parameter
  height?: number;      // h parameter
  quality?: number;     // q parameter
  // format is usually handled by 'auto', but available if needed
  format?: 'avif' | 'webp' | 'jpg' | 'png' | 'jp2' | 'auto'; // fm parameter
  // Common Imgix fit options
  fit?: 'crop' | 'clip' | 'clamp' | 'facearea' | 'fill' | 'fillmax' | 'max' | 'min' | 'scale' | 'cover'; // fit parameter
  // Recommended: Use 'auto' for format negotiation and compression
  auto?: string; // e.g., 'format', 'compress', 'format,compress'
  // Add other common params like device pixel ratio if needed
  dpr?: number;
  // Blur effect (0-2000)
  blur?: number;
}

// Get the Imgix domain from environment variables
const IMGIX_DOMAIN = import.meta.env.VITE_IMGIX_DOMAIN;

/**
 * Generates an Imgix URL from a source URL (likely S3)
 * @param sourceUrl - The full HTTPS URL of the original image on S3
 * @param options - Imgix transformation parameters
 * @returns The generated Imgix URL string, or undefined/original if invalid input
 */
export function getImgixImageUrl(sourceUrl: string | undefined | null, options: ImgixImageOptions = {}): string | undefined {
  // Basic validation and environment check
  if (!sourceUrl || !IMGIX_DOMAIN || sourceUrl.startsWith('/')) {
    // console.warn('Imgix URL generation skipped:', { sourceUrl, IMGIX_DOMAIN });
    return sourceUrl || undefined; // Return original if it's local or invalid
  }

  try {
    // 1. Parse the S3 URL to get the path (key) of the image
    const s3Url = new URL(sourceUrl);
    const imagePath = s3Url.pathname.substring(1); // Remove the leading '/'

    if (!imagePath) {
      console.error("Could not extract path from source URL for Imgix:", sourceUrl);
      return sourceUrl; // Fallback to original
    }

    // 2. Create URL Search Params for Imgix options
    const params = new URLSearchParams();

    // Map options to Imgix parameters
    if (options.width) params.set('w', String(options.width));
    if (options.height) params.set('h', String(options.height));
    if (options.quality) params.set('q', String(options.quality));
    if (options.fit) params.set('fit', options.fit);
    if (options.dpr) params.set('dpr', String(options.dpr));

    // Handle 'auto' parameter (RECOMMENDED) vs specific 'format'
    if (options.auto) {
      params.set('auto', options.auto); // e.g., 'format,compress'
    } else if (options.format) {
      params.set('fm', options.format); // Only set 'fm' if 'auto' isn't used
    } else {
      // Default to auto format if nothing else specified
      params.set('auto', 'format');
    }

    // Set default quality only if not specified AND auto=compress isn't used
    if (!params.has('q') && !(params.get('auto')?.includes('compress'))) {
      params.set('q', '75'); // Default Imgix quality
    }

    // 3. Construct the final Imgix URL
    const queryString = params.toString();
    const imgixUrl = `https://${IMGIX_DOMAIN}/${imagePath}${queryString ? '?' + queryString : ''}`;

    return imgixUrl;

  } catch (error) {
    console.error("Error creating Imgix URL:", { sourceUrl, options, error });
    return sourceUrl; // Fallback to original URL on error
  }
}

/**
 * Gets appropriate image dimensions based on the usage context
 * 
 * @param context - Where the image will be used (e.g., 'menuItem', 'hero', 'cart')
 * @returns The recommended dimensions for the given context
 */
export function getImageDimensionsForContext(context: 'menuItem' | 'hero' | 'cart' | 'featured'): ImgixImageOptions {
  // Note: These primarily inform which widths/sizes to use in the components
  // The actual 'width'/'height' params are usually set per size in srcset
  switch (context) {
    case 'menuItem':
      return {
        fit: 'cover',
        auto: 'format,compress'
      };
    case 'hero':
      return {
        fit: 'cover',
        auto: 'format,compress'
      };
    case 'cart':
      return {
        width: 100,
        height: 100,
        fit: 'cover',
        auto: 'format,compress'
      };
    case 'featured':
      return {
        fit: 'cover',
        auto: 'format,compress'
      };
    default:
      return {
        fit: 'cover',
        auto: 'format,compress'
      };
  }
}
