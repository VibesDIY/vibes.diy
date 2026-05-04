import { command, flag, number, option, optional, string } from "cmd-ts";
import { basename } from "path";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { ResEnsureAppSlug } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { pushFromDir } from "./push-from-dir.js";

export const ReqPush = type({
  type: "'use-vibes.cli.push'",
  mode: "string",
  appSlug: "string",
  userSlug: "string",
  instantJoin: "boolean",
  apiUrl: "string",
  "idleTimeoutMs?": "number | undefined",
});
export type ReqPush = typeof ReqPush.infer;

export function isReqPush(obj: unknown): obj is ReqPush {
  return !(ReqPush(obj) instanceof type.errors);
}

export const pushEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug> = {
  hash: "use-vibes.cli.push",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>) => {
    if (isReqPush(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'use-vibes login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl, { idleTimeoutMs: args.idleTimeoutMs });
    const mode = args.mode === "dev" ? "dev" : "production";
    const appSlug = args.appSlug === "" ? basename(process.cwd()) : args.appSlug;
    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);

    const rPush = await pushFromDir({
      dir: process.cwd(),
      mode,
      appSlug,
      userSlug,
      instantJoin: args.instantJoin,
      apiUrl: args.apiUrl,
      api,
      ctx,
    });
    if (rPush.isErr()) return Result.Err(rPush.Err());

    return sendMsg(ctx, rPush.Ok().result);
  },
};

export function pushCmd(ctx: CliCtx) {
  return command({
    name: "push",
    description: "Upload files from the current directory to a vibe.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      mode: option({
        long: "mode",
        description: "Deploy mode: production or dev",
        type: string,
        defaultValue: () => "production",
        defaultValueIsSerializable: true,
      }),
      appSlug: option({
        long: "app-slug",
        short: "a",
        description: "App slug (defaults to directory name)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      userSlug: option({
        long: "user-slug",
        description: "User slug to publish under (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      instantJoin: flag({
        long: "instant-join",
        description: "Auto-accept database sharing view requests",
      }),
      idleTimeoutMs: option({
        long: "idle-timeout",
        description:
          "Idle timeout in ms (resets on any incoming message). Defaults to api-impl's 10s; bump to e.g. 30000 for very large pushes that exceed post-storage DB-write windows.",
        type: optional(number),
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.push", ...args };
    }),
  });
}
