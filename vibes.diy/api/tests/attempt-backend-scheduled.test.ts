// Slice B4 (#2856): attemptBackendScheduled — one scheduled tick against a real
// pushed vibe + a fake Worker Loader binding.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { attemptBackendScheduled } from "@vibes.diy/api-svc/intern/attempt-backend-scheduled.js";
import { type WorkerLoaderBinding } from "@vibes.diy/vibe-runtime/worker-loader-executor.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const APP_JSX = { type: "code-block" as const, lang: "jsx", filename: "/App.jsx", content: "function App(){return null;} App();" };
const backendFile = (content: string) => ({ type: "code-block" as const, lang: "js", filename: "/backend.js", content });

const SCHED_BACKEND = `
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "15m" } };
`;
const FETCH_ONLY = `export async function fetch(request, ctx) { return new Response("ok"); }`;

interface FakeLoader {
  binding: WorkerLoaderBinding;
  requests: { handler: string; trigger: { userHandle?: string | null; payload?: { scheduledTime?: string } } }[];
}
// status drives the simulated isolate response: 204 = clean scheduled, 500 = handler throw.
function fakeLoader(status = 204): FakeLoader {
  const requests: FakeLoader["requests"] = [];
  const binding: WorkerLoaderBinding = {
    get(_id, factory) {
      factory();
      return {
        getEntrypoint() {
          return {
            fetch: async (req: Request) => {
              requests.push((await req.json()) as FakeLoader["requests"][number]);
              return new Response(null, { status });
            },
          };
        },
      };
    },
  };
  return { binding, requests };
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

describe("attemptBackendScheduled (#2856 B4)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;

  const pushVibe = async (appSlug: string, backendSource?: string) => {
    const fileSystem = backendSource ? [APP_JSX, backendFile(backendSource)] : [APP_JSX];
    const r = await ownerApi.ensureAppSlug({ mode: "dev", appSlug, ownerHandle, fileSystem });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), `push ${appSlug} failed`);
  };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 919 });
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

  it("runs the scheduled handler as the owner and reports ran:true", async () => {
    await pushVibe("sc-run", SCHED_BACKEND);
    const f = fakeLoader(204);
    const out = await attemptBackendScheduled(appCtx.vibesCtx, {
      ownerHandle,
      appSlug: "sc-run",
      scheduledTime: "2026-06-30T00:00:00Z",
      backendJs: "loader",
      loader: f.binding,
    });
    expect(out).toEqual({ ran: true });
    expect(f.requests[0].handler).toBe("scheduled");
    expect(f.requests[0].trigger.userHandle).toBe(ownerHandle);
    expect(f.requests[0].trigger.payload?.scheduledTime).toBe("2026-06-30T00:00:00Z");
  });

  it("is dark when BACKEND_JS=off → backend_disabled", async () => {
    await pushVibe("sc-off", SCHED_BACKEND);
    const out = await attemptBackendScheduled(appCtx.vibesCtx, {
      ownerHandle,
      appSlug: "sc-off",
      scheduledTime: "t",
      backendJs: "off",
    });
    expect(out).toEqual({ ran: false, reason: "backend_disabled" });
  });

  it("disarms (no_schedule) when the live release has no scheduled export", async () => {
    await pushVibe("sc-fetchonly", FETCH_ONLY);
    const out = await attemptBackendScheduled(appCtx.vibesCtx, {
      ownerHandle,
      appSlug: "sc-fetchonly",
      scheduledTime: "t",
      backendJs: "loader",
      loader: fakeLoader().binding,
    });
    expect(out).toEqual({ ran: false, reason: "no_schedule" });
  });

  it("surfaces a 5xx isolate response as a retryable handler_error", async () => {
    await pushVibe("sc-throw", SCHED_BACKEND);
    const out = await attemptBackendScheduled(appCtx.vibesCtx, {
      ownerHandle,
      appSlug: "sc-throw",
      scheduledTime: "t",
      backendJs: "loader",
      loader: fakeLoader(500).binding,
    });
    expect(out).toEqual({ ran: false, reason: "handler_error" });
  });
});
