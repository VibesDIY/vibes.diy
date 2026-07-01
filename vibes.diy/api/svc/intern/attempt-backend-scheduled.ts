import { exception2Result } from "@adviser/cement";
import { parseBackendJsMode, selectBackendExecutor, type BackendExecutor } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import type { VibesApiSQLCtx } from "../types.js";
import { loadSelectedBackend } from "./load-selected-backend.js";
import { makeBackendDbCallback, resolveOwnerWriteIdentity } from "./backend-db-callback.js";

/**
 * Outcome of one `scheduled` tick (#2856 B4). `ran: true` ⇒ the handler completed
 * (re-arm at interval, reset attempt); `ran: false` ⇒ the `BackendDO` backs off /
 * gives up per `nextTickDecision`. `reason` distinguishes "nothing to run"
 * (`backend_disabled` / `no_schedule` — not a failure, the DO should disarm) from a
 * genuine failure (`executor_error` / `handler_error` — a retryable backoff).
 */
export type ScheduledOutcome =
  | { readonly ran: true }
  | { readonly ran: false; readonly reason: "backend_disabled" | "no_schedule" | "executor_error" | "handler_error" };

export interface AttemptBackendScheduledInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** ISO timestamp of the firing, passed to the handler as `event.scheduledTime`. */
  readonly scheduledTime: string;
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
 * Run a vibe's `backend.js` `scheduled` handler for one alarm tick (#2856 B4).
 * Mirrors `attemptBackendFetch` but for the timer lane: resolves the **selected
 * release** (shared `loadSelectedBackend`, so the cron runs the same code `_api`
 * serves), runs the `scheduled` export in the per-vibe isolate as the vibe owner.
 *
 * Never throws — every failure is a structured `ScheduledOutcome` the `BackendDO`
 * turns into a re-arm / backoff / disarm decision.
 */
export async function attemptBackendScheduled(
  vctx: VibesApiSQLCtx,
  input: AttemptBackendScheduledInput
): Promise<ScheduledOutcome> {
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
  if (!loaded.ok || !loaded.parsed.handlers.includes("scheduled")) {
    // No backend / no scheduled export on the live release ⇒ nothing to run; the
    // DO disarms rather than retries.
    return { ran: false, reason: "no_schedule" };
  }

  // B6: a scheduled handler's ctx.db writes act AS the vibe owner; generation 0
  // (no onChange parent), so its commits emit onChange at depth 1.
  const identity = await resolveOwnerWriteIdentity(vctx, { ownerHandle: input.ownerHandle, appSlug: input.appSlug });
  const db = makeBackendDbCallback(vctx, { ownerHandle: input.ownerHandle, appSlug: input.appSlug, identity, originDepth: 0 });

  const rRes = await exception2Result(async () =>
    executor.invoke({
      source: loaded.source,
      handler: "scheduled",
      trigger: { userHandle: input.ownerHandle, payload: { scheduledTime: input.scheduledTime } },
      db,
      dbFetcher: input.dbFetcher,
    })
  );
  if (rRes.isErr()) return { ran: false, reason: "handler_error" };
  // The isolate `main` returns 204 for a clean `scheduled`; an unhandled handler
  // throw surfaces as a 5xx from workerd — treat that as a retryable failure.
  if (rRes.Ok().status >= 500) return { ran: false, reason: "handler_error" };
  return { ran: true };
}
