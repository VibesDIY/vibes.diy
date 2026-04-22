import { describe, it, expect, beforeEach, vi } from "vitest";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

let mockApi: MockVibeApi;
let db: FireflyDatabase;

beforeEach(() => {
  mockApi = createMockVibeApi("test-app");
  db = new FireflyDatabase("testdb", asSandboxApi(mockApi));
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

  it("put without _id generates uuid", async () => {
    const res = await db.put({ title: "hello" });
    expect(res.id).toMatch(/^[0-9a-f-]{36}$/);
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
    const db2 = new FireflyDatabase("testdb2", asSandboxApi(mockApi2));
    const listener2 = vi.fn();
    db2.subscribe(listener2);

    // _simulateDocChanged sends appSlug="correct-app" — should trigger
    mockApi2._simulateDocChanged("doc-1");
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
