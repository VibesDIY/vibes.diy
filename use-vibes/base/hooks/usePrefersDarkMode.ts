import { useEffect, useState } from 'react';

/**
 * React hook to read the user's preferred color scheme.
 *
 * When `ignore` is true the hook always returns `false` and skips
 * subscribing to the `matchMedia` listener, so callers can opt out of
 * dark-mode styling while still sharing the same implementation.
 */
export function usePrefersDarkMode(ignore = false): boolean {
  const getInitial = () => {
    if (ignore) return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const [isDark, setIsDark] = useState<boolean>(getInitial);

  useEffect(() => {
    if (ignore) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsDark(false);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const checkDarkMode = () => {
      setIsDark(mediaQuery.matches);
    };

    // Initialise from current preference
    checkDarkMode();

    // Subscribe to changes. Use either the modern or legacy API
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', checkDarkMode);
      return () => mediaQuery.removeEventListener('change', checkDarkMode);
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(checkDarkMode);
      return () => mediaQuery.removeListener(checkDarkMode);
    }

    return undefined;
  }, [ignore]);

  if (ignore) return false;
  return isDark;
}
