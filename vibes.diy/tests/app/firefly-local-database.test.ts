import { describe, it, expect, beforeEach } from "vitest";
import {
  LocalDatabase,
  getOrCreateLocalDb,
  hasAuthedBefore,
  markAuthedBefore,
  migrateLocalToCloud,
} from "../../vibe/runtime/firefly-local-database.js";
import type { FireflyQueryDatabase } from "../../vibe/runtime/firefly-database.js";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { createMockVibeApi, asSandboxApi } from "./mock-vibe-api.js";

// In-memory Storage stand-in (node has no localStorage).
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  } as Storage;
}

let storage: Storage;
let db: LocalDatabase;

beforeEach(() => {
  storage = memStorage();
  db = new LocalDatabase("localdb", storage);
});

// ── CRUD + persistence ──────────────────────────────────────────────

describe("LocalDatabase CRUD", () => {
  it("put stores a doc and mints a client id when absent", async () => {
    const res = await db.put({ title: "hi" });
    expect(res.ok).toBe(true);
    expect(typeof res.id).toBe("string");
    expect((await db.get(res.id)).title).toBe("hi");
  });

  it("put with _id round-trips; del removes", async () => {
    await db.put({ _id: "x", n: 1 });
    expect((await db.get("x")).n).toBe(1);
    await db.del("x");
    await expect(db.get("x")).rejects.toThrow(/not found/);
  });

  it("notifies subscribers on put and del", async () => {
    const seen: string[] = [];
    db.subscribe((docs) => seen.push(...docs.map((d) => d._id)));
    const { id } = await db.put({ _id: "s", v: 1 });
    await db.del(id);
    expect(seen).toEqual(["s", "s"]);
  });

  it("persists to storage and reloads in a fresh instance", async () => {
    await db.put({ _id: "keep", v: 42 });
    const reopened = new LocalDatabase("localdb", storage);
    expect((await reopened.get("keep")).v).toBe(42);
  });

  it("survives a corrupt storage payload (starts empty, no throw)", () => {
    storage.setItem("firefly-anon:db:corruptdb", "not json{");
    const fresh = new LocalDatabase("corruptdb", storage);
    expect(fresh.size).toBe(0);
  });
});

// ── shared query engine (parity with FireflyDatabase) ───────────────

describe("LocalDatabase query surface", () => {
  beforeEach(async () => {
    await db.put({ _id: "t1", type: "todo", priority: 1, date: "2024-11-15" });
    await db.put({ _id: "t2", type: "todo", priority: 3, date: "2024-11-20" });
    await db.put({ _id: "n1", type: "note", priority: 2, date: "2024-12-01" });
  });

  it("string index with { key }", async () => {
    const r = await db.query("type", { key: "todo" });
    expect(r.docs.map((d) => d._id).sort()).toEqual(["t1", "t2"]);
  });

  it("string index sorted, with { descending } and { limit }", async () => {
    const r = await db.query("priority", { descending: true, limit: 2 });
    expect(r.rows.map((row) => row.key)).toEqual([3, 2]);
  });

  it("function mapFn with emit", async () => {
    const r = await db.query(function (this: { emit: (k: unknown) => void }, doc: Record<string, unknown>) {
      if (doc.type === "todo") this.emit(doc.priority);
    });
    expect(r.rows.map((row) => row.key)).toEqual([1, 3]);
  });

  it("prefix query over an array key", async () => {
    await db.put({ _id: "e1", tags: ["a", "b"] });
    const r = await db.query((doc: Record<string, unknown>) => doc.tags as unknown, { prefix: ["a"] });
    expect(r.docs.map((d) => d._id)).toContain("e1");
  });

  it("allDocs sorts by _id and honors limit", async () => {
    const r = await db.allDocs({ limit: 2 });
    expect(r.docs.map((d) => d._id)).toEqual(["n1", "t1"]);
  });

  it("queryLive returns raw docs + materialized result for the instant path", async () => {
    const { result, serverDocs } = await db.queryLive("type", { key: "todo" });
    expect(result.docs).toHaveLength(2);
    expect(serverDocs.length).toBe(3);
  });
});

// ── authed-before flag (internal, per-db) ───────────────────────────

describe("hasAuthedBefore / markAuthedBefore", () => {
  it("defaults false, becomes true after mark, scoped per db name", () => {
    expect(hasAuthedBefore("a", storage)).toBe(false);
    markAuthedBefore("a", storage);
    expect(hasAuthedBefore("a", storage)).toBe(true);
    expect(hasAuthedBefore("b", storage)).toBe(false);
  });
});

// ── migration on first sign-in ──────────────────────────────────────

describe("migrateLocalToCloud", () => {
  it("migrates every local doc into the cloud, then clears local", async () => {
    await db.put({ _id: "d1", v: 1 });
    await db.put({ _id: "d2", v: 2 });
    const mock = createMockVibeApi("mig-app");
    const cloud = new FireflyDatabase("localdb", asSandboxApi(mock));

    const out = await migrateLocalToCloud(db, cloud, "alice");
    expect(out).toEqual({ migrated: 2, dropped: 0 });
    expect(mock._docs.has("d1")).toBe(true);
    expect(mock._docs.has("d2")).toBe(true);
    expect(db.size).toBe(0);
  });

  it("applies the migrate transform and drops docs when it returns falsy", async () => {
    await db.put({ _id: "keep", keep: true });
    await db.put({ _id: "drop", keep: false });
    const mock = createMockVibeApi("mig-app");
    const cloud = new FireflyDatabase("localdb", asSandboxApi(mock));

    const out = await migrateLocalToCloud(db, cloud, "bob", (doc) => (doc.keep ? { ...doc, owner: "bob" } : null));
    expect(out).toEqual({ migrated: 1, dropped: 1 });
    expect(mock._docs.has("keep")).toBe(true);
    expect(mock._docs.has("drop")).toBe(false);
    expect((mock._docs.get("keep") as { owner?: string }).owner).toBe("bob");
  });

  it("leaves local storage intact when a cloud write fails (no data loss)", async () => {
    await db.put({ _id: "d1", v: 1 });
    const failingCloud = {
      put: async () => {
        throw new Error("access denied");
      },
    } as unknown as FireflyQueryDatabase;

    await expect(migrateLocalToCloud(db, failingCloud, "carol")).rejects.toThrow(/access denied/);
    expect(db.size).toBe(1); // not cleared — recoverable
  });

  it("no-ops on an empty local store", async () => {
    const mock = createMockVibeApi("mig-app");
    const cloud = new FireflyDatabase("localdb", asSandboxApi(mock));
    expect(await migrateLocalToCloud(db, cloud, "dave")).toEqual({ migrated: 0, dropped: 0 });
  });
});

// ── instance cache ──────────────────────────────────────────────────

describe("getOrCreateLocalDb", () => {
  it("returns a stable instance per name", () => {
    expect(getOrCreateLocalDb("cache-a")).toBe(getOrCreateLocalDb("cache-a"));
    expect(getOrCreateLocalDb("cache-a")).not.toBe(getOrCreateLocalDb("cache-b"));
  });
});
