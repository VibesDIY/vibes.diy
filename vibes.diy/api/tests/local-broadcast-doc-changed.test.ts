import { describe, expect, it } from "vitest";
import { JSONEnDecoderSingleton, TestWSPair } from "@adviser/cement";
import { localBroadcastCallbacks, WSSendProvider } from "@vibes.diy/api-svc";

// Minimal CFEnv stand-in: only ENVIRONMENT is read (for shouldLog).
const env = { ENVIRONMENT: "test" } as never;

const ende = JSONEnDecoderSingleton();

function decodePayload(raw: ArrayBuffer | Uint8Array | string): unknown {
  const obj = ende.parse<{ payload?: unknown }>(raw).Ok();
  return obj.payload;
}

describe("localBroadcastCallbacks.notifyDocChanged routing decouple (#2301)", () => {
  it("routes by channel but delivers payload with the real dbName", async () => {
    const pair = TestWSPair.create();
    const receiver = new WSSendProvider(pair.p2 as unknown as WebSocket);
    receiver.subscribedDocKeys.add("alice/app1/default/doc-channel-1");

    const connections = new Set<WSSendProvider>([receiver]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(decodePayload(e.data));

    await cb.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", channel: "doc-channel-1" },
      "sender-conn-id"
    );

    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      type: "vibes.diy.evt-doc-changed",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default",
      docId: "d1",
      channel: "doc-channel-1",
    });
  });

  it("excludes the originating connection", async () => {
    const pair = TestWSPair.create();
    const sender = new WSSendProvider(pair.p2 as unknown as WebSocket);
    sender.subscribedDocKeys.add("alice/app1/default/doc-channel-1");
    const connections = new Set<WSSendProvider>([sender]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(e.data);

    await cb.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", channel: "doc-channel-1" },
      sender.connId
    );
    expect(got).toHaveLength(0);
  });

  it("falls back to dbName routing when no channel is given", async () => {
    const pair = TestWSPair.create();
    const receiver = new WSSendProvider(pair.p2 as unknown as WebSocket);
    receiver.subscribedDocKeys.add("alice/app1/default");
    const connections = new Set<WSSendProvider>([receiver]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(decodePayload(e.data));

    await cb.notifyDocChanged({ ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1" }, "sender");
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ dbName: "default", docId: "d1" });
    expect((got[0] as { channel?: string }).channel).toBeUndefined();
  });
});
