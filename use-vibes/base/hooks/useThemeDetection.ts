import { useEffect, useState } from 'react';

/**
 * Hook to detect system dark mode preference
 * @returns boolean indicating if dark mode is active
 */
export function useThemeDetection(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  return isDark;
}
