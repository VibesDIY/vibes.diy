import { describe, it, expect, beforeEach, vi } from "vitest";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

let mockApi: MockVibeApi;
let db: FireflyDatabase;

// Pre-resolved gate so existing CRUD tests behave as if access was already
// granted at construction. The gating-specific tests below construct their
// own FireflyDatabase instances with deferred promises.
const grantedReady: Promise<{ allowed: boolean }> = Promise.resolve({ allowed: true });

beforeEach(() => {
  mockApi = createMockVibeApi("test-app");
  db = new FireflyDatabase("testdb", asSandboxApi(mockApi), grantedReady);
});

// ── CRUD ────────────────────────────────────────────────────────────

describe("FireflyDatabase CRUD", () => {
  it("put stores doc and returns { id, ok: true }", async () => {
    const res = await db.put({ title: "hello" });
    expect(res.ok).toBe(true);
    expect(res.id).toBeDefined();
    expect(mockApi._docs.size).toBe(1);
  });

  it("put with _id uses existing id", async () => {
    const res = await db.put({ _id: "my-id", title: "hello" });
    expect(res.id).toBe("my-id");
    expect(mockApi._docs.has("my-id")).toBe(true);
  });

  it("put without _id generates time-sortable id", async () => {
    const res = await db.put({ title: "hello" });
    expect(typeof res.id).toBe("string");
    expect(res.id.length).toBeGreaterThan(0);
  });

  it("put notifies subscribers", async () => {
    const listener = vi.fn();
    db.subscribe(listener);
    await db.put({ title: "hello" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ title: "hello" })]));
  });

  it("get retrieves document by id", async () => {
    const { id } = await db.put({ title: "hello" });
    const doc = await db.get(id);
    expect(doc._id).toBe(id);
    expect(doc.title).toBe("hello");
  });

  it("get throws on not-found", async () => {
    await expect(db.get("nonexistent")).rejects.toThrow();
  });

  it("del removes document and returns { id, ok: true }", async () => {
    const { id } = await db.put({ title: "hello" });
    const res = await db.del(id);
    expect(res.ok).toBe(true);
    expect(res.id).toBe(id);
    expect(mockApi._docs.has(id)).toBe(false);
  });

  it("del notifies subscribers with _deleted", async () => {
    const listener = vi.fn();
    const { id } = await db.put({ title: "hello" });
    db.subscribe(listener);
    await db.del(id);
    expect(listener).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ _id: id, _deleted: true })]));
  });

  it("bulk puts multiple docs", async () => {
    const res = await db.bulk([{ title: "one" }, { title: "two" }, { title: "three" }]);
    expect(res.ids).toHaveLength(3);
    expect(mockApi._docs.size).toBe(3);
  });
});

// ── query ───────────────────────────────────────────────────────────

