import { exception2Result } from "@adviser/cement";
import { parseBackendJsMode, selectBackendExecutor, type BackendExecutor } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import type { VibesApiSQLCtx } from "../types.js";
import { loadSelectedBackend } from "./load-selected-backend.js";

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
  /** Raw `env.BACKEND_JS`; anything but `loader` ⇒ off (dark). */
  readonly backendJs?: string;
  /** The Cloudflare `env.LOADER` Worker Loader binding (typed `unknown`; cast here). */
  readonly loader?: unknown;
  readonly policyVersion?: string;
}

/**
 * Run a vibe's `backend.js` `onChange` handler for one committed write (#2856 B5).
 * Mirrors `attemptBackendScheduled` but for the post-commit lane: resolves the
 * **selected release** (shared `loadSelectedBackend`, so `onChange` runs the same
 * code `_api`/cron serve), runs the `onChange` export in the per-vibe isolate.
 *
 * `userHandle: null` is the **B6 seam** — B5 does not yet resolve the writer's
 * identity (it rides the queue envelope as `writerUserId` for B6 to plumb).
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

  const rRes = await exception2Result(async () =>
    executor.invoke({
      source: loaded.source,
      handler: "onChange",
      trigger: {
        userHandle: null,
        payload: {
          doc: input.doc,
          oldDoc: input.oldDoc ?? null,
          dbName: input.dbName,
          docId: input.docId,
          seq: input.seq,
          deleted: input.deleted,
        },
      },
    })
  );
  if (rRes.isErr()) return { ran: false, reason: "handler_error" };
  // The isolate `main` returns 204 for a clean `onChange`; an unhandled handler
  // throw surfaces as a 5xx from workerd — treat that as a retryable failure.
  if (rRes.Ok().status >= 500) return { ran: false, reason: "handler_error" };
  return { ran: true };
}
