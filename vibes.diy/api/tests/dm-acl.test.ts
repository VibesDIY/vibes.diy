// vibes.diy/api/tests/dm-acl.test.ts
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, it, expect } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { directChannelUserSlug, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { localInvokeAccessFn } from "../svc/cf-serve.js";
import { eq } from "drizzle-orm";

// DM access is now expressed as the built-in DM access fn (#2290), so the test
// ctx needs a real QuickJS invoker (production wires the same localInvokeAccessFn).
// Lazy: QuickJS only loads on the first actual access-fn invoke.
const quickjsRef = { module: null };
const dmInvokeAccessFn = (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params);

// Each unique apiUrl gets its own cached WS connection. Use a per-call
// counter as a URL query param so each mkUser/test-setup gets an isolated
// connection and therefore its own AppContext.
let _connCounter = 0;
function uniqueApiUrl(): string {
  return `http://localhost:8787/api?conn=${++_connCounter}`;
}

async function mkUser(seqUserId: number) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });

  const user = await createTestUser({ sthis, deviceCA, seqUserId });

  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };

  const api = new VibesDiyApi({
    apiUrl: uniqueApiUrl(),
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });

  // Create a vibe to bind a ownerHandle
  const rEnsure = await api.ensureAppSlug({
    mode: "dev",
    fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
  });
  if (rEnsure.isErr()) throw new Error(`ensureAppSlug failed: ${rEnsure.Err().message}`);
  const res = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(res)) throw new Error("ensureAppSlug not ok");
  const ownerHandle = res.ownerHandle;

  return { api, appCtx, ownerHandle };
}

describe("DM ACL", { timeout: 20000 }, () => {
  it("non-participant cannot putDoc to a direct channel", async () => {
    const alice = await mkUser(1001);
    const bob = await mkUser(1002);
    const mallory = await mkUser(1003);

    const channel = directChannelUserSlug(alice.ownerHandle, bob.ownerHandle);

    const result = await mallory.api.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hi", createdAt: new Date().toISOString() },
    });

    expect(result.isErr()).toBe(true);
  });

  it("participant can putDoc to their direct channel", async () => {
    const alice = await mkUser(1010);
    const bob = await mkUser(1020);

    const channel = directChannelUserSlug(alice.ownerHandle, bob.ownerHandle);
    const result = await alice.api.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hello bob", createdAt: new Date().toISOString() },
    });

    expect(result.isErr()).toBe(false);
    expect(result.Ok().status).toBe("ok");
  });
});

describe("DM DirectChannelIndex", { timeout: 20000 }, () => {
  const sthis = ensureSuperThis();
  let aliceApi: VibesDiyApi;
  let aliceUserSlug: string;
  let bobUserSlug: string;
  let sharedVibesCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["vibesCtx"];

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });
    sharedVibesCtx = appCtx.vibesCtx;

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 1030 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 1040 });

    // Share ONE wsPair and ONE appCtx for both alice and bob.
    // Both VibesDiyApi instances must use the same wsPair.p1 (same URL)
    // so responses are routed back correctly.
    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    aliceApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await aliceUser.getDashBoardToken()),
    });

    const bobApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await bobUser.getDashBoardToken()),
    });

    // Both alice and bob need ensureAppSlug to get their ownerHandles
    const rAlice = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rAlice.isErr()) throw new Error(`ensureAppSlug (alice) failed: ${rAlice.Err().message}`);
    const aliceRes = rAlice.Ok();
    if (!isResEnsureAppSlugOk(aliceRes)) throw new Error("ensureAppSlug (alice) not ok");
    aliceUserSlug = aliceRes.ownerHandle;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.ownerHandle;
  });

  it("sending a DM upserts DirectChannelIndex for both participants", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "first message", createdAt: new Date().toISOString() },
    });

    const t = sharedVibesCtx.sql.tables.directChannelIndex;
    const rows = await sharedVibesCtx.sql.db.select().from(t).where(eq(t.channelHandle, channel));
    const slugs = rows.map((r) => r.handle).sort();
    expect(slugs).toEqual([aliceUserSlug, bobUserSlug].sort());
  });
});

