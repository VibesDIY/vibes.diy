// Slice B1 (#2856): WorkerLoaderBackendExecutor — the Cloudflare Worker Loader
// path for vibe `backend.js` handlers.
//
// The `env.LOADER` binding is open beta and absent from CI, so this never loads a
// live isolate. We test the pure `buildBackendWorkerCode` shaping and the
// executor's orchestration (`get → getEntrypoint → fetch`) against a fake LOADER
// binding — including @CharlieHelps's cache-key-isolation acceptance matrix
// (invariant #1): same code + different trigger identities ⇒ same loader id; no
// cross-invocation identity bleed; a policy/schema bump ⇒ new id.

import { describe, it, expect } from "vitest";
import { WorkerLoaderBackendExecutor, buildBackendWorkerCode } from "../../../vibe/runtime/backend-worker-loader-executor.js";
import { type WorkerCode, type WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";

const SONOS_BACKEND = `
export async function fetch(request, ctx) { return new Response("ok"); }
export async function scheduled(event, ctx) { /* poll */ }
export async function onChange(event, ctx) { /* notify */ }
`;

describe("buildBackendWorkerCode", () => {
  const code = buildBackendWorkerCode({ module: `export function fetch(){ return null; }` });

  it("names a main module that is present in `modules`", () => {
    expect(typeof code.mainModule).toBe("string");
    expect(code.modules[code.mainModule]).toBeTypeOf("string");
  });

  it("carries the transformed backend module alongside main", () => {
    const joined = Object.values(code.modules).join("\n");
    expect(joined).toContain("function fetch()");
    expect(code.modules["backend.js"]).toContain("function fetch()");
  });

  it("dispatches by handler name read from the request, not baked into the code", () => {
    const main = code.modules[code.mainModule];
    // handler comes off the request body, then indexes the imported exports.
    expect(main).toMatch(/request\.json\(\)/);
    expect(main).toMatch(/handlers\[handler\]/);
    expect(main).toMatch(/export default/);
    expect(main).toMatch(/async fetch\(request, env\)/);
  });

  it("returns 404 for an absent handler export", () => {
    expect(code.modules[code.mainModule]).toMatch(/no backend handler/);
  });

  it("fail-closes to an allowlist of handler names before dispatch (@CharlieHelps)", () => {
    const main = code.modules[code.mainModule];
    expect(main).toMatch(/ALLOWED_HANDLERS/);
    expect(main).toMatch(/hasOwnProperty/);
    expect(main).toMatch(/invalid backend handler/);
    // the allowlist gate precedes the `handlers[handler]` lookup.
    expect(main.indexOf("ALLOWED_HANDLERS")).toBeLessThan(main.indexOf("handlers[handler]"));
  });

  it("build output pins globalOutbound null; the executor swaps in the db transport at invoke (B6)", () => {
    // Pure shaping stays null (no egress); WorkerLoaderBackendExecutor.invoke sets
    // globalOutbound to the host db transport when a db callback is wired — verified
    // by the routing tests below.
    expect(code.globalOutbound).toBeNull();
  });

  it("embeds policyVersion so it participates in the content hash", () => {
    const v1 = buildBackendWorkerCode({ module: "x", policyVersion: "v1" });
    const v2 = buildBackendWorkerCode({ module: "x", policyVersion: "v2" });
    expect(v1.modules[v1.mainModule]).toContain("policy=v1");
    expect(v2.modules[v2.mainModule]).toContain("policy=v2");
    expect(v1.modules[v1.mainModule]).not.toBe(v2.modules[v2.mainModule]);
  });

  // B3: per-vibe identity is baked into the hashed main (tenant partition + an
  // unspoofable ctx.appInfo).
  it("bakes the vibe identity into main and varies it by (owner, slug)", () => {
    const a = buildBackendWorkerCode({ module: "x", vibe: { ownerHandle: "alice", appSlug: "todo" } });
    const b = buildBackendWorkerCode({ module: "x", vibe: { ownerHandle: "bob", appSlug: "todo" } });
    expect(a.modules[a.mainModule]).toContain('"ownerHandle":"alice"');
    expect(a.modules[a.mainModule]).toContain("appInfo: VIBE");
    // Different vibe ⇒ different main ⇒ different content hash ⇒ different isolate.
    expect(a.modules[a.mainModule]).not.toBe(b.modules[b.mainModule]);
  });

  it("encodes (owner, slug) unambiguously — no aliasing across the split boundary", () => {
    // {owner:"a",slug:"bc"} must not collide with {owner:"ab",slug:"c"}.
    const x = buildBackendWorkerCode({ module: "x", vibe: { ownerHandle: "a", appSlug: "bc" } });
    const y = buildBackendWorkerCode({ module: "x", vibe: { ownerHandle: "ab", appSlug: "c" } });
    expect(x.modules[x.mainModule]).not.toBe(y.modules[y.mainModule]);
  });

  it("with no vibe, appInfo is null (B1 library-callers / unchanged behavior)", () => {
    const code = buildBackendWorkerCode({ module: "x" });
    expect(code.modules[code.mainModule]).toContain("const VIBE = null;");
  });

  it("ctx.db is wired to the host globalOutbound transport (B6); ctx.secrets still throws (B7)", () => {
    const main = buildBackendWorkerCode({ module: "x" }).modules[buildBackendWorkerCode({ module: "x" }).mainModule];
    // ctx.db is constructed from the per-invocation nonce, no longer a throwing getter.
    expect(main).toContain("db: makeDb(trigger, dbNonce)");
    // ctx.db reaches the host by POSTing to the internal db-op URL (routed through
    // globalOutbound), not an env binding (env is structured-cloned).
    expect(main).toContain("https://db.internal/op");
    expect(main).not.toMatch(/get db\(\)/);
    // secrets remains a throwing getter until B7.
    expect(main).toMatch(/get secrets\(\) \{ throw new Error\("ctx\.secrets is not available yet/);
  });

  it("embeds the binding-schema version so it participates in the content hash (Charlie watch-out)", () => {
    const main = buildBackendWorkerCode({ module: "x" }).modules[buildBackendWorkerCode({ module: "x" }).mainModule];
    expect(main).toMatch(/bindings=v1/);
  });

  it("ctx.db.put/delete require a db and post a typed op with the nonce (unforgeable)", () => {
    const main = buildBackendWorkerCode({ module: "x" }).modules[buildBackendWorkerCode({ module: "x" }).mainModule];
    // put/delete post a typed op wrapped with the per-invocation nonce; default db
    // comes from the trigger.
    expect(main).toMatch(/kind: "put"/);
    expect(main).toMatch(/kind: "delete"/);
    expect(main).toMatch(/requires a db name/);
    expect(main).toContain("nonce: dbNonce");
  });
});

interface FakeLoader {
  binding: WorkerLoaderBinding;
  calls: { id: string; code: unknown }[];
  requests: { handler: string; trigger: { userHandle?: string | null } }[];
}

function fakeLoader(responseHeaders?: Record<string, string>): FakeLoader {
  const calls: FakeLoader["calls"] = [];
  const requests: FakeLoader["requests"] = [];
  const binding: WorkerLoaderBinding = {
    get(id, factory) {
      const code = factory();
      calls.push({ id, code: code as unknown });
      return {
        getEntrypoint() {
          return {
            fetch: async (req: Request) => {
              const body = (await req.json()) as FakeLoader["requests"][number];
              requests.push(body);
              return new Response(JSON.stringify({ ok: true, handler: body.handler }), {
                status: 200,
                headers: { "content-type": "application/json", ...responseHeaders },
              });
            },
          };
        },
      };
    },
  };
  return { binding, calls, requests };
}

describe("WorkerLoaderBackendExecutor.invoke (fake binding)", () => {
  it("drives get → getEntrypoint → fetch and returns the Response verbatim", async () => {
    const { binding, requests } = fakeLoader();
    const exec = new WorkerLoaderBackendExecutor(binding);
    const res = await exec.invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: { userHandle: "alice", payload: { url: "https://vibe.internal/oauth" } },
    });
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"handler":"fetch"');
    // handler travels in the request, not the code.
    expect(requests[0].handler).toBe("fetch");
  });

  // Codex P2: a fetch handler's response headers (Location, Set-Cookie,
  // content-type) must survive to the B3 `_api` route — invoke returns the
  // Response verbatim rather than decomposing to status/body.
  it("preserves fetch handler response headers (no silent drop)", async () => {
    const { binding } = fakeLoader({ location: "https://example.com/next", "set-cookie": "sid=abc" });
    const res = await new WorkerLoaderBackendExecutor(binding).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: { payload: {} },
    });
    expect(res.headers.get("location")).toBe("https://example.com/next");
    expect(res.headers.get("set-cookie")).toBe("sid=abc");
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  // @CharlieHelps acceptance matrix (a): same code + different trigger identities ⇒ same loader id.
  it("(a) same source + different trigger identities ⇒ same loader id", async () => {
    const f = fakeLoader();
    const exec = new WorkerLoaderBackendExecutor(f.binding);
    await exec.invoke({ source: SONOS_BACKEND, handler: "scheduled", trigger: { userHandle: "alice" } });
    await exec.invoke({ source: SONOS_BACKEND, handler: "onChange", trigger: { userHandle: "bob" } });
    expect(f.calls[0].id).toBe(f.calls[1].id);
    expect(f.calls[0].id.length).toBeGreaterThan(0);
  });

  // @CharlieHelps acceptance matrix (b): no cross-invocation identity bleed —
  // the hashed WorkerCode carries no trigger identity; the request does.
  it("(b) no identity bleed: identity is in the request, never the WorkerCode", async () => {
    const f = fakeLoader();
    const exec = new WorkerLoaderBackendExecutor(f.binding);
    await exec.invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: { userHandle: "alice-secret-handle", sourceTag: "tag-xyz", depth: 2 },
    });
    const code = JSON.stringify(f.calls[0].code);
    expect(code).not.toContain("alice-secret-handle");
    expect(code).not.toContain("tag-xyz");
    expect(f.requests[0].trigger.userHandle).toBe("alice-secret-handle");
  });

  // B3 tenant boundary: two different vibes with byte-identical backend.js get
  // DIFFERENT isolate ids — no cross-vibe isolate sharing.
  it("(b2) different vibes with identical source ⇒ different loader ids", async () => {
    const f1 = fakeLoader();
    const f2 = fakeLoader();
    await new WorkerLoaderBackendExecutor(f1.binding, { vibe: { ownerHandle: "alice", appSlug: "todo" } }).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
    });
    await new WorkerLoaderBackendExecutor(f2.binding, { vibe: { ownerHandle: "bob", appSlug: "todo" } }).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
    });
    expect(f1.calls[0].id).not.toBe(f2.calls[0].id);
  });

  it("(b3) same vibe + identical source ⇒ same loader id (isolate reuse)", async () => {
    const f = fakeLoader();
    const vibe = { ownerHandle: "alice", appSlug: "todo" };
    await new WorkerLoaderBackendExecutor(f.binding, { vibe }).invoke({ source: SONOS_BACKEND, handler: "fetch", trigger: {} });
    await new WorkerLoaderBackendExecutor(f.binding, { vibe }).invoke({
      source: SONOS_BACKEND,
      handler: "scheduled",
      trigger: {},
    });
    expect(f.calls[0].id).toBe(f.calls[1].id);
  });

  // B6: the host db callback is reached through the stable `globalOutbound`
  // transport, correlated by the per-invocation `dbNonce` the executor mints. This
  // loader models the isolate's `ctx.db.put` doing `fetch("https://db.internal/op",
  // { nonce, op })` — routed through `globalOutbound` — using the nonce from the
  // request body: the real path.
  function dbRoutingLoader(op: unknown) {
    const cache = new Map<string, WorkerCode>(); // models get(id, factory) caching first per id
    const calls: { id: string; warm: boolean }[] = [];
    const binding: WorkerLoaderBinding = {
      get(id, factory) {
        const warm = cache.has(id);
        let code = cache.get(id);
        if (!code) {
          code = factory() as WorkerCode;
          cache.set(id, code);
        }
        calls.push({ id, warm });
        const outbound = code.globalOutbound as { fetch: (r: Request) => Promise<Response> } | null | undefined;
        return {
          getEntrypoint() {
            return {
              fetch: async (req: Request) => {
                const { dbNonce } = (await req.json()) as { dbNonce?: string };
                if (!outbound) throw new Error("expected a globalOutbound transport");
                // Isolate posts the op wrapped with ITS nonce — never the identity.
                const r = await outbound.fetch(
                  new Request("https://db.internal/op", { method: "POST", body: JSON.stringify({ nonce: dbNonce, op }) })
                );
                return new Response(JSON.stringify(await r.json()), { status: 200 });
              },
            };
          },
        };
      },
    };
    return { binding, calls };
  }

  it("routes a ctx.db op to the host callback via the per-invocation nonce", async () => {
    const seen: unknown[] = [];
    const f = dbRoutingLoader({ kind: "put", db: "todos", doc: { t: 1 }, docId: null });
    const res = await new WorkerLoaderBackendExecutor(f.binding).invoke({
      source: SONOS_BACKEND,
      handler: "onChange",
      trigger: {},
      db: async (o) => {
        seen.push(o);
        return { ok: true, id: "doc-1" };
      },
    });
    expect(JSON.parse(await res.text())).toEqual({ ok: true, id: "doc-1" });
    expect(seen[0]).toEqual({ kind: "put", db: "todos", doc: { t: 1 }, docId: null });
  });

  // Charlie's warm-isolate regression: a reused isolate (same id, `globalOutbound`
  // captured at first load) must NOT bleed identity/depth. Two invocations of the
  // SAME source with DIFFERENT callbacks — the second hits the warm cached
  // transport, yet its ctx.db op must route to ITS OWN callback, not the first's.
  it("no identity/depth bleed across a warm (reused) isolate", async () => {
    const f = dbRoutingLoader({ kind: "put", db: "d", doc: {}, docId: null });
    // Distinct callbacks stand in for distinct trigger identities/depths.
    const res1 = await new WorkerLoaderBackendExecutor(f.binding).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
      db: async () => ({ ok: true, id: "writer-A" }),
    });
    const res2 = await new WorkerLoaderBackendExecutor(f.binding).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
      db: async () => ({ ok: true, id: "writer-B" }),
    });
    expect(f.calls[1].warm).toBe(true); // isolate was reused (same id), globalOutbound captured at first load
    expect(JSON.parse(await res1.text()).id).toBe("writer-A");
    expect(JSON.parse(await res2.text()).id).toBe("writer-B"); // routed to B's callback, not A's
  });

  // globalOutbound is excluded from the isolate hash: the same source with a
  // different db callback instance must reuse the same isolate id (no fragmentation).
  it("globalOutbound transport is excluded from the isolate id (no cache fragmentation)", async () => {
    const f = fakeLoader();
    const exec = new WorkerLoaderBackendExecutor(f.binding);
    await exec.invoke({ source: SONOS_BACKEND, handler: "fetch", trigger: {}, db: async () => ({ ok: true, id: "a" }) });
    await exec.invoke({ source: SONOS_BACKEND, handler: "fetch", trigger: {}, db: async () => ({ ok: true, id: "b" }) });
    await exec.invoke({ source: SONOS_BACKEND, handler: "fetch", trigger: {} }); // no db at all
    expect(f.calls[0].id).toBe(f.calls[1].id);
    expect(f.calls[1].id).toBe(f.calls[2].id);
  });

  // @CharlieHelps acceptance matrix (c): a policy/binding-schema bump ⇒ new id.
  it("(c) a policyVersion bump forces a new loader id", async () => {
    const f1 = fakeLoader();
    const f2 = fakeLoader();
    await new WorkerLoaderBackendExecutor(f1.binding, { policyVersion: "v1" }).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
    });
    await new WorkerLoaderBackendExecutor(f2.binding, { policyVersion: "v2" }).invoke({
      source: SONOS_BACKEND,
      handler: "fetch",
      trigger: {},
    });
    expect(f1.calls[0].id).not.toBe(f2.calls[0].id);
  });
});
