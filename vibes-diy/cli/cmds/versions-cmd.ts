import { command, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resListVersionsItem } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { formatErr } from "./format-err.js";

export const ReqVersions = type({
  type: "'vibes-diy.cli.versions'",
  appSlug: "string",
  ownerHandle: "string",
  apiUrl: "string",
});
export type ReqVersions = typeof ReqVersions.infer;
export function isReqVersions(obj: unknown): obj is ReqVersions {
  return !(ReqVersions(obj) instanceof type.errors);
}

export const ResVersions = type({
  type: "'vibes-diy.cli.res-versions'",
  appSlug: "string",
  ownerHandle: "string",
  items: resListVersionsItem.array(),
});
export type ResVersions = typeof ResVersions.infer;
export function isResVersions(obj: unknown): obj is ResVersions {
  return !(ResVersions(obj) instanceof type.errors);
}

export const versionsEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqVersions, ResVersions> = {
  hash: "vibes-diy.cli.versions",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqVersions, ResVersions>) => {
    if (isReqVersions(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqVersions, ResVersions>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);
    if (ownerHandle === undefined) {
      return Result.Err("Could not resolve user slug. Run 'vibes-diy login' first.");
    }

    const rVersions = await api.listVersions({ appSlug: args.appSlug, ownerHandle });
    if (rVersions.isErr()) {
      return Result.Err(formatErr(rVersions.Err()));
    }
    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-versions",
      appSlug: args.appSlug,
      ownerHandle,
      items: rVersions.Ok().items,
    } satisfies ResVersions);
  },
};

export function versionsCmd(ctx: CliCtx) {
  return command({
    name: "versions",
    description: "List every version of a vibe (fsId, mode, releaseSeq). Owner sees drafts; pull any with `pull --fsId`.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug (e.g. jchris/hat-smeller)",
        type: optional(string),
      }),
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      handle: option({
        long: "handle",
        description: "Handle (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveVibePositionals({ vibe: args.vibe, handle: args.handle, positionals: [args.appSlug] });
      return {
        type: "vibes-diy.cli.versions",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        apiUrl: args.apiUrl,
      } satisfies ReqVersions;
    }),
  });
}