describe("listDmThreads", { timeout: 20000 }, () => {
  const sthis = ensureSuperThis();
  let aliceApi: VibesDiyApi;
  let aliceUserSlug: string;
  let bobApi: VibesDiyApi;
  let bobUserSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 2001 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 2002 });

    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    aliceApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await aliceUser.getDashBoardToken()),
    });

    bobApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await bobUser.getDashBoardToken()),
    });

    const rAlice = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rAlice.isErr()) throw new Error(`ensureAppSlug (alice) failed: ${rAlice.Err().message}`);
    const aliceRes = rAlice.Ok();
    if (!isResEnsureAppSlugOk(aliceRes)) throw new Error("ensureAppSlug (alice) not ok");
    aliceUserSlug = aliceRes.ownerHandle;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.ownerHandle;
  });

  it("returns threads with unread counts", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);

    await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hey bob!", authorHandle: aliceUserSlug, createdAt: new Date().toISOString() },
    });

    // Alice lists — should see 1 thread, unread=1 (no read record yet)
    const aliceResult = await aliceApi.listDmThreads({});
    expect(aliceResult.isErr()).toBe(false);
    const aliceItems = aliceResult.Ok().items;
    expect(aliceItems.length).toBe(1);
    expect(aliceItems[0].channelUserSlug).toBe(channel);
    expect(aliceItems[0].otherUserSlug).toBe(bobUserSlug);
    expect(aliceItems[0].unreadCount).toBe(0); // sender auto-marked read on putDoc

    // Bob lists — should see 1 thread, 1 unread (hasn't read)
    const bobResult = await bobApi.listDmThreads({});
    expect(bobResult.isErr()).toBe(false);
    expect(bobResult.Ok().items[0].unreadCount).toBe(1);
  });
});

describe("DM sender identification with multi-slug user", { timeout: 20000 }, () => {
  // Regression test for: user with multiple slugs sends a DM — server must
  // identify the sender as the slug that appears in the channel, not a
  // different slug belonging to the same userId.
  it("listDmThreads shows the correct otherUserSlug when sender has multiple slugs", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 4001 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 4002 });

    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const aliceApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await aliceUser.getDashBoardToken()),
    });

    const bobApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await bobUser.getDashBoardToken()),
    });

    // Alice gets two slugs by creating two separate apps
    const rAlice1 = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>app1</div>; } App();` },
      ],
    });
    if (rAlice1.isErr()) throw new Error("alice ensureAppSlug 1 failed");
    const aliceRes1 = rAlice1.Ok();
    if (!isResEnsureAppSlugOk(aliceRes1)) throw new Error("alice ensureAppSlug 1 failed");
    const aliceSlug1 = aliceRes1.ownerHandle;

    const rAlice2 = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>app2</div>; } App();` },
      ],
    });
    if (rAlice2.isErr()) throw new Error("alice ensureAppSlug 2 failed");
    const aliceRes2 = rAlice2.Ok();
    if (!isResEnsureAppSlugOk(aliceRes2)) throw new Error("alice ensureAppSlug 2 failed");
    const _aliceSlug2 = aliceRes2.ownerHandle;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error("bob ensureAppSlug failed");
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("bob ensureAppSlug failed");
    const bobSlug = bobRes.ownerHandle;

    // Alice sends using her first slug; if sender identification is broken and
    // picks aliceSlug2 as sender, listDmThreads would report aliceSlug2 as
    // otherUserSlug instead of bobSlug.
    const channel = directChannelUserSlug(aliceSlug1, bobSlug);
    const putResult = await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hey bob", authorHandle: aliceSlug1, createdAt: new Date().toISOString() },
    });
    expect(putResult.isErr()).toBe(false);

    // Bob's thread should show aliceSlug1 as the other participant
    const bobThreads = await bobApi.listDmThreads({});
    expect(bobThreads.isErr()).toBe(false);
    const bobItems = bobThreads.Ok().items;
    expect(bobItems.length).toBeGreaterThan(0);
    expect(bobItems[0].otherUserSlug).toBe(aliceSlug1);
    expect(bobItems[0].channelUserSlug).toBe(channel);

    // Alice's thread (using slug1) should show bob as the other participant
    const aliceThreads = await aliceApi.listDmThreads({});
    expect(aliceThreads.isErr()).toBe(false);
    const aliceItems = aliceThreads.Ok().items;
    expect(aliceItems.length).toBeGreaterThan(0);
    // The thread for the channel with bob must show bob, not aliceSlug2
    const threadWithBob = aliceItems.find((t) => t.channelUserSlug === channel);
    expect(threadWithBob).toBeDefined();
    if (threadWithBob === undefined) throw new Error("Expected Alice to have a DM thread with Bob");
    expect(threadWithBob.otherUserSlug).toBe(bobSlug);
  });
});

