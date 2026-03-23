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
  hash: "list-userSlug-appSlug",
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

      const conditions: SQL[] = [eq(vctx.sql.tables.userSlugBinding.userId, userId)];
      if (req.userSlug) {
        conditions.push(eq(vctx.sql.tables.userSlugBinding.userSlug, req.userSlug));
      }
      if (req.appSlug) {
        conditions.push(eq(vctx.sql.tables.appSlugBinding.appSlug, req.appSlug));
      }

      const rows = await vctx.sql.db
        .select({
          userSlug: vctx.sql.tables.userSlugBinding.userSlug,
          userId: vctx.sql.tables.userSlugBinding.userId,
          appSlug: vctx.sql.tables.appSlugBinding.appSlug,
          appCreated: vctx.sql.tables.appSlugBinding.created,
          userCreated: vctx.sql.tables.userSlugBinding.created,
        })
        .from(vctx.sql.tables.userSlugBinding)
        .leftJoin(
          vctx.sql.tables.appSlugBinding,
          eq(vctx.sql.tables.appSlugBinding.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
        )
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.userSlugBinding.created), desc(vctx.sql.tables.appSlugBinding.created));

      // Group by userSlug
      const grouped = new Map<string, string[]>();
      for (const row of rows) {
        if (!grouped.has(row.userSlug)) {
          grouped.set(row.userSlug, []);
        }
        if (row.appSlug) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          grouped.get(row.userSlug)!.push(row.appSlug);
        }
      }

      const items: ResListUserSlugAppSlugItem[] = Array.from(grouped.entries()).map(([userSlug, appSlugs]) => ({
        userId,
        userSlug,
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
