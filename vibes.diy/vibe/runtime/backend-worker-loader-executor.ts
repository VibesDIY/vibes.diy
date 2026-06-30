import { TxtEnDecoderSingleton } from "@adviser/cement";
import { transformBackendSource } from "./transform-backend-source.js";
import { type WorkerCode, type WorkerLoaderBinding } from "./worker-loader-executor.js";
import { type BackendExecutor, type BackendInvokeInput } from "./backend-executor.js";

const MAIN_MODULE = "main.js";
const BACKEND_MODULE = "backend.js";
// Pinned so the cache key (and isolate behavior) is reproducible. Bump
// deliberately when the runtime contract changes. Matches the SSR loader path.
const COMPATIBILITY_DATE = "2025-05-01";
// Internal request URL — the dynamic worker only has the one fetch handler; the
// real per-trigger handler + context ride the request body (see below).
const BACKEND_REQUEST_URL = "https://vibe-backend.internal/";

/**
 * Shape the `WorkerCode` for a compiled `backend.js` module (#2856, slice B1) —
 * the backend analog of `buildVibeWorkerCode`.
 *
 * Key difference from SSR, and the heart of invariant #1 (cache-key isolation):
 * **neither the handler name nor any per-trigger context is baked into the hashed
 * source.** The `main` module reads `{ handler, trigger }` from the incoming
 * request on every invocation and dispatches to the matching export. So the
 * `modules` map depends only on the vibe's `backend.js` bytes + `policyVersion` —
 * one isolate per vibe serves all three handlers and every identity, and
 * `env.LOADER.get(id, …)` reuses it because `id` (a hash of this code) is stable.
 *
 * `policyVersion` (egress-policy / binding-schema version) IS folded in, so a
 * policy bump forces a new `id` — a stale isolate can't serve a changed policy.
 *
 * Pure string-shaping — the unit-testable part of the loader path, exercised
 * without a live `env.LOADER` binding.
 *
 * Per-vibe identity (#2856, slice B3): when `vibe` is supplied, `{ownerHandle,
 * appSlug}` is baked into the hashed `main` as the `VIBE` constant. That does two
 * things at once: it sets `ctx.appInfo` to a value the handler **cannot spoof via
 * the per-trigger request** (it's compiled in, not read off `trigger`), and it
 * folds the vibe identity into the content hash so **two different vibes with
 * byte-identical `backend.js` never share an isolate** (the tenant boundary). The
 * `JSON.stringify` encoding is inherently unambiguous — `{owner:"a",slug:"bc"}`
 * and `{owner:"ab",slug:"c"}` serialize to distinct strings — so no separate
 * length-prefixing is needed. Per-trigger context (`userHandle`, payload, …) still
 * rides the request, never the hash (invariant #1).
 *
 * KNOWN GAPs for the live path (later slices):
 * - `ctx.db`/`ctx.secrets` are **present but throw** until their slices wire them
 *   (B6 / B7) — a handler that reaches for them fails loudly rather than seeing
 *   `undefined`. `ctx.appInfo`/`ctx.userInfo` are wired (B3).
 * - `globalOutbound` is pinned `null` (the `WorkerCode` type's literal). B8
 *   replaces it with the controlled egress-proxy binding; until then there is no
 *   live load, so `null` (no network) is the safe placeholder.
 * - Dependency bundling (#2845): the `backend.js` module's bare imports aren't
 *   resolved here; that lands with the live-load wiring, shared with SSR.
 */