describe("markDmRead", { timeout: 20000 }, () => {
  const sthis = ensureSuperThis();
  let aliceApi: VibesDiyApi;
  let aliceUserSlug: string;
  let bobApi: VibesDiyApi;
  let bobUserSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 3001 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 3002 });

    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    aliceApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await aliceUser.getDashBoardToken()),
    });

    bobApi = new VibesDiyApi({
      apiUrl: sharedApiUrl,
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await bobUser.getDashBoardToken()),
    });

    const rAlice = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rAlice.isErr()) throw new Error(`ensureAppSlug (alice) failed: ${rAlice.Err().message}`);
    const aliceRes = rAlice.Ok();
    if (!isResEnsureAppSlugOk(aliceRes)) throw new Error("ensureAppSlug (alice) not ok");
    aliceUserSlug = aliceRes.ownerHandle;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.ownerHandle;
  });

  it("sets unreadCount to 0 after marking read", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);

    await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "unread msg", authorHandle: aliceUserSlug, createdAt: new Date().toISOString() },
    });

    // Bob marks it read at seq=1
    const markResult = await bobApi.markDmRead({ channelUserSlug: channel, lastSeenSeq: 1 });
    expect(markResult.isErr()).toBe(false);

    // Bob now has 0 unread
    const listResult = await bobApi.listDmThreads({});
    expect(listResult.isErr()).toBe(false);
    expect(listResult.Ok().items[0].unreadCount).toBe(0);
  });
});

