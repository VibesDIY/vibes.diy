import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyVibePublished } from "@vibes.diy/api-svc";

// notifyVibePublished resolves the owner's userId from the UserSlugBindings
// (handleBinding) row for ownerHandle and emits exactly one durable
// `vibe-published` notification per release (dedupeKey carries fsId). Re-delivery
// of the same publish event is naturally once-only via emitNotification's unique
// (userId, dedupeKey); a new fsId (a new release) emits a distinct row.
describe("notifyVibePublished", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
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

  async function seedOwner(qctx: EmitNotificationCtx, handle: string, userId: string) {
    const usb = qctx.sql.tables.handleBinding;
    await qctx.sql.db
      .insert(usb)
      .values({ userId, handle, tenant: `tenant-${userId}`, created: new Date().toISOString() })
      .onConflictDoNothing();
  }

  it("persists one vibe-published row for the owner with body/dedupeKey and fans out the bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `owner-${sthis.nextId().str}`;
    const ownerUserId = `user-${sthis.nextId().str}`;
    await seedOwner(qctx, ownerHandle, ownerUserId);

    await notifyVibePublished(qctx, { ownerHandle, appSlug: "cool-app", fsId: "fs-1" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, ownerUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.notificationType).toBe("vibe-published");
    expect(row.ownerHandle).toBe(ownerHandle);
    expect(row.appSlug).toBe("cool-app");
    expect(row.body).toBe(`${ownerHandle}/cool-app was published.`);
    expect(row.dedupeKey).toBe(`vibe-published:${ownerHandle}/cool-app:fs-1`);
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(ownerUserId);
  });

  it("re-delivery of the same release is once-only (no duplicate row, no second bell)", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `owner-${sthis.nextId().str}`;
    const ownerUserId = `user-${sthis.nextId().str}`;
    await seedOwner(qctx, ownerHandle, ownerUserId);

    const payload = { ownerHandle, appSlug: "dup-app", fsId: "fs-dup" };
    await notifyVibePublished(qctx, payload);
    await notifyVibePublished(qctx, payload);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, ownerUserId));
    expect(rows).toHaveLength(1);
    expect(notifyCalls).toHaveLength(1);
  });

  it("a new release (new fsId) emits a distinct row", async () => {
    const { appCtx, qctx } = await makeCtx();
    const ownerHandle = `owner-${sthis.nextId().str}`;
    const ownerUserId = `user-${sthis.nextId().str}`;
    await seedOwner(qctx, ownerHandle, ownerUserId);

    await notifyVibePublished(qctx, { ownerHandle, appSlug: "rel-app", fsId: "fs-a" });
    await notifyVibePublished(qctx, { ownerHandle, appSlug: "rel-app", fsId: "fs-b" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, ownerUserId));
    expect(rows).toHaveLength(2);
  });

  it("no handle binding → no row, no bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `missing-${sthis.nextId().str}`;

    await notifyVibePublished(qctx, { ownerHandle, appSlug: "ghost-app", fsId: "fs-x" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.ownerHandle, ownerHandle));
    expect(rows).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });
});
