import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

describe("FireflyDatabase ephemeral overlay (#1756)", () => {
  let mockApi: MockVibeApi;
  let db: FireflyDatabase;
  beforeEach(() => {
    if (typeof globalThis.window === "undefined") {
      (globalThis as unknown as Record<string, unknown>).window = globalThis;
    }
    mockApi = createMockVibeApi("test-app");
    db = new FireflyDatabase("testdb", asSandboxApi(mockApi));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("folds an ephemeral snapshot into get() for an overlay-only _id", async () => {
    mockApi._simulateEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 7 });
    const doc = await db.get("cursor-a");
    expect(doc).toMatchObject({ _id: "cursor-a", type: "cursor", curX: 7 });
  });

  it("merges the overlay over a persisted doc in get()", async () => {
    await db.put({ _id: "shared", type: "cursor", curX: 0, note: "persisted" });
    mockApi._simulateEphemeral("shared", { _id: "shared", type: "cursor", curX: 42 });
    const doc = await db.get("shared");
    // overlay wins for curX; persisted-only field survives
    expect(doc).toMatchObject({ _id: "shared", curX: 42, note: "persisted" });
  });

  it("overlay-only _id appears as a query() row (carries indexed field)", async () => {
    mockApi._simulateEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 7 });
    const res = await db.query("type", { key: "cursor", includeDocs: true });
    expect(res.docs.map((d: { _id: string }) => d._id)).toContain("cursor-a");
  });

  it("overlay-only _id appears in allDocs()", async () => {
    mockApi._simulateEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 7 });
    const res = await db.allDocs();
    expect(res.docs.map((d: { _id: string }) => d._id)).toContain("cursor-a");
  });

  it("last-write-wins on a shared _id", async () => {
    mockApi._simulateEphemeral("shared", { _id: "shared", type: "c", v: 1 }, { originPeer: "p1" });
    mockApi._simulateEphemeral("shared", { _id: "shared", type: "c", v: 2 }, { originPeer: "p2" });
    expect((await db.get("shared")).v).toBe(2);
  });

  it("drop removes only the departed peer's slices", async () => {
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    mockApi._simulateEphemeral("c-b", { _id: "c-b", type: "cursor" }, { originPeer: "p2" });
    mockApi._simulateEphemeralDrop("p1");
    const rows = (await db.query("type", { key: "cursor", includeDocs: true })).docs.map((d: { _id: string }) => d._id);
    expect(rows).toContain("c-b");
    expect(rows).not.toContain("c-a");
  });

  it("notifies listeners on inbound ephemeral so hooks refetch", () => {
    const listener = vi.fn();
    db.subscribe(listener);
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" });
    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ _id: "c-a" })]);
  });

  it("notifies listeners on drop so hooks refetch", () => {
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    const listener = vi.fn();
    db.subscribe(listener);
    mockApi._simulateEphemeralDrop("p1");
    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ _id: "c-a" })]);
  });

  it("ignores an ephemeral for a different db", async () => {
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { dbName: "otherdb" });
    const res = await db.query("type", { key: "cursor", includeDocs: true });
    expect(res.docs.map((d: { _id: string }) => d._id)).not.toContain("c-a");
  });

  it("TTL backstop purges a stale slice with no drop event", async () => {
    vi.useFakeTimers();
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    vi.advanceTimersByTime(20_000); // > TTL
    const rows = (await db.query("type", { key: "cursor", includeDocs: true })).docs.map((d: { _id: string }) => d._id);
    expect(rows).not.toContain("c-a");
  });

  it("get() on an expired overlay-only _id throws not-found", async () => {
    vi.useFakeTimers();
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    vi.advanceTimersByTime(20_000);
    await expect(db.get("c-a")).rejects.toThrow(/Failed to get document/);
  });

  it("broadcastEphemeral delegates to the transport with this db's name", () => {
    const calls: { docId: string; doc: Record<string, unknown>; dbName?: string }[] = [];
    const api = createMockVibeApi("test-app");
    // Override the no-op mock to capture the delegated call.
    (api as unknown as { broadcastEphemeral: (d: string, doc: Record<string, unknown>, db?: string) => void }).broadcastEphemeral =
      (docId, doc, dbName) => calls.push({ docId, doc, dbName });
    const localDb = new FireflyDatabase("mydb", asSandboxApi(api));
    localDb.broadcastEphemeral("cursor-x", { _id: "cursor-x", curX: 3 });
    expect(calls).toEqual([{ docId: "cursor-x", doc: { _id: "cursor-x", curX: 3 }, dbName: "mydb" }]);
  });
});
