/**
 * Read-after-write race in FireflyDatabase (#2268):
 *   await db.put(doc)  →  server confirms
 *   await db.get(id)   →  "not-found" because server hasn't committed yet
 *
 * FireflyDatabase has no local write cache — both put and get are
 * independent server round-trips. Callers must use the doc they already
 * built instead of reading back after put.
 *
 * The racing mock confirms putDoc but delays the commit (setTimeout 0),
 * matching real postMessage traffic where get-doc returns not-found
 * 187ms after put-doc confirms ok.
 */

import { describe, it, expect } from "vitest";
import { Result } from "@adviser/cement";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import type { FireflyTransport } from "../../vibe/runtime/firefly-database.js";

function createRacingTransport(): FireflyTransport {
  const committed = new Map<string, Record<string, unknown>>();
  let idCounter = 0;

  return {
    svc: { vibeApp: { appSlug: "test-app", ownerHandle: "test-user", fsId: "fs-mock" } },

    putDoc: async (doc: Record<string, unknown>, docId?: string) => {
      const id = docId ?? `put-${++idCounter}`;
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
        docs: [...committed.values()].map((d) => ({ ...d, _id: (d._id as string) ?? "" })),
      }),

    deleteDoc: async (id: string) => {
      committed.delete(id);
      return Result.Ok({ type: "vibes.diy.res-delete-doc" as const, status: "ok" as const, id });
    },

    subscribeDocs: async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const }),

    setDbAcl: async () => Result.Ok({ tid: "mock", type: "vibes.diy.res-set-db-acl" as const, status: "ok" as const }),

    onMsg: () => {},
  };
}

describe("FireflyDatabase put→get race (#2268)", () => {
  it("get after put throws not-found under commit lag", async () => {
    const transport = createRacingTransport();
    const db = new FireflyDatabase("race-test", transport);

    const doc = { _id: "img-race-1", type: "image", prompt: "a sunset" };
    const putResult = await db.put(doc);
    expect(putResult.ok).toBe(true);

    await expect(db.get("img-race-1")).rejects.toThrow(/not-found/);
  });

  it("callers should use the doc they built, not read back after put", async () => {
    const transport = createRacingTransport();
    const db = new FireflyDatabase("race-test-2", transport);

    const doc = { _id: "img-race-2", type: "image", prompt: "a sunset" };
    const putResult = await db.put(doc);
    expect(putResult.ok).toBe(true);
    expect(putResult.id).toBe("img-race-2");

    const saved = { ...doc, _id: putResult.id };
    expect(saved._id).toBe("img-race-2");
    expect(saved.type).toBe("image");
  });
});
