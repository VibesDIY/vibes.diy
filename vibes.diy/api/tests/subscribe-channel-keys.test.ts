import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { localBroadcastCallbacks, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Two named exports → two independent db bindings (parseExportNames extracts each
// `export function NAME`). `quicknotes` routes notes to channel "notes" with a
// public grant; `emptyroom` exists as a binding but is never written, so its
// channel is never materialized. This is the channel ≠ db shape from #2306/#2337.
const ACCESS_JS = `export function quicknotes(doc, oldDoc, user) {
  return { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true };
}
export function emptyroom(doc, oldDoc, user) {
  return { channels: ["whispers"], allowAnonymous: true };
}
export function freshfeed(doc, oldDoc, user) {
  return { channels: ["pulse"], grant: { public: ["pulse"] }, allowAnonymous: true };
}
export function narrowfeed(doc, oldDoc, user) {
  return { channels: ["lobby"], grant: { public: ["lobby"] }, allowAnonymous: true };
}
export function privyfeed(doc, oldDoc, user) {
  return { channels: ["open"], grant: { public: ["open"] }, allowAnonymous: true };
}
export function alpha(doc, oldDoc, user) {
  return { channels: ["beta"], grant: { public: ["beta"] }, allowAnonymous: true };
}
export function beta(doc, oldDoc, user) {
  return { channels: ["gamma"], grant: { public: ["gamma"] }, allowAnonymous: true };
}`;

// These tests lock the GOOD path for channel ≠ db live sync (#2337): the
// subscribe-time channel-key computation and the deliver-on-write fan-out that
// works once a channel is materialized. The companion bug — "join before grant"
// (subscribing while a channel is still empty) — is filed separately; these
// guards must keep passing through that fix.
describe("subscribeDocs channel-key registration (channel ≠ db) — #2337 good path", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let wsSendProvider: WSSendProvider;
  let ownerHandle: string;
  let appSlug: string;
  // Result the (stubbed) access fn returns at invocation time.
  const access = { result: { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true } as unknown };

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => access.result as never,
    });

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 900 });
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
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

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App(){return null} App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("app create failed");
    ownerHandle = res.ownerHandle;
    appSlug = res.appSlug;

    // Materialize the "notes" channel: a public-grant doc on db "quicknotes".
    // This is what makes "notes" discoverable to a later subscribeDocs.
    access.result = { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true };
    const seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "quicknotes", doc: { type: "note", text: "seed" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);
  }, 30000);

  it("registers the channel key (owner/app/quicknotes/notes), not the bare db key, once the channel is materialized", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "quicknotes" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    // Channel keys nest under their db: owner/app/<dbName>/<channel>.
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/quicknotes/notes`)).toBe(true);
    // The write routes by channel, so the bare db key would never match the fan-out.
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/quicknotes`)).toBe(false);
  });

  it("falls back to the bare db key when the db has a binding but no materialized channel", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "emptyroom" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    // Characterizes the current behavior: with no channel output to discover, the
    // connection registers only owner/app/emptyroom. This is the "join before
    // grant" gap the #2337 fix will close — guard so the change is visible.
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/emptyroom`)).toBe(true);
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/whispers`)).toBe(false);
  });

  it("end-to-end: a channel-routed write reaches a connection subscribed after the grant, with the real dbName", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "quicknotes" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    const got: { ownerHandle: string; appSlug: string; dbName: string; docId: string }[] = [];
    const off = ownerApi.onDocChanged((o, a, db, doc) => got.push({ ownerHandle: o, appSlug: a, dbName: db, docId: doc }));

    // Drive the real per-vibe fan-out the writer would trigger: routed by channel
    // "notes" but carrying the real dbName "quicknotes". An external sender id so
    // the receiver isn't excluded as the originator.
    const fanout = localBroadcastCallbacks(appCtx.vibesCtx.connections, { ENVIRONMENT: "test" } as never);
    await fanout.notifyDocChanged(
      { ownerHandle, appSlug, dbName: "quicknotes", docId: "live-1", channel: "notes" },
      "external-writer-conn"
    );

    // Allow the WS round-trip to flush.
    await new Promise((res) => setTimeout(res, 150));
    off();

    expect(got.length).toBeGreaterThanOrEqual(1);
    // The payload carries the REAL db name (not the channel) so the iframe's
    // `data.dbName === this.name` filter matches — see #2301.
    expect(got[0]?.dbName).toBe("quicknotes");
    expect(got[0]?.docId).toBe("live-1");
    expect(got[0]?.ownerHandle).toBe(ownerHandle);
  });

  // #2337 fix — the "join before grant" gap. A connection subscribes to a
  // public-channel db (freshfeed → channel "pulse") BEFORE any doc materializes
  // the channel, so it holds only the bare db key owner/app/freshfeed. The first
  // public write fans out on owner/app/pulse; the fan-out now also wakes bare-db-
  // key subscribers (cf-serve.ts), so it reaches this connection live. Before the
  // fix this was reload-only.
  it("join before grant: first public-channel write reaches a connection that subscribed while empty", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "freshfeed" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    const got: { dbName: string; docId: string }[] = [];
    const off = ownerApi.onDocChanged((_o, _a, db, doc) => got.push({ dbName: db, docId: doc }));

    // First post to the public feed: fan-out routes by channel "pulse".
    const fanout = localBroadcastCallbacks(appCtx.vibesCtx.connections, { ENVIRONMENT: "test" } as never);
    await fanout.notifyDocChanged(
      { ownerHandle, appSlug, dbName: "freshfeed", docId: "first", channel: "pulse" },
      "external-writer-conn"
    );
    await new Promise((res) => setTimeout(res, 150));
    off();

    expect(got.length).toBeGreaterThanOrEqual(1);
    expect(got[0]?.dbName).toBe("freshfeed");
  });

  // #2340 — narrow fan-out after re-subscribe. A connection that subscribes to an
  // access-fn db BEFORE any doc materializes its channel holds only the bare db
  // key (the #2337 fallback). `subscribedDocKeys` is additive, so a later
  // subscribeDocs (e.g. the evt-viewer-grants-changed → subscribeDocs loop) that
  // discovers the channel must DROP the now-redundant bare key — otherwise the
  // connection keeps matching the broad bare-db wake forever and never narrows.
  it("drops the bare db key once a re-subscribe discovers the channel (#2340)", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const bareKey = `${ownerHandle}/${appSlug}/narrowfeed`;
    const channelKey = `${ownerHandle}/${appSlug}/narrowfeed/lobby`;

    // 1. Subscribe before any doc materializes "lobby" → only the bare db key.
    let r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "narrowfeed" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(bareKey)).toBe(true);
    expect(wsSendProvider.subscribedDocKeys.has(channelKey)).toBe(false);

    // 2. Materialize "lobby" with a public-grant doc so it becomes discoverable.
    access.result = { channels: ["lobby"], grant: { public: ["lobby"] }, allowAnonymous: true };
    const seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "narrowfeed", doc: { type: "note", text: "hi" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);

    // 3. Re-subscribe → channel key discovered; the stale bare db key is dropped.
    r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "narrowfeed" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(channelKey)).toBe(true);
    expect(wsSendProvider.subscribedDocKeys.has(bareKey)).toBe(false);
  });

  // #2340 — once narrowed, a write to a *different*, private channel on the same
  // db must not reach the connection. Before the narrowing the retained bare db
  // key (owner/app/privyfeed) matched the write's dbKey and woke the connection
  // (content-free over-delivery); after narrowing to "open" it no longer does.
  it("private-channel write no longer wakes a connection narrowed to its public channel (#2340)", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const bareKey = `${ownerHandle}/${appSlug}/privyfeed`;

    // Narrow to the public channel "open": subscribe empty → materialize → re-subscribe.
    let r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "privyfeed" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    access.result = { channels: ["open"], grant: { public: ["open"] }, allowAnonymous: true };
    const seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "privyfeed", doc: { type: "note", text: "hi" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);
    r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "privyfeed" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(bareKey)).toBe(false);
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/privyfeed/open`)).toBe(true);

    const got: { docId: string }[] = [];
    const off = ownerApi.onDocChanged((_o, _a, _db, doc) => got.push({ docId: doc }));

    const fanout = localBroadcastCallbacks(appCtx.vibesCtx.connections, { ENVIRONMENT: "test" } as never);
    // Private "vip" channel write on the same db — must NOT reach the narrowed conn.
    await fanout.notifyDocChanged(
      { ownerHandle, appSlug, dbName: "privyfeed", docId: "vip-1", channel: "vip" },
      "external-writer-conn"
    );
    // Sanity: a write on the subscribed "open" channel still reaches it (narrowing
    // didn't break correctness).
    await fanout.notifyDocChanged(
      { ownerHandle, appSlug, dbName: "privyfeed", docId: "open-1", channel: "open" },
      "external-writer-conn"
    );
    await new Promise((res) => setTimeout(res, 150));
    off();

    expect(got.find((g) => g.docId === "vip-1")).toBeUndefined();
    expect(got.find((g) => g.docId === "open-1")).toBeDefined();
  });

  // #2340 regression guard — a non-access-fn db has no channel keys to narrow to,
  // so its bare db key is the ONLY fan-out key and must be retained across
  // re-subscribes. Guards against an over-broad fix that drops bare keys blindly.
  it("keeps the bare db key for a non-access-fn db across re-subscribe (#2340)", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const bareKey = `${ownerHandle}/${appSlug}/scratchpad`;

    let r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "scratchpad" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(bareKey)).toBe(true);

    r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "scratchpad" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(bareKey)).toBe(true);
  });

  // #2340 type-soundness — db and channel names share the owner/app/<…> namespace,
  // so without db-scoping a db literally named like another db's channel would
  // collide in the flat key set. Here db "alpha" routes to channel "beta" while a
  // separate db is literally named "beta". Both subscriptions live on the same
  // connection; narrowing "beta" (dropping its bare key) must not drop "alpha"'s
  // channel key. Db-scoped keys (owner/app/<db>/<channel>) make the two distinct.
  it("narrowing a db does not drop a same-named channel key owned by another db (#2340)", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const alphaChannelKey = `${ownerHandle}/${appSlug}/alpha/beta`; // db alpha → channel "beta"
    const betaBareKey = `${ownerHandle}/${appSlug}/beta`; // db literally named "beta"

    // Subscribe to db "alpha"; once "beta" is materialized the owner discovers it.
    access.result = { channels: ["beta"], grant: { public: ["beta"] }, allowAnonymous: true };
    let seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "alpha", doc: { type: "note", text: "a" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);
    let r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "alpha" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(alphaChannelKey)).toBe(true);

    // On the SAME connection, subscribe to db "beta" while empty → bare db key.
    r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "beta" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    expect(wsSendProvider.subscribedDocKeys.has(betaBareKey)).toBe(true);

    // Materialize beta's own channel "gamma" and re-subscribe → beta narrows.
    access.result = { channels: ["gamma"], grant: { public: ["gamma"] }, allowAnonymous: true };
    seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "beta", doc: { type: "note", text: "b" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);
    r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "beta" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    expect(wsSendProvider.subscribedDocKeys.has(betaBareKey)).toBe(false); // narrowed
    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/beta/gamma`)).toBe(true);
    // The fix: alpha's channel key survives beta's narrowing — no collision.
    expect(wsSendProvider.subscribedDocKeys.has(alphaChannelKey)).toBe(true);
  });
});
