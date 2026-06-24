import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { emitNotification, EmitNotificationCtx } from "@vibes.diy/api-svc";

// emitNotification is the single durable-emit path: it inserts a self-contained
// Notifications row idempotently on (userId, dedupeKey) and only fans out the
// live bell (qctx.notifyUser) when a row was actually newly inserted. A repeat
// emit with the same (userId, dedupeKey) is a no-op: no second row, no second
// fan-out.
describe("emitNotification", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  async function makeCtx() {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const notifyCalls: { userId: string; evt: unknown }[] = [];
    const qctx: EmitNotificationCtx = {
      sthis,
      sql: { db: appCtx.vibesCtx.sql.db, tables: appCtx.vibesCtx.sql.tables },
      notifyUser: async (userId, evt) => {
        notifyCalls.push({ userId, evt });
      },
    };
    return { appCtx, qctx, notifyCalls };
  }

  it("persists one row and fans out once on first emit", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const userId = `u-${sthis.nextId().str}`;

    const r1 = await emitNotification(qctx, {
      userId,
      notificationType: "vibe-remixed",
      ownerHandle: "owner-handle",
      appSlug: "owner-app",
      body: "@remixer remixed your vibe owner-app",
      actorHandle: "remixer",
      targetRef: { remixOwnerHandle: "remixer", remixAppSlug: "remix-app" },
      dedupeKey: `vibe-remixed:remixer/remix-app`,
    });

    expect(r1.inserted).toBe(true);
    expect(r1.id).toMatch(/.+/);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("@remixer remixed your vibe owner-app");
    expect(rows[0].notificationType).toBe("vibe-remixed");
    expect(rows[0].readAt).toBeNull();
    expect(rows[0].targetRef).toEqual({ remixOwnerHandle: "remixer", remixAppSlug: "remix-app" });

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(userId);
  });

  it("is idempotent: a repeat (userId, dedupeKey) is a no-op (no row, no fan-out)", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const userId = `u-${sthis.nextId().str}`;
    const input = {
      userId,
      notificationType: "vibe-remixed" as const,
      ownerHandle: "owner-handle",
      appSlug: "owner-app",
      body: "@remixer remixed your vibe owner-app",
      dedupeKey: `vibe-remixed:remixer/dup-app`,
    };

    const r1 = await emitNotification(qctx, input);
    const r2 = await emitNotification(qctx, input);

    expect(r1.inserted).toBe(true);
    expect(r2.inserted).toBe(false);
    // The duplicate returns the existing row id so callers can still reference it.
    expect(r2.id).toBe(r1.id);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, userId));
    expect(rows).toHaveLength(1);

    // Only the first emit fanned out the live bell.
    expect(notifyCalls).toHaveLength(1);
  });

  it("dedupeKey is scoped to the user: same key for different users both persist", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const userA = `u-a-${sthis.nextId().str}`;
    const userB = `u-b-${sthis.nextId().str}`;
    const dedupeKey = `vibe-remixed:remixer/shared`;

    const ra = await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-remixed",
      ownerHandle: "owner-handle",
      appSlug: "owner-app",
      body: "for A",
      dedupeKey,
    });
    const rb = await emitNotification(qctx, {
      userId: userB,
      notificationType: "vibe-remixed",
      ownerHandle: "owner-handle",
      appSlug: "owner-app",
      body: "for B",
      dedupeKey,
    });

    expect(ra.inserted).toBe(true);
    expect(rb.inserted).toBe(true);

    const t = qctx.sql.tables.notifications;
    const rowsA = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, userA));
    const rowsB = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, userB));
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(notifyCalls).toHaveLength(2);
  });
});
