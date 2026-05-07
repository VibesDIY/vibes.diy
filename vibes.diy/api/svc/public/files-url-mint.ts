import { BuildURI } from "@adviser/cement";
import type { VibesFPApiParameters } from "@vibes.diy/api-types";

// `_files.<key>` shape on the wire:
//   stored:   { uploadId, type, size, lastModified }
//   returned: { uploadId, type, size, lastModified, url }
//
// The server adds `url` on read; uploadId stays on the doc end-to-end so
// read-modify-write cycles preserve it (the put-doc validator checks it
// against AssetUploads, so stripping it would break any "edit other
// fields, save" flow). Only the storage URI / CID stay server-only.
//
// The minted URL carries `?v=<uploadId>` so the CDN/browser cache key
// changes when the doc replaces the file, even though the path
// `/_files/<db>/<doc>/<key>` stays stable. The handler ignores `?v=`
// at read time — it always resolves to the doc's current uploadId.

export interface FileMeta {
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  readonly url?: string;
}

export interface FilesUrlMintCtx {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  readonly svc: VibesFPApiParameters["vibes"]["svc"];
}

function isFileMeta(v: unknown): v is FileMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.uploadId === "string" && typeof m.type === "string" && typeof m.size === "number";
}

export function buildFileUrl(ctx: FilesUrlMintCtx, key: string, uploadId: string): string {
  const { svc, userSlug, appSlug, dbName, docId } = ctx;
  const hostname = `${appSlug}--${userSlug}.${svc.hostnameBase.replace(/^\./, "")}`;
  const buri = BuildURI.from(`http://template`).protocol(svc.protocol).hostname(hostname);
  if (svc.port && svc.port !== "80" && svc.port !== "443") {
    buri.port(svc.port);
  }
  buri.pathname(`/_files/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}/${encodeURIComponent(key)}`);
  buri.setParam("v", uploadId);
  return buri.toString();
}

// Walk doc._files and add `url` to every entry that has an uploadId.
// Returns a new doc; the input is not mutated. Entries without uploadId
// pass through unchanged. Idempotent: re-minting overwrites `url` with
// a fresh value (uploadId may have changed between revisions).
export function mintFilesUrls<T extends Record<string, unknown>>(doc: T, ctx: FilesUrlMintCtx): T {
  const files = doc._files as Record<string, unknown> | undefined;
  if (!files || typeof files !== "object") return doc;
  const keys = Object.keys(files);
  if (keys.length === 0) return doc;

  const next: Record<string, FileMeta | unknown> = {};
  for (const key of keys) {
    const meta = files[key];
    if (isFileMeta(meta)) {
      next[key] = { ...meta, url: buildFileUrl(ctx, key, meta.uploadId) };
    } else {
      next[key] = meta;
    }
  }
  return { ...doc, _files: next };
}
