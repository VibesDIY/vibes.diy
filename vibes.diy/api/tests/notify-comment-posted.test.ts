import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyCommentPosted } from "@vibes.diy/api-svc";

// notifyCommentPosted resolves the owner's userId from UserSlugBindings and
// emits exactly one durable `comment-posted` notification per comment
// (dedupeKey carries docId), with targetRef={docId} for optional hydration.
// Re-delivery of the same comment event is once-only via emitNotification's
// unique (userId, dedupeKey).
describe("notifyCommentPosted", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
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

  it("persists one comment-posted row with body/dedupeKey/targetRef/actorUserId and fans out the bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `owner-${sthis.nextId().str}`;
    const ownerUserId = `user-${sthis.nextId().str}`;
    const commenterUserId = `commenter-${sthis.nextId().str}`;
    await seedOwner(qctx, ownerHandle, ownerUserId);

    await notifyCommentPosted(qctx, { ownerHandle, appSlug: "cool-app", docId: "doc-1", userId: commenterUserId });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, ownerUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.notificationType).toBe("comment-posted");
    expect(row.ownerHandle).toBe(ownerHandle);
    expect(row.appSlug).toBe("cool-app");
    expect(row.body).toBe(`New comment on ${ownerHandle}/cool-app.`);
    expect(row.actorUserId).toBe(commenterUserId);
    expect(row.dedupeKey).toBe("comment-posted:doc-1");
    expect(row.targetRef).toEqual({ docId: "doc-1" });
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(ownerUserId);
  });

  it("re-delivery of the same comment is once-only (no duplicate row, no second bell)", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `owner-${sthis.nextId().str}`;
    const ownerUserId = `user-${sthis.nextId().str}`;
    await seedOwner(qctx, ownerHandle, ownerUserId);

    const payload = { ownerHandle, appSlug: "dup-app", docId: "doc-dup", userId: "c1" };
    await notifyCommentPosted(qctx, payload);
    await notifyCommentPosted(qctx, payload);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, ownerUserId));
    expect(rows).toHaveLength(1);
    expect(notifyCalls).toHaveLength(1);
  });

  it("no handle binding → no row, no bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const ownerHandle = `missing-${sthis.nextId().str}`;

    await notifyCommentPosted(qctx, { ownerHandle, appSlug: "ghost-app", docId: "doc-x", userId: "c2" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.ownerHandle, ownerHandle));
    expect(rows).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });
});
