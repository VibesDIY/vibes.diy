import { describe, expect, it, inject } from "vitest";
import { eq } from "drizzle-orm";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { MetaItem, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { EmitNotificationCtx, notifyRemixCloneOwner, notifyRemixSourceOwner } from "@vibes.diy/api-svc";
import { isEvtRemixCloneNotify, MsgBase } from "@vibes.diy/api-types";
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
  // not cover it. Rather than notify inline (where a transient failure would
  // permanently drop the notification), forkApp ENQUEUES an
  // evt-remix-clone-notify so it gets the same at-least-once retry as the
  // classic-remix publish path. The test ctx does not run the queue worker, so
  // this splits into two parts: (1) forkApp enqueues the message carrying the
  // clone's (ownerHandle, appSlug); (2) given that message, notifyRemixCloneOwner
  // (the handler core) re-loads the clone row + meta and leaves exactly one
  // durable vibe-remixed row for the SOURCE owner — and redelivery is once-only.
  it("clone path (forkApp skipChat) enqueues, then the handler notifies the source owner once", async () => {
    const enqueued: MsgBase[] = [];
    const ctx = await createApiTestCtx({
      seqUserIdBase: 1_900_100,
      apiUrlPort: 19101,
      postQueue: async (msg) => {
        enqueued.push(msg);
      },
    });

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

    // (1) forkApp enqueued exactly one evt-remix-clone-notify for the clone.
    const t = ctx.appCtx.vibesCtx.sql.tables.notifications;
    const cloneMsgs = enqueued.filter((m) => isEvtRemixCloneNotify(m.payload));
    expect(cloneMsgs).toHaveLength(1);
    const payload = cloneMsgs[0].payload;
    if (!isEvtRemixCloneNotify(payload)) throw new Error("expected evt-remix-clone-notify payload");
    expect(payload.ownerHandle).toBe(fork.ownerHandle);
    expect(payload.appSlug).toBe(fork.appSlug);

    // No durable row yet — the queue worker has not run.
    const beforeRows = await ctx.appCtx.vibesCtx.sql.db
      .select()
      .from(t)
      .where(eq(t.userId, ownerUserId))
      .then((rs) => rs.filter((r) => r.notificationType === "vibe-remixed"));
    expect(beforeRows).toHaveLength(0);

    // (2) Drive the handler core with the enqueued message: re-loads the clone
    //     row + meta and leaves exactly one durable vibe-remixed row for the
    //     SOURCE owner.
    const qctx: EmitNotificationCtx = { sthis: ctx.sthis, sql: ctx.appCtx.vibesCtx.sql };
    await notifyRemixCloneOwner(qctx, payload);

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

    // Redelivery is once-only: processing the same message again adds no row.
    await notifyRemixCloneOwner(qctx, payload);
    const afterRows = await ctx.appCtx.vibesCtx.sql.db
      .select()
      .from(t)
      .where(eq(t.userId, ownerUserId))
      .then((rs) => rs.filter((r) => r.notificationType === "vibe-remixed"));
    expect(afterRows).toHaveLength(1);
  });

  // Queued clone-path (notifyRemixCloneOwner) re-loads the clone row by
  // (ownerHandle, appSlug) and delegates to notifyRemixSourceOwner, so the
  // self-clone and legacy-no-srcUserId guards must hold through the queued path
  // too: no vibe-remixed row is produced.
  async function insertCloneRow(
    appCtx: Awaited<ReturnType<typeof makeCtx>>["appCtx"],
    opts: { userId: string; ownerHandle: string; appSlug: string; meta: MetaItem[] }
  ): Promise<void> {
    const t = appCtx.vibesCtx.sql.tables.apps;
    await appCtx.vibesCtx.sql.db.insert(t).values({
      appSlug: opts.appSlug,
      userId: opts.userId,
      ownerHandle: opts.ownerHandle,
      releaseSeq: 1,
      fsId: "fs-clone",
      env: [],
      fileSystem: [],
      meta: opts.meta,
      mode: "production",
      created: new Date().toISOString(),
    });
  }

  it("queued clone path: self-clone emits no row", async () => {
    const { appCtx, qctx } = await makeCtx();
    const selfId = `self-${sthis.nextId().str}`;
    const handle = `self-clone-${sthis.nextId().str}`;
    await insertCloneRow(appCtx, {
      userId: selfId,
      ownerHandle: handle,
      appSlug: "self-clone-app",
      meta: [{ type: "remix-of", srcFsId: "fs-src", srcUserId: selfId, srcOwnerHandle: handle, srcAppSlug: "self-src" }],
    });

    await notifyRemixCloneOwner(qctx, { ownerHandle: handle, appSlug: "self-clone-app" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.userId, selfId));
    expect(rows).toHaveLength(0);
  });

  it("queued clone path: legacy remix lacking srcUserId emits no row", async () => {
    const { appCtx, qctx } = await makeCtx();
    const userId = `cloner-${sthis.nextId().str}`;
    const handle = `legacy-clone-${sthis.nextId().str}`;
    await insertCloneRow(appCtx, {
      userId,
      ownerHandle: handle,
      appSlug: "legacy-clone-app",
      meta: [{ type: "remix-of", srcFsId: "fs-legacy" }],
    });

    await notifyRemixCloneOwner(qctx, { ownerHandle: handle, appSlug: "legacy-clone-app" });

    const t = qctx.sql.tables.notifications;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t);
    expect(rows.filter((r) => r.notificationType === "vibe-remixed")).toHaveLength(0);
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
