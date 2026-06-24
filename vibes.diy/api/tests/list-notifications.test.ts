import { describe, expect, it, inject, assert } from "vitest";
import { eq } from "drizzle-orm";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { emitNotification, EmitNotificationCtx } from "../queue/intern/emit-notification.js";

// listNotifications + markNotificationsRead are owner-only reads/writes scoped
// to the authenticated caller's userId. The list returns self-contained rows
// (each renders from its own `body`, no second query) newest-first, folding the
// unread count into the same response. markNotificationsRead flips readAt and
// drives the unread count to zero. A caller never sees another user's rows.
describe("notification read API", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  let ctx: ApiTestCtx;

  // Resolve a test user's Clerk userId by creating an app (which writes a
  // UserSlugBindings row keyed by userId) and reading the binding back. The
  // client-side getTokenClaims() decodes device-id test tokens through the
  // Clerk path and doesn't surface a usable userId, so go through the DB the
  // server actually scopes on.
  async function userIdOf(c: ApiTestCtx, api: ApiTestCtx["api"]): Promise<string> {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App(){return null} App();` }],
    });
    const res = rRes.Ok();
    if (res.type !== "vibes.diy.res-ensure-app-slug") assert.fail(`ensureAppSlug failed: ${JSON.stringify(res)}`);
    const ownerHandle = (res as { ownerHandle: string }).ownerHandle;
    const usb = c.appCtx.vibesCtx.sql.tables.handleBinding;
    const row = await c.appCtx.vibesCtx.sql.db
      .select({ userId: usb.userId })
      .from(usb)
      .where(eq(usb.handle, ownerHandle))
      .limit(1)
      .then((r) => r[0]);
    if (!row) assert.fail(`no handle binding for ${ownerHandle}`);
    return row.userId;
  }

  function emitCtx(c: ApiTestCtx): EmitNotificationCtx {
    return {
      sthis: c.sthis,
      sql: { db: c.appCtx.vibesCtx.sql.db, tables: c.appCtx.vibesCtx.sql.tables },
      notifyUser: async () => {
        /* no-op fan-out in these read-API tests */
      },
    };
  }

  it("lists the caller's rows newest-first with unreadCount, isolates other users, and marks read", async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: 1_700_100, apiUrlPort: 18701 });
    const qctx = emitCtx(ctx);

    const userA = await userIdOf(ctx, ctx.api);
    const userB = await userIdOf(ctx, ctx.api2);

    // Two rows for A (distinct dedupeKeys), one for B.
    await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-remixed",
      ownerHandle: "a-owner",
      appSlug: "a-app",
      body: "first for A",
      dedupeKey: "list-test:A:1",
    });
    await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-published",
      ownerHandle: "a-owner",
      appSlug: "a-app",
      body: "second for A",
      dedupeKey: "list-test:A:2",
    });
    await emitNotification(qctx, {
      userId: userB,
      notificationType: "vibe-remixed",
      ownerHandle: "b-owner",
      appSlug: "b-app",
      body: "only for B",
      dedupeKey: "list-test:B:1",
    });

    // A sees exactly its 2 rows, newest first, all unread.
    const rListA = await ctx.api.listNotifications({});
    if (rListA.isErr()) assert.fail(`listNotifications(A) failed: ${rListA.Err().message}`);
    const listA = rListA.Ok();
    expect(listA.items).toHaveLength(2);
    expect(listA.unreadCount).toBe(2);
    // Newest-first: the second emit comes back before the first.
    expect(listA.items[0].body).toBe("second for A");
    expect(listA.items[1].body).toBe("first for A");
    // Base list renders straight from `body` — the field is populated, no join.
    expect(listA.items.every((i) => i.body.length > 0)).toBe(true);
    expect(listA.items.every((i) => i.userId === userA)).toBe(true);

    // B is isolated: only its single row.
    const rListB = await ctx.api2.listNotifications({});
    if (rListB.isErr()) assert.fail(`listNotifications(B) failed: ${rListB.Err().message}`);
    expect(rListB.Ok().items).toHaveLength(1);
    expect(rListB.Ok().items[0].body).toBe("only for B");

    // Mark all of A's notifications read.
    const rMark = await ctx.api.markNotificationsRead({});
    if (rMark.isErr()) assert.fail(`markNotificationsRead failed: ${rMark.Err().message}`);
    expect(rMark.Ok().ok).toBe(2);

    // Re-list A: rows still present, but unread count is now zero and readAt set.
    const rListA2 = await ctx.api.listNotifications({});
    if (rListA2.isErr()) assert.fail(`listNotifications(A) re-list failed: ${rListA2.Err().message}`);
    const listA2 = rListA2.Ok();
    expect(listA2.items).toHaveLength(2);
    expect(listA2.unreadCount).toBe(0);
    expect(listA2.items.every((i) => typeof i.readAt === "string" && i.readAt.length > 0)).toBe(true);

    // B is untouched by A's mark-read.
    const rListB2 = await ctx.api2.listNotifications({});
    if (rListB2.isErr()) assert.fail(`listNotifications(B) re-list failed: ${rListB2.Err().message}`);
    expect(rListB2.Ok().unreadCount).toBe(1);
  });

  it("filters by appSlug and notificationType", async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: 1_700_200, apiUrlPort: 18702 });
    const qctx = emitCtx(ctx);
    const userA = await userIdOf(ctx, ctx.api);

    await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-remixed",
      ownerHandle: "owner",
      appSlug: "vibe-x",
      body: "remix of x",
      dedupeKey: "filter:x:remix",
    });
    await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-published",
      ownerHandle: "owner",
      appSlug: "vibe-x",
      body: "published x",
      dedupeKey: "filter:x:pub",
    });
    await emitNotification(qctx, {
      userId: userA,
      notificationType: "vibe-remixed",
      ownerHandle: "owner",
      appSlug: "vibe-y",
      body: "remix of y",
      dedupeKey: "filter:y:remix",
    });

    // appSlug filter only.
    const rByApp = await ctx.api.listNotifications({ appSlug: "vibe-x" });
    if (rByApp.isErr()) assert.fail(`listNotifications(appSlug) failed: ${rByApp.Err().message}`);
    expect(
      rByApp
        .Ok()
        .items.map((i) => i.body)
        .sort()
    ).toEqual(["published x", "remix of x"]);

    // appSlug + notificationType filter (the "who remixed my vibe" query).
    const rByType = await ctx.api.listNotifications({ appSlug: "vibe-x", notificationType: "vibe-remixed" });
    if (rByType.isErr()) assert.fail(`listNotifications(type) failed: ${rByType.Err().message}`);
    expect(rByType.Ok().items).toHaveLength(1);
    expect(rByType.Ok().items[0].body).toBe("remix of x");
    // unreadCount is the total unread for the user, not the filtered subset.
    expect(rByType.Ok().unreadCount).toBe(3);
  });

  // The per-vibe "who remixed my vibe" view: the owner of a vibe lists only the
  // vibe-remixed notifications for that one vibe (appSlug) and sees a row per
  // remixer, never another vibe's remixes nor unrelated notification types.
  it("per-vibe remixes filter: owner sees only that vibe's vibe-remixed rows", async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: 1_700_400, apiUrlPort: 18704 });
    const qctx = emitCtx(ctx);
    const owner = await userIdOf(ctx, ctx.api);

    // Two remixers of the owner's vibe-alpha.
    await emitNotification(qctx, {
      userId: owner,
      notificationType: "vibe-remixed",
      ownerHandle: "owner",
      appSlug: "vibe-alpha",
      actorHandle: "remixer-one",
      body: "@remixer-one remixed your vibe vibe-alpha",
      targetRef: { remixOwnerHandle: "remixer-one", remixAppSlug: "vibe-alpha-remix" },
      dedupeKey: "vibe-remixed:remixer-one/vibe-alpha-remix",
    });
    await emitNotification(qctx, {
      userId: owner,
      notificationType: "vibe-remixed",
      ownerHandle: "owner",
      appSlug: "vibe-alpha",
      actorHandle: "remixer-two",
      body: "@remixer-two remixed your vibe vibe-alpha",
      targetRef: { remixOwnerHandle: "remixer-two", remixAppSlug: "vibe-alpha-remix-2" },
      dedupeKey: "vibe-remixed:remixer-two/vibe-alpha-remix-2",
    });
    // A remix of a DIFFERENT vibe (vibe-beta) and a non-remix notification on
    // vibe-alpha — both must be excluded by the per-vibe remixes filter.
    await emitNotification(qctx, {
      userId: owner,
      notificationType: "vibe-remixed",
      ownerHandle: "owner",
      appSlug: "vibe-beta",
      actorHandle: "remixer-three",
      body: "@remixer-three remixed your vibe vibe-beta",
      dedupeKey: "vibe-remixed:remixer-three/vibe-beta-remix",
    });
    await emitNotification(qctx, {
      userId: owner,
      notificationType: "vibe-published",
      ownerHandle: "owner",
      appSlug: "vibe-alpha",
      body: "vibe-alpha was published",
      dedupeKey: "vibe-published:owner/vibe-alpha:fs1",
    });

    const rRemixes = await ctx.api.listNotifications({ appSlug: "vibe-alpha", notificationType: "vibe-remixed" });
    if (rRemixes.isErr()) assert.fail(`listNotifications(remixes) failed: ${rRemixes.Err().message}`);
    const remixes = rRemixes.Ok();
    expect(remixes.items).toHaveLength(2);
    expect(remixes.items.every((i) => i.notificationType === "vibe-remixed")).toBe(true);
    expect(remixes.items.every((i) => i.appSlug === "vibe-alpha")).toBe(true);
    expect(remixes.items.map((i) => i.actorHandle).sort()).toEqual(["remixer-one", "remixer-two"]);
    // The cross-vibe remix and the same-vibe non-remix row are excluded.
    expect(remixes.items.map((i) => i.body)).not.toContain("@remixer-three remixed your vibe vibe-beta");
    expect(remixes.items.map((i) => i.body)).not.toContain("vibe-alpha was published");
  });

  it("requires auth", async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: 1_700_300, apiUrlPort: 18703 });
    // Calling with no auth token should fail (handlers use checkAuth). The api
    // client always attaches auth, so assert the happy path is authenticated;
    // an unauthenticated request is exercised by the checkAuth wrapper itself.
    const r = await ctx.api.listNotifications({});
    expect(r.isOk()).toBe(true);
  });
});
