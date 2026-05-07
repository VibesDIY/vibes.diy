/**
 * Firefly `_files` read decoration.
 *
 * Pure helper that walks a document's `_files` map and populates each entry
 * with a `url` (server endpoint that streams the underlying CID) and a `file()`
 * shim (lazy `fetch(url)` that returns a `File`). The full design lives in
 * `notes/storage-files-design.md`.
 *
 * Server-returned docs always carry metadata-shape `_files` entries — the
 * write path replaces every `File`/`Blob` with `{ cid, type, size, lastModified }`
 * before persisting — so this helper does NOT need to handle raw `File`/`Blob`
 * instances.
 *
 * The helper is synchronous and never mutates its input. `meta.file()` is the
 * only async path, and it calls `fetch` lazily.
 */

/** Context required to construct file URLs. */
export interface FileCtx {
  readonly baseUrl: string;
  readonly userSlug: string;
  readonly appSlug: string;
  readonly dbName: string;
}

/**
 * Minimal metadata shape for a `_files` entry as it arrives from the server.
 * Mirrors `DocFileMeta` from the design brief.
 */
export interface DocFileMeta {
  readonly cid: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  url?: string;
  file?: () => Promise<File>;
}

interface DocWithFiles {
  _files?: Record<string, DocFileMeta>;
}

/**
 * Decorate `doc._files` entries with `url` + `file()` based on the supplied
 * `FileCtx`. Returns a new doc; the input is not mutated. If `_files` is
 * absent or empty, returns `doc` unchanged.
 *
 * Idempotent: re-decorating an already-decorated doc yields equivalent output.
 */
export function decorateFiles<T>(doc: T, ctx: FileCtx): T {
  const candidate = doc as unknown as DocWithFiles;
  const files = candidate?._files;
  if (!files) return doc;
  const keys = Object.keys(files);
  if (keys.length === 0) return doc;

  const next: Record<string, DocFileMeta> = {};
  for (const key of keys) {
    const meta = files[key];
    if (!meta || typeof meta.cid === "undefined") {
      next[key] = meta;
      continue;
    }
    const url = buildUrl(ctx, meta);
    next[key] = {
      ...meta,
      url,
      file: () => fetchAsFile(url, meta),
    };
  }

  return { ...(doc as object), _files: next } as unknown as T;
}

function buildUrl(ctx: FileCtx, meta: DocFileMeta): string {
  const { baseUrl, userSlug, appSlug, dbName } = ctx;
  const cid = String(meta.cid);
  return `${baseUrl}/files/${userSlug}/${appSlug}/${dbName}/${cid}?mime=${encodeURIComponent(meta.type)}`;
}

async function fetchAsFile(url: string, meta: DocFileMeta): Promise<File> {
  const r = await fetch(url);
  const blob = await r.blob();
  return new File([blob], String(meta.cid), {
    type: meta.type,
    lastModified: meta.lastModified,
  });
}
