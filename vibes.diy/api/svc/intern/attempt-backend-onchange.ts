import { exception2Result } from "@adviser/cement";
import { parseBackendJsMode, selectBackendExecutor, type BackendExecutor } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import type { VibesApiSQLCtx } from "../types.js";
import { loadSelectedBackend } from "./load-selected-backend.js";
import { makeBackendDbCallback, resolveBackendWriteIdentity } from "./backend-db-callback.js";

/**
 * Outcome of one `onChange` invocation (#2856 B5). `ran: true` ⇒ the handler
 * completed; `ran: false` distinguishes "nothing to run" (`backend_disabled` /
 * `no_onChange_handler` — the queue handler acks) from a genuine, retryable failure
 * (`executor_error` / `handler_error` — the queue handler returns `Err` so
 * `message.retry()` fires).
 */
export type OnChangeOutcome =
  | { readonly ran: true }
  | { readonly ran: false; readonly reason: "backend_disabled" | "no_onChange_handler" | "executor_error" | "handler_error" };

export interface AttemptBackendOnChangeInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  /** Committed revision seq — the handler's idempotency key. */
  readonly seq: number;
  /** true ⇒ tombstone (from deleteDoc); false ⇒ create/update. */
  readonly deleted: boolean;
  readonly doc: unknown;
  readonly oldDoc?: unknown | null;
  /**
   * The original writer's user id, carried on the B5 queue envelope. B6 resolves it
   * to the writer's active handle so a handler's `ctx.db` write acts AS the original
   * writer — never read from handler input.
   */
  readonly writerUserId?: string | null;
  /**
   * The TRUSTED loop-guard generation of this onChange (B5 envelope `depth`). A
   * handler-induced `ctx.db.put` commits and emits its onChange at `depth + 1`,
   * suppressed past the cap. Rides the trusted internal channel, never handler input.
   */
  readonly depth?: number;
  /** Raw `env.BACKEND_JS`; anything but `loader` ⇒ off (dark). */
  readonly backendJs?: string;
  /** The Cloudflare `env.LOADER` Worker Loader binding (typed `unknown`; cast here). */
  readonly loader?: unknown;
  /** A `Fetcher` stub back to the host BackendDO, set as the isolate's
   *  `globalOutbound` so a handler's `ctx.db` ops route to `handleBackendDbOp`
   *  (#2856 B6). The DO supplies a self-stub. */
  readonly dbFetcher?: unknown;
  readonly policyVersion?: string;
}

/**
 * Run a vibe's `backend.js` `onChange` handler for one committed write (#2856 B5).
 * Mirrors `attemptBackendScheduled` but for the post-commit lane: resolves the
 * **selected release** (shared `loadSelectedBackend`, so `onChange` runs the same
 * code `_api`/cron serve), runs the `onChange` export in the per-vibe isolate.
 *
 * B6 resolves the writer's identity from the envelope's `writerUserId` and binds it
 * (plus the trusted generation `depth`) into `ctx.db`, so a handler write acts AS
 * the original writer through the production gate.
 *
 * Never throws — every failure is a structured `OnChangeOutcome` the queue handler
 * turns into ack-vs-retry.
 */
export async function attemptBackendOnChange(vctx: VibesApiSQLCtx, input: AttemptBackendOnChangeInput): Promise<OnChangeOutcome> {
  const rExec = exception2Result((): BackendExecutor | undefined =>
    selectBackendExecutor(parseBackendJsMode(input.backendJs), {
      loader: input.loader as WorkerLoaderBinding | undefined,
      policyVersion: input.policyVersion,
      vibe: { ownerHandle: input.ownerHandle, appSlug: input.appSlug },
    })
  );
  if (rExec.isErr()) return { ran: false, reason: "executor_error" };
  const executor = rExec.Ok();
  if (executor === undefined) return { ran: false, reason: "backend_disabled" };

  const loaded = await loadSelectedBackend(vctx, input.ownerHandle, input.appSlug);
  if (!loaded.ok || !loaded.parsed.handlers.includes("onChange")) {
    // No backend / no onChange export on the live release ⇒ nothing to run; ack.
    return { ran: false, reason: "no_onChange_handler" };
  }

  // B6: resolve the original writer's identity (`writerUserId` off the B5 envelope)
  // and bind it + the trusted generation depth into ctx.db. A handler write acts AS
  // the writer and re-enters the production gate; its own onChange emits at
  // `depth + 1` (loop guard goes live).
  const identity = await resolveBackendWriteIdentity(vctx, {
    ownerHandle: input.ownerHandle,
    appSlug: input.appSlug,
    userId: input.writerUserId ?? null,
  });
  const db = makeBackendDbCallback(vctx, {
    ownerHandle: input.ownerHandle,
    appSlug: input.appSlug,
    identity,
    originDepth: input.depth ?? 0,
  });

  const rRes = await exception2Result(async () =>
    executor.invoke({
      source: loaded.source,
      handler: "onChange",
      trigger: {
        userHandle: identity.userContext?.userHandle ?? null,
        payload: {
          doc: input.doc,
          oldDoc: input.oldDoc ?? null,
          dbName: input.dbName,
          docId: input.docId,
          seq: input.seq,
          deleted: input.deleted,
        },
      },
      db,
      dbFetcher: input.dbFetcher,
    })
  );
  if (rRes.isErr()) return { ran: false, reason: "handler_error" };
  // The isolate `main` returns 204 for a clean `onChange`; an unhandled handler
  // throw surfaces as a 5xx from workerd — treat that as a retryable failure.
  if (rRes.Ok().status >= 500) return { ran: false, reason: "handler_error" };
  return { ran: true };
}
