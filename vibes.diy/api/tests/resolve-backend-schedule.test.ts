// Slice B4 (#2856): resolveBackendSchedule — the scheduled interval the BackendDO
// arms its alarm from, read fresh from the selected release. Driven against a real
// pushed vibe (selectLatestAppPerSlug + storage), no isolate needed.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { resolveBackendSchedule } from "@vibes.diy/api-svc/intern/load-selected-backend.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const APP_JSX = { type: "code-block" as const, lang: "jsx", filename: "/App.jsx", content: "function App(){return null;} App();" };
const backendFile = (content: string) => ({ type: "code-block" as const, lang: "js", filename: "/backend.js", content });

const SCHED_15M = `
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "15m" } };
`;
const FETCH_ONLY = `export async function fetch(request, ctx) { return new Response("ok"); }`;

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

describe("resolveBackendSchedule (#2856 B4)", { timeout: 30000 }, () => {
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
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 918 });
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

  it("returns the validated interval for a scheduled backend", async () => {
    await pushVibe("sched-15m", SCHED_15M);
    expect(await resolveBackendSchedule(appCtx.vibesCtx, ownerHandle, "sched-15m")).toBe(900_000);
  });

  it("returns null for a fetch-only backend (no scheduled export)", async () => {
    await pushVibe("sched-fetchonly", FETCH_ONLY);
    expect(await resolveBackendSchedule(appCtx.vibesCtx, ownerHandle, "sched-fetchonly")).toBeNull();
  });

  it("returns null when the release has no /backend.js", async () => {
    await pushVibe("sched-nobackend");
    expect(await resolveBackendSchedule(appCtx.vibesCtx, ownerHandle, "sched-nobackend")).toBeNull();
  });

  it("returns null for an unknown (owner, slug)", async () => {
    expect(await resolveBackendSchedule(appCtx.vibesCtx, ownerHandle, "does-not-exist")).toBeNull();
  });
});
