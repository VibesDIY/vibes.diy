import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import type { StorageResult, VibeFile } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";

export interface BackendExports {
  hasOnChange: boolean;
  hasFetch: boolean;
  hasScheduled: boolean;
  scheduledInterval: string | null;
}

export function extractBackendExports(source: string): BackendExports {
  const hasOnChange = /export\s+(async\s+)?function\s+onChange\s*\(/.test(source);
  const hasFetch = /export\s+(async\s+)?function\s+fetch\s*\(/.test(source);
  const hasScheduled = /export\s+(async\s+)?function\s+scheduled\s*\(/.test(source);

  let scheduledInterval: string | null = null;
  if (hasScheduled) {
    const configMatch = source.match(/export\s+const\s+config\s*=\s*\{[^}]*scheduled\s*:\s*\{[^}]*interval\s*:\s*["']([^"']+)["']/);
    if (configMatch) {
      scheduledInterval = configMatch[1];
    }
  }

  return { hasOnChange, hasFetch, hasScheduled, scheduledInterval };
}

export interface ProcessBackendBindingsOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fullFileSystem: readonly { readonly vibeFileItem: VibeFile; readonly storage: StorageResult }[];
}

export async function processBackendBindings(vctx: VibesApiSQLCtx, opts: ProcessBackendBindingsOpts): Promise<Result<void>> {
  return exception2Result(async () => {
    const { ownerHandle, appSlug, fullFileSystem } = opts;
    const tBfb = vctx.sql.tables.backendFunctionBindings;

    const backendJsEntry = fullFileSystem.find((e) => e.vibeFileItem.filename === "/backend.js");

    if (backendJsEntry === undefined) {
      await vctx.sql.db.delete(tBfb).where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)));
      return;
    }

    const cid = backendJsEntry.storage.cid;
    if (cid === undefined) {
      console.error(`processBackendBindings: backend.js has no CID for ${ownerHandle}/${appSlug}`);
      return;
    }

    const item = backendJsEntry.vibeFileItem;
    let backendJsSource: string | undefined =
      item.type === "code-block" || item.type === "str-asset-block" ? (item.content as string) : undefined;

    if (backendJsSource === undefined && backendJsEntry.storage.getURL !== undefined) {
      const rFetch = await vctx.storage.fetch(backendJsEntry.storage.getURL);
      if (rFetch.type === "fetch.ok") {
        const reader = rFetch.data.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value !== undefined) chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        backendJsSource = new TextDecoder().decode(merged);
      }
    }

    if (backendJsSource === undefined) {
      console.error(`processBackendBindings: could not read backend.js source for ${ownerHandle}/${appSlug}`);
      return;
    }

    const exports = extractBackendExports(backendJsSource);
    const hasAnyExport = exports.hasOnChange || exports.hasFetch || exports.hasScheduled;

    if (!hasAnyExport) {
      await vctx.sql.db.delete(tBfb).where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)));
      return;
    }

    await vctx.sql.db
      .insert(tBfb)
      .values({
        ownerHandle,
        appSlug,
        backendCid: cid,
        backendAssetUri: backendJsEntry.storage.getURL,
        hasOnChange: exports.hasOnChange,
        hasFetch: exports.hasFetch,
        hasScheduled: exports.hasScheduled,
        scheduledInterval: exports.scheduledInterval,
        updated: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [tBfb.ownerHandle, tBfb.appSlug],
        set: {
          backendCid: cid,
          backendAssetUri: backendJsEntry.storage.getURL,
          hasOnChange: exports.hasOnChange,
          hasFetch: exports.hasFetch,
          hasScheduled: exports.hasScheduled,
          scheduledInterval: exports.scheduledInterval,
          updated: new Date().toISOString(),
        },
      });
  });
}
