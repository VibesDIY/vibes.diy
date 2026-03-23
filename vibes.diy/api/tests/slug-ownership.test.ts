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
    const slug = `slug-ownership-test-${Date.now()}`;

    // User A creates a binding with test-slug
    const rA = await ensureSlugBinding(vibesCtx, {
      userId: userA,
      userSlug: slug,
    });
    expect(rA.isOk()).toBe(true);
    expect(rA.Ok().userSlug).toBe(slug);

    // Verify UserSlugBinding row exists for user A
    const rows = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.userSlugBinding)
      .where(eq(vibesCtx.sql.tables.userSlugBinding.userSlug, slug));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userA);

    // User B tries to use the same userSlug — this SHOULD fail
    const rB = await ensureSlugBinding(vibesCtx, {
      userId: userB,
      userSlug: slug,
    });
    expect(rB.isErr()).toBe(true);

    // Verify no AppSlugBinding was created for user B under the stolen slug
    const appBindings = await vibesCtx.sql.db
      .select()
      .from(vibesCtx.sql.tables.appSlugBinding)
      .where(eq(vibesCtx.sql.tables.appSlugBinding.userSlug, slug));

    // Only user A's app should exist
    expect(appBindings).toHaveLength(1);
  });
});