export function buildBackendWorkerCode(input: {
  module: string;
  policyVersion?: string;
  vibe?: { ownerHandle: string; appSlug: string };
}): WorkerCode {
  const policyVersion = input.policyVersion ?? "v1";
  // Baked, per-vibe — folds the vibe identity into the content hash (tenant
  // partition) and supplies an unspoofable `ctx.appInfo`. `null` when no vibe is
  // given (B1 library callers / tests), matching the prior appInfo-absent behavior.
  const vibeLiteral = input.vibe ? JSON.stringify({ ownerHandle: input.vibe.ownerHandle, appSlug: input.vibe.appSlug }) : "null";
  const main = [
    // policyVersion is embedded so it participates in the content hash (invariant
    // #1c) — bumping it forces a new isolate id without changing behavior.
    `// backend-isolate policy=${policyVersion}`,
    `import * as handlers from "./${BACKEND_MODULE}";`,
    // Per-vibe identity — part of the hashed source (tenant partition) and the
    // unspoofable source of ctx.appInfo.
    `const VIBE = ${vibeLiteral};`,
    `export default {`,
    `  async fetch(request) {`,
    `    const { handler, trigger } = await request.json();`,
    // Fail-closed allowlist (per @CharlieHelps): only the three trigger exports may
    // be dispatched, so a request can never reach `default`, `config`, or any other
    // module export via `handlers[handler]`. `hasOwnProperty` so prototype keys
    // (`constructor`, `__proto__`, …) are rejected too.
    `    const ALLOWED_HANDLERS = { fetch: true, scheduled: true, onChange: true };`,
    `    if (!Object.prototype.hasOwnProperty.call(ALLOWED_HANDLERS, handler)) {`,
    `      return new Response("invalid backend handler: " + handler, { status: 400 });`,
    `    }`,
    // ctx: appInfo is baked (unspoofable, B3); userInfo rides the trigger (B3).
    // db/secrets are PRESENT BUT THROW until B6/B7 wire them — a handler that
    // reaches for them fails loudly instead of seeing `undefined`.
    `    const ctx = {`,
    `      appInfo: VIBE,`,
    `      userInfo: trigger && trigger.userHandle ? { userHandle: trigger.userHandle } : null,`,
    `      get db() { throw new Error("ctx.db is not available yet (wired in #2856 slice B6)"); },`,
    `      get secrets() { throw new Error("ctx.secrets is not available yet (wired in #2856 slice B7)"); },`,
    `    };`,
    `    const fn = handlers[handler];`,
    `    if (typeof fn !== "function") {`,
    `      return new Response("no backend handler: " + handler, { status: 404 });`,
    `    }`,
    `    if (handler === "fetch") {`,
    `      const p = (trigger && trigger.payload) || {};`,
    `      const userReq = new Request(p.url || "https://vibe.internal/", {`,
    `        method: p.method, headers: p.headers, body: p.body,`,
    `      });`,
    `      return await fn(userReq, ctx);`,
    `    }`,
    `    await fn((trigger && trigger.payload) || {}, ctx);`,
    `    return new Response(null, { status: 204 });`,
    `  },`,
    `};`,
    ``,
  ].join("\n");
  return {
    compatibilityDate: COMPATIBILITY_DATE,
    mainModule: MAIN_MODULE,
    modules: {
      [MAIN_MODULE]: main,
      [BACKEND_MODULE]: input.module,
    },
    globalOutbound: null,
  };
}

/** Hex SHA-256 of the worker code — the `env.LOADER.get` id, so identical code reuses one isolate. */
async function hashBackendWorkerCode(code: WorkerCode): Promise<string> {
  const payload = `${code.compatibilityDate}\n${code.mainModule}\n${JSON.stringify(code.modules)}`;
  // `TxtEnDecoderSingleton().encode` is the cement UTF-8 encoder `sthis.txt`
  // wraps — rules-bag forbids `new TextEncoder` directly.
  const digest = await crypto.subtle.digest("SHA-256", TxtEnDecoderSingleton().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Invokes a vibe's backend handler in a fresh Cloudflare Dynamic Worker isolate
 * at the edge (#2856, slice B1). The `env.LOADER` binding is open beta and absent
 * from CI, so this never loads a live isolate; its `buildBackendWorkerCode`
 * shaping and `get → getEntrypoint → fetch` orchestration are unit-tested against
 * a fake binding.
 *
 * The isolate `id` derives only from the (stable) code + `policyVersion`; the
 * per-trigger `handler` + `trigger` ride the request body, so two invocations with
 * different identities reuse one isolate without their contexts touching the
 * cache key (invariant #1).
 */
export class WorkerLoaderBackendExecutor implements BackendExecutor {
  constructor(
    private readonly loader: WorkerLoaderBinding,
    private readonly opts: { readonly policyVersion?: string; readonly vibe?: { ownerHandle: string; appSlug: string } } = {}
  ) {}

  async invoke(input: BackendInvokeInput): Promise<Response> {
    const { module } = transformBackendSource(input.source);
    const code = buildBackendWorkerCode({ module, policyVersion: this.opts.policyVersion, vibe: this.opts.vibe });
    const id = await hashBackendWorkerCode(code);
    const stub = this.loader.get(id, () => code);
    const request = new Request(BACKEND_REQUEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handler: input.handler, trigger: input.trigger }),
    });
    // Return the isolate Response verbatim — never decompose to status/body, or a
    // fetch handler's headers (Location, Set-Cookie, content-type) get dropped on
    // the way to the B3 `_api` route (per Codex review).
    return stub.getEntrypoint().fetch(request);
  }
}
