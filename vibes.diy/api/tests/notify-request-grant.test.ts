import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyRequestGrant } from "@vibes.diy/api-svc";

// notifyRequestGrant emits a durable `request-approved` / `request-revoked`
// notification for the requester (foreignUserId), mirroring the prior live-bell
// copy. dedupeKey carries the grant's `updated` timestamp (the grant has no
// `tick` field — that lives only on ResListRequestGrants.items), so each
// distinct decision notifies once and re-delivery does not double-notify.
describe("notifyRequestGrant", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
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

  it("approved → one request-approved row for the requester with body/dedupeKey + bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const requester = `req-${sthis.nextId().str}`;

    await notifyRequestGrant(qctx, {
      state: "approved",
      ownerHandle: "owner-h",
      appSlug: "cool-app",
      foreignUserId: requester,
      updated: "2026-06-24T00:00:00.000Z",
    });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, requester));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.notificationType).toBe("request-approved");
    expect(row.ownerHandle).toBe("owner-h");
    expect(row.appSlug).toBe("cool-app");
    expect(row.body).toBe("Access to owner-h/cool-app approved.");
    expect(row.dedupeKey).toBe(`request-approved:owner-h:cool-app:${requester}:2026-06-24T00:00:00.000Z`);
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(requester);
  });

  it("revoked → one request-revoked row with revoked copy", async () => {
    const { appCtx, qctx } = await makeCtx();
    const requester = `req-${sthis.nextId().str}`;

    await notifyRequestGrant(qctx, {
      state: "revoked",
      ownerHandle: "owner-h",
      appSlug: "cool-app",
      foreignUserId: requester,
      updated: "2026-06-24T01:00:00.000Z",
    });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, requester));
    expect(rows).toHaveLength(1);
    expect(rows[0].notificationType).toBe("request-revoked");
    expect(rows[0].body).toBe("Access to owner-h/cool-app was revoked.");
    expect(rows[0].dedupeKey).toBe(`request-revoked:owner-h:cool-app:${requester}:2026-06-24T01:00:00.000Z`);
  });

  it("re-delivery of the same decision is once-only; a new decision (new updated) is distinct", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const requester = `req-${sthis.nextId().str}`;
    const base = {
      state: "approved" as const,
      ownerHandle: "owner-h",
      appSlug: "dup-app",
      foreignUserId: requester,
    };

    await notifyRequestGrant(qctx, { ...base, updated: "t1" });
    await notifyRequestGrant(qctx, { ...base, updated: "t1" }); // re-delivery
    await notifyRequestGrant(qctx, { ...base, state: "revoked", updated: "t2" }); // new decision

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, requester));
    expect(rows).toHaveLength(2);
    // First delivery + the revoke each fanned out the bell; the duplicate did not.
    expect(notifyCalls).toHaveLength(2);
  });

  it("pending → no row, no bell", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const requester = `req-${sthis.nextId().str}`;

    await notifyRequestGrant(qctx, {
      state: "pending",
      ownerHandle: "owner-h",
      appSlug: "cool-app",
      foreignUserId: requester,
      updated: "2026-06-24T02:00:00.000Z",
    });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, requester));
    expect(rows).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });
});
