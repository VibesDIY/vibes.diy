import { useFireproof, toCloud } from 'use-fireproof';
import { SETTINGS_DBNAME } from '../config/env';
import { useAuth } from '../contexts/AuthContext';
import type { UserSettings } from '../types/settings';
import { getSyncPreference } from '../utils/syncPreference';

/**
 * Hook to access user settings from anywhere in the app
 * Sync preference is stored in localStorage to avoid circular dependency
 */
export function useUserSettings() {
  const { isAuthenticated } = useAuth();
  const isEnableSyncEnabled = getSyncPreference();

  // Only sync settings when sync is enabled and user is authenticated
  const { useDocument } = useFireproof(
    SETTINGS_DBNAME,
    isEnableSyncEnabled && isAuthenticated ? { attach: toCloud() } : {}
  );

  const { doc: settings } = useDocument<UserSettings>({
    _id: 'user_settings',
    stylePrompt: '',
    userPrompt: '',
    model: '',
  });

  return {
    settings,
    isEnableSyncEnabled,
  };
}
