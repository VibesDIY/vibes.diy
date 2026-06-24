import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtRequestGrant, MsgBase, isEvtRequestGrant, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { sendEmailOpts } from "../intern/send-email.js";
import { buildRequestApprovedEmbed, buildRequestPendingEmbed, postEmbed } from "../intern/post-to-discord.js";
import { notifyRequestGrant } from "@vibes.diy/api-svc";

export const evtRequestGrantEvento: EventoHandler<unknown, MsgBase<EvtRequestGrant>, void> = {
  hash: "evt-request-grant",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtRequestGrant(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtRequestGrant>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtRequestGrant>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;

    if (payload.grant.state === "pending") {
      await postEmbed(qctx, buildRequestPendingEmbed(qctx, payload));
    } else if (payload.grant.state === "approved") {
      await postEmbed(qctx, buildRequestApprovedEmbed(qctx, payload, payload.grant.role));
    }

    // if (payload.grant.state === 'pending') {
    //   sendEmailOpts(qctx, [{
    //     action: "request-pending",
    //     dst: payload.grant.foreignInfo.givenEmail,
    //     ownerHandle: payload.ownerHandle,
    //     appSlug: payload.appSlug,
    //     role: payload.grant.role,
    //     token: payload.grant.tokenOrGrantUserId,
    //   }]);
    // }
    // Persist a request-approved / request-revoked notification for the
    // requester (and fan out the live bell). Dedupe carries the grant's
    // `updated` timestamp so re-delivery does not double-notify and a re-grant
    // (a new decision) notifies distinctly.
    await notifyRequestGrant(qctx, payload.grant);

    if (!(payload.grant.foreignInfo.claims?.params.email && payload.grant.foreignInfo.givenEmail)) {
      return Result.Ok(EventoResult.Continue);
    }
    if (payload.grant.state === "approved") {
      await sendEmailOpts(qctx, [
        {
          action: "req-accepted",
          dst: payload.grant.foreignInfo.claims?.params.email || payload.grant.foreignInfo.givenEmail,
          ownerHandle: payload.grant.ownerHandle,
          appSlug: payload.grant.appSlug,
          role: payload.grant.role,
        },
      ]);
    }
    if (payload.grant.state === "revoked") {
      // send a email to the requester that the request has been rejected
      await sendEmailOpts(qctx, [
        {
          action: "req-rejected",
          dst: payload.grant.foreignInfo.claims?.params.email || payload.grant.foreignInfo.givenEmail,
          ownerHandle: payload.grant.ownerHandle,
          appSlug: payload.grant.appSlug,
          role: payload.grant.role,
        },
      ]);
    }

    return Result.Ok(EventoResult.Continue);
  },
};
