import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListUserSlugAppSlug,
  ReqListUserSlugAppSlug,
  ReqWithVerifiedAuth,
  ResListUserSlugAppSlug,
  ResListUserSlugAppSlugItem,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, desc } from "drizzle-orm/sql/expressions";
import type { SQL } from "drizzle-orm/sql";

export const listUserSlugAppSlugEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListUserSlugAppSlug>,
  ResListUserSlugAppSlug | VibesDiyError
> = {
  hash: "list-ownerHandle-appSlug",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListUserSlugAppSlug(msg.payload);
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
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListUserSlugAppSlug>>,
        ResListUserSlugAppSlug | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const conditions: SQL[] = [eq(vctx.sql.tables.handleBinding.userId, userId)];
      if (req.ownerHandle) {
        conditions.push(eq(vctx.sql.tables.handleBinding.handle, req.ownerHandle));
      }
      if (req.appSlug) {
        conditions.push(eq(vctx.sql.tables.appSlugBinding.appSlug, req.appSlug));
      }

      const rows = await vctx.sql.db
        .select({
          ownerHandle: vctx.sql.tables.handleBinding.handle,
          userId: vctx.sql.tables.handleBinding.userId,
          appSlug: vctx.sql.tables.appSlugBinding.appSlug,
          appCreated: vctx.sql.tables.appSlugBinding.created,
          userCreated: vctx.sql.tables.handleBinding.created,
        })
        .from(vctx.sql.tables.handleBinding)
        .leftJoin(
          vctx.sql.tables.appSlugBinding,
          eq(vctx.sql.tables.appSlugBinding.ownerHandle, vctx.sql.tables.handleBinding.handle)
        )
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.handleBinding.created), desc(vctx.sql.tables.appSlugBinding.created));

      // Group by ownerHandle
      const grouped = new Map<string, string[]>();
      for (const row of rows) {
        if (!grouped.has(row.ownerHandle)) {
          grouped.set(row.ownerHandle, []);
        }
        if (row.appSlug) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          grouped.get(row.ownerHandle)!.push(row.appSlug);
        }
      }

      const items: ResListUserSlugAppSlugItem[] = Array.from(grouped.entries()).map(([ownerHandle, appSlugs]) => ({
        userId,
        ownerHandle,
        appSlugs,
      }));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-user-slug-app-slug",
        items,
      } satisfies ResListUserSlugAppSlug);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
