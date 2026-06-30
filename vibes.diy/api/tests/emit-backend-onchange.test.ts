// Slice B5 (#2856): emitBackendOnChange — the shared post-commit emit used by
// putDoc/deleteDoc. Dark-gated, loop-guarded, fire-and-forget, oldDoc from the
// committed predecessor.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MsgBase } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { emitBackendOnChange } from "@vibes.diy/api-svc/intern/emit-backend-onchange.js";
import { MAX_ONCHANGE_DEPTH } from "@vibes.diy/api-svc/intern/backend-onchange-policy.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("emitBackendOnChange (#2856 B5)", { timeout: 30000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let posted: MsgBase[];

  const insertRev = async (over: Record<string, unknown>) => {
    const t = ctx.vibesCtx.sql.tables.appDocuments;
    await ctx.vibesCtx.sql.db.insert(t).values({
      ownerHandle: "owner",
      appSlug: "app",
      dbName: "vibes",
      docId: "d1",
      seq: 1,
      userId: "u1",
      data: {},
      deleted: 0,
      created: "2026-06-30T00:00:00Z",
      ...over,
    });
  };

  const base = (over: Record<string, unknown> = {}) => ({
    ownerHandle: "owner",
    appSlug: "app",
    dbName: "vibes",
    docId: "d1",
    seq: 2,
    deleted: false,
    doc: { _id: "d1", v: 2 },
    originDepth: 0,
    writerUserId: "u1",
    ...over,
  });

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    ctx = await createVibeDiyTestCtx(sthis, deviceCA);
    // Capture enqueues.
    posted = [];
    ctx.vibesCtx.postQueue = async (msg: MsgBase) => {
      posted.push(msg);
    };
  });

  beforeEach(() => {
    posted.length = 0;
    ctx.vibesCtx.params.vibes.env.BACKEND_JS = "loader";
  });

  it("is a no-op when BACKEND_JS is off (dark) — no enqueue, no read", async () => {
    ctx.vibesCtx.params.vibes.env.BACKEND_JS = "off";
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "dark" }));
    expect(posted).toHaveLength(0);
  });

  it("emits a create (no predecessor ⇒ oldDoc null, depth 1)", async () => {
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "create-1", seq: 1 }));
    expect(posted).toHaveLength(1);
    const p = posted[0].payload as Record<string, unknown>;
    expect(p.type).toBe("vibes.diy.evt-backend-onChange");
    expect(p.deleted).toBe(false);
    expect(p.depth).toBe(1);
    expect(p.oldDoc).toBe(null);
    expect(p.seq).toBe(1);
    expect(p.writerUserId).toBe("u1");
  });

  it("emits an update with oldDoc = the committed predecessor", async () => {
    await insertRev({ docId: "upd-1", seq: 1, data: { _id: "upd-1", v: 1 } });
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "upd-1", seq: 2, doc: { _id: "upd-1", v: 2 } }));
    expect(posted).toHaveLength(1);
    const p = posted[0].payload as Record<string, unknown>;
    expect(p.oldDoc).toEqual({ _id: "upd-1", v: 1 });
    expect(p.deleted).toBe(false);
  });

  it("a tombstone predecessor reads as oldDoc null (doc didn't logically exist)", async () => {
    await insertRev({ docId: "tomb-1", seq: 1, data: {}, deleted: 1 });
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "tomb-1", seq: 2 }));
    expect((posted[0].payload as Record<string, unknown>).oldDoc).toBe(null);
  });

  it("emits a delete with deleted:true and the prior doc as oldDoc", async () => {
    await insertRev({ docId: "del-1", seq: 1, data: { _id: "del-1", v: 1 } });
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "del-1", seq: 2, deleted: true, doc: {} }));
    const p = posted[0].payload as Record<string, unknown>;
    expect(p.deleted).toBe(true);
    expect(p.oldDoc).toEqual({ _id: "del-1", v: 1 });
  });

  it("suppresses emission at the loop-guard depth cap", async () => {
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "cap-1", originDepth: MAX_ONCHANGE_DEPTH }));
    expect(posted).toHaveLength(0);
  });

  it("a backend write below the cap emits the next generation", async () => {
    await emitBackendOnChange(ctx.vibesCtx, base({ docId: "gen-1", seq: 1, originDepth: 1 }));
    expect((posted[0].payload as Record<string, unknown>).depth).toBe(2);
  });

  it("never throws when postQueue fails — the write is not failed (just logged)", async () => {
    ctx.vibesCtx.postQueue = async () => {
      throw new Error("queue down");
    };
    await expect(emitBackendOnChange(ctx.vibesCtx, base({ docId: "boom", seq: 1 }))).resolves.toBeUndefined();
    // restore the spy for any later test
    ctx.vibesCtx.postQueue = async (msg: MsgBase) => {
      posted.push(msg);
    };
  });
});
