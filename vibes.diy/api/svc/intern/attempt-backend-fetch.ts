import { exception2Result } from "@adviser/cement";
import { parseBackendJsMode, selectBackendExecutor, type BackendExecutor } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import type { VibesApiSQLCtx } from "../types.js";
import { loadSelectedBackend } from "./load-selected-backend.js";
import { makeBackendDbCallback, resolveBackendWriteIdentity } from "./backend-db-callback.js";

/**
 * Why a `fetch` to a vibe's `_api` didn't run, so the caller can render the right
 * fallback. Every reason maps to a **404** on the `_api` route (mirrors
 * `attemptVibeSsr`'s never-throw fallback discipline) — a broken or absent backend
 * degrades to "not found", never a 500, and never leaks into page render.
 */
export type BackendFallbackReason =
  | "backend_disabled" // BACKEND_JS=off (or no loader binding) → executor undefined
  | "no_release" // no Apps row for (ownerHandle, appSlug)
  | "no_backend_file" // the selected release has no /backend.js
  | "no_fetch_handler" // the selected release's /backend.js exports no `fetch`
  | "source_unreadable" // storage fetch failed / returned empty
  | "executor_error"; // selecting or invoking the isolate threw

export type BackendFetchOutcome = { reason: "ok"; response: Response } | { reason: BackendFallbackReason; detail?: string };

export interface AttemptBackendFetchInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** The `_api` request, already prefix-stripped to a path rooted at `/`. */
  readonly request: Request;
  /** Resolved session user handle for an authenticated call, or `null` (webhook / anonymous) — surfaces as `ctx.userInfo`. */
  readonly userHandle?: string | null;
  /**
   * The verified session `userId` for an authenticated `_api` call, or `null`
   * (webhook / anonymous). B6 binds it into `ctx.db` so a fetch handler's write
   * acts AS the session user through the production gate — never read from handler
   * input.
   */
  readonly userId?: string | null;
  /** Raw `env.BACKEND_JS` value; parsed here. Anything but `loader` ⇒ off (dark). */
  readonly backendJs?: string;
  /**
   * The Cloudflare `env.LOADER` Worker Loader binding (required for `loader` mode).
   * Typed `unknown` so callers (the DO) don't need a vibe-runtime dep; cast here.
   */
  readonly loader?: unknown;
  /**
   * A `Fetcher` stub back to the host BackendDO, set as the isolate's
   * `globalOutbound` so `ctx.db` ops route to `handleBackendDbOp` (#2856 B6). The
   * DO supplies a self-stub; typed `unknown` here.
   */
  readonly dbFetcher?: unknown;
  /** Egress-policy / binding-schema version, folded into the isolate id. */
  readonly policyVersion?: string;
}

/**
 * Run a vibe's `backend.js` `fetch` handler for an `_api` request (#2856, slice
 * B3). The synchronous request path's core — used by the `BackendDO` shell and
 * unit-testable on its own with a fake storage ctx + fake loader binding.
 *
 * **Never throws.** Each step is guarded; any failure returns a structured
 * `BackendFallbackReason` so the route degrades to 404, mirroring `attemptVibeSsr`.
 *
 * **Canonical-driven (per Codex/Charlie review):** the gate and the source both
 * come from the **selected release** (`selectLatestAppPerSlug`, the same
 * production-preferring row the viewer sees), parsed fresh — never the
 * release-agnostic `active.backend` AppSettings entry — so the "has a fetch
 * handler?" decision can't disagree with the code we run.
 *
 * **Per-vibe isolate:** the executor folds `{ownerHandle, appSlug}` into the
 * isolate id (tenant boundary); `userHandle` rides the trigger, never the hash.
 */
