import { describe, expect, it, vi } from "vitest";
import { localBroadcastCallbacks, WSSendProvider } from "@vibes.diy/api-svc";
import type { CFEnv, EvtViewerGrantsChanged } from "@vibes.diy/api-types";

// Minimal CFEnv stub — localBroadcastCallbacks only reads ENVIRONMENT.
const testEnv = { ENVIRONMENT: "test" } as unknown as CFEnv;
const prodEnv = { ENVIRONMENT: "prod" } as unknown as CFEnv;

function makeMinimalWSSendProvider(): WSSendProvider {
  const fakeWs = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    send: () => {},
  } as unknown as WebSocket;
  return new WSSendProvider(fakeWs);
}

function makeConnectionsOfSize(n: number): Set<WSSendProvider> {
  const connections = new Set<WSSendProvider>();
  for (let i = 0; i < n; i++) {
    connections.add(makeMinimalWSSendProvider());
  }
  return connections;
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

describe("localBroadcastCallbacks hot-vibe threshold warn", () => {
  it("does NOT warn on notifyDocChanged when connections are below threshold", async () => {
    const warns: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warns.push(a.join(" ")));

    const connections = makeConnectionsOfSize(5);
    const callbacks = localBroadcastCallbacks(connections, prodEnv);

    await callbacks.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "my-app", dbName: "default", docId: "doc-1" },
      "sender-conn-id"
    );

    spy.mockRestore();

    expect(warns.some((w) => w.includes("hot-vibe fanout"))).toBe(false);
  });

  it("emits console.warn on notifyDocChanged when connections reach threshold", async () => {
    const warns: unknown[][] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warns.push(a));

    const connections = makeConnectionsOfSize(200);
    const callbacks = localBroadcastCallbacks(connections, prodEnv);

    await callbacks.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "hot-app", dbName: "default", docId: "doc-1" },
      "sender-conn-id"
    );

    spy.mockRestore();

    const hotWarn = warns.find((args) => args.some((a) => typeof a === "string" && a.includes("hot-vibe fanout")));
    expect(hotWarn).toBeDefined();
    // Check that conns= value is present as a separate arg
    expect(hotWarn).toContain("conns=");
    expect(hotWarn).toContain(200);
  });

  it("does NOT warn on notifyViewerGrantsChanged when connections are below threshold", async () => {
    const warns: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warns.push(a.join(" ")));

    const connections = makeConnectionsOfSize(10);
    const callbacks = localBroadcastCallbacks(connections, prodEnv);

    const evt: EvtViewerGrantsChanged = {
      type: "vibes.diy.evt-viewer-grants-changed",
      ownerHandle: "alice",
      appSlug: "my-app",
    };

    await callbacks.notifyViewerGrantsChanged(evt, "sender-conn-id");

    spy.mockRestore();

    expect(warns.some((w) => w.includes("hot-vibe fanout"))).toBe(false);
  });

  it("emits console.warn on notifyViewerGrantsChanged when connections reach threshold", async () => {
    const warns: unknown[][] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warns.push(a));

    const connections = makeConnectionsOfSize(200);
    const callbacks = localBroadcastCallbacks(connections, prodEnv);

    const evt: EvtViewerGrantsChanged = {
      type: "vibes.diy.evt-viewer-grants-changed",
      ownerHandle: "alice",
      appSlug: "hot-app",
    };

    await callbacks.notifyViewerGrantsChanged(evt, "sender-conn-id");

    spy.mockRestore();

    const hotWarn = warns.find((args) => args.some((a) => typeof a === "string" && a.includes("hot-vibe fanout")));
    expect(hotWarn).toBeDefined();
    expect(hotWarn).toContain("conns=");
    expect(hotWarn).toContain(200);
  });

  it("also warns in prod env (not gated by shouldLog)", async () => {
    const warns: unknown[][] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warns.push(a));

    const connections = makeConnectionsOfSize(200);
    const callbacks = localBroadcastCallbacks(connections, prodEnv);

    await callbacks.notifyDocChanged(
      { ownerHandle: "bob", appSlug: "viral-app", dbName: "default", docId: "doc-x" },
      "sender-conn-id"
    );

    spy.mockRestore();

    expect(warns.some((args) => args.some((a) => typeof a === "string" && a.includes("hot-vibe fanout")))).toBe(true);
  });
});
