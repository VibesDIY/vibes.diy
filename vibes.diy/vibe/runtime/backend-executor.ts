import { WorkerLoaderBackendExecutor } from "./backend-worker-loader-executor.js";
import { type WorkerLoaderBinding } from "./worker-loader-executor.js";

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

export interface BackendInvokeInput {
  /** Raw `backend.js` source (JS/TSX). The executor transforms it itself. */
  readonly source: string;
  /** Which named export to dispatch to. */
  readonly handler: BackendHandler;
  /** Per-trigger context — carried in the request, never the hashed code. */
  readonly trigger: BackendTrigger;
}

export interface BackendInvokeResult {
  /** Handler `Response` status (`fetch`), or `204` for `scheduled`/`onChange`, or `404` when the export is absent. */
  readonly status: number;
  /** Response body text. */
  readonly body: string;
}

export interface BackendExecutor {
  invoke(input: BackendInvokeInput): Promise<BackendInvokeResult>;
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
   */
  readonly policyVersion?: string;
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
      return new WorkerLoaderBackendExecutor(opts.loader, { policyVersion: opts.policyVersion });
  }
}
