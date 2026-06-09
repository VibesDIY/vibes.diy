import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Reproduces the pickathon "Added You" bug: a follow/QR-scan flow where user A's
// write grants user B read access to channel `user-B`. B has never written a doc
// of their own into `user-B` (B has only, at most, a doc in a public channel).
// B must still be able to read the doc A wrote — the grant is discovered from the
// global scan of all grant-bearing access-fn outputs, independent of B's own writes.
const ACCESS_JS = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;

interface InvokeRecorder {
  result: AccessDescriptor | { forbidden: string };
}

describe("cross-user channel grant read", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  const recorder: InvokeRecorder = { result: { channels: ["general"], allowAnonymous: true } };

  let ownerApi: VibesDiyApi;
  let readerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let readerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => recorder.result,
    });

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 900 });
    const readerUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });

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

    // Owner creates the app (binds the access fn for db "chat").
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

    // Reader mints their own handle (creating their own throwaway app).
    const rReaderApp = await readerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const readerAppRes = rReaderApp.Ok();
    if (!isResEnsureAppSlugOk(readerAppRes)) assert.fail("Failed to create reader app");
    readerHandle = readerAppRes.ownerHandle;

    // Reader joins owner's app as editor (mirrors anna being an approved editor).
    await ownerApi.ensureAppSettings({ appSlug, ownerHandle, request: { enable: true, autoAcceptRole: "editor" } });
    const rReq = await readerApi.requestAccess({ appSlug, ownerHandle });
    if (!isResRequestAccessApproved(rReq.Ok())) assert.fail("Expected reader auto-approved as editor");

    // The reader's ONLY write into owner's app is a public-channel doc — like
    // anna's lone favorite. It does NOT place anything in `user-<reader>`.
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const rPub = await readerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "reader-favorite" } });
    assert(rPub.isOk(), "reader public write failed");

    // Owner writes a doc that grants the READER channel `user-<reader>` and places
    // the doc there. This is the cross-user grant (the "follow" / "scan").
    const readerChannel = `user-${readerHandle}`;
    recorder.result = {
      channels: [`user-${ownerHandle}`, readerChannel],
      grant: { users: { [readerHandle]: [readerChannel] } },
    };
    const rFollow = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "chat",
      doc: { title: "scanned-you", type: "friend" },
      docId: `friend-${ownerHandle}-${readerHandle}`,
    });
    assert(rFollow.isOk(), "owner cross-user grant write failed");
  }, 30000);

  it("reader sees a doc another user granted them, despite no own write in that channel", async () => {
    const res = await readerApi.queryDocs({ ownerHandle, appSlug, dbName: "chat" });
    expect(res.isOk()).toBe(true);
    const titles = res.Ok().docs.map((d) => d.title);
    expect(titles).toContain("scanned-you");
  });
});
