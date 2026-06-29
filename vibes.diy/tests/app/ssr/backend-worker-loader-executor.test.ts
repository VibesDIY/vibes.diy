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
import { type WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";

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
    expect(main).toMatch(/async fetch\(request\)/);
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

  it("pins globalOutbound to null (B8 replaces it with the egress proxy)", () => {
    expect(code.globalOutbound).toBeNull();
  });

  it("embeds policyVersion so it participates in the content hash", () => {
    const v1 = buildBackendWorkerCode({ module: "x", policyVersion: "v1" });
    const v2 = buildBackendWorkerCode({ module: "x", policyVersion: "v2" });
    expect(v1.modules[v1.mainModule]).toContain("policy=v1");
    expect(v2.modules[v2.mainModule]).toContain("policy=v2");
    expect(v1.modules[v1.mainModule]).not.toBe(v2.modules[v2.mainModule]);
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