export async function attemptBackendFetch(vctx: VibesApiSQLCtx, input: AttemptBackendFetchInput): Promise<BackendFetchOutcome> {
  // 1. Executor (flag gate). `off` ⇒ undefined; a misconfigured `loader` throws
  //    inside the fallback boundary rather than 500-ing.
  const rExec = exception2Result((): BackendExecutor | undefined =>
    selectBackendExecutor(parseBackendJsMode(input.backendJs), {
      loader: input.loader as WorkerLoaderBinding | undefined,
      policyVersion: input.policyVersion,
      vibe: { ownerHandle: input.ownerHandle, appSlug: input.appSlug },
    })
  );
  if (rExec.isErr()) return { reason: "executor_error", detail: `select: ${rExec.Err().message}` };
  const executor = rExec.Ok();
  if (executor === undefined) return { reason: "backend_disabled" };

  // 2. Resolve the selected release + load + parse its /backend.js (shared with the
  //    B4 scheduled path, so gate and source can't disagree). no_release /
  //    no_backend_file / source_unreadable map straight to a fallback reason.
  const loaded = await loadSelectedBackend(vctx, input.ownerHandle, input.appSlug);
  if (!loaded.ok) return { reason: loaded.reason };

  // 3. Gate on THIS release's parse. No `fetch` export (or parse errors) ⇒ 404
  //    without spinning the isolate.
  if (!loaded.parsed.handlers.includes("fetch")) return { reason: "no_fetch_handler" };

  // 4. Invoke the isolate; return its Response verbatim. B6: bind the session
  //    user's identity into ctx.db (generation 0 — a fetch write has no onChange
  //    parent, so its commits emit onChange at depth 1).
  const identity = await resolveBackendWriteIdentity(vctx, {
    ownerHandle: input.ownerHandle,
    appSlug: input.appSlug,
    userId: input.userId ?? null,
  });
  const db = makeBackendDbCallback(vctx, { ownerHandle: input.ownerHandle, appSlug: input.appSlug, identity, originDepth: 0 });
  const rRes = await exception2Result(async () => {
    const payload = await serializeRequest(input.request);
    return executor.invoke({
      source: loaded.source,
      handler: "fetch",
      trigger: { userHandle: identity.userContext?.userHandle ?? input.userHandle ?? null, payload },
      db,
      dbFetcher: input.dbFetcher,
    });
  });
  if (rRes.isErr()) return { reason: "executor_error", detail: `invoke: ${rRes.Err().message}` };
  return { reason: "ok", response: rRes.Ok() };
}

/**
 * Request headers stripped before an `_api` request is handed to untrusted
 * `backend.js` handler code (#2856 security review). On the viewer URL form
 * `<base>/vibe/{owner}/{slug}/_api/...` the request rides the platform's apex
 * domain, so it carries the logged-in VIEWER's session credentials (`Cookie`, and
 * any bearer in `Authorization`). Forwarding those verbatim would let a handler
 * exfiltrate a viewer's session (e.g. persist it via `ctx.db.put` into an
 * owner-readable doc). Identity belongs host-side (`ctx.userInfo` / the write
 * identity resolved from the verified session), never in raw client headers the
 * handler can read. Lower-cased for a case-insensitive match.
 *
 * Webhook *signature* headers (Stripe `Stripe-Signature`, GitHub
 * `X-Hub-Signature-256`, …) are custom and preserved — only the platform-auth
 * headers are removed. A webhook that authenticates with a bare bearer
 * `Authorization` should move its secret to a custom header or query param until
 * host-side verification lands.
 */
export const STRIPPED_BACKEND_FETCH_HEADERS: ReadonlySet<string> = new Set(["cookie", "authorization"]);

/**
 * Flatten an HTTP Request into the JSON-serializable shape the backend isolate's
 * `main` reconstructs (`new Request(url, { method, headers, body })`). The trigger
 * is `JSON.stringify`'d into the loader request body, so every field must be
 * JSON-safe: headers as a plain object, body as text (or `null` for GET/HEAD).
 *
 * Viewer auth headers are dropped here (see {@link STRIPPED_BACKEND_FETCH_HEADERS})
 * so untrusted handler code never sees a viewer's session credentials.
 */
async function serializeRequest(
  req: Request
): Promise<{ url: string; method: string; headers: Record<string, string>; body: string | null }> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (STRIPPED_BACKEND_FETCH_HEADERS.has(key.toLowerCase())) return;
    headers[key] = value;
  });
  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? null : await req.text();
  return { url: req.url, method, headers, body };
}
