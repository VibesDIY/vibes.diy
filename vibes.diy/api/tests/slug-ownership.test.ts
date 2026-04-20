import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { writeUserSlugBinding, VibesApiSQLCtx } from "@vibes.diy/api-svc";
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
});
