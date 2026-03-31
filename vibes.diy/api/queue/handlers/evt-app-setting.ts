import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { CFEnv, EvtAppSetting, MsgBase, isEvtAppSetting, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";

export const evtAppSettingEvento: EventoHandler<unknown, MsgBase<EvtAppSetting>, void> = {
  hash: "evt-app-setting",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtAppSetting(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtAppSetting>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtAppSetting>, void>): Promise<Result<EventoResultType>> => {
    const _env = ctx.ctx.getOrThrow<CFEnv>("queueCtx");
    const _payload = ctx.validated.payload;
    console.log("Handling evt-app-setting event with payload:", _payload);
    // TODO: implement app-setting handler
    return Result.Ok(EventoResult.Continue);
  },
};
