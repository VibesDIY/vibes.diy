import { WorkerLoaderBackendExecutor } from "./backend-worker-loader-executor.js";
import { type WorkerLoaderBinding } from "./worker-loader-executor.js";

// Re-exported through this (package-exposed) module so the host BackendDO — which
// receives the isolate's `ctx.db` ops via its self-stub `globalOutbound` — can
// dispatch them without deep-importing the executor internals (#2856 B6).
export { BACKEND_DB_OP_URL, handleBackendDbOp } from "./backend-worker-loader-executor.js";

/**
 * The backend-handler executor seam (#2856, slice B1) — the sibling of the SSR
 * `Executor` (`vibe-executor.ts`). Where SSR renders a component, this invokes a
 * named handler export (`fetch`/`scheduled`/`onChange`) of a vibe's compiled
 * `backend.js` inside a Cloudflare Worker Loader isolate.
 *
 * Library-only in B1: transform + `WorkerCode` shaping + orchestration against a
 * fake `env.LOADER` binding. The Durable Object, `_api` routing, alarms, the real
 * `ctx.db`/secrets wiring, and the egress proxy are later slices (B2–B8).
 *
 * Like the SSR executors, this module is server-only and is NOT re-exported from
 * the runtime `index.ts` (the client iframe entry) — server callers deep-import.
 */
export type BackendHandler = "fetch" | "scheduled" | "onChange";

/**
 * Per-trigger context for one invocation.
 *
 * INVARIANT #1 (cache-key isolation): none of this may enter the hashed
 * `WorkerCode` source or `WorkerCode.env` — both are part of the isolate identity
 * (`env.LOADER.get(id, …)` keys `id` on the code, and `env` is part of the
 * `WorkerCode`). Per-trigger context travels via the request/RPC args on each
 * call, so identical `backend.js` reuses one isolate across triggers/identities
 * with no cross-invocation identity bleed.
 */
export interface BackendTrigger {
  /** The acting identity for the write path (`onChange` → original writer; `fetch` → session user; `scheduled` → owner). */
  readonly userHandle?: string | null;
  /** Loop-guard tag so a backend-originated write doesn't re-trigger its own `onChange` (B5). */
  readonly sourceTag?: string;
  /** Loop-guard depth (B5). */
  readonly depth?: number;
  /** Optional handler-supplied dedupe key (B5). */
  readonly dedupeKey?: string;
  /** The HTTP request (for `fetch`) or event (for `scheduled`/`onChange`), modeled opaquely in B1. */
  readonly payload?: unknown;
}

/**
 * One `ctx.db` operation the isolate forwards to the host (#2856 B6). The handler
 * supplies ONLY the doc/id and the target db; identity and loop-guard depth are
 * bound host-side into the `BackendDbCallback`, never carried here (so handler
 * code can neither forge them nor read them off this op).
 */
export type BackendDbOp =
  | { readonly kind: "put"; readonly db: string; readonly doc: unknown; readonly docId: string | null }
  | { readonly kind: "delete"; readonly db: string; readonly docId: string };

/** Result of a `ctx.db` op. `ok:false` carries the gate's deny reason (and the
 *  `access-denied`/`unreadable`/`conflict` code where one applies) so the
 *  isolate's `ctx.db.put`/`delete` can reject with a faithful error. */
export type BackendDbResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: string; readonly code?: string };

/**
 * Host capability backing `ctx.db` (#2856 B6). Provided per-invocation by the
 * api-svc layer, where it closes over the request-scoped `vctx`, the resolved
 * trigger identity, and the trusted loop-guard depth. It re-enters the SAME
 * production write gate frontend writes use (`runPutAccessGate` /
 * `runDeleteAccessGate` → `allocateAndInsertRevision`), so a backend write and an
 * identical frontend write produce the same allow/deny + sidecar outcome. The
 * Promise resolves only AFTER the host commit.
 */
export type BackendDbCallback = (op: BackendDbOp) => Promise<BackendDbResult>;

