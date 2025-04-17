// src/ordering/components/layouts/LayoutToggle.tsx
import React from 'react';
import { LayoutGrid, AlignLeft } from 'lucide-react';
import { useMenuLayoutStore } from '../../store/menuLayoutStore';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';

// Define media query hook for responsive design
function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// Get colors based on restaurant context
function getColors(): { primary: string; hover: string; light: string; } {
  const { restaurant } = useRestaurantStore.getState();
  // Use Shimizu Technology blue for Shimizu, Hafaloha gold for Hafaloha
  return restaurant?.id === 2 
    ? { primary: '#0078d4', hover: '#50a3d9', light: '#e6f3fc' } 
    : { primary: '#c1902f', hover: '#d4a43f', light: '#f9f5ec' };
}

interface LayoutToggleProps {
  className?: string;
}

/**
 * LayoutToggle component provides buttons to switch between different menu layout views
 * Enhanced for touch devices and responsive design with modern styling
 */
export const LayoutToggle: React.FC<LayoutToggleProps> = ({ className = '' }) => {
  const { layoutType, setLayoutType, isLayoutSwitchingAllowed } = useMenuLayoutStore();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const colors = getColors();
  
  // If layout switching is explicitly disabled, don't render the toggle
  if (!isLayoutSwitchingAllowed()) {
    return null;
  }
  
  return (
    <div className="relative">
      <div 
        className={`inline-flex rounded-md overflow-hidden shadow-sm border border-gray-200 ${className}`} 
        role="group" 
        aria-label="Menu layout options"
      >
        <button
          type="button"
          onClick={() => setLayoutType('gallery')}
          className={`
            px-4 py-2 text-sm font-medium
            flex items-center justify-center gap-2
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[${colors.primary}]/50
            transition-all duration-200 ease-in-out
            touch-manipulation min-h-[40px] min-w-[80px]
            ${layoutType === 'gallery'
              ? `bg-[${colors.primary}] text-white shadow-sm`
              : `bg-white text-gray-700 hover:bg-[${colors.light}] hover:text-[${colors.primary}] border-gray-300`
            }
            ${layoutType === 'gallery' ? 'border-r border-white/20' : 'border-r border-gray-200'}
          `}
          aria-pressed={layoutType === 'gallery'}
        >
          <LayoutGrid size={isMobile ? 16 : 18} strokeWidth={2} />
          {!isMobile && <span>Gallery</span>}
        </button>
        
        <button
          type="button"
          onClick={() => setLayoutType('list')}
          className={`
            px-4 py-2 text-sm font-medium
            flex items-center justify-center gap-2
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[${colors.primary}]/50
            transition-all duration-200 ease-in-out
            touch-manipulation min-h-[40px] min-w-[80px]
            ${layoutType === 'list'
              ? `bg-[${colors.primary}] text-white shadow-sm`
              : `bg-white text-gray-700 hover:bg-[${colors.light}] hover:text-[${colors.primary}] border-gray-300`
            }
          `}
          aria-pressed={layoutType === 'list'}
        >
          <AlignLeft size={isMobile ? 16 : 18} strokeWidth={2} />
          {!isMobile && <span>List</span>}
        </button>
      </div>
    </div>
  );
};

export default LayoutToggle;
