import { command } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import type { ResEnsureUserSettings } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ReqUserSettings = type({
  type: "'use-vibes.cli.user-settings'",
  apiUrl: "string",
});
export type ReqUserSettings = typeof ReqUserSettings.infer;

export function isReqUserSettings(obj: unknown): obj is ReqUserSettings {
  return !(ReqUserSettings(obj) instanceof type.errors);
}

export const userSettingsEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqUserSettings, ResEnsureUserSettings> = {
  hash: "use-vibes.cli.user-settings",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqUserSettings, ResEnsureUserSettings>) => {
    if (isReqUserSettings(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqUserSettings, ResEnsureUserSettings>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'use-vibes login' first.");
    }
    const rResult = await ectx.vibesDiyApiFactory(ctx.validated.apiUrl).ensureUserSettings({ settings: [] });
    if (rResult.isErr()) {
      return Result.Err(rResult.Err());
    }
    return sendMsg(ctx, rResult.Ok());
  },
};

export function userSettingsCmd(ctx: CliCtx) {
  return command({
    name: "create",
    description: "Generate a new device ID key pair and store it.",
    args: {
      ...cmdTsDefaultArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.user-settings", ...args };
    }),
  });
}
