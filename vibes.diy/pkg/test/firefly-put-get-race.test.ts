/**
 * Reproduce the read-after-write race in FireflyDatabase:
 *   await db.put(doc)  →  server confirms
 *   await db.get(id)   →  "not-found" because server hasn't committed yet
 *
 * Issue: https://github.com/VibesDIY/vibes.diy/issues/2268
 *
 * This test uses a mock transport where putDoc confirms immediately but
 * the row isn't visible to getDoc until the next macrotask — matching the
 * real behavior observed in postMessage traffic (put-doc → ok, then
 * get-doc → not-found 187ms later).
 *
 * The test is RED: it asserts that put-then-get returns the doc, which
 * fails because FireflyDatabase has no local write cache and both
 * operations are independent server round-trips.
 */

import { describe, it, expect } from "vitest";
import { Result } from "@adviser/cement";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import type { FireflyTransport } from "../../vibe/runtime/firefly-database.js";

function createRacingTransport(): FireflyTransport {
  const committed = new Map<string, Record<string, unknown>>();
  let idCounter = 0;

  return {
    svc: { vibeApp: { appSlug: "test-app", ownerHandle: "test-user" } },

    putDoc: async (doc: Record<string, unknown>, docId?: string) => {
      const id = docId ?? `put-${++idCounter}`;
      // Server confirms the write, but the row lands in D1's commit queue
      // and isn't readable until the next event-loop tick.
      setTimeout(() => committed.set(id, { ...doc, _id: id }), 0);
      return Result.Ok({
        type: "vibes.diy.res-put-doc" as const,
        status: "ok" as const,
        id,
      });
    },

    getDoc: async (docId: string) => {
      const doc = committed.get(docId);
      if (!doc) {
        return Result.Ok({
          type: "vibes.diy.res-get-doc" as const,
          status: "not-found" as const,
          id: docId,
        });
      }
      return Result.Ok({
        type: "vibes.diy.res-get-doc" as const,
        status: "ok" as const,
        id: docId,
        doc: { ...doc },
      });
    },

    queryDocs: async () =>
      Result.Ok({
        type: "vibes.diy.res-query-docs" as const,
        status: "ok" as const,
        docs: [...committed.values()],
      }),

    deleteDoc: async (id: string) => {
      committed.delete(id);
      return Result.Ok({ type: "vibes.diy.res-delete-doc" as const, status: "ok" as const, id });
    },

    subscribeDocs: async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const }),

    setDbAcl: async () => Result.Ok({ type: "vibes.diy.res-set-db-acl" as const, status: "ok" as const }),

    onMsg: () => {},
  };
}

describe("FireflyDatabase put→get race (#2268)", () => {
  it("get after put returns the document, not not-found", async () => {
    const transport = createRacingTransport();
    const db = new FireflyDatabase("race-test", transport);

    const doc = { _id: "img-race-1", type: "image", prompt: "a sunset" };
    const putResult = await db.put(doc);
    expect(putResult.ok).toBe(true);
    expect(putResult.id).toBe("img-race-1");

    // This is the race: get immediately after put should return the doc.
    // In the real system (and our racing mock), the server hasn't committed
    // the write yet, so get returns not-found and FireflyDatabase throws.
    const saved = await db.get("img-race-1");
    expect(saved).toBeDefined();
    expect(saved._id).toBe("img-race-1");
    expect((saved as Record<string, unknown>).type).toBe("image");
  });
});
