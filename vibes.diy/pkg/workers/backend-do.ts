import {
  DurableObject,
  DurableObjectState,
  ExecutionContext,
  Request as CFRequest,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { CfCacheIf } from "@vibes.diy/api-svc";
import { CFInjectMutable, cfServeAppCtx, localInvokeAccessFn } from "@vibes.diy/api-svc/cf-serve.js";
import type { QuickJSWASMModule } from "@cf-wasm/quickjs";
import { type VibesApiSQLCtx } from "@vibes.diy/api-svc/types.js";
import { attemptBackendFetch } from "@vibes.diy/api-svc/intern/attempt-backend-fetch.js";
import { resolveBackendSchedule } from "@vibes.diy/api-svc/intern/load-selected-backend.js";
import { attemptBackendScheduled } from "@vibes.diy/api-svc/intern/attempt-backend-scheduled.js";
import { attemptBackendOnChange } from "@vibes.diy/api-svc/intern/attempt-backend-onchange.js";
import { armDecision, nextTickDecision } from "@vibes.diy/api-svc/intern/backend-alarm-policy.js";
import {
  BACKEND_OWNER_HEADER,
  BACKEND_SLUG_HEADER,
  BACKEND_OP_HEADER,
  BACKEND_OP_ARM,
  BACKEND_OP_ONCHANGE,
  backendDoName,
} from "@vibes.diy/api-svc/intern/backend-do-addr.js";
import { BACKEND_DB_OP_URL, handleBackendDbOp } from "@vibes.diy/api-svc/intern/backend-db-op.js";

declare const Response: typeof CFResponse;

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
  // Per-DO QuickJS module + access.js source caches for the local access-fn invoker
  // (#2856 B6). A backend `ctx.db` write re-enters the same production put gate,
  // which calls `vctx.invokeAccessFn` (QuickJS) — so the BackendDO must supply it,
  // exactly as the session DO does, or the gate fails closed "Access function
  // unavailable". Kept on the instance so cost amortizes across writes (mirrors
  // `AppSessions`).
  private quickjsModule: { module: QuickJSWASMModule | null } = { module: null };
  private accessFnSourceCache: Map<string, string> = new Map<string, string>();

  constructor(state: DurableObjectState, env: CFEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    // ctx.db op (#2856 B6): the loaded isolate's `globalOutbound` is a stub back to
    // THIS DO instance, so a handler's `ctx.db` write arrives here as a POST to the
    // internal db-op URL. `handleBackendDbOp` resolves the per-invocation nonce
    // against the executor's registry — shared because the executor ran in this same
    // DO isolate — and runs the registered callback (the production gate). Matched
    // FIRST: these requests carry no vibe-target headers.
    if ((request as unknown as Request).url === BACKEND_DB_OP_URL) {
      return (await handleBackendDbOp(request as unknown as Request)) as unknown as CFResponse;
    }

    const ownerHandle = request.headers.get(BACKEND_OWNER_HEADER);
    const appSlug = request.headers.get(BACKEND_SLUG_HEADER);
    if (!ownerHandle || !appSlug) {
      // Only the worker / queue addresses this DO, always with both target headers.
      return new Response("backend: missing vibe target", { status: 400 });
    }

    // A queue poke re-evaluates the schedule; the onChange poke runs the handler;
    // everything else is an `_api` fetch.
    const op = request.headers.get(BACKEND_OP_HEADER);
    if (op === BACKEND_OP_ARM) {
      return this.arm(request, ownerHandle, appSlug);
    }
    if (op === BACKEND_OP_ONCHANGE) {
      return this.invokeOnChange(request, ownerHandle, appSlug);
    }

    const vctx = await this.buildVctx(request);
    const userId = await resolveBackendSessionUserId(request);
    const outcome = await attemptBackendFetch(vctx, {
      ownerHandle,
      appSlug,
      request: request as unknown as Request,
      userId,
      backendJs: this.env.BACKEND_JS,
      loader: this.env.LOADER,
      dbFetcher: this.selfStub(ownerHandle, appSlug),
      policyVersion: this.env.BACKEND_POLICY_VERSION,
    });

    if (outcome.reason === "ok") {
      return outcome.response as unknown as CFResponse;
    }
    // Every fallback reason → 404 (attemptVibeSsr discipline). DIAGNOSTIC (preview):
    // the reason + whether the DO sees the LOADER binding + the invoke/select error
    // ride the JSON body (header values can't hold newlines — that threw 1101). To
    // be reverted to the opaque "not found" body before finalizing.
    const diag = {
      error: "backend.js _api: not found",
      reason: outcome.reason,
      loaderType: typeof (this.env as { LOADER?: unknown }).LOADER,
      mode: String(this.env.BACKEND_JS ?? "(unset)"),
      detail: String((outcome as { detail?: unknown }).detail ?? ""),
    };
    return new Response(JSON.stringify(diag), { status: 404, headers: { "content-type": "application/json" } });
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

  /**
   * Run the `onChange` handler for one committed write (#2856 B5). Fire-and-forget at
   * the queue level, but the DO answers so the queue knows whether to retry: 2xx when
   * the handler ran or there was nothing to run (flag off / no `onChange` export);
   * 5xx only on a retryable failure (executor/handler error). Not single-flighted —
   * `onChange` runs unblocked alongside `fetch` and the timer lane.
   */
  private async invokeOnChange(request: CFRequest, ownerHandle: string, appSlug: string): Promise<CFResponse> {
    const body = (await (request as unknown as Request).json()) as {
      dbName: string;
      docId: string;
      seq: number;
      deleted: boolean;
      doc: unknown;
      oldDoc?: unknown | null;
      depth?: number;
      writerUserId?: string | null;
    };
    const vctx = await this.buildVctx(request);
    const outcome = await attemptBackendOnChange(vctx, {
      ownerHandle,
      appSlug,
      dbName: body.dbName,
      docId: body.docId,
      seq: body.seq,
      deleted: body.deleted,
      doc: body.doc,
      oldDoc: body.oldDoc ?? null,
      // B6: the writer + generation depth ride the queue envelope (B5) and were
      // dropped here before handler invoke; thread them so a handler's ctx.db write
      // acts as the original writer and the loop guard advances.
      depth: body.depth,
      writerUserId: body.writerUserId ?? null,
      backendJs: this.env.BACKEND_JS,
      loader: this.env.LOADER,
      dbFetcher: this.selfStub(ownerHandle, appSlug),
      policyVersion: this.env.BACKEND_POLICY_VERSION,
    });

    if (outcome.ran || outcome.reason === "backend_disabled" || outcome.reason === "no_onChange_handler") {
      return new Response("ok", { status: 200 });
    }
    // executor_error / handler_error ⇒ retryable; the queue re-delivers.
    return new Response(`backend onChange: ${outcome.reason}`, { status: 500 });
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
        dbFetcher: this.selfStub(stored.ownerHandle, stored.appSlug),
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

  /**
   * A `Fetcher` stub back to THIS DO instance (#2856 B6), handed to the loaded
   * isolate as its `globalOutbound` so `ctx.db` ops route to `handleBackendDbOp`
   * here — the only by-reference capability channel the Worker Loader accepts. A
   * same-name stub resolves to the same instance/isolate, so the executor's nonce
   * registry is shared. The isolate's db-op subrequest interleaves with the awaited
   * invocation (the input gate is open across the isolate `await`), so there's no
   * self-call deadlock.
   */
  private selfStub(ownerHandle: string, appSlug: string): { fetch(request: CFRequest): Promise<CFResponse> } {
    const ns = (
      this.env as unknown as {
        BACKEND_DO: { idFromName(n: string): unknown; get(id: unknown): { fetch(r: CFRequest): Promise<CFResponse> } };
      }
    ).BACKEND_DO;
    return ns.get(ns.idFromName(backendDoName(ownerHandle, appSlug)));
  }

  /** Build `VibesApiSQLCtx` from `env` (the session-DO pattern). Wires the local
   *  QuickJS access-fn invoker + source cache so a backend `ctx.db` write re-enters
   *  the same access-gated put path the frontend uses (#2856 B6). */
  private async buildVctx(request: CFRequest): Promise<VibesApiSQLCtx> {
    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = (caches as unknown as { default: unknown }).default as unknown as CfCacheIf;
    const quickjsRef = this.quickjsModule;
    const overrides = {
      invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
      accessFnSourceCache: this.accessFnSourceCache,
    };
    const appCtx = (await cfServeAppCtx(request, this.env, cctx, overrides)).appCtx;
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
 * Resolve the verified session `userId` for a backend `_api` `fetch` (#2856 B6).
 * The result is bound into `ctx.db` so a handler write acts as the session user
 * through the production gate. Webhooks are unauthenticated (first-class `null`,
 * per Charlie), and any unresolved identity falls through to `null` → an anonymous
 * write the access fn must opt into (`allowAnonymous`), so this is fail-safe.
 *
 * The `_api` boundary does not yet standardize a verified-session header into the
 * DO (the forwarded request carries the client's raw auth), so token→user
 * verification is a thin follow-up gated on confirming that scheme; until it
 * lands, `fetch` handler writes act anonymously. Kept as a one-function seam so
 * only this resolver changes.
 */
async function resolveBackendSessionUserId(_request: CFRequest): Promise<string | null> {
  return null;
}
