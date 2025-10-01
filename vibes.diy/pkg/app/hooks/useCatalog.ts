import {
  useFireproof,
  fireproof,
  toCloud,
  type DocWithId,
} from "use-fireproof";
import { useCallback, useEffect, useMemo } from "react";
import type { LocalVibe } from "../utils/vibeUtils.js";
import type { VibeDocument, ScreenshotDocument } from "@vibes.diy/prompts";
import {
  CatalogDocument,
  CatalogDoc,
  transformCatalogDocToLocalVibe,
  filterValidCatalogDocs,
  createCatalogDocId,
  getCatalogDbName,
} from "../types/catalog.js";

// Helper function to get vibe document from session database
async function getVibeDocument(
  vibeId: string,
): Promise<DocWithId<VibeDocument> | null> {
  try {
    const dbName = `vibe-${vibeId}`;
    const sessionDb = fireproof(dbName);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const vibeDoc = (await sessionDb
      .get("vibe")
      .catch(() => null)) as DocWithId<VibeDocument> | null;

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
async function getLatestScreenshot(
  vibeId: string,
): Promise<DocWithId<ScreenshotDocument> | null> {
  try {
    const dbName = `vibe-${vibeId}`;
    const sessionDb = fireproof(dbName);
    const sessionResult = await sessionDb.query<ScreenshotDocument>("type", {
      key: "screenshot",
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
        docType: row.doc?.type,
        docCid: row.doc?.cid,
        hasFiles: !!row.doc?._files,
        filesKeys: row.doc?._files ? Object.keys(row.doc._files) : null,
        hasScreenshotFile: !!row.doc?._files?.screenshot,
      })),
    });

    if (sessionResult.rows.length > 0) {
      const screenshot = sessionResult.rows[0].doc;
      if (screenshot) {
        console.log(`🐛 Screenshot doc structure for ${vibeId}:`, {
          docKeys: Object.keys(screenshot),
          hasFiles: !!screenshot._files,
          hasCid: !!screenshot.cid,
        });

        // Log the full file structure to find where CID is stored
        console.log(
          `🐛 File structure for ${vibeId}:`,
          screenshot._files?.screenshot,
        );

        // Extract CID from file metadata
        const fileCid = screenshot._files?.screenshot?.cid;
        console.log(`🐛 File CID for ${vibeId}:`, fileCid);

        if (screenshot._files?.screenshot && fileCid) {
          // Add the file CID to the screenshot document for deduplication
          screenshot.cid = fileCid.toString();
          return screenshot;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to get screenshot for ${vibeId}:`, error);
    return null;
  }
}

// Helper function to create new catalog document
function createCatalogDocument(
  vibe: LocalVibe,
  vibeDoc: DocWithId<VibeDocument> | null,
  userId: string,
): CatalogDoc {
  return {
    _id: createCatalogDocId(vibe.id),
    type: "catalog",
    created: vibeDoc?.created_at || Date.now(),
    userId,
    vibeId: vibe.id,
    title: vibeDoc?.title || "Untitled",
    url: vibeDoc?.publishedUrl,
  };
}

// Helper function to update existing catalog document
function updateCatalogDocument(
  catalogDoc: CatalogDoc,
  vibeDoc: DocWithId<VibeDocument> | null,
): CatalogDoc {
  const docToUpdate: CatalogDoc = { ...catalogDoc };

  if (vibeDoc) {
    docToUpdate.title = vibeDoc.title || "Untitled";
    docToUpdate.url = vibeDoc.publishedUrl;
    docToUpdate.created =
      vibeDoc.created_at || docToUpdate.created || Date.now();
  }

  return docToUpdate;
}

// Helper function to add screenshot to catalog document using _files
async function addScreenshotToCatalogDoc(
  docToUpdate: CatalogDoc,
  sessionScreenshotDoc: DocWithId<ScreenshotDocument>,
): Promise<void> {
  try {
    if (!sessionScreenshotDoc._files?.screenshot) {
      console.warn("No screenshot file found in session document");
      return;
    }

    // Copy the DocFileMeta from session to catalog
    docToUpdate._files = {
      ...docToUpdate._files,
      screenshot: sessionScreenshotDoc._files.screenshot,
    };

    docToUpdate.screenshotCid = sessionScreenshotDoc.cid;
    docToUpdate.lastUpdated = Date.now();

    console.log("🐛 Screenshot attached to catalog document:", {
      cid: sessionScreenshotDoc.cid,
      type: sessionScreenshotDoc._files.screenshot.type,
      size: sessionScreenshotDoc._files.screenshot.size,
    });
  } catch (error) {
    console.error("🐛 Screenshot attachment failed:", error);
    throw error;
  }
}

// Helper functions for filtering and transforming are now in catalog.ts

export function useCatalog(
  userId: string | undefined,
  vibes: LocalVibe[],
  sync = false,
) {
  userId = userId || "local";

  const dbName = getCatalogDbName(userId);

  const { database, useAllDocs } = useFireproof(
    dbName,
    sync && userId && userId !== "local" ? { attach: toCloud() } : {},
  );

  // Get real-time count of cataloged vibes
  const allDocsResult = useAllDocs<CatalogDocument>();
  const count = allDocsResult?.docs?.length || 0;

  // Create a stable key based on vibe IDs to prevent unnecessary re-cataloging
  const vibeKey = useMemo(() => {
    return vibes
      .map((v) => v.id)
      .sort()
      .join(",");
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
      const allDocsResult = await database.allDocs();
      if (cancelled) return;

      console.log(
        `📋 Catalog - ${allDocsResult.rows.length} already in "${database.name}"`,
      );

      const catalogedVibeIds = new Set(
        allDocsResult.rows
          .map((row) => row.key)
          .filter((key) => key.startsWith("catalog-"))
          .map((key) => key.replace("catalog-", "")),
      );

      // Pre-compute which vibes need screenshot updates by checking CIDs
      const vibesNeedingUpdates = [];

      // Check all vibes for both new catalog entries and screenshot updates
      for (const vibe of vibes) {
        if (cancelled) break;

        try {
          const catalogDocId = createCatalogDocId(vibe.id);
          const catalogDoc = await database
            .get<CatalogDocument>(catalogDocId)
            .catch(() => null);
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
            catalogCurrentCid: catalogDoc?.screenshotCid,
          });

          // Check if screenshot needs updating
          let needsScreenshotUpdate = false;
          if (sessionScreenshotDoc) {
            const catalogCurrentCid = catalogDoc?.screenshotCid;
            needsScreenshotUpdate =
              catalogCurrentCid !== sessionScreenshotDoc.cid;
          }

          // Force update all entries to populate missing titles
          const needsTitleUpdate =
            !catalogDoc?.title || catalogDoc?.title === undefined;
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
          let docToUpdate: CatalogDoc;

          if (isNewCatalogEntry) {
            docToUpdate = createCatalogDocument(vibe, vibeDoc, userId);
          } else if (catalogDoc) {
            docToUpdate = updateCatalogDocument(catalogDoc, vibeDoc);
          } else {
            continue; // Skip if no catalog doc exists
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
              docFilesKeys: docToUpdate._files
                ? Object.keys(docToUpdate._files)
                : [],
              docScreenshotCid: docToUpdate.screenshotCid,
            });
            console.log(
              `📸 Preparing catalog screenshot update for vibe ${vibe.id} (CID: ${sessionScreenshotDoc.cid})`,
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
        const screenshotUpdates = docsToBulkUpdate.filter(
          (doc) => doc.screenshotCid,
        ).length;
        console.log(
          `📋 Bulk updated ${docsToBulkUpdate.length} catalog documents (${screenshotUpdates} with screenshots)`,
        );
      }

      // Get final count after processing
      if (cancelled) return;
      const finalDocsResult = await database.allDocs();
      console.log(
        `📋 Finished catalog - ${finalDocsResult.rows.length} total cataloged in allDocs (updated ${docsToBulkUpdate.length})`,
      );
    };

    catalog().catch((error) => {
      console.error("❌ Catalog failed:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, vibeKey, database]); // Use vibeKey instead of vibes array

  // Add screenshot and source to catalog document
  const addCatalogScreenshot = useCallback(
    async (
      vibeId: string,
      screenshotData: string | null,
      sourceCode?: string,
    ) => {
      if (!vibeId) return;

      try {
        const docId = createCatalogDocId(vibeId);

        // Get existing catalog document
        const existingDoc = await database
          .get<CatalogDocument>(docId)
          .catch(() => null);
        if (!existingDoc) {
          console.warn("No catalog document found for vibe:", vibeId);
          return;
        }

        const updatedFiles: Record<string, File> = {};

        // Add screenshot if provided
        if (screenshotData) {
          const response = await fetch(screenshotData);
          const blob = await response.blob();
          const screenshotFile = new File([blob], "screenshot.png", {
            type: "image/png",
            lastModified: Date.now(),
          });
          updatedFiles.screenshot = screenshotFile;
        }

        // Add source code if provided
        if (sourceCode) {
          const sourceFile = new File([sourceCode], "App.jsx", {
            type: "text/javascript",
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
        console.error(
          "Failed to update catalog with screenshot/source:",
          error,
        );
      }
    },
    [database],
  );

  // Get catalog documents for display
  const { docs: catalogDocs } = useAllDocs<CatalogDocument>();

  // Transform catalog documents to LocalVibe format for compatibility
  const catalogVibes = useMemo(() => {
    return filterValidCatalogDocs(catalogDocs)
      .map(transformCatalogDocToLocalVibe)
      .sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      );
  }, [catalogDocs]);

  return { count, addCatalogScreenshot, catalogVibes };
}
