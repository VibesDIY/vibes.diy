import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@vibes.diy/identity/testing";
import { and, desc, eq } from "drizzle-orm";
import { allocateAndInsertRevision, docLockKey, isRetryableConflict, SeqConflictError } from "@vibes.diy/api-svc";
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
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i) }).then((r) => r.seq)
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
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i) }).then((r) => ({
          i,
          seq: r.seq,
        }))
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
        allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, i, i % 4 === 3 ? 1 : 0) }).then(
          (r) => r.seq
        )
      )
    );
    expect(new Set(seqs).size).toBe(N);
  });

  it("skipIf is evaluated against the live head, so a no-op cannot drop a write the early read missed (#2644)", async () => {
    const { db, flavour, t } = await ctx();
    const [owner, app, dbName, docId] = ["noop-owner", "noop-app", "noop", "d"];
    const where = and(eq(t.ownerHandle, owner), eq(t.appSlug, app), eq(t.dbName, dbName), eq(t.docId, docId));
    const count = async () => (await db.select({ seq: t.seq }).from(t).where(where)).length;
    // A re-put is a no-op only while the SERIALIZED head still holds A (n === 1).
    const skipIfHeadIsA = async (exec: typeof db) => {
      const cur = await exec
        .select({ data: t.data, deleted: t.deleted })
        .from(t)
        .where(where)
        .orderBy(desc(t.seq))
        .limit(1)
        .then((r) => r[0]);
      return !!cur && cur.deleted !== 1 && (cur.data as { n?: number }).n === 1;
    };

    // Head A.
    const a = await allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, 1) });
    expect(a.inserted).toBe(true);

    // Re-put A while head is A → absorbed as a no-op; no new revision.
    const reA = await allocateAndInsertRevision({
      db,
      flavour,
      table: t,
      row: row(owner, app, dbName, docId, 1),
      skipIf: skipIfHeadIsA,
    });
    expect(reA.inserted).toBe(false);
    expect(await count()).toBe(1);

    // Head moves to B (the concurrent writer in the Codex P1 scenario).
    await allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, 2) });

    // Re-put A again with the SAME predicate. A stale pre-lock read still "thinks"
    // the head is A, but the in-lock recheck sees B → must NOT no-op → A is
    // inserted (restored), not silently dropped.
    const reA2 = await allocateAndInsertRevision({
      db,
      flavour,
      table: t,
      row: row(owner, app, dbName, docId, 1),
      skipIf: skipIfHeadIsA,
    });
    expect(reA2.inserted).toBe(true);
    expect(await count()).toBe(3);
  });

  it("skipIf falls through when the live head is a tombstone — a re-put resurrects, never no-ops (#2644)", async () => {
    const { db, flavour, t } = await ctx();
    const [owner, app, dbName, docId] = ["tomb-owner", "tomb-app", "tomb", "d"];
    const where = and(eq(t.ownerHandle, owner), eq(t.appSlug, app), eq(t.dbName, dbName), eq(t.docId, docId));
    const count = async () => (await db.select({ seq: t.seq }).from(t).where(where)).length;
    // A re-put of A is a no-op only if the live head is A AND not a tombstone.
    const skipIfHeadIsLiveA = async (exec: typeof db) => {
      const cur = await exec
        .select({ data: t.data, deleted: t.deleted })
        .from(t)
        .where(where)
        .orderBy(desc(t.seq))
        .limit(1)
        .then((r) => r[0]);
      return !!cur && cur.deleted !== 1 && (cur.data as { n?: number }).n === 1;
    };

    // Head A, then a tombstone (the concurrent delete that overlaps the no-op window).
    await allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, 1) });
    await allocateAndInsertRevision({ db, flavour, table: t, row: row(owner, app, dbName, docId, 1, /*deleted*/ 1) });

    // Re-put A: a stale read may have seen live A, but the in-lock recheck sees a
    // tombstone head → must NOT no-op → A is inserted (resurrected).
    const reA = await allocateAndInsertRevision({
      db,
      flavour,
      table: t,
      row: row(owner, app, dbName, docId, 1),
      skipIf: skipIfHeadIsLiveA,
    });
    expect(reA.inserted).toBe(true);
    expect(await count()).toBe(3);
  });

  it("docLockKey is identical for the same doc tuple (put/delete share the lock)", () => {
    expect(docLockKey("o", "a", "d", "x")).toBe(docLockKey("o", "a", "d", "x"));
    expect(docLockKey("o", "a", "d", "x")).not.toBe(docLockKey("o", "a", "d", "y"));
    // Distinct tuples must never collide on one lock even at component boundaries.
    expect(docLockKey("ab", "c", "d", "x")).not.toBe(docLockKey("a", "bc", "d", "x"));
  });

  it("docLockKey never emits a raw NUL byte — Postgres rejects 0x00 in a text param (#2557)", () => {
    // The key is bound into `hashtextextended($1, 0)`; a 0x00 byte makes pg throw
    // SQLSTATE 22021 ("invalid byte sequence for encoding UTF8: 0x00"), which made
    // every pg putDoc/deleteDoc fail. The encoded key must stay NUL-free even when
    // an identifier itself contains a NUL.
    const NUL = String.fromCharCode(0);
    expect(docLockKey("o", "a", "d", "x")).not.toContain(NUL);
    expect(docLockKey("bestboy", "atari-tetris", "db", "doc-id")).not.toContain(NUL);
    expect(docLockKey("o", "a", "d", `has${NUL}nul`)).not.toContain(NUL);
  });

  it("exposes a typed SeqConflictError carrying the current head seq", () => {
    const e = new SeqConflictError(7);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("SeqConflictError");
    expect(e.currentHeadSeq).toBe(7);
  });

  it("classifies a REAL drizzle PK-violation error as retryable (not just message text)", async () => {
    const { db, t } = await ctx();
    const [owner, app, dbName, docId] = ["cls-owner", "cls-app", "cls", "d"];
    const base = {
      ownerHandle: owner,
      appSlug: app,
      dbName,
      docId,
      seq: 1,
      userId: "u",
      data: { n: 0 },
      deleted: 0,
      created: new Date().toISOString(),
    };
    await db.insert(t).values(base);
    // Same PK again -> drizzle throws "Failed query: ..." with the real libsql
    // constraint error on .cause; the classifier must see through the wrapper.
    let caught: unknown;
    try {
      await db.insert(t).values(base);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(String((caught as { message?: string }).message)).toContain("Failed query"); // wrapper text has no "constraint"
    expect(isRetryableConflict(caught)).toBe(true); // ...but the cause chain does
  });

  it("does NOT classify unrelated errors as retryable", () => {
    expect(isRetryableConflict(new Error("connection refused"))).toBe(false);
    expect(isRetryableConflict(new Error("syntax error at or near"))).toBe(false);
    expect(isRetryableConflict(undefined)).toBe(false);
  });

  it("surfaces a typed SeqConflictError when every insert attempt conflicts", async () => {
    const { db, t } = await ctx();
    // This exercises the bounded retry path, which is the sqlite/libsql branch.
    // The pg path serializes same-doc writers with an advisory lock instead.
    const flavour = "sqlite" as const;
    const conflictErr = Object.assign(new Error("Failed query: insert ..."), {
      cause: Object.assign(new Error("UNIQUE constraint failed: AppDocuments.seq"), { code: "SQLITE_CONSTRAINT_PRIMARYKEY" }),
    });
    // Stub a db whose atomic insert always conflicts but whose head read works.
    const stubDb = {
      run: () => Promise.reject(conflictErr),
      execute: () => Promise.reject(conflictErr),
      select: db.select.bind(db),
    } as unknown as typeof db;

    await expect(
      allocateAndInsertRevision({
        db: stubDb,
        flavour,
        table: t,
        row: {
          ownerHandle: "x",
          appSlug: "x",
          dbName: "x",
          docId: "x",
          userId: "u",
          data: {},
          deleted: 0,
          created: new Date().toISOString(),
        },
        maxAttempts: 2,
      })
    ).rejects.toBeInstanceOf(SeqConflictError);
  });
});
