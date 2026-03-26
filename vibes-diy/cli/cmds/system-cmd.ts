import { command } from "cmd-ts";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
} from "@adviser/cement";
import { type } from "arktype";
import { makeBaseSystemPrompt } from "@vibes.diy/prompts";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ResSystem = type({
  type: "'use-vibes.cli.res-system'",
  systemPrompt: "string",
});
export type ResSystem = typeof ResSystem.infer;

export function isResSystem(obj: unknown): obj is ResSystem {
  return !(ResSystem(obj) instanceof type.errors);
}

export const ReqSystem = type({
  type: "'use-vibes.cli.system'",
});
export type ReqSystem = typeof ReqSystem.infer;

export function isReqSystem(obj: unknown): obj is ReqSystem {
  return !(ReqSystem(obj) instanceof type.errors);
}

export const systemEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqSystem, ResSystem> = {
  hash: "use-vibes.cli.system",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqSystem, ResSystem>) => {
    if (isReqSystem(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqSystem, ResSystem>): Promise<Result<EventoResultType>> => {
    const rPrompt = await exception2Result(() =>
      makeBaseSystemPrompt("cli", {
        dependenciesUserOverride: true,
        dependencies: ["fireproof"],
        callAi: {
          ModuleAndOptionsSelection() {
            return Promise.resolve(Result.Err("ModuleAndOptionsSelection is not used by CLI"));
          },
        },
      })
    );
    if (rPrompt.isErr()) {
      return Result.Err(`Failed to build system prompt: ${rPrompt.Err().message}`);
    }
    return sendMsg(ctx, {
      type: "use-vibes.cli.res-system",
      systemPrompt: rPrompt.Ok().systemPrompt,
    } satisfies ResSystem);
  },
};

export function systemCmd(ctx: CliCtx) {
  return command({
    name: "system",
    description: "Emit the base system prompt to stdout.",
    args: {
      ...cmdTsDefaultArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((_args) => {
      return { type: "use-vibes.cli.system" } satisfies ReqSystem;
    }),
  });
}