// Channel-gated DM reads (#2290): the built-in DM access fn places each message
// in a channel granting only the two participants, so reads flow through the
// ordinary channel filter. The owner-override read bypass can never reach a DM
// the caller is not part of — `access` stays "none" for DM dbs, so even an
// admin-mode query returns nothing.
describe("DM channel-gated reads", { timeout: 20000 }, () => {
  const sthis = ensureSuperThis();
  let aliceApi: VibesDiyApi;
  let aliceUserSlug: string;
  let bobApi: VibesDiyApi;
  let bobUserSlug: string;
  let malloryApi: VibesDiyApi;
  let sharedVibesCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["vibesCtx"];

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });
    sharedVibesCtx = appCtx.vibesCtx;

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 5001 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 5002 });
    const malloryUser = await createTestUser({ sthis, deviceCA, seqUserId: 5003 });

    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const mkApi = (user: Awaited<ReturnType<typeof createTestUser>>) =>
      new VibesDiyApi({
        apiUrl: sharedApiUrl,
        ws: wsPair.p1 as unknown as WebSocket,
        timeoutMs: 10000,
        getToken: async () => Result.Ok(await user.getDashBoardToken()),
      });

    aliceApi = mkApi(aliceUser);
    bobApi = mkApi(bobUser);
    malloryApi = mkApi(malloryUser);

    const ensure = async (api: VibesDiyApi, label: string) => {
      const r = await api.ensureAppSlug({
        mode: "dev",
        fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
      });
      if (r.isErr()) throw new Error(`ensureAppSlug (${label}) failed: ${r.Err().message}`);
      const res = r.Ok();
      if (!isResEnsureAppSlugOk(res)) throw new Error(`ensureAppSlug (${label}) not ok`);
      return res.ownerHandle;
    };
    aliceUserSlug = await ensure(aliceApi, "alice");
    bobUserSlug = await ensure(bobApi, "bob");
    await ensure(malloryApi, "mallory");
  });

  it("only the two participants can read the conversation", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    const put = await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "secret for bob", authorHandle: aliceUserSlug, createdAt: new Date().toISOString() },
    });
    expect(put.isErr()).toBe(false);

    // Bob (participant) sees the message.
    const bobRead = await bobApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(bobRead.isErr()).toBe(false);
    expect(bobRead.Ok().docs.length).toBe(1);
    expect((bobRead.Ok().docs[0] as { body?: string }).body).toBe("secret for bob");

    // Alice (participant + author) sees it too.
    const aliceRead = await aliceApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(aliceRead.isErr()).toBe(false);
    expect(aliceRead.Ok().docs.length).toBe(1);

    // Mallory (non-participant) sees nothing — the channel filter drops it.
    const malloryRead = await malloryApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(malloryRead.isErr()).toBe(false);
    expect(malloryRead.Ok().docs.length).toBe(0);
  });

  it("owner/admin override cannot read a DM the caller is not part of", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "still private", authorHandle: aliceUserSlug, createdAt: new Date().toISOString() },
    });

    // Even asking for admin/override mode, a non-participant gets nothing: DM
    // reads leave access = "none", so the override bypass never engages.
    const malloryAdmin = await malloryApi.queryDocs({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      adminMode: true,
    });
    expect(malloryAdmin.isErr()).toBe(false);
    expect(malloryAdmin.Ok().docs.length).toBe(0);
  });

  it("only a participant can delete a DM (delete routes through the built-in fn)", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    const docId = "dm-del-target";
    const put = await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      docId,
      doc: { body: "delete me", authorHandle: aliceUserSlug, createdAt: new Date().toISOString() },
    });
    expect(put.isErr()).toBe(false);

    // Non-participant delete is denied by the built-in DM fn's participant check.
    const malloryDel = await malloryApi.deleteDoc({ ownerHandle: channel, appSlug: "dm", dbName: "messages", docId });
    expect(malloryDel.isErr()).toBe(true);

    // Participant delete succeeds.
    const bobDel = await bobApi.deleteDoc({ ownerHandle: channel, appSlug: "dm", dbName: "messages", docId });
    expect(bobDel.isErr()).toBe(false);

    // Gone for the participant who deleted it.
    const bobRead = await bobApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(bobRead.isErr()).toBe(false);
    expect((bobRead.Ok().docs as { _id: string }[]).some((d) => d._id === docId)).toBe(false);
  });

  it("legacy DM docs with no access-fn output are never returned (fail closed, no migration)", async () => {
    // Simulate a message written before #2290: a real AppDocuments row with NO
    // AccessFnOutputs sidecar (the old direct-channel path never invoked an
    // access fn). Without the fail-closed filter, the channel filter's
    // "no outputs → return all" branch would hand this to anyone who knows the
    // _d.<a>.<b> slug. We deliberately don't migrate it; it must stay invisible.
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    const legacyId = "legacy-no-output";
    const tDocs = sharedVibesCtx.sql.tables.appDocuments;
    await sharedVibesCtx.sql.db.insert(tDocs).values({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "legacy-thread",
      docId: legacyId,
      seq: 1,
      userId: "legacy-user",
      data: { body: "pre-2290 secret", authorHandle: aliceUserSlug },
      deleted: 0,
      created: new Date().toISOString(),
    });

    // Non-participant must not see it.
    const malloryRead = await malloryApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "legacy-thread" });
    expect(malloryRead.isErr()).toBe(false);
    expect(malloryRead.Ok().docs.length).toBe(0);

    // And neither does a participant — output-less legacy rows are dropped, not
    // migrated (acceptable per the issue; the security property is the point).
    const bobRead = await bobApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "legacy-thread" });
    expect(bobRead.isErr()).toBe(false);
    expect(bobRead.Ok().docs.length).toBe(0);
  });
});