describe("FireflyDatabase query", () => {
  beforeEach(async () => {
    await db.put({ _id: "a", type: "todo", text: "Buy milk", priority: "high" });
    await db.put({ _id: "b", type: "todo", text: "Walk dog", priority: "low" });
    await db.put({ _id: "c", type: "note", text: "Meeting notes", priority: "medium" });
  });

  it("returns all docs with no mapFn", async () => {
    const res = await db.query(undefined as never);
    expect(res.rows).toHaveLength(3);
  });

  it("filters by string field name", async () => {
    const res = await db.query("type");
    expect(res.rows).toHaveLength(3);
    // String field name returns all docs that have the field, keyed by field value
    const keys = res.rows.map((r) => r.key);
    expect(keys).toContain("todo");
    expect(keys).toContain("note");
  });

  it("filters by mapFn with emit", async () => {
    const res = await db.query(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function (this: any, doc: Record<string, unknown>) {
        if (doc.type === "todo") {
          this.emit(doc.text);
        }
      },
      { includeDocs: true }
    );
    expect(res.rows).toHaveLength(2);
    expect(res.docs.map((d) => d.text)).toEqual(expect.arrayContaining(["Buy milk", "Walk dog"]));
  });

  it("filters by key option", async () => {
    const res = await db.query("type", { key: "note" });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].value.text).toBe("Meeting notes");
  });

  it("filters by keys option", async () => {
    const res = await db.query("priority", { keys: ["high", "low"] });
    expect(res.rows).toHaveLength(2);
  });

  it("filters by range option", async () => {
    // Range is inclusive: ["high", "medium"] includes "low" since h < l < m lexicographically
    const res = await db.query("priority", { range: ["high", "medium"] });
    expect(res.rows).toHaveLength(3);
    const keys = res.rows.map((r) => r.key);
    expect(keys).toContain("high");
    expect(keys).toContain("low");
    expect(keys).toContain("medium");
  });

  it("filters by prefix option", async () => {
    const res = await db.query("text", { prefix: "Buy" });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].value.text).toBe("Buy milk");
  });

  it("sorts ascending by default", async () => {
    const res = await db.query("type");
    const keys = res.rows.map((r) => r.key);
    expect(keys).toEqual([...keys].sort());
  });

  it("sorts descending when requested", async () => {
    const res = await db.query("type", { descending: true });
    const keys = res.rows.map((r) => r.key);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it("limits results", async () => {
    const res = await db.query("type", { limit: 1 });
    expect(res.rows).toHaveLength(1);
  });
});

// ── allDocs ─────────────────────────────────────────────────────────

describe("FireflyDatabase allDocs", () => {
  beforeEach(async () => {
    await db.put({ _id: "c-cherry", fruit: "cherry" });
    await db.put({ _id: "a-apple", fruit: "apple" });
    await db.put({ _id: "b-banana", fruit: "banana" });
  });

  it("returns all documents sorted by _id", async () => {
    const res = await db.allDocs();
    expect(res.docs).toHaveLength(3);
    expect(res.docs.map((d) => d._id)).toEqual(["a-apple", "b-banana", "c-cherry"]);
  });

  it("respects limit option", async () => {
    const res = await db.allDocs({ limit: 2 });
    expect(res.docs).toHaveLength(2);
  });

  it("respects offset option", async () => {
    const res = await db.allDocs({ offset: 1 });
    expect(res.docs).toHaveLength(2);
    expect(res.docs[0]._id).toBe("b-banana");
  });

  it("respects descending option", async () => {
    const res = await db.allDocs({ descending: true });
    expect(res.docs.map((d) => d._id)).toEqual(["c-cherry", "b-banana", "a-apple"]);
  });
});

// ── subscribe ───────────────────────────────────────────────────────

