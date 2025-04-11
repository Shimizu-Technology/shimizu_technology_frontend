// src/shared/ScrollToTop.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Whenever the path changes, scroll to top
    window.scrollTo(0, 0);
  }, [pathname]);

  return null; // it doesn't render anything
}
