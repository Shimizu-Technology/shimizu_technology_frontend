# Image Optimization with Imgix

## Overview

Hafaloha uses Imgix to optimize image loading performance throughout the application. This document outlines the implementation details, configuration, and best practices for image handling.

The implementation leverages modern web techniques including responsive images with `srcset` and `sizes` attributes, lazy loading, and automatic format selection to provide the best possible user experience.

## Architecture

### Image Storage and Delivery Flow

1. **Storage**: Images are stored in AWS S3 (`hafaloha.s3.ap-southeast-2.amazonaws.com`)
2. **Transformation**: Imgix fetches, optimizes, and caches images on-demand
3. **Delivery**: Optimized images are served to users via Imgix's global CDN network

```
┌────────────┐    ┌───────────┐    ┌──────────┐
│ S3 Bucket  │───>│ Imgix     │───>│ Browser  │
│ (Storage)  │    │ CDN       │    │          │
└────────────┘    └───────────┘    └──────────┘
```

### Key Benefits

1. **Performance**: Faster load times via optimized formats (AVIF/WebP), compression, and CDN caching
2. **Automation**: No need to pre-process images into multiple formats/sizes
3. **Modern Formats**: Automatic format negotiation with `auto=format`
4. **Responsiveness**: Integration with `srcset`/`sizes` for optimal image delivery
5. **Advanced Image Processing**: Access to Imgix's powerful image transformation capabilities
6. **Reliability**: Dedicated image optimization service with high availability
7. **Perceived Performance**: Low-quality image placeholders (LQIP) with blur-up effect
8. **Resource Prioritization**: Browser resource hints with `fetchPriority` attribute
9. **Efficient Loading**: Enhanced lazy loading with Intersection Observer API

## Implementation

### Components

The image optimization implementation consists of the following components:

1. **ResponsiveImage.tsx**: A component that implements responsive images using `srcset` and `sizes` attributes
   - Generates multiple image URLs with different width parameters
   - Creates appropriate `srcset` and `sizes` attributes for optimal browser selection
   - Handles fallback images and loading priorities
   - Includes error handling to fall back to original URLs if Imgix fails
   - Implements LQIP (Low-Quality Image Placeholders) with blur-up effect
   - Supports the `fetchPriority` attribute for resource prioritization

2. **OptimizedImage.tsx**: A wrapper component that provides a simple API for image optimization
   - Uses a context-based approach for different image types (menu item, hero, cart)
   - Passes appropriate options to ResponsiveImage based on the context
   - Maintains a clean, simple API for the rest of the application
   - Supports the `fetchPriority` attribute for resource prioritization

3. **imageUtils.ts**: Utility functions for image URL transformation
   - `getImgixImageUrl`: Transforms S3 URLs into Imgix URLs with appropriate parameters
   - `getImageDimensionsForContext`: Provides appropriate dimensions for different contexts
   - Supports blur parameter for LQIP implementation

4. **useIntersectionObserver.ts**: Custom hook for enhanced lazy loading
   - Uses the Intersection Observer API to detect when elements enter the viewport
   - Provides a simple interface for implementing lazy loading
   - Configurable threshold and root margin for fine-tuned control
   - Option to trigger only once for performance optimization

### Usage Examples

#### Basic Usage with Context

```tsx
<OptimizedImage 
  src="https://hafaloha.s3.ap-southeast-2.amazonaws.com/menu-items/spam-musubi.jpg"
  alt="Spam Musubi"
  context="menuItem"
/>
```

#### Advanced Usage with Custom Options

```tsx
<OptimizedImage 
  src="https://hafaloha.s3.ap-southeast-2.amazonaws.com/hero/banner.jpg"
  alt="Hero Banner"
  priority={true} // Load with high priority
  fetchPriority="high" // Browser resource loading priority
  imgixOptions={{
    width: 1600,
    height: 900,
    auto: 'format,compress',
    quality: 80,
    fit: 'cover'
  }}
/>
```

#### Enhanced Lazy Loading with Intersection Observer

```tsx
function LazyLoadedImage({ src, alt }) {
  const [ref, isVisible] = useIntersectionObserver({
    rootMargin: '200px',
    triggerOnce: true
  });

  return (
    <div ref={ref} className="image-container">
      {isVisible ? (
        <OptimizedImage src={src} alt={alt} />
      ) : (
        <div className="placeholder-pulse" />
      )}
    </div>
  );
}
```

