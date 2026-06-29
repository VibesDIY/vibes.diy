// Slice B2b (#2856): push-time discovery persists a BackendFunctionBindings row,
// updates it on re-push, removes it when backend.js is dropped, and rejects a push
// whose config.scheduled.interval is out of bounds — all driven end-to-end through
// ensureAppSlug against a real test DB.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const APP_JSX = { type: "code-block" as const, lang: "jsx", filename: "/App.jsx", content: "function App(){return null;} App();" };

const backendFile = (content: string) => ({ type: "code-block" as const, lang: "js", filename: "/backend.js", content });

const BACKEND_FETCH_SCHED_5M = `
export async function fetch(request, ctx) { return new Response("ok"); }
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "5m" } };
`;

const BACKEND_SCHED_15M = `
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "15m" } };
`;

const BACKEND_BAD_INTERVAL = `
export async function scheduled(event, ctx) {}
export const config = { scheduled: { interval: "1s" } };
`;

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

describe("BackendFunctionBindings discovery on backend.js push (#2856 B2b)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  const bindingRows = () => {
    const tBfb = appCtx.vibesCtx.sql.tables.backendFunctionBindings;
    return appCtx.vibesCtx.sql.db
      .select()
      .from(tBfb)
      .where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)));
  };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const user = await createTestUser({ sthis, deviceCA, seqUserId: 905 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });

    const r = await ownerApi.ensureAppSlug({ mode: "dev", fileSystem: [APP_JSX] });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
  }, 30000);

  it("registers handlers + interval when backend.js is first pushed", async () => {
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [APP_JSX, backendFile(BACKEND_FETCH_SCHED_5M)],
    });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), "push with backend.js failed");

    const rows = await bindingRows();
    expect(rows.length).toBe(1);
    expect(JSON.parse(rows[0].handlers)).toEqual(["fetch", "scheduled"]);
    expect(rows[0].intervalMs).toBe(300_000);
    expect(rows[0].backendCid).toBeTruthy();
  });

  it("updates the interval on re-push", async () => {
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [APP_JSX, backendFile(BACKEND_SCHED_15M)],
    });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), "re-push failed");

    const rows = await bindingRows();
    expect(rows.length).toBe(1);
    expect(JSON.parse(rows[0].handlers)).toEqual(["scheduled"]);
    expect(rows[0].intervalMs).toBe(900_000);
  });

  it("removes the binding when backend.js is dropped", async () => {
    const r = await ownerApi.ensureAppSlug({ mode: "dev", appSlug, fileSystem: [APP_JSX] });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), "push without backend.js failed");

    const rows = await bindingRows();
    expect(rows.length).toBe(0);
  });

  it("rejects a push with a sub-5s interval and writes no binding", async () => {
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [APP_JSX, backendFile(BACKEND_BAD_INTERVAL)],
    });
    // The transport surfaces a server `res-error` (app-slug-invalid) as Result.Err.
    expect(r.isErr()).toBe(true);
    expect(r.Err()).toMatchObject({ error: { code: "app-slug-invalid" } });
    const errStr = JSON.stringify(r.Err());
    expect(errStr).toMatch(/backend\.js/);
    expect(errStr).toMatch(/5s minimum/);

    // No binding written by the rejected push (still empty from the previous test).
    const rows = await bindingRows();
    expect(rows.length).toBe(0);
  });

  // Codex P2: only the reserved top-level /backend.js is the app backend — a nested
  // /src/backend.js is just a regular file, so even a bad interval there is ignored.
  it("ignores a nested /src/backend.js (not the app backend)", async () => {
    const nested = { type: "code-block" as const, lang: "js", filename: "/src/backend.js", content: BACKEND_BAD_INTERVAL };
    const r = await ownerApi.ensureAppSlug({ mode: "dev", appSlug, fileSystem: [APP_JSX, nested] });
    assert(r.isOk() && isResEnsureAppSlugOk(r.Ok()), "nested backend.js should not reject the push");

    const rows = await bindingRows();
    expect(rows.length).toBe(0);
  });
});
