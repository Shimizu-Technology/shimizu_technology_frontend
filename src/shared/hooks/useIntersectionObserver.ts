// src/shared/hooks/useIntersectionObserver.ts
import { useRef, useState, useEffect } from 'react';

interface IntersectionObserverOptions extends IntersectionObserverInit {
  triggerOnce?: boolean;
}

/**
 * A hook that observes when an element enters the viewport
 * @param options - IntersectionObserver options with additional triggerOnce flag
 * @returns [ref, isIntersecting] - Ref to attach to the element and boolean indicating if it's visible
 */
export function useIntersectionObserver(options: IntersectionObserverOptions = {}) {
  const { 
    root = null,
    rootMargin = '200px', // Load images 200px before they enter the viewport
    threshold = 0,
    triggerOnce = true // By default, only trigger once
  } = options;
  
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsIntersecting(entry.isIntersecting);
        
        // If element is intersecting and we only want to trigger once, unobserve
        if (entry.isIntersecting && triggerOnce) {
          observer.unobserve(entry.target);
        }
      },
      { root, rootMargin, threshold }
    );
    
    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [root, rootMargin, threshold, triggerOnce]);
  
  return [ref, isIntersecting] as const;
}

export default useIntersectionObserver;
