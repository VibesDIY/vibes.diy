// #2802 slice 4 — renderVibe end-to-end SSR test (CharlieHelps follow-up
// condition on PR #2843, tracked in #2845). This drives the REAL serve path
// (`cfServe` → `serv-entry-point` → `render-vibe.ts`) and asserts SSR injection
// through the actual handler, not the pure `attemptVibeSsr`/`VibePage` units the
// merged slice-4 PRs already cover.
//
// The live route bars `node` for security (in-process Node privileges on
// untrusted vibe source) and admits ONLY the isolate-backed `loader` executor.
// The beta `env.LOADER` binding is absent from CI, so this injects a fake
// `WorkerLoaderBinding` through the additive, default-off `ssrLoader` hook on
// `createVibeDiyTestCtx` (which also flips `VIBES_SSR=loader` in the env map and
// populates `params.vibes.loader`). The fake isolate echoes a fixed body from
// `getEntrypoint().fetch()`, exactly like the slice-2 fake-binding tests.
//
// Assertions (per the design doc "Slice 4 → Tests" + #2845 checklist item):
//   (a) single-file App.jsx → served HTML carries `data-vibe-ssr` + the fake
//       isolate body inside `vibe-app-container`;
//   (b) HEAD → no executor work (loader never invoked) + empty body;
//   (c) renderPendingVibe → no marker, executor never invoked;
//   (d) multi-file vibe (entry imports a resolvable sibling) → SSRs through the
//       resolved relative-import graph (#2845 cb6);
//   (e) entry importing an UNRESOLVABLE sibling → client-only fallback.

import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { calcEntryPointUrl, CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk, type WorkerLoaderBinding } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// The body the fake isolate "renders". render-vibe injects this verbatim via
// dangerouslySetInnerHTML, so it lands raw in the served HTML.
const FAKE_ISOLATE_BODY = "<main>e2e-ssr-isolate-body</main>";

// A fake env.LOADER binding that records every isolate `get` so a test can
// assert the executor did (or did NOT) run, and echoes FAKE_ISOLATE_BODY from
// the entrypoint fetch — the slice-2 fake-binding shape.
function makeFakeLoader(): { binding: WorkerLoaderBinding; getCalls: string[] } {
  const getCalls: string[] = [];
  const binding: WorkerLoaderBinding = {
    get(id: string) {
      getCalls.push(id);
      return {
        getEntrypoint() {
          return { fetch: async () => new Response(FAKE_ISOLATE_BODY) };
        },
      };
    },
  };
  return { binding, getCalls };
}

