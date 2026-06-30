// Slice B3 (#2856): attemptBackendFetch — the never-throw core of the `_api`
// request path. Drives a real pushed vibe (selectLatestAppPerSlug + storage) and a
// FAKE Worker Loader binding (env.LOADER is open-beta, absent from CI), asserting
// the release-scoped gate, the per-vibe isolate identity, and the 404 fallbacks.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { attemptBackendFetch } from "@vibes.diy/api-svc/intern/attempt-backend-fetch.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const APP_JSX = { type: "code-block" as const, lang: "jsx", filename: "/App.jsx", content: "function App(){return null;} App();" };
const backendFile = (content: string) => ({ type: "code-block" as const, lang: "js", filename: "/backend.js", content });

const FETCH_BACKEND = `
export async function fetch(request, ctx) { return new Response("hi from backend"); }
`;
const SCHEDULED_ONLY_BACKEND = `
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "15m" } };
`;

interface FakeLoader {
  binding: WorkerLoaderBinding;
  calls: { id: string; code: unknown }[];
  requests: { handler: string; trigger: { userHandle?: string | null; payload?: { url?: string; method?: string } } }[];
}
function fakeLoader(): FakeLoader {
  const calls: FakeLoader["calls"] = [];
  const requests: FakeLoader["requests"] = [];
  const binding: WorkerLoaderBinding = {
    get(id, factory) {
      calls.push({ id, code: factory() as unknown });
      return {
        getEntrypoint() {
          return {
            fetch: async (req: Request) => {
              const body = (await req.json()) as FakeLoader["requests"][number];
              requests.push(body);
              return new Response(`echo:${body.handler}`, { status: 200, headers: { "x-from": "isolate" } });
            },
          };
        },
      };
    },
  };
  return { binding, calls, requests };
}

async function setupCtx() {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA);
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

describe("attemptBackendFetch (#2856 B3)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;

  // Push a vibe (optionally with a backend.js) and return its (ownerHandle, appSlug).
  const pushVibe = async (appSlug: string, backendSource?: string) => {
    const fileSystem = backendSource ? [APP_JSX, backendFile(backendSource)] : [APP_JSX];
    const r = await ownerApi.ensureAppSlug({ mode: "dev", appSlug, ownerHandle, fileSystem });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), `push ${appSlug} failed`);
  };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 912 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });
    const r = await ownerApi.ensureAppSlug({ mode: "dev", fileSystem: [APP_JSX] });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("bootstrap app failed");
    ownerHandle = res.ownerHandle;
  }, 30000);

  it("runs the fetch handler of the selected release and returns its Response verbatim", async () => {
    const appSlug = "bf-fetch";
    await pushVibe(appSlug, FETCH_BACKEND);
    const f = fakeLoader();
    const out = await attemptBackendFetch(appCtx.vibesCtx, {
      ownerHandle,
      appSlug,
      request: new Request("https://vibe.internal/webhooks/x", { method: "POST", body: "{}" }),
      userHandle: "alice",
      backendJs: "loader",
      loader: f.binding,
    });
    assert(out.reason === "ok", `expected ok, got ${out.reason}`);
    expect(out.response.status).toBe(200);
    expect(out.response.headers.get("x-from")).toBe("isolate");
    expect(await out.response.text()).toBe("echo:fetch");
    // the dispatched handler + identity rode the request; the source reached the loader.
    expect(f.requests[0].handler).toBe("fetch");
    expect(f.requests[0].trigger.userHandle).toBe("alice");
    expect(JSON.stringify(f.calls[0].code)).toContain("hi from backend");
  });

  it("is dark when BACKEND_JS=off → backend_disabled", async () => {
    const appSlug = "bf-off";
    await pushVibe(appSlug, FETCH_BACKEND);
    const out = await attemptBackendFetch(appCtx.vibesCtx, {
      ownerHandle,
      appSlug,
      request: new Request("https://vibe.internal/"),
      backendJs: "off",
    });
    expect(out.reason).toBe("backend_disabled");
  });

  it("404s when the selected release has no /backend.js → no_backend_file", async () => {
    const appSlug = "bf-nobackend";
    await pushVibe(appSlug); // App.jsx only
    const out = await attemptBackendFetch(appCtx.vibesCtx, {
      ownerHandle,
      appSlug,
      request: new Request("https://vibe.internal/"),
      backendJs: "loader",
      loader: fakeLoader().binding,
    });
    expect(out.reason).toBe("no_backend_file");
  });

  it("404s when /backend.js exports no fetch (scheduled-only) → no_fetch_handler", async () => {
    const appSlug = "bf-schedonly";
    await pushVibe(appSlug, SCHEDULED_ONLY_BACKEND);
    const f = fakeLoader();
    const out = await attemptBackendFetch(appCtx.vibesCtx, {
      ownerHandle,
      appSlug,
      request: new Request("https://vibe.internal/"),
      backendJs: "loader",
      loader: f.binding,
    });
    expect(out.reason).toBe("no_fetch_handler");
    // gate short-circuits before the isolate spins up.
    expect(f.calls.length).toBe(0);
  });

  it("404s for an unknown (owner, slug) → no_release", async () => {
    const out = await attemptBackendFetch(appCtx.vibesCtx, {
      ownerHandle,
      appSlug: "does-not-exist",
      request: new Request("https://vibe.internal/"),
      backendJs: "loader",
      loader: fakeLoader().binding,
    });
    expect(out.reason).toBe("no_release");
  });
});
