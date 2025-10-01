import type { DocWithId, DocFileMeta, DocTypes } from "use-fireproof";
import type { LocalVibe } from "../utils/vibeUtils.js";

/**
 * Catalog document interface - stores metadata and files for cataloged vibes
 */
export interface CatalogDocument extends DocTypes {
  /** Document type discriminator for Fireproof queries */
  type: "catalog";
  /** Unique identifier for the vibe */
  vibeId: string;
  /** Display title of the vibe */
  title: string;
  /** Timestamp when the vibe was created */
  created: number;
  /** User ID who owns this catalog entry */
  userId: string;
  /** Published URL of the vibe (if published) */
  url?: string;
  /** Content identifier for deduplication */
  screenshotCid?: string;
  /** Last update timestamp */
  lastUpdated?: number;
  /** File attachments */
  _files?: {
    screenshot?: DocFileMeta;
    source?: DocFileMeta;
  };
}

/** Complete catalog document with Fireproof's _id */
export type CatalogDoc = DocWithId<CatalogDocument>;

/**
 * Type-safe helper to extract file from DocFileMeta
 */
export async function getDocumentFile(
  fileMeta: DocFileMeta | undefined,
): Promise<File | null> {
  if (!fileMeta?.file || typeof fileMeta.file !== "function") {
    return null;
  }

  try {
    return await fileMeta.file();
  } catch (error) {
    console.error("Failed to load file:", error);
    return null;
  }
}

/**
 * Transform catalog document to LocalVibe format for compatibility with existing UI
 */
export function transformCatalogDocToLocalVibe(doc: CatalogDoc): LocalVibe {
  const screenshot = doc._files?.screenshot
    ? {
        file: () => getDocumentFile(doc._files?.screenshot),
        type: doc._files.screenshot.type,
      }
    : undefined;

  return {
    id: doc.vibeId,
    title: doc.title,
    encodedTitle: doc.title?.toLowerCase().replace(/\s+/g, "-") || "",
    slug: doc.vibeId,
    created: new Date(doc.created).toISOString(),
    favorite: false,
    publishedUrl: doc.url,
    screenshot: screenshot as LocalVibe["screenshot"], // Type compatibility with existing LocalVibe interface
  };
}

/**
 * Filter valid catalog documents from query results
 */
export function filterValidCatalogDocs(docs: CatalogDoc[]): CatalogDoc[] {
  return docs.filter((doc) => {
    return (
      doc._id?.startsWith("catalog-") &&
      doc.vibeId &&
      doc.vibeId.length > 10 &&
      doc.type === "catalog"
    );
  });
}

/**
 * Create catalog document ID from vibe ID
 */
export function createCatalogDocId(vibeId: string): string {
  return `catalog-${vibeId}`;
}

/**
 * Get catalog database name for user
 */
export function getCatalogDbName(userId: string): string {
  return `vibez-catalog-${userId || "local"}`;
}
