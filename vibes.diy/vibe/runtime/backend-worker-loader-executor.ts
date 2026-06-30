import { TxtEnDecoderSingleton } from "@adviser/cement";
import { transformBackendSource } from "./transform-backend-source.js";
import { type IsolateFetcher, type WorkerCode, type WorkerLoaderBinding } from "./worker-loader-executor.js";
import { type BackendDbCallback, type BackendDbOp, type BackendExecutor, type BackendInvokeInput } from "./backend-executor.js";

const MAIN_MODULE = "main.js";
const BACKEND_MODULE = "backend.js";
// Pinned so the cache key (and isolate behavior) is reproducible. Bump
// deliberately when the runtime contract changes. Matches the SSR loader path.
const COMPATIBILITY_DATE = "2025-05-01";
// Version of the isolate `env`-binding schema (the shape of `ctx.db` and the
// `__VIBES_DB` transport, #2856 B6). Folded into the hashed `main` so a binding
// change forces a fresh isolate id — an `env`-binding change can NEVER be served
// by a stale cached isolate (Charlie watch-out). Bump on any change to the
// `__VIBES_DB` request/response contract or the `ctx.db` surface below.
const BINDING_SCHEMA_VERSION = "v1";
// The host db-capability binding name. The generated `ctx.db` reaches the
// production write gate ONLY through this binding — never general `fetch` (which
// stays `globalOutbound: null` until B8), so the capability is unforgeable from
// handler code (Charlie watch-out).
const DB_BINDING = "__VIBES_DB";
// Internal URL the isolate posts db ops to; the host transport ignores it (it
// routes by the binding, not the URL) — present only because `fetch` needs one.
const DB_OP_URL = "https://db.internal/op";
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
    // policyVersion + the binding-schema version are embedded so they participate
    // in the content hash (invariant #1c) — bumping either forces a new isolate id
    // without changing behavior, so a stale isolate can't serve a changed policy or
    // a changed `env`-binding shape (Charlie watch-out).
    `// backend-isolate policy=${policyVersion} bindings=${BINDING_SCHEMA_VERSION}`,
    `import * as handlers from "./${BACKEND_MODULE}";`,
    // Per-vibe identity — part of the hashed source (tenant partition) and the
    // unspoofable source of ctx.appInfo.
    `const VIBE = ${vibeLiteral};`,
    // ctx.db (#2856 B6) — the production write gate, reached ONLY through the host
    // `${DB_BINDING}` env binding (never general fetch). The handler supplies just
    // the doc/id/db; identity + loop-guard depth are host-side, never read from
    // here. `put`/`delete` resolve AFTER the host commits (same semantics as a
    // frontend write). When no binding is wired the methods throw (B1 callers / a
    // mode that didn't supply one) rather than silently no-op.
    `function makeDb(env, trigger) {`,
    `  const bind = env && env.${DB_BINDING};`,
    `  const defaultDb = trigger && trigger.payload && trigger.payload.dbName;`,
    `  async function rpc(body) {`,
    `    if (!bind) throw new Error("ctx.db is not available (no host db binding wired)");`,
    `    const r = await bind.fetch(${JSON.stringify(DB_OP_URL)}, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });`,
    `    const out = await r.json();`,
    `    if (!out || out.ok !== true) throw new Error((out && out.error) || "ctx.db op failed");`,
    `    return out.id;`,
    `  }`,
    `  return {`,
    `    put(doc, options) {`,
    `      const db = (options && options.db) || defaultDb;`,
    `      if (!db) throw new Error("ctx.db.put requires a db name — pass { db } (no default db for this trigger)");`,
    `      const docId = (options && options.id) || (doc && doc._id) || null;`,
    `      return rpc({ kind: "put", db: db, doc: doc, docId: docId });`,
    `    },`,
    `    delete(id, options) {`,
    `      const db = (options && options.db) || defaultDb;`,
    `      if (!db) throw new Error("ctx.db.delete requires a db name — pass { db } (no default db for this trigger)");`,
    `      return rpc({ kind: "delete", db: db, docId: id });`,
    `    },`,
    `  };`,
    `}`,
    `export default {`,
    `  async fetch(request, env) {`,
    `    const { handler, trigger } = await request.json();`,
    // Fail-closed allowlist (per @CharlieHelps): only the three trigger exports may
    // be dispatched, so a request can never reach `default`, `config`, or any other
    // module export via `handlers[handler]`. `hasOwnProperty` so prototype keys
    // (`constructor`, `__proto__`, …) are rejected too.
    `    const ALLOWED_HANDLERS = { fetch: true, scheduled: true, onChange: true };`,
    `    if (!Object.prototype.hasOwnProperty.call(ALLOWED_HANDLERS, handler)) {`,
    `      return new Response("invalid backend handler: " + handler, { status: 400 });`,
    `    }`,
    // ctx: appInfo is baked (unspoofable, B3); userInfo rides the trigger (B3); db
    // is the production write gate via the host binding (B6). secrets is PRESENT
    // BUT THROWS until B7 wires it — a handler that reaches for it fails loudly
    // instead of seeing `undefined`.
    `    const ctx = {`,
    `      appInfo: VIBE,`,
    `      userInfo: trigger && trigger.userHandle ? { userHandle: trigger.userHandle } : null,`,
    `      db: makeDb(env, trigger),`,
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
    // The isolate id is hashed from `code` BEFORE the env transport is attached, so
    // the per-invocation db binding never enters the hash (env is excluded by
    // construction) and never fragments the isolate cache. The binding-schema
    // version is what the hash already folds in (via the `main` comment).
    const id = await hashBackendWorkerCode(code);
    // Attach the host db capability (#2856 B6) as the `__VIBES_DB` env transport.
    // Identity-free: it routes the op to the supplied host callback; the trigger
    // identity + loop-guard depth are bound into that callback host-side, never
    // carried in env. Absent `input.db` (B1 callers), env stays unset and ctx.db
    // throws on use.
    const wired: WorkerCode = input.db ? { ...code, env: { [DB_BINDING]: makeDbBinding(input.db) } } : code;
    const stub = this.loader.get(id, () => wired);
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

/**
 * Wrap the host `ctx.db` callback as the identity-free `Fetcher` transport placed
 * in the isolate `env` (#2856 B6). The isolate's generated `ctx.db` POSTs a
 * `BackendDbOp` JSON body; this unwraps it, runs the host callback (the production
 * write gate, bound to the trigger identity + depth), and returns the
 * `BackendDbResult` as a JSON `Response`. The handler can only reach this through
 * `ctx.db` — never general `fetch` — so the write capability is unforgeable.
 */
function makeDbBinding(db: BackendDbCallback): IsolateFetcher {
  return {
    async fetch(request: Request): Promise<Response> {
      const op = (await request.json()) as BackendDbOp;
      const result = await db(op);
      return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
    },
  };
}
