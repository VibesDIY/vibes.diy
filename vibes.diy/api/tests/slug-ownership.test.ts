import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { ensureSlugBinding, VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { eq } from "drizzle-orm/sql/expressions";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

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
    const rA = await ensureSlugBinding(vibesCtx, { userId: userA, userSlug: slug });
    expect(rA.isOk()).toBe(true);
    expect(rA.Ok().userSlug).toBe(slug);

    // Verify UserSlugBinding row exists for user A
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, slug));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userA);

    // Count app bindings before user B's attempt
    const before = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.appSlugBinding)
      .where(eq(vibesCtx.sql.tables.appSlugBinding.userSlug, slug));

    // User B tries to use the same userSlug — this SHOULD fail
    const rB = await ensureSlugBinding(vibesCtx, { userId: userB, userSlug: slug });
    expect(rB.isErr()).toBe(true);

    // No new app bindings created by user B
    const after = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.appSlugBinding)
      .where(eq(vibesCtx.sql.tables.appSlugBinding.userSlug, slug));
    expect(after).toHaveLength(before.length);
  });

  it("should handle concurrent claims to the same slug", async () => {
    const slug = `concurrent-${sthis.nextId(8).str}`;

    const [r1, r2] = await Promise.all([
      ensureSlugBinding(vibesCtx, { userId: "racer-1", userSlug: slug }),
      ensureSlugBinding(vibesCtx, { userId: "racer-2", userSlug: slug }),
    ]);

    // Exactly one succeeds, one fails
    const successes = [r1.isOk(), r2.isOk()].filter(Boolean);
    expect(successes).toHaveLength(1);

    // Only one UserSlugBinding row exists
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, slug));
    expect(rows).toHaveLength(1);
  });
});
