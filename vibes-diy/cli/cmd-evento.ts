import { Evento, EventoResult, EventoResultType, HandleTriggerCtx, Result } from "@adviser/cement";
import { userSettingsEvento } from "./cmds/user-settings-cmd.js";
import { skillsEvento } from "./cmds/skills-cmd.js";
import { systemEvento } from "./cmds/system-cmd.js";
import { pushEvento } from "./cmds/push-cmd.js";
import { generateEvento } from "./cmds/generate-cmd.js";
import {
  deviceIdRegisterEvento,
  isCmdProgress,
  isCmdTSMsg,
  sendProgress,
  type CmdProgress,
  type CmdTSMsg,
  type WrapCmdTSMsg,
} from "@fireproof/core-cli";

export type { CmdTSMsg, WrapCmdTSMsg, CmdProgress };
export { isCmdProgress, sendProgress };

export async function sendMsg<Q, S>(
  ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, Q, S>,
  result: S
): Promise<Result<EventoResultType>> {
  await ctx.send.send(ctx, {
    ...ctx.request,
    result,
  } satisfies WrapCmdTSMsg<S>);
  return Result.Ok(EventoResult.Continue);
}

export function cmdTsEvento() {
  const evento = new Evento({
    encode: (i) => {
      if (isCmdTSMsg(i)) {
        return Promise.resolve(Result.Ok(i.result));
      }
      return Promise.resolve(Result.Err("not a cmd-ts-msg"));
    },
    decode: (i) => Promise.resolve(Result.Ok(i)),
  });
  evento.push([userSettingsEvento, skillsEvento, systemEvento, pushEvento, generateEvento, deviceIdRegisterEvento]);
  return evento;
}
