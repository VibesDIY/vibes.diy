import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Read-path half of VibesDIY/vibes.diy#2275. Channel/grant access on reads is
// computed for the reader's resolved handle. The read path used a bare unordered
// `handleBinding ... limit(1)`, so a multi-handle reader was evaluated under an
// arbitrary handle — they could fail to see docs granted to the handle they are
// actually acting as. resolveActiveHandle (defaultHandle setting, else any bound
// handle) now drives the read path too, matching the viewer payload and writes.
const ACCESS_JS = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;

interface InvokeRecorder {
  result: AccessDescriptor | { forbidden: string };
}

describe("read path resolves the active (default) handle for grants (#2275)", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  const recorder: InvokeRecorder = { result: { channels: ["general"], allowAnonymous: true } };

  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let readerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let readerHandle: string; // reader's auto-assigned handle (bound first)
  const READER_DEFAULT = "reader-default-handle"; // second handle, set as default

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => recorder.result,
    });

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 901 });
    const readerUser = await createTestUser({ sthis, deviceCA, seqUserId: 201 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });
    readerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await readerUser.getDashBoardToken()),
    });

    recorder.result = { channels: ["general"], allowAnonymous: true };
    const rApp = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const appRes = rApp.Ok();
    if (!isResEnsureAppSlugOk(appRes)) assert.fail("Failed to create owner app");
    appSlug = appRes.appSlug;
    ownerHandle = appRes.ownerHandle;

    // Reader mints their own (first) handle by creating a throwaway app.
    const rReaderApp = await readerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const readerAppRes = rReaderApp.Ok();
    if (!isResEnsureAppSlugOk(readerAppRes)) assert.fail("Failed to create reader app");
    readerHandle = readerAppRes.ownerHandle;

    // Reader joins owner's app as editor (app access; reads stay channel-gated).
    await ownerApi.ensureAppSettings({ appSlug, ownerHandle, request: { enable: true, autoAcceptRole: "editor" } });
    const rReq = await readerApi.requestAccess({ appSlug, ownerHandle });
    if (!isResRequestAccessApproved(rReq.Ok())) assert.fail("Expected reader auto-approved as editor");

    // Give the reader a SECOND handle and make it their default. The first
    // (auto-assigned) handle is what a bare limit(1) returns; the default is not.
    const t = appCtx.vibesCtx.sql.tables;
    const readerRow = await appCtx.vibesCtx.sql.db
      .select({ userId: t.handleBinding.userId, tenant: t.handleBinding.tenant })
      .from(t.handleBinding)
      .where(eq(t.handleBinding.handle, readerHandle))
      .limit(1)
      .then((rows) => rows[0]);
    assert(readerRow !== undefined, "reader handleBinding row must exist");
    const readerUserId = readerRow.userId;
    const now = new Date().toISOString();
    await appCtx.vibesCtx.sql.db
      .insert(t.handleBinding)
      .values({ userId: readerUserId, handle: READER_DEFAULT, tenant: readerRow.tenant, created: now })
      .onConflictDoNothing();
    await appCtx.vibesCtx.sql.db
      .insert(t.userSettings)
      .values({
        userId: readerUserId,
        settings: [{ type: "defaultHandle", ownerHandle: READER_DEFAULT }],
        updated: now,
        created: now,
      })
      .onConflictDoUpdate({
        target: t.userSettings.userId,
        set: { settings: [{ type: "defaultHandle", ownerHandle: READER_DEFAULT }], updated: now },
      });

    // Owner grants a channel to the reader's DEFAULT handle and places a doc there.
    const readerChannel = `user-${READER_DEFAULT}`;
    recorder.result = {
      channels: [`user-${ownerHandle}`, readerChannel],
      grant: { users: { [READER_DEFAULT]: [readerChannel] } },
    };
    const rFollow = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "chat",
      doc: { title: "granted-to-default", type: "friend" },
      docId: `friend-${ownerHandle}-${READER_DEFAULT}`,
    });
    assert(rFollow.isOk(), "owner cross-user grant write failed");
  }, 30000);

  it("reader sees a doc granted to their active (default) handle, not their first-bound one", async () => {
    const res = await readerApi.queryDocs({ ownerHandle, appSlug, dbName: "chat" });
    expect(res.isOk()).toBe(true);
    const titles = res.Ok().docs.map((d) => d.title);
    expect(titles).toContain("granted-to-default");
  });
});
