import { describe, expect, it, vi } from "vitest";
import { localBroadcastCallbacks } from "@vibes.diy/api-svc";
import { WSSendProvider } from "@vibes.diy/api-svc";
import type { CFEnv } from "@vibes.diy/api-types";
import type { EvtViewerGrantsChanged } from "@vibes.diy/api-types";

// Minimal CFEnv stub — localBroadcastCallbacks only reads ENVIRONMENT.
const testEnv = { ENVIRONMENT: "test" } as unknown as CFEnv;

function makeMinimalWSSendProvider(): WSSendProvider {
  const fakeWs = {
    send: () => {},
  } as unknown as WebSocket;
  return new WSSendProvider(fakeWs);
}

describe("localBroadcastCallbacks fanout structured logs", () => {
  it("logs per-vibe connection count on viewer-grants fanout", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));

    const connections = new Set<WSSendProvider>();
    connections.add(makeMinimalWSSendProvider());
    connections.add(makeMinimalWSSendProvider());

    const callbacks = localBroadcastCallbacks(connections, testEnv);

    const evt: EvtViewerGrantsChanged = {
      type: "vibes.diy.evt-viewer-grants-changed",
      ownerHandle: "alice",
      appSlug: "my-app",
    };

    await callbacks.notifyViewerGrantsChanged(evt, "sender-conn-id");

    spy.mockRestore();

    expect(logs.some((l) => l.includes("[AppSessions] viewerGrants fanout") && l.includes("conns="))).toBe(true);
  });

  it("logs per-vibe connection count on doc-changed fanout", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));

    const connections = new Set<WSSendProvider>();
    connections.add(makeMinimalWSSendProvider());

    const callbacks = localBroadcastCallbacks(connections, testEnv);

    await callbacks.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "my-app", dbName: "default", docId: "doc-1" },
      "sender-conn-id"
    );

    spy.mockRestore();

    expect(logs.some((l) => l.includes("[AppSessions] docChanged fanout") && l.includes("conns="))).toBe(true);
  });
});
