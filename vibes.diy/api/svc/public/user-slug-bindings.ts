import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { and, eq, inArray } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm/sql";
import {
  MsgBase,
  ReqWithVerifiedAuth,
  ResError,
  W3CWebSocketEvent,
  ReqListHandleBindings,
  ResListHandleBindings,
  ReqCreateHandleBinding,
  ResCreateHandleBinding,
  ReqDeleteHandleBinding,
  ResDeleteHandleBinding,
  isReqListHandleBindings,
  isReqCreateHandleBinding,
  isReqDeleteHandleBinding,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { writeHandleBinding, toRFC2822_32ByteLength } from "../intern/ensure-slug-binding.js";
import { generate } from "random-words";

export const listHandleBindingsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListHandleBindings>,
  ResListHandleBindings | ResError
> = {
  hash: "list-user-slug-bindings",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqListHandleBindings(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqListHandleBindings }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListHandleBindings>>,
        ResListHandleBindings | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const rows = await vctx.sql.db
        .select({
          ownerHandle: vctx.sql.tables.handleBinding.handle,
          tenant: vctx.sql.tables.handleBinding.tenant,
          created: vctx.sql.tables.handleBinding.created,
          appSlugCount: sql<number>`count(${vctx.sql.tables.appSlugBinding.appSlug})`,
        })
        .from(vctx.sql.tables.handleBinding)
        .leftJoin(
          vctx.sql.tables.appSlugBinding,
          eq(vctx.sql.tables.appSlugBinding.ownerHandle, vctx.sql.tables.handleBinding.handle)
        )
        .where(eq(vctx.sql.tables.handleBinding.userId, userId))
        .groupBy(vctx.sql.tables.handleBinding.handle, vctx.sql.tables.handleBinding.tenant, vctx.sql.tables.handleBinding.created);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-user-slug-bindings",
        items: rows.map((r) => ({ ...r, appSlugCount: Number(r.appSlugCount) })),
      } satisfies ResListHandleBindings);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const createHandleBindingEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqCreateHandleBinding>,
  ResCreateHandleBinding | ResError
> = {
  hash: "create-user-slug-binding",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqCreateHandleBinding(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqCreateHandleBinding }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqCreateHandleBinding>>,
        ResCreateHandleBinding | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      let ownerHandle: string;
      if (req.ownerHandle) {
        ownerHandle = toRFC2822_32ByteLength(req.ownerHandle);
      } else {
        let generated: string | undefined;
        for (let attempts = 0; attempts < 5; attempts++) {
          const candidate = generate({ exactly: 1, wordsPerString: 3, separator: "-" })[0];
          if (candidate.length > 30) continue;
          const existing = await vctx.sql.db
            .select()
            .from(vctx.sql.tables.handleBinding)
            .where(eq(vctx.sql.tables.handleBinding.handle, candidate))
            .limit(1)
            .then((r) => r[0]);
          if (!existing) {
            generated = candidate;
            break;
          }
        }
        if (!generated) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "could not generate unique ownerHandle after 5 attempts" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        ownerHandle = generated;
      }

      const result = await writeHandleBinding(vctx, userId, ownerHandle);
      if (result.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: result.Err().message },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const binding = result.Ok();
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-create-user-slug-binding",
        ownerHandle: binding.ownerHandle,
        tenant: binding.tenant,
        created: new Date().toISOString(),
      } satisfies ResCreateHandleBinding);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const deleteHandleBindingEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqDeleteHandleBinding>,
  ResDeleteHandleBinding | ResError
> = {
  hash: "delete-user-slug-binding",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqDeleteHandleBinding(msg.payload);
    if (!ret) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqDeleteHandleBinding }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqDeleteHandleBinding>>,
        ResDeleteHandleBinding | ResError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const { ownerHandle } = req;
      const t = vctx.sql.tables;

      // Subquery: all chatIds owned by this user+ownerHandle
      const chatIdSubquery = vctx.sql.db
        .select({ chatId: t.chatContexts.chatId })
        .from(t.chatContexts)
        .where(and(eq(t.chatContexts.ownerHandle, ownerHandle), eq(t.chatContexts.userId, userId)));

      // 1. ChatSections — via chatId subquery
      await vctx.sql.db.delete(t.chatSections).where(inArray(t.chatSections.chatId, chatIdSubquery));

      // 2. PromptContexts — via chatId subquery
      await vctx.sql.db.delete(t.promptContexts).where(inArray(t.promptContexts.chatId, chatIdSubquery));

      // 3. ChatContexts
      await vctx.sql.db
        .delete(t.chatContexts)
        .where(and(eq(t.chatContexts.ownerHandle, ownerHandle), eq(t.chatContexts.userId, userId)));

      // 4. ApplicationChats
      await vctx.sql.db
        .delete(t.applicationChats)
        .where(and(eq(t.applicationChats.ownerHandle, ownerHandle), eq(t.applicationChats.userId, userId)));

      // 5. AppSettings
      await vctx.sql.db
        .delete(t.appSettings)
        .where(and(eq(t.appSettings.ownerHandle, ownerHandle), eq(t.appSettings.userId, userId)));

      // 6. RequestGrants
      await vctx.sql.db
        .delete(t.requestGrants)
        .where(and(eq(t.requestGrants.ownerHandle, ownerHandle), eq(t.requestGrants.userId, userId)));

      // 7. InviteGrants
      await vctx.sql.db
        .delete(t.inviteGrants)
        .where(and(eq(t.inviteGrants.ownerHandle, ownerHandle), eq(t.inviteGrants.userId, userId)));

      // 8. Apps
      await vctx.sql.db.delete(t.apps).where(and(eq(t.apps.ownerHandle, ownerHandle), eq(t.apps.userId, userId)));

      // 9. AppSlugBindings
      await vctx.sql.db.delete(t.appSlugBinding).where(eq(t.appSlugBinding.ownerHandle, ownerHandle));

      // 10. HandleBindings
      await vctx.sql.db
        .delete(t.handleBinding)
        .where(and(eq(t.handleBinding.userId, userId), eq(t.handleBinding.handle, ownerHandle)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-delete-user-slug-binding",
        ownerHandle,
        deleted: true,
      } satisfies ResDeleteHandleBinding);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
