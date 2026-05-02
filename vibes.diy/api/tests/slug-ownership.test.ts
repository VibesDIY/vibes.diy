import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { ensureAppSlug, ensureUserSlug, writeAppSlugBinding, writeUserSlugBinding, VibesApiSQLCtx } from "@vibes.diy/api-svc";
import type { ClerkClaim } from "@vibes.diy/api-types";
import { eq } from "drizzle-orm/sql/expressions";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

function makeClaims(partial: Partial<ClerkClaim["params"]>): ClerkClaim {
  return {
    params: {
      email: "",
      email_verified: true,
      first: "",
      image_url: "",
      last: "",
      name: null,
      public_meta: undefined,
      ...partial,
    },
    role: "user",
    sub: "test-sub",
    userId: "test-user-id",
  };
}

describe("slug ownership", () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;
  });

  it("should reject userSlug owned by another user", async () => {
    const userA = "user-slug-owner-A";
    const userB = "user-slug-thief-B";
    const slug = `ownership-${sthis.nextId(8).str}`;

    // User A creates a binding
    const rA = await writeUserSlugBinding(vibesCtx, userA, slug);
    expect(rA.isOk()).toBe(true);
    expect(rA.Ok().userSlug).toBe(slug);

    // Verify row exists for user A
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, slug));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userA);

    // User B tries to use the same userSlug — should fail
    const rB = await writeUserSlugBinding(vibesCtx, userB, slug);
    expect(rB.isErr()).toBe(true);
  });

  it("should return the correct binding when user has multiple slugs", async () => {
    const userId = "multi-slug-user";
    const slugA = `multi-a-${sthis.nextId(8).str}`;
    const slugB = `multi-b-${sthis.nextId(8).str}`;

    const rA = await writeUserSlugBinding(vibesCtx, userId, slugA);
    expect(rA.isOk()).toBe(true);

    const rB = await writeUserSlugBinding(vibesCtx, userId, slugB);
    expect(rB.isOk()).toBe(true);

    // Request slugB again — should return slugB's tenant, not slugA's
    const rB2 = await writeUserSlugBinding(vibesCtx, userId, slugB);
    expect(rB2.isOk()).toBe(true);
    expect(rB2.Ok().userSlug).toBe(slugB);
    expect(rB2.Ok().tenant).toBe(rB.Ok().tenant);
  });

  it("should return existing binding even at max quota", async () => {
    const userId = "quota-user";
    const slug = `quota-${sthis.nextId(8).str}`;

    // Create the binding first
    const r1 = await writeUserSlugBinding(vibesCtx, userId, slug);
    expect(r1.isOk()).toBe(true);

    // Temporarily lower the max to simulate being at quota
    const original = vibesCtx.params.maxUserSlugPerUserId;
    vibesCtx.params.maxUserSlugPerUserId = 1;

    // Idempotent call should still succeed — owned slug, not a new one
    const r2 = await writeUserSlugBinding(vibesCtx, userId, slug);
    expect(r2.isOk()).toBe(true);
    expect(r2.Ok().tenant).toBe(r1.Ok().tenant);

    vibesCtx.params.maxUserSlugPerUserId = original;
  });

  it("should handle concurrent claims to the same slug", async () => {
    const slug = `concurrent-${sthis.nextId(8).str}`;

    const [r1, r2] = await Promise.all([
      writeUserSlugBinding(vibesCtx, "racer-1", slug),
      writeUserSlugBinding(vibesCtx, "racer-2", slug),
    ]);

    // Exactly one succeeds, one fails
    const successes = [r1.isOk(), r2.isOk()].filter(Boolean);
    expect(successes).toHaveLength(1);

    // Only one row exists
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, slug));
    expect(rows).toHaveLength(1);
  });

  it("ensureUserSlug skips a sanitized claim-candidate already owned by someone else", async () => {
    const uniq = sthis.nextId(6).str.toLowerCase();
    // Pre-claim the sanitized form of the email-prefix candidate for another user.
    const takenSlug = `jchris-${uniq}`;
    const rPre = await writeUserSlugBinding(vibesCtx, `owner-${uniq}`, takenSlug);
    expect(rPre.isOk()).toBe(true);

    // New user whose candidates after sanitization would include `takenSlug` via the raw-vs-sanitized mismatch.
    const newUserId = `newcomer-${uniq}`;
    const rEnsure = await ensureUserSlug(
      vibesCtx,
      makeClaims({
        email: `JChris-${uniq}@example.com`,
        first: "fallback",
        last: `user-${uniq}`,
        name: `Fallback User ${uniq}`,
      }),
      { userId: newUserId }
    );
    expect(rEnsure.isOk()).toBe(true);
    expect(rEnsure.Ok().userSlug).not.toBe(takenSlug);

    // The taken slug still belongs to the original owner.
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, takenSlug));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(`owner-${uniq}`);
  });

  it("ensureUserSlug rejects at quota with a quota error, not an ownership error", async () => {
    const userId = `quota-auto-${sthis.nextId(6).str}`;
    const rSeed = await writeUserSlugBinding(vibesCtx, userId, `seed-${sthis.nextId(6).str}`);
    expect(rSeed.isOk()).toBe(true);

    const original = vibesCtx.params.maxUserSlugPerUserId;
    vibesCtx.params.maxUserSlugPerUserId = 1;
    try {
      const rEnsure = await ensureUserSlug(vibesCtx, makeClaims({ email: "whatever@example.com" }), { userId });
      expect(rEnsure.isErr()).toBe(true);
      expect(rEnsure.Err().message).toMatch(/maximum userSlug bindings/);
    } finally {
      vibesCtx.params.maxUserSlugPerUserId = original;
    }
  });

  it("writeAppSlugBinding allows two users to claim the same appSlug under different userSlugs", async () => {
    const uniq = sthis.nextId(6).str.toLowerCase();
    const sharedAppSlug = `shared-${uniq}`;

    const userIdA = `multi-owner-a-${uniq}`;
    const userIdB = `multi-owner-b-${uniq}`;
    const userSlugA = `owner-a-${uniq}`;
    const userSlugB = `owner-b-${uniq}`;

    const rSlugA = await writeUserSlugBinding(vibesCtx, userIdA, userSlugA);
    expect(rSlugA.isOk()).toBe(true);
    const rSlugB = await writeUserSlugBinding(vibesCtx, userIdB, userSlugB);
    expect(rSlugB.isOk()).toBe(true);

    const rAppA = await writeAppSlugBinding(vibesCtx, userIdA, userSlugA, sharedAppSlug);
    expect(rAppA.isOk()).toBe(true);

    const rAppB = await writeAppSlugBinding(vibesCtx, userIdB, userSlugB, sharedAppSlug);
    expect(rAppB.isOk()).toBe(true);
    expect(rAppB.Ok().appSlug).toBe(sharedAppSlug);
    expect(rAppB.Ok().ledger).not.toBe(rAppA.Ok().ledger);

    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.appSlugBinding)
      .where(eq(vibesCtx.sql.tables.appSlugBinding.appSlug, sharedAppSlug));
    expect(rows).toHaveLength(2);
    const userSlugs = rows.map((r) => r.userSlug).sort();
    expect(userSlugs).toEqual([userSlugA, userSlugB].sort());
  });

  it("ensureAppSlug falls through to the next preferredPair when the first is taken", async () => {
    const uniq = sthis.nextId(6).str.toLowerCase();
    const ownerUserSlug = `app-owner-${uniq}`;
    const rOwnerSlug = await writeUserSlugBinding(vibesCtx, `owner-user-${uniq}`, ownerUserSlug);
    expect(rOwnerSlug.isOk()).toBe(true);

    const newcomerUserSlug = `app-newcomer-${uniq}`;
    const rNewcomerSlug = await writeUserSlugBinding(vibesCtx, `newcomer-user-${uniq}`, newcomerUserSlug);
    expect(rNewcomerSlug.isOk()).toBe(true);

    const takenAppSlug = `taken-${uniq}`;
    const freeAppSlug = `free-${uniq}`;

    const rTakenApp = await ensureAppSlug(vibesCtx, {
      userId: `owner-user-${uniq}`,
      userSlug: ownerUserSlug,
      appSlug: takenAppSlug,
    });
    expect(rTakenApp.isOk()).toBe(true);

    const rEnsure = await ensureAppSlug(vibesCtx, {
      userId: `newcomer-user-${uniq}`,
      userSlug: newcomerUserSlug,
      preferredPairs: [
        { slug: takenAppSlug, title: "First" },
        { slug: freeAppSlug, title: "Second" },
      ],
    });
    expect(rEnsure.isOk()).toBe(true);
    expect(rEnsure.Ok().appSlug).toBe(freeAppSlug);
    expect(rEnsure.Ok().chosenTitle).toBe("Second");
  });
});
