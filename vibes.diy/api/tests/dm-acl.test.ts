// vibes.diy/api/tests/dm-acl.test.ts
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, it, expect } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { directChannelUserSlug, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { eq } from "drizzle-orm";

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
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

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

  // Create a vibe to bind a userSlug
  const rEnsure = await api.ensureAppSlug({
    mode: "dev",
    fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
  });
  if (rEnsure.isErr()) throw new Error(`ensureAppSlug failed: ${rEnsure.Err().message}`);
  const res = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(res)) throw new Error("ensureAppSlug not ok");
  const userSlug = res.userSlug;

  return { api, appCtx, userSlug };
}

describe("DM ACL", { timeout: 20000 }, () => {
  it("non-participant cannot putDoc to a direct channel", async () => {
    const alice = await mkUser(1001);
    const bob = await mkUser(1002);
    const mallory = await mkUser(1003);

    const channel = directChannelUserSlug(alice.userSlug, bob.userSlug);

    const result = await mallory.api.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hi", createdAt: new Date().toISOString() },
    });

    expect(result.isErr()).toBe(true);
  });

  it("participant can putDoc to their direct channel", async () => {
    const alice = await mkUser(1010);
    const bob = await mkUser(1020);

    const channel = directChannelUserSlug(alice.userSlug, bob.userSlug);
    const result = await alice.api.putDoc({
      userSlug: channel,
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
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
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

    // Both alice and bob need ensureAppSlug to get their userSlugs
    const rAlice = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rAlice.isErr()) throw new Error(`ensureAppSlug (alice) failed: ${rAlice.Err().message}`);
    const aliceRes = rAlice.Ok();
    if (!isResEnsureAppSlugOk(aliceRes)) throw new Error("ensureAppSlug (alice) not ok");
    aliceUserSlug = aliceRes.userSlug;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.userSlug;
  });

  it("sending a DM upserts DirectChannelIndex for both participants", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);
    await aliceApi.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "first message", createdAt: new Date().toISOString() },
    });

    const t = sharedVibesCtx.sql.tables.directChannelIndex;
    const rows = await sharedVibesCtx.sql.db.select().from(t).where(eq(t.channelUserSlug, channel));
    const slugs = rows.map((r) => r.userSlug).sort();
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
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

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
    aliceUserSlug = aliceRes.userSlug;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.userSlug;
  });

  it("returns threads with unread counts", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);

    await aliceApi.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hey bob!", authorUserSlug: aliceUserSlug, createdAt: new Date().toISOString() },
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

describe("markDmRead", { timeout: 20000 }, () => {
  const sthis = ensureSuperThis();
  let aliceApi: VibesDiyApi;
  let aliceUserSlug: string;
  let bobApi: VibesDiyApi;
  let bobUserSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

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
    aliceUserSlug = aliceRes.userSlug;

    const rBob = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    if (rBob.isErr()) throw new Error(`ensureAppSlug (bob) failed: ${rBob.Err().message}`);
    const bobRes = rBob.Ok();
    if (!isResEnsureAppSlugOk(bobRes)) throw new Error("ensureAppSlug (bob) not ok");
    bobUserSlug = bobRes.userSlug;
  });

  it("sets unreadCount to 0 after marking read", async () => {
    const channel = directChannelUserSlug(aliceUserSlug, bobUserSlug);

    await aliceApi.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "unread msg", authorUserSlug: aliceUserSlug, createdAt: new Date().toISOString() },
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
