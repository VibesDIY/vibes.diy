import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, type AccessDescriptor, type EvtViewerGrantsChanged } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Integration coverage for the content-identical no-op in putDoc (issue #2644):
// re-asserting the exact stored content at a stable docId must be absorbed — no
// new revision, no doc-changed / grants-changed fan-out — while a real content
// change still mints a revision. A mock invokeAccessFn stands in for the
// AccessFnDO, returning a channel + grant so we exercise the motivating
// auto-grant-on-load pattern.

const ACCESS_JS_DEFAULT = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return { allowAnonymous: true };
}`;

interface InvokeRecorder {
  calls: number;
  result: AccessDescriptor | { forbidden: string };
}

interface DocChange {
  docId: string;
  channel?: string;
}

async function setupCtx(recorder: InvokeRecorder, docChanges: DocChange[], viewerGrantEvents: EvtViewerGrantsChanged[]) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async () => {
      recorder.calls++;
      return recorder.result;
    },
    notifyDocChanged: async (evt) => {
      docChanges.push({ docId: evt.docId, channel: evt.channel });
    },
    notifyViewerGrantsChanged: async (evt) => {
      viewerGrantEvents.push(evt);
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

describe("putDoc content-identical no-op (#2644)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = { calls: 0, result: { allowAnonymous: true } };
  const docChanges: DocChange[] = [];
  const viewerGrantEvents: EvtViewerGrantsChanged[] = [];

  async function revisionCount(docId: string): Promise<number> {
    const t = appCtx.vibesCtx.sql.tables.appDocuments;
    const rows = await appCtx.vibesCtx.sql.db
      .select({ seq: t.seq })
      .from(t)
      .where(and(eq(t.ownerHandle, ownerHandle), eq(t.appSlug, appSlug), eq(t.dbName, "default"), eq(t.docId, docId)));
    return rows.length;
  }

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder, docChanges, viewerGrantEvents);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 1800);
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
  }, 30000);

  it("absorbs a re-put of identical content: no new revision, no fan-out", async () => {
    const docId = "grant-noop";
    recorder.result = { channels: ["blog:authors"], grant: { users: { alice: ["blog:authors"] } } };

    docChanges.length = 0;
    viewerGrantEvents.length = 0;
    recorder.calls = 0;

    // First write — mints revision 1, fans out, stores the grant.
    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "author", handle: "alice" },
    });
    expect(r1.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await revisionCount(docId)).toBe(1);
    expect(docChanges.filter((c) => c.docId === docId)).toHaveLength(1);
    expect(viewerGrantEvents).toHaveLength(1);
    expect(recorder.calls).toBe(1);

    // Re-assert the EXACT same content (key order shuffled) — must be a no-op.
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { handle: "alice", type: "author" },
    });
    expect(r2.isOk()).toBe(true);
    expect(r2.Ok().status).toBe("ok");
    expect(r2.Ok().id).toBe(docId);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // No new revision and no additional fan-out — but the access gate still ran.
    expect(await revisionCount(docId)).toBe(1);
    expect(docChanges.filter((c) => c.docId === docId)).toHaveLength(1);
    expect(viewerGrantEvents).toHaveLength(1);
    expect(recorder.calls).toBe(2);
  });

  it("a real content change after a no-op still mints a new revision", async () => {
    const docId = "grant-changes";
    recorder.result = { channels: ["blog:authors"], grant: { users: { bob: ["blog:authors"] } } };
    docChanges.length = 0;

    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "author", handle: "bob", bio: "v1" },
    });
    expect(r1.isOk()).toBe(true);

    // Identical re-put — no-op.
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "author", handle: "bob", bio: "v1" },
    });
    expect(r2.isOk()).toBe(true);
    expect(await revisionCount(docId)).toBe(1);

    // Now the content actually changes — a real revision must be minted.
    const r3 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId,
      doc: { type: "author", handle: "bob", bio: "v2" },
    });
    expect(r3.isOk()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await revisionCount(docId)).toBe(2);
    expect(docChanges.filter((c) => c.docId === docId).length).toBeGreaterThanOrEqual(2);
  });
});
