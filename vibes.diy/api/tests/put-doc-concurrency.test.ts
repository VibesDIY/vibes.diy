import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { and, eq } from "drizzle-orm";
import { allocateAndInsertRevision, docLockKey, SeqConflictError } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Regression + design coverage for issue #2506: concurrent allocations to the
// same docId must resolve to last-write-wins distinct revisions instead of
// hard-failing on the seq primary-key collision.
//
// The race only manifests at the db level: the websocket/evento layer serializes
// requests per connection, so these tests drive allocateAndInsertRevision
// directly against the test db (which DOES race — verified: the legacy
// SELECT max -> INSERT pattern rejects 24/25 concurrent writers).
describe("seq allocation concurrency (issue #2506)", { timeout: 20000 }, () => {
  async function ctx() {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    return { db: appCtx.vibesCtx.sql.db, flavour: appCtx.vibesCtx.sql.flavour, t: appCtx.vibesCtx.sql.tables.appDocuments };
  }

  function row(owner: string, app: string, dbName: string, docId: string, n: number, deleted = 0) {
    return {
      ownerHandle: owner,
      appSlug: app,
      dbName,
      docId,
      userId: "u",
      data: deleted ? {} : { n },
      deleted,
      created: new Date().toISOString(),
    };
  }

  it("N concurrent allocations to one docId all succeed with distinct contiguous seq", async () => {
    const { db, flavour, t } = await ctx();
    const [owner, app, dbName, docId] = ["c-owner", "c-app", "race", "hot"];
    const N = 25;

    const seqs = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i) })
      )
    );

    // Every allocation returned a distinct seq.
    expect(new Set(seqs).size).toBe(N);

    // The persisted log has exactly N contiguous revisions 1..N.
    const rows = await db
      .select({ seq: t.seq })
      .from(t)
      .where(and(eq(t.ownerHandle, owner), eq(t.appSlug, app), eq(t.dbName, dbName), eq(t.docId, docId)));
    const persisted = rows.map((r) => r.seq).sort((a, b) => a - b);
    expect(persisted).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });

  it("returned seq matches the row this call inserted (attribution, Codex P1)", async () => {
    const { db, flavour, t } = await ctx();
    const [owner, app, dbName, docId] = ["a-owner", "a-app", "attr", "doc"];
    const N = 15;

    // Tag each write with its own marker; assert the returned seq maps to the row carrying that marker.
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i) }).then((seq) => ({ i, seq }))
      )
    );
    for (const { i, seq } of results) {
      const found = await db
        .select({ data: t.data })
        .from(t)
        .where(and(eq(t.ownerHandle, owner), eq(t.appSlug, app), eq(t.dbName, dbName), eq(t.docId, docId), eq(t.seq, seq)))
        .then((r) => r[0]);
      expect((found?.data as { n?: number } | undefined)?.n).toBe(i);
    }
  });

  it("mixed put/delete burst on one doc never errors; seqs stay distinct", async () => {
    const { db, flavour, t } = await ctx();
    const [owner, app, dbName, docId] = ["m-owner", "m-app", "mix", "m"];
    const N = 20;

    const seqs = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i, i % 4 === 3 ? 1 : 0) })
      )
    );
    expect(new Set(seqs).size).toBe(N);
  });

  it("docLockKey is identical for the same doc tuple (put/delete share the lock)", () => {
    expect(docLockKey("o", "a", "d", "x")).toBe(docLockKey("o", "a", "d", "x"));
    expect(docLockKey("o", "a", "d", "x")).not.toBe(docLockKey("o", "a", "d", "y"));
  });

  it("exposes a typed SeqConflictError carrying the current head seq", () => {
    const e = new SeqConflictError(7);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("SeqConflictError");
    expect(e.currentHeadSeq).toBe(7);
  });
});
