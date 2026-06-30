import { exception2Result, stream2uint8array } from "@adviser/cement";
import type { FileSystemItem } from "@vibes.diy/api-types";
import { selectBackendExecutor, type BackendExecutor, type BackendJsMode } from "@vibes.diy/vibe-runtime/backend-executor.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import { parseBackendConfig } from "@vibes.diy/vibe-runtime/parse-backend-config.js";
import type { VibesApiSQLCtx } from "../types.js";
import { selectLatestAppPerSlug } from "../public/select-app.js";

const BACKEND_FILENAME = "/backend.js";

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

export type BackendFetchOutcome = { reason: "ok"; response: Response } | { reason: BackendFallbackReason };

export interface AttemptBackendFetchInput {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** The `_api` request, already prefix-stripped to a path rooted at `/`. */
  readonly request: Request;
  /** Resolved session user for an authenticated call, or `null` (webhook / anonymous). */
  readonly userHandle?: string | null;
  /** `parseBackendJsMode(env.BACKEND_JS)` — `off` leaves the path dark. */
  readonly mode: BackendJsMode;
  /** The Cloudflare `env.LOADER` Worker Loader binding (required for `loader` mode). */
  readonly loader?: WorkerLoaderBinding;
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
    selectBackendExecutor(input.mode, {
      loader: input.loader,
      policyVersion: input.policyVersion,
      vibe: { ownerHandle: input.ownerHandle, appSlug: input.appSlug },
    })
  );
  if (rExec.isErr()) return { reason: "executor_error" };
  const executor = rExec.Ok();
  if (executor === undefined) return { reason: "backend_disabled" };

  // 2. Resolve the selected release (production-preferring; same row the viewer sees).
  const rRow = await exception2Result(() =>
    selectLatestAppPerSlug(vctx, { ownerHandle: input.ownerHandle, appSlug: input.appSlug })
  );
  if (rRow.isErr()) return { reason: "no_release" };
  const row = rRow.Ok();
  if (row === undefined) return { reason: "no_release" };

  // 3. Find /backend.js in the canonical filesystem of that release.
  const fileSystem = (row.fileSystem ?? []) as FileSystemItem[];
  const backendItem = fileSystem.find((f) => f.fileName === BACKEND_FILENAME);
  if (backendItem === undefined) return { reason: "no_backend_file" };

  // 4. Load the source bytes from storage.
  const rSource = await exception2Result(() => loadSource(vctx, backendItem.assetURI));
  if (rSource.isErr()) return { reason: "source_unreadable" };
  const source = rSource.Ok();
  if (source.length === 0) return { reason: "source_unreadable" };

  // 5. Gate: parse THIS release's source. No `fetch` export (or parse errors) ⇒ 404
  //    without spinning the isolate.
  const parsed = parseBackendConfig(source);
  if (!parsed.handlers.includes("fetch")) return { reason: "no_fetch_handler" };

  // 6. Invoke the isolate; return its Response verbatim.
  const rRes = await exception2Result(async () => {
    const payload = await serializeRequest(input.request);
    return executor.invoke({ source, handler: "fetch", trigger: { userHandle: input.userHandle ?? null, payload } });
  });
  if (rRes.isErr()) return { reason: "executor_error" };
  return { reason: "ok", response: rRes.Ok() };
}

/** Read a FileSystemItem's stored bytes as text (the render-vibe source-read pattern). */
async function loadSource(vctx: VibesApiSQLCtx, assetURI: string): Promise<string> {
  const r = await vctx.storage.fetch(assetURI);
  if (r.type !== "fetch.ok") throw new Error(`backend source fetch ${r.type} for ${assetURI}`);
  return vctx.sthis.txt.decode(await stream2uint8array(r.data));
}

/**
 * Flatten an HTTP Request into the JSON-serializable shape the backend isolate's
 * `main` reconstructs (`new Request(url, { method, headers, body })`). The trigger
 * is `JSON.stringify`'d into the loader request body, so every field must be
 * JSON-safe: headers as a plain object, body as text (or `null` for GET/HEAD).
 */
async function serializeRequest(
  req: Request
): Promise<{ url: string; method: string; headers: Record<string, string>; body: string | null }> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? null : await req.text();
  return { url: req.url, method, headers, body };
}