## Configuration

### S3 Bucket Configuration

The S3 bucket is configured with appropriate CORS settings to allow Imgix to fetch the original images:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://hafaloha-orders.com", "http://localhost:*"],
      "AllowedMethods": ["GET"],
      "MaxAgeSeconds": 3000,
      "AllowedHeaders": ["*"]
    }
  ]
}
```

### Netlify Configuration

The `netlify.toml` file in the frontend project root includes the following configuration:

```toml
# Image CDN configuration
[images]
  # Allow Netlify to fetch images from the Hafaloha S3 bucket
  remote_images = [
    "https:\\/\\/hafaloha\\.s3\\.ap-southeast-2\\.amazonaws\\.com\\/.*"
  ]
  
  # Default image optimization settings
  quality = 80
  format = "auto"  # Will serve WebP or AVIF when supported by the browser
```

## Frontend Implementation

### OptimizedImage Component

The application uses a dedicated `OptimizedImage` React component that transforms S3 URLs to use Imgix:

```tsx
// Example usage with context
<OptimizedImage
  src="https://hafaloha.s3.ap-southeast-2.amazonaws.com/menu_item_1_1739747989.jpeg"
  alt="Menu Item"
  width={400}
  height={300}
  priority={false}
  context="menuItem"
/>

// Example with explicit Imgix options
<OptimizedImage
  src="https://hafaloha.s3.ap-southeast-2.amazonaws.com/menu_item_1_1739747989.jpeg"
  alt="Menu Item"
  width={400}
  height={300}
  imgixOptions={{
    width: 400,
    height: 300,
    quality: 80,
    auto: 'format,compress',
    fit: 'cover'
  }}
/>
```

### Image Utilities

The `imageUtils.ts` file provides helper functions for image optimization:

- `getImgixImageUrl`: Transforms S3 URLs to Imgix URLs with appropriate parameters
- `getImageDimensionsForContext`: Provides appropriate dimensions for different image contexts

## Best Practices

### Image Sizing

The application uses context-specific image dimensions:

| Context    | Width (px) | Height (px) | Purpose                       |
|------------|------------|-------------|-------------------------------|
| menuItem   | 400        | 300         | Menu item cards               |
| hero       | 1920       | 1080        | Hero banner images            |
| cart       | 100        | 100         | Cart item thumbnails          |
| featured   | 600        | 400         | Featured item highlights      |

These dimensions are defined in the `getImageDimensionsForContext` function in `imageUtils.ts`.

### Priority Loading

Critical images use priority loading to improve Core Web Vitals:

- Hero images
- Featured menu items
- Above-the-fold content

Two mechanisms are used for priority loading:

1. **React's priority prop**: Controls when the image is loaded during hydration
2. **fetchPriority attribute**: Browser resource loading hint (high, low, auto)

Example:
```tsx
<OptimizedImage
  src="hero-image.jpg"
  alt="Hero"
  priority={true} // React priority
  fetchPriority="high" // Browser resource priority
