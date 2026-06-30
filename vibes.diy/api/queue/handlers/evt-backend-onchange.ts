import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtBackendOnChange, MsgBase, isEvtBackendOnChange, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";

/**
 * Per-app backend.js onChange event (#2856 B5). Emitted post-commit by put/delete;
 * pokes the vibe's `BackendDO` to run the `onChange` handler in the per-vibe isolate.
 *
 * **Propagates failure** — a failed poke (transient DO miss / isolate 5xx) returns
 * `Result.Err`, so the queue worker runs `message.retry()` (at-least-once delivery).
 * A poke that resolves cleanly — including "nothing to run" (flag off / no `onChange`
 * export), which the DO answers 2xx — acks. The DO returns a non-2xx only for a
 * retryable failure, mirroring the `evt-backend-arm` contract.
 */
export const evtBackendOnChangeEvento: EventoHandler<unknown, MsgBase<EvtBackendOnChange>, void> = {
  hash: "evt-backend-onchange",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtBackendOnChange(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtBackendOnChange>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtBackendOnChange>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const r = await qctx.invokeOnChange(ctx.validated.payload);
    if (r.isErr()) {
      return Result.Err(r);
    }
    return Result.Ok(EventoResult.Continue);
  },
};
