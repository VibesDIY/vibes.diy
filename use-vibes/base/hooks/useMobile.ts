import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport (max-width: 768px)
 *
 * Returns true if the viewport is mobile-sized, false otherwise.
 * Updates automatically when the window is resized.
 *
 * @returns {boolean} Whether the current viewport is mobile-sized
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
