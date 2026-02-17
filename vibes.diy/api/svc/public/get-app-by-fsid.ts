import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetAppByFsId,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  VibesDiyError,
  W3CWebSocketEvent,
  FileSystemItem,
  MetaItem,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithOptionalAuth, optAuth } from "../check-auth.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { eq, desc } from "drizzle-orm";

export const getAppByFsIdEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqGetAppByFsId>, ResGetAppByFsId | VibesDiyError> = {
  hash: "get-app-by-fsid",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetAppByFsId(msg.payload);
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
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqGetAppByFsId>>, ResGetAppByFsId | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Determine if the caller is the owner
      const callerUserId = req.auth?.verifiedAuth.claims.userId;

      // Query the app by fsId, newest releaseSeq first
      const app = await vctx.db.select().from(sqlApps).where(eq(sqlApps.fsId, req.fsId)).orderBy(desc(sqlApps.releaseSeq)).get();

      if (!app) {
        return Result.Err(`app not found for fsId: ${req.fsId}`);
      }

      // If not the owner, only return production apps
      const isOwner = callerUserId && callerUserId === app.userId;
      if (!isOwner && app.mode !== "production") {
        return Result.Err(`app not found for fsId: ${req.fsId}`);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-app-by-fsid",
        appSlug: app.appSlug,
        userSlug: app.userSlug,
        fsId: app.fsId,
        mode: app.mode as "production" | "dev",
        releaseSeq: app.releaseSeq,
        env: app.env as Record<string, string>,
        fileSystem: app.fileSystem as FileSystemItem[],
        meta: app.meta as MetaItem[],
        created: app.created,
      } satisfies ResGetAppByFsId);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
