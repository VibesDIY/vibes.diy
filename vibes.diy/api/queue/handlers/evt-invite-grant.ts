import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtInviteGrant, MsgBase, isEvtInviteGrant, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { sendEmailOpts } from "../intern/send-email.js";

export const evtInviteGrantEvento: EventoHandler<unknown, MsgBase<EvtInviteGrant>, void> = {
  hash: "evt-invite-grant",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtInviteGrant(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtInviteGrant>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtInviteGrant>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;
    // TODO: implement invite-grant handler
    console.log("Handling evt-invite-grant event with payload:", payload);
    if (payload.op === "delete") {
      // we skip on delete
      return Result.Ok(EventoResult.Continue);
    }
    if (!payload.grant.foreignInfo.givenEmail) {
      // if there is no email, we cannot send an email, so we skip
      return Result.Ok(EventoResult.Continue);
    }
    if (payload.grant.state === "pending") {
      await sendEmailOpts(qctx, [
        {
          action: "invite",
          dst: payload.grant.foreignInfo.givenEmail,
          userSlug: payload.grant.userSlug,
          appSlug: payload.grant.appSlug,
          role: payload.grant.role,
          token: payload.grant.tokenOrGrantUserId,
        },
      ]);
    }
    // if (payload.grant.state === 'accepted') {
    //   // send a email to the invitee that the invite has been accepted
    // }
    if (payload.grant.state === "revoked") {
      // send a email to the invitee that the invite has been revoked
      await sendEmailOpts(qctx, [
        {
          action: "invite-revoked",
          dst: payload.grant.foreignInfo.givenEmail,
          userSlug: payload.grant.userSlug,
          appSlug: payload.grant.appSlug,
          role: payload.grant.role,
        },
      ]);
    }
    return Result.Ok(EventoResult.Continue);
  },
};
