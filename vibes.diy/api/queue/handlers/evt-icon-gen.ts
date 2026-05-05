import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtIconGen, MsgBase, isEvtIconGen, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { processIconGenEvent } from "../icon-shotter.js";

export const evtIconGenEvento: EventoHandler<unknown, MsgBase<EvtIconGen>, void> = {
  hash: "evt-icon-gen",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtIconGen(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtIconGen>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtIconGen>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const res = await processIconGenEvent(qctx, ctx.validated.payload);
    if (res.isErr()) {
      console.error("Error processing evt-icon-gen:", res.Err());
    }
    return Result.Ok(EventoResult.Continue);
  },
};
