import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { MetaItem } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx } from "../queue/intern/emit-notification.js";
import { notifyRemixSourceOwner } from "../queue/intern/notify-remix.js";

// notifyRemixSourceOwner resolves the source vibe owner from the remix app's
// remix-of meta (captured at fork time) and emits exactly one durable
// `vibe-remixed` notification per remix app, with dedupe entirely handled by
// emitNotification's unique (userId, dedupeKey). Republish is naturally
// once-only; self-remix and legacy (no srcUserId) remixes emit nothing.
describe("notifyRemixSourceOwner", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
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

  // A minimal Apps-row shape carrying the fields the helper reads.
  function remixApp(opts: { userId: string; ownerHandle: string; appSlug: string; meta: MetaItem[] }) {
    return {
      userId: opts.userId,
      ownerHandle: opts.ownerHandle,
      appSlug: opts.appSlug,
      meta: opts.meta,
    };
  }

  it("emits exactly one vibe-remixed row for the source owner with body/dedupeKey/targetRef", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const srcUserId = `src-${sthis.nextId().str}`;

    const app = remixApp({
      userId: `remixer-${sthis.nextId().str}`,
      ownerHandle: "remixer-handle",
      appSlug: "cool-app-remix",
      meta: [
        {
          type: "remix-of",
          srcFsId: "fs-src",
          srcUserId,
          srcOwnerHandle: "owner-handle",
          srcAppSlug: "cool-app",
        },
      ],
    });

    await notifyRemixSourceOwner(qctx, app);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, srcUserId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.notificationType).toBe("vibe-remixed");
    expect(row.ownerHandle).toBe("owner-handle");
    expect(row.appSlug).toBe("cool-app");
    expect(row.actorHandle).toBe("remixer-handle");
    expect(row.body).toBe("@remixer-handle remixed your vibe cool-app");
    expect(row.dedupeKey).toBe("vibe-remixed:remixer-handle/cool-app-remix");
    expect(row.targetRef).toEqual({ remixOwnerHandle: "remixer-handle", remixAppSlug: "cool-app-remix" });
    // Fan-out fired once for the source owner.
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].userId).toBe(srcUserId);
  });

  it("republish is once-only: a second call emits no second row", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const srcUserId = `src-${sthis.nextId().str}`;
    const app = remixApp({
      userId: `remixer-${sthis.nextId().str}`,
      ownerHandle: "republish-remixer",
      appSlug: "republish-remix",
      meta: [{ type: "remix-of", srcFsId: "fs-src", srcUserId, srcOwnerHandle: "owner-handle", srcAppSlug: "src-app" }],
    });

    await notifyRemixSourceOwner(qctx, app);
    await notifyRemixSourceOwner(qctx, app);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, srcUserId));
    expect(rows).toHaveLength(1);
    // Only the first emit fanned out the live bell.
    expect(notifyCalls).toHaveLength(1);
  });

  it("self-remix emits no row", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const selfId = `self-${sthis.nextId().str}`;
    const app = remixApp({
      userId: selfId,
      ownerHandle: "self-owner",
      appSlug: "self-remix",
      meta: [{ type: "remix-of", srcFsId: "fs-src", srcUserId: selfId, srcOwnerHandle: "self-owner", srcAppSlug: "self-src" }],
    });

    await notifyRemixSourceOwner(qctx, app);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, selfId));
    expect(rows).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });

  it("legacy remix lacking srcUserId emits no row", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const app = remixApp({
      userId: `remixer-${sthis.nextId().str}`,
      ownerHandle: "legacy-remixer",
      appSlug: "legacy-remix",
      // Legacy remix-of entry: only the immutable content anchor, no src identity.
      meta: [{ type: "remix-of", srcFsId: "fs-legacy" }],
    });

    await notifyRemixSourceOwner(qctx, app);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t);
    // No vibe-remixed row was created from a legacy entry.
    expect(rows.filter((r) => r.notificationType === "vibe-remixed")).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });

  // Clone-path (skipChat) gap: a clone is born straight in production and
  // never emits evt-new-fs-id, so call site B should notify the source owner
  // inline from forkApp. It is NOT wired because notifyRemixSourceOwner lives
  // in @vibes.diy/api-queue and api-queue depends on api-svc (where forkApp
  // lives) — importing the helper into svc would create a circular package
  // dependency. Wiring it cleanly needs the shared notify helpers to move to a
  // package both svc and queue can depend on (larger plumbing, deferred). See
  // the TODO in fork-app.ts.
  it.todo("clone path (forkApp skipChat) notifies the source owner once");

  it("no remix-of entry at all emits no row", async () => {
    const { appCtx, qctx, notifyCalls } = await makeCtx();
    const app = remixApp({
      userId: `remixer-${sthis.nextId().str}`,
      ownerHandle: "non-remix",
      appSlug: "fresh-app",
      meta: [{ type: "title", title: "Fresh App" }],
    });

    await notifyRemixSourceOwner(qctx, app);

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t);
    expect(rows.filter((r) => r.notificationType === "vibe-remixed")).toHaveLength(0);
    expect(notifyCalls).toHaveLength(0);
  });
});
