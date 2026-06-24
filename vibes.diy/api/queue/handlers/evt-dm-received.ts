import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtDmReceived, MsgBase, isEvtDmReceived, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { buildDmEmbed, postEmbed } from "../intern/post-to-discord.js";
import { notifyDmReceived } from "@vibes.diy/api-svc";

export const evtDmReceivedEvento: EventoHandler<unknown, MsgBase<EvtDmReceived>, void> = {
  hash: "evt-dm-received",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtDmReceived(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtDmReceived>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtDmReceived>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;
    await postEmbed(qctx, buildDmEmbed(qctx, payload));

    // Persist a dm-received notification for the recipient (and fan out the live
    // bell). Dedupe is per-message (channel + docId), so re-delivery does not
    // double-notify.
    await notifyDmReceived(qctx, payload);

    return Result.Ok(EventoResult.Continue);
  },
};
