import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import {
  ActiveBackend,
  ActiveEntry,
  isActiveBackend,
  parseArrayWarning,
  type StorageResult,
  type VibeFile,
} from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";
// Package subpath import — a real `@vibes.diy/vibe-runtime` dependency, not a
// `../../../vibe/runtime` relative reach into another package's source (matches
// `vibe-ssr-attempt.ts`; per Codex review).
import { parseBackendConfig } from "@vibes.diy/vibe-runtime/parse-backend-config.js";

export interface ProcessBackendBindingsOpts {
  readonly userId: string;
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
 * `active.backend` entry in AppSettings keyed by `{userId, ownerHandle, appSlug}`
 * — the backend analog of `processAccessBindings`. Uses the pure
 * `parseBackendConfig` (B2a) to detect the trigger exports and validate the
 * schedule.
 *
 * This lives in AppSettings (not a dedicated table) because the backend source
 * is already in `Apps.fileSystem` and nothing reads it on a per-write hot path
 * (unlike `accessFunctionBindings`, read on every `putDoc`). The entry just
 * caches the parse result + storage pointers so the runtime DO (B3) can route
 * without re-parsing.
 *
 * **Validation-first:** if `parseBackendConfig` reports errors (bad/missing
 * interval), this does NOT mutate settings and returns the errors so the push
 * can be rejected with a clear message (the caller pre-checks the same parse
 * before any storage/DB work, so a real push never reaches here with errors —
 * this is the defensive backstop). A `backend.js` with no recognized trigger
 * export is treated as "no backend": the entry is removed.
 */
export async function processBackendBindings(
  vctx: VibesApiSQLCtx,
  opts: ProcessBackendBindingsOpts
): Promise<Result<ProcessBackendBindingsResult>> {
  return exception2Result(async () => {
    const { ownerHandle, appSlug, fullFileSystem } = opts;

    // Only the reserved top-level /backend.js is the app's server backend — a
    // nested helper like /src/backend.js is NOT (per Codex review).
    const backendEntry = fullFileSystem.find((e) => e.vibeFileItem.filename === "/backend.js");

    if (backendEntry === undefined) {
      await removeBackendEntry(vctx, opts);
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
      await removeBackendEntry(vctx, opts);
      return { handlers: [], intervalMs: null, errors: [] };
    }

    const intervalMs = parsed.schedule?.intervalMs ?? null;
    const entry: ActiveBackend = {
      type: "active.backend",
      handlers: parsed.handlers,
      cid,
      assetUri: backendEntry.storage.getURL,
      ...(intervalMs === null ? {} : { intervalMs }),
    };

    await writeBackendEntry(vctx, opts, entry);

    return { handlers: parsed.handlers, intervalMs, errors: [] };
  });
}

/** Load the existing AppSettings row (or undefined) for this app. */
async function loadSettingsRow(vctx: VibesApiSQLCtx, opts: ProcessBackendBindingsOpts) {
  const t = vctx.sql.tables.appSettings;
  return vctx.sql.db
    .select()
    .from(t)
    .where(and(eq(t.userId, opts.userId), eq(t.ownerHandle, opts.ownerHandle), eq(t.appSlug, opts.appSlug)))
    .limit(1)
    .then((r) => r[0]);
}

/** Remove any `active.backend` entry, leaving every other setting untouched. */
async function removeBackendEntry(vctx: VibesApiSQLCtx, opts: ProcessBackendBindingsOpts): Promise<void> {
  const existing = await loadSettingsRow(vctx, opts);
  if (existing === undefined) return;
  const { filtered } = parseArrayWarning(existing.settings ?? [], ActiveEntry);
  if (!filtered.some(isActiveBackend)) return;
  const next = filtered.filter((e) => !isActiveBackend(e));
  const t = vctx.sql.tables.appSettings;
  await vctx.sql.db
    .update(t)
    .set({ settings: next, updated: new Date().toISOString() })
    .where(and(eq(t.userId, opts.userId), eq(t.ownerHandle, opts.ownerHandle), eq(t.appSlug, opts.appSlug)));
}

/** Upsert the single `active.backend` entry, preserving every other setting. */
async function writeBackendEntry(vctx: VibesApiSQLCtx, opts: ProcessBackendBindingsOpts, entry: ActiveBackend): Promise<void> {
  const t = vctx.sql.tables.appSettings;
  const now = new Date().toISOString();
  const existing = await loadSettingsRow(vctx, opts);

  if (existing === undefined) {
    await vctx.sql.db.insert(t).values({
      userId: opts.userId,
      ownerHandle: opts.ownerHandle,
      appSlug: opts.appSlug,
      settings: [entry],
      updated: now,
      created: now,
    });
    return;
  }

  const { filtered } = parseArrayWarning(existing.settings ?? [], ActiveEntry);
  const next: ActiveEntry[] = [...filtered.filter((e) => !isActiveBackend(e)), entry];
  await vctx.sql.db
    .update(t)
    .set({ settings: next, updated: now })
    .where(and(eq(t.userId, opts.userId), eq(t.ownerHandle, opts.ownerHandle), eq(t.appSlug, opts.appSlug)));
}
