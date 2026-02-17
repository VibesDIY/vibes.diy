import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListUserSlugAppSlug,
  ReqListUserSlugAppSlug,
  ResListUserSlugAppSlug,
  ResListUserSlugAppSlugItem,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlAppSlugBinding, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";
import { eq, and, desc, SQL } from "drizzle-orm";

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
      const userId = req.auth.verifiedAuth.claims.userId;

      const conditions: SQL[] = [eq(sqlUserSlugBinding.userId, userId)];
      if (req.userSlug) {
        conditions.push(eq(sqlUserSlugBinding.userSlug, req.userSlug));
      }
      if (req.appSlug) {
        conditions.push(eq(sqlAppSlugBinding.appSlug, req.appSlug));
      }

      const rows = await vctx.db
        .select({
          userSlug: sqlUserSlugBinding.userSlug,
          userId: sqlUserSlugBinding.userId,
          appSlug: sqlAppSlugBinding.appSlug,
          appCreated: sqlAppSlugBinding.created,
          userCreated: sqlUserSlugBinding.created,
        })
        .from(sqlUserSlugBinding)
        .leftJoin(sqlAppSlugBinding, eq(sqlAppSlugBinding.userSlug, sqlUserSlugBinding.userSlug))
        .where(and(...conditions))
        .orderBy(desc(sqlUserSlugBinding.created), desc(sqlAppSlugBinding.created))
        .all();

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
