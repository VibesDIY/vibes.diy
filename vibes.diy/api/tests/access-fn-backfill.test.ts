import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS_V1 = `export function chat(doc, oldDoc, user, ctx) {
  return { channels: ["general"], allowAnonymous: true };
}`;

const ACCESS_JS_V2 = `export function chat(doc, oldDoc, user, ctx) {
  return { channels: ["updated"], allowAnonymous: true };
}`;

interface InvokeRecorder {
  calls: { cid: string; doc: unknown; user: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user });
      return recorder.result;
    },
  });
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

async function mkUser(
  sthis: ReturnType<typeof ensureSuperThis>,
  deviceCA: Awaited<ReturnType<typeof createTestDeviceCA>>,
  wsPair: ReturnType<typeof TestWSPair.create>,
  seqOffset: number
) {
  const user = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });
  return { user, api };
}

describe("backfill AccessFnOutputs on access.js push (#2101)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = {
    calls: [],
    result: { channels: ["general"], allowAnonymous: true },
  };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 800);
    ownerApi = ownerSetup.api;

    // Create app WITHOUT access.js first
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" }],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Manually seed AccessFunctionBindings so putDoc writes go through the gate
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.accessFunctionBindings).values({
      userSlug: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: "pre-seed-cid",
      updated: new Date().toISOString(),
    });

    // Write docs through the access fn gate
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-1" } });
    assert(r1.isOk(), "putDoc 1 failed");
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-2" } });
    assert(r2.isOk(), "putDoc 2 failed");
    const r3 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-3" } });
    assert(r3.isOk(), "putDoc 3 failed");

    // Delete the pre-seed binding and outputs so we start clean for backfill tests
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFunctionBindings)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.appSlug, appSlug)
        )
      );
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );

    recorder.calls = [];
  }, 30000);

  it("backfills AccessFnOutputs when access.js is first pushed", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["general"], allowAnonymous: true };

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V1 },
      ],
    });
    assert(r.isOk(), "ensureAppSlug with access.js failed");

    // invokeAccessFn called for each existing doc (user=null for backfill)
    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(3);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(3);
    for (const row of rows) {
      const output = JSON.parse(row.output);
      expect(output.channels).toEqual(["general"]);
      expect(output.allowAnonymous).toBe(true);
      expect(row.hasGrants).toBe(0);
    }
  });

  it("skips backfill on idempotent re-push (same CID)", async () => {
    recorder.calls = [];

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V1 },
      ],
    });
    assert(r.isOk(), "re-push failed");

    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(0);
  });

  it("re-backfills on access.js update (new CID)", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["updated"], allowAnonymous: true };

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V2 },
      ],
    });
    assert(r.isOk(), "update push failed");

    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(3);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(3);
    for (const row of rows) {
      const output = JSON.parse(row.output);
      expect(output.channels).toEqual(["updated"]);
    }
  });

  it("skips docs where access fn returns forbidden", async () => {
    // Clean slate
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFunctionBindings)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.appSlug, appSlug)
        )
      );

    recorder.calls = [];
    let callCount = 0;
    appCtx.vibesCtx.invokeAccessFn = async (params) => {
      callCount++;
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user });
      if (callCount === 2) return { forbidden: "denied" };
      return { channels: ["general"], allowAnonymous: true };
    };

    const ACCESS_JS_V3 = `export function chat(doc, oldDoc, user, ctx) {
      return { channels: ["v3"], allowAnonymous: true };
    }`;

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V3 },
      ],
    });
    assert(r.isOk(), "push failed");

    expect(recorder.calls.length).toBeGreaterThanOrEqual(3);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(2);
  });
});
