import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtBackendArm, MsgBase, isEvtBackendArm, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";

/**
 * Per-app backend.js schedule poke (#2856 B4). Tells a vibe's `BackendDO` to
 * re-evaluate its `scheduled` alarm from the selected release.
 *
 * **Propagates failure** — a failed poke returns `Result.Err`, so the queue worker
 * runs `message.retry()` rather than acking. Deliberately not the swallow-and-log
 * pattern (per Charlie): a poke lost to a transient DO miss must retry, or the
 * vibe's cron silently goes stale.
 */
export const evtBackendArmEvento: EventoHandler<unknown, MsgBase<EvtBackendArm>, void> = {
  hash: "evt-backend-arm",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtBackendArm(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtBackendArm>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtBackendArm>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const { ownerHandle, appSlug } = ctx.validated.payload;
    const r = await qctx.armBackend(ownerHandle, appSlug);
    if (r.isErr()) {
      return Result.Err(r);
    }
    return Result.Ok(EventoResult.Continue);
  },
};