/>
```

### Low-Quality Image Placeholders (LQIP)

To improve perceived performance, the application uses LQIP with a blur-up effect:

1. A tiny (20px wide) blurred version of the image is loaded first
2. This placeholder is displayed with a blur filter while the full image loads
3. When the full image loads, it fades in smoothly over the placeholder
4. This technique gives users immediate visual feedback while the high-quality image loads

### Enhanced Lazy Loading

Images outside the viewport are loaded only when they come close to entering the viewport:

1. The Intersection Observer API is used to detect when image containers approach the viewport
2. Images start loading when they are within 200px of entering the viewport (configurable)
3. This reduces initial page load time and saves bandwidth for images that may never be viewed
4. A placeholder or skeleton UI is shown until the image loads

### Error Handling

The implementation includes robust error handling:

- If an image fails to load via Imgix, it falls back to the original S3 URL
- If both fail, it falls back to a local placeholder image (`/placeholder-food.png`)
- Error events are logged to the console for debugging
- The LQIP placeholder remains visible during loading attempts

## Troubleshooting

### Common Issues

1. **Images not optimized**: Check browser network tab for requests to the Imgix domain
2. **CORS errors**: Verify S3 bucket CORS configuration
3. **404 errors**: Ensure S3 objects have public read access
4. **Low quality images**: Adjust quality parameter in Imgix options
5. **Missing environment variable**: Ensure `VITE_IMGIX_DOMAIN` is set in both development and production
6. **LQIP not working**: Check if blur parameter is supported and CSS transitions are applied
7. **Lazy loading issues**: Verify Intersection Observer support and rootMargin settings
8. **fetchPriority not working**: Ensure browser supports the fetchPriority attribute

### Verification

To verify the image optimization is working correctly:

1. **Network Tab Analysis**:
   - Open browser DevTools and check the Network tab
   - Filter by "img" or the Imgix domain
   - Verify images are loading from the Imgix domain
   - Check for 200 status codes and appropriate content types

2. **Performance Verification**:
   - Use Lighthouse or PageSpeed Insights to measure LCP and CLS metrics
   - Verify that critical images load quickly
   - Check that lazy-loaded images don't contribute to initial page load time

3. **Visual Inspection**:
   - Verify LQIP blur-up effect is working on slower connections
   - Check that images load progressively as you scroll
   - Ensure placeholder images appear correctly when images fail to load

## Advanced Techniques

### Responsive Art Direction

For cases where different image crops are needed at different viewport sizes:

```tsx
<picture>
  <source
    media="(max-width: 640px)"
    srcSet={getImgixImageUrl(image, { width: 640, height: 480, crop: 'faces' })}
  />
  <source
    media="(max-width: 1024px)"
    srcSet={getImgixImageUrl(image, { width: 1024, height: 576, crop: 'entropy' })}
  />
  <OptimizedImage src={image} alt="Responsive art direction example" />
</picture>
```

### Content-Aware Cropping

Imgix provides advanced cropping options that can be used for better image composition:

```tsx
<OptimizedImage
  src={portraitImage}
  alt="Portrait"
  imgixOptions={{
    crop: 'faces',
    fit: 'crop'
  }}
/>
```

### Image Preloading

For absolutely critical images, consider using link preload:

```tsx
function PreloadCriticalImage({ src }) {
  React.useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getImgixImageUrl(src, { width: 1200, auto: 'format,compress' });
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [src]);
  
  return null;
}
```

To verify the Imgix integration is working:

1. Inspect image elements in the browser
2. Look for `src` attributes containing the Imgix domain (`shimizu-technology.imgix.net`)
3. Check network requests for image format (WebP/AVIF in supported browsers)
4. Verify that the response headers include Imgix-specific headers
5. Compare image file sizes before and after optimization

## Local Development

During local development:

- The Netlify Image CDN is only available when using Netlify Dev CLI
- Without Netlify Dev, the application falls back to original S3 URLs
- To test locally with Netlify Image CDN, run: `netlify dev`

## Backend Implementation

### Image Upload

The Rails backend handles image uploads to S3 using Active Storage:

1. Images are uploaded to the API
2. Active Storage processes and stores images in S3
3. The API returns the S3 URL which is then transformed by the frontend

### Image URL Structure

S3 image URLs follow this pattern:
```
https://hafaloha.s3.ap-southeast-2.amazonaws.com/[object_type]_[id]_[timestamp].[extension]
```

Example:
```
https://hafaloha.s3.ap-southeast-2.amazonaws.com/menu_item_1_1739747989.jpeg
```

## Performance Impact

The Netlify Image CDN implementation provides several performance benefits:

- **Reduced file sizes**: Modern formats (WebP, AVIF) reduce file size by 30-50%
- **Faster loading**: CDN caching reduces latency
- **Appropriate sizing**: Images are served at the appropriate dimensions for each device
- **Improved Core Web Vitals**: Faster Largest Contentful Paint (LCP) times
- **Reduced bandwidth**: Smaller files mean less data transfer for users

## Future Improvements

Potential future enhancements to the image optimization system:

1. Implement responsive `srcset` attributes for different viewport sizes
2. Add art direction for different device types
3. Implement image preloading for critical paths
4. Add automatic image compression during upload
5. Implement lazy-loaded image galleries for merchandise
