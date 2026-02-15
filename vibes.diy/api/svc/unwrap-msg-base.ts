import { Result, Option, ValidateTriggerCtx } from "@adviser/cement";
import { type } from "arktype";
import { InMsgBase, MsgBase, msgBase } from "@vibes.diy/api-types";

// ValidateTriggerCtx<INREQ, REQ, RES>
export function unwrapMsgBase<INREQ, REQ, RES>(
  fn: (payload: MsgBase) => Promise<Result<Option<REQ>>>
): (ctx: ValidateTriggerCtx<INREQ, REQ, RES>) => Promise<Result<Option<REQ>>> {
  return (ctx: ValidateTriggerCtx<INREQ, REQ, RES>): Promise<Result<Option<REQ>>> => {
    const ret = msgBase(ctx.enRequest);
    //console.log("unwrapMsgBase", ret, ctx.enRequest);
    if (ret instanceof type.errors) {
      return Promise.resolve(Result.Ok<Option<REQ>>(Option.None<REQ>()));
    }
    return fn(ret);
  };
}

export function wrapMsgBase<Q, S>(req: MsgBase<Q>, res: InMsgBase<S>): MsgBase<S> {
  return {
    ...req,
    src: req.dst,
    ttl: req.ttl ? req.ttl - 1 : 6,
    ...res,
  };
}
