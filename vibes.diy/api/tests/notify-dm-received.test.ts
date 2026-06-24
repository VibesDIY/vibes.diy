import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyDmReceived } from "@vibes.diy/api-svc";

// notifyDmReceived resolves the recipient's userId from UserSlugBindings (by
// recipientUserSlug) and emits exactly one durable `dm-received` notification
// per message (dedupeKey carries channelUserSlug + docId), with
// targetRef={threadHandle, docId} and actor = sender. Re-delivery of the same
// message event is once-only via emitNotification's unique (userId, dedupeKey).
describe("notifyDmReceived", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
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

  async function seedUser(qctx: EmitNotificationCtx, handle: string, userId: string) {
    const usb = qctx.sql.tables.handleBinding;
    await qctx.sql.db
      .insert(usb)
      .values({ userId, handle, tenant: `tenant-${userId}`, created: new Date().toISOString() })
      .onConflictDoNothing();
  }

  it("persists one dm-received row for the recipient with body/dedupeKey/targetRef/actor and bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const recipientSlug = `bob-${sthis.nextId().str}`;
    const recipientUserId = `user-${sthis.nextId().str}`;
    const channel = `_d.alice.${recipientSlug}`;
    await seedUser(qctx, recipientSlug, recipientUserId);

    await notifyDmReceived(qctx, {
      senderUserId: "sender-uid",
      senderUserSlug: "alice",
      recipientUserSlug: recipientSlug,
      channelUserSlug: channel,
      docId: "msg-1",
    });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, recipientUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.notificationType).toBe("dm-received");
    expect(row.ownerHandle).toBe(recipientSlug);
    expect(row.appSlug).toBe(channel);
    expect(row.body).toBe("New message from alice.");
    expect(row.actorHandle).toBe("alice");
    expect(row.actorUserId).toBe("sender-uid");
    expect(row.dedupeKey).toBe(`dm-received:${channel}:msg-1`);
    expect(row.targetRef).toEqual({ threadHandle: channel, docId: "msg-1" });
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(recipientUserId);
  });

  it("re-delivery of the same message is once-only (no duplicate row, no second bell)", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const recipientSlug = `bob-${sthis.nextId().str}`;
    const recipientUserId = `user-${sthis.nextId().str}`;
    await seedUser(qctx, recipientSlug, recipientUserId);

    const payload = {
      senderUserId: "sender-uid",
      senderUserSlug: "alice",
      recipientUserSlug: recipientSlug,
      channelUserSlug: `_d.alice.${recipientSlug}`,
      docId: "msg-dup",
    };
    await notifyDmReceived(qctx, payload);
    await notifyDmReceived(qctx, payload);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, recipientUserId));
    expect(rows).toHaveLength(1);
    expect(notifyCalls).toHaveLength(1);
  });

  it("no handle binding for the recipient → no row, no bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const recipientSlug = `missing-${sthis.nextId().str}`;

    await notifyDmReceived(qctx, {
      senderUserId: "sender-uid",
      senderUserSlug: "alice",
      recipientUserSlug: recipientSlug,
      channelUserSlug: `_d.alice.${recipientSlug}`,
      docId: "msg-x",
    });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.ownerHandle, recipientSlug));
    expect(rows).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });
});
