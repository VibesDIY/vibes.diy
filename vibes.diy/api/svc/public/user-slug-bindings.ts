import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { and, eq, inArray } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm/sql";
import {
  MsgBase,
  ReqWithVerifiedAuth,
  ResError,
  W3CWebSocketEvent,
  ReqListUserSlugBindings,
  ResListUserSlugBindings,
  ReqCreateUserSlugBinding,
  ResCreateUserSlugBinding,
  ReqDeleteUserSlugBinding,
  ResDeleteUserSlugBinding,
  isReqListUserSlugBindings,
  isReqCreateUserSlugBinding,
  isReqDeleteUserSlugBinding,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { writeUserSlugBinding, toRFC2822_32ByteLength } from "../intern/ensure-slug-binding.js";
import { generate } from "random-words";

export const listUserSlugBindingsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListUserSlugBindings>,
  ResListUserSlugBindings | ResError
> = {
  hash: "list-user-slug-bindings",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqListUserSlugBindings(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqListUserSlugBindings }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListUserSlugBindings>>,
        ResListUserSlugBindings | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const rows = await vctx.sql.db
        .select({
          userSlug: vctx.sql.tables.userSlugBinding.userSlug,
          tenant: vctx.sql.tables.userSlugBinding.tenant,
          created: vctx.sql.tables.userSlugBinding.created,
          appSlugCount: sql<number>`count(${vctx.sql.tables.appSlugBinding.appSlug})`,
        })
        .from(vctx.sql.tables.userSlugBinding)
        .leftJoin(
          vctx.sql.tables.appSlugBinding,
          eq(vctx.sql.tables.appSlugBinding.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
        )
        .where(eq(vctx.sql.tables.userSlugBinding.userId, userId))
        .groupBy(
          vctx.sql.tables.userSlugBinding.userSlug,
          vctx.sql.tables.userSlugBinding.tenant,
          vctx.sql.tables.userSlugBinding.created
        );

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-user-slug-bindings",
        items: rows.map((r) => ({ ...r, appSlugCount: Number(r.appSlugCount) })),
      } satisfies ResListUserSlugBindings);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const createUserSlugBindingEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqCreateUserSlugBinding>,
  ResCreateUserSlugBinding | ResError
> = {
  hash: "create-user-slug-binding",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqCreateUserSlugBinding(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqCreateUserSlugBinding }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqCreateUserSlugBinding>>,
        ResCreateUserSlugBinding | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      let userSlug: string;
      if (req.userSlug) {
        userSlug = toRFC2822_32ByteLength(req.userSlug);
      } else {
        let generated: string | undefined;
        for (let attempts = 0; attempts < 5; attempts++) {
          const candidate = generate({ exactly: 1, wordsPerString: 3, separator: "-" })[0];
          if (candidate.length > 30) continue;
          const existing = await vctx.sql.db
            .select()
            .from(vctx.sql.tables.userSlugBinding)
            .where(eq(vctx.sql.tables.userSlugBinding.userSlug, candidate))
            .limit(1)
            .then((r) => r[0]);
          if (!existing) {
            generated = candidate;
            break;
          }
        }
        if (!generated) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.error",
            message: "could not generate unique userSlug after 5 attempts",
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        userSlug = generated;
      }

      const result = await writeUserSlugBinding(vctx, userId, userSlug);
      if (result.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: result.Err().message,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const binding = result.Ok();
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-create-user-slug-binding",
        userSlug: binding.userSlug,
        tenant: binding.tenant,
        created: new Date().toISOString(),
      } satisfies ResCreateUserSlugBinding);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const deleteUserSlugBindingEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqDeleteUserSlugBinding>,
  ResDeleteUserSlugBinding | ResError
> = {
  hash: "delete-user-slug-binding",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqDeleteUserSlugBinding(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqDeleteUserSlugBinding }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqDeleteUserSlugBinding>>,
        ResDeleteUserSlugBinding | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const { userSlug } = req;
      const t = vctx.sql.tables;

      // Subquery: all chatIds owned by this user+userSlug
      const chatIdSubquery = vctx.sql.db
        .select({ chatId: t.chatContexts.chatId })
        .from(t.chatContexts)
        .where(and(eq(t.chatContexts.userSlug, userSlug), eq(t.chatContexts.userId, userId)));

      // 1. ChatSections — via chatId subquery
      await vctx.sql.db.delete(t.chatSections).where(inArray(t.chatSections.chatId, chatIdSubquery));

      // 2. PromptContexts — via chatId subquery
      await vctx.sql.db.delete(t.promptContexts).where(inArray(t.promptContexts.chatId, chatIdSubquery));

      // 3. ChatContexts
      await vctx.sql.db.delete(t.chatContexts).where(and(eq(t.chatContexts.userSlug, userSlug), eq(t.chatContexts.userId, userId)));

      // 4. ApplicationChats
      await vctx.sql.db
        .delete(t.applicationChats)
        .where(and(eq(t.applicationChats.userSlug, userSlug), eq(t.applicationChats.userId, userId)));

      // 5. AppSettings
      await vctx.sql.db.delete(t.appSettings).where(and(eq(t.appSettings.userSlug, userSlug), eq(t.appSettings.userId, userId)));

      // 6. RequestGrants
      await vctx.sql.db
        .delete(t.requestGrants)
        .where(and(eq(t.requestGrants.userSlug, userSlug), eq(t.requestGrants.userId, userId)));

      // 7. InviteGrants
      await vctx.sql.db.delete(t.inviteGrants).where(and(eq(t.inviteGrants.userSlug, userSlug), eq(t.inviteGrants.userId, userId)));

      // 8. Apps
      await vctx.sql.db.delete(t.apps).where(and(eq(t.apps.userSlug, userSlug), eq(t.apps.userId, userId)));

      // 9. AppSlugBindings
      await vctx.sql.db.delete(t.appSlugBinding).where(eq(t.appSlugBinding.userSlug, userSlug));

      // 10. UserSlugBindings
      await vctx.sql.db
        .delete(t.userSlugBinding)
        .where(and(eq(t.userSlugBinding.userId, userId), eq(t.userSlugBinding.userSlug, userSlug)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-delete-user-slug-binding",
        userSlug,
        deleted: true,
      } satisfies ResDeleteUserSlugBinding);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
