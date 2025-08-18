/**
 * Shared utilities for catalog operations
 * Used by both useCatalog hook and standalone functions like publishUtils
 */

import { fireproof } from 'use-fireproof';
import { CATALOG_DBNAME } from '../config/env';

/**
 * Get the standardized catalog database name for a user
 * @param userId The user ID
 * @returns The catalog database name
 */
export function getCatalogDbName(userId: string): string {
  const cleanUserId = userId || 'local';
  return `${CATALOG_DBNAME}-${cleanUserId}`;
}

/**
 * Create a catalog document ID for a vibe
 * @param vibeId The vibe/session ID
 * @returns The catalog document ID
 */
export function createCatalogDocId(vibeId: string): string {
  return `catalog-${vibeId}`;
}

/**
 * Get a catalog database instance for a user
 * @param userId The user ID
 * @returns The Fireproof database instance
 */
export function getCatalogDatabase(userId: string) {
  return fireproof(getCatalogDbName(userId));
}

/**
 * Standalone function to add screenshot and source code to catalog document
 * This can be used outside of React components (e.g., in publishUtils)
 * @param userId The user ID
 * @param vibeId The vibe/session ID
 * @param screenshotData Screenshot data URL or null
 * @param sourceCode Source code string (optional)
 */
export async function addCatalogScreenshotStandalone(
  userId: string,
  vibeId: string,
  screenshotData: string | null,
  sourceCode?: string
): Promise<void> {
  if (!vibeId) return;

  try {
    const database = getCatalogDatabase(userId);
    const docId = createCatalogDocId(vibeId);

    // Get existing catalog document
    const existingDoc = await database.get(docId).catch(() => null);
    if (!existingDoc) {
      console.warn('No catalog document found for vibe:', vibeId);
      return;
    }

    const updatedFiles: any = { ...existingDoc._files };

    // Add screenshot if provided
    if (screenshotData) {
      const response = await fetch(screenshotData);
      const blob = await response.blob();
      const screenshotFile = new File([blob], 'screenshot.png', {
        type: 'image/png',
        lastModified: Date.now(),
      });
      updatedFiles.screenshot = screenshotFile;
    }

    // Add source code if provided
    if (sourceCode) {
      const sourceFile = new File([sourceCode], 'App.jsx', {
        type: 'text/javascript',
        lastModified: Date.now(),
      });
      updatedFiles.source = sourceFile;
    }

    // Update catalog document with files
    const updatedDoc = {
      ...existingDoc,
      _files: updatedFiles,
      lastUpdated: Date.now(),
    };

    await database.put(updatedDoc);
  } catch (error) {
    console.error('Failed to update catalog with screenshot/source:', error);
  }
}
