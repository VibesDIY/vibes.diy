import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  ReqSubscribeUserNotifications,
  ResSubscribeUserNotifications,
  ReqGetUserNotificationPreferences,
  ResGetUserNotificationPreferences,
  ReqSetUserNotificationPreferences,
  ResSetUserNotificationPreferences,
  UserNotificationPreferences,
  defaultUserNotificationPreferences,
  ResError,
  isReqSubscribeUserNotifications,
  isReqGetUserNotificationPreferences,
  isReqSetUserNotificationPreferences,
  userNotificationSubscriptionKey,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq } from "drizzle-orm/sql/expressions";
import { WSSendProvider } from "../svc-ws-send-provider.js";

function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

function toDbFlags(prefs: UserNotificationPreferences): {
  buildCompleteSuccess: number;
  buildCompleteFailed: number;
  commentPosted: number;
  accessRequestPending: number;
} {
  return {
    buildCompleteSuccess: prefs.buildCompleteSuccess ? 1 : 0,
    buildCompleteFailed: prefs.buildCompleteFailed ? 1 : 0,
    commentPosted: prefs.commentPosted ? 1 : 0,
    accessRequestPending: prefs.accessRequestPending ? 1 : 0,
  };
}

function fromDbFlags(row: {
  buildCompleteSuccess: number;
  buildCompleteFailed: number;
  commentPosted: number;
  accessRequestPending: number;
}): UserNotificationPreferences {
  return {
    buildCompleteSuccess: row.buildCompleteSuccess !== 0,
    buildCompleteFailed: row.buildCompleteFailed !== 0,
    commentPosted: row.commentPosted !== 0,
    accessRequestPending: row.accessRequestPending !== 0,
  };
}

async function ensureUserNotificationPreferences(vctx: VibesApiSQLCtx, userId: string): Promise<{
  userId: string;
  buildCompleteSuccess: number;
  buildCompleteFailed: number;
  commentPosted: number;
  accessRequestPending: number;
  updated: string;
  created: string;
}> {
  const t = vctx.sql.tables.userNotificationPreferences;
  const existing = await vctx.sql.db
    .select()
    .from(t)
    .where(eq(t.userId, userId))
    .then((rows) => rows[0]);

  if (existing) return existing;

  const now = new Date().toISOString();
  const defaults = defaultUserNotificationPreferences;
  const created = {
    userId,
    ...toDbFlags(defaults),
    updated: now,
    created: now,
  };

  await vctx.sql.db.insert(t).values(created);
  return created;
}

export const subscribeUserNotificationsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqSubscribeUserNotifications>,
  ResSubscribeUserNotifications | VibesDiyError
> = {
  hash: "subscribe-user-notifications",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqSubscribeUserNotifications(msg.payload) ? msg.payload : undefined;
    if (!ret) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqSubscribeUserNotifications>>,
        ResSubscribeUserNotifications | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const authUserId = req._auth.verifiedAuth.claims.userId;

      if (req.userId !== authUserId) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const userId = req.userId;

      const wsSend = clientWsSend(ctx);
      wsSend.subscribedUserNotificationKeys.add(userNotificationSubscriptionKey(userId));

      if (vctx.registerUserSubscription) {
        vctx.registerUserSubscription(userId).catch((e: unknown) => console.error("UserNotify error:", e));
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-user-notifications",
        status: "ok",
        userId,
      } satisfies ResSubscribeUserNotifications);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const getUserNotificationPreferencesEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetUserNotificationPreferences>,
  ResGetUserNotificationPreferences | VibesDiyError
> = {
  hash: "get-user-notification-preferences",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqGetUserNotificationPreferences(msg.payload) ? msg.payload : undefined;
    if (!ret) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqGetUserNotificationPreferences>>,
        ResGetUserNotificationPreferences | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const row = await ensureUserNotificationPreferences(vctx, userId);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-user-notification-preferences",
        userId,
        preferences: fromDbFlags(row),
        updated: row.updated,
        created: row.created,
      } satisfies ResGetUserNotificationPreferences);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const setUserNotificationPreferencesEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqSetUserNotificationPreferences>,
  ResSetUserNotificationPreferences | VibesDiyError
> = {
  hash: "set-user-notification-preferences",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = isReqSetUserNotificationPreferences(msg.payload) ? msg.payload : undefined;
    if (!ret) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqSetUserNotificationPreferences>>,
        ResSetUserNotificationPreferences | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const row = await ensureUserNotificationPreferences(vctx, userId);
      const merged: UserNotificationPreferences = {
        ...fromDbFlags(row),
        ...req.preferences,
      };
      const now = new Date().toISOString();

      await vctx.sql.db
        .update(vctx.sql.tables.userNotificationPreferences)
        .set({
          ...toDbFlags(merged),
          updated: now,
        })
        .where(eq(vctx.sql.tables.userNotificationPreferences.userId, userId));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-set-user-notification-preferences",
        userId,
        preferences: merged,
        updated: now,
        created: row.created,
      } satisfies ResSetUserNotificationPreferences);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
