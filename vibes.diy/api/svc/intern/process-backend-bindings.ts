import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import {
  ActiveBackend,
  ActiveEntry,
  isActiveBackend,
  parseArrayWarning,
  type FileSystemItem,
  type StorageResult,
  type VibeFile,
} from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";
// Package subpath import — a real `@vibes.diy/vibe-runtime` dependency, not a
// `../../../vibe/runtime` relative reach into another package's source (matches
// `vibe-ssr-attempt.ts`; per Codex review).
import { parseBackendConfig } from "@vibes.diy/vibe-runtime/parse-backend-config.js";

const BACKEND_FILENAME = "/backend.js";

export interface ProcessBackendBindingsOpts {
  readonly userId: string;
  readonly ownerHandle: string;
  readonly appSlug: string;
  /**
   * Canonical persisted filesystem — the row `ensureApps` actually resolved.
   * This is the source of truth for what's live, which can differ from the
   * request files after a same-`runId` reconcile (a late dev publish that
   * no-ops against a finalized production release). Discovery is driven from
   * here, never from the request-scoped files (per Charlie's review).
   */
  readonly canonicalFileSystem: readonly FileSystemItem[];
  /**
   * Request-scoped stored files. Used only to recover the in-memory backend.js
   * *content* (matched to the canonical entry by storage URI) so we can parse it
   * without an extra fetch. If the canonical backend.js isn't among these, this
   * push reconciled to someone else's snapshot and we leave their entry alone.
   */
  readonly fullFileSystem: readonly { readonly vibeFileItem: VibeFile; readonly storage: StorageResult }[];
}

