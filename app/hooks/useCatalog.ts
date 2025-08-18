import {
  useFireproof,
  fireproof,
  // toCloud
} from 'use-fireproof';
import { useCallback, useEffect, useMemo } from 'react';
import type { LocalVibe } from '../utils/vibeUtils';
import type { VibeDocument, ScreenshotDocument } from '../types/chat';

export function useCatalog(userId: string, vibes: Array<LocalVibe>) {
  userId = userId || 'local';

  const dbName = `vibez-catalog-${userId}`;
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
      for (const [index, vibe] of vibes.entries()) {
        if (cancelled) break;

        // Limit debug output to first 3 vibes to avoid spam
        const shouldDebug = index < 3;

        try {
          const catalogDocId = `catalog-${vibe.id}`;
          const catalogDoc = await database.get(catalogDocId).catch(() => null);
          const isNewCatalogEntry = !catalogedVibeIds.has(vibe.id);

          // Get session database and vibe document for complete data
          const sessionDb = fireproof(`vibe-${vibe.id}`);

          // Brief delay to ensure database is ready (similar to what VibeCardData might have)
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Debug: check what documents exist in session database (only for first few)
          let allSessionDocs: { rows: any[] } = { rows: [] };
          if (shouldDebug) {
            allSessionDocs = await sessionDb
              .allDocs({ includeDocs: true })
              .catch(() => ({ rows: [] }));
            console.log(`📊 Session ${vibe.id} has ${allSessionDocs.rows.length} documents`);
          }

          const vibeDoc = (await sessionDb.get('vibe').catch((error) => {
            if (shouldDebug) {
              console.log(`⚠️ No vibe document found for session ${vibe.id}:`, error.message);
            }
            return null;
          })) as VibeDocument | null;

          if (shouldDebug) {
            if (vibeDoc) {
              console.log(
                `✅ Found vibe document for ${vibe.id}:`,
                JSON.stringify({ title: vibeDoc.title, created_at: vibeDoc.created_at })
              );
            } else {
              console.log(
                `❌ No vibe document found for ${vibe.id}, but session has ${allSessionDocs.rows.length} docs`
              );
              if (allSessionDocs.rows.length > 0) {
                console.log(
                  `📄 First few docs in session:`,
                  allSessionDocs.rows.slice(0, 3).map((row: any) => ({ id: row.id, key: row.key }))
                );
              }
            }
          }

          // Get latest screenshot from session
          const sessionResult = await sessionDb.query('type', {
            key: 'screenshot',
            includeDocs: true,
            descending: true,
            limit: 1,
          });

          let sessionScreenshotDoc = null;
          let needsScreenshotUpdate = false;

          if (sessionResult.rows.length > 0) {
            sessionScreenshotDoc = sessionResult.rows[0].doc as ScreenshotDocument;
            if (sessionScreenshotDoc._files?.screenshot && sessionScreenshotDoc.cid) {
              const catalogCurrentCid = (catalogDoc as any)?.screenshotCid;
              needsScreenshotUpdate = catalogCurrentCid !== sessionScreenshotDoc.cid;
            }
          }

          // Force update all entries to populate missing titles
          const needsTitleUpdate =
            !(catalogDoc as any)?.title || (catalogDoc as any)?.title === undefined;
          if (isNewCatalogEntry || needsScreenshotUpdate || needsTitleUpdate) {
            vibesNeedingUpdates.push({
              vibe,
              vibeDoc,
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
        vibeDoc,
        catalogDoc,
        sessionScreenshotDoc,
        isNewCatalogEntry,
        needsScreenshotUpdate,
      } of vibesNeedingUpdates) {
        if (cancelled) break;

        try {
          let docToUpdate: any;

          if (isNewCatalogEntry) {
            // New catalog entry with complete vibe document data
            docToUpdate = {
              _id: `catalog-${vibe.id}`,
              created: vibeDoc?.created_at || Date.now(),
              userId,
              vibeId: vibe.id,
              title: vibeDoc?.title || 'Untitled',
              url: vibeDoc?.publishedUrl,
            };
          } else {
            // Existing entry needing update (screenshot or title)
            docToUpdate = { ...catalogDoc };

            // Update title and metadata if vibe document was found
            if (vibeDoc) {
              docToUpdate.title = vibeDoc.title || 'Untitled';
              docToUpdate.url = vibeDoc.publishedUrl;
              docToUpdate.created = vibeDoc.created_at || docToUpdate.created || Date.now();
              console.log(`🔄 Updating catalog ${vibe.id} with title: ${vibeDoc.title}`);
            } else {
              console.log(`⚠️ No vibeDoc found for catalog update of ${vibe.id}`);
            }
          }

          // Add screenshot if needed
          if (
            needsScreenshotUpdate &&
            sessionScreenshotDoc &&
            sessionScreenshotDoc._files?.screenshot
          ) {
            const screenshotFile =
              typeof (sessionScreenshotDoc._files.screenshot as any).file === 'function'
                ? await (sessionScreenshotDoc._files.screenshot as any).file()
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

        // Debug: check what was actually written to catalog
        if (docsToBulkUpdate.length > 0) {
          const sampleUpdate = docsToBulkUpdate[0];
          console.log(
            '📝 Sample updated document:',
            JSON.stringify(
              {
                _id: sampleUpdate._id,
                title: sampleUpdate.title,
                vibeId: sampleUpdate.vibeId,
              },
              null,
              2
            )
          );
        }
      }

      // Get final count after processing
      if (cancelled) return;
      const finalDocsResult = await database.allDocs({ includeDocs: true });
      console.log(
        `📋 Finished catalog - ${finalDocsResult.rows.length} total cataloged in allDocs (updated ${docsToBulkUpdate.length})`
      );

      // Debug: check what's actually in database after bulk update
      if (finalDocsResult.rows.length > 0) {
        const firstRow = finalDocsResult.rows[0] as any;
        if (firstRow.doc && firstRow.doc._id?.startsWith('catalog-')) {
          const catalogDoc = firstRow.doc;
          console.log(
            '🔍 First catalog doc after update:',
            JSON.stringify(
              {
                _id: catalogDoc._id,
                title: catalogDoc.title,
                vibeId: catalogDoc.vibeId,
              },
              null,
              2
            )
          );
        }
      }
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

  // Get catalog documents for display
  const { docs: catalogDocs } = useAllDocs() as {
    docs: Array<any>;
  };

  // Transform catalog documents to LocalVibe format for compatibility
  const catalogVibes = useMemo(() => {
    // Debug: log a sample catalog document to see what data we have
    if (catalogDocs.length > 0) {
      const sampleDoc = catalogDocs.find((doc) => doc._id?.startsWith('catalog-'));
      if (sampleDoc) {
        console.log(
          '📄 Sample catalog document structure:',
          JSON.stringify(
            {
              _id: sampleDoc._id,
              title: sampleDoc.title,
              vibeId: sampleDoc.vibeId,
              created: sampleDoc.created,
              url: sampleDoc.url,
            },
            null,
            2
          )
        );
      }
    }

    return catalogDocs
      .filter((doc) => {
        // Filter out corrupted catalog docs and ensure we have valid vibe data
        return (
          doc._id?.startsWith('catalog-') &&
          doc.vibeId &&
          !doc.vibeId.startsWith('fatalog-') && // Filter out corrupted entries
          doc.vibeId.length > 10
        ); // Basic vibe ID validation
      })
      .map((doc) => ({
        id: doc.vibeId,
        title: doc.title,
        encodedTitle: doc.title?.toLowerCase().replace(/\s+/g, '-') || '',
        slug: doc.vibeId,
        created: new Date(doc.created).toISOString(),
        favorite: false, // TODO: Add favorite tracking to catalog
        publishedUrl: doc.url,
        screenshot: doc._files?.screenshot
          ? {
              file: () => Promise.resolve(doc._files.screenshot),
              type: 'image/png',
            }
          : undefined,
      }))
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, [catalogDocs]);

  return { count, addCatalogScreenshot, catalogVibes };
}
