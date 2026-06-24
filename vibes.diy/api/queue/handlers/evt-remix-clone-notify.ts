import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtRemixCloneNotify, MsgBase, isEvtRemixCloneNotify, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { notifyRemixCloneOwner } from "@vibes.diy/api-svc";

// Clone-path (forkApp skipChat) remix notification. A clone is born straight in
// production and never emits evt-new-fs-id, so the classic-remix path (the
// evt-new-fs-id handler) does not cover it. forkApp enqueues this event with the
// clone's (ownerHandle, appSlug); we re-load the clone row + meta and call
// notifyRemixCloneOwner, which dedupes via emitNotification — so queue
// at-least-once redelivery is naturally once-only.
export const evtRemixCloneNotifyEvento: EventoHandler<unknown, MsgBase<EvtRemixCloneNotify>, void> = {
  hash: "evt-remix-clone-notify",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtRemixCloneNotify(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtRemixCloneNotify>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtRemixCloneNotify>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    await notifyRemixCloneOwner(qctx, ctx.validated.payload);
    return Result.Ok(EventoResult.Continue);
  },
};
