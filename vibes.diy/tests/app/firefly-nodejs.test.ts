/**
 * Node.js / Wrangler integration test.
 *
 * Mimics how an external consumer would use the Firefly database API
 * following the patterns documented in prompts/pkg/llms/fireproof.md.
 * This is the future public API surface for non-vibes npm apps.
 *
 * Uses `fireproof("name")` factory (no React, no hooks).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { fireproof, registerFirefly } from "../../vibe/runtime/use-firefly.js";
import { createMockVibeApi, asSandboxApi } from "./mock-vibe-api.js";

// ── Setup: register once, then use fireproof() factory ──────────────

beforeAll(async () => {
  const mockApi = createMockVibeApi("nodejs-test");
  await registerFirefly(asSandboxApi(mockApi));
});

// ── From llms/fireproof.md: "Using Fireproof in JavaScript" ────────

describe("Node.js standalone API (fireproof.md patterns)", () => {
  it("fireproof() factory creates a database", () => {
    const database = fireproof("my-ledger");
    expect(database).toBeDefined();
    expect(database.name).toBe("my-ledger");
  });

  it("put / get / query workflow", async () => {
    // Exact pattern from the docs:
    //   const ok = await database.put({ text: "Sample Data" });
    //   const doc = await database.get(ok.id);
    //   const latest = await database.query("_id", { limit: 10, descending: true });
    const database = fireproof("put-get-query");

    const ok = await database.put({ text: "Sample Data" });
    expect(ok.id).toBeDefined();

    const doc = await database.get(ok.id);
    expect(doc.text).toBe("Sample Data");
    expect(doc._id).toBe(ok.id);

    // Add more docs so query is interesting
    await database.put({ text: "Second" });
    await database.put({ text: "Third" });

    const latest = await database.query("_id", { limit: 10, descending: true });
    expect(latest.docs.length).toBe(3);
    // Descending: most recent first
    expect(latest.docs[0].text).toBe("Third");
  });

  it("update document with database.put({ ...doc, field: newValue })", async () => {
    // Pattern from docs: onClick={() => database.put({ ...doc, favorite: !doc.favorite })}
    const database = fireproof("update-doc");

    const ok = await database.put({ text: "todo", completed: false });
    const doc = await database.get(ok.id);

    await database.put({ ...doc, completed: true });

    const updated = await database.get(ok.id);
    expect(updated.completed).toBe(true);
  });

  it("delete with database.del(doc._id)", async () => {
    // Pattern from docs: onClick={() => database.del(doc._id)}
    const database = fireproof("del-doc");

    const ok = await database.put({ text: "delete me" });
    await database.del(ok.id);

    await expect(database.get(ok.id)).rejects.toThrow();
  });

  it("subscribe for real-time updates", async () => {
    // Pattern from docs:
    //   database.subscribe((changes) => {
    //     changes.forEach((change) => { ... });
    //   }, true);
    const database = fireproof("subscribe-test");
    const received: unknown[] = [];

    database.subscribe((changes) => {
      changes.forEach((change) => {
        received.push(change);
      });
    }, true);

    await database.put({ text: "hello", completed: true });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(expect.objectContaining({ text: "hello", completed: true }));
  });

  it("query by key (useLiveQuery pattern without React)", async () => {
    // Pattern from docs:
    //   const { docs } = useLiveQuery("agentName", { key: "agent-1" });
    // Standalone equivalent: database.query("agentName", { key: "agent-1" })
    const database = fireproof("query-by-key");

    await database.put({ agentName: "agent-1", task: "fetch" });
    await database.put({ agentName: "agent-1", task: "parse" });
    await database.put({ agentName: "agent-2", task: "store" });

    const result = await database.query("agentName", { key: "agent-1" });
    expect(result.docs).toHaveLength(2);
    expect(result.docs.every((d) => d.agentName === "agent-1")).toBe(true);
  });

  it("query by range", async () => {
    // Pattern from docs:
    //   const { docs } = useLiveQuery("agentRating", { range: [3, 5] });
    const database = fireproof("query-range");

    await database.put({ agentRating: 1, name: "low" });
    await database.put({ agentRating: 3, name: "mid" });
    await database.put({ agentRating: 5, name: "high" });
    await database.put({ agentRating: 7, name: "very high" });

    const result = await database.query("agentRating", { range: [3, 5] });
    expect(result.docs).toHaveLength(2);
    expect(result.docs.map((d) => d.name)).toEqual(expect.arrayContaining(["mid", "high"]));
  });

  it("counter pattern: write one doc per event, query by key", async () => {
    // Pattern from docs:
    //   database.put({ counter: "my-event-name" });
    //   const { docs } = useLiveQuery("counter", { key: "my-event-name" });
    //   const counterValue = docs.length;
    const database = fireproof("counter-pattern");

    await database.put({ counter: "page-view" });
    await database.put({ counter: "page-view" });
    await database.put({ counter: "page-view" });
    await database.put({ counter: "click" });

    const result = await database.query("counter", { key: "page-view" });
    const counterValue = result.docs.length;
    expect(counterValue).toBe(3);
  });

  it("custom index function with return value", async () => {
    // Pattern from docs:
    //   const { docs } = useLiveQuery((doc) => {
    //     if (doc.type == "listing_v1") return doc.sellerId;
    //     else if (doc.type == "listing") return doc.userId;
    //   }, { key: routeParams.sellerId });
    const database = fireproof("custom-index");

    await database.put({ type: "listing_v1", sellerId: "seller-A", title: "Old listing" });
    await database.put({ type: "listing", userId: "seller-A", title: "New listing" });
    await database.put({ type: "listing", userId: "seller-B", title: "Other" });

    const result = await database.query(
      (doc) => {
        if (doc.type === "listing_v1") return doc.sellerId;
        else if (doc.type === "listing") return doc.userId;
      },
      { key: "seller-A" }
    );
    expect(result.docs).toHaveLength(2);
    expect(result.docs.map((d) => d.title)).toEqual(expect.arrayContaining(["Old listing", "New listing"]));
  });

  it("array index with prefix query", async () => {
    // Pattern from docs:
    //   useLiveQuery((doc) => {
    //     const date = new Date(doc.date);
    //     return [date.getFullYear(), date.getMonth(), date.getDate()];
    //   }, { prefix: [2024, 11] });
    const database = fireproof("array-prefix");

    await database.put({ date: "2024-12-15", title: "Dec 15" }); // month=11 (0-indexed)
    await database.put({ date: "2024-12-20", title: "Dec 20" }); // month=11
    await database.put({ date: "2025-01-05", title: "Jan 5" }); // month=0

    const result = await database.query(
      (doc) => {
        const d = new Date(doc.date as string);
        if (!isNaN(d.getTime())) return [d.getFullYear(), d.getMonth(), d.getDate()];
      },
      { prefix: [2024, 11] }
    );
    expect(result.docs).toHaveLength(2);
    expect(result.docs.map((d) => d.title)).toEqual(expect.arrayContaining(["Dec 15", "Dec 20"]));
  });

  it("sortable list with compound array index", async () => {
    // Pattern from docs:
    //   useLiveQuery((doc) => [doc.list, doc.position], { prefix: ["xyz"] });
    const database = fireproof("sortable-list");

    await database.put({ list: "xyz", position: 1000, label: "first" });
    await database.put({ list: "xyz", position: 2000, label: "second" });
    await database.put({ list: "xyz", position: 3000, label: "third" });
    await database.put({ list: "other", position: 500, label: "other list" });

    const result = await database.query((doc) => [doc.list, doc.position], { prefix: ["xyz"] });
    expect(result.docs).toHaveLength(3);
    // Should be sorted by position within the list
    expect(result.docs.map((d) => d.label)).toEqual(["first", "second", "third"]);
  });
});
