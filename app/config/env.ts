/**
 * Central configuration file for environment variables
 * Provides fallback values for required environment variables
 */

// Function to get the current database version from local storage
const getDatabaseVersion = (): number => {
  if (typeof window === 'undefined') return 0;

  const storedVersion = localStorage.getItem('vibes-db-version') || '';
  return storedVersion ? JSON.parse(storedVersion) : 0;
};

// Function to increment the database version
export const incrementDatabaseVersion = (): number => {
  if (typeof window === 'undefined') return 0;

  const currentVersion = getDatabaseVersion();
  const newVersion = currentVersion === 0 ? 1 : currentVersion + 1;

  localStorage.setItem('vibes-db-version', JSON.stringify(newVersion));
  return newVersion;
};

// Fireproof database name with version suffix
const getVersionSuffix = (): string => {
  const version = getDatabaseVersion();
  return version === 0 ? '' : `${version}`;
};

// --- Vite Environment Variables ---
// Access environment variables safely with fallbacks

// Analytics
export const GA_TRACKING_ID = import.meta.env.VITE_GOOGLE_ANALYTICS_ID || '';

// PostHog
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || '';

// Application Behavior
export const IS_DEV_MODE = import.meta.env.DEV || false;
export const APP_MODE = import.meta.env.MODE || 'production'; // typically 'development', 'production', 'test'

// Fireproof Connect & Auth
export const CONNECT_URL =
  import.meta.env.VITE_CONNECT_URL || 'https://connect.fireproof.direct/token';
export const CONNECT_API_URL =
  import.meta.env.VITE_CONNECT_API_URL || 'https://connect.fireproof.direct/api';
export const CLOUD_SESSION_TOKEN_PUBLIC_KEY =
  import.meta.env.VITE_CLOUD_SESSION_TOKEN_PUBLIC ||
  'zeWndr5LEoaySgKSo2aZniYqWtx2vKfVz4dd5GQwAuby3fPKcNyLp6mFpf9nCRFYbUcPiN2YT1ZApJ6f3WipiVjuMvyP1JYgHwkaoxDBpJiLoz1grRYkbao9ntukNNo2TQ4uSznUmNPrr4ZxjihoavHwB1zLhLNp5Qj78fBkjgEMA';

// Vibes Service API
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://vibes-diy-api.com';

export const APP_HOST_BASE_URL = import.meta.env.VITE_APP_HOST_BASE_URL || 'https://vibesdiy.app';

// CallAI Endpoint
export const CALLAI_ENDPOINT = import.meta.env.VITE_CALLAI_ENDPOINT || API_BASE_URL;

// Chat History Database
export const SETTINGS_DBNAME =
  (import.meta.env.VITE_VIBES_CHAT_HISTORY || 'vibes-chats') + getVersionSuffix();

// Catalog Database
export const CATALOG_DBNAME = import.meta.env.VITE_CATALOG_DBNAME || 'v-catalog';

// Set up Fireproof debugging if in browser environment
if (typeof window !== 'undefined') {
  // Method 1: Using FP_ENV Symbol (direct approach)
  // @ts-ignore - Setting up Fireproof debug environment
  window[Symbol.for('FP_ENV')] = window[Symbol.for('FP_ENV')] || new Map();
  // @ts-ignore - Enable full Fireproof debugging
  window[Symbol.for('FP_ENV')].set('FP_DEBUG', '*');

  // Method 2: Using logger (alternative approach from Fireproof README)
  // Uncomment this if you prefer using the logger method:
  // import { logger } from 'use-fireproof';
  // logger.setDebug('*');
}
