/**
 * Utilities for publishing apps to the server
 */

import { fireproof } from 'use-fireproof';
import { APP_HOST_BASE_URL, API_BASE_URL } from '../config/env';
import { getSessionDatabaseName, updateUserVibespaceDoc } from './databaseManager';
import { normalizeComponentExports } from './normalizeComponentExports';

/**
 * Publish an app to the server
 * @param params Parameters for publishing the app
 * @returns The published app URL if successful
 */
export async function publishApp({
  sessionId,
  code,
  title,
  userId,
  prompt,
  updatePublishedUrl,
  updateFirehoseShared,
  token,
  shareToFirehose,
}: {
  sessionId?: string;
  code: string;
  title?: string;
  userId?: string;
  prompt?: string;
  updatePublishedUrl?: (url: string) => Promise<void>;
  updateFirehoseShared?: (shared: boolean) => Promise<void>;
  token?: string | null;
  shareToFirehose?: boolean;
}): Promise<string | undefined> {
  try {
    if (!code || !sessionId) {
      console.error('Code or sessionId missing for publishing');
      return undefined;
    }

    // Get the session database to retrieve screenshot and metadata
    const sessionDb = fireproof(getSessionDatabaseName(sessionId));

    // Try to get the vibe document which might contain remixOf information
    let remixOf = null;
    try {
      const vibeDoc = (await sessionDb.get('vibe')) as any;
      if (vibeDoc && vibeDoc.remixOf) {
        remixOf = vibeDoc.remixOf;
      }
    } catch (error) {
      // No vibe doc or no remixOf property, which is fine
    }

    // Query for the most recent screenshot document
    const result = await sessionDb.query('type', {
      key: 'screenshot',
      includeDocs: true,
      descending: true,
      limit: 1,
    });

    // Prepare screenshot data for inclusion in the payload
    let screenshotBase64 = null;

    // Check if we have a screenshot document
    if (result.rows.length > 0) {
      const screenshotDoc = result.rows[0].doc as any; // Cast to any to handle Fireproof types

      // Check if the screenshot document has a file in _files.screenshot
      if (screenshotDoc._files && screenshotDoc._files.screenshot) {
        try {
          // Get the File object using the file() method - Fireproof specific API
          const screenshotFile = await (screenshotDoc._files.screenshot as any).file();

          // Read the file as a buffer using FileReader
          const buffer = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(screenshotFile); // Read as base64 data URL
          });

          // Extract the base64 part of the data URL
          screenshotBase64 = buffer.split(',')[1];
        } catch (err) {
          console.error('Error processing screenshot file:', err);
        }
      }
    }

    // First, normalize the code to handle different line endings and whitespace
    const normalizedCode = code.replace(/\r\n/g, '\n').trim();

    // Transform imports to use esm.sh
    const transformedCode = normalizeComponentExports(normalizedCode);

    // Prepare headers with optional Authorization
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-VIBES-Token': localStorage.getItem('auth_token') || '',
    };

    // Add Authorization header if token is provided
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/apps`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        chatId: sessionId,
        userId,
        raw: code,
        prompt,
        code: transformedCode,
        title,
        remixOf, // Include information about the original app if this is a remix
        screenshot: screenshotBase64, // Include the base64 screenshot if available
        shareToFirehose, // Include the firehose sharing preference
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.app?.slug) {
      // Construct the app URL from the response data
      const appUrl =
        data.appUrl || `https://${data.app.slug}.${new URL(APP_HOST_BASE_URL).hostname}`;

      // Get the user's vibespace database to check for existing data
      const userVibespaceDb = fireproof(`vu-${userId}`);
      const docId = `app-${data.app.slug}`;

      // Try to get the existing document to preserve metadata like favorite status
      const existingDoc = (await userVibespaceDb.get(docId).catch(() => null)) as any;

      // Use the shared utility function to update the user's vibespace
      if (userId) {
        await updateUserVibespaceDoc(userId, data.app.slug, {
          id: sessionId,
          title: data.app.title || data.app.config?.title || '',
          slug: data.app.slug,
          app: data.app,
          publishedUrl: appUrl,
          // Preserve favorite status if the document already exists
          favorite: existingDoc?.favorite || false,
          // Keep remix information
          remixOf: data.app.remixOf || existingDoc?.remixOf,
        });
      }

      // Update the session with the published URL if callback provided
      if (updatePublishedUrl) {
        await updatePublishedUrl(appUrl);
      }

      // Update the firehose shared state if callback provided
      if (updateFirehoseShared && shareToFirehose !== undefined) {
        await updateFirehoseShared(shareToFirehose);
      }

      // Store screenshot in catalog database for this published vibe
      if (sessionId && userId) {
        try {
          // Get the catalog database directly and call addCatalogScreenshot
          const catalogDb = fireproof(`vibe-catalog-${userId}`);

          // Get the most recent screenshot from session database
          if (result.rows.length > 0) {
            const screenshotDoc = result.rows[0].doc as any;
            if (screenshotDoc._files && screenshotDoc._files.screenshot) {
              try {
                // Get the File and convert to data URL
                const screenshotFile = await screenshotDoc._files.screenshot.file();
                const screenshotDataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(screenshotFile);
                });

                // Use the same logic as useCatalog addCatalogScreenshot function
                const docId = `catalog-${sessionId}`;
                const existingDoc = await catalogDb.get(docId).catch(() => null);

                if (existingDoc) {
                  const updatedFiles: any = { ...existingDoc._files };

                  // Add screenshot
                  const response = await fetch(screenshotDataUrl);
                  const blob = await response.blob();
                  const newScreenshotFile = new File([blob], 'screenshot.png', {
                    type: 'image/png',
                    lastModified: Date.now(),
                  });
                  updatedFiles.screenshot = newScreenshotFile;

                  // Add source code
                  const sourceFile = new File([transformedCode], 'App.jsx', {
                    type: 'text/javascript',
                    lastModified: Date.now(),
                  });
                  updatedFiles.source = sourceFile;

                  // Update catalog document with files
                  const updatedDoc = {
                    ...existingDoc,
                    _files: updatedFiles,
                    lastUpdated: Date.now(),
                  };

                  await catalogDb.put(updatedDoc);
                }
              } catch (err) {
                console.error('Failed to store catalog screenshot:', err);
              }
            }
          }
        } catch (error) {
          console.error('Failed to update catalog:', error);
        }
      }

      return appUrl;
    }

    return undefined;
  } catch (error) {
    console.error('Error publishing app:', error);
    return undefined;
  }
}
