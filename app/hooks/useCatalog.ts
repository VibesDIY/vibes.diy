import { useFireproof, fireproof, toCloud } from 'use-fireproof';
import { useCallback, useEffect, useMemo } from 'react';
import type { LocalVibe } from '../utils/vibeUtils';
import type { VibeDocument, ScreenshotDocument } from '../types/chat';
import { getCatalogDbName, createCatalogDocId } from '../utils/catalogUtils';

// Helper function to get vibe document from session database
async function getVibeDocument(vibeId: string): Promise<VibeDocument | null> {
  try {
    const dbName = `vibe-${vibeId}`;
    const sessionDb = fireproof(dbName);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const vibeDoc = (await sessionDb.get('vibe').catch(() => null)) as VibeDocument | null;

    console.log(`🐛 getVibeDocument for ${vibeId}:`, {
      dbName,
      hasVibeDoc: !!vibeDoc,
      vibeDocKeys: vibeDoc ? Object.keys(vibeDoc) : null,
      vibeDocTitle: vibeDoc?.title,
    });

    return vibeDoc;
  } catch (error) {
    console.error(`Failed to get vibe document for ${vibeId}:`, error);
    return null;
  }
}

// Helper function to get latest screenshot from session database
async function getLatestScreenshot(vibeId: string): Promise<ScreenshotDocument | null> {
  try {
    const dbName = `vibe-${vibeId}`;
    const sessionDb = fireproof(dbName);
    const sessionResult = await sessionDb.query('type', {
      key: 'screenshot',
      includeDocs: true,
      descending: true,
      limit: 1,
    });

    console.log(`🐛 getLatestScreenshot for ${vibeId}:`, {
      dbName,
      queryResultsCount: sessionResult.rows.length,
      queryResults: sessionResult.rows.map((row) => ({
        id: row.id,
        key: row.key,
        hasDoc: !!row.doc,
        docType: (row.doc as ScreenshotDocument)?.type,
        docCid: (row.doc as ScreenshotDocument)?.cid,
        hasFiles: !!row.doc?._files,
        filesKeys: row.doc?._files ? Object.keys(row.doc._files) : null,
        hasScreenshotFile: !!row.doc?._files?.screenshot,
      })),
    });

    if (sessionResult.rows.length > 0) {
      const screenshot = sessionResult.rows[0].doc as ScreenshotDocument;
      console.log(`🐛 Screenshot doc structure for ${vibeId}:`, {
        docKeys: Object.keys(screenshot),
        hasFiles: !!screenshot._files,
        hasCid: !!screenshot.cid,
      });

      // Log the full file structure to find where CID is stored
      console.log(`🐛 File structure for ${vibeId}:`, screenshot._files?.screenshot);

      // Extract CID from file metadata
      const fileCid = screenshot._files?.screenshot
        ? (screenshot._files.screenshot as any)?.cid
        : null;
      console.log(`🐛 File CID for ${vibeId}:`, fileCid);

      if (screenshot._files?.screenshot && fileCid) {
        // Add the file CID to the screenshot document for deduplication
        screenshot.cid = fileCid.toString();
        return screenshot;
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to get screenshot for ${vibeId}:`, error);
    return null;
  }
}

// Helper function to create new catalog document
function createCatalogDocument(vibe: LocalVibe, vibeDoc: VibeDocument | null, userId: string): any {
  return {
    _id: createCatalogDocId(vibe.id),
    created: vibeDoc?.created_at || Date.now(),
    userId,
    vibeId: vibe.id,
    title: vibeDoc?.title || 'Untitled',
    url: vibeDoc?.publishedUrl,
  };
}

// Helper function to update existing catalog document
function updateCatalogDocument(catalogDoc: any, vibeDoc: VibeDocument | null): any {
  const docToUpdate = { ...catalogDoc };

  if (vibeDoc) {
    docToUpdate.title = vibeDoc.title || 'Untitled';
    docToUpdate.url = vibeDoc.publishedUrl;
    docToUpdate.created = vibeDoc.created_at || docToUpdate.created || Date.now();
  }

  return docToUpdate;
}

// Helper function to add screenshot to catalog document using Uint8Array storage
async function addScreenshotToCatalogDoc(
  docToUpdate: any,
  sessionScreenshotDoc: ScreenshotDocument
): Promise<void> {
  try {
    // GET: Extract binary data from source database
    const sourceFile = sessionScreenshotDoc._files!.screenshot;
    const fileData = await (sourceFile as any).file();

    console.log('🐛 Extracting screenshot data:', {
      size: fileData.size,
      type: fileData.type,
    });

    // Convert File to Uint8Array for direct storage
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Store as Uint8Array data directly in document (bypasses broken _files system)
    docToUpdate.screenshot = {
      data: uint8Array,
      size: fileData.size,
      type: fileData.type || 'image/png',
    };

    docToUpdate.screenshotCid = sessionScreenshotDoc.cid;
    docToUpdate.lastUpdated = Date.now();

    console.log('🐛 Screenshot stored as Uint8Array:', {
      dataLength: uint8Array.length,
      size: fileData.size,
      type: docToUpdate.screenshot.type,
    });
  } catch (error) {
    console.error('🐛 Screenshot storage failed:', error);
    throw error;
  }
}

// Helper function to create File from stored Uint8Array data
function createFileFromUint8Array(data: Uint8Array | any, size: number, type: string): File {
  // Convert back to Uint8Array if it was serialized as an object
  const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(Object.values(data));

  console.log('🐛 createFileFromUint8Array:', {
    originalDataType: typeof data,
    originalDataConstructor: data.constructor.name,
    isOriginalUint8Array: data instanceof Uint8Array,
    convertedLength: uint8Array.length,
    expectedSize: size,
    lengthMatchesSize: uint8Array.length === size,
    type,
    first10Bytes: Array.from(uint8Array.slice(0, 10)),
  });

  const file = new File([uint8Array], 'screenshot.png', {
    type,
    lastModified: Date.now(),
  });

  console.log('🐛 Created File:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    sizeMatches: file.size === size,
  });

  return file;
}

// Helper function to filter valid catalog documents
function filterValidCatalogDocs(docs: Array<any>): Array<any> {
  return docs.filter((doc) => {
    return doc._id?.startsWith('catalog-') && doc.vibeId && doc.vibeId.length > 10;
  });
}

// Helper function to transform catalog document to LocalVibe format
function transformToLocalVibe(doc: any): LocalVibe {
  // Debug logging for screenshot transformation
  console.log(`🐛 transformToLocalVibe[${doc.vibeId}]:`, {
    hasScreenshotData: !!doc.screenshot?.data,
    screenshotSize: doc.screenshot?.size,
    screenshotType: doc.screenshot?.type,
    docKeys: Object.keys(doc),
  });

  // Create screenshot interface from Uint8Array data
  let screenshot: { file: () => Promise<File>; type: string } | undefined;

  if (doc.screenshot?.data && doc.screenshot?.size && doc.screenshot?.type) {
    screenshot = {
      file: () =>
        Promise.resolve(
          createFileFromUint8Array(doc.screenshot.data, doc.screenshot.size, doc.screenshot.type)
        ),
      type: doc.screenshot.type,
    };
  }

  return {
    id: doc.vibeId,
    title: doc.title,
    encodedTitle: doc.title?.toLowerCase().replace(/\s+/g, '-') || '',
    slug: doc.vibeId,
    created: new Date(doc.created).toISOString(),
    favorite: false,
    publishedUrl: doc.url,
    screenshot,
  };
}

export function useCatalog(
  userId: string | undefined,
  vibes: Array<LocalVibe>,
  sync: boolean = false
) {
  userId = userId || 'local';

  const dbName = getCatalogDbName(userId);

  const { database, useAllDocs } = useFireproof(
    dbName,
    sync && userId && userId !== 'local' ? { attach: toCloud() } : {}
  );

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

      console.log(`📋 Catalog - ${vibes.length} vibes from useVibes/idb`);

      // Get all already cataloged vibe IDs using fireproof 0.23.0 API
      const allDocsResult = await database.allDocs({ includeDocs: true });
      if (cancelled) return;

      console.log(`📋 Catalog - ${allDocsResult.rows.length} already in "${database.name}"`);

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
          const catalogDocId = createCatalogDocId(vibe.id);
          const catalogDoc = await database.get(catalogDocId).catch(() => null);
          const isNewCatalogEntry = !catalogedVibeIds.has(vibe.id);

          // Get vibe document and latest screenshot using helper functions
          const vibeDoc = await getVibeDocument(vibe.id);

          // Skip vibes without valid vibe documents
          if (!vibeDoc) {
            continue;
          }

          const sessionScreenshotDoc = await getLatestScreenshot(vibe.id);

          console.log(`🐛 Screenshot check for ${vibe.id}:`, {
            hasVibeDoc: !!vibeDoc,
            hasSessionScreenshot: !!sessionScreenshotDoc,
            sessionScreenshotCid: sessionScreenshotDoc?.cid,
            sessionScreenshotFiles: sessionScreenshotDoc?._files
              ? Object.keys(sessionScreenshotDoc._files)
              : null,
            catalogCurrentCid: (catalogDoc as any)?.screenshotCid,
          });

          // Check if screenshot needs updating
          let needsScreenshotUpdate = false;
          if (sessionScreenshotDoc) {
            const catalogCurrentCid = (catalogDoc as any)?.screenshotCid;
            needsScreenshotUpdate = catalogCurrentCid !== sessionScreenshotDoc.cid;
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
            docToUpdate = createCatalogDocument(vibe, vibeDoc, userId);
          } else {
            docToUpdate = updateCatalogDocument(catalogDoc, vibeDoc);
          }

          // Add screenshot if needed
          if (needsScreenshotUpdate && sessionScreenshotDoc) {
            console.log(`🐛 Before addScreenshotToCatalogDoc for ${vibe.id}:`, {
              sessionScreenshotCid: sessionScreenshotDoc.cid,
              hasSessionFiles: !!sessionScreenshotDoc._files,
              sessionScreenshotKeys: sessionScreenshotDoc._files
                ? Object.keys(sessionScreenshotDoc._files)
                : [],
            });
            await addScreenshotToCatalogDoc(docToUpdate, sessionScreenshotDoc);
            console.log(`🐛 After addScreenshotToCatalogDoc for ${vibe.id}:`, {
              docHasFiles: !!docToUpdate._files,
              docFilesKeys: docToUpdate._files ? Object.keys(docToUpdate._files) : [],
              docScreenshotCid: docToUpdate.screenshotCid,
            });
            console.log(
              `📸 Preparing catalog screenshot update for vibe ${vibe.id} (CID: ${sessionScreenshotDoc.cid})`
            );
          }

          docsToBulkUpdate.push(docToUpdate);
        } catch (error) {
          console.error(`Failed to prepare update for vibe ${vibe.id}:`, error);
        }
      }

      // Do one big bulk operation
      if (docsToBulkUpdate.length > 0 && !cancelled) {
        await database.bulk(docsToBulkUpdate);
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
    },
    [database]
  );

  // Get catalog documents for display
  const { docs: catalogDocs } = useAllDocs() as {
    docs: Array<any>;
  };

  // Transform catalog documents to LocalVibe format for compatibility
  const catalogVibes = useMemo(() => {
    return filterValidCatalogDocs(catalogDocs)
      .map(transformToLocalVibe)
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }, [catalogDocs]);

  return { count, addCatalogScreenshot, catalogVibes };
}
