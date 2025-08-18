import {
  useFireproof,
  fireproof,
  // toCloud
} from 'use-fireproof';
import { useCallback, useEffect, useMemo } from 'react';
import type { LocalVibe } from '../utils/vibeUtils';

export function useCatalog(userId: string, vibes: Array<LocalVibe>) {
  if (!userId) throw new Error('No user ID provided');

  const dbName = `vibe-fatalog-${userId}`;
  const { database, useAllDocs } = useFireproof(dbName, {
    // attach: toCloud()
  });

  // Get real-time count of cataloged vibes
  const allDocsResult = useAllDocs() as {
    docs: Array<{ _id: string }>;
    rows?: Array<{ id: string }>;
  };
  const count = allDocsResult?.rows?.length || 0;

  // Create a stable key based on vibe IDs to prevent unnecessary re-cataloging
  const vibeKey = useMemo(() => {
    return vibes
      .map((v) => v.id)
      .sort()
      .join(',');
  }, [vibes]);

  useEffect(() => {
    if (!vibes || vibes.length === 0) return;

    let cancelled = false;

    const catalog = async () => {
      // Wait 2000ms to allow database to be fully initialized after page load
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (cancelled) return;

      console.log(`📋 Starting catalog - ${vibes.length} vibes from useVibes`);

      // Get all already cataloged vibe IDs using fireproof 0.23.0 API
      const allDocsResult = await database.allDocs({ includeDocs: true });
      if (cancelled) return;

      console.log(
        `📋 Starting catalog - ${allDocsResult.rows.length} already cataloged in allDocs`
      );

      // Console a random doc from allDocs
      if (allDocsResult.rows.length > 0) {
        const randomDoc = allDocsResult.rows[Math.floor(Math.random() * allDocsResult.rows.length)];
        console.log('Random catalog doc:', randomDoc);
      }

      const catalogedVibeIds = new Set(
        allDocsResult.rows
          .map((row) => row.key)
          .filter((key) => key.startsWith('catalog-'))
          .map((key) => key.replace('catalog-', ''))
      );

      // Pre-compute which vibes need screenshot updates by checking CIDs
      const vibesNeedingUpdates = [];

      // Check all vibes for both new catalog entries and screenshot updates
      for (const vibe of vibes) {
        if (cancelled) break;

        try {
          const catalogDocId = `catalog-${vibe.id}`;
          const catalogDoc = await database.get(catalogDocId).catch(() => null);

          const isNewCatalogEntry = !catalogedVibeIds.has(vibe.id);
          let needsScreenshotUpdate = false;
          let sessionScreenshotDoc = null;

          // Check for screenshot updates if catalog doc exists
          if (catalogDoc) {
            const sessionDb = fireproof(`vibe-${vibe.id}`);
            const sessionResult = await sessionDb.query('type', {
              key: 'screenshot',
              includeDocs: true,
              descending: true,
              limit: 1,
            });

            if (sessionResult.rows.length > 0) {
              sessionScreenshotDoc = sessionResult.rows[0].doc as any;
              if (sessionScreenshotDoc._files?.screenshot && sessionScreenshotDoc.cid) {
                const catalogCurrentCid = (catalogDoc as any).screenshotCid;
                needsScreenshotUpdate = catalogCurrentCid !== sessionScreenshotDoc.cid;
              }
            }
          }

          if (isNewCatalogEntry || needsScreenshotUpdate) {
            vibesNeedingUpdates.push({
              vibe,
              catalogDoc,
              sessionScreenshotDoc,
              isNewCatalogEntry,
              needsScreenshotUpdate,
            });
          }
        } catch (error) {
          console.error(`Failed to check vibe ${vibe.id}:`, error);
        }
      }

      // Console a random vibe from useVibes
      if (vibes.length > 0) {
        const randomVibe = vibes[Math.floor(Math.random() * vibes.length)];
        console.log('Random vibe from useVibes:', randomVibe);
      }

      // Prepare documents for single bulk operation
      const docsToBulkUpdate = [];

      for (const {
        vibe,
        catalogDoc,
        sessionScreenshotDoc,
        isNewCatalogEntry,
        needsScreenshotUpdate,
      } of vibesNeedingUpdates) {
        if (cancelled) break;

        try {
          let docToUpdate: any;

          if (isNewCatalogEntry) {
            // New catalog entry
            docToUpdate = {
              _id: `catalog-${vibe.id}`,
              created: Date.now(),
              userId,
              vibeId: vibe.id,
              title: vibe.title,
              url: vibe.publishedUrl,
            };
          } else {
            // Existing entry needing screenshot update
            docToUpdate = { ...catalogDoc };
          }

          // Add screenshot if needed
          if (needsScreenshotUpdate && sessionScreenshotDoc) {
            const screenshotFile =
              typeof sessionScreenshotDoc._files.screenshot.file === 'function'
                ? await sessionScreenshotDoc._files.screenshot.file()
                : sessionScreenshotDoc._files.screenshot;

            const updatedFiles: any = { ...docToUpdate._files };
            updatedFiles.screenshot = screenshotFile;

            docToUpdate._files = updatedFiles;
            docToUpdate.screenshotCid = sessionScreenshotDoc.cid;
            docToUpdate.lastUpdated = Date.now();

            console.log(
              `📸 Preparing catalog screenshot update for vibe ${vibe.id} (CID: ${sessionScreenshotDoc.cid})`
            );
          }

          docsToBulkUpdate.push(docToUpdate);
        } catch (error) {
          console.error(`Failed to prepare update for vibe ${vibe.id}:`, error);
        }
      }

      // Bulk operations in chunks of 10 documents
      if (docsToBulkUpdate.length > 0 && !cancelled) {
        const chunkSize = 10;
        for (let i = 0; i < docsToBulkUpdate.length; i += chunkSize) {
          if (cancelled) break;
          const chunk = docsToBulkUpdate.slice(i, i + chunkSize);
          await database.bulk(chunk);
        }
        const screenshotUpdates = docsToBulkUpdate.filter((doc) => doc.screenshotCid).length;
        console.log(
          `📋 Bulk updated ${docsToBulkUpdate.length} catalog documents (${screenshotUpdates} with screenshots)`
        );
      }

      // Get final count after processing
      if (cancelled) return;
      const finalDocsResult = await database.allDocs({ includeDocs: true });
      console.log(
        `📋 Finished catalog - ${finalDocsResult.rows.length} total cataloged in allDocs (updated ${docsToBulkUpdate.length})`
      );
    };

    catalog().catch((error) => {
      console.error('❌ Catalog failed:', error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, vibeKey, database]); // Use vibeKey instead of vibes array

  // Add screenshot and source to catalog document
  const addCatalogScreenshot = useCallback(
    async (vibeId: string, screenshotData: string | null, sourceCode?: string) => {
      if (!vibeId) return;

      try {
        const docId = `catalog-${vibeId}`;

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
    },
    [database]
  );

  return { count, addCatalogScreenshot };
}
