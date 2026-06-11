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

  it("registers the channel key (owner/app/notes), not the bare db key, once the channel is materialized", async () => {
    wsSendProvider.subscribedDocKeys.clear();
    const r = await ownerApi.subscribeDocs({ ownerHandle, appSlug, dbName: "quicknotes" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err().message : ""}`);

    expect(wsSendProvider.subscribedDocKeys.has(`${ownerHandle}/${appSlug}/notes`)).toBe(true);
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

  // RED ANCHOR for #2337 — the "join before grant" gap. A connection subscribes
  // to a public-channel db (freshfeed → channel "pulse", public grant) BEFORE any
  // doc materializes the channel, so it registers only the bare db key
  // owner/app/freshfeed. The first public write fans out on owner/app/pulse and
  // never reaches it — currently no live delivery, reload-only.
  //
  // Marked it.fails() so it documents the bug without breaking CI; flip to it()
  // in the fix commit once a join-before-grant subscriber receives the first post.
  it.fails("join before grant: first public-channel write reaches a connection that subscribed while empty", async () => {
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
});
