import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import type { StorageResult, VibeFile } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";
import { parseBackendConfig } from "../../../vibe/runtime/parse-backend-config.js";

export interface ProcessBackendBindingsOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fullFileSystem: readonly { readonly vibeFileItem: VibeFile; readonly storage: StorageResult }[];
}

export interface ProcessBackendBindingsResult {
  /** Trigger exports persisted for this app (empty ⇒ no backend / nothing registered). */
  readonly handlers: string[];
  /** Validated schedule interval in ms, or `null` when there's no `scheduled` handler. */
  readonly intervalMs: number | null;
  /** Push-time validation errors (e.g. a sub-5s interval). Non-empty ⇒ nothing was persisted. */
  readonly errors: string[];
}

/**
 * Discover `/backend.js` at push time (#2856, slice B2b) and persist a single
 * `backendFunctionBindings` row keyed by `{ownerHandle, appSlug}` — the backend
 * analog of `processAccessBindings`. Uses the pure `parseBackendConfig` (B2a) to
 * detect the trigger exports and validate the schedule.
 *
 * **Validation-first:** if `parseBackendConfig` reports errors (bad/missing
 * interval), this does NOT mutate the binding and returns the errors so the push
 * can be rejected with a clear message (the caller pre-checks the same parse
 * before any storage/DB work, so a real push never reaches here with errors — this
 * is the defensive backstop). A `backend.js` with no recognized trigger export is
 * treated as "no backend": the row is removed.
 */
export async function processBackendBindings(
  vctx: VibesApiSQLCtx,
  opts: ProcessBackendBindingsOpts
): Promise<Result<ProcessBackendBindingsResult>> {
  return exception2Result(async () => {
    const { ownerHandle, appSlug, fullFileSystem } = opts;
    const tBfb = vctx.sql.tables.backendFunctionBindings;

    const del = () => vctx.sql.db.delete(tBfb).where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)));

    const backendEntry = fullFileSystem.find(
      (e) => e.vibeFileItem.filename === "/backend.js" || e.vibeFileItem.filename.endsWith("/backend.js")
    );

    if (backendEntry === undefined) {
      await del();
      return { handlers: [], intervalMs: null, errors: [] };
    }

    const cid = backendEntry.storage.cid;
    if (cid === undefined) {
      console.error(`processBackendBindings: backend.js has no CID for ${ownerHandle}/${appSlug}`);
      return { handlers: [], intervalMs: null, errors: [] };
    }

    const item = backendEntry.vibeFileItem;
    const backendSource: string | undefined =
      item.type === "code-block" || item.type === "str-asset-block" ? (item.content as string) : undefined;

    const parsed = parseBackendConfig(backendSource);

    if (parsed.errors.length > 0) {
      // Don't mutate on invalid config — surface the errors (the push is rejected upstream).
      return { handlers: parsed.handlers, intervalMs: parsed.schedule?.intervalMs ?? null, errors: parsed.errors };
    }

    if (parsed.handlers.length === 0) {
      // A backend.js with no fetch/scheduled/onChange export registers nothing.
      await del();
      return { handlers: [], intervalMs: null, errors: [] };
    }

    const intervalMs = parsed.schedule?.intervalMs ?? null;
    const handlersJson = JSON.stringify(parsed.handlers);
    const now = new Date().toISOString();

    await vctx.sql.db
      .insert(tBfb)
      .values({
        ownerHandle,
        appSlug,
        backendCid: cid,
        backendAssetUri: backendEntry.storage.getURL,
        handlers: handlersJson,
        intervalMs,
        updated: now,
      })
      .onConflictDoUpdate({
        target: [tBfb.ownerHandle, tBfb.appSlug],
        set: { backendCid: cid, backendAssetUri: backendEntry.storage.getURL, handlers: handlersJson, intervalMs, updated: now },
      });

    return { handlers: parsed.handlers, intervalMs, errors: [] };
  });
}
