import { assert, beforeAll, describe, expect, it } from "vitest";
import { JSONEnDecoderSingleton, Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { localBroadcastCallbacks, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// A public-channel notes vibe: the access fn routes every doc to channel "notes".
const ACCESS_JS = `export function quicknotes(doc, oldDoc, user) {
  return { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true };
}`;

const ende = JSONEnDecoderSingleton();
function decodePayload(raw: ArrayBuffer | Uint8Array | string): unknown {
  return ende.parse<{ payload?: unknown }>(raw).Ok().payload;
}

// Drives the broadcast-ephemeral evento handler server-side: the sender's raw ws
// sends a req-broadcast-ephemeral MsgBase; the handler derives channels from the
// access fn and fans out evt-doc-ephemeral to the PEER connection (subscribed on
// the "notes" channel), skipping the sender. No response is sent (fire-and-forget)
// and nothing is persisted.
describe("broadcastEphemeralEvento (server-side)", () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let senderProvider: WSSendProvider;
  let peerProvider: WSSendProvider;
  let senderPair: ReturnType<typeof TestWSPair.create>;
  let ownerHandle: string;
  let appSlug: string;
  const access = { result: { channels: ["notes"], grant: { public: ["notes"] }, allowAnonymous: true } as unknown };
  const peerGot: unknown[] = [];
  const senderGot: unknown[] = [];

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => access.result as never,
    });

    // Wire the ephemeral fan-out callbacks onto the ctx (create-handler does this
    // in production from cf-serve's localBroadcastCallbacks).
    const cb = localBroadcastCallbacks(appCtx.vibesCtx.connections, { ENVIRONMENT: "test" } as never);
    (appCtx.vibesCtx as { notifyDocEphemeral?: unknown }).notifyDocEphemeral = cb.notifyDocEphemeral;
    (appCtx.vibesCtx as { notifyDocEphemeralDrop?: unknown }).notifyDocEphemeralDrop = cb.notifyDocEphemeralDrop;

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 901 });
    const wsEvento = vibesMsgEvento();

    // Sender connection (drives the handler; also used to create the app).
    senderPair = TestWSPair.create();
    senderProvider = new WSSendProvider(senderPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(senderProvider);
    senderPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: senderProvider });
    };
    // Capture anything the server sends back to the sender (should be nothing for
    // the ephemeral broadcast — fire-and-forget).
    senderPair.p1.onmessage = (e: MessageEvent) => senderGot.push(decodePayload(e.data));

    // Peer connection: a second WSSendProvider that will receive the fan-out.
    const peerPair = TestWSPair.create();
    peerProvider = new WSSendProvider(peerPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(peerProvider);
    peerPair.p1.onmessage = (e: MessageEvent) => peerGot.push(decodePayload(e.data));

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: senderPair.p1 as unknown as WebSocket,
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

    // Materialize the "notes" channel so subscribeDocs discovers the channel key.
    const seed = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "quicknotes", doc: { type: "note", text: "seed" } });
    assert(seed.isOk(), `seed putDoc failed: ${seed.isErr() ? seed.Err().message : ""}`);

    // Peer subscribes on the channel key so the exact-channel fan-out reaches it.
    peerProvider.subscribedDocKeys.add(`${ownerHandle}/${appSlug}/quicknotes/notes`);
  }, 30000);

  it("fans an ephemeral out to the channel peer, not the sender; nothing persists", async () => {
    peerGot.length = 0;
    senderGot.length = 0;

    // Send a raw req-broadcast-ephemeral over the sender's ws (the client
    // broadcastEphemeral arrives in Task 6; here we simulate its wire frame).
    const box = {
      tid: crypto.randomUUID(),
      src: "http://localhost:8787/api",
      dst: "vibes.diy.client",
      ttl: 6,
      payload: {
        type: "vibes.diy.req-broadcast-ephemeral",
        ownerHandle,
        appSlug,
        dbName: "quicknotes",
        docId: "cursor-s",
        doc: { _id: "cursor-s", type: "note", curX: 9 },
      },
    };
    senderPair.p1.send(ende.uint8ify(box));

    await new Promise((r) => setTimeout(r, 250));

    const eph = peerGot.filter(
      (m): m is { type: string; docId: string; doc: { curX: number }; channel?: string; originPeer: string } =>
        (m as { type?: string }).type === "vibes.diy.evt-doc-ephemeral"
    );
    expect(eph.length).toBeGreaterThanOrEqual(1);
    expect(eph[0]).toMatchObject({
      docId: "cursor-s",
      dbName: "quicknotes",
      channel: "notes",
      originPeer: senderProvider.connId,
      doc: { type: "note", curX: 9 },
    });

    // Sender received no ephemeral (excluded) and no res-* (fire-and-forget).
    expect(senderGot.some((m) => (m as { type?: string }).type === "vibes.diy.evt-doc-ephemeral")).toBe(false);

    // Not persisted: getDoc for the never-saved _id returns not-found.
    const gd = await ownerApi.getDoc({ ownerHandle, appSlug, dbName: "quicknotes", docId: "cursor-s" });
    const persisted = gd.isOk() && "status" in gd.Ok() ? (gd.Ok() as { status: string }).status : "not-found";
    expect(persisted).not.toBe("ok");
  });
});
