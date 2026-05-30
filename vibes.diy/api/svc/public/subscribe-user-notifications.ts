import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqSubscribeUserNotificationsRaw,
  ResSubscribeUserNotifications,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  isReqSubscribeUserNotificationsRaw,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

// Access the raw WSSendProvider from Evento's wrapped ctx.send.
// Evento wraps the send provider — the raw instance is at .provider.
function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

// Local type that combines the raw type-only check with the required auth field.
type ReqSubscribeUserNotifications = ReqSubscribeUserNotificationsRaw & { auth: DashAuthType };

export const subscribeUserNotificationsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqSubscribeUserNotifications>,
  ResSubscribeUserNotifications | VibesDiyError
> = {
  hash: "subscribe-user-notifications",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqSubscribeUserNotificationsRaw(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqSubscribeUserNotifications }));
    }
    return Result.Ok(Option.None());
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
      const userId = req._auth.verifiedAuth.claims.userId;

      const wsSend = clientWsSend(ctx);
      wsSend.subscribedUserKey = userId;

      if (vctx.registerUserSubscription) {
        vctx.registerUserSubscription(userId).catch((e: unknown) => console.error("UserNotify error:", e));
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-user-notifications",
        status: "ok",
      } satisfies ResSubscribeUserNotifications);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