describe("renderVibe end-to-end SSR (loader executor, fake binding)", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let api: VibesDiyApi;
  let getCalls: string[];

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const fake = makeFakeLoader();
    getCalls = fake.getCalls;
    // ssrLoader is the additive, default-off hook: it sets VIBES_SSR=loader and
    // populates params.vibes.loader so the live route runs the loader executor.
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { ssrLoader: fake.binding });
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({ client: wsPair.p1, server: wsPair.p2 }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });
  });

  async function ensureApp(content: string): Promise<{ appSlug: string; ownerHandle: string; fsId: string }> {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content }],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return a ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, ownerHandle: res.ownerHandle, fsId: res.fsId };
  }

  function entryUrl(bindings: { appSlug: string; ownerHandle: string; fsId?: string }): string {
    return calcEntryPointUrl({ hostnameBase: ".nowhere", protocol: "http", port: "4711", bindings });
  }

  it("(a) single-file App.jsx → served HTML injects data-vibe-ssr + the isolate body in vibe-app-container", async () => {
    const app = await ensureApp(`export default function App() { return <div>e2e ssr app</div>; }`);

    const before = getCalls.length;
    const resIframe = await api.cfg.fetch(entryUrl(app));
    expect(resIframe.status).toBe(200);
    const html = await resIframe.text();

    // The hydrate marker AND the isolate body land on the mount container.
    expect(html).toContain("data-vibe-ssr");
    expect(html).toContain("e2e-ssr-isolate-body");
    expect(html).toMatch(/class="vibe-app-container"[^>]*data-vibe-ssr[^>]*>.*e2e-ssr-isolate-body/s);
    // The loader executor actually ran (the fake isolate was instantiated).
    expect(getCalls.length).toBeGreaterThan(before);
  });

  it("(b) HEAD → no executor work and an empty body", async () => {
    const app = await ensureApp(`export default function App() { return <div>head ssr app</div>; }`);

    const before = getCalls.length;
    const res = await api.cfg.fetch(new Request(entryUrl(app), { method: "HEAD" }));
    expect(res.status).toBe(200);
    // HEAD short-circuits the SSR attempt entirely (render-vibe.ts skips it for
    // method === "HEAD"), so the isolate is never spun up …
    expect(getCalls.length).toBe(before);
    // … and the body is empty (no marker, no payload).
    const body = await res.text();
    expect(body).toBe("");
  });

  it("(c) renderPendingVibe (no apps row) → no marker, executor never invoked", async () => {
    // A slug pair that was never published has no apps row, so the root path
    // renders the pending shell — which must never run the executor or emit the
    // SSR marker (regression guard: SSR is published-render only).
    const id = sthis.nextId(8).str.toLowerCase();
    const before = getCalls.length;
    const res = await api.cfg.fetch(entryUrl({ appSlug: `pending-${id}`, ownerHandle: `pending-owner-${id}` }));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="vibe-app-container"');
    expect(html).not.toContain("data-vibe-ssr");
    expect(getCalls.length).toBe(before);
  });

  it("(d) multi-file vibe (entry imports a sibling) → SSRs through the resolved graph (#2845 cb6)", async () => {
    // App.jsx imports a sibling that IS in the fsItems, so attemptVibeSsr resolves
    // the whole relative-import graph and ships it to the isolate — no longer the
    // single-file-only client-only fallback. The convention entry is still the
    // single /App.jsx (selectConventionEntry only matches /App.{jsx,tsx}).
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `import { Badge } from "./Badge.jsx"; export default function App() { return <div><Badge /></div>; }`,
        },
        {
          type: "code-block",
          lang: "jsx",
          filename: "/Badge.jsx",
          content: `export function Badge() { return <span>badge</span>; }`,
        },
      ],
    });
    const res0 = rRes.Ok();
    if (!isResEnsureAppSlugOk(res0)) {
      assert.fail("Expected ensureAppSlug to return a ResEnsureAppSlugOk");
    }
    const app = { appSlug: res0.appSlug, ownerHandle: res0.ownerHandle, fsId: res0.fsId };

    const before = getCalls.length;
    const res = await api.cfg.fetch(entryUrl(app));
    expect(res.status).toBe(200);
    const html = await res.text();
    // The graph resolved, so the isolate ran and the marker + body were injected.
    expect(html).toContain("data-vibe-ssr");
    expect(html).toContain("e2e-ssr-isolate-body");
    expect(getCalls.length).toBeGreaterThan(before);
  });

  it("(e) entry importing an unresolvable sibling → client-only fallback (no marker, executor untouched)", async () => {
    // The sibling /Missing.jsx is NOT in the fsItems, so the graph can't resolve;
    // attemptVibeSsr degrades to client-only (relative_import_unsupported) before
    // instantiating the isolate rather than shipping a broken module graph.
    const app = await ensureApp(`import { X } from "./Missing.jsx"; export default function App() { return <div><X /></div>; }`);

    const before = getCalls.length;
    const res = await api.cfg.fetch(entryUrl(app));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="vibe-app-container"');
    expect(html).not.toContain("data-vibe-ssr");
    expect(html).not.toContain("e2e-ssr-isolate-body");
    expect(getCalls.length).toBe(before);
  });
});