// A user with several handles can be addressed at a handle that is not their
// active/default one. DM access must act as the handle that appears in the
// channel slug, not the global active handle (#2290 Codex review).
describe("DM multi-handle access", { timeout: 20000 }, () => {
  it("write/read use the channel-participant handle, not the active/default handle", async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: dmInvokeAccessFn });

    const aliceUser = await createTestUser({ sthis, deviceCA, seqUserId: 6001 });
    const bobUser = await createTestUser({ sthis, deviceCA, seqUserId: 6002 });
    const malloryUser = await createTestUser({ sthis, deviceCA, seqUserId: 6003 });

    const sharedApiUrl = uniqueApiUrl();
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const mkApi = (user: Awaited<ReturnType<typeof createTestUser>>) =>
      new VibesDiyApi({
        apiUrl: sharedApiUrl,
        ws: wsPair.p1 as unknown as WebSocket,
        timeoutMs: 10000,
        getToken: async () => Result.Ok(await user.getDashBoardToken()),
      });
    const aliceApi = mkApi(aliceUser);
    const bobApi = mkApi(bobUser);
    const malloryApi = mkApi(malloryUser);

    const ensure = async (api: VibesDiyApi, content: string) => {
      const r = await api.ensureAppSlug({
        mode: "dev",
        fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content }],
      });
      if (r.isErr()) throw new Error(`ensureAppSlug failed: ${r.Err().message}`);
      const res = r.Ok();
      if (!isResEnsureAppSlugOk(res)) throw new Error("ensureAppSlug not ok");
      return res.ownerHandle;
    };

    // Alice gets two handles; bob and mallory one each.
    const aliceSlug1 = await ensure(aliceApi, `function App() { return <div>a1</div>; } App();`);
    const aliceSlug2 = await ensure(aliceApi, `function App() { return <div>a2</div>; } App();`);
    const bobSlug = await ensure(bobApi, `function App() { return null; } App();`);
    await ensure(malloryApi, `function App() { return <div>m</div>; } App();`);

    // Force alice's ACTIVE handle to slug2 (NOT the participant handle), so the
    // test fails if any DM path falls back to resolveActiveHandle.
    const vctx = appCtx.vibesCtx;
    const hb = vctx.sql.tables.handleBinding;
    const aliceUserId = await vctx.sql.db
      .select({ userId: hb.userId })
      .from(hb)
      .where(eq(hb.handle, aliceSlug1))
      .then((r) => r[0]?.userId);
    if (!aliceUserId) throw new Error("could not resolve alice userId");
    const us = vctx.sql.tables.userSettings;
    const nowIso = new Date().toISOString();
    await vctx.sql.db
      .insert(us)
      .values({
        userId: aliceUserId,
        settings: [{ type: "defaultHandle", ownerHandle: aliceSlug2 }],
        updated: nowIso,
        created: nowIso,
      })
      .onConflictDoUpdate({ target: us.userId, set: { settings: [{ type: "defaultHandle", ownerHandle: aliceSlug2 }] } });

    // Thread is keyed to alice's slug1 (the non-default handle).
    const channel = directChannelUserSlug(aliceSlug1, bobSlug);

    // Write succeeds only if the writer handle is resolved to slug1 (the
    // participant), not slug2 (the active/default) — which the fn would reject.
    const put = await aliceApi.putDoc({
      ownerHandle: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hi from slug1", authorHandle: aliceSlug1, createdAt: new Date().toISOString() },
    });
    expect(put.isErr()).toBe(false);

    // Alice reads as slug1 (her participant handle) and sees the message.
    const aliceRead = await aliceApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(aliceRead.isErr()).toBe(false);
    expect(aliceRead.Ok().docs.length).toBe(1);

    // Bob (the other participant) sees it; mallory does not.
    const bobRead = await bobApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(bobRead.isErr()).toBe(false);
    expect(bobRead.Ok().docs.length).toBe(1);

    const malloryRead = await malloryApi.queryDocs({ ownerHandle: channel, appSlug: "dm", dbName: "messages" });
    expect(malloryRead.isErr()).toBe(false);
    expect(malloryRead.Ok().docs.length).toBe(0);
  });
});
