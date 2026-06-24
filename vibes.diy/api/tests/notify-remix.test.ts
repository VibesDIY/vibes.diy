import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { MetaItem, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyRemixSourceOwner } from "@vibes.diy/api-svc";
import { createApiTestCtx } from "./api-test-setup.js";

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

  // Clone-path (skipChat): a clone is born straight in production and never
  // emits evt-new-fs-id, so the classic-remix queue handler (call site A) does
  // not cover it. forkApp wires call site B inline — it calls
  // notifyRemixSourceOwner on the freshly-inserted clone row. A clone by a
  // non-owner of a published source must leave exactly one durable
  // `vibe-remixed` inbox row for the SOURCE owner. (The live bell is skipped on
  // this path — VibesApiSQLCtx has no compatible 2-arg notifyUser — but the
  // durable row is what the source owner reads via listNotifications.)
  it("clone path (forkApp skipChat) notifies the source owner once", async () => {
    const ctx = await createApiTestCtx({ seqUserIdBase: 1_900_100, apiUrlPort: 19101 });

    // Resolve a test user's stable userId via the handle binding it writes when
    // it first creates an app (mirrors list-notifications.test.ts).
    async function userIdOf(api: typeof ctx.api): Promise<string> {
      const rRes = await api.ensureAppSlug({
        mode: "dev",
        fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return null} App();` }],
      });
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) throw new Error(`ensureAppSlug failed: ${JSON.stringify(res)}`);
      const usb = ctx.appCtx.vibesCtx.sql.tables.handleBinding;
      const row = await ctx.appCtx.vibesCtx.sql.db
        .select({ userId: usb.userId })
        .from(usb)
        .where(eq(usb.handle, res.ownerHandle))
        .limit(1)
        .then((r) => r[0]);
      if (!row) throw new Error(`no handle binding for ${res.ownerHandle}`);
      return row.userId;
    }

    const ownerUserId = await userIdOf(ctx.api);

    // Owner publishes a production app with public access so a non-owner may clone.
    const rSrc = await ctx.api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return <div>clone-notify</div>} App();` },
      ],
    });
    const src = rSrc.Ok();
    if (!isResEnsureAppSlugOk(src)) throw new Error(`source ensureAppSlug failed: ${JSON.stringify(src)}`);
    await ctx.api.ensureAppSettings({ appSlug: src.appSlug, ownerHandle: src.ownerHandle, publicAccess: { enable: true } });

    // Non-owner clones (skipChat) — lands directly in production, no evt-new-fs-id.
    const rFork = await ctx.api2.forkApp({ srcUserSlug: src.ownerHandle, srcAppSlug: src.appSlug, skipChat: true });
    if (rFork.isErr()) throw new Error(`forkApp(skipChat) failed: ${JSON.stringify(rFork.Err())}`);
    const fork = rFork.Ok();

    // Exactly one durable vibe-remixed row for the SOURCE owner.
    const t = ctx.appCtx.vibesCtx.sql.tables.notifications;
    const rows = await ctx.appCtx.vibesCtx.sql.db
      .select()
      .from(t)
      .where(eq(t.userId, ownerUserId))
      .then((rs) => rs.filter((r) => r.notificationType === "vibe-remixed"));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.ownerHandle).toBe(src.ownerHandle);
    expect(row.appSlug).toBe(src.appSlug);
    expect(row.actorHandle).toBe(fork.ownerHandle);
    expect(row.dedupeKey).toBe(`vibe-remixed:${fork.ownerHandle}/${fork.appSlug}`);
  });

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
