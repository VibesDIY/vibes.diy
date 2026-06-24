import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { and, eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { allocateAndInsertApp, appReleaseLockKey, buildInsertIfAbsent, formatDbErrorChain } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Regression coverage for issue #2612: a single `generate` produces two
// concurrent Apps writers for the same (appSlug, userId) — the server-side dev
// publish that runs while the codegen turn streams, and the CLI's production
// push. The legacy `SELECT max(releaseSeq) -> INSERT max+1` raced and the loser
// hit a PK unique-violation surfaced as an opaque "Failed query: insert into
// Apps ...". allocateAndInsertApp allocates the seq atomically so concurrent
// releases get distinct, contiguous releaseSeq values instead of colliding.
describe("Apps releaseSeq allocation concurrency (issue #2612)", { timeout: 20000 }, () => {
  async function ctx() {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    return { db: appCtx.vibesCtx.sql.db, flavour: appCtx.vibesCtx.sql.flavour, t: appCtx.vibesCtx.sql.tables.apps };
  }

  function row(appSlug: string, userId: string, ownerHandle: string, n: number) {
    return {
      appSlug,
      userId,
      ownerHandle,
      fsId: `fs-${n}`,
      env: {},
      fileSystem: [{ fileName: `/App-${n}.jsx`, assetId: `a-${n}`, mimeType: "text/javascript", assetURI: `x://${n}`, size: n }],
      meta: [],
      mode: "production",
      created: new Date().toISOString(),
    };
  }

  it("N concurrent releases for one (appSlug,userId) all succeed with distinct contiguous releaseSeq", async () => {
    const { db, flavour, t } = await ctx();
    const [appSlug, userId, ownerHandle] = ["bouncing-div", "user_race", "garden-gnome"];
    const N = 25;

    const seqs = await Promise.all(
      Array.from({ length: N }, (_, i) => allocateAndInsertApp({ db, flavour, row: row(appSlug, userId, ownerHandle, i) }))
    );

    // Every allocation returned a distinct seq.
    expect(new Set(seqs).size).toBe(N);

    // The persisted Apps rows are exactly the contiguous releases 1..N.
    const rows = await db
      .select({ releaseSeq: t.releaseSeq })
      .from(t)
      .where(and(eq(t.appSlug, appSlug), eq(t.userId, userId)));
    const persisted = rows.map((r) => r.releaseSeq).sort((a, b) => a - b);
    expect(persisted).toEqual(Array.from({ length: N }, (_, i) => i + 1));
  });

  it("distinct (appSlug,userId) pairs each start their own releaseSeq at 1", async () => {
    const { db, flavour } = await ctx();
    const seqA = await allocateAndInsertApp({ db, flavour, row: row("app-a", "user_x", "gnome", 1) });
    const seqB = await allocateAndInsertApp({ db, flavour, row: row("app-b", "user_x", "gnome", 1) });
    const seqA2 = await allocateAndInsertApp({ db, flavour, row: row("app-a", "user_x", "gnome", 2) });
    expect(seqA).toBe(1);
    expect(seqB).toBe(1);
    expect(seqA2).toBe(2);
  });

  it("concurrent writers with the SAME fsId persist exactly ONE row (no duplicate dev+prod pair, Codex P2)", async () => {
    const { db, flavour, t } = await ctx();
    const [appSlug, userId, ownerHandle] = ["dup-fsid", "user_dup", "gnome"];
    const N = 12;

    // Every writer shares one fsId (the clean-stream case: server dev publish +
    // CLI production push resolve identical files). Mixed dev/production modes.
    const sharedRow = (mode: string) => ({ ...row(appSlug, userId, ownerHandle, 0), fsId: "same-fs", mode });
    const seqs = await Promise.all(
      Array.from({ length: N }, (_, i) => allocateAndInsertApp({ db, flavour, row: sharedRow(i % 2 ? "production" : "dev") }))
    );

    // All callers resolve to the same single release...
    expect(new Set(seqs)).toEqual(new Set([1]));
    // ...and exactly one row exists for that fsId.
    const rows = await db
      .select({ releaseSeq: t.releaseSeq, mode: t.mode })
      .from(t)
      .where(and(eq(t.appSlug, appSlug), eq(t.userId, userId), eq(t.fsId, "same-fs")));
    expect(rows.length).toBe(1);
    // A production writer in the burst promoted the row off dev.
    expect(rows[0].mode).toBe("production");
  });

  it("a production push for an existing dev fsId upgrades it in place (no new release)", async () => {
    const { db, flavour, t } = await ctx();
    const [appSlug, userId, ownerHandle] = ["upgrade-fsid", "user_up", "gnome"];
    const devRow = { ...row(appSlug, userId, ownerHandle, 0), fsId: "fs-up", mode: "dev" };

    const devSeq = await allocateAndInsertApp({ db, flavour, row: devRow });
    const prodSeq = await allocateAndInsertApp({ db, flavour, row: { ...devRow, mode: "production" } });

    expect(devSeq).toBe(1);
    expect(prodSeq).toBe(1); // same release, not a 2nd
    const rows = await db
      .select({ releaseSeq: t.releaseSeq, mode: t.mode })
      .from(t)
      .where(and(eq(t.appSlug, appSlug), eq(t.userId, userId)));
    expect(rows.length).toBe(1);
    expect(rows[0].mode).toBe("production");
  });

  it("a DIFFERENT fsId for the same app still appends a new release (provenance preserved)", async () => {
    const { db, flavour, t } = await ctx();
    const [appSlug, userId, ownerHandle] = ["diverge-fsid", "user_dv", "gnome"];
    const s1 = await allocateAndInsertApp({
      db,
      flavour,
      row: { ...row(appSlug, userId, ownerHandle, 0), fsId: "fs-A", mode: "dev" },
    });
    const s2 = await allocateAndInsertApp({
      db,
      flavour,
      row: { ...row(appSlug, userId, ownerHandle, 0), fsId: "fs-B", mode: "production" },
    });
    expect(s1).toBe(1);
    expect(s2).toBe(2);
    const rows = await db
      .select({ releaseSeq: t.releaseSeq })
      .from(t)
      .where(and(eq(t.appSlug, appSlug), eq(t.userId, userId)));
    expect(rows.length).toBe(2);
  });

  it("appReleaseLockKey is stable per (user,app), never collides across boundaries, and is NUL-free", () => {
    const NUL = String.fromCharCode(0);
    expect(appReleaseLockKey("u", "a")).toBe(appReleaseLockKey("u", "a"));
    expect(appReleaseLockKey("u", "a")).not.toBe(appReleaseLockKey("u", "b"));
    // boundary disambiguation: ("ab","c") must not collide with ("a","bc")
    expect(appReleaseLockKey("ab", "c")).not.toBe(appReleaseLockKey("a", "bc"));
    expect(appReleaseLockKey("u", `has${NUL}nul`)).not.toContain(NUL);
  });

  it("pg INSERT binds jsonb array columns (env/fileSystem/meta) as single ::jsonb params, never array-expanded (#2612)", () => {
    // The CLI `generate` path always inserts an empty `meta: []` plus a
    // `fileSystem` array. Interpolating a bare JS array into a drizzle `sql`
    // template expands it into a parameter list — `($1,$2,...)` for a populated
    // array and `()` for an empty one — so the empty meta rendered as `()` and pg
    // rejected the whole INSERT with "syntax error at or near ')'". The fix
    // serializes each jsonb value to JSON text and casts it (`::jsonb`), binding
    // exactly one param per column regardless of array length. SQLite was never
    // affected (it already went through JSON.stringify), so only a pg-dialect
    // compile catches this regression.
    const row = {
      appSlug: "to-do",
      userId: "user_x",
      ownerHandle: "garden-gnome",
      fsId: "fs-1",
      env: {},
      fileSystem: [{ fileName: "/App.jsx" }, { fileName: "/access.js" }],
      meta: [] as unknown[],
      mode: "production",
      created: "2026-06-24T00:00:00.000Z",
    };
    const { sql: text, params } = new PgDialect().sqlToQuery(buildInsertIfAbsent({ db: {} as never, flavour: "pg", row }));

    // The empty-array `()` that triggered the syntax error must be gone.
    expect(text).not.toMatch(/,\s*\(\s*\)/);
    // jsonb values are bound as serialized JSON with an explicit cast.
    expect(text).toContain("::jsonb");
    // Each jsonb column contributes exactly one bound param (the serialized JSON),
    // never one-per-array-element.
    expect(params).toContain(JSON.stringify(row.env));
    expect(params).toContain(JSON.stringify(row.fileSystem));
    expect(params).toContain(JSON.stringify(row.meta));
  });

  it("formatDbErrorChain surfaces the driver cause (code + constraint) the drizzle wrapper hides", () => {
    const wrapped = Object.assign(new Error("Failed query: insert into Apps ..."), {
      cause: Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
        constraint: "Apps_appSlug_userId_releaseSeq_pk",
      }),
    });
    const out = formatDbErrorChain(wrapped);
    expect(out).toContain("Failed query"); // top wrapper still present
    expect(out).toContain("23505"); // ...but the real SQLSTATE is now visible
    expect(out).toContain("duplicate key value violates unique constraint");
    expect(out).toContain("Apps_appSlug_userId_releaseSeq_pk"); // ...and the constraint name
  });
});
