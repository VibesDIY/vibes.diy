import { command, flag, number, option, optional, string } from "cmd-ts";
import { basename } from "path";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { ResEnsureAppSlug } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { pushFromDir } from "./push-from-dir.js";

export const ReqPush = type({
  type: "'vibes-diy.cli.push'",
  mode: "string",
  appSlug: "string",
  ownerHandle: "string",
  instantJoin: "boolean",
  publicAccess: "boolean",
  apiUrl: "string",
  "idleTimeoutMs?": "number | undefined",
});
export type ReqPush = typeof ReqPush.infer;

export function isReqPush(obj: unknown): obj is ReqPush {
  return !(ReqPush(obj) instanceof type.errors);
}

export const pushEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug> = {
  hash: "vibes-diy.cli.push",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>) => {
    if (isReqPush(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl, { idleTimeoutMs: args.idleTimeoutMs });
    const mode = args.mode === "dev" ? "dev" : "production";
    const appSlug = args.appSlug === "" ? basename(process.cwd()) : args.appSlug;
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);

    const rPush = await pushFromDir({
      dir: process.cwd(),
      mode,
      appSlug,
      ownerHandle,
      instantJoin: args.instantJoin,
      publicAccess: args.publicAccess,
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
      handle: option({
        long: "handle",
        description: "Handle to publish under (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      userSlug: option({
        long: "user-slug",
        // No description — hidden from help output (deprecated alias for --handle)
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      instantJoin: flag({
        long: "instant-join",
        description: "Auto-accept database sharing view requests",
      }),
      publicAccess: flag({
        long: "public",
        description:
          "Enable anonymous public reads for this app (publicAccess.enable). Required for cross-origin <img>/<video> tags reading _files when the iframe can't share auth cookies with the file host.",
      }),
      idleTimeoutMs: option({
        long: "idle-timeout",
        description:
          "Idle timeout in ms (resets on any incoming message). Defaults to api-impl's 30s; bump higher for very large pushes that exceed post-storage DB-write windows.",
        type: optional(number),
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const { handle, userSlug, ...rest } = args;
      return { type: "vibes-diy.cli.push", ...rest, ownerHandle: handle || userSlug };
    }),
  });
}
