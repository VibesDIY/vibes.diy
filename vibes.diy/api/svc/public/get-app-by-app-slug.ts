import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetAppByAppSlug,
  ReqGetAppByAppSlug,
  ResGetAppByFsId,
  VibesDiyError,
  W3CWebSocketEvent,
  FileSystemItem,
  MetaItem,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { eq, and, desc } from "drizzle-orm";

export const getAppByAppSlugEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetAppByAppSlug>,
  ResGetAppByFsId | VibesDiyError
> = {
  hash: "get-app-by-app-slug",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetAppByAppSlug(msg.payload);
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

  // checkAuth(
  //   async (
  //     ctx: HandleTriggerCtx<
  //       W3CWebSocketEvent,
  //       MsgBase<ReqWithVerifiedAuth<ReqListApplicationChats>>,
  //       ResListApplicationChats | VibesDiyError
  //     >
  //   )

  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqGetAppByAppSlug>>, ResGetAppByFsId | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const callerUserId = req.auth.verifiedAuth.claims.userId;

      // Production wins even if older — try production first (any authenticated caller)
      const productionApp = await vctx.db
        .select()
        .from(sqlApps)
        .where(and(eq(sqlApps.userSlug, req.userSlug), eq(sqlApps.appSlug, req.appSlug), eq(sqlApps.mode, "production")))
        .orderBy(desc(sqlApps.releaseSeq))
        .get();

      if (productionApp) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-app-by-fsid",
          appSlug: productionApp.appSlug,
          userSlug: productionApp.userSlug,
          fsId: productionApp.fsId,
          mode: productionApp.mode as "production" | "dev",
          releaseSeq: productionApp.releaseSeq,
          env: productionApp.env as Record<string, string>,
          fileSystem: productionApp.fileSystem as FileSystemItem[],
          meta: productionApp.meta as MetaItem[],
          created: productionApp.created,
        } satisfies ResGetAppByFsId);
        return Result.Ok(EventoResult.Continue);
      }

      // No production app — youngest dev, owner only
      const devApp = await vctx.db
        .select()
        .from(sqlApps)
        .where(and(eq(sqlApps.userSlug, req.userSlug), eq(sqlApps.appSlug, req.appSlug)))
        .orderBy(desc(sqlApps.releaseSeq))
        .get();

      if (!devApp) {
        return Result.Err(`app not found for ${req.userSlug}/${req.appSlug}`);
      }

      if (devApp.userId !== callerUserId) {
        return Result.Err(`app not found for ${req.userSlug}/${req.appSlug}`);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-app-by-fsid",
        appSlug: devApp.appSlug,
        userSlug: devApp.userSlug,
        fsId: devApp.fsId,
        mode: devApp.mode as "production" | "dev",
        releaseSeq: devApp.releaseSeq,
        env: devApp.env as Record<string, string>,
        fileSystem: devApp.fileSystem as FileSystemItem[],
        meta: devApp.meta as MetaItem[],
        created: devApp.created,
      } satisfies ResGetAppByFsId);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
