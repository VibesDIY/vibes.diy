import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, type AccessDescriptor, type EvtViewerGrantsChanged } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Integration tests for the access-function gate in putDocEvento.
// A mock invokeAccessFn stands in for the AccessFnDO so we exercise the
// handler's gate logic without a real Durable Object. An
// AccessFunctionBindings row must exist for the (ownerHandle, appSlug, dbName)
// or the gate is skipped entirely.
//
// See vibes.diy/api/svc/public/app-documents.ts putDocEvento.

const ACCESS_JS_DEFAULT = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return { allowAnonymous: true };
}`;

// Records the arg the mock was last called with, plus the response it returns.
interface InvokeRecorder {
  calls: { cid: string; doc?: unknown; user: unknown; grantState?: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(
  recorder: InvokeRecorder,
  opts: { notifyViewerGrantsChanged?: (evt: EvtViewerGrantsChanged, senderConnId: string) => Promise<void> } = {}
) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user, grantState: params.grantState });
      return recorder.result;
    },
    notifyViewerGrantsChanged: opts.notifyViewerGrantsChanged,
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

describe("invokeAccessFn gate (integration — mock invoker)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let actualCid: string;
  const viewerGrantEvents: EvtViewerGrantsChanged[] = [];
  const recorder: InvokeRecorder = { calls: [], result: { allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder, {
      notifyViewerGrantsChanged: async (evt) => {
        viewerGrantEvents.push(evt);
      },
    });
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 800);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_DEFAULT },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Read actual CID from the binding the extraction logic created
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const wildcardBinding = bindings.find((b) => b.dbName === "*");
    assert(wildcardBinding !== undefined, "extraction must create a '*' binding for export default");
    actualCid = wildcardBinding.accessFnCid;
  }, 30000);

  it("authenticated write passes when invokeAccessFn allows it", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["default"], allowAnonymous: true };
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "auth write" },
    });
    expect(res.isOk()).toBe(true);
    // The gate invoked the mock with the binding's CID and a non-null user.
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(actualCid);
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
    // access-function denials carry a code so the client can surface the reason
    // verbatim in the write-fail toast (#2330) rather than the generic copy.
    expect(res.Err().error?.code).toBe("access-denied");
    expect(recorder.calls.length).toBe(1);
  });

  it("doc passed to invokeAccessFn includes _id even when client omits docId", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["default"], allowAnonymous: true };
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "no _id from client" },
    });
    expect(res.isOk()).toBe(true);
    const putRes = res.Ok();
    expect(recorder.calls.length).toBe(1);
    const invokedDoc = recorder.calls[0]?.doc as Record<string, unknown>;
    expect(invokedDoc._id).toBe(putRes.id);
  });

  it("doc._id matches client-provided docId", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["default"], allowAnonymous: true };
    const explicitId = "explicit-doc-id-123";
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "explicit id" },
      docId: explicitId,
    });
    expect(res.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(1);
    const invokedDoc = recorder.calls[0]?.doc as Record<string, unknown>;
    expect(invokedDoc._id).toBe(explicitId);
  });

  it("grant from write N is visible in grantState of write N+1", async () => {
    recorder.calls = [];
    const channelId = "chan-meta-doc-id";
    recorder.result = {
      channels: [channelId],
      grant: { users: { [ownerHandle]: [channelId] } },
    };
    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { type: "channel-meta" },
      docId: channelId,
    });
    expect(r1.isOk()).toBe(true);

    // Second write — the mock still returns allowAnonymous but we check grantState
    recorder.result = { channels: [channelId], allowAnonymous: true };
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { type: "message", channelId },
    });
    expect(r2.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(2);
    const gs = recorder.calls[1]?.grantState as { userGrants: Record<string, string[]> };
    expect(gs.userGrants[ownerHandle]).toContain(channelId);
  });

  it("notifies viewer-grants subscribers only when effective roles/channels change", async () => {
    const channelId = "live-refresh-channel";
    const docId = "viewer-grant-live-doc";
    viewerGrantEvents.length = 0;

    recorder.result = {
      channels: [docId],
      grant: { users: { [ownerHandle]: [channelId] } },
    };
    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "grant", seq: 1 },
    });
    expect(r1.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(viewerGrantEvents).toHaveLength(1);
    expect(viewerGrantEvents[0]).toMatchObject({
      type: "vibes.diy.evt-viewer-grants-changed",
      ownerHandle,
      appSlug,
    });

    recorder.result = {
      channels: [docId],
      grant: { users: { [ownerHandle]: [channelId] } },
    };
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "grant", seq: 2 },
    });
    expect(r2.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(viewerGrantEvents).toHaveLength(1);

    recorder.result = { channels: [docId], allowAnonymous: true };
    const r3 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "grant", seq: 3 },
    });
    expect(r3.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(viewerGrantEvents).toHaveLength(2);
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
          eq(tOutputs.ownerHandle, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, "default"),
          eq(tOutputs.docId, putRes.id)
        )
      );

    expect(rows.length).toBe(1);
    const row = rows[0];
    assert(row !== undefined, "expected one AccessFnOutputs row");
    expect(row.fnCid).toBe(actualCid);
    expect(row.hasGrants).toBe(0);
    const output = JSON.parse(row.output) as { channels: string[]; allowAnonymous: boolean };
    expect(output.channels).toEqual(["public"]);
    expect(output.allowAnonymous).toBe(true);
    expect(recorder.calls.length).toBe(1);
  });

  it("named export binding takes precedence over wildcard '*' fallback", async () => {
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        {
          type: "code-block",
          lang: "js",
          filename: "/access.js",
          content: `export function notes(doc) { return { allowAnonymous: true }; }\nexport default function(doc) { return { allowAnonymous: true }; }`,
        },
      ],
    });
    assert(r.isOk(), "push with named+default failed");

    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const namedCid = bindings.find((b) => b.dbName === "notes")?.accessFnCid;
    const wildcardCid = bindings.find((b) => b.dbName === "*")?.accessFnCid;
    assert(namedCid !== undefined, "named binding must exist");
    assert(wildcardCid !== undefined, "wildcard binding must exist");

    recorder.calls = [];
    recorder.result = { channels: ["notes"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "notes",
      doc: { title: "named binding" },
    });
    expect(r1.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(namedCid);

    recorder.calls = [];
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "other-db",
      doc: { title: "wildcard fallback" },
    });
    expect(r2.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(wildcardCid);
  });
});
