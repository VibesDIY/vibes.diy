import {
  DurableObject,
  DurableObjectState,
  ExecutionContext,
  Request as CFRequest,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { CfCacheIf } from "@vibes.diy/api-svc";
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import { type VibesApiSQLCtx } from "@vibes.diy/api-svc/types.js";
import { attemptBackendFetch } from "@vibes.diy/api-svc/intern/attempt-backend-fetch.js";
import { resolveBackendSchedule } from "@vibes.diy/api-svc/intern/load-selected-backend.js";
import { attemptBackendScheduled } from "@vibes.diy/api-svc/intern/attempt-backend-scheduled.js";
import { armDecision, nextTickDecision } from "@vibes.diy/api-svc/intern/backend-alarm-policy.js";

declare const Response: typeof CFResponse;

// app.ts stamps the resolved vibe target on the forwarded request, so the DO never
// re-parses the (host-or-path-dependent) URL. These are internal headers.
export const BACKEND_OWNER_HEADER = "x-vibe-owner";
export const BACKEND_SLUG_HEADER = "x-vibe-slug";
// The queue poke sets this so the DO re-evaluates its schedule instead of serving
// an `_api` request (a header, not a path, so it can't collide with a vibe's own
// `_api` routes).
export const BACKEND_OP_HEADER = "x-backend-op";
export const BACKEND_OP_ARM = "arm";

const ALARM_STATE_KEY = "backendAlarm";

/**
 * Durable timer state (#2856 B4). The vibe identity is persisted here because
 * `idFromName` is one-way and `alarm()` has no incoming request to read the
 * `x-vibe-*` headers from (Codex review) — without it an evicted DO couldn't know
 * which vibe to run on a tick.
 */
interface AlarmState {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** Armed interval (ms), or null when disarmed. */
  readonly intervalMs: number | null;
  /** Consecutive `scheduled` failures (drives backoff; 0 = healthy). */
  readonly attempt: number;
  readonly lastRunAt?: string;
  readonly lastErrorAt?: string;
  readonly lastError?: string;
}

/**
 * Per-vibe backend Durable Object (#2856). The durable compute unit a vibe's
 * `backend.js` runs in — `fetch` (B3, `_api`) plus the `scheduled` timer lane
 * (B4). Addressed per `(ownerHandle, appSlug)` via `backendDoName`, so one instance
 * owns one vibe (the boundary that pairs with the per-vibe isolate id).
 *
 * The heavy logic lives in unit-tested `api-svc` functions (`attemptBackendFetch`,
 * `attemptBackendScheduled`, `resolveBackendSchedule`, `armDecision`/
 * `nextTickDecision`); this class is the thin shell that builds `vctx` from `env`
 * (`cfServeAppCtx`, the session-DO pattern), owns the alarm + storage state, and
 * applies the decisions.
 */
export class BackendDO implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: CFEnv;
  // In-memory single-flight guard for the `scheduled` lane. CF runs one `alarm()`
  // at a time per DO; this guards the await-interleaved edge / a manual re-entry.
  private ticking = false;

  constructor(state: DurableObjectState, env: CFEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    const ownerHandle = request.headers.get(BACKEND_OWNER_HEADER);
    const appSlug = request.headers.get(BACKEND_SLUG_HEADER);
    if (!ownerHandle || !appSlug) {
      // Only the worker / queue addresses this DO, always with both target headers.
      return new Response("backend: missing vibe target", { status: 400 });
    }

    // A queue poke re-evaluates the schedule; everything else is an `_api` fetch.
    if (request.headers.get(BACKEND_OP_HEADER) === BACKEND_OP_ARM) {
      return this.arm(request, ownerHandle, appSlug);
    }

    const vctx = await this.buildVctx(request);
    const userHandle = await resolveBackendUserHandle();
    const outcome = await attemptBackendFetch(vctx, {
      ownerHandle,
      appSlug,
      request: request as unknown as Request,
      userHandle,
      backendJs: this.env.BACKEND_JS,
      loader: this.env.LOADER,
      policyVersion: this.env.BACKEND_POLICY_VERSION,
    });

    if (outcome.reason === "ok") {
      return outcome.response as unknown as CFResponse;
    }
    // Every fallback reason → 404 (attemptVibeSsr discipline).
    return new Response("backend.js _api: not found", { status: 404, headers: { "content-type": "text/plain" } });
  }

  /**
   * Re-evaluate the schedule from the **selected release** and arm/re-arm/disarm to
   * match — idempotent and payload-agnostic (per Charlie). Persists the vibe
   * identity so a later `alarm()` can recover it after eviction.
   */
  private async arm(request: CFRequest, ownerHandle: string, appSlug: string): Promise<CFResponse> {
    const vctx = await this.buildVctx(request);
    const intervalMs = await resolveBackendSchedule(vctx, ownerHandle, appSlug);
    const stored = await this.state.storage.get<AlarmState>(ALARM_STATE_KEY);
    const hasAlarm = (await this.state.storage.getAlarm()) !== null;

    const decision = armDecision(stored?.intervalMs ?? null, hasAlarm, intervalMs);
    if (decision.action === "clear") {
      await this.state.storage.deleteAlarm();
      await this.state.storage.delete(ALARM_STATE_KEY);
    } else if (decision.action === "set") {
      await this.state.storage.setAlarm(Date.now() + decision.intervalMs);
      await this.state.storage.put<AlarmState>(ALARM_STATE_KEY, {
        ownerHandle,
        appSlug,
        intervalMs: decision.intervalMs,
        attempt: 0,
      });
    } else if (stored && (stored.ownerHandle !== ownerHandle || stored.appSlug !== appSlug)) {
      // noop on cadence, but keep the persisted identity current.
      await this.state.storage.put<AlarmState>(ALARM_STATE_KEY, { ...stored, ownerHandle, appSlug });
    }
    return new Response("ok", { status: 200 });
  }

  /** The `scheduled` tick. Cloudflare invokes this when the alarm fires. */
  async alarm(): Promise<void> {
    if (this.ticking) return; // single-flight: never overlap scheduled with itself.

    const stored = await this.state.storage.get<AlarmState>(ALARM_STATE_KEY);
    if (!stored || stored.intervalMs === null) {
      // No identity / no schedule (e.g. an alarm that outlived its state) — self-clear
      // rather than throw (Codex review).
      await this.state.storage.deleteAlarm();
      return;
    }

    this.ticking = true;
    try {
      const vctx = await this.buildVctx(this.syntheticRequest());
      const now = Date.now();
      const outcome = await attemptBackendScheduled(vctx, {
        ownerHandle: stored.ownerHandle,
        appSlug: stored.appSlug,
        scheduledTime: new Date(now).toISOString(),
        backendJs: this.env.BACKEND_JS,
        loader: this.env.LOADER,
        policyVersion: this.env.BACKEND_POLICY_VERSION,
      });

      // The live release dropped its `scheduled` export ⇒ disarm.
      if (!outcome.ran && outcome.reason === "no_schedule") {
        await this.state.storage.deleteAlarm();
        await this.state.storage.delete(ALARM_STATE_KEY);
        return;
      }
      // Dark behind the flag ⇒ keep the cadence (no failure count) so ticks resume
      // when `BACKEND_JS` flips to `loader`.
      if (!outcome.ran && outcome.reason === "backend_disabled") {
        await this.state.storage.setAlarm(now + stored.intervalMs);
        return;
      }

      const decision = nextTickDecision(stored.intervalMs, stored.attempt, outcome.ran);
      await this.state.storage.setAlarm(now + decision.delayMs);
      const nowIso = new Date(now).toISOString();
      const next: AlarmState = outcome.ran
        ? {
            ownerHandle: stored.ownerHandle,
            appSlug: stored.appSlug,
            intervalMs: stored.intervalMs,
            attempt: decision.attempt,
            lastRunAt: nowIso,
          }
        : {
            ownerHandle: stored.ownerHandle,
            appSlug: stored.appSlug,
            intervalMs: stored.intervalMs,
            attempt: decision.attempt,
            lastRunAt: nowIso,
            lastErrorAt: nowIso,
            lastError: outcome.reason,
          };
      await this.state.storage.put<AlarmState>(ALARM_STATE_KEY, next);
    } finally {
      this.ticking = false;
    }
  }

  /** Build `VibesApiSQLCtx` from `env` (the session-DO pattern). */
  private async buildVctx(request: CFRequest): Promise<VibesApiSQLCtx> {
    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = (caches as unknown as { default: unknown }).default as unknown as CfCacheIf;
    const appCtx = (await cfServeAppCtx(request, this.env, cctx)).appCtx;
    return appCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
  }

  /**
   * `alarm()` has no incoming request, but `cfServeAppCtx` wants one. Synthesize a
   * minimal internal request. Its `cf` is absent — `cfServeAppCtx`'s `netHash` is
   * lazy and unused on the backend resolve/scheduled path, so it never evaluates
   * against the missing `cf` (Charlie's hardening note).
   */
  private syntheticRequest(): CFRequest {
    return new Request("https://backend-do.internal/__alarm") as unknown as CFRequest;
  }
}

/**
 * Resolve the acting identity for a backend trigger (#2856 → consumed by B6).
 * Webhooks are unauthenticated (first-class `null`, per Charlie); explicit token
 * extraction for authenticated `_api` calls lands with its consumer B6. Kept as a
 * one-function seam.
 */
async function resolveBackendUserHandle(): Promise<string | null> {
  return null;
}
