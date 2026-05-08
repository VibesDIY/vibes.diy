/**
 * Firefly `_files` write helper.
 *
 * The piece that fixes the "Request timed out" failure mode: when Firefly's
 * `database.put({ _files: { photo: <File> } })` is called, this walks
 * `doc._files` and replaces every File/Blob entry with the JSON-serializable
 * `{ uploadId, type, size, lastModified }` shape *before* the put crosses
 * postMessage to the host. Pre-Stage-B, File entries got JSON.stringified
 * to `{}` (or worse, choked the cement WS encoder), the put failed.
 *
 * The uploader (typically VibeSandboxApi from
 * vibes.diy/vibe/runtime/register-dependencies.ts) is injected — pure
 * function, testable without postMessage / fetch. Bounded concurrency
 * (default 3) so a doc with 50 photos doesn't pin browser memory or
 * worker CPU.
 */

import { Result } from "@adviser/cement";

export interface UploadResultOk {
  readonly status: "ok";
  readonly cid: string;
  readonly getURL: string;
  readonly size: number;
  readonly uploadId: string;
}

export interface UploadResultErr {
  readonly status: "error";
  readonly message: string;
}

export type UploadResult = UploadResultOk | UploadResultErr;

export interface AssetUploader {
  putAsset(blob: Blob, mimeType?: string): Promise<Result<UploadResult>>;
}

export interface UploadFilesOpts {
  // Max concurrent put-asset RPCs in flight. Default 3 — pipelines the
  // common "few photos in one doc" case without letting 50× concurrent
  // 50 MiB uploads pin browser memory.
  readonly concurrency?: number;
}

interface FileMetaOut {
  readonly uploadId: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified?: number;
}

const DEFAULT_CONCURRENCY = 3;

/**
 * Walk `doc._files`, replacing every File/Blob entry with the
 * `{ uploadId, type, size, lastModified }` shape after a putAsset round-trip.
 * Entries already in that shape pass through (idempotent — safe to call on
 * a doc that's been read back from the server). Other shapes (legacy data
 * fields, malformed entries) pass through unchanged.
 *
 * Throws on uploader error — callers (firefly-database.put) should let
 * the exception propagate so the put as a whole fails rather than
 * silently dropping a file.
 */
export async function uploadFiles<T>(doc: T, uploader: AssetUploader, opts: UploadFilesOpts = {}): Promise<T> {
  const files = (doc as { _files?: Record<string, unknown> } | undefined)?._files;
  if (!files || typeof files !== "object") return doc;

  const keys = Object.keys(files);
  if (keys.length === 0) return doc;

  // Identify which entries actually need uploading. Order-preserving so the
  // resulting `_files` map keys come out in input order.
  interface Pending {
    readonly key: string;
    readonly entry: File | Blob;
  }
  const pending: Pending[] = [];
  const passthrough: Record<string, unknown> = {};
  for (const key of keys) {
    const entry = files[key];
    if (entry instanceof File || entry instanceof Blob) {
      pending.push({ key, entry });
    } else {
      passthrough[key] = entry;
    }
  }
  if (pending.length === 0) return doc;

  const limit = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const results = new Map<string, FileMetaOut>();

  // Bounded-concurrency runner: keeps `limit` promises in flight, starts
  // the next pending item as each completes. Hand-rolled, no new dep.
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= pending.length) return;
      const { key, entry } = pending[idx];
      const r = await uploader.putAsset(entry, entry.type || undefined);
      if (r.isErr()) {
        throw new Error(`uploadFiles[${key}]: ${r.Err().message ?? String(r.Err())}`);
      }
      const ok = r.Ok();
      if (ok.status !== "ok") {
        throw new Error(`uploadFiles[${key}]: ${ok.message}`);
      }
      const meta: FileMetaOut = {
        uploadId: ok.uploadId,
        type: entry.type || "application/octet-stream",
        size: entry.size,
        ...(entry instanceof File ? { lastModified: entry.lastModified } : {}),
      };
      results.set(key, meta);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, () => worker()));

  // Reassemble in original key order.
  const next: Record<string, unknown> = {};
  for (const key of keys) {
    next[key] = results.has(key) ? results.get(key) : passthrough[key];
  }
  return { ...(doc as object), _files: next } as T;
}
