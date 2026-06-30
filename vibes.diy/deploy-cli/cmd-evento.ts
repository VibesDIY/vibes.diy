import { Evento, EventoResult, EventoResultType, HandleTriggerCtx, Result } from "@adviser/cement";
import { type } from "arktype";

import { writeEnvEvento } from "./cmds/write-env-cmd.js";

export const CmdTSMsg = type({
  type: "'msg.cmd-ts'",
  cmdTs: type({
    raw: "unknown",
    outputFormat: "'json'|'text'",
  }),
  result: "unknown",
});
export type CmdTSMsg = typeof CmdTSMsg.infer;
export function isCmdTSMsg(u: unknown): u is CmdTSMsg {
  return !(CmdTSMsg(u) instanceof type.errors);
}
export type WrapCmdTSMsg<T> = Omit<CmdTSMsg, "result"> & { result: T };

export const CmdProgress = type({
  type: "'core-cli.progress'",
  level: "'info'|'warn'|'error'",
  message: "string",
});
export type CmdProgress = typeof CmdProgress.infer;

export function isCmdProgress(u: unknown): u is CmdProgress {
  return !(CmdProgress(u) instanceof type.errors);
}

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

export async function sendProgress<Q, S>(
  ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, Q, S>,
  level: CmdProgress["level"],
  message: string
): Promise<void> {
  await ctx.send.send(ctx, {
    ...ctx.request,
    result: {
      type: "core-cli.progress",
      level,
      message,
    } satisfies CmdProgress,
  } satisfies WrapCmdTSMsg<CmdProgress>);
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
  evento.push([writeEnvEvento]);
  return evento;
}
