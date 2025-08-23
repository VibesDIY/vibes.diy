/**
 * Optional utility to automatically load the use-vibes CSS styles
 * This is an alternative to manually adding a <link> tag
 *
 * Usage:
 * ```js
 * import { bootstrapUseVibesStyles } from 'use-vibes/style-loader';
 * // CSS styles are now automatically loaded
 * ```
 */

/**
 * Automatically injects the use-vibes CSS into the document head
 * Only runs in browser environments and only injects the styles once
 * @returns true if styles were injected, false if already present or not in browser
 */
export function bootstrapUseVibesStyles(): boolean {
  // Skip in non-browser environments
  if (typeof document === 'undefined') {
    return false;
  }

  const cssPath = './components/ImgGen.css';

  // Check if already loaded
  if (document.querySelector(`link[data-use-vibes-css]`)) {
    return false;
  }

  try {
    // Create link element
    const link = document.createElement('link');
    link.rel = 'stylesheet';

    link.href = new URL(cssPath, import.meta.url).toString();
    link.setAttribute('data-use-vibes-css', 'true');

    // Append to head
    document.head.appendChild(link);
    return true;
  } catch (e) {
    console.warn('Failed to auto-load use-vibes styles:', e);
    return false;
  }
}

// Auto-execute when this module is imported
bootstrapUseVibesStyles();