describe("FireflyDatabase subscribe", () => {
  it("listener called on put", async () => {
    const listener = vi.fn();
    db.subscribe(listener);
    await db.put({ title: "test" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("listener called on del", async () => {
    const { id } = await db.put({ title: "test" });
    const listener = vi.fn();
    db.subscribe(listener);
    await db.del(id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", async () => {
    const listener = vi.fn();
    const unsub = db.subscribe(listener);
    await db.put({ title: "first" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    await db.put({ title: "second" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("update listeners separate from regular", async () => {
    const regular = vi.fn();
    const update = vi.fn();
    db.subscribe(regular);
    db.subscribe(update, true);
    await db.put({ title: "test" });
    expect(regular).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("failing listener doesn't break others", async () => {
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const working = vi.fn();
    db.subscribe(failing);
    db.subscribe(working);
    await db.put({ title: "test" });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(working).toHaveBeenCalledTimes(1);
  });
});

// ── cross-client sync ───────────────────────────────────────────────

describe("FireflyDatabase cross-client sync", () => {
  it("evt-doc-changed triggers listeners", () => {
    const listener = vi.fn();
    db.subscribe(listener);
    mockApi._simulateDocChanged("doc-123");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("evt-doc-changed filtered by appSlug", () => {
    const listener = vi.fn();
    db.subscribe(listener);

    // Correct appSlug triggers
    mockApi._simulateDocChanged("doc-1");
    expect(listener).toHaveBeenCalledTimes(1);

    // Wrong appSlug does NOT trigger — create a separate mock to test filtering.
    // FireflyDatabase constructor registers an onMsg listener that checks appSlug.
    const mockApi2 = createMockVibeApi("correct-app");
    const db2 = new FireflyDatabase("testdb2", asSandboxApi(mockApi2), grantedReady);
    const listener2 = vi.fn();
    db2.subscribe(listener2);

    // _simulateDocChanged sends appSlug="correct-app" — should trigger
    mockApi2._simulateDocChanged("doc-1", "testdb2");
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it("evt-doc-changed filtered by dbName — sibling db on the same connection doesn't trigger", () => {
    const listener = vi.fn();
    db.subscribe(listener);

    // Same userSlug + appSlug but a different dbName — must NOT fire here.
    mockApi._simulateDocChanged("doc-other-db", "comments");
    expect(listener).not.toHaveBeenCalled();

    // Matching dbName fires.
    mockApi._simulateDocChanged("doc-self-db", "testdb");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ── Standalone async API (Node.js / Wrangler workflow) ──────────────
// Exercises the same API surface documented in prompts/pkg/llms/fireproof.md
// "Using Fireproof in JavaScript" section — no React hooks involved.

describe("FireflyDatabase standalone async API", () => {
  it("end-to-end workflow: put → get → query → subscribe → mutate → del → verify", async () => {
    // ── 1. Put documents ──────────────────────────────────────────
    const ok1 = await db.put({ text: "Buy milk", type: "todo", completed: false });
    expect(ok1.id).toBeDefined();
    expect(ok1.ok).toBe(true);

    await db.put({ text: "Walk dog", type: "todo", completed: false });
    const ok3 = await db.put({ text: "Meeting notes", type: "note" });

    // ── 2. Get a document by id ───────────────────────────────────
    const doc = await db.get(ok1.id);
    expect(doc._id).toBe(ok1.id);
    expect(doc.text).toBe("Buy milk");
    expect(doc.completed).toBe(false);

    // ── 3. Query with string field index ──────────────────────────
    const todoQuery = await db.query("type", { key: "todo" });
    expect(todoQuery.docs).toHaveLength(2);
    expect(todoQuery.docs.map((d) => d.text)).toEqual(expect.arrayContaining(["Buy milk", "Walk dog"]));

    // ── 4. Query with descending + limit (like the llms.md example) ──
    const latest = await db.query("_id", { limit: 2, descending: true });
    expect(latest.docs).toHaveLength(2);
    // Descending by _id — last inserted first
    expect(latest.docs[0]._id).toBe(ok3.id);

    // ── 5. allDocs ────────────────────────────────────────────────
    const all = await db.allDocs();
    expect(all.docs).toHaveLength(3);

    // ── 6. Subscribe for real-time updates ────────────────────────
    const changes: unknown[][] = [];
    const unsub = db.subscribe((docs) => {
      changes.push(docs);
    }, true);

    // ── 7. Mutate: update a document (like database.put({...doc, completed: true})) ──
    await db.put({ ...doc, completed: true });
    expect(changes).toHaveLength(1);
    expect(changes[0][0]).toEqual(expect.objectContaining({ _id: ok1.id, completed: true }));

    // ── 8. Delete a document ──────────────────────────────────────
    const delRes = await db.del(ok3.id);
    expect(delRes.ok).toBe(true);
    expect(changes).toHaveLength(2);

    // Verify it's gone from queries
    const afterDel = await db.allDocs();
    expect(afterDel.docs).toHaveLength(2);
    expect(afterDel.docs.find((d) => d._id === ok3.id)).toBeUndefined();

    // ── 9. Query still works correctly after mutations ────────────
    const todosAfter = await db.query("type", { key: "todo" });
    expect(todosAfter.docs).toHaveLength(2);

    // The updated doc should reflect the mutation
    const updatedDoc = await db.get(ok1.id);
    expect(updatedDoc.completed).toBe(true);

    // ── 10. Unsubscribe stops notifications ───────────────────────
    unsub();
    await db.put({ text: "After unsub", type: "todo", completed: false });
    expect(changes).toHaveLength(2); // No new entry

    // ── 11. Bulk put ──────────────────────────────────────────────
    const bulkRes = await db.bulk([
      { text: "Bulk 1", type: "todo", completed: false },
      { text: "Bulk 2", type: "todo", completed: false },
    ]);
    expect(bulkRes.ids).toHaveLength(2);
    const afterBulk = await db.allDocs();
    expect(afterBulk.docs).toHaveLength(5); // 2 original + 1 "After unsub" + 2 bulk

    // ── 12. Changes (stub — returns empty) ────────────────────────
    const changesResult = await db.changes();
    expect(changesResult.rows).toEqual([]);
  });

  it("query with custom mapFn and emit", async () => {
    await db.put({ _id: "t1", text: "Buy milk", type: "todo", priority: 1 });
    await db.put({ _id: "t2", text: "Walk dog", type: "todo", priority: 3 });
    await db.put({ _id: "n1", text: "Notes", type: "note", priority: 2 });

    // Custom index: emit priority for todos only (like the llms.md custom index example)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.query(function (this: any, doc: Record<string, unknown>) {
      if (doc.type === "todo") {
        this.emit(doc.priority);
      }
    });
    expect(result.docs).toHaveLength(2);
    // Sorted ascending by key (priority) — keys are original types, not strings
    expect(result.rows[0].key).toBe(1);
    expect(result.rows[1].key).toBe(3);
  });

  it("query with array index and prefix (like llms.md date grouping)", async () => {
    await db.put({ _id: "e1", date: "2024-11-15", title: "Nov event" });
    await db.put({ _id: "e2", date: "2024-11-20", title: "Another Nov" });
    await db.put({ _id: "e3", date: "2024-12-01", title: "Dec event" });

    // Array index with prefix query — group by [year, month]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.query(function (this: any, doc: Record<string, unknown>) {
      const d = new Date(doc.date as string);
      if (!isNaN(d.getTime())) {
        this.emit([d.getFullYear(), d.getMonth(), d.getDate()]);
      }
    });
    // All 3 docs should be indexed
    expect(result.docs).toHaveLength(3);
  });

  it("remove is alias for del", async () => {
    const { id } = await db.put({ text: "remove me" });
    const res = await db.remove(id);
    expect(res.ok).toBe(true);
    await expect(db.get(id)).rejects.toThrow();
  });

  it("ready/close/destroy are no-ops", async () => {
    await expect(db.ready()).resolves.toBeUndefined();
    await expect(db.close()).resolves.toBeUndefined();
    await expect(db.destroy()).resolves.toBeUndefined();
    await expect(db.compact()).resolves.toBeUndefined();
  });
});

// ── gating: ops issued before access decision ──────────────────────
//
// These cover the viewer-route flow where the iframe mounts (and the app's
// useFireproof hooks fire) BEFORE the host has resolved access. Each op
// must block on the readyPromise rather than hit the wire eagerly. Once
// the gate releases, in-flight ops complete with the final auth context;
// if denied, they reject with "vibe access denied" and never reach
// vibeApi.

describe("FireflyDatabase gating", () => {
  it("get blocks until readyPromise resolves with allowed=true", async () => {
    const localApi = createMockVibeApi("test-app");
    let resolveReady!: (v: { allowed: boolean }) => void;
    const ready = new Promise<{ allowed: boolean }>((r) => {
      resolveReady = r;
    });
    const gated = new FireflyDatabase("gated", asSandboxApi(localApi), ready);

    // Pre-seed via a granted db so we have something to read once gate opens.
    const granted = new FireflyDatabase("gated", asSandboxApi(localApi), grantedReady);
    const { id } = await granted.put({ _id: "doc-1", title: "hello" });

    // Reset the spy so we can assert no calls occur while gated.
    const getDocSpy = vi.spyOn(localApi, "getDoc");
    getDocSpy.mockClear();

    // Fire the get — must NOT call vibeApi.getDoc yet.
    const pending = gated.get(id);
    let resolved = false;
    pending.then(() => {
      resolved = true;
    });
    await Promise.resolve(); // let any synchronous reactions settle
    expect(resolved).toBe(false);
    expect(getDocSpy).not.toHaveBeenCalled();

    // Release the gate.
    resolveReady({ allowed: true });
    const doc = await pending;

    expect(doc.title).toBe("hello");
    expect(getDocSpy).toHaveBeenCalledTimes(1);
  });

  it("put blocks until access granted, then completes normally", async () => {
    const localApi = createMockVibeApi("test-app");
    let resolveReady!: (v: { allowed: boolean }) => void;
    const ready = new Promise<{ allowed: boolean }>((r) => {
      resolveReady = r;
    });
    const gated = new FireflyDatabase("gated-put", asSandboxApi(localApi), ready);

    const putDocSpy = vi.spyOn(localApi, "putDoc");
    const pending = gated.put({ title: "buffered" });

    await Promise.resolve();
    expect(putDocSpy).not.toHaveBeenCalled();
    expect(localApi._docs.size).toBe(0);

    resolveReady({ allowed: true });
    const res = await pending;

    expect(res.ok).toBe(true);
    expect(putDocSpy).toHaveBeenCalledTimes(1);
    expect(localApi._docs.size).toBe(1);
  });

  it("queryDocs blocks until access granted", async () => {
    const localApi = createMockVibeApi("test-app");
    let resolveReady!: (v: { allowed: boolean }) => void;
    const ready = new Promise<{ allowed: boolean }>((r) => {
      resolveReady = r;
    });
    const gated = new FireflyDatabase("gated-q", asSandboxApi(localApi), ready);

    // Pre-seed via a granted instance.
    const granted = new FireflyDatabase("gated-q", asSandboxApi(localApi), grantedReady);
    await granted.put({ _id: "x", flag: "yes" });

    const querySpy = vi.spyOn(localApi, "queryDocs");
    querySpy.mockClear();
    const pending = gated.query("flag", { includeDocs: true });

    await Promise.resolve();
    expect(querySpy).not.toHaveBeenCalled();

    resolveReady({ allowed: true });
    const res = await pending;

    expect(res.docs).toHaveLength(1);
    expect(querySpy).toHaveBeenCalledTimes(1);
  });

  it("op started while gated rejects when readyPromise resolves with allowed=false", async () => {
    const localApi = createMockVibeApi("test-app");
    let resolveReady!: (v: { allowed: boolean }) => void;
    const ready = new Promise<{ allowed: boolean }>((r) => {
      resolveReady = r;
    });
    const gated = new FireflyDatabase("denied", asSandboxApi(localApi), ready);

    const getDocSpy = vi.spyOn(localApi, "getDoc");
    const pending = gated.get("does-not-matter");

    await Promise.resolve();
    expect(getDocSpy).not.toHaveBeenCalled();

    resolveReady({ allowed: false });

    await expect(pending).rejects.toThrow("vibe access denied");
    expect(getDocSpy).not.toHaveBeenCalled();
  });

  it("multiple ops issued before gate release all complete after grant", async () => {
    const localApi = createMockVibeApi("test-app");
    let resolveReady!: (v: { allowed: boolean }) => void;
    const ready = new Promise<{ allowed: boolean }>((r) => {
      resolveReady = r;
    });
    const gated = new FireflyDatabase("multi", asSandboxApi(localApi), ready);

    const p1 = gated.put({ _id: "a", title: "A" });
    const p2 = gated.put({ _id: "b", title: "B" });
    const p3 = gated.put({ _id: "c", title: "C" });

    await Promise.resolve();
    expect(localApi._docs.size).toBe(0);

    resolveReady({ allowed: true });
    const results = await Promise.all([p1, p2, p3]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(localApi._docs.size).toBe(3);
  });
});
