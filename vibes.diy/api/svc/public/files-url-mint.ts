import { BuildURI } from "@adviser/cement";
import type { VibesFPApiParameters } from "@vibes.diy/api-types";

// `_files.<key>` shape on the wire:
//   stored:    { uploadId, type, size, lastModified }
//   returned:  { type, size, lastModified, url }
//
// The server resolves uploadId → assetURI server-side at fetch time so the
// CID never appears in any client-visible URL. Client gets only the public
// shape (no uploadId, no cid, no getURL).

export interface StoredFileMeta {
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
}

export interface PublicFileMeta {
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
  readonly url: string;
}

export interface FilesUrlMintCtx {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  readonly svc: VibesFPApiParameters["vibes"]["svc"];
}

function isStoredFileMeta(v: unknown): v is StoredFileMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.uploadId === "string" && typeof m.type === "string" && typeof m.size === "number";
}

function isPublicFileMeta(v: unknown): v is PublicFileMeta {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.url === "string" && typeof m.type === "string" && typeof m.size === "number";
}

export function buildFileUrl(ctx: FilesUrlMintCtx, key: string): string {
  const { svc, userSlug, appSlug, dbName, docId } = ctx;
  const hostname = `${appSlug}--${userSlug}.${svc.hostnameBase.replace(/^\./, "")}`;
  const buri = BuildURI.from(`http://template`).protocol(svc.protocol).hostname(hostname);
  if (svc.port && svc.port !== "80" && svc.port !== "443") {
    buri.port(svc.port);
  }
  buri.pathname(`/_files/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}/${encodeURIComponent(key)}`);
  return buri.toString();
}

// Walk doc._files, replacing every stored entry { uploadId, ... } with the
// public shape { type, size, lastModified, url }. Idempotent: entries
// already in public shape pass through unchanged. Mutates a copy of the
// _files map only — the input doc is not modified.
export function mintFilesUrls<T extends Record<string, unknown>>(
  doc: T,
  ctx: Omit<FilesUrlMintCtx, "docId"> & { docId: string }
): T {
  const files = doc._files as Record<string, unknown> | undefined;
  if (!files || typeof files !== "object") return doc;
  const keys = Object.keys(files);
  if (keys.length === 0) return doc;

  const next: Record<string, PublicFileMeta> = {};
  for (const key of keys) {
    const meta = files[key];
    if (isStoredFileMeta(meta)) {
      next[key] = {
        type: meta.type,
        size: meta.size,
        lastModified: meta.lastModified,
        url: buildFileUrl(ctx, key),
      };
    } else if (isPublicFileMeta(meta)) {
      // Already in public shape — re-mint URL to keep it fresh against the
      // current host config without disturbing other fields.
      next[key] = { ...meta, url: buildFileUrl(ctx, key) };
    } else {
      // Unknown shape — leave as-is. Other code paths may surface a warning.
      next[key] = meta as PublicFileMeta;
    }
  }
  return { ...doc, _files: next };
}