export interface ProcessBackendBindingsResult {
  /** Trigger exports persisted for this app (empty ⇒ no backend / nothing registered). */
  readonly handlers: string[];
  /** Validated schedule interval in ms, or `null` when there's no `scheduled` handler. */
  readonly intervalMs: number | null;
  /** Push-time validation errors (e.g. a sub-5s interval). Non-empty ⇒ nothing was persisted. */
  readonly errors: string[];
  /**
   * True when this push reconciled to a snapshot whose backend.js content the
   * request didn't carry — the authoritative push owns that entry, so nothing
   * was written.
   */
  readonly skipped: boolean;
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
 * (unlike `accessFunctionBindings`, read on every `putDoc`). The entry caches
 * only discovery *facts* (`handlers`, `intervalMs?`); the runtime DO (B3)
 * derives its route target from the canonical app row, so there is exactly one
 * source of truth for the source.
 *
 * **Canonical-driven:** discovery reads the `/backend.js` in `canonicalFileSystem`
 * (what was persisted), not the request files. After a same-`runId` reconcile
 * the persisted row may be a different snapshot than this request pushed; in
 * that case the authoritative push already wrote the correct entry, so we skip.
 *
 * **Validation-first:** if `parseBackendConfig` reports errors (bad/missing
 * interval), this does NOT mutate settings and returns the errors (the caller
 * pre-checks the same parse before any storage/DB work, so a real push never
 * reaches here with errors — this is the defensive backstop). A `backend.js`
 * with no recognized trigger export removes the entry.
 *
 * **Concurrency:** the read-merge-write goes through `mutateBackendEntry`, which
 * retries on a first-write PK conflict (two concurrent pushes both seeing no
 * row) so backend persistence never silently drops. Concurrent *updates* still
 * last-writer-win on the non-backend entries of the blob — the same
 * non-transactional limitation `ensureAppMetadata` carries; a CAS/version column
 * is the follow-up if that becomes a problem.
 */
export async function processBackendBindings(
  vctx: VibesApiSQLCtx,
  opts: ProcessBackendBindingsOpts
): Promise<Result<ProcessBackendBindingsResult>> {
  return exception2Result(async () => {
    const { canonicalFileSystem, fullFileSystem } = opts;

    // Only the reserved top-level /backend.js is the app's server backend — a
    // nested helper like /src/backend.js is NOT (per Codex review).
    const canonicalBackend = canonicalFileSystem.find((f) => f.fileName === BACKEND_FILENAME);

    if (canonicalBackend === undefined) {
      // Canonical row has no backend → ensure no entry remains.
      await mutateBackendEntry(vctx, opts, (entries) => entries.filter((e) => !isActiveBackend(e)));
      return { handlers: [], intervalMs: null, errors: [], skipped: false };
    }

    // Recover the canonical backend.js content from this request's stored files,
    // matched by storage URI (`toFileSystemItems` sets `assetURI = storage.getURL`,
    // and /backend.js is a plain .js with no jsx transform). If it isn't here,
    // the canonical row came from a different push (reconcile): that push already
    // persisted the right entry, so leave it untouched.
    const pushed = fullFileSystem.find(
      (e) => e.vibeFileItem.filename === BACKEND_FILENAME && e.storage.getURL === canonicalBackend.assetURI
    );
    if (pushed === undefined) {
      return { handlers: [], intervalMs: null, errors: [], skipped: true };
    }

    const item = pushed.vibeFileItem;
    const backendSource: string | undefined =
      item.type === "code-block" || item.type === "str-asset-block" ? (item.content as string) : undefined;

    const parsed = parseBackendConfig(backendSource);

    if (parsed.errors.length > 0) {
      // Don't mutate on invalid config — surface the errors (the push is rejected upstream).
      return {
        handlers: parsed.handlers,
        intervalMs: parsed.schedule?.intervalMs ?? null,
        errors: parsed.errors,
        skipped: false,
      };
    }

    if (parsed.handlers.length === 0) {
      // A backend.js with no fetch/scheduled/onChange export registers nothing.
      await mutateBackendEntry(vctx, opts, (entries) => entries.filter((e) => !isActiveBackend(e)));
      return { handlers: [], intervalMs: null, errors: [], skipped: false };
    }

    const intervalMs = parsed.schedule?.intervalMs ?? null;
    const entry: ActiveBackend = {
      type: "active.backend",
      handlers: parsed.handlers,
      ...(intervalMs === null ? {} : { intervalMs }),
    };

    await mutateBackendEntry(vctx, opts, (entries) => [...entries.filter((e) => !isActiveBackend(e)), entry]);

    return { handlers: parsed.handlers, intervalMs, errors: [], skipped: false };
  });
}

/** Load the existing AppSettings row (or undefined) for this app. */
function loadSettingsRow(vctx: VibesApiSQLCtx, opts: ProcessBackendBindingsOpts) {
  const t = vctx.sql.tables.appSettings;
  return vctx.sql.db
    .select()
    .from(t)
    .where(and(eq(t.userId, opts.userId), eq(t.ownerHandle, opts.ownerHandle), eq(t.appSlug, opts.appSlug)))
    .limit(1)
    .then((r) => r[0]);
}

/**
 * Apply `fn` to the app's settings entries and persist, conflict-safe. When the
 * row is missing we insert; if a concurrent push won that insert (PK conflict)
 * we retry, taking the update path on the next pass so neither writer's backend
 * state is silently dropped.
 */
async function mutateBackendEntry(
  vctx: VibesApiSQLCtx,
  opts: ProcessBackendBindingsOpts,
  fn: (entries: ActiveEntry[]) => ActiveEntry[]
): Promise<void> {
  const t = vctx.sql.tables.appSettings;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const existing = await loadSettingsRow(vctx, opts);
    const now = new Date().toISOString();

    if (existing !== undefined) {
      const { filtered } = parseArrayWarning(existing.settings ?? [], ActiveEntry);
      const next = fn(filtered);
      await vctx.sql.db
        .update(t)
        .set({ settings: next, updated: now })
        .where(and(eq(t.userId, opts.userId), eq(t.ownerHandle, opts.ownerHandle), eq(t.appSlug, opts.appSlug)));
      return;
    }

    // No row yet: compute the initial settings. A pure removal against no row is
    // a no-op — nothing to persist.
    const next = fn([]);
    if (next.length === 0) return;

    const rIns = await exception2Result(() =>
      vctx.sql.db.insert(t).values({
        userId: opts.userId,
        ownerHandle: opts.ownerHandle,
        appSlug: opts.appSlug,
        settings: next,
        updated: now,
        created: now,
      })
    );
    if (rIns.isOk()) return;

    // Insert failed — most likely a concurrent insert won the PK race. Loop so
    // the next pass finds the row and merges via the update path. Re-throw on the
    // final attempt so a genuine (non-conflict) error still surfaces.
    if (attempt === MAX_ATTEMPTS - 1) throw rIns.Err();
  }
}
