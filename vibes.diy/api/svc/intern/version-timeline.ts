import { eq, asc } from "drizzle-orm";
import { parseArray, fileSystemItem, isFetchErrResult, isFetchNotFoundResult } from "@vibes.diy/api-types";
import { Result, exception2Result, stream2uint8array } from "@adviser/cement";
import type { FileSystemItem } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";

export interface TimelineEntry {
  readonly fsId: string;
  readonly created: Date;
  /** Map from normalised filename (leading slash, e.g. "/App.jsx") to file content. */
  readonly vfs: ReadonlyMap<string, string>;
}

// Source-code file extensions we want to include in the vfs.
// Binary assets (images, fonts, etc.) are skipped.
const SOURCE_EXT = new Set([".jsx", ".tsx", ".js", ".ts", ".css", ".html", ".md", ".json"]);

function isSourceFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return false;
  return SOURCE_EXT.has(fileName.slice(dot).toLowerCase());
}

/**
 * Resolve a FileSystemItem[] to a vfs map by fetching each item's content
 * from storage.  Only source-code files are included (binary assets are
 * skipped).  Keys are normalised to "/{fileName}" (leading slash added if
 * absent) for consistency with the convention used by renderCurrentFiles.
 *
 * Exported so future callers (e.g. a fixed loadPriorFileSystem) can reuse it.
 */
export async function resolveVfsFromFileSystem(
  vctx: VibesApiSQLCtx,
  items: FileSystemItem[]
): Promise<ReadonlyMap<string, string>> {
  const vfs = new Map<string, string>();
  for (const item of items) {
    if (!isSourceFile(item.fileName)) continue;
    const rFetch = await vctx.storage.fetch(item.assetURI);
    if (isFetchErrResult(rFetch) || isFetchNotFoundResult(rFetch)) continue;
    const bytes = await stream2uint8array(rFetch.data);
    const text = vctx.sthis.txt.decode(bytes);
    // Normalise: ensure a leading slash, consistent with "/App.jsx" convention.
    const key = item.fileName.startsWith("/") ? item.fileName : `/${item.fileName}`;
    vfs.set(key, text);
  }
  return vfs;
}

/**
 * Returns distinct (fsId-deduped) versions for a chat, oldest first.
 *
 * Turns that produced no file change share an fsId with the prior turn and
 * collapse into one entry, matching the spec's "timeline dedup by fsId" rule.
 *
 * vfs keys are normalised to "/{fileName}" (e.g. "/App.jsx").  Content is
 * resolved from asset storage — Apps.fileSystem stores FileSystemItem
 * references (fileName + assetURI), not raw content.
 */
export async function loadVersionTimeline(vctx: VibesApiSQLCtx, chatId: string): Promise<Result<TimelineEntry[]>> {
  return exception2Result(async () => {
    const rows = await vctx.sql.db
      .select({
        fsId: vctx.sql.tables.promptContexts.fsId,
        created: vctx.sql.tables.promptContexts.created,
        fileSystem: vctx.sql.tables.apps.fileSystem,
      })
      .from(vctx.sql.tables.promptContexts)
      .innerJoin(vctx.sql.tables.apps, eq(vctx.sql.tables.apps.fsId, vctx.sql.tables.promptContexts.fsId))
      .where(eq(vctx.sql.tables.promptContexts.chatId, chatId))
      .orderBy(asc(vctx.sql.tables.promptContexts.created));

    const seen = new Set<string>();
    const out: TimelineEntry[] = [];

    for (const r of rows) {
      if (!r.fsId || seen.has(r.fsId)) continue;
      seen.add(r.fsId);

      const items = parseArray(r.fileSystem, fileSystemItem);
      const vfs = await resolveVfsFromFileSystem(vctx, items);

      // created is stored as an ISO text string in SQLite; Drizzle returns string.
      const created = new Date(r.created);
      out.push({ fsId: r.fsId, created, vfs });
    }

    return out;
  });
}
