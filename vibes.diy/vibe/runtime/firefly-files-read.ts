/**
 * Firefly `_files` read decoration.
 *
 * The server returns `_files.<key> = { uploadId, type, size, lastModified, url }`
 * — the URL is pre-built and points at the app-subdomain `/_files/...`
 * handler. This helper just attaches a `meta.file()` shim so existing
 * `await meta.file()` callers (transcoding, hashing, ML feeding) keep
 * working byte-for-byte.
 *
 * The shim throws on non-OK HTTP responses (vs silently wrapping JSON
 * error bodies in a fake File). UI consumers using `<img src={meta.url}>`
 * skip the shim entirely.
 *
 * The fetcher dependency is injected (defaults to global `fetch`) so the
 * shim is testable without monkey-patching globals.
 */

export type Fetcher = (input: string) => Promise<Response>;

export interface PublicFileMeta {
  // uploadId is the doc-side cache key — required on every persisted
  // _files entry. Stage B's uploadFiles helper guarantees presence by
  // walking _files before put-doc; legacy data from before Stage B
  // doesn't exist (Stage B is the only writer of this shape).
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  readonly url: string;
  file?: () => Promise<File>;
}

interface DocWithFiles {
  _files?: Record<string, PublicFileMeta>;
}

const defaultFetcher: Fetcher = (url) => fetch(url);

/**
 * Walk `doc._files` and attach `meta.file()` shim per entry. Returns a new
 * doc; the input is not mutated. If `_files` is absent or empty, returns
 * `doc` unchanged. Idempotent — re-decorating yields equivalent output.
 */
export function decorateFiles<T>(doc: T, fetcher: Fetcher = defaultFetcher): T {
  const candidate = doc as unknown as DocWithFiles;
  const files = candidate?._files;
  if (!files) return doc;
  const keys = Object.keys(files);
  if (keys.length === 0) return doc;

  const next: Record<string, PublicFileMeta> = {};
  for (const key of keys) {
    const meta = files[key];
    if (!meta || typeof meta.url !== "string") {
      next[key] = meta;
      continue;
    }
    next[key] = { ...meta, file: () => fetchAsFile(fetcher, meta.url, key, meta.type, meta.lastModified) };
  }
  return { ...(doc as object), _files: next } as unknown as T;
}

async function fetchAsFile(
  fetcher: Fetcher,
  url: string,
  name: string,
  type: string,
  lastModified: number | undefined
): Promise<File> {
  const r = await fetcher(url);
  if (!r.ok) {
    throw new Error(`fetch _files ${url}: ${r.status} ${r.statusText}`);
  }
  const blob = await r.blob();
  return new File([blob], name, { type, lastModified });
}