export interface BackendInvokeInput {
  /** Raw `backend.js` source (JS/TSX). The executor transforms it itself. */
  readonly source: string;
  /** Which named export to dispatch to. */
  readonly handler: BackendHandler;
  /** Per-trigger context — carried in the request, never the hashed code. */
  readonly trigger: BackendTrigger;
  /**
   * Host capability backing `ctx.db` (#2856 B6). The executor registers it under a
   * per-invocation nonce; the isolate's `globalOutbound` (see `dbFetcher`) delivers
   * db-ops back to the host, which resolves the nonce to this callback. Absent for
   * B1 library callers / any path without write access — then `ctx.db` throws.
   */
  readonly db?: BackendDbCallback;
  /**
   * The REAL `Fetcher` set as the isolate's `globalOutbound` — a stub back to the
   * host BackendDO (the only by-reference capability channel the Worker Loader
   * accepts; `env` is structured-cloned and a plain object is rejected). The DO
   * routes the isolate's db-op posts to `handleBackendDbOp`. Typed `unknown` so
   * this package needs no `@cloudflare/workers-types`; the executor casts it. Must
   * accompany `db`; without it, `ctx.db` has no egress and throws.
   */
  readonly dbFetcher?: unknown;
}

export interface BackendExecutor {
  /**
   * Invoke a backend handler and return the isolate's `Response` **verbatim** —
   * status, headers, and body flow through unchanged, so an `_api` route (B3) can
   * return exactly what a `fetch` handler produced (redirects via `Location`,
   * cookies via `Set-Cookie`, `content-type`, …) without silently dropping any of
   * them (per Codex review). `scheduled`/`onChange` resolve to a `204`, and an
   * absent export resolves to a `404`.
   */
  invoke(input: BackendInvokeInput): Promise<Response>;
}

/**
 * `BACKEND_JS` selects the executor. `off` (the default) leaves backend.js dark.
 * There is intentionally **no `node` mode**: backend handlers are secret-bearing
 * and network-capable, so in-process execution is never allowed on any path
 * (a fortiori the SSR Codex-RCE lesson). The CI-testable path is the loader
 * executor against a fake binding.
 */
export type BackendJsMode = "off" | "loader";

/**
 * Parse the `BACKEND_JS` env value. Anything unrecognized — including `undefined`
 * and the empty string — falls back to `off`, the safe default until the Worker
 * Loader binding is GA (mirrors `parseVibesSsrMode`).
 */
export function parseBackendJsMode(raw: string | undefined): BackendJsMode {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "loader":
      return "loader";
    default:
      return "off";
  }
}

export interface SelectBackendExecutorOptions {
  /** Required for `loader` mode — the Cloudflare `env.LOADER` Worker Loader binding. */
  readonly loader?: WorkerLoaderBinding;
  /**
   * Egress-policy / binding-schema version. Part of the isolate identity surface
   * (invariant #1): bumping it forces a new isolate id so a policy change can't be
   * served by a stale cached isolate. Stable across triggers.
   *
   * Opaque string in B1 (deliberately — @CharlieHelps). At B8, derive this from
   * structured components (`egressPolicyVersion` + `bindingSchemaVersion`) in one
   * canonical place and hash the derived string, so the simple identity input here
   * doesn't drift from the real policy surface.
   */
  readonly policyVersion?: string;
  /**
   * Per-vibe identity (#2856, slice B3). Folded into the isolate id so two
   * different vibes with byte-identical `backend.js` never share an isolate (the
   * tenant boundary), and baked into the handler's `ctx.appInfo` as an unspoofable
   * value. The DO is per-vibe, so this is set once per executor.
   */
  readonly vibe?: { readonly ownerHandle: string; readonly appSlug: string };
}

/**
 * Build the executor for a `BACKEND_JS` mode. `off` ⇒ `undefined` (caller skips
 * backend dispatch). `loader` requires an `env.LOADER` binding and throws without
 * one — the same fail-safe contract `selectExecutor` uses for SSR, so a
 * misconfigured `loader` degrades inside the caller's fallback boundary rather
 * than 500-ing.
 */
export function selectBackendExecutor(mode: BackendJsMode, opts: SelectBackendExecutorOptions = {}): BackendExecutor | undefined {
  switch (mode) {
    case "off":
      return undefined;
    case "loader":
      if (opts.loader === undefined) {
        throw new Error("BACKEND_JS=loader requires a Worker Loader (env.LOADER) binding");
      }
      return new WorkerLoaderBackendExecutor(opts.loader, { policyVersion: opts.policyVersion, vibe: opts.vibe });
  }
}
