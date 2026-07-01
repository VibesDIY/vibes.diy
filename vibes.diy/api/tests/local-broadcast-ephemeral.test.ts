import { describe, it, expect } from "vitest";
import { JSONEnDecoderSingleton, TestWSPair } from "@adviser/cement";
import { localBroadcastCallbacks, WSSendProvider } from "@vibes.diy/api-svc";

// Minimal CFEnv stand-in: only ENVIRONMENT is read (for shouldLog).
const env = { ENVIRONMENT: "test" } as never;

const ende = JSONEnDecoderSingleton();

function decodePayload(raw: ArrayBuffer | Uint8Array | string): unknown {
  const obj = ende.parse<{ payload?: unknown }>(raw).Ok();
  return obj.payload;
}

function mkConn(keys: string[]) {
  const pair = TestWSPair.create();
  const provider = new WSSendProvider(pair.p2 as unknown as WebSocket);
  keys.forEach((k) => provider.subscribedDocKeys.add(k));
  const got: unknown[] = [];
  pair.p1.onmessage = (e: MessageEvent) => got.push(decodePayload(e.data));
  return { provider, got };
}

// notifyDocEphemeral routes by the `channel` on the evt (computed by the handler
// via the access fn — Task 4), mirroring notifyDocChanged. channel present →
// exact channel-key match, NO bare-db fallback (P1). channel absent → bare dbKey.
describe("notifyDocEphemeral", () => {
  it("routes to channel subscribers by the doc's channel, skips the sender", async () => {
    const sender = mkConn(["alice/app1/default/notes"]);
    const peer = mkConn(["alice/app1/default/notes"]);
    const other = mkConn(["alice/app1/default/private"]); // different channel
    const connections = new Set([sender.provider, peer.provider, other.provider]);
    const cb = localBroadcastCallbacks(connections, env);

    await cb.notifyDocEphemeral(
      {
        ownerHandle: "alice",
        appSlug: "app1",
        dbName: "default",
        docId: "cursor-a",
        doc: { _id: "cursor-a", type: "cursor", curX: 5 },
        channel: "notes",
      },
      sender.provider.connId
    );

    expect(peer.got).toHaveLength(1);
    expect(peer.got[0]).toMatchObject({
      type: "vibes.diy.evt-doc-ephemeral",
      dbName: "default",
      docId: "cursor-a",
      originPeer: sender.provider.connId,
      doc: { type: "cursor", curX: 5 },
      channel: "notes",
    });
    expect(other.got).toHaveLength(0); // different channel — no delivery
    expect(sender.got).toHaveLength(0); // sender excluded
  });

  it("asymmetric write→channel: a peer reading `inbox` receives a sender NOT subscribed to inbox", async () => {
    const submitter = mkConn(["alice/app1/default"]); // can't read inbox
    const owner = mkConn(["alice/app1/default/inbox"]); // reads inbox
    const cb = localBroadcastCallbacks(new Set([submitter.provider, owner.provider]), env);
    // handler computed channel="inbox" from the access fn:
    await cb.notifyDocEphemeral(
      {
        ownerHandle: "alice",
        appSlug: "app1",
        dbName: "default",
        docId: "form-1",
        doc: { type: "msg", body: "hi" },
        channel: "inbox",
      },
      submitter.provider.connId
    );
    expect(owner.got).toHaveLength(1);
    expect(owner.got[0]).toMatchObject({ channel: "inbox", doc: { body: "hi" } });
  });

  it("no bare-db leak: a bare-db-only peer does NOT receive a channel-routed ephemeral", async () => {
    const sender = mkConn(["alice/app1/default/notes"]);
    const bareDbPeer = mkConn(["alice/app1/default"]); // join-before-grant
    const cb = localBroadcastCallbacks(new Set([sender.provider, bareDbPeer.provider]), env);
    await cb.notifyDocEphemeral(
      {
        ownerHandle: "alice",
        appSlug: "app1",
        dbName: "default",
        docId: "cursor-a",
        doc: { curX: 1 },
        channel: "notes",
      },
      sender.provider.connId
    );
    expect(bareDbPeer.got).toHaveLength(0);
  });

  it("non-access-fn vibe (no channel): db-wide delivery via the bare-db key", async () => {
    const sender = mkConn(["alice/app1/default"]);
    const peer = mkConn(["alice/app1/default"]);
    const cb = localBroadcastCallbacks(new Set([sender.provider, peer.provider]), env);
    await cb.notifyDocEphemeral(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", doc: { curX: 1 } },
      sender.provider.connId
    );
    expect(peer.got).toHaveLength(1);
  });

  it("drops an oversize snapshot (size cap) without delivering", async () => {
    const sender = mkConn(["alice/app1/default"]);
    const peer = mkConn(["alice/app1/default"]);
    const cb = localBroadcastCallbacks(new Set([sender.provider, peer.provider]), env);
    const big = { blob: "x".repeat(20000) };
    await cb.notifyDocEphemeral(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", doc: big },
      sender.provider.connId
    );
    expect(peer.got).toHaveLength(0);
  });
});

describe("notifyDocEphemeralDrop", () => {
  it("broadcasts a drop for a departed peer to all connections", async () => {
    const a = mkConn(["alice/app1/default"]);
    const b = mkConn(["alice/app1/default"]);
    const cb = localBroadcastCallbacks(new Set([a.provider, b.provider]), env);
    await cb.notifyDocEphemeralDrop("gone-conn");
    expect(a.got[0]).toMatchObject({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "gone-conn" });
    expect(b.got[0]).toMatchObject({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "gone-conn" });
  });

  // The cf-serve close/error listeners call notifyDocEphemeralDrop(connId) before
  // ws.connections.delete (Task 5). That wiring is thin glue over the behavior
  // asserted directly above; simulate the listener body — emit the drop for a
  // still-present departing connId, then remove it — to lock the ordering (the
  // departing peer is excluded by connId; every remaining peer is notified).
  it("close-hook ordering: emitting the drop before removing the peer reaches the survivors", async () => {
    const departing = mkConn(["alice/app1/default"]);
    const survivor = mkConn(["alice/app1/default"]);
    const connections = new Set([departing.provider, survivor.provider]);
    const cb = localBroadcastCallbacks(connections, env);
    // Listener body order: notify drop, THEN delete the departing connection.
    await cb.notifyDocEphemeralDrop(departing.provider.connId);
    connections.delete(departing.provider);
    expect(survivor.got[0]).toMatchObject({
      type: "vibes.diy.evt-doc-ephemeral-drop",
      originPeer: departing.provider.connId,
    });
    expect(departing.got).toHaveLength(0); // the departing peer is excluded by connId
  });
});
