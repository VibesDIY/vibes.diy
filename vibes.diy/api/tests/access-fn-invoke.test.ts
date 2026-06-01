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

// Integration tests for the access-function gate in putDocEvento.
// A mock invokeAccessFn stands in for the AccessFnDO so we exercise the
// handler's gate logic without a real Durable Object. An
// AccessFunctionBindings row must exist for the (ownerHandle, appSlug, dbName)
// or the gate is skipped entirely.
//
// See vibes.diy/api/svc/public/app-documents.ts putDocEvento.

const CID = "test-access-fn-cid";

// Records the arg the mock was last called with, plus the response it returns.
interface InvokeRecorder {
  calls: { cid: string; user: unknown; grantState?: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, user: params.user, grantState: params.grantState });
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

async function seedBinding(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  binding: { ownerHandle: string; appSlug: string; dbName: string }
) {
  await ctx.vibesCtx.sql.db.insert(ctx.vibesCtx.sql.tables.accessFunctionBindings).values({
    userSlug: binding.ownerHandle,
    appSlug: binding.appSlug,
    dbName: binding.dbName,
    accessFnCid: CID,
    updated: new Date().toISOString(),
  });
}

describe("invokeAccessFn gate (integration — mock invoker)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = { calls: [], result: { allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 800);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
    await seedBinding(appCtx, { ownerHandle, appSlug, dbName: "default" });
  }, 30000);

  it("authenticated write passes when invokeAccessFn allows it", async () => {
    recorder.calls = [];
    recorder.result = { allowAnonymous: true };
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "auth write" },
    });
    expect(res.isOk()).toBe(true);
    // The gate invoked the mock with the binding's CID and a non-null user.
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(CID);
    expect(recorder.calls[0]?.user).not.toBeNull();
  });

  it("write rejected when invokeAccessFn returns { forbidden }", async () => {
    recorder.calls = [];
    recorder.result = { forbidden: "custom deny" };
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "should be denied" },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toBe("custom deny");
    expect(recorder.calls.length).toBe(1);
  });

  it("stores AccessFnOutputs row after successful access fn evaluation", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["public"], allowAnonymous: true };
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "output storage test" },
    });
    expect(res.isOk()).toBe(true);
    const putRes = res.Ok();
    expect(putRes.status).toBe("ok");

    // Query the accessFnOutputs table for the row
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.userSlug, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, "default"),
          eq(tOutputs.docId, putRes.id)
        )
      );

    expect(rows.length).toBe(1);
    const row = rows[0];
    assert(row !== undefined, "expected one AccessFnOutputs row");
    expect(row.fnCid).toBe(CID);
    expect(row.hasGrants).toBe(0);
    const output = JSON.parse(row.output) as { channels: string[]; allowAnonymous: boolean };
    expect(output.channels).toEqual(["public"]);
    expect(output.allowAnonymous).toBe(true);
    expect(recorder.calls.length).toBe(1);
  });
});
