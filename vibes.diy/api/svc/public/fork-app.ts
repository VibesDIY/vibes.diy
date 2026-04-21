import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  reqForkApp,
  ReqForkApp,
  ResForkApp,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  MetaItem,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { max } from "drizzle-orm/sql";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import {
  ensureAppSlug,
  ensureUserSlug,
  getDefaultUserSlug,
  persistDefaultUserSlug,
} from "../intern/ensure-slug-binding.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { hasAccessInvite } from "./invite-flow.js";
import { hasAccessRequest } from "./request-flow.js";

export async function forkApp(
  vctx: VibesApiSQLCtx,
  req: ReqForkApp,
  userId: string,
  claims: ReqWithVerifiedAuth<ReqForkApp>["_auth"]["verifiedAuth"]["claims"]
): Promise<Result<ResForkApp>> {
  // 1. Locate the source app row. Mirrors get-app-by-fsid.ts selection.
  let src: typeof vctx.sql.tables.apps.$inferSelect | undefined;
  if (req.srcFsId) {
    src = await vctx.sql.db
      .select()
      .from(vctx.sql.tables.apps)
      .where(
        and(
          eq(vctx.sql.tables.apps.fsId, req.srcFsId),
          eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug),
          eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug)
        )
      )
      .limit(1)
      .then((r) => r[0]);
  } else {
    const maxCreatedSub = vctx.sql.db
      .select({ mode: vctx.sql.tables.apps.mode, maxCreated: max(vctx.sql.tables.apps.created).as("max_created") })
      .from(vctx.sql.tables.apps)
      .where(and(eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug), eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug)))
      .groupBy(vctx.sql.tables.apps.mode)
      .as("mc");
    const rows = await vctx.sql.db
      .select({
        appSlug: vctx.sql.tables.apps.appSlug,
        userId: vctx.sql.tables.apps.userId,
        userSlug: vctx.sql.tables.apps.userSlug,
        releaseSeq: vctx.sql.tables.apps.releaseSeq,
        fsId: vctx.sql.tables.apps.fsId,
        env: vctx.sql.tables.apps.env,
        fileSystem: vctx.sql.tables.apps.fileSystem,
        meta: vctx.sql.tables.apps.meta,
        mode: vctx.sql.tables.apps.mode,
        created: vctx.sql.tables.apps.created,
      })
      .from(vctx.sql.tables.apps)
      .innerJoin(
        maxCreatedSub,
        and(
          eq(vctx.sql.tables.apps.mode, maxCreatedSub.mode),
          eq(vctx.sql.tables.apps.created, maxCreatedSub.maxCreated),
          eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug),
          eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug)
        )
      )
      .orderBy(vctx.sql.tables.apps.mode);
    src = rows[rows.length - 1];
  }
  if (!src) {
    return Result.Err("app-not-found");
  }

  // 2. Grant check mirrors /vibe view rules: allow owner, public-access,
  //    invite-accepted, or request-approved.
  const isOwner = userId === src.userId;
  if (!isOwner) {
    const rAppSet = await ensureAppSettings(vctx, {
      type: "vibes.diy.req-ensure-app-settings",
      appSlug: src.appSlug,
      userSlug: src.userSlug,
    });
    if (rAppSet.isErr()) return Result.Err("app-settings-not-found");
    const settings = rAppSet.Ok().settings;
    const isPublic = settings.entry.publicAccess?.enable && src.mode === "production";
    let granted = isPublic;
    if (!granted) {
      const rInvite = await hasAccessInvite(vctx, { appSlug: src.appSlug, userSlug: src.userSlug, grantUserId: userId });
      if (rInvite.isOk() && isResHasAccessInviteAccepted(rInvite.Ok())) granted = true;
    }
    if (!granted) {
      const rReq = await hasAccessRequest(vctx, { appSlug: src.appSlug, userSlug: src.userSlug, foreignUserId: userId });
      if (rReq.isOk() && isResHasAccessRequestApproved(rReq.Ok())) granted = true;
    }
    if (!granted) return Result.Err("not-grant");
  }

  // 3. Resolve caller's default userSlug; mirror ensureChatId.
  let destUserSlug: string;
  const rDefault = await getDefaultUserSlug(vctx, userId);
  if (rDefault.isErr()) return Result.Err(`Failed to get default userSlug: ${rDefault.Err().message}`);
  const defaultBinding = rDefault.Ok();
  if (defaultBinding) {
    destUserSlug = defaultBinding.userSlug;
  } else {
    const rNew = await ensureUserSlug(vctx, claims, { userId });
    if (rNew.isErr()) return Result.Err(`Failed to ensure userSlug: ${rNew.Err().message}`);
    destUserSlug = rNew.Ok().userSlug;
    await persistDefaultUserSlug(vctx, userId, destUserSlug);
  }

  // 4. Allocate a fresh appSlug under the caller. Seed preferredPairs with
  //    `${srcAppSlug}-remix` using the source title when available.
  const srcMeta = (src.meta as MetaItem[] | undefined) ?? [];
  const titleMeta = srcMeta.find((m): m is Extract<MetaItem, { type: "title" }> => m.type === "title");
  const sourceTitle = titleMeta?.title ?? req.srcAppSlug;
  const rApp = await ensureAppSlug(vctx, {
    userId,
    userSlug: destUserSlug,
    preferredPairs: [{ title: sourceTitle, slug: `${req.srcAppSlug}-remix` }],
  });
  if (rApp.isErr()) return Result.Err(`Failed to ensure appSlug: ${rApp.Err().message}`);
  const destAppSlug = rApp.Ok().appSlug;

  // 5. Insert a new Apps row that shares the source's fileSystem/env refs.
  //    Storage is content-addressed so the new owner points at the same
  //    underlying assets with no copy. The `remix-of` meta entry carries
  //    srcFsId as the immutable anchor; display slugs are resolved live on
  //    read so renames of srcUserSlug/srcAppSlug are followed automatically.
  //    Only the direct parent is stored — full lineage is reconstructed by
  //    walking srcFsId pointers across Apps rows. Screenshot carries over as
  //    a placeholder until the fork generates its own.
  const destMeta: MetaItem[] = [
    ...srcMeta.filter((m) => m.type !== "remix-of"),
    { type: "remix-of", srcFsId: src.fsId },
  ];
  const rIns = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.apps).values({
      appSlug: destAppSlug,
      userId,
      userSlug: destUserSlug,
      releaseSeq: 1,
      fsId: src.fsId,
      env: src.env,
      fileSystem: src.fileSystem,
      meta: destMeta,
      mode: "dev",
      created: new Date().toISOString(),
    })
  );
  if (rIns.isErr()) return Result.Err(`Failed to insert forked app: ${rIns.Err().message}`);

  // 6. Create the chat-context row so the client's openChat finds this pair.
  const chatId = vctx.sthis.nextId(12).str;
  const rChat = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.chatContexts).values({
      chatId,
      userId,
      appSlug: destAppSlug,
      userSlug: destUserSlug,
      created: new Date().toISOString(),
    })
  );
  if (rChat.isErr()) return Result.Err(`Failed to create chatContext: ${rChat.Err().message}`);

  return Result.Ok({
    type: "vibes.diy.res-fork-app",
    userSlug: destUserSlug,
    appSlug: destAppSlug,
    chatId,
    srcFsId: src.fsId,
    srcUserSlug: src.userSlug,
    srcAppSlug: src.appSlug,
  } satisfies ResForkApp);
}

export const forkAppEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqForkApp>, ResForkApp | VibesDiyError> = {
  hash: "fork-app",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqForkApp(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqForkApp>>, ResForkApp | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rRes = await forkApp(vctx, req as unknown as ReqForkApp, req._auth.verifiedAuth.claims.userId, req._auth.verifiedAuth.claims);
      if (rRes.isErr()) {
        return Result.Err(rRes);
      }
      await ctx.send.send(ctx, rRes.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
