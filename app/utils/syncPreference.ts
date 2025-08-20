/**
 * Utilities for managing sync preference in localStorage
 * This avoids the circular dependency of needing to sync settings to read sync preference
 */

const SYNC_PREFERENCE_KEY = 'vibes_enable_sync';

export function getSyncPreference(): boolean {
  if (typeof window === 'undefined') return false; // SSR safety
  try {
    const stored = localStorage.getItem(SYNC_PREFERENCE_KEY);
    return stored === 'true';
  } catch {
    return false; // Default to false if localStorage fails
  }
}

export function setSyncPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return; // SSR safety
  try {
    localStorage.setItem(SYNC_PREFERENCE_KEY, enabled.toString());
  } catch {
    // Fail silently if localStorage is not available
  }
}
